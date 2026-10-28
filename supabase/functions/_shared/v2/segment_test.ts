// Segmentation (outlines): the PNG decoder, a mask's outline in photo
// fractions, matching masks to objects, and the lenient parser.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import { ellipseMask, encodePng } from "../test_fixtures.ts";
import { decodePng } from "./png.ts";
import { maskOutline, matchMasks, parseSegmentation, type SegmentedMask } from "./segment.ts";
import type { ObjectDef } from "./types.ts";

const object = (id: string, box: ObjectDef["box"]): ObjectDef => ({
  id, photo_index: 0, box, label: id, type: "rug", archetype: null, controls: [], initial: {},
});

Deno.test("png: every row filter decodes back to the same pixels", async () => {
  const value = (x: number, y: number) => (x * 37 + y * 11 + ((x * y) % 7) * 20) % 256;
  const img = await decodePng(await encodePng(23, 17, value));
  assert(img);
  assertEquals([img.width, img.height], [23, 17]);
  for (let y = 0; y < 17; y++) for (let x = 0; x < 23; x++) assertEquals(img.data[y * 23 + x], value(x, y));
  assertEquals(await decodePng(new Uint8Array([1, 2, 3])), null);
});

Deno.test("segment: an elliptical mask becomes an ellipse in photo fractions, at most 64 points", async () => {
  // A rug in the lower half: box_2d [700, 200, 950, 800] (y, x), the mask filling it.
  const png = await encodePng(120, 50, ellipseMask(120, 50));
  const rug = object("rug", { x: 0.2, y: 0.7, w: 0.6, h: 0.25 });
  const outline = await maskOutline({ label: "rug", box: [700, 200, 950, 800], png }, rug);
  assert(outline && outline.length >= 12 && outline.length <= 64);
  for (const p of outline) {
    const r = Math.hypot((p.x - 0.5) / 0.3, (p.y - 0.825) / 0.125);
    assert(r > 0.9 && r < 1.08, `(${p.x}, ${p.y}) on the rim (${r.toFixed(3)})`);
  }
  // A mask that doesn't sit on its object is no outline.
  assertEquals(await maskOutline({ label: "rug", box: [0, 0, 200, 200], png }, rug), null);
  // Nor is an empty one.
  assertEquals(await maskOutline({ label: "rug", box: [700, 200, 950, 800], png: await encodePng(8, 8, () => 0) }, rug), null);
});

Deno.test("segment: masks match objects by the id given back, else by their box", () => {
  const png = new Uint8Array();
  const objects = [object("lamp", { x: 0.1, y: 0.1, w: 0.2, h: 0.3 }), object("desk", { x: 0.4, y: 0.5, w: 0.5, h: 0.4 })];
  const masks: SegmentedMask[] = [
    { label: "a desk", box: [500, 400, 900, 900], png },   // no id: matched by its box
    { label: "lamp", box: [90, 100, 410, 300], png },
    { label: "chair", box: [0, 900, 100, 1000], png },     // nothing like it listed
  ];
  const matched = matchMasks(masks, objects);
  assertEquals([...matched.keys()].sort(), ["desk", "lamp"]);
  assertEquals(matched.get("desk")!.label, "a desk");
});

Deno.test("segment: the parser takes a list or a wrapped list, and skips what isn't a mask", () => {
  const mask = "data:image/png;base64,iVBORw0KGgo=";
  const got = parseSegmentation([
    { label: "a", box_2d: [10, 20, 300, 400], mask },
    { label: "b", box_2d: [10, 20, 300], mask },             // short box
    { label: "c", box_2d: [300, 20, 10, 400], mask },        // inside out
    { label: "d", box_2d: [10, 20, 300, 400] },              // no mask
    { label: "e", box_2d: [10, 20, 300, 400], mask: "%%%" }, // not base64
  ]);
  assertEquals(got.map((m) => m.label), ["a"]);
  assertEquals(got[0].box, [10, 20, 300, 400]);
  assertEquals(parseSegmentation({ masks: [{ label: "a", box_2d: [1, 2, 3, 4], mask }] }).length, 1);
  assertThrows(() => parseSegmentation("no"));
});
