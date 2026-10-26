// TypeScript preflight for schema v1 (stage 10). Mirrors
// private.validate_puzzle_definition (supabase/migrations/20261023000200_rooms_and_puzzles.sql)
// so a repair can see id/rect/graph mistakes without a database round trip,
// plus the clue-coverage clause of the extended SQL validator and the
// photo check in worker_complete_generation_job. Error texts match the SQL
// wording where a rule exists there.
//
// SQL is the final authority: worker_complete_generation_job re-validates and
// is the only publisher. Where the SQL silently accepts a malformed value
// (missing photo_index or rect coordinates evaluate to NULL there), this check
// is deliberately stricter.
//
// Genres (20261026000100_genres_and_accuse.sql): an optional top-level genre,
// an optional hotspot effect, and the accuse kind, whose secret answer must be
// deducible from the evidence items the player holds when it becomes attemptable.
//
// Normalization follows private.normalize_answer, whose lower() and \s depend
// on the database locale. JS \s and toLowerCase() agree with the usual UTF-8
// and Windows locales on most Unicode spaces (such as U+3000); glibc keeps
// the no-break spaces (U+00A0, U+2007, U+202F), and a C locale strips ASCII
// whitespace only and lowercases ASCII letters only. Generated text stays
// clear of the spaces (prose.ts turns every JS \s into a plain space), and the
// preview RPC runs the SQL validator itself before anything is published.
import { ACCUSE_DIMENSIONS, type Dimension, GENRES, HOTSPOT_EFFECTS } from "./contract.ts";
import { decimalSumGreaterThan } from "./geometry.ts";

export const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const KINDS = new Set(["inspect", "code", "use_item", "combine", "accuse"]);
const FORBIDDEN_PUBLIC_KEYS = new Set(["answer", "rewards", "inputs", "solution", "hints", "evidence"]);
const EFFECTS = new Set<unknown>(HOTSPOT_EFFECTS);
/** Public option list of an accuse puzzle per dimension. */
export const OPTION_LISTS: Record<Dimension, string> = { suspect: "suspects", motive: "motives", method: "methods" };
export const OPTION_COUNT = 3;
export const MAX_OPTION_NAME = 60;
export const MAX_SUSPECT_ROLE = 60;
export const MAX_SUSPECT_ALIBI = 200;
export const MAX_PUBLIC_BYTES = 262_144;
export const MAX_SECRET_BYTES = 131_072;
export const HINT_COUNT = 3;
export const MAX_HINT_CHARS = 400;

export interface CheckOptions {
  /** This room's room_photos ids (worker_complete_generation_job rule). */
  photoIds?: readonly string[];
  /** Generator contract: photos echo photoIds in order, 3 hints per puzzle, no code in public text outside items. */
  generation?: boolean;
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: Json, k: string): unknown => (Object.hasOwn(o, k) ? o[k] : undefined);

/** Text form of a jsonb value (Postgres jsonb output: ", " and ": " separators). */
export function jsonbText(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (Array.isArray(v)) return "[" + v.map(jsonbText).join(", ") + "]";
  if (isObject(v)) return "{" + Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${jsonbText(x)}`).join(", ") + "}";
  return JSON.stringify(v);
}

/** Postgres `obj ->> key`: null for non-objects, missing keys and JSON null. */
function text(obj: unknown, key: string): string | null {
  if (!isObject(obj)) return null;
  const v = own(obj, key);
  if (v === undefined || v === null) return null;
  return typeof v === "string" ? v : jsonbText(v);
}

const bytes = (s: string) => new TextEncoder().encode(s).length;
/** char_length: code points, not UTF-16 units. */
const chars = (s: string) => [...s].length;

/** private.normalize_answer: lower(), then strip runs of whitespace (\s) and - _ . , : ; ' " */
export function normalizeAnswer(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[\s\-_.,:;'"]+/g, "");
}

/** Within one dimension, every normalized name is non-empty, and none equals or contains another. */
export function namesDistinct(names: readonly string[]): boolean {
  const normalized = names.map(normalizeAnswer);
  return normalized.every((a, i) => a !== "" && normalized.every((b, j) => i === j || !b.includes(a)));
}

/**
 * Deducibility of one dimension: the evidence text names the right option and
 * none of the others (normalized substring match, as in SQL).
 */
export function provesOption(description: string, rightName: string, wrongNames: readonly string[]): boolean {
  const text = normalizeAnswer(description);
  const right = normalizeAnswer(rightName);
  return right !== "" && text.includes(right) && wrongNames.every((w) => !text.includes(normalizeAnswer(w)));
}

/** Whether the text names any of these options (normalized substring). */
export function namesAny(text: string, names: readonly string[]): boolean {
  const t = normalizeAnswer(text);
  return names.some((n) => normalizeAnswer(n) !== "" && t.includes(normalizeAnswer(n)));
}

/** One dimension of an accusation as public text sees it: the right option's name and all three names. */
export interface AnswerList {
  right: string;
  names: readonly string[];
}

/**
 * Generator rule for public text outside the evidence: it gives the accusation
 * away when it names a dimension's right option without naming all three of
 * that dimension (a list of all three singles nobody out). Normalized
 * substring, as for codes, so it errs toward calling a text a leak.
 */
export function revealsAnswer(text: string, lists: readonly AnswerList[]): boolean {
  const t = normalizeAnswer(text);
  return lists.some(({ right, names }) =>
    normalizeAnswer(right) !== "" && t.includes(normalizeAnswer(right)) && !names.every((n) => t.includes(normalizeAnswer(n)))
  );
}

function hasForbiddenKey(v: unknown): boolean {
  if (Array.isArray(v)) return v.some(hasForbiddenKey);
  if (!isObject(v)) return false;
  return Object.entries(v).some(([k, x]) => FORBIDDEN_PUBLIC_KEYS.has(k) || hasForbiddenKey(x));
}

/** jsonb_array_elements_text over an optional array; non-arrays are reported (SQL would raise). */
function textArray(v: unknown, label: string, errors: string[]): string[] {
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v)) {
    errors.push(`${label} must be an array`);
    return [];
  }
  return v.map((x) => (typeof x === "string" ? x : jsonbText(x)));
}

/** Returns human-readable errors; an empty array means valid. */
export function checkPuzzle(pub: unknown, secret: unknown, opts: CheckOptions = {}): string[] {
  if (!isObject(pub)) return ["public definition must be a JSON object"];
  if (!isObject(secret)) return ["solution must be a JSON object"];
  const errors = checkStructureAndSolvability(pub, secret);
  return errors.concat(checkPhotoIds(pub, opts), opts.generation ? checkGenerationContract(pub, secret) : []);
}

function checkStructureAndSolvability(pub: Json, secret: Json): string[] {
  const errors: string[] = [];
  if (own(pub, "schema_version") !== 1) errors.push("public.schema_version must be 1");
  if (own(secret, "schema_version") !== 1) errors.push("solution.schema_version must be 1");
  if (bytes(jsonbText(pub)) > MAX_PUBLIC_BYTES) errors.push("public definition exceeds 256 KB");
  if (bytes(jsonbText(secret)) > MAX_SECRET_BYTES) errors.push("solution exceeds 128 KB");
  if (hasForbiddenKey(pub)) {
    // SQL keeps this text as it was when `evidence` joined the list.
    errors.push("public definition contains solution-only keys (answer/rewards/inputs/solution/hints)");
  }
  if (Object.hasOwn(pub, "genre") && !(GENRES as readonly unknown[]).includes(own(pub, "genre"))) {
    errors.push("public.genre must be one of noir, crime_scene, paranormal");
  }

  const photos = own(pub, "photos");
  let photoCount = 0;
  if (!Array.isArray(photos) || photos.length === 0) errors.push("photos must be a non-empty array");
  else photoCount = photos.length;
  const itemsRaw = own(pub, "items");
  const hotspotsRaw = own(pub, "hotspots");
  const puzzlesRaw = own(pub, "puzzles");
  const secretPuzzles = own(secret, "puzzles");
  if (!Array.isArray(itemsRaw)) errors.push("items must be an array");
  if (!Array.isArray(hotspotsRaw)) errors.push("hotspots must be an array");
  if (!Array.isArray(puzzlesRaw) || puzzlesRaw.length === 0) errors.push("puzzles must be a non-empty array");
  if (!isObject(secretPuzzles)) errors.push("solution.puzzles must be an object keyed by puzzle id");
  if (errors.length) return errors;

  const items = itemsRaw as unknown[];
  const hotspots = hotspotsRaw as unknown[];
  const puzzles = puzzlesRaw as unknown[];
  const solutions = secretPuzzles as Json;

  if (hotspots.length > 100) errors.push("too many hotspots (max 100)");
  if (items.length > 100) errors.push("too many items (max 100)");
  if (puzzles.length > 60) errors.push("too many puzzles (max 60)");

  // Items
  const itemIds: string[] = [];
  for (const it of items) {
    const id = text(it, "id");
    if (!ID_RE.test(id ?? "")) errors.push(`invalid item id: ${id ?? "<missing>"}`);
    else if (itemIds.includes(id!)) errors.push(`duplicate item id: ${id}`);
    else itemIds.push(id!);
    if ((text(it, "name") ?? "") === "") errors.push(`item ${id ?? "?"} needs a name`);
  }

  // Hotspots
  const hotspotIds: string[] = [];
  for (const h of hotspots) {
    const id = text(h, "id");
    if (!ID_RE.test(id ?? "")) {
      errors.push(`invalid hotspot id: ${id ?? "<missing>"}`);
      continue;
    }
    if (hotspotIds.includes(id!)) {
      errors.push(`duplicate hotspot id: ${id}`);
      continue;
    }
    hotspotIds.push(id!);
    const hs = h as Json;
    const index = own(hs, "photo_index");
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0 || index > photoCount - 1) {
      errors.push(`hotspot ${id} has an invalid photo_index`);
    }
    if ((text(hs, "object_label") ?? "") === "") errors.push(`hotspot ${id} needs an object_label`);
    if (Object.hasOwn(hs, "hidden") && typeof own(hs, "hidden") !== "boolean") {
      errors.push(`hotspot ${id}: hidden must be boolean`);
    }
    if (Object.hasOwn(hs, "effect") && !EFFECTS.has(own(hs, "effect"))) {
      errors.push(`hotspot ${id} has an unknown effect`);
    }
    const shape = own(hs, "shape");
    const num = (k: string) => (isObject(shape) ? own(shape, k) : undefined);
    const coords = ["x", "y", "w", "h"].map(num);
    if (!isObject(shape) || own(shape, "type") !== "rect" ||
        !coords.every((c) => typeof c === "number" && Number.isFinite(c))) {
      errors.push(`hotspot ${id} needs a rect shape with numeric x/y/w/h`);
    } else {
      const [x, y, w, hh] = coords as number[];
      if (x < 0 || y < 0 || w <= 0 || hh <= 0 || decimalSumGreaterThan(x, w) || decimalSumGreaterThan(y, hh)) {
        errors.push(`hotspot ${id} shape must be normalized within [0,1]`);
      }
    }
  }

  // Puzzle ids first (requires may reference later puzzles)
  const puzzleIds: string[] = [];
  for (const p of puzzles) {
    const id = text(p, "id");
    if (!ID_RE.test(id ?? "")) errors.push(`invalid puzzle id: ${id ?? "<missing>"}`);
    else if (puzzleIds.includes(id!)) errors.push(`duplicate puzzle id: ${id}`);
    else puzzleIds.push(id!);
  }

  // Puzzle bodies + matching solutions
  const definitionIds = new Set([...itemIds, ...hotspotIds, ...puzzleIds]);   // accuse option ids join these
  for (const p of puzzles) {
    const pid = text(p, "id");
    if (pid === null || !ID_RE.test(pid)) continue;
    const pz = p as Json;
    const kind = text(pz, "kind");
    if (kind === null || !KINDS.has(kind)) {
      errors.push(`puzzle ${pid} has invalid kind`);
      continue;
    }
    if (kind !== "combine" && kind !== "accuse") {
      const hid = text(pz, "hotspot_id");
      if (hid === null || !hotspotIds.includes(hid)) {
        errors.push(`puzzle ${pid} references unknown hotspot ${hid ?? "<missing>"}`);
      }
    }
    if (Object.hasOwn(pz, "requires")) {
      const req = own(pz, "requires");
      if (!Array.isArray(req)) errors.push(`puzzle ${pid}: requires must be an array`);
      else {
        for (const r of req.map((x) => (typeof x === "string" ? x : jsonbText(x)))) {
          if (!puzzleIds.includes(r)) errors.push(`puzzle ${pid} requires unknown puzzle ${r}`);
          else if (r === pid) errors.push(`puzzle ${pid} requires itself`);
        }
      }
    }
    if (kind === "accuse") errors.push(...checkAccuseOptions(pid, pz, definitionIds));

    const s = own(solutions, pid);
    if (!isObject(s)) {
      errors.push(`puzzle ${pid} has no solution entry`);
      continue;
    }
    if (kind === "code") {
      // btrim() trims spaces only; an answer that normalizes to "" (e.g. "--") can never be typed meaningfully.
      const answer = text(s, "answer") ?? "";
      if (answer.replace(/^ +| +$/g, "") === "" || normalizeAnswer(answer) === "") {
        errors.push(`code puzzle ${pid} needs a non-empty answer`);
      }
    } else if (kind === "use_item") {
      const item = text(s, "item_id");
      if (item === null || !itemIds.includes(item)) errors.push(`use_item puzzle ${pid} references unknown item`);
    } else if (kind === "combine") {
      const inputs = own(s, "inputs");
      if (!Array.isArray(inputs) || inputs.length !== 2) errors.push(`combine puzzle ${pid} needs exactly 2 inputs`);
      else {
        for (const r of textArray(inputs, `combine puzzle ${pid} inputs`, errors)) {
          if (!itemIds.includes(r)) errors.push(`combine puzzle ${pid} uses unknown item ${r}`);
        }
      }
    } else if (kind === "accuse") {
      errors.push(...checkAccuseSolution(pid, pz, s, itemIds));
    }
    if (Object.hasOwn(s, "rewards")) {
      const rw = own(s, "rewards");
      const field = (k: string) => (isObject(rw) ? own(rw, k) : undefined);
      for (const r of textArray(field("items"), `puzzle ${pid} rewards.items`, errors)) {
        if (!itemIds.includes(r)) errors.push(`puzzle ${pid} rewards unknown item ${r}`);
      }
      for (const r of textArray(field("consume_items"), `puzzle ${pid} rewards.consume_items`, errors)) {
        if (!itemIds.includes(r)) errors.push(`puzzle ${pid} consumes unknown item ${r}`);
      }
      for (const r of textArray(field("reveal_hotspots"), `puzzle ${pid} rewards.reveal_hotspots`, errors)) {
        if (!hotspotIds.includes(r)) errors.push(`puzzle ${pid} reveals unknown hotspot ${r}`);
      }
    }
  }

  for (const key of Object.keys(solutions)) {
    if (!puzzleIds.includes(key)) errors.push(`solution has entry for unknown puzzle ${key}`);
  }

  const exit = own(pub, "exit");
  const exitRequires = isObject(exit) ? own(exit, "requires") : undefined;
  if (!Array.isArray(exitRequires) || exitRequires.length === 0) errors.push("exit.requires must be a non-empty array");
  else {
    for (const r of exitRequires.map((x) => (typeof x === "string" ? x : jsonbText(x)))) {
      if (!puzzleIds.includes(r)) errors.push(`exit requires unknown puzzle ${r}`);
    }
  }
  if (errors.length) return errors;

  return simulate(pub, solutions, items as Json[], hotspots as Json[], puzzles as Json[], exitRequires as string[]);
}

/** A JSON string that is not blank (btrim trims spaces) and at most `max` characters. */
const boundedText = (v: unknown, max: number) => typeof v === "string" && v.replace(/^ +| +$/g, "") !== "" && chars(v) <= max;

/**
 * Public shape of an accuse puzzle: three options per dimension, ids unique
 * across the whole definition (`taken` gains them), bounded texts, and names
 * that are distinct and never contain one another (deducibility reads them as
 * substrings of the evidence).
 */
function checkAccuseOptions(pid: string, pz: Json, taken: Set<string>): string[] {
  const errors: string[] = [];
  for (const d of ACCUSE_DIMENSIONS) {
    const options = own(pz, OPTION_LISTS[d]);
    if (!Array.isArray(options) || options.length !== OPTION_COUNT) {
      errors.push(`accuse puzzle ${pid} needs exactly ${OPTION_COUNT} ${OPTION_LISTS[d]}`);
      continue;
    }
    for (const o of options) {
      const id = text(o, "id");
      if (!ID_RE.test(id ?? "")) errors.push(`accuse puzzle ${pid} has an invalid option id: ${id ?? "<missing>"}`);
      else if (taken.has(id!)) errors.push(`duplicate option id: ${id}`);
      else taken.add(id!);
      const field = (k: string) => (isObject(o) ? own(o, k) : undefined);
      if (!boundedText(field("name"), MAX_OPTION_NAME)) {
        errors.push(`accuse puzzle ${pid}: ${d} ${id ?? "?"} needs a name of 1-${MAX_OPTION_NAME} characters`);
      }
      if (d === "suspect" && !boundedText(field("role"), MAX_SUSPECT_ROLE)) {
        errors.push(`accuse puzzle ${pid}: suspect ${id ?? "?"} needs a role of 1-${MAX_SUSPECT_ROLE} characters`);
      }
      if (d === "suspect" && !boundedText(field("alibi"), MAX_SUSPECT_ALIBI)) {
        errors.push(`accuse puzzle ${pid}: suspect ${id ?? "?"} needs an alibi of 1-${MAX_SUSPECT_ALIBI} characters`);
      }
    }
    if (!namesDistinct(options.map((o) => text(o, "name") ?? ""))) {
      errors.push(`accuse puzzle ${pid}: ${d} names must be distinct and none may contain another`);
    }
  }
  return errors;
}

/** Secret side of an accuse puzzle: the answer picks a public option per dimension; each dimension's evidence is an item. */
function checkAccuseSolution(pid: string, pz: Json, s: Json, itemIds: string[]): string[] {
  const errors: string[] = [];
  for (const d of ACCUSE_DIMENSIONS) {
    const options = own(pz, OPTION_LISTS[d]);
    const answer = text(own(s, "answer"), d);
    if (!(Array.isArray(options) ? options : []).some((o) => answer !== null && text(o, "id") === answer)) {
      errors.push(`accuse puzzle ${pid}: answer.${d} must be one of its ${OPTION_LISTS[d]}`);
    }
    if (!itemIds.includes(text(own(s, "evidence"), d) ?? "")) errors.push(`accuse puzzle ${pid}: evidence.${d} references unknown item`);
  }
  return errors;
}

/** Deducibility at this point of the simulation: every dimension proved by an evidence item already held. */
function accusationDeducible(p: Json, s: Json, inventory: ReadonlySet<string>, itemDescription: ReadonlyMap<string, string>): boolean {
  const answer = own(s, "answer");
  const evidence = own(s, "evidence");
  return ACCUSE_DIMENSIONS.every((d) => {
    const item = text(evidence, d) ?? "";
    if (!inventory.has(item)) return false;
    const options = own(p, OPTION_LISTS[d]) as unknown[];
    const right = text(answer, d);
    const name = (o: unknown) => text(o, "name") ?? "";
    const correct = options.find((o) => text(o, "id") === right);
    return correct !== undefined &&
      provesOption(itemDescription.get(item) ?? "", name(correct), options.filter((o) => o !== correct).map(name));
  });
}

/**
 * Greedy solvability simulation, as in SQL, plus clue coverage as a solve
 * condition: a code puzzle counts as solvable only once its normalized answer
 * is a substring of ONE normalized description among the items in the
 * simulated inventory and the currently revealed hotspots. (The SQL joins the
 * descriptions with "|", which survives normalization, so digits never stitch
 * across two descriptions.) A code that never becomes clued is reported.
 * Deducibility works the same way for an accusation: attemptable once its
 * requires are solved, solvable only once each dimension's evidence item is
 * held and names the right option and neither of the others.
 */
function simulate(
  _pub: Json,
  solutions: Json,
  items: Json[],
  hotspots: Json[],
  puzzles: Json[],
  exitRequires: string[],
): string[] {
  const errors: string[] = [];
  const itemDescription = new Map(items.map((it) => [text(it, "id")!, text(it, "description") ?? ""]));
  const hotspotDescription = new Map(hotspots.map((h) => [text(h, "id")!, text(h, "description") ?? ""]));
  const solved = new Set<string>();
  let inventory = new Set<string>();
  const revealed: string[] = hotspots
    .filter((h) => !(own(h, "hidden") === true))
    .map((h) => text(h, "id")!);
  const unclued = new Set<string>();
  const undeducible = new Set<string>();
  const list = (s: Json, k: string) => {
    const rw = own(s, "rewards");
    const v = isObject(rw) ? own(rw, k) : undefined;
    return Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : jsonbText(x))) : [];
  };

  for (let progress = true; progress;) {
    progress = false;
    for (const p of puzzles) {
      const pid = text(p, "id")!;
      if (solved.has(pid)) continue;
      const kind = text(p, "kind");
      const s = own(solutions, pid) as Json;
      const requires = Array.isArray(own(p, "requires")) ? (own(p, "requires") as unknown[]).map(String) : [];
      let canSolve = requires.every((r) => solved.has(r));
      if (canSolve && kind !== "combine" && kind !== "accuse") canSolve = revealed.includes(text(p, "hotspot_id") ?? "");
      if (canSolve && kind === "use_item") canSolve = inventory.has(text(s, "item_id") ?? "");
      if (canSolve && kind === "combine") {
        canSolve = (own(s, "inputs") as unknown[]).every((i) => inventory.has(String(i)));
      }
      if (canSolve && kind === "code") {
        const answer = normalizeAnswer(text(s, "answer"));
        const readable = [
          ...[...inventory].map((id) => itemDescription.get(id) ?? ""),
          ...revealed.map((id) => hotspotDescription.get(id) ?? ""),
        ];
        if (!answer || !readable.some((d) => normalizeAnswer(d).includes(answer))) {
          unclued.add(pid);
          canSolve = false;
        }
      }
      if (canSolve && kind === "accuse" && !accusationDeducible(p, s, inventory, itemDescription)) {
        undeducible.add(pid);
        canSolve = false;
      }
      if (canSolve) {
        solved.add(pid);
        const consume = new Set(list(s, "consume_items"));
        inventory = new Set([...inventory, ...list(s, "items")].filter((x) => !consume.has(x)));
        revealed.push(...list(s, "reveal_hotspots"));
        progress = true;
      }
    }
  }

  for (const r of exitRequires) {
    if (!solved.has(r)) {
      errors.push(`exit puzzle ${r} is not reachable (cycle, missing item, or hidden hotspot never revealed)`);
    }
  }
  for (const p of puzzles) {
    const pid = text(p, "id")!;
    if (solved.has(pid)) continue;
    if (unclued.has(pid)) {
      errors.push(`puzzle ${pid}: code answer is not written anywhere the player can read before solving it`);
    }
    if (undeducible.has(pid)) errors.push(`accusation ${pid} cannot be worked out from the clues`);
    errors.push(`puzzle ${pid} can never be solved`);
  }
  return errors;
}

/** worker_complete_generation_job: photos[].photo_id must reference this room's photos. */
function checkPhotoIds(pub: Json, opts: CheckOptions): string[] {
  if (!opts.photoIds) return [];
  const photos = own(pub, "photos");
  if (!Array.isArray(photos)) return [];
  const errors: string[] = [];
  if (photos.some((ph) => !opts.photoIds!.includes(text(ph, "photo_id") ?? ""))) {
    errors.push("photos[].photo_id must reference this room's uploaded photos");
  }
  if (opts.generation) {
    const echoed = photos.map((ph) => text(ph, "photo_id"));
    if (echoed.length !== opts.photoIds.length || echoed.some((id, i) => id !== opts.photoIds![i])) {
      errors.push("photos must echo the input photo ids in position order");
    }
  }
  return errors;
}

/**
 * Generator-only rules: hint ladder shape, no code answer in public text
 * outside item descriptions, and an accusation's answer read off its evidence
 * items only (accusationContract).
 */
function checkGenerationContract(pub: Json, secret: Json): string[] {
  const errors: string[] = [];
  const solutions = own(secret, "puzzles");
  if (!isObject(solutions)) return errors;
  for (const [pid, s] of Object.entries(solutions)) {
    const hints = isObject(s) ? own(s, "hints") : undefined;
    if (!Array.isArray(hints) || hints.length !== HINT_COUNT ||
        !hints.every((h) => typeof h === "string" && h.trim() !== "" && h.length <= MAX_HINT_CHARS)) {
      errors.push(`puzzle ${pid} needs exactly ${HINT_COUNT} hint strings of at most ${MAX_HINT_CHARS} characters`);
    }
  }

  const publicTexts: Array<[string, string]> = [];
  const add = (where: string, v: unknown) => {
    if (typeof v === "string") publicTexts.push([where, v]);
  };
  add("title", own(pub, "title"));
  add("intro", own(pub, "intro"));
  const exit = own(pub, "exit");
  if (isObject(exit)) add("exit.message", own(exit, "message"));
  for (const h of (own(pub, "hotspots") as unknown[] | undefined) ?? []) {
    if (!isObject(h)) continue;
    for (const k of ["name", "description", "object_label"]) add(`hotspot ${text(h, "id")}.${k}`, own(h, k));
  }
  const kinds = new Map<string, string | null>();
  for (const p of (own(pub, "puzzles") as unknown[] | undefined) ?? []) {
    if (!isObject(p)) continue;
    kinds.set(text(p, "id") ?? "", text(p, "kind"));
    for (const k of ["title", "prompt"]) add(`puzzle ${text(p, "id")}.${k}`, own(p, k));
    for (const listName of Object.values(OPTION_LISTS)) {
      const options = own(p, listName);
      if (!Array.isArray(options)) continue;
      for (const o of options) {
        if (!isObject(o)) continue;
        for (const k of ["name", "role", "alibi"]) add(`puzzle ${text(p, "id")} ${listName} ${text(o, "id")}.${k}`, own(o, k));
      }
    }
  }
  for (const [pid, s] of Object.entries(solutions)) {
    if (kinds.get(pid) !== "code") continue;
    const answer = normalizeAnswer(isObject(s) ? text(s, "answer") : null);
    if (answer.length < 3) continue;
    for (const [where, value] of publicTexts) {
      if (normalizeAnswer(value).includes(answer)) {
        errors.push(`code puzzle ${pid} answer appears in public text outside item descriptions (${where})`);
      }
    }
  }
  for (const p of (own(pub, "puzzles") as unknown[] | undefined) ?? []) {
    if (isObject(p) && text(p, "kind") === "accuse") {
      const s = own(solutions, text(p, "id") ?? "");
      if (isObject(s)) errors.push(...accusationContract(pub, p, s));
    }
  }
  return errors;
}

/**
 * The accusation is worked out from its evidence items alone. Outside them
 * (and outside the options, the solved messages and the hints), no public
 * prose names a right option unless it names all three of that list
 * (revealsAnswer); and the evidence items name no wrong option of any list,
 * so what they say can never contradict the answer. The object_label comes
 * from perception, not prose, and is not checked.
 */
function accusationContract(pub: Json, p: Json, s: Json): string[] {
  const pid = text(p, "id");
  const lists: AnswerList[] = [];
  const wrong: string[] = [];
  for (const d of ACCUSE_DIMENSIONS) {
    const options = own(p, OPTION_LISTS[d]);
    const right = Array.isArray(options) ? options.find((o) => text(o, "id") === text(own(s, "answer"), d)) : undefined;
    if (!Array.isArray(options) || right === undefined) return [];   // reported by checkAccuseSolution
    const name = (o: unknown) => text(o, "name") ?? "";
    lists.push({ right: name(right), names: options.map(name) });
    wrong.push(...options.filter((o) => o !== right).map(name));
  }
  const evidence = new Set(ACCUSE_DIMENSIONS.map((d) => text(own(s, "evidence"), d)));

  const errors: string[] = [];
  const story: Array<[string, unknown]> = [["title", own(pub, "title")], ["intro", own(pub, "intro")]];
  const exit = own(pub, "exit");
  if (isObject(exit)) story.push(["exit.message", own(exit, "message")]);
  for (const h of (own(pub, "hotspots") as unknown[] | undefined) ?? []) {
    for (const k of ["name", "description"]) story.push([`hotspot ${text(h, "id")}.${k}`, isObject(h) ? own(h, k) : undefined]);
  }
  for (const q of (own(pub, "puzzles") as unknown[] | undefined) ?? []) {
    for (const k of ["title", "prompt"]) story.push([`puzzle ${text(q, "id")}.${k}`, isObject(q) ? own(q, k) : undefined]);
  }
  for (const it of (own(pub, "items") as unknown[] | undefined) ?? []) {
    const id = text(it, "id");
    for (const k of ["name", "description"]) {
      const value = isObject(it) ? own(it, k) : undefined;
      if (typeof value !== "string") continue;
      if (!evidence.has(id)) story.push([`item ${id}.${k}`, value]);
      else if (namesAny(value, wrong)) errors.push(`accusation ${pid} evidence names a wrong option (item ${id}.${k})`);
    }
  }
  for (const [where, value] of story) {
    if (typeof value === "string" && revealsAnswer(value, lists)) {
      errors.push(`accusation ${pid} answer appears in public text outside the evidence (${where})`);
    }
  }
  return errors;
}
