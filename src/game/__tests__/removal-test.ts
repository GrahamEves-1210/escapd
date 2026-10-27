import type { Hotspot, Puzzle, PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { studyPublic } from "@/test-utils/seed";
import type { PixelRegion } from "../inpaint";
import { chooseRemovable, isPortableLabel, regionGeometry, removableCandidates } from "../removal";

const rect = (x: number, y: number, w: number, h: number) => ({ type: "rect" as const, x, y, w, h });

function hotspot(id: string, label: string, shape = rect(0.3, 0.3, 0.2, 0.2), extra: Partial<Hotspot> = {}): Hotspot {
  return { id, photo_index: 0, object_label: label, shape, ...extra };
}

function room(hotspots: Hotspot[], puzzles?: Puzzle[]): PuzzleDefinitionV1 {
  return {
    schema_version: 1,
    photos: [{ asset_key: "a.jpg" }, { asset_key: "b.jpg" }],
    items: [],
    hotspots,
    puzzles: puzzles ?? hotspots.map((h) => ({ id: `p_${h.id}`, kind: "inspect", hotspot_id: h.id })),
    exit: { requires: [] },
  };
}

/** A region round any box: plain (flat grey) or busy (stripes). */
function sampled(kind: "plain" | "busy" | "lit"): PixelRegion {
  const w = 130;
  const h = 130;
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = kind === "plain" ? 120 : kind === "lit" ? Math.round(80 + x * 0.6) : Math.floor(x / 3) % 2 ? 220 : 30;
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  }
  return { data, width: w, height: h, box: { x: 15, y: 15, w: 100, h: 100 } };
}

const ids = (hs: Hotspot[]) => hs.map((h) => h.id);

describe("isPortableLabel", () => {
  it.each(["Vase", "a stack of BOOKS", "coffee mug", "plant pot", "potted plant", "desk lamp", "alarm clock", "picture frame", "small speaker", "teddy bear", "game controller", "old shoes", "boxes"])(
    "%s is portable",
    (label) => expect(isPortableLabel(label)).toBe(true),
  );
  it.each(["bookshelf", "desk", "drawer", "door", "lamp", "floor lamp", "grandfather clock", "large vase", "fuse box", "painting", "wall clock", "sofa", "plant", ""])(
    "%s is not",
    (label) => expect(isPortableLabel(label)).toBe(false),
  );
});

describe("removableCandidates", () => {
  it("takes only a portable object whose one puzzle is an inspect", () => {
    const def = room(
      [hotspot("vase", "vase"), hotspot("mug", "mug", rect(0.6, 0.6, 0.15, 0.15)), hotspot("box", "box", rect(0.1, 0.7, 0.1, 0.15)), hotspot("desk", "desk", rect(0.05, 0.05, 0.2, 0.2))],
      [
        { id: "look_vase", kind: "inspect", hotspot_id: "vase" },
        // The mug also takes an item: removing it could break play.
        { id: "look_mug", kind: "inspect", hotspot_id: "mug" },
        { id: "fill_mug", kind: "use_item", hotspot_id: "mug", requires: ["look_vase"] },
        // A code on the box.
        { id: "open_box", kind: "code", hotspot_id: "box" },
        { id: "look_desk", kind: "inspect", hotspot_id: "desk" },
      ],
    );
    expect(ids(removableCandidates(def))).toEqual(["vase"]);
  });

  it("skips hidden and haunted objects", () => {
    const def = room([
      hotspot("a", "vase", rect(0.1, 0.1, 0.15, 0.15), { hidden: true }),
      hotspot("b", "candle", rect(0.5, 0.1, 0.15, 0.15), { effect: "flicker" }),
      hotspot("c", "jar", rect(0.5, 0.5, 0.15, 0.15)),
    ]);
    expect(ids(removableCandidates(def))).toEqual(["c"]);
  });

  it("keeps the box between 1% and 15% of the photo and 2% in from its edges", () => {
    const def = room([
      hotspot("tiny", "cup", rect(0.4, 0.4, 0.05, 0.1)), // 0.5%
      hotspot("huge", "basket", rect(0.1, 0.1, 0.4, 0.4)), // 16%
      hotspot("edge", "book", rect(0.01, 0.5, 0.1, 0.2)), // 1% from the left
      hotspot("foot", "bag", rect(0.2, 0.79, 0.2, 0.2)), // 1% from the bottom
      hotspot("ok_small", "mug", rect(0.6, 0.1, 0.1, 0.1)), // 1%
      hotspot("ok_large", "hat", rect(0.55, 0.3, 0.3, 0.5)), // 15%
    ]);
    expect(ids(removableCandidates(def))).toEqual(["ok_small", "ok_large"]);
  });

  it("leaves an object another one reaches into, unless that one holds it whole", () => {
    const def = room([
      hotspot("desk", "desk", rect(0.05, 0.4, 0.9, 0.5)),
      hotspot("mug", "mug", rect(0.2, 0.5, 0.12, 0.12)),
      hotspot("vase", "vase", rect(0.6, 0.1, 0.15, 0.2)),
      hotspot("note", "note", rect(0.7, 0.25, 0.1, 0.1), { hidden: true }),
    ]);
    expect(ids(removableCandidates(def))).toEqual(["mug"]);
  });

  it("finds nothing in the tutorial study", () => {
    expect(removableCandidates(studyPublic())).toEqual([]);
  });
});

describe("chooseRemovable", () => {
  const vase = hotspot("vase", "vase", rect(0.1, 0.1, 0.2, 0.2)); // 4%
  const mug = hotspot("mug", "mug", rect(0.6, 0.1, 0.1, 0.1)); // 1%
  const jar = hotspot("jar", "jar", rect(0.5, 0.5, 0.3, 0.3), { photo_index: 1 }); // 9%

  it("rejects a busy ring and takes the plainest, then the box nearest a mid size", () => {
    const def = room([mug, vase, jar]);
    const busyVase = chooseRemovable(def, (h) => sampled(h.id === "vase" ? "busy" : "plain"));
    // The vase's ring is busy; of the plain two, the jar (9%) is nearer mid size than the mug (1%).
    expect(busyVase?.hotspot.id).toBe("jar");
    expect(busyVase?.puzzleId).toBe("p_jar");
    const allPlain = chooseRemovable(def, () => sampled("plain"));
    expect(allPlain?.hotspot.id).toBe("vase");
    // A lit wall's gradient counts as plain.
    expect(chooseRemovable(def, (h) => sampled(h.id === "mug" ? "lit" : "busy"))?.hotspot.id).toBe("mug");
  });

  it("is deterministic: the same room and pixels, whatever the order, give the same object", () => {
    const a = chooseRemovable(room([mug, vase, jar]), () => sampled("plain"));
    const b = chooseRemovable(room([jar, vase, mug]), () => sampled("plain"));
    expect(a?.hotspot.id).toBe(b?.hotspot.id);
    const twins = [hotspot("b_cup", "cup", rect(0.1, 0.1, 0.2, 0.2)), hotspot("a_cup", "cup", rect(0.6, 0.6, 0.2, 0.2))];
    expect(chooseRemovable(room(twins), () => sampled("plain"))?.hotspot.id).toBe("a_cup");
  });

  it("gives null when nothing qualifies: no candidate, every ring busy, or no pixels", () => {
    expect(chooseRemovable(room([hotspot("d", "door")]), () => sampled("plain"))).toBeNull();
    expect(chooseRemovable(room([mug, vase]), () => sampled("busy"))).toBeNull();
    expect(chooseRemovable(room([mug, vase]), () => null)).toBeNull();
  });

  it("samples only the candidates", () => {
    const sample = jest.fn((_hotspot: Hotspot) => sampled("plain"));
    chooseRemovable(room([mug, hotspot("d", "door")]), sample);
    expect(sample.mock.calls.map(([h]) => h.id)).toEqual(["mug"]);
  });
});

describe("regionGeometry", () => {
  it("pads the box 15% each side, reads it at most 384 px long, and places it in photo fractions", () => {
    const g = regionGeometry({ x: 0.25, y: 0.25, w: 0.5, h: 0.25 }, 1200, 1600);
    expect(g.src).toEqual({ x: 210, y: 340, w: 780, h: 520 });
    expect(Math.max(g.width, g.height)).toBe(384);
    expect(g.rect.x).toBeCloseTo(210 / 1200);
    expect(g.box.x).toBeCloseTo(90 * (g.width / 780));
    expect(g.box.w).toBeCloseTo(600 * (g.width / 780));
    // Small regions are read at their own size.
    const small = regionGeometry({ x: 0.5, y: 0.5, w: 0.1, h: 0.1 }, 1000, 1000);
    expect([small.width, small.height]).toEqual([130, 130]);
  });
});
