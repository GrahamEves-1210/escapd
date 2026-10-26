import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { collectCandidates, flaggedPositions, flaggedReasons, isDeniedLabel, type PhotoPayload, reconcile, sanitizeLabel, type VerifiedCandidate } from "./perception.ts";
import { parsePerception, parseVerification, SchemaViolation } from "./schemas.ts";

Deno.test("labels are sanitized to short generic nouns", () => {
  assertEquals(sanitizeLabel("  The Wooden  DESK!! "), "wooden desk");
  assertEquals(sanitizeLabel("lamp \"IKEA\" (white)"), "lamp ikea white");
  assert(sanitizeLabel("a ".repeat(60)).length <= 40);
});

Deno.test("deny list keeps people, private items, screens and room structure out of the fiction", () => {
  for (const label of ["family photo", "framed photograph", "laptop", "tv", "pill bottle", "stack of mail", "front door", "window", "wallet", "candle", "phone"]) {
    assert(isDeniedLabel(label), label);
  }
  for (const label of ["cabinet door", "wall clock", "desk lamp", "woven basket", "bookshelf", "potted plant", "window seat cushion"]) {
    assert(!isDeniedLabel(label), label);
  }
});

Deno.test("collectCandidates drops denied labels, bad boxes, low confidence and slivers", () => {
  const result = parsePerception({
    person_present: false, sensitive_text: false, quality: "good",
    objects: [
      { label: "Desk Lamp", affordance: "electronic", box_2d: [100, 100, 400, 300], confidence: 0.9 },
      { label: "laptop", affordance: "electronic", box_2d: [100, 400, 400, 600], confidence: 0.9 },
      { label: "rug", affordance: "textile", box_2d: [500, 500, 500, 900], confidence: 0.9 },       // zero height
      { label: "vase", affordance: "other", box_2d: [100, 700, 300, 800], confidence: 0.2 },        // unsure
      { label: "pin", affordance: "other", box_2d: [100, 100, 110, 110], confidence: 0.9 },         // too small
      { label: "whole room", affordance: "other", box_2d: [0, 0, 1000, 1000], confidence: 0.9 },    // too big
    ],
  });
  const candidates = collectCandidates([result]);
  assertEquals(candidates.map((c) => [c.id, c.label]), [["p0_0", "desk lamp"]]);
});

Deno.test("perception responses outside the schema are rejected", () => {
  const base = { person_present: false, sensitive_text: false, quality: "good", objects: [] as unknown[] };
  assertThrows(() => parsePerception({ ...base, extra: true }), SchemaViolation);
  assertThrows(() => parsePerception({ ...base, quality: "great" }), SchemaViolation);
  assertThrows(() => parsePerception({ ...base, objects: [{ label: "x", affordance: "furniture", box_2d: [0, 0, 1, 1], confidence: 1 }] }), SchemaViolation);
  assertThrows(() => parsePerception({ ...base, objects: [{ label: "x", affordance: "other", box_2d: [0, 0, 1, 1001], confidence: 1 }] }), SchemaViolation);
  assertThrows(() => parsePerception({ ...base, objects: [{ label: "x", affordance: "other", box_2d: [0, 0, 1], confidence: 1 }] }), SchemaViolation);
  assertThrows(() => parsePerception({ ...base, objects: [{ label: "x", affordance: "other", box_2d: [0, 0, 1.5, 9], confidence: 1 }] }), SchemaViolation);
});

Deno.test("verification ignores unknown ids and self-links", () => {
  const verdicts = parseVerification({
    candidates: [
      { id: "p0_0", verdict: "visible", same_object_as: "p1_0", clarity: 5 },
      { id: "p0_0", verdict: "occluded", same_object_as: "", clarity: 1 },
      { id: "p1_0", verdict: "visible", same_object_as: "p1_0", clarity: 3 },
      { id: "zz", verdict: "visible", same_object_as: "", clarity: 3 },
    ],
  }, new Set(["p0_0", "p1_0"]));
  assertEquals(verdicts.size, 2);
  assertEquals(verdicts.get("p0_0"), { verdict: "visible", sameObjectAs: "p1_0", clarity: 5 });
  assertEquals(verdicts.get("p1_0")?.sameObjectAs, null);
});

const v = (id: string, label: string, photoIndex: number, box: [number, number, number, number], clarity: number, sameObjectAs: string | null = null): VerifiedCandidate =>
  ({ id, label, photoIndex, box, clarity, sameObjectAs, affordance: "surface", confidence: 0.9 });

Deno.test("reconcile: one object per real thing, kept on its clearest photo", () => {
  const objects = reconcile([
    v("p0_0", "writing desk", 0, [500, 100, 900, 600], 3),
    v("p1_0", "desk", 1, [400, 200, 800, 700], 5, "p0_0"),        // linked by verification
    v("p2_0", "writing desk", 2, [0, 0, 400, 300], 4),            // same label elsewhere
    v("p0_1", "lamp", 0, [100, 600, 400, 750], 4),
    v("p0_2", "desk lamp", 0, [110, 610, 400, 760], 2),           // same box on the same photo
    v("p1_1", "rug", 1, [800, 200, 990, 800], 4),
  ]);
  assertEquals(objects.length, 3);
  const desk = objects.find((o) => o.label === "desk" || o.label === "writing desk")!;
  assertEquals(desk.id, "p1_0");
  assertEquals(objects.find((o) => o.label.includes("lamp"))!.id, "p0_1");
  assert(!("sameObjectAs" in desk));
});

Deno.test("flaggedPositions reports room_photos positions", () => {
  const photos = [0, 2, 5].map((position, index) => ({ index, position }) as PhotoPayload);
  const clean = { personPresent: false, sensitiveText: false, quality: "good" as const, objects: [] };
  assertEquals(flaggedPositions([clean, { ...clean, sensitiveText: true }, { ...clean, personPresent: true }], photos), [2, 5]);
});

Deno.test("flaggedReasons names what each flagged position shows", () => {
  const photos = [0, 2, 5].map((position, index) => ({ index, position }) as PhotoPayload);
  const clean = { personPresent: false, sensitiveText: false, quality: "good" as const, objects: [] };
  assertEquals(
    flaggedReasons([{ ...clean, personPresent: true }, clean, { ...clean, personPresent: true, sensitiveText: true }], photos),
    "0=person; 5=person+private_text",
  );
  assertEquals(flaggedReasons([clean, { ...clean, sensitiveText: true }, clean], photos), "2=private_text");
  assertEquals(flaggedReasons([clean, clean, clean], photos), "");
});
