// Shared fixtures for the generation pipeline tests. Nothing here touches the
// network: providers and fetch are stubs.
import type { CostLedger } from "./cost.ts";
import type { Box1000 } from "./geometry.ts";
import type { VerifiedObject } from "./perception.ts";
import { imageCount, type JsonCall, type ModelProvider, type Stage } from "./provider.ts";
import type { Affordance } from "./schemas.ts";

/** The Study's public definition and solution, parsed out of supabase/seed.sql. */
export async function loadSeed(): Promise<{ publicDefinition: Record<string, unknown>; solution: Record<string, unknown> }> {
  const sql = await Deno.readTextFile(new URL("../../seed.sql", import.meta.url));
  const grab = (name: string) => {
    const match = sql.match(new RegExp(`${name} jsonb := \\$json\\$([\\s\\S]*?)\\$json\\$;`));
    if (!match) throw new Error(`could not find ${name} in seed.sql`);
    return JSON.parse(match[1]) as Record<string, unknown>;
  };
  return { publicDefinition: grab("v_public"), solution: grab("v_secret") };
}

export function fakeObject(
  id: string,
  label: string,
  affordance: Affordance,
  photoIndex: number,
  box: Box1000 = [200, 200, 500, 500],
): VerifiedObject {
  return { id, label, affordance, photoIndex, box, confidence: 0.9, clarity: 4 };
}

/** A varied verified-object set across three photos. */
export const FAKE_OBJECTS: VerifiedObject[] = [
  fakeObject("p0_0", "writing desk", "surface", 0, [500, 100, 900, 600]),
  fakeObject("p0_1", "desk drawer", "container_candidate", 0, [600, 150, 700, 450]),
  fakeObject("p0_2", "desk lamp", "electronic", 0, [200, 600, 500, 750]),
  fakeObject("p1_0", "bookshelf", "surface", 1, [100, 50, 800, 400]),
  fakeObject("p1_1", "woven rug", "textile", 1, [800, 200, 990, 800]),
  fakeObject("p1_2", "potted plant", "plant", 1, [300, 700, 700, 900]),
  fakeObject("p2_0", "wall clock", "wall_hanging", 2, [100, 400, 250, 550]),
  fakeObject("p2_1", "wooden box", "container_candidate", 2, [600, 300, 750, 500]),
  fakeObject("p2_2", "atlas", "readable_prop", 2, [650, 600, 800, 800]),
];

/** Seeded, deterministic stand-in for crypto randomness. */
export function seededRandomInt(seed = 42): (max: number) => number {
  let s = seed >>> 0;
  return (max: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s % max;
  };
}

// ---------------------------------------------------------------------------
// Fake provider for orchestrator tests
// ---------------------------------------------------------------------------
export type StageHandler = (call: JsonCall<unknown>) => unknown | Promise<unknown>;

export class FakeProvider implements ModelProvider {
  readonly name = "fake";
  readonly calls: JsonCall<unknown>[] = [];

  constructor(
    private readonly handlers: Partial<Record<Stage, StageHandler>>,
    private readonly tokens = { input: 1_000, output: 300 },
  ) {}

  async generateJson<T>(call: JsonCall<T>, ledger: CostLedger): Promise<T> {
    this.calls.push(call as JsonCall<unknown>);
    const handler = this.handlers[call.stage];
    if (!handler) throw new Error(`no fake handler for stage ${call.stage}`);
    const value = await handler(call as JsonCall<unknown>);   // may throw, like a failed request
    ledger.record({
      stage: call.stage, provider: this.name, model: call.model,
      inputTokens: this.tokens.input, outputTokens: this.tokens.output,
      imageCount: imageCount(call.parts), durationMs: 5,
    });
    return call.parse(value);
  }

  stages(): Stage[] {
    return this.calls.map((c) => c.stage);
  }
}

type SceneObject = [label: string, affordance: Affordance, box: Box1000];

/** Objects per photo number (1-based, as the perception prompt names them). */
export const SCENE: Record<number, SceneObject[]> = {
  1: [
    ["writing desk", "surface", [500, 100, 900, 600]],
    ["desk drawer", "container_candidate", [600, 150, 700, 450]],
    ["desk lamp", "electronic", [200, 600, 500, 750]],
  ],
  2: [
    ["bookshelf", "surface", [100, 50, 800, 400]],
    ["woven rug", "textile", [800, 200, 990, 800]],
    ["potted plant", "plant", [300, 700, 700, 900]],
    ["writing desk", "surface", [500, 500, 900, 950]],   // same desk, second angle
  ],
  3: [
    ["wall clock", "wall_hanging", [100, 400, 250, 550]],
    ["wooden box", "container_candidate", [600, 300, 750, 500]],
    ["cushion", "textile", [650, 600, 800, 800]],
  ],
};

const textOf = (call: JsonCall<unknown>) => call.parts.map((p) => ("text" in p ? p.text : "")).join("\n");

export function perceptionHandler(
  opts: { scene?: Record<number, SceneObject[]>; flagPhoto?: number; flag?: "person" | "text" } = {},
): StageHandler {
  const scene = opts.scene ?? SCENE;
  return (call) => {
    const photo = Number(textOf(call).match(/Photo (\d+) of/)?.[1] ?? 0);
    return {
      person_present: opts.flagPhoto === photo && opts.flag !== "text",
      sensitive_text: opts.flagPhoto === photo && opts.flag === "text",
      quality: "good",
      objects: (scene[photo] ?? []).map(([label, affordance, box]) => ({ label, affordance, box_2d: [...box], confidence: 0.9 })),
    };
  };
}

export function verificationHandler(opts: { verdict?: (label: string) => string } = {}): StageHandler {
  return (call) => {
    const listing = textOf(call).split("Candidates")[1] ?? "";
    const rows = listing.split("\n").filter((l) => l.startsWith("{")).map((l) => JSON.parse(l) as { id: string; label: string });
    return {
      candidates: rows.map((r) => ({ id: r.id, verdict: opts.verdict?.(r.label) ?? "visible", same_object_as: "", clarity: 4 })),
    };
  };
}

function enumOf(call: JsonCall<unknown>, list: string): string[] {
  const props = call.schema.properties?.[list]?.items?.properties;
  return props?.id?.enum ?? [];
}

/** Fictional names the crime-scene fixture writes, by option position. */
export const FIXTURE_OPTIONS = {
  suspects: [
    { name: "Ivy Marsh", role: "The housekeeper", alibi: "Says she was at the market until six." },
    { name: "Tobias Reed", role: "The old business partner", alibi: "Says he never left the club." },
    { name: "Clara Finch", role: "The goddaughter", alibi: "Says she was asleep upstairs by ten." },
  ],
  motives: [{ name: "A debt she could not pay" }, { name: "A rewritten will" }, { name: "A partnership about to end" }],
  methods: [{ name: "Poison in the evening tea" }, { name: "A loosened stair rail" }, { name: "A sleeping draught in the wine" }],
} as const;

/**
 * The accusation part of a crime-scene response: three options per list for
 * the schema's ids, and evidence sentences naming the options the brief marks
 * as true (or, with `wrongEvidence`, a wrong one, to exercise the fallback).
 */
function accusationProse(call: JsonCall<unknown>, brief: string, wrongEvidence: boolean): Record<string, unknown> {
  if (!call.schema.properties?.suspects) return {};
  const lists = ["suspects", "motives", "methods"] as const;
  const truth = {
    suspects: brief.match(/The culprit is "([a-z0-9_-]+)"/)?.[1],
    motives: brief.match(/The true motive is "([a-z0-9_-]+)"/)?.[1],
    methods: brief.match(/The true method is "([a-z0-9_-]+)"/)?.[1],
  };
  const named = (list: typeof lists[number]) => {
    const ids = enumOf(call, list);
    const right = Math.max(0, ids.indexOf(truth[list] ?? ""));
    return FIXTURE_OPTIONS[list][wrongEvidence ? (right + 1) % 3 : right].name;
  };
  return {
    ...Object.fromEntries(lists.map((list) => [list, enumOf(call, list).map((id, i) => ({ id, ...FIXTURE_OPTIONS[list][i] }))])),
    evidence: [
      { dimension: "suspect", sentence: `The stub is stamped after nine, so ${named("suspects")} was not where the alibi says.` },
      { dimension: "motive", sentence: `Underlined in the margin: ${named("motives")}.` },
      { dimension: "method", sentence: `It shows how it was done: ${named("methods")}.` },
    ],
  };
}

/** Writes plausible prose for whatever ids the schema allows; the story family comes from the schema's enum. */
export function proseHandler(
  opts: { writeLiteral?: boolean; leakCodeInHotspot?: boolean; wrongEvidence?: boolean } = {},
): StageHandler {
  return (call) => {
    const brief = textOf(call);
    const code = brief.match(/The case code is (\d{4})/)?.[1] ?? "";
    const clueIds = new Set([...brief.matchAll(/id "([a-z0-9_-]+)" \(clue_full\)/g)].map((m) => m[1]));
    // The schema allows the genre's families; a well-behaved model writes the one the brief fixes.
    const families = call.schema.properties?.story_family?.enum ?? [];
    const stated = brief.match(/Story family: ([a-z_]+)\./)?.[1] ?? "";
    const family = families.includes(stated) ? stated : families[0];
    return {
      story_family: family,
      title: "The Unfinished Map",
      intro: "Someone has been correcting the room by hand. The corrections are small, and they point somewhere.",
      exit_message: "The map is finished. The room is yours again.",
      hotspots: enumOf(call, "hotspots").map((id, i) => ({
        id,
        name: id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
        description: opts.leakCodeInHotspot && i === 0 ? `Scratched into the edge: ${code}.` : "It sits exactly where it should. Nearly.",
      })),
      items: enumOf(call, "items").map((id) => ({
        id,
        name: `Item ${id.split("_")[0]}`,
        description: clueIds.has(id) && opts.writeLiteral !== false
          ? `A margin note, in pencil: ${code}.`
          : "Small, and carefully kept.",
      })),
      puzzles: enumOf(call, "puzzles").map((id) => ({
        id,
        title: `Step ${id.replace(/_/g, " ")}`,
        prompt: "",
        message: "Something gives, quietly.",
        hints: ["Look around the room again.", "Two of the things you noticed are related.", "Act on the connection."],
      })),
      ...accusationProse(call, brief, opts.wrongEvidence === true),
    };
  };
}

export function photoBytes(seed: number, length = 2048): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = (seed * 31 + i * 7) & 0xff;
  return bytes;
}
