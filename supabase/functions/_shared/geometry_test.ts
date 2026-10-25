import { assert, assertAlmostEquals, assertEquals } from "jsr:@std/assert@1";
import { type Box1000, boxArea, boxToRect, decimalSumGreaterThan, iou, isValidBox, touchesEdge } from "./geometry.ts";
import { checkPuzzle } from "./puzzle-check.ts";

Deno.test("boxToRect converts [ymin, xmin, ymax, xmax] on 0..1000 to x/y/w/h fractions", () => {
  assertEquals(boxToRect([100, 200, 300, 500], { padding: 0 }), { type: "rect", x: 0.2, y: 0.1, w: 0.3, h: 0.2 });
  // default padding adds 1% on every side
  assertEquals(boxToRect([100, 200, 300, 500]), { type: "rect", x: 0.19, y: 0.09, w: 0.32, h: 0.22 });
});

Deno.test("boxToRect grows tiny boxes to the minimum size around their center", () => {
  const r = boxToRect([500, 500, 505, 510], { padding: 0 });
  assertEquals(r.w, 0.05);
  assertEquals(r.h, 0.05);
  assertAlmostEquals(r.x + r.w / 2, 0.505, 0.001);
  assertAlmostEquals(r.y + r.h / 2, 0.5025, 0.001);
});

Deno.test("boxToRect clamps at the frame and shifts small boxes inside it", () => {
  assertEquals(boxToRect([0, 0, 1000, 1000]), { type: "rect", x: 0, y: 0, w: 1, h: 1 });
  const corner = boxToRect([995, 995, 1000, 1000]);
  assertEquals(corner, { type: "rect", x: 0.95, y: 0.95, w: 0.05, h: 0.05 });
  const top = boxToRect([0, 400, 10, 600]);
  assertEquals(top.y, 0);
});

Deno.test("boxToRect output always passes the SQL rect rule (random boxes)", () => {
  let seed = 7;
  const rand = (max: number) => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed % max;
  };
  for (let i = 0; i < 2000; i++) {
    const y0 = rand(1000);
    const x0 = rand(1000);
    const box: Box1000 = [y0, x0, y0 + 1 + rand(1000 - y0), x0 + 1 + rand(1000 - x0)];
    const r = boxToRect(box);
    assert(r.x >= 0 && r.y >= 0 && r.w > 0 && r.h > 0, JSON.stringify({ box, r }));
    assert(!decimalSumGreaterThan(r.x, r.w) && !decimalSumGreaterThan(r.y, r.h), JSON.stringify({ box, r }));
    // round-trips through JSON text exactly as Postgres would read it
    const back = JSON.parse(JSON.stringify(r));
    assertEquals(back, r);
  }
});

Deno.test("rects from boxToRect pass the full puzzle-check rect clause", () => {
  const shape = boxToRect([990, 990, 1000, 1000]);
  const pub = {
    schema_version: 1, photos: [{ photo_id: "a" }], items: [],
    hotspots: [{ id: "h", photo_index: 0, object_label: "box", shape }],
    puzzles: [{ id: "p", kind: "inspect", hotspot_id: "h" }],
    exit: { requires: ["p"] },
  };
  assertEquals(checkPuzzle(pub, { schema_version: 1, puzzles: { p: {} } }), []);
});

Deno.test("decimalSumGreaterThan compares exact decimals, not floats", () => {
  assertEquals(decimalSumGreaterThan(0.7, 0.3), false);
  assertEquals(decimalSumGreaterThan(0.1, 0.2, 0.3), false);   // floats say 0.30000000000000004
  assertEquals(decimalSumGreaterThan(0.7, 0.30000000000000004), true);
  assertEquals(decimalSumGreaterThan(0.5, 0.5000001), true);
  assertEquals(decimalSumGreaterThan(1e-7, 0.9999999), false);
  assertEquals(decimalSumGreaterThan(1.5e-7, 0.9999999), true);
});

Deno.test("box helpers", () => {
  assert(isValidBox([0, 0, 1, 1]));
  assert(!isValidBox([10, 10, 10, 20]));
  assert(!isValidBox([0, 0, 1001, 5]));
  assert(!isValidBox([0, 0, 5.5, 5]));
  assertEquals(boxArea([0, 0, 500, 500]), 0.25);
  assertEquals(iou([0, 0, 100, 100], [0, 0, 100, 100]), 1);
  assertEquals(iou([0, 0, 100, 100], [200, 200, 300, 300]), 0);
  assertAlmostEquals(iou([0, 0, 100, 100], [0, 50, 100, 150]), 1 / 3, 1e-9);
  assert(touchesEdge([0, 100, 200, 300]));
  assert(!touchesEdge([100, 100, 200, 300]));
});
