// The Claude provider (Anthropic Messages API, official SDK), for the
// writing stages: v1 prose and repair, and v2's author. Perception and
// segmentation stay on Gemini (its boxes and masks); RoutedProvider sends
// each call to the provider that owns its model.
//
// Request: system + one user turn of text and base64 image blocks;
// output_config.format json_schema (structured outputs) so the text is the
// JSON; output_config.effort in place of a thinking budget (thinking is
// adaptive on current models); server-side refusal fallback. Streamed and
// collected with finalMessage() so a long answer can't hit an HTTP timeout.
// usage.input_tokens / output_tokens (thinking is billed as output) go to the
// ledger before the output is judged, as with Gemini.
import Anthropic from "npm:@anthropic-ai/sdk@1.3.0";
import { ErrorCode } from "./contract.ts";
import type { CostLedger } from "./cost.ts";
import { type JsonCall, type ModelProvider, ProviderError, imageCount } from "./provider.ts";
import { type JsonSchema, SchemaViolation } from "./schemas.ts";

/** The model the writing stages use when ANTHROPIC_API_KEY is set and AI_PROSE_MODEL isn't. */
export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

export const isClaudeModel = (model: string) => model.startsWith("claude-");

/** Refusal fallback chosen server-side by the refusal's category (Claude API only). */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

// JSON Schema keywords structured outputs doesn't accept; `parse` still enforces them.
const UNSUPPORTED = new Set([
  "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minLength", "maxLength", "pattern", "minItems", "maxItems", "uniqueItems", "minProperties", "maxProperties",
]);

/** The schema as structured outputs takes it: unsupported constraints dropped, every object closed. */
export function claudeSchema(schema: JsonSchema): JsonSchema {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (UNSUPPORTED.has(key)) continue;
      out[key] = key === "properties" || key === "$defs" || key === "definitions"
        ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, walk(v)]))
        : walk(value);
    }
    if (out.type === "object" || "properties" in out) out.additionalProperties = false;
    return out;
  };
  return walk(schema) as JsonSchema;
}

export interface AnthropicOptions {
  apiKey: string;
  /** For tests: the SDK's fetch. */
  fetch?: typeof fetch;
  baseURL?: string;
  now?: () => number;
}

export class AnthropicProvider implements ModelProvider {
  readonly name = "anthropic";
  private readonly client: Anthropic | null;
  private readonly now: () => number;

  constructor(opts: AnthropicOptions) {
    this.now = opts.now ?? Date.now;
    this.client = opts.apiKey
      ? new Anthropic({ apiKey: opts.apiKey, fetch: opts.fetch, baseURL: opts.baseURL, maxRetries: 0 })
      : null;
  }

  /** Writing gets medium effort; a call that asks for no thinking gets low. */
  static effort(call: JsonCall<unknown>): "low" | "medium" {
    return call.thinkingBudget > 0 ? "medium" : "low";
  }

  async generateJson<T>(call: JsonCall<T>, ledger: CostLedger): Promise<T> {
    const fail = (message: string, code: string, retryable: boolean, status?: number) =>
      new ProviderError(`${call.stage} (${call.model}): ${message}`, code, retryable, ledger.usage(), status);

    if (!this.client) throw fail("ANTHROPIC_API_KEY is not set", ErrorCode.providerNotConfigured, false);

    const content: Anthropic.Beta.BetaContentBlockParam[] = call.parts.map((p) =>
      "text" in p
        ? { type: "text", text: p.text }
        : { type: "image", source: { type: "base64", media_type: p.image.mimeType as "image/jpeg", data: p.image.base64 } }
    );
    const started = this.now();
    let message: Anthropic.Beta.BetaMessage;
    try {
      const stream = this.client.beta.messages.stream(
        {
          model: call.model,
          // Thinking shares max_tokens with the answer: room for both.
          max_tokens: call.maxOutputTokens + Math.max(8_000, call.thinkingBudget),
          system: call.system,
          messages: [{ role: "user", content }],
          output_config: {
            effort: AnthropicProvider.effort(call),
            ...(call.unconstrained ? {} : { format: { type: "json_schema", schema: claudeSchema(call.schema) } }),
          },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        } as Anthropic.Beta.MessageCreateParamsStreaming,
        { timeout: Math.max(1, call.timeoutMs), maxRetries: 0 },
      );
      message = await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw fail(`timed out after ${call.timeoutMs} ms`, ErrorCode.providerTimeout, true);
      }
      if (err instanceof Anthropic.RateLimitError) throw fail(err.message, ErrorCode.providerRateLimited, true, err.status);
      if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
        throw fail(err.message, ErrorCode.providerNotConfigured, false, err.status);
      }
      if (err instanceof Anthropic.NotFoundError) throw fail(err.message, ErrorCode.providerRejected, false, err.status);
      if (err instanceof Anthropic.APIError && typeof err.status === "number") {
        if (err.status === 408) throw fail(err.message, ErrorCode.providerTimeout, true, err.status);
        if (err.status >= 500) throw fail(err.message, ErrorCode.providerUnavailable, true, err.status);
        throw fail(err.message, ErrorCode.providerRejected, false, err.status);
      }
      if (err instanceof Anthropic.APIConnectionError) throw fail("request failed (connection)", ErrorCode.providerNetwork, true);
      throw fail(`request failed (${err instanceof Error ? err.name : "error"})`, ErrorCode.providerNetwork, true);
    }

    // Record what was spent before deciding whether the output is usable.
    ledger.record({
      stage: call.stage,
      provider: this.name,
      model: message.model || call.model,
      inputTokens: (message.usage.input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0) +
        (message.usage.cache_read_input_tokens ?? 0),
      outputTokens: message.usage.output_tokens ?? 0,
      imageCount: imageCount(call.parts),
      durationMs: this.now() - started,
    });

    // A refusal the server-side fallback couldn't rescue: let the chain try the next model (Gemini).
    if (message.stop_reason === "refusal") {
      throw fail(`declined (${message.stop_details?.category ?? "no category"})`, ErrorCode.providerBlocked, true);
    }
    if (message.stop_reason === "max_tokens") {
      throw fail("output hit the token cap before the JSON was complete", ErrorCode.modelOutputInvalid, true);
    }
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    if (!text) throw fail(`no output text (stop_reason ${message.stop_reason ?? "missing"})`, ErrorCode.modelOutputInvalid, true);

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

/** Sends each call to the provider that owns its model: Claude models to Anthropic, the rest to Gemini. */
export class RoutedProvider implements ModelProvider {
  readonly name = "routed";
  constructor(private readonly gemini: ModelProvider, private readonly anthropic: ModelProvider) {}

  generateJson<T>(call: JsonCall<T>, ledger: CostLedger): Promise<T> {
    return (isClaudeModel(call.model) ? this.anthropic : this.gemini).generateJson(call, ledger);
  }
}
