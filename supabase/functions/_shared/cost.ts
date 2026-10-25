// Token pricing, per-call accounting and the per-room spend cap.
//
// One CostLedger lives for one generatePuzzle call. Every provider response
// that carries usageMetadata is recorded here, even when the response is then
// rejected, so failed attempts still report what they cost.
import { ErrorCode, GenerationError, type GenerationUsage } from "./contract.ts";

export interface ModelPrice {
  input: number;   // USD per 1M input tokens (images bill as input)
  output: number;  // USD per 1M output tokens (thinking tokens bill as output)
  longContext?: { threshold: number; input: number; output: number };
}

// Standard tier list prices, verified 22 Oct 2026 (plan section 8;
// https://ai.google.dev/gemini-api/docs/pricing). Non-Gemini rows are kept
// for a future provider; only Gemini is implemented.
export const PRICES: Readonly<Record<string, ModelPrice>> = {
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-3-flash-preview": { input: 0.50, output: 3.00 },
  "gemini-3.1-pro-preview": {
    input: 2.00, output: 12.00,
    longContext: { threshold: 200_000, input: 4.00, output: 18.00 },
  },
  "gpt-5.4-mini": { input: 0.75, output: 4.50 },
  "claude-sonnet-5-5": { input: 2.00, output: 10.00 },
};

// Unknown models are priced at the most expensive known rate so the cap still bites.
const UNKNOWN_MODEL_PRICE: ModelPrice = { input: 4.00, output: 18.00 };

/** Abort threshold for one generatePuzzle call. */
export const SPEND_CAP_USD = 0.90;

/** Planning assumption for a ~1600 px photo (plan section 8); used only for pre-call estimates. */
export const IMAGE_TOKEN_ESTIMATE = 2_500;

export function priceFor(model: string): ModelPrice {
  return PRICES[model] ?? UNKNOWN_MODEL_PRICE;
}

export function callCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model);
  const tier = price.longContext && inputTokens > price.longContext.threshold ? price.longContext : price;
  return (inputTokens * tier.input + outputTokens * tier.output) / 1_000_000;
}

/** Rough input-token estimate for a prompt: ~4 characters per token plus a flat rate per image. */
export function estimateInputTokens(textChars: number, imageCount: number): number {
  return Math.ceil(textChars / 4) + imageCount * IMAGE_TOKEN_ESTIMATE;
}

export interface CallRecord {
  stage: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;   // candidates + thoughts
  imageCount: number;
  durationMs: number;
  costUsd: number;
}

const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export class CostLedger {
  readonly calls: CallRecord[] = [];
  private readonly startedAt: number;

  constructor(readonly capUsd = SPEND_CAP_USD, private readonly now: () => number = Date.now) {
    this.startedAt = now();
  }

  record(entry: Omit<CallRecord, "costUsd">): CallRecord {
    const clean = (n: number) => (Number.isFinite(n) && n > 0 ? Math.round(n) : 0);
    const call: CallRecord = {
      ...entry,
      inputTokens: clean(entry.inputTokens),
      outputTokens: clean(entry.outputTokens),
      imageCount: clean(entry.imageCount),
      durationMs: clean(entry.durationMs),
      costUsd: 0,
    };
    call.costUsd = callCostUsd(call.model, call.inputTokens, call.outputTokens);
    this.calls.push(call);
    return call;
  }

  get totalUsd(): number {
    return this.calls.reduce((sum, c) => sum + c.costUsd, 0);
  }

  /**
   * Refuses a call whose worst case (estimated input + the full output cap)
   * would take the room over the cap. Throws non-retryable spend_cap.
   */
  ensureBudget(model: string, estimatedInputTokens: number, maxOutputTokens: number): void {
    const worstCase = callCostUsd(model, estimatedInputTokens, maxOutputTokens);
    if (this.totalUsd + worstCase > this.capUsd) {
      throw new GenerationError(
        `room spend cap reached: $${round6(this.totalUsd)} spent, next call could cost $${round6(worstCase)} (cap $${this.capUsd})`,
        ErrorCode.spendCap, false, this.usage());
    }
  }

  /** Throws non-retryable spend_cap if recorded spend already exceeds the cap. */
  assertWithinCap(): void {
    if (this.totalUsd > this.capUsd) {
      throw new GenerationError(
        `room spend cap exceeded: $${round6(this.totalUsd)} (cap $${this.capUsd})`,
        ErrorCode.spendCap, false, this.usage());
    }
  }

  /** Aggregate for private.generation_usage (one row per attempt). */
  usage(): GenerationUsage {
    const models = [...new Set(this.calls.map((c) => c.model))];
    const providers = [...new Set(this.calls.map((c) => c.provider))];
    return {
      provider: providers.join(",") || undefined,
      model: models.join(",") || undefined,
      input_tokens: this.calls.reduce((s, c) => s + c.inputTokens, 0),
      output_tokens: this.calls.reduce((s, c) => s + c.outputTokens, 0),
      image_count: this.calls.reduce((s, c) => s + c.imageCount, 0),
      cost_usd: round6(this.totalUsd),
      duration_ms: Math.max(0, Math.round(this.now() - this.startedAt)),
    };
  }
}
