import { assert, assertAlmostEquals, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { GenerationError } from "./contract.ts";
import { callCostUsd, CostLedger, estimateInputTokens, priceFor, SPEND_CAP_USD } from "./cost.ts";

Deno.test("price table matches plan section 8", () => {
  assertEquals(priceFor("gemini-2.5-flash"), { input: 0.30, output: 2.50 });
  assertEquals(priceFor("gemini-3-flash-preview"), { input: 0.50, output: 3.00 });
  assertEquals(priceFor("gemini-3.1-pro-preview").input, 2.00);
  assertEquals(priceFor("gemini-3.1-pro-preview").output, 12.00);
  assertEquals(SPEND_CAP_USD, 0.90);
});

Deno.test("callCostUsd: per-1M pricing, long-context tier, unknown models priced high", () => {
  assertAlmostEquals(callCostUsd("gemini-2.5-flash", 1_000_000, 0), 0.30, 1e-12);
  assertAlmostEquals(callCostUsd("gemini-2.5-flash", 10_000, 2_000), 0.003 + 0.005, 1e-12);
  assertAlmostEquals(callCostUsd("gemini-3.1-pro-preview", 200_000, 0), 0.40, 1e-12);
  assertAlmostEquals(callCostUsd("gemini-3.1-pro-preview", 200_001, 1_000), (200_001 * 4 + 1_000 * 18) / 1e6, 1e-12);
  assert(callCostUsd("some-new-model", 1_000, 1_000) >= callCostUsd("gemini-3.1-pro-preview", 1_000, 1_000));
});

Deno.test("estimateInputTokens: ~4 chars per token plus 2,500 per image", () => {
  assertEquals(estimateInputTokens(4_000, 0), 1_000);
  assertEquals(estimateInputTokens(1, 2), 5_001);
});

Deno.test("ledger aggregates usage into integer GenerationUsage fields", () => {
  let now = 1_000;
  const ledger = new CostLedger(SPEND_CAP_USD, () => now);
  ledger.record({ stage: "perception", provider: "gemini", model: "gemini-2.5-flash", inputTokens: 1_500.4, outputTokens: 300, imageCount: 1, durationMs: 12 });
  ledger.record({ stage: "perception", provider: "gemini", model: "gemini-2.5-flash", inputTokens: 1_500, outputTokens: 300, imageCount: 1, durationMs: 12 });
  ledger.record({ stage: "prose", provider: "gemini", model: "gemini-3.1-pro-preview", inputTokens: 8_000, outputTokens: 4_000, imageCount: 2, durationMs: 30 });
  now = 61_000;
  const usage = ledger.usage();
  assertEquals(usage.provider, "gemini");
  assertEquals(usage.model, "gemini-2.5-flash,gemini-3.1-pro-preview");
  assertEquals(usage.input_tokens, 11_000);
  assertEquals(usage.output_tokens, 4_600);
  assertEquals(usage.image_count, 4);
  assertEquals(usage.duration_ms, 60_000);
  assertAlmostEquals(usage.cost_usd!, (3_000 * 0.30 + 600 * 2.50 + 8_000 * 2 + 4_000 * 12) / 1e6, 1e-6);
  assert(Number.isInteger(usage.input_tokens) && Number.isInteger(usage.output_tokens));
});

Deno.test("empty ledger reports zero usage", () => {
  const usage = new CostLedger().usage();
  assertEquals(usage.cost_usd, 0);
  assertEquals(usage.input_tokens, 0);
  assertEquals(usage.model, undefined);
});

Deno.test("spend cap: refuses a call whose worst case crosses $0.90, with usage attached", () => {
  const ledger = new CostLedger();
  ledger.record({ stage: "prose", provider: "gemini", model: "gemini-3.1-pro-preview", inputTokens: 100_000, outputTokens: 50_000, imageCount: 0, durationMs: 1 });
  assertAlmostEquals(ledger.totalUsd, 0.80, 1e-9);
  ledger.ensureBudget("gemini-2.5-flash", 4_000, 2_000);   // ~$0.006: fine
  const err = assertThrows(() => ledger.ensureBudget("gemini-3.1-pro-preview", 20_000, 7_024), GenerationError);
  assertEquals(err.code, "spend_cap");
  assertEquals(err.retryable, false);
  assertAlmostEquals(err.usage!.cost_usd!, 0.80, 1e-9);
});

Deno.test("spend cap: assertWithinCap fails once actual spend exceeds the cap", () => {
  const ledger = new CostLedger(0.01);
  ledger.assertWithinCap();
  ledger.record({ stage: "prose", provider: "gemini", model: "gemini-3.1-pro-preview", inputTokens: 10_000, outputTokens: 1_000, imageCount: 0, durationMs: 1 });
  const err = assertThrows(() => ledger.assertWithinCap(), GenerationError);
  assertEquals(err.code, "spend_cap");
  assertEquals(err.retryable, false);
});
