// Generation v2 end to end with a fake provider (no network), the author
// call's per-field fallback, and play(): load, act, hint, cooldown.
import { assert, assertEquals, assertRejects } from "jsr:@std/assert@1";
import { generatePuzzle, type GenerationInput, GenerationError, type PipelineConfig } from "../ai.ts";
import { FakeProvider, photoBytes, seededRandomInt, segmentationHandler, textOf, verificationHandler } from "../test_fixtures.ts";
import type { JsonCall } from "../provider.ts";
import { applyAuthor, type AuthorText, authorBrief, cleanText } from "./author.ts";
import { initialState } from "./engine.ts";
import { COOLDOWN_MS, play } from "./play.ts";
import { simulate } from "./simulate.ts";
import type { Mode, RoomDefinitionV2, RoomSecretV2 } from "./types.ts";

const CONFIG: PipelineConfig = {
  apiKey: "k", perceptionModel: "flash", perceptionFallbackModel: "", proseModel: "pro", proseFallbackModel: "",
  spendCapUsd: 0.9, deadlineMs: 100_000,
};

const input = (genre: Mode): GenerationInput => ({
  jobId: "00000000-0000-4000-8000-0000000000aa", roomId: "00000000-0000-4000-8000-0000000000bb", attempt: 1,
  promptVersion: "v2", outputSchemaVersion: 2, genre,
  photos: [
    { photoId: "photo-b", position: 3, mimeType: "image/jpeg", signedUrl: "https://storage.invalid/3" },
    { photoId: "photo-a", position: 0, mimeType: "image/jpeg", signedUrl: "https://storage.invalid/0" },
    { photoId: "photo-c", position: 5, mimeType: "image/jpeg", signedUrl: "https://storage.invalid/5" },
  ],
});

type Obj = [label: string, type: string, features: string[], box: [number, number, number, number]];
const SCENE: Record<number, Obj[]> = {
  1: [
    ["bedroom door", "door", ["is_door", "can_open"], [80, 40, 950, 300]],
    ["oak desk", "desk", ["has_drawers", "holds_items"], [520, 380, 900, 820]],
    ["desk lamp", "desk_lamp", ["light_source"], [300, 600, 520, 720]],
    ["wall clock", "wall_clock", ["has_hands", "wall_mounted"], [100, 650, 230, 760]],
  ],
  2: [
    ["bookshelf", "bookshelf", ["has_pages", "holds_items"], [100, 60, 850, 420]],
    ["woven rug", "rug", ["can_lift"], [820, 200, 990, 800]],
    ["framed print", "framed_picture", ["wall_mounted"], [150, 500, 380, 700]],
    ["radio", "radio", ["has_dial"], [560, 720, 680, 860]],
  ],
  3: [
    ["velvet cushion", "cushion", ["can_lift"], [500, 200, 640, 380]],
    ["wooden box", "box", ["can_open", "holds_items", "can_lift"], [600, 500, 760, 680]],
    ["notebook", "notebook", ["has_pages", "can_lift"], [700, 720, 800, 860]],
  ],
};

function perception(scene = SCENE) {
  return (call: JsonCall<unknown>) => {
    const n = Number(/Photo (\d+) of/.exec(textOf(call))?.[1] ?? 1);
    return {
      face_visible: false, sensitive_text: false, quality: "good",
      objects: (scene[n] ?? []).map(([label, type, features, box]) => ({ label, type, features, box_2d: box, confidence: 0.9 })),
    };
  };
}

/** The ids the brief lists for each part of the room (the schema no longer enumerates them). */
function ids(call: JsonCall<unknown>, list: string): string[] {
  const brief = textOf(call);
  const section = (name: string) => brief.split("\n\n").find((p) => p.startsWith(name)) ?? "";
  const all = (re: RegExp, text: string) => [...new Set([...text.matchAll(re)].map((m) => m[1]))];
  switch (list) {
    case "objects": return all(/(?:^|; )([a-z0-9_-]+) = /g, section("Objects:").replace(/^Objects: /, ""));
    case "items": return all(/(?:^|; )([a-z0-9_-]+) = /g, section("Items:").replace(/^Items: /, ""));
    case "cards": return all(/^(card_\d+) /gm, brief);
    case "steps": return all(/^(step_\d+)\b/gm, brief);
    case "beats": return all(/(rule_\d+): /g, section("Beats:"));
    case "options": return all(/(?:: |; )([a-z]_[a-z0-9]+) \(/g, section("Options to name:"));
  }
  return [];
}
const keepRefs = (s: string) => {
  const refs = [...s.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/g)].map((m) => `{{${m[1]}}}`);
  return refs.length ? `Scratched into it: ${refs.join(", then ")}.` : "Nothing more to it.";
};

/** The author: words for every id, keeping each card's and hint's placeholders (read from the brief). */
function author(call: JsonCall<unknown>) {
  const brief = textOf(call);
  const cardText = new Map([...brief.matchAll(/^(card_\d+) "[^"]*": (".*")$/gm)].map((m) => [m[1], JSON.parse(m[2]) as string]));
  const hints = new Map([...brief.matchAll(/^(step_\d+)\b.*Hints now: (.*)$/gm)].map((m) => [m[1], JSON.parse(`[${m[2].replaceAll(" / ", ",")}]`) as string[]]));
  const names = ["Ada Finch", "Bram Hollis", "Cora Vane", "Greed", "Jealousy", "Revenge", "Sleeping draught", "Loose rail", "Cold tea"];
  return {
    title: "The Second Ledger", objective: "Find what Leo hid and leave by the door.", intro: "The room is as you left it. Almost.",
    ending: "The door gives, and the night air comes in.",
    objects: ids(call, "objects").map((id) => ({ id, name: "Something old" })),
    items: ids(call, "items").map((id) => ({ id, name: "Brass thing" })),
    cards: ids(call, "cards").map((id) => ({ id, title: "A find", text: keepRefs(cardText.get(id) ?? "") })),
    steps: ids(call, "steps").map((id) => ({ id, title: "A step", hints: (hints.get(id) ?? ["", "", ""]).map(keepRefs) })),
    beats: ids(call, "beats").map((id) => ({ id, text: "Something in the room shifts." })),
    options: ids(call, "options").map((id, i) => ({ id, name: names[i % names.length] })),
  };
}

const provider = (scene = SCENE) =>
  new FakeProvider({ perception: perception(scene), verification: verificationHandler(), prose: author, segmentation: segmentationHandler() });
const deps = (p: FakeProvider) => ({
  config: CONFIG, provider: p, fetchPhoto: (ph: { position: number }) => Promise.resolve(photoBytes(ph.position)),
  preview: () => Promise.resolve([]), random: () => 0.37, randomInt: seededRandomInt(11), log: () => {},
});

for (const mode of ["noir", "crime_scene", "paranormal"] as const) {
  Deno.test(`generation v2 (${mode}): a solvable room, the author's words, photos in position order, one model call per stage`, async () => {
    const p = provider();
    const out = await generatePuzzle(input(mode), deps(p));
    const def = out.publicDefinition as unknown as RoomDefinitionV2;
    const secret = out.solution as unknown as RoomSecretV2;
    assertEquals(def.schema_version, 2);
    assertEquals(def.mode, mode);
    assertEquals(def.photos, [{ photo_id: "photo-a" }, { photo_id: "photo-b" }, { photo_id: "photo-c" }]);
    assertEquals(def.title, "The Second Ledger");
    assertEquals(def.objects.filter((o) => o.exit).map((o) => o.type), ["door"]);
    assert(simulate(def, secret).ok, simulate(def, secret).errors.join("; "));
    // Three perception calls, one verification, one author call; one segmentation call per photo with objects.
    const photosWithObjects = new Set(def.objects.map((o) => o.photo_index)).size;
    assertEquals(p.stages().filter((s) => s !== "segmentation").sort(), ["perception", "perception", "perception", "prose", "verification"]);
    assertEquals(p.stages().filter((s) => s === "segmentation").length, photosWithObjects);
    // Every object has its outline (the fake's masks are ellipses filling each box), inside its box.
    for (const o of def.objects) {
      assert(o.outline && o.outline.length >= 8 && o.outline.length <= 64, `${o.id} has an outline`);
      const b = o.box, slack = 0.002;
      assert(o.outline.every((q) => q.x >= b.x - slack && q.x <= b.x + b.w + slack && q.y >= b.y - slack && q.y <= b.y + b.h + slack), `${o.id}'s outline is in its box`);
    }
    // No answer is written into the public room.
    const json = JSON.stringify(def).toLowerCase();
    for (const s of Object.values(secret.slots)) {
      if (s.kind !== "option" && s.kind !== "object" && s.value.length >= 3) assert(!json.includes(s.value.toLowerCase()), s.value);
    }
    if (mode === "crime_scene") {
      assert(def.finale.kind === "accusation" && def.finale.suspects.every((o) => !/^Suspect /.test(o.name)));
    }
  });
}

Deno.test("generation v2: a room with no way out asks for a photo of the door", async () => {
  const noDoor = { ...SCENE, 1: SCENE[1].slice(1) };
  const err = await assertRejects(() => generatePuzzle(input("noir"), deps(provider(noDoor))), GenerationError);
  assertEquals(err.code, "too_few_objects");
  assert(/door/i.test(err.message));
});

Deno.test("generation v2: a visible face stops it before anything is planned", async () => {
  const faces = new FakeProvider({
    perception: (call) => ({ ...(perception()(call) as object), face_visible: true }),
    verification: verificationHandler(), prose: author,
  });
  const err = await assertRejects(() => generatePuzzle(input("noir"), deps(faces)), GenerationError);
  assertEquals(err.code, "person_or_sensitive");
  assert(!faces.stages().includes("prose"));
});

Deno.test("generation v2: failed segmentation costs only the outlines", async () => {
  const p = new FakeProvider({
    perception: perception(), verification: verificationHandler(), prose: author,
    segmentation: () => { throw new Error("HTTP 500"); },
  });
  const out = await generatePuzzle(input("noir"), deps(p));
  const def = out.publicDefinition as unknown as RoomDefinitionV2;
  assert(def.objects.length > 0 && def.objects.every((o) => o.outline === undefined));
  assert(simulate(def, out.solution as unknown as RoomSecretV2).ok);
});

// ---------------------------------------------------------------------------
// The author's words
// ---------------------------------------------------------------------------
/** A planned room (no author call): the inventory perception v2 would give for SCENE. */
async function planned(mode: Mode = "noir") {
  const { planRoom } = await import("./planner.ts");
  const { TYPICAL_FEATURES } = await import("./taxonomy.ts");
  const inv = Object.entries(SCENE).flatMap(([n, objs]) => objs.map(([label, type, features, box], i) => ({
    id: `p${Number(n) - 1}_${i}`, label, type: type as never, features: [...features, ...(TYPICAL_FEATURES[type as never] ?? [])] as never[],
    box, photo_index: Number(n) - 1, salience: 0.7, fully_visible: true,
  })));
  const plan = planRoom(inv, { mode, seed: "room-x", randomInt: seededRandomInt(3) });
  if (!plan.ok) throw new Error(plan.detail);
  return plan;
}

const emptyText = (): AuthorText => ({
  objects: new Map(), items: new Map(), cards: new Map(), steps: new Map(), beats: new Map(), options: new Map(),
});

Deno.test("author: the brief names placeholders by kind, never their values", async () => {
  const { definition, secret } = await planned();
  const brief = authorBrief(definition, secret);
  for (const s of Object.values(secret.slots)) if (s.value.length >= 3 && s.kind !== "object") assert(!brief.includes(s.value), s.value);
  assert(brief.includes("{{"));
});

Deno.test("author: the crime-scene brief names each option's question and current name, and the ruled-out ones by kind", async () => {
  const { definition, secret } = await planned("crime_scene");
  assert(definition.finale.kind === "accusation");
  const brief = authorBrief(definition, secret);
  for (const o of definition.finale.suspects) assert(brief.includes(`${o.id} (suspect, now ${JSON.stringify(o.name)})`), brief);
  for (const o of definition.finale.methods) assert(brief.includes(`${o.id} (method, now ${JSON.stringify(o.name)})`), brief);
  assert(brief.includes("this card's evidence rules out"));
  // The true answers are derived: the brief never lists them as placeholders.
  for (const [name, s] of Object.entries(secret.slots)) if (s.kind === "option" && s.from) assert(!brief.includes(`{{${name}}}:`), name);
});

Deno.test("author: a card or hint that drops, adds or repeats a placeholder, or writes a digit, keeps the planner's words", async () => {
  const { definition, secret } = await planned();
  const card = definition.cards.find((c) => c.text.includes("{{"))!;
  const ref = /\{\{\s*([a-z0-9_]+)\s*\}\}/.exec(card.text)![0];
  const text = emptyText();
  text.title = "Room 12";                                    // digit: rejected
  text.objective = "Get out through the door.";               // fine
  text.cards.set(card.id, { title: "Ticket", text: `${ref} and ${ref}` });   // repeated: rejected
  const out = applyAuthor(definition, secret, text);
  assertEquals(out.definition.title, definition.title);
  assertEquals(out.definition.objective, "Get out through the door.");
  assertEquals(out.definition.cards.find((c) => c.id === card.id)!.text, card.text);
  assertEquals(out.definition.cards.find((c) => c.id === card.id)!.title, "Ticket");
  assertEquals(cleanText("At {{s1}} sharp.", 40), "At {{s1}} sharp.");
  assertEquals(cleanText("At 11:40 sharp.", 40), null);
});

Deno.test("author: renamed accusation options rename their slots, so cards name them as the door does", async () => {
  const { definition, secret } = await planned("crime_scene");
  assert(definition.finale.kind === "accusation");
  const text = emptyText();
  const all = [...definition.finale.suspects, ...definition.finale.motives, ...definition.finale.methods];
  const names = ["Ada Finch", "Bram Hollis", "Cora Vane", "Greed", "Jealousy", "Revenge", "Draught", "Rail", "Tea"];
  all.forEach((o, i) => text.options.set(o.id, names[i]));
  const out = applyAuthor(definition, secret, text);
  assert(out.definition.finale.kind === "accusation");
  const byId = new Map([...out.definition.finale.suspects, ...out.definition.finale.motives, ...out.definition.finale.methods].map((o) => [o.id, o.name]));
  for (const s of Object.values(out.secret.slots).filter((s) => s.kind === "option")) assertEquals(s.text, byId.get(s.value));
  // A list whose names collide keeps its placeholders.
  text.options.set(definition.finale.suspects[1].id, "Ada Finch");
  const clash = applyAuthor(definition, secret, text);
  assert(clash.definition.finale.kind === "accusation");
  assertEquals(clash.definition.finale.suspects.map((o) => o.name), definition.finale.suspects.map((o) => o.name));
});

// ---------------------------------------------------------------------------
// play()
// ---------------------------------------------------------------------------
Deno.test("play: from v1's empty state to the end, with hints, a wrong answer's cooldown and a rendered casebook", async () => {
  const { definition, secret } = await planned();
  const v1Empty = { solved: [], inventory: [], revealed_hotspots: [] };
  const load = play(definition, secret, v1Empty, {}, 0, null);
  assertEquals(load.save, null);
  assertEquals(load.response.state, initialState(definition));
  assert(load.response.can_hint);

  // A hint: rung 1 of the first open step, saved, then shown in the list.
  const h = play(definition, secret, v1Empty, { hint: true }, 0, null);
  assertEquals(h.response.hint?.rung, 1);
  assertEquals(h.save?.hints, 1);
  assertEquals(h.response.hints, [h.response.hint!.text]);

  // A wrong code at the door: the cooldown starts, and a second try is refused while it runs.
  const exit = definition.objects.find((o) => o.exit)!;
  const n = definition.finale.kind === "combination" ? definition.finale.wheels : 3;
  const wrong = play(definition, secret, h.save!.state, { action: { type: "submit", object: exit.id, value: Array(n).fill("0") } }, 1000, null);
  if (wrong.response.result?.outcome === "wrong") {
    assertEquals(wrong.save?.lockedUntil, 1000 + COOLDOWN_MS);
    assertEquals(wrong.save?.wrong, 1);
    const again = play(definition, secret, wrong.save!.state, { action: { type: "submit", object: exit.id, value: Array(n).fill("0") } }, 2000, wrong.save!.lockedUntil);
    assertEquals(again.response.result?.reason, "cooldown");
  }

  // The simulator's winning path, through play(), to the end.
  let stored: unknown = h.save!.state;
  let last = load.response;
  for (const action of simulate(definition, secret).path) {
    const r = play(definition, secret, stored, { action }, 100_000, null);
    if (r.save) stored = r.save.state;
    last = r.response;
  }
  assert(last.completed);
  assertEquals(last.ending, secret.ending);
  assert(!last.can_hint);
  assert(last.cards.length > 0 && last.cards.every((c) => !c.text.includes("{{")));
});

Deno.test("perception v2: the schema enumerates no types (Gemini refuses it); the parser maps free text onto the taxonomy", async () => {
  const { PERCEPTION_V2_SCHEMA, parsePerceptionV2 } = await import("./perceive.ts");
  assert(!JSON.stringify(PERCEPTION_V2_SCHEMA).includes("wall_clock"));
  const parsed = parsePerceptionV2({
    face_visible: false, sensitive_text: false, quality: "good",
    objects: [
      { label: "round clock", type: "Wall clock", features: ["Has hands", "wall-mounted", "glows"], box_2d: [1, 2, 3, 4], confidence: 0.8 },
      { label: "old couch", type: "settee thing", features: [], box_2d: [1, 2, 3, 4], confidence: 0.8 },
      { label: "mystery", type: "", features: [], box_2d: [1, 2, 3, 4], confidence: 0.8 },
    ],
  });
  assertEquals(parsed.objects.map((o) => o.type), ["wall_clock", "sofa", "other"]);
  assertEquals(parsed.objects[0].features, ["has_hands", "wall_mounted"]);
});
