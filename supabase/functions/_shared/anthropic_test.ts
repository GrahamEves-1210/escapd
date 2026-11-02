import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { AnthropicProvider, claudeSchema, RoutedProvider } from "./anthropic.ts";
import { ErrorCode } from "./contract.ts";
import { CostLedger } from "./cost.ts";
import { callWithFallback, type JsonCall, type ModelProvider, ProviderError } from "./provider.ts";
import { type JsonSchema, SchemaViolation } from "./schemas.ts";

const SCHEMA: JsonSchema = {
  type: "object",
  properties: { title: { type: "string" }, clues: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 9 } },
  required: ["title", "clues"],
};

function call(model = "claude-opus-5-5"): JsonCall<{ title: string }> {
  return {
    stage: "prose",
    model,
    system: "Write the case.",
    parts: [{ text: "Photo 1" }, { image: { mimeType: "image/jpeg", base64: "AAAA" } }, { text: "Brief" }],
    schema: SCHEMA,
    parse: (v) => {
      const o = v as { title?: unknown };
      if (typeof o?.title !== "string") throw new SchemaViolation(["title missing"]);
      return { title: o.title };
    },
    maxOutputTokens: 4_000,
    thinkingBudget: 1_000,
    timeoutMs: 10_000,
  };
}

/** A streamed Messages API response (server-sent events) carrying `text`. */
function sse(text: string, stop = "end_turn", usage = { input_tokens: 1200, output_tokens: 300 }): Response {
  const events: Array<[string, unknown]> = [
    ["message_start", { type: "message_start", message: { id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } }],
    ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
    ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    ["message_delta", { type: "message_delta", delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: usage.output_tokens } }],
    ["message_stop", { type: "message_stop" }],
  ];
  const body = events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function provider(respond: (body: Record<string, unknown>, headers: Headers) => Response) {
  const seen: Array<{ body: Record<string, unknown>; headers: Headers }> = [];
  const fetchImpl = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    const headers = new Headers(init?.headers);
    seen.push({ body, headers });
    return respond(body, headers);
  }) as typeof fetch;
  return { p: new AnthropicProvider({ apiKey: "sk-test", fetch: fetchImpl }), seen };
}

Deno.test("claudeSchema drops unsupported constraints and closes every object", () => {
  const s = claudeSchema(SCHEMA) as unknown as Record<string, unknown>;
  const props = s.properties as Record<string, Record<string, unknown>>;
  assertEquals(s.additionalProperties, false);
  assertEquals(props.title, { type: "string" });
  assertEquals(props.clues, { type: "array", items: { type: "string" } });
});

Deno.test("sends text and images, structured output, effort and the refusal fallback; returns parsed JSON", async () => {
  const { p, seen } = provider(() => sse(JSON.stringify({ title: "The Long Night", clues: ["a"] })));
  const ledger = new CostLedger(10, () => 0);
  const out = await p.generateJson(call(), ledger);
  assertEquals(out, { title: "The Long Night" });
  const { body, headers } = seen[0];
  assertEquals(body.model, "claude-opus-5-5");
  assertEquals(body.system, "Write the case.");
  assertEquals(body.fallbacks, "default");
  assert((headers.get("anthropic-beta") ?? "").includes("server-side-fallback-2026-07-01"));
  const config = body.output_config as { effort: string; format: { type: string; schema: Record<string, unknown> } };
  assertEquals(config.effort, "medium");
  assertEquals(config.format.type, "json_schema");
  assertEquals(config.format.schema.additionalProperties, false);
  const content = (body.messages as Array<{ content: Array<{ type: string }> }>)[0].content;
  assertEquals(content.map((b) => b.type), ["text", "image", "text"]);
  assertEquals([ledger.usage().input_tokens, ledger.usage().output_tokens, ledger.usage().provider], [1200, 300, "anthropic"]);
});

Deno.test("a refusal is retryable so the chain falls back to the next model", async () => {
  const { p } = provider(() => sse("", "refusal"));
  const err = await assertRejects(() => p.generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals(err.code, ErrorCode.providerBlocked);
  assert(err.retryable);
});

Deno.test("output cut off by max_tokens or invalid JSON is a retryable invalid output", async () => {
  const cut = provider(() => sse('{"title": "The', "max_tokens"));
  const e1 = await assertRejects(() => cut.p.generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals(e1.code, ErrorCode.modelOutputInvalid);
  const bad = provider(() => sse("not json"));
  const e2 = await assertRejects(() => bad.p.generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals(e2.code, ErrorCode.modelOutputInvalid);
});

Deno.test("HTTP failures map to the pipeline's error codes", async () => {
  const err = (status: number) => () =>
    new Response(JSON.stringify({ type: "error", error: { type: "x", message: "nope" } }), { status, headers: { "content-type": "application/json" } });
  const rate = await assertRejects(() => provider(err(429)).p.generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals([rate.code, rate.retryable], [ErrorCode.providerRateLimited, true]);
  const down = await assertRejects(() => provider(err(529)).p.generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals([down.code, down.retryable], [ErrorCode.providerUnavailable, true]);
  const auth = await assertRejects(() => provider(err(401)).p.generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals([auth.code, auth.retryable], [ErrorCode.providerNotConfigured, false]);
});

Deno.test("no key: not configured", async () => {
  const err = await assertRejects(() => new AnthropicProvider({ apiKey: "" }).generateJson(call(), new CostLedger(10, () => 0)), ProviderError);
  assertEquals(err.code, ErrorCode.providerNotConfigured);
});

Deno.test("RoutedProvider sends Claude models to Anthropic and the rest to Gemini; a Claude failure falls back to Gemini", async () => {
  const used: string[] = [];
  const stub = (name: string, fail: boolean): ModelProvider => ({
    name,
    generateJson: <T>(c: JsonCall<T>) => {
      used.push(`${name}:${c.model}`);
      if (fail) return Promise.reject(new ProviderError("down", ErrorCode.providerUnavailable, true, undefined, 529));
      return Promise.resolve(c.parse({ title: name }));
    },
  });
  const routed = new RoutedProvider(stub("gemini", false), stub("anthropic", true));
  const out = await callWithFallback(routed, new CostLedger(10, () => 0), ["claude-opus-5-5", "gemini-3.1-pro-preview"], (m) => call(m));
  assertEquals(out, { title: "gemini" });
  assertEquals(used, ["anthropic:claude-opus-5-5", "gemini:gemini-3.1-pro-preview"]);
});
