// End-to-end tests of generatePuzzle with stubbed providers, photo fetches and
// preview RPC. No network, no Supabase.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import {
  encodeBase64,
  type GenerationDeps,
  GenerationError,
  type GenerationInput,
  generatePuzzle,
  isMissingFunction,
  type PipelineConfig,
} from "./ai.ts";
import { GeminiProvider, ProviderError } from "./provider.ts";
import { checkPuzzle } from "./puzzle-check.ts";
import {
  FakeProvider,
  perceptionHandler,
  photoBytes,
  proseHandler,
  SCENE,
  seededRandomInt,
  verificationHandler,
} from "./test_fixtures.ts";

const CONFIG: PipelineConfig = {
  apiKey: "test-key",
  perceptionModel: "gemini-2.5-flash",
  perceptionFallbackModel: "gemini-3-flash-preview",
  proseModel: "gemini-3.1-pro-preview",
  proseFallbackModel: "",
  spendCapUsd: 0.90,
  deadlineMs: 100_000,
};

// Positions deliberately out of order and non-contiguous; the output must echo ids sorted by position.
const INPUT: GenerationInput = {
  jobId: "00000000-0000-4000-8000-0000000000aa",
  roomId: "00000000-0000-4000-8000-0000000000bb",
  attempt: 1,
  promptVersion: "v1",
  outputSchemaVersion: 1,
  photos: [
    { photoId: "photo-five", position: 5, mimeType: "image/jpeg", signedUrl: "https://storage.invalid/signed/5?token=secret" },
    { photoId: "photo-zero", position: 0, mimeType: "image/jpeg", signedUrl: "https://storage.invalid/signed/0?token=secret" },
    { photoId: "photo-two", position: 2, mimeType: "image/png", signedUrl: "https://storage.invalid/signed/2?token=secret" },
  ],
};
const ORDERED_IDS = ["photo-zero", "photo-two", "photo-five"];

function deps(provider: FakeProvider | GeminiProvider, overrides: Partial<GenerationDeps> = {}): Partial<GenerationDeps> {
  return {
    config: CONFIG,
    provider,
    fetchPhoto: (photo) => Promise.resolve(photoBytes(photo.position)),
    preview: () => Promise.resolve([]),
    random: () => 0.37,
    randomInt: seededRandomInt(7),
    log: () => {},
    ...overrides,
  };
}

function happyProvider(opts: { writeLiteral?: boolean } = {}) {
  return new FakeProvider({
    perception: perceptionHandler(),
    verification: verificationHandler(),
    prose: proseHandler(opts),
    repair: proseHandler(opts),
  });
}

type Json = Record<string, unknown>;
const items = (pub: Json) => pub.items as Array<{ id: string; name: string; description: string }>;
const hotspots = (pub: Json) => pub.hotspots as Array<{ id: string; description: string; photo_index: number }>;

Deno.test("happy path: a valid schema-v1 room with usage, hints and echoed photos", async () => {
  const provider = happyProvider();
  let previews = 0;
  const out = await generatePuzzle(INPUT, deps(provider, { preview: () => (previews++, Promise.resolve([])) }));

  assertEquals(checkPuzzle(out.publicDefinition, out.solution, { photoIds: ORDERED_IDS, generation: true }), []);
  assertEquals(out.publicDefinition.photos, ORDERED_IDS.map((photo_id) => ({ photo_id })));
  assertEquals(provider.stages(), ["perception", "perception", "perception", "verification", "prose"]);
  assertEquals(previews, 1);

  // one hotspot per real object: the desk seen from two angles appears once
  const labels = (out.publicDefinition.hotspots as Array<{ object_label: string }>).map((h) => h.object_label);
  assertEquals(labels.length, new Set(labels).size);

  // secret ladder of three hints on every puzzle; nothing secret in public
  for (const s of Object.values((out.solution as { puzzles: Record<string, { hints: string[] }> }).puzzles)) {
    assertEquals(s.hints.length, 3);
  }
  assert(!JSON.stringify(out.publicDefinition).includes('"hints"'));

  // usage: 3 perception + 1 verification + 1 prose call, images 3 + 3 + 3
  assertEquals(out.usage.input_tokens, 5_000);
  assertEquals(out.usage.output_tokens, 1_500);
  assertEquals(out.usage.image_count, 9);
  assertEquals(out.usage.model, "gemini-2.5-flash,gemini-3.1-pro-preview");
  assert(out.usage.cost_usd! > 0 && out.usage.cost_usd! < 0.90);
  assert(Number.isInteger(out.usage.duration_ms));

  // the prose call saw the photos; the code literal is only where it belongs
  const prose = provider.calls.find((c) => c.stage === "prose")!;
  assertEquals(prose.parts.filter((p) => "image" in p).length, 3);
  assertEquals(prose.thinkingBudget, 1_024);
  assertEquals(prose.maxOutputTokens, 6_000);
  assertEquals(provider.calls.find((c) => c.stage === "perception")!.maxOutputTokens, 2_000);
});

Deno.test("the code literal is inserted when the model leaves it out", async () => {
  const out = await generatePuzzle(INPUT, deps(happyProvider({ writeLiteral: false })));
  const solution = out.solution as { puzzles: Record<string, { answer?: string }> };
  const code = Object.values(solution.puzzles).find((p) => p.answer)!.answer!;
  const codePuzzle = (out.publicDefinition.puzzles as Array<{ id: string; kind: string }>).find((p) => p.kind === "code")!;
  assert(code.match(/^\d{4}$/));
  const clued = items(out.publicDefinition).filter((i) => i.description.includes(code));
  assert(clued.length >= 1, "some held item carries the code");
  assertEquals(checkPuzzle(out.publicDefinition, out.solution, { photoIds: ORDERED_IDS, generation: true }), []);
  assert(!hotspots(out.publicDefinition).some((h) => h.description.includes(code)));
  assert((solution.puzzles[codePuzzle.id] as { hints?: string[] }).hints![2].includes(code));
});

Deno.test("a code leaked into hotspot text is replaced, not published", async () => {
  const provider = new FakeProvider({
    perception: perceptionHandler(), verification: verificationHandler(), prose: proseHandler({ leakCodeInHotspot: true }),
  });
  const out = await generatePuzzle(INPUT, deps(provider));
  assertEquals(checkPuzzle(out.publicDefinition, out.solution, { photoIds: ORDERED_IDS, generation: true }), []);
});

Deno.test("person in a photo: non-retryable person_or_sensitive naming the position, usage kept", async () => {
  const provider = new FakeProvider({ perception: perceptionHandler({ flagPhoto: 2 }) });
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider)), GenerationError);
  assertEquals(err.code, "person_or_sensitive");
  assertEquals(err.retryable, false);
  assert(err.message.includes("position(s): 2"), err.message);   // photo 2 of 3 = position 2
  // Older clients parse the prefix up to the first full stop; newer ones read the reasons tail.
  assert(/photo position\(s\): 2\. /.test(err.message), err.message);
  assert(err.message.endsWith("Reasons: 2=person."), err.message);
  assertEquals(err.usage!.input_tokens, 3_000);
  assert(err.usage!.cost_usd! > 0);
  assertEquals(provider.stages(), ["perception", "perception", "perception"]);
});

Deno.test("legible private text also fails as person_or_sensitive", async () => {
  const provider = new FakeProvider({ perception: perceptionHandler({ flagPhoto: 3, flag: "text" }) });
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider)), GenerationError);
  assertEquals(err.code, "person_or_sensitive");
  assert(err.message.includes("position(s): 5"), err.message);
  assert(err.message.endsWith("Reasons: 5=private_text."), err.message);
});

Deno.test("too few verified objects: non-retryable too_few_objects with usage", async () => {
  const keep = new Set(["writing desk", "bookshelf", "wall clock"]);
  const provider = new FakeProvider({
    perception: perceptionHandler(),
    verification: verificationHandler({ verdict: (label) => (keep.has(label) ? "visible" : "occluded") }),
  });
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider)), GenerationError);
  assertEquals(err.code, "too_few_objects");
  assertEquals(err.retryable, false);
  assert(err.message.includes("Only 3"));
  assertEquals(err.usage!.input_tokens, 4_000);
});

Deno.test("too few candidates skips the verification call", async () => {
  const provider = new FakeProvider({ perception: perceptionHandler({ scene: { 1: SCENE[1].slice(0, 1), 2: [], 3: [] } }) });
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider)), GenerationError);
  assertEquals(err.code, "too_few_objects");
  assertEquals(provider.stages().includes("verification"), false);
});

Deno.test("repair: one text-only repair call when the preview reports errors", async () => {
  const provider = happyProvider();
  const answers = [["clue coverage: something the TS check cannot see"], []];
  const out = await generatePuzzle(INPUT, deps(provider, { preview: () => Promise.resolve(answers.shift() ?? []) }));
  assertEquals(provider.stages(), ["perception", "perception", "perception", "verification", "prose", "repair"]);
  const repair = provider.calls.find((c) => c.stage === "repair")!;
  assertEquals(repair.parts.filter((p) => "image" in p).length, 0);
  assert(repair.parts.some((p) => "text" in p && p.text.includes("clue coverage: something the TS check cannot see")));
  assertEquals(checkPuzzle(out.publicDefinition, out.solution, { photoIds: ORDERED_IDS, generation: true }), []);
  assertEquals(out.usage.input_tokens, 6_000);
});

Deno.test("still invalid after the repair: non-retryable invalid_after_repair with usage", async () => {
  const provider = happyProvider();
  const err = await assertRejects(
    () => generatePuzzle(INPUT, deps(provider, { preview: () => Promise.resolve(["exit puzzle x is not reachable"]) })),
    GenerationError,
  );
  assertEquals(err.code, "invalid_after_repair");
  assertEquals(err.retryable, false);
  assert(err.message.includes("exit puzzle x is not reachable"));
  assertEquals(provider.stages().filter((s) => s === "repair").length, 1);
  assertEquals(err.usage!.input_tokens, 6_000);
});

Deno.test("preview RPC missing: falls back to the TS preflight only", async () => {
  const out = await generatePuzzle(INPUT, deps(happyProvider(), { preview: () => Promise.resolve(null) }));
  assertEquals(checkPuzzle(out.publicDefinition, out.solution, { photoIds: ORDERED_IDS, generation: true }), []);
  assert(isMissingFunction({ code: "PGRST202", message: "Could not find the function public.worker_preview_puzzle" }));
  assert(isMissingFunction({ message: "Could not find the function public.worker_preview_puzzle(p_public_definition, p_solution) in the schema cache" }));
  assert(!isMissingFunction({ code: "57014", message: "canceling statement due to statement timeout" }));
});

Deno.test("provider rate limit during prose: retryable, usage of earlier stages kept", async () => {
  const provider = new FakeProvider({
    perception: perceptionHandler(),
    verification: verificationHandler(),
    prose: () => {
      throw new ProviderError("prose (gemini-3.1-pro-preview): HTTP 429", "provider_rate_limited", true, undefined, 429);
    },
  });
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider)), GenerationError);
  assertEquals(err.code, "provider_rate_limited");
  assertEquals(err.retryable, true);
  assertEquals(err.usage!.input_tokens, 4_000);
  assert(err.usage!.cost_usd! > 0);
});

Deno.test("perception falls back to the second model on a retryable failure", async () => {
  const provider = new FakeProvider({
    perception: (call) => {
      if (call.model === "gemini-2.5-flash") throw new ProviderError("HTTP 503", "provider_unavailable", true, undefined, 503);
      return perceptionHandler()(call);
    },
    verification: verificationHandler(),
    prose: proseHandler(),
  });
  const out = await generatePuzzle(INPUT, deps(provider));
  assert(out.usage.model!.includes("gemini-3-flash-preview"));
});

Deno.test("spend cap: non-retryable spend_cap before an unaffordable call", async () => {
  const provider = happyProvider();
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider, { config: { ...CONFIG, spendCapUsd: 0.02 } })), GenerationError);
  assertEquals(err.code, "spend_cap");
  assertEquals(err.retryable, false);
  assert(err.usage!.cost_usd! <= 0.02);
  assertEquals(provider.stages().includes("prose"), false);
});

Deno.test("deadline: running out of time is retryable generation_timeout", async () => {
  let now = 0;
  const provider = new FakeProvider({
    perception: (call) => {
      now += 60_000;   // each perception call "takes" a minute
      return perceptionHandler()(call);
    },
    verification: verificationHandler(),
    prose: proseHandler(),
  });
  const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider, { now: () => now })), GenerationError);
  assertEquals(err.code, "generation_timeout");
  assertEquals(err.retryable, true);
  // two calls ran (and are billed); the third was refused for lack of time
  assertEquals(err.usage!.input_tokens, 2_000);
  assertEquals(provider.stages(), ["perception", "perception"]);
});

Deno.test("photo problems: missing objects are non-retryable, storage hiccups retryable; no URL in messages", async () => {
  const notFound = await assertRejects(() =>
    generatePuzzle(INPUT, deps(happyProvider(), {
      fetchPhoto: (photo) => Promise.reject(new GenerationError(`photo position ${photo.position} could not be downloaded (HTTP 404)`, "photo_unavailable", false)),
    })), GenerationError);
  assertEquals(notFound.code, "photo_unavailable");
  assertEquals(notFound.retryable, false);
  assert(!notFound.message.includes("token=secret"));
  assertEquals(notFound.usage!.cost_usd, 0);

  const tooBig = await assertRejects(() =>
    generatePuzzle(INPUT, deps(happyProvider(), { fetchPhoto: () => Promise.resolve(new Uint8Array(7_000_000)) })), GenerationError);
  assertEquals(tooBig.code, "photos_too_large");
});

Deno.test("invalid input: unsupported schema version or no photos", async () => {
  const v2 = await assertRejects(() => generatePuzzle({ ...INPUT, outputSchemaVersion: 2 }, deps(happyProvider())), GenerationError);
  assertEquals(v2.code, "invalid_input");
  assertEquals(v2.retryable, false);
  const none = await assertRejects(() => generatePuzzle({ ...INPUT, photos: [] }, deps(happyProvider())), GenerationError);
  assertEquals(none.code, "invalid_input");
});

Deno.test("unexpected exceptions become retryable internal_error with usage", async () => {
  const provider = new FakeProvider({
    perception: perceptionHandler(),
    verification: () => {
      throw new RangeError("boom");
    },
  });
  const origError = console.error;
  console.error = () => {};
  try {
    const err = await assertRejects(() => generatePuzzle(INPUT, deps(provider)), GenerationError);
    assertEquals(err.code, "internal_error");
    assertEquals(err.retryable, true);
    assertEquals(err.usage!.input_tokens, 3_000);
  } finally {
    console.error = origError;
  }
});

// ---------------------------------------------------------------------------
// Full path through the real Gemini client with a stubbed fetch
// ---------------------------------------------------------------------------
Deno.test("end to end through GeminiProvider with a stubbed fetch", async () => {
  // The fixture stage handlers produce the response bodies; routing is by system prompt.
  const handlers: Record<string, (call: never) => unknown> = {
    "You are the perception stage": perceptionHandler(),
    "You are the verification stage": verificationHandler(),
    "You write the text": proseHandler(),
  };
  const seenUrls: string[] = [];
  const fetchImpl = ((input: string | URL | Request, init?: RequestInit) => {
    seenUrls.push(String(input));
    const body = JSON.parse(String(init?.body));
    const system: string = body.systemInstruction.parts[0].text;
    const handler = Object.entries(handlers).find(([prefix]) => system.startsWith(prefix))![1];
    // rebuild the minimal call shape the fixture handlers read
    const parts = body.contents[0].parts.map((p: { text?: string }) => (p.text !== undefined ? { text: p.text } : { image: {} }));
    const value = handler({ parts, schema: body.generationConfig.responseJsonSchema } as never);
    return Promise.resolve(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] }, finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 2_000, candidatesTokenCount: 400, thoughtsTokenCount: 100 },
    })));
  }) as typeof fetch;

  const provider = new GeminiProvider({ apiKey: "test-key", fetch: fetchImpl });
  const out = await generatePuzzle(INPUT, deps(provider));
  assertEquals(checkPuzzle(out.publicDefinition, out.solution, { photoIds: ORDERED_IDS, generation: true }), []);
  assertEquals(seenUrls.length, 5);
  assert(seenUrls.every((u) => !u.includes("key=") && !u.includes("token=secret")));
  assertEquals(out.usage.provider, "gemini");
  assertEquals(out.usage.input_tokens, 10_000);
  assertEquals(out.usage.output_tokens, 2_500);   // candidates + thoughts
});

Deno.test("encodeBase64 matches btoa for binary data", () => {
  const bytes = photoBytes(3, 100_000);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  assertEquals(encodeBase64(bytes), btoa(binary));
});
