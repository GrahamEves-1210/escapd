// Model provider interface and the Gemini REST implementation.
//
// Gemini request format (verified against the v1beta discovery document,
// revision 20261023, and https://ai.google.dev/api/generate-content):
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
//   header x-goog-api-key (never a ?key= URL parameter, so the key cannot leak into logs)
//   { systemInstruction: { parts: [{ text }] },
//     contents: [{ role: "user", parts: [{ text } | { inlineData: { mimeType, data: base64 } }] }],
//     generationConfig: { responseMimeType: "application/json", responseJsonSchema, maxOutputTokens,
//                         thinkingConfig: { thinkingBudget } | { thinkingLevel } } }
//   response: candidates[0].content.parts[].text (parts with thought: true are skipped),
//             candidates[0].finishReason, promptFeedback.blockReason,
//             usageMetadata.{promptTokenCount, candidatesTokenCount, thoughtsTokenCount}
// Thinking tokens are billed at the output rate, so they are recorded as output.
import { ErrorCode, GenerationError, type GenerationUsage } from "./contract.ts";
import { type CostLedger, estimateInputTokens } from "./cost.ts";
import { type JsonSchema, SchemaViolation } from "./schemas.ts";

export type PromptPart = { text: string } | { image: { mimeType: string; base64: string } };

export type Stage = "perception" | "verification" | "prose" | "repair" | "segmentation";

export interface JsonCall<T> {
  stage: Stage;
  model: string;
  system: string;
  parts: PromptPart[];
  schema: JsonSchema;
  /** Validates and converts the parsed JSON; throws SchemaViolation on anything outside the schema. */
  parse: (value: unknown) => T;
  /** Cap on visible output tokens. Gemini counts thinking inside maxOutputTokens, so the budget is added on top. */
  maxOutputTokens: number;
  /** 0 = as little thinking as the model allows. */
  thinkingBudget: number;
  timeoutMs: number;
  temperature?: number;
  /** True: JSON mode without responseJsonSchema, for output whose shape the model was trained on
   *  (segmentation masks); `parse` still checks it. */
  unconstrained?: boolean;
}

export interface ModelProvider {
  readonly name: string;
  /** Records usage in the ledger for every response that reports it, then returns parsed output or throws GenerationError. */
  generateJson<T>(call: JsonCall<T>, ledger: CostLedger): Promise<T>;
}

/** GenerationError with the HTTP status (when there was one) for fallback decisions. */
export class ProviderError extends GenerationError {
  constructor(message: string, code: string, retryable: boolean, usage?: GenerationUsage, readonly status?: number) {
    super(message, code, retryable, usage);
    this.name = "ProviderError";
  }
}

/** Whether a failed call may be retried once on the fallback model (not timeouts: that time is gone). */
export function fallbackEligible(err: unknown): boolean {
  if (!(err instanceof GenerationError)) return false;
  if (err.code === ErrorCode.providerTimeout || err.code === ErrorCode.generationTimeout) return false;
  if (err instanceof ProviderError && err.status === 404) return true;   // model retired or renamed
  return err.retryable;
}

export function imageCount(parts: PromptPart[]): number {
  return parts.filter((p) => "image" in p).length;
}

export function textLength(call: { system: string; parts: PromptPart[] }): number {
  return call.system.length + call.parts.reduce((n, p) => n + ("text" in p ? p.text.length : 0), 0);
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------
export const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";

interface GeminiPart { text?: string; thought?: boolean }
interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
}

// Content-policy stops: the input itself was refused. Retrying the same photos will not help.
const BLOCKED_FINISH = new Set([
  "SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY", "IMAGE_PROHIBITED_CONTENT",
]);

export interface GeminiOptions {
  apiKey: string;
  fetch?: typeof fetch;
  baseUrl?: string;
  now?: () => number;
}

export class GeminiProvider implements ModelProvider {
  readonly name = "gemini";
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly opts: GeminiOptions) {
    this.fetchImpl = opts.fetch ?? fetch;
    this.now = opts.now ?? Date.now;
  }

  /** Thinking config per model family: 2.5 takes a token budget (0 disables thinking on Flash);
   *  3.x accepts a budget too, but thinkingLevel is the documented way to ask for little thinking. */
  static thinkingConfig(model: string, budget: number): Record<string, unknown> {
    if (/^gemini-2\./.test(model)) return { thinkingBudget: Math.max(0, budget) };
    if (budget <= 0) return { thinkingLevel: "LOW" };
    return { thinkingBudget: budget };
  }

  static requestBody(call: JsonCall<unknown>): Record<string, unknown> {
    const parts = call.parts.map((p) =>
      "text" in p ? { text: p.text } : { inlineData: { mimeType: p.image.mimeType, data: p.image.base64 } }
    );
    const generationConfig: Record<string, unknown> = {
      responseMimeType: "application/json",
      ...(call.unconstrained ? {} : { responseJsonSchema: call.schema }),
      maxOutputTokens: call.maxOutputTokens + Math.max(0, call.thinkingBudget),
      thinkingConfig: GeminiProvider.thinkingConfig(call.model, call.thinkingBudget),
    };
    // Gemini 3 guidance is to leave temperature at its default; it is ignored on newer models anyway.
    if (call.temperature !== undefined && /^gemini-2\./.test(call.model)) generationConfig.temperature = call.temperature;
    return {
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: "user", parts }],
      generationConfig,
    };
  }

  async generateJson<T>(call: JsonCall<T>, ledger: CostLedger): Promise<T> {
    const fail = (message: string, code: string, retryable: boolean, status?: number) =>
      new ProviderError(`${call.stage} (${call.model}): ${message}`, code, retryable, ledger.usage(), status);

    if (!this.opts.apiKey) throw fail("AI_PROVIDER_API_KEY is not set", ErrorCode.providerNotConfigured, false);

    const url = `${this.opts.baseUrl ?? GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(call.model)}:generateContent`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, call.timeoutMs));
    const started = this.now();
    let status = 0;
    let raw = "";
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.opts.apiKey },
        body: JSON.stringify(GeminiProvider.requestBody(call)),
        signal: controller.signal,
      });
      status = res.status;
      raw = await res.text();
    } catch (err) {
      if (controller.signal.aborted) throw fail(`timed out after ${call.timeoutMs} ms`, ErrorCode.providerTimeout, true);
      throw fail(`request failed (${err instanceof Error ? err.name : "error"})`, ErrorCode.providerNetwork, true);
    } finally {
      clearTimeout(timer);
    }

    if (status < 200 || status >= 300) throw classifyHttpFailure(status, raw, fail);

    let body: GeminiResponse;
    try {
      body = JSON.parse(raw) as GeminiResponse;
    } catch {
      throw fail("response body is not JSON", ErrorCode.modelOutputInvalid, true);
    }

    // Record what was spent before deciding whether the output is usable.
    const meta = body.usageMetadata ?? {};
    ledger.record({
      stage: call.stage,
      provider: this.name,
      model: call.model,
      inputTokens: meta.promptTokenCount ?? 0,
      outputTokens: (meta.candidatesTokenCount ?? 0) + (meta.thoughtsTokenCount ?? 0),
      imageCount: imageCount(call.parts),
      durationMs: this.now() - started,
    });

    if (body.promptFeedback?.blockReason) {
      throw fail(`prompt blocked by the provider (${body.promptFeedback.blockReason})`, ErrorCode.providerBlocked, false);
    }
    const candidate = body.candidates?.[0];
    const finish = candidate?.finishReason ?? "";
    if (BLOCKED_FINISH.has(finish)) throw fail(`output blocked by the provider (${finish})`, ErrorCode.providerBlocked, false);
    if (finish === "MAX_TOKENS") throw fail("output hit the token cap before the JSON was complete", ErrorCode.modelOutputInvalid, true);
    const text = (candidate?.content?.parts ?? []).filter((p) => !p.thought && typeof p.text === "string")
      .map((p) => p.text).join("");
    if (!text) throw fail(`no output text (finishReason ${finish || "missing"})`, ErrorCode.modelOutputInvalid, true);

    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw fail("output text is not valid JSON", ErrorCode.modelOutputInvalid, true);
    }
    try {
      return call.parse(value);
    } catch (err) {
      if (err instanceof SchemaViolation) throw fail(err.message, ErrorCode.modelOutputInvalid, true);
      throw err;
    }
  }
}

/** 408/429/5xx are transient (retry with backoff); other 4xx mean the request itself is wrong. */
export function classifyHttpFailure(
  status: number,
  raw: string,
  fail: (message: string, code: string, retryable: boolean, status?: number) => ProviderError,
): ProviderError {
  let detail = "";
  try {
    const parsed = JSON.parse(raw) as { error?: { status?: string; message?: string } };
    detail = [parsed.error?.status, parsed.error?.message].filter(Boolean).join(": ");
  } catch {
    // non-JSON error body: report the status only
  }
  const message = `HTTP ${status}${detail ? ` ${detail.slice(0, 200)}` : ""}`;
  if (status === 408) return fail(message, ErrorCode.providerTimeout, true, status);
  if (status === 429) return fail(message, ErrorCode.providerRateLimited, true, status);
  if (status >= 500) return fail(message, ErrorCode.providerUnavailable, true, status);
  return fail(message, ErrorCode.providerRejected, false, status);
}

/**
 * Runs the call on each model in turn: the next model is tried only when the
 * previous failure is fallbackEligible and `canRetry()` still allows it.
 * Every attempt is checked against the room spend cap before and after.
 */
export async function callWithFallback<T>(
  provider: ModelProvider,
  ledger: CostLedger,
  models: string[],
  makeCall: (model: string) => JsonCall<T>,
  canRetry: () => boolean = () => true,
): Promise<T> {
  const chain = [...new Set(models.filter(Boolean))];
  let lastError: unknown;
  for (let i = 0; i < chain.length; i++) {
    try {
      const call = makeCall(chain[i]);
      ledger.ensureBudget(
        call.model,
        estimateInputTokens(textLength(call), imageCount(call.parts)),
        call.maxOutputTokens + Math.max(0, call.thinkingBudget),
      );
      const result = await provider.generateJson(call, ledger);
      ledger.assertWithinCap();
      return result;
    } catch (err) {
      if (err instanceof GenerationError && err.code === ErrorCode.spendCap) throw err;
      lastError = err;
      if (i === chain.length - 1 || !fallbackEligible(err) || !canRetry()) throw err;
    }
  }
  throw lastError;
}
