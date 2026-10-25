// Closed JSON schemas for every model call, plus runtime validation.
//
// The same schema object is sent to the provider as the structured-output
// schema and used here to validate the response. Every object is closed
// (additionalProperties: false, all properties required); anything outside the
// schema is rejected. Only keywords Gemini's responseJsonSchema supports are
// used (type, enum, properties, required, additionalProperties, items,
// minItems, maxItems, minimum, maximum, description). Gemini strips length
// limits, so string lengths are clamped later in prose.ts instead.
import type { Box1000 } from "./geometry.ts";

type JsonType = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

export interface JsonSchema {
  type: JsonType;
  description?: string;
  enum?: string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: JsonSchema;
  minItems?: number;
  maxItems?: number;
  minimum?: number;
  maximum?: number;
}

export class SchemaViolation extends Error {
  constructor(readonly problems: string[]) {
    super(`response does not match schema: ${problems.slice(0, 5).join("; ")}`);
    this.name = "SchemaViolation";
  }
}

function typeOk(type: JsonType, value: unknown): boolean {
  switch (type) {
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
  }
}

/** Returns every violation of `schema` by `value` (empty array = valid). */
export function validateJson(schema: JsonSchema, value: unknown, path = "$"): string[] {
  if (!typeOk(schema.type, value)) return [`${path}: expected ${schema.type}`];
  const problems: string[] = [];
  if (schema.enum && !schema.enum.includes(value as string)) problems.push(`${path}: not an allowed value`);
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) problems.push(`${path}: below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) problems.push(`${path}: above ${schema.maximum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${path}: fewer than ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) problems.push(`${path}: more than ${schema.maxItems} items`);
    if (schema.items) value.forEach((v, i) => problems.push(...validateJson(schema.items!, v, `${path}[${i}]`)));
  }
  if (schema.type === "object") {
    const obj = value as Record<string, unknown>;
    const props = schema.properties ?? {};
    for (const key of schema.required ?? []) {
      if (!(key in obj)) problems.push(`${path}.${key}: missing`);
    }
    for (const [key, v] of Object.entries(obj)) {
      if (props[key]) problems.push(...validateJson(props[key], v, `${path}.${key}`));
      else if (schema.additionalProperties === false) problems.push(`${path}.${key}: unexpected property`);
    }
  }
  return problems;
}

export function assertSchema<T>(schema: JsonSchema, value: unknown): T {
  const problems = validateJson(schema, value);
  if (problems.length) throw new SchemaViolation(problems);
  return value as T;
}

function closedObject(properties: Record<string, JsonSchema>, description?: string): JsonSchema {
  return { type: "object", description, properties, required: Object.keys(properties), additionalProperties: false };
}

const str = (description?: string): JsonSchema => ({ type: "string", description });

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------
export const AFFORDANCES = [
  "container_candidate", "surface", "wall_hanging", "readable_prop", "instrument",
  "electronic", "textile", "plant", "other",
] as const;
export type Affordance = typeof AFFORDANCES[number];

export const PHOTO_QUALITY = ["good", "dim", "blurry", "unusable"] as const;
export type PhotoQuality = typeof PHOTO_QUALITY[number];

export const VERDICTS = ["visible", "implied", "occluded", "inside_closed_container", "not_present"] as const;
export type Verdict = typeof VERDICTS[number];

// Plan section 6, "Voice and narrative themes".
export const STORY_FAMILIES = [
  "lost_correspondence", "quiet_heist", "forgotten_inventor", "impossible_architecture",
  "benign_secret_society", "time_anomaly", "disputed_museum_object", "unfinished_map",
] as const;
export type StoryFamily = typeof STORY_FAMILIES[number];

export const MAX_OBJECTS_PER_PHOTO = 20;

// ---------------------------------------------------------------------------
// Stage 2: per-photo perception
// ---------------------------------------------------------------------------
export const PERCEPTION_SCHEMA: JsonSchema = closedObject({
  person_present: { type: "boolean", description: "A real person or any part of one (including a reflection) is visible." },
  sensitive_text: { type: "boolean", description: "Readable mail, documents, cards, handwriting, or a lit screen showing content is visible." },
  quality: { type: "string", enum: [...PHOTO_QUALITY] },
  objects: {
    type: "array",
    maxItems: MAX_OBJECTS_PER_PHOTO,
    items: closedObject({
      label: str("Generic noun phrase, 1-4 lowercase words, no brands, no transcribed text."),
      affordance: { type: "string", enum: [...AFFORDANCES] },
      box_2d: {
        type: "array", minItems: 4, maxItems: 4,
        description: "[ymin, xmin, ymax, xmax] normalized to 0-1000.",
        items: { type: "integer", minimum: 0, maximum: 1000 },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    }),
  },
});

export interface PerceivedObject {
  label: string;
  affordance: Affordance;
  box: Box1000;
  confidence: number;
}

export interface PerceptionResult {
  personPresent: boolean;
  sensitiveText: boolean;
  quality: PhotoQuality;
  objects: PerceivedObject[];
}

export function parsePerception(value: unknown): PerceptionResult {
  const raw = assertSchema<{
    person_present: boolean;
    sensitive_text: boolean;
    quality: PhotoQuality;
    objects: Array<{ label: string; affordance: Affordance; box_2d: number[]; confidence: number }>;
  }>(PERCEPTION_SCHEMA, value);
  return {
    personPresent: raw.person_present,
    sensitiveText: raw.sensitive_text,
    quality: raw.quality,
    objects: raw.objects.map((o) => ({
      label: o.label,
      affordance: o.affordance,
      box: [o.box_2d[0], o.box_2d[1], o.box_2d[2], o.box_2d[3]] as const,
      confidence: o.confidence,
    })),
  };
}

// ---------------------------------------------------------------------------
// Stage 4: presence verification (+ cross-photo identity for reconciliation)
// ---------------------------------------------------------------------------
export const VERIFICATION_SCHEMA: JsonSchema = closedObject({
  candidates: {
    type: "array",
    items: closedObject({
      id: str("Candidate id exactly as given."),
      verdict: { type: "string", enum: [...VERDICTS] },
      same_object_as: str("Id of a candidate in a DIFFERENT photo showing the same physical object, or empty string."),
      clarity: { type: "integer", minimum: 1, maximum: 5, description: "How clearly and completely this view shows the object." },
    }),
  },
});

export interface VerificationVerdict {
  verdict: Verdict;
  sameObjectAs: string | null;
  clarity: number;
}

/** Unknown or repeated ids are ignored (first answer wins); missing ids stay unverified. */
export function parseVerification(value: unknown, knownIds: ReadonlySet<string>): Map<string, VerificationVerdict> {
  const raw = assertSchema<{
    candidates: Array<{ id: string; verdict: Verdict; same_object_as: string; clarity: number }>;
  }>(VERIFICATION_SCHEMA, value);
  const out = new Map<string, VerificationVerdict>();
  for (const c of raw.candidates) {
    if (!knownIds.has(c.id) || out.has(c.id)) continue;
    const same = c.same_object_as && knownIds.has(c.same_object_as) && c.same_object_as !== c.id ? c.same_object_as : null;
    out.set(c.id, { verdict: c.verdict, sameObjectAs: same, clarity: c.clarity });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Stage 8 / 10: prose and repair (same schema). Ids are enums of minted ids.
// ---------------------------------------------------------------------------
export interface ProseIds {
  hotspotIds: string[];
  itemIds: string[];
  puzzleIds: string[];
}

export function proseSchema(ids: ProseIds): JsonSchema {
  const idEnum = (values: string[]): JsonSchema => ({ type: "string", enum: values.length ? values : ["none"] });
  return closedObject({
    story_family: { type: "string", enum: [...STORY_FAMILIES] },
    title: str("Case title, at most 60 characters."),
    intro: str("Two or three sentences, at most 400 characters."),
    exit_message: str("Shown when the case is solved, at most 300 characters."),
    hotspots: {
      type: "array",
      items: closedObject({ id: idEnum(ids.hotspotIds), name: str(), description: str() }),
    },
    items: {
      type: "array",
      items: closedObject({ id: idEnum(ids.itemIds), name: str(), description: str() }),
    },
    puzzles: {
      type: "array",
      items: closedObject({
        id: idEnum(ids.puzzleIds),
        title: str(),
        prompt: str(),
        message: str(),
        hints: { type: "array", minItems: 3, maxItems: 3, items: str() },
      }),
    },
  });
}

export interface ProseText {
  storyFamily: StoryFamily;
  title: string;
  intro: string;
  exitMessage: string;
  hotspots: Map<string, { name: string; description: string }>;
  items: Map<string, { name: string; description: string }>;
  puzzles: Map<string, { title: string; prompt: string; message: string; hints: string[] }>;
}

/** Validates against the closed schema; duplicate ids keep the first entry. Missing ids are filled later. */
export function parseProse(value: unknown, ids: ProseIds): ProseText {
  const raw = assertSchema<{
    story_family: StoryFamily;
    title: string;
    intro: string;
    exit_message: string;
    hotspots: Array<{ id: string; name: string; description: string }>;
    items: Array<{ id: string; name: string; description: string }>;
    puzzles: Array<{ id: string; title: string; prompt: string; message: string; hints: string[] }>;
  }>(proseSchema(ids), value);
  const byId = <T extends { id: string }>(rows: T[]): Map<string, T> => {
    const map = new Map<string, T>();
    for (const row of rows) if (!map.has(row.id)) map.set(row.id, row);
    return map;
  };
  const strip = <T extends { id: string }>(m: Map<string, T>) =>
    new Map([...m].map(([id, { id: _id, ...rest }]) => [id, rest as Omit<T, "id">]));
  return {
    storyFamily: raw.story_family,
    title: raw.title,
    intro: raw.intro,
    exitMessage: raw.exit_message,
    hotspots: strip(byId(raw.hotspots)),
    items: strip(byId(raw.items)),
    puzzles: strip(byId(raw.puzzles)),
  };
}
