import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { GenerationError } from "./contract.ts";
import { CostLedger } from "./cost.ts";
import { callWithFallback, fallbackEligible, GeminiProvider, type JsonCall, ProviderError } from "./provider.ts";
import { assertSchema, type JsonSchema } from "./schemas.ts";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
  additionalProperties: false,
};

function call(overrides: Partial<JsonCall<{ ok: boolean }>> = {}): JsonCall<{ ok: boolean }> {
  return {
    stage: "perception",
    model: "gemini-2.5-flash",
    system: "system text",
    parts: [{ text: "look" }, { image: { mimeType: "image/jpeg", base64: "AAAA" } }],
    schema: SCHEMA,
    parse: (v) => assertSchema<{ ok: boolean }>(SCHEMA, v),
    maxOutputTokens: 2_000,
    thinkingBudget: 0,
    timeoutMs: 1_000,
    ...overrides,
  };
}

interface Captured { url: string; init: RequestInit }

function stubFetch(respond: (req: Captured) => Response | Promise<Response>, captured: Captured[] = []): typeof fetch {
  return ((input: string | URL | Request, init?: RequestInit) => {
    const req = { url: String(input), init: init ?? {} };
    captured.push(req);
    return Promise.resolve(respond(req));
  }) as typeof fetch;
}

const geminiOk = (text: string, usage = { promptTokenCount: 1_200, candidatesTokenCount: 150, thoughtsTokenCount: 50 }, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    usageMetadata: { ...usage, totalTokenCount: 0 },
    ...extra,
  }), { status: 200, headers: { "Content-Type": "application/json" } });

const errorBody = (status: number, statusText: string) =>
  new Response(JSON.stringify({ error: { code: status, status: statusText, message: "details" } }), { status });

/** A ledger that already holds one earlier call, to prove usage survives failures. */
function ledgerWithPriorSpend(): CostLedger {
  const ledger = new CostLedger();
  ledger.record({ stage: "perception", provider: "gemini", model: "gemini-2.5-flash", inputTokens: 10_000, outputTokens: 1_000, imageCount: 1, durationMs: 100 });
  return ledger;
}

Deno.test("gemini request: key in header (not URL), JSON schema output, inline images, thinking config", async () => {
  const captured: Captured[] = [];
  const provider = new GeminiProvider({ apiKey: "secret-key", fetch: stubFetch(() => geminiOk('{"ok":true}'), captured) });
  const ledger = new CostLedger();
  assertEquals(await provider.generateJson(call({ temperature: 0.2 }), ledger), { ok: true });

  const [{ url, init }] = captured;
  assertEquals(url, "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent");
  assert(!url.includes("secret-key") && !url.includes("key="));
  assertEquals((init.headers as Record<string, string>)["x-goog-api-key"], "secret-key");
  assertEquals(init.method, "POST");
  const body = JSON.parse(String(init.body));
  assertEquals(body.systemInstruction, { parts: [{ text: "system text" }] });
  assertEquals(body.contents, [{ role: "user", parts: [{ text: "look" }, { inlineData: { mimeType: "image/jpeg", data: "AAAA" } }] }]);
  assertEquals(body.generationConfig.responseMimeType, "application/json");
  assertEquals(body.generationConfig.responseJsonSchema, SCHEMA);
  assertEquals(body.generationConfig.maxOutputTokens, 2_000);
  assertEquals(body.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assertEquals(body.generationConfig.temperature, 0.2);
});

Deno.test("gemini request: thinking budget added to the output cap; Gemini 3 uses a level when no budget is wanted", () => {
  const pro = GeminiProvider.requestBody(call({ model: "gemini-3.1-pro-preview", maxOutputTokens: 6_000, thinkingBudget: 1_024, temperature: 0.2 }));
  const proConfig = pro.generationConfig as Record<string, unknown>;
  assertEquals(proConfig.maxOutputTokens, 7_024);
  assertEquals(proConfig.thinkingConfig, { thinkingBudget: 1_024 });
  assertEquals(proConfig.temperature, undefined);
  const flash3 = GeminiProvider.requestBody(call({ model: "gemini-3-flash-preview" }));
  assertEquals((flash3.generationConfig as Record<string, unknown>).thinkingConfig, { thinkingLevel: "LOW" });
});

Deno.test("gemini usage: thinking tokens are billed as output", async () => {
  const provider = new GeminiProvider({ apiKey: "k", fetch: stubFetch(() => geminiOk('{"ok":true}')) });
  const ledger = new CostLedger();
  await provider.generateJson(call(), ledger);
  const [rec] = ledger.calls;
  assertEquals(rec.inputTokens, 1_200);
  assertEquals(rec.outputTokens, 200);
  assertEquals(rec.imageCount, 1);
  assertEquals(ledger.usage().output_tokens, 200);
});

Deno.test("gemini output: thought parts are skipped", async () => {
  const fetchImpl = stubFetch(() =>
    new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "thinking...", thought: true }, { text: '{"ok":' }, { text: "false}" }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    }))
  );
  const provider = new GeminiProvider({ apiKey: "k", fetch: fetchImpl });
  assertEquals(await provider.generateJson(call(), new CostLedger()), { ok: false });
});

async function expectFailure(response: () => Response | Promise<Response>, code: string, retryable: boolean, overrides: Partial<JsonCall<{ ok: boolean }>> = {}) {
  const provider = new GeminiProvider({ apiKey: "k", fetch: stubFetch(response) });
  const ledger = ledgerWithPriorSpend();
  const before = ledger.usage().cost_usd!;
  const err = await assertRejects(() => provider.generateJson(call(overrides), ledger), GenerationError);
  assertEquals(err.code, code);
  assertEquals(err.retryable, retryable);
  assert(err.usage, "usage attached");
  assert(err.usage.cost_usd! >= before, "earlier spend preserved");
  assertEquals(err.usage.input_tokens! >= 10_000, true);
  return { err, ledger };
}

Deno.test("classification: 429 is retryable rate limiting, with earlier usage preserved", async () => {
  const { err } = await expectFailure(() => errorBody(429, "RESOURCE_EXHAUSTED"), "provider_rate_limited", true);
  assert(err.message.includes("429"));
  assertEquals((err as ProviderError).status, 429);
});

Deno.test("classification: 5xx and 408 are retryable", async () => {
  await expectFailure(() => errorBody(500, "INTERNAL"), "provider_unavailable", true);
  await expectFailure(() => errorBody(503, "UNAVAILABLE"), "provider_unavailable", true);
  await expectFailure(() => new Response("gateway", { status: 504 }), "provider_unavailable", true);
  await expectFailure(() => errorBody(408, "DEADLINE_EXCEEDED"), "provider_timeout", true);
});

Deno.test("classification: other 4xx are not retryable", async () => {
  await expectFailure(() => errorBody(400, "INVALID_ARGUMENT"), "provider_rejected", false);
  await expectFailure(() => errorBody(403, "PERMISSION_DENIED"), "provider_rejected", false);
  const { err } = await expectFailure(() => errorBody(404, "NOT_FOUND"), "provider_rejected", false);
  assert(fallbackEligible(err), "a missing model may fall back");
});

Deno.test("classification: timeouts abort the request and are retryable", async () => {
  const hanging = ((_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    })) as typeof fetch;
  const provider = new GeminiProvider({ apiKey: "k", fetch: hanging });
  const ledger = ledgerWithPriorSpend();
  const err = await assertRejects(() => provider.generateJson(call({ timeoutMs: 20 }), ledger), GenerationError);
  assertEquals(err.code, "provider_timeout");
  assertEquals(err.retryable, true);
  assertEquals(err.usage!.input_tokens, 10_000);
  assert(!fallbackEligible(err), "no fallback after a timeout: that time is gone");
});

Deno.test("classification: network failures are retryable", async () => {
  const broken = (() => Promise.reject(new TypeError("connection reset"))) as typeof fetch;
  const provider = new GeminiProvider({ apiKey: "k", fetch: broken });
  const err = await assertRejects(() => provider.generateJson(call(), new CostLedger()), GenerationError);
  assertEquals(err.code, "provider_network");
  assertEquals(err.retryable, true);
});

Deno.test("output outside the schema is rejected, and that call's usage is still recorded", async () => {
  const { err, ledger } = await expectFailure(() => geminiOk('{"ok":true,"extra":1}'), "model_output_invalid", true);
  assert(err.message.includes("unexpected property"));
  assertEquals(ledger.calls.length, 2);
  assertEquals(err.usage!.input_tokens, 11_200);
});

Deno.test("non-JSON text, truncation and empty output are retryable bad output", async () => {
  await expectFailure(() => geminiOk("Sure! Here is the JSON: {"), "model_output_invalid", true);
  await expectFailure(() =>
    new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: '{"ok":' }] }, finishReason: "MAX_TOKENS" }],
      usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2_000 },
    })), "model_output_invalid", true);
  await expectFailure(() => new Response(JSON.stringify({ candidates: [] })), "model_output_invalid", true);
});

Deno.test("content blocks are not retryable", async () => {
  await expectFailure(() => new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } })), "provider_blocked", false);
  await expectFailure(() =>
    new Response(JSON.stringify({ candidates: [{ finishReason: "PROHIBITED_CONTENT" }], usageMetadata: { promptTokenCount: 5 } })),
    "provider_blocked", false);
});

Deno.test("missing API key fails fast and non-retryably without a request", async () => {
  const captured: Captured[] = [];
  const provider = new GeminiProvider({ apiKey: "", fetch: stubFetch(() => geminiOk("{}"), captured) });
  const err = await assertRejects(() => provider.generateJson(call(), new CostLedger()), GenerationError);
  assertEquals(err.code, "provider_not_configured");
  assertEquals(err.retryable, false);
  assertEquals(captured.length, 0);
});

Deno.test("callWithFallback: retryable failure moves to the fallback model", async () => {
  const captured: Captured[] = [];
  const fetchImpl = stubFetch((req) => (req.url.includes("gemini-2.5-flash") ? errorBody(503, "UNAVAILABLE") : geminiOk('{"ok":true}')), captured);
  const provider = new GeminiProvider({ apiKey: "k", fetch: fetchImpl });
  const result = await callWithFallback(provider, new CostLedger(), ["gemini-2.5-flash", "gemini-3-flash-preview"], (model) => call({ model }));
  assertEquals(result, { ok: true });
  assertEquals(captured.map((c) => c.url.split("/models/")[1]), ["gemini-2.5-flash:generateContent", "gemini-3-flash-preview:generateContent"]);
});

Deno.test("callWithFallback: non-retryable failures and exhausted time do not fall back", async () => {
  const captured: Captured[] = [];
  const provider = new GeminiProvider({ apiKey: "k", fetch: stubFetch(() => errorBody(400, "INVALID_ARGUMENT"), captured) });
  await assertRejects(() => callWithFallback(provider, new CostLedger(), ["a", "b"], (model) => call({ model })), GenerationError);
  assertEquals(captured.length, 1);

  const busy: Captured[] = [];
  const busyProvider = new GeminiProvider({ apiKey: "k", fetch: stubFetch(() => errorBody(503, "UNAVAILABLE"), busy) });
  await assertRejects(() => callWithFallback(busyProvider, new CostLedger(), ["a", "b"], (model) => call({ model }), () => false), GenerationError);
  assertEquals(busy.length, 1);
});

Deno.test("callWithFallback: the spend cap is checked before the request is sent", async () => {
  const captured: Captured[] = [];
  const provider = new GeminiProvider({ apiKey: "k", fetch: stubFetch(() => geminiOk('{"ok":true}'), captured) });
  const ledger = new CostLedger(0.001);
  const err = await assertRejects(
    () => callWithFallback(provider, ledger, ["gemini-3.1-pro-preview", "gemini-2.5-flash"], (model) => call({ model, maxOutputTokens: 6_000 })),
    GenerationError,
  );
  assertEquals(err.code, "spend_cap");
  assertEquals(err.retryable, false);
  assertEquals(captured.length, 0);
});
