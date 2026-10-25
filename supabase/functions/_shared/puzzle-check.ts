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
import { decimalSumGreaterThan } from "./geometry.ts";

export const ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const KINDS = new Set(["inspect", "code", "use_item", "combine"]);
const FORBIDDEN_PUBLIC_KEYS = new Set(["answer", "rewards", "inputs", "solution", "hints"]);
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

/** private.normalize_answer: lower(), then strip runs of whitespace and - _ . , : ; ' " */
export function normalizeAnswer(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[ \t\n\r\v\f\-_.,:;'"]+/g, "");
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
    errors.push("public definition contains solution-only keys (answer/rewards/inputs/solution/hints)");
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
  for (const p of puzzles) {
    const pid = text(p, "id");
    if (pid === null || !ID_RE.test(pid)) continue;
    const pz = p as Json;
    const kind = text(pz, "kind");
    if (kind === null || !KINDS.has(kind)) {
      errors.push(`puzzle ${pid} has invalid kind`);
      continue;
    }
    if (kind !== "combine") {
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

/**
 * Greedy solvability simulation, as in SQL, plus clue coverage as a solve
 * condition: a code puzzle counts as solvable only once its normalized answer
 * is a substring of ONE normalized description among the items in the
 * simulated inventory and the currently revealed hotspots. (The SQL joins the
 * descriptions with "|", which survives normalization, so digits never stitch
 * across two descriptions.) A code that never becomes clued is reported.
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
      if (canSolve && kind !== "combine") canSolve = revealed.includes(text(p, "hotspot_id") ?? "");
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

/** Generator-only rules: hint ladder shape and no code answer in public text outside item descriptions. */
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
  for (const p of (own(pub, "puzzles") as unknown[] | undefined) ?? []) {
    if (!isObject(p)) continue;
    for (const k of ["title", "prompt"]) add(`puzzle ${text(p, "id")}.${k}`, own(p, k));
  }
  for (const [pid, s] of Object.entries(solutions)) {
    const answer = normalizeAnswer(isObject(s) ? text(s, "answer") : null);
    if (answer.length < 3) continue;
    for (const [where, value] of publicTexts) {
      if (normalizeAnswer(value).includes(answer)) {
        errors.push(`code puzzle ${pid} answer appears in public text outside item descriptions (${where})`);
      }
    }
  }
  return errors;
}
