// The reveal sheets' rendered props (props.ts, from scripts/blender/props/reveal_*.py): the pictures are
// the sizes the sheets lay them out at, light enough to ship, and anchored inside themselves; and the
// two sheets built from views (the lamp, the mirror) still read to a screen reader with the pictures in.
import fs from "fs";
import path from "path";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HINT_AFTER_MS, Reveal } from "../Reveal";
import { BINDING, LAMP, LENS, MIRROR, PAPERWEIGHT, PENCIL } from "../props";

const DIR = path.join(__dirname, "../../../../assets/reveal");
/** A PNG's pixel size and weight, from the file. */
function png(file: string): { width: number; height: number; bytes: number } {
  const b = fs.readFileSync(path.join(DIR, file));
  expect(b.toString("latin1", 1, 4)).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

const PICTURES: [string, number, number][] = [
  ["lamp", LAMP.w, LAMP.h],
  ["lamp-lit", LAMP.w, LAMP.h],
  ["mirror-frame", MIRROR.w, MIRROR.h],
  ["mirror-glass", MIRROR.glassW, MIRROR.glassH],
  ["lens", LENS.w, LENS.h],
  ["pencil", PENCIL.w, PENCIL.h],
  ["notepad-binding", BINDING.w, BINDING.h],
  ["paperweight", PAPERWEIGHT.w, PAPERWEIGHT.h],
];

describe("the reveal props' pictures", () => {
  it.each(PICTURES)("%s is exported at the size it's laid out at, x1, x2 and x3, and stays light", (name, w, h) => {
    for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]] as const) {
      const { width, height, bytes } = png(`${name}${suffix}.png`);
      expect([width, height]).toEqual([w * scale, h * scale]);
      expect(bytes).toBeLessThan(150 * 1024);
    }
  });

  it("nothing else is in the folder: every picture shipped is one a sheet lays out", () => {
    const names = new Set(fs.readdirSync(DIR).map((f) => f.replace(/(@[23]x)?\.png$/, "")));
    expect([...names].sort()).toEqual(PICTURES.map(([name]) => name).sort());
  });

  it("each is placed by a point inside it", () => {
    for (const [at, w, h] of [
      [LAMP.bulb, LAMP.w, LAMP.h],
      [MIRROR.box, MIRROR.w, MIRROR.h],
      [LENS.gel, LENS.w, LENS.h],
      [PENCIL.tip, PENCIL.w, PENCIL.h],
      [BINDING.pad, BINDING.w, BINDING.h],
      [PAPERWEIGHT.centre, PAPERWEIGHT.w, PAPERWEIGHT.h],
    ] as const) {
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.x).toBeLessThanOrEqual(w);
      expect(at.y).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeLessThanOrEqual(h);
    }
  });

  it("the lens's picture has room for its ring round the 56 pt gel, the pencil's point is at its left, the binding spans the pad", () => {
    expect(Math.min(LENS.gel.x, LENS.gel.y, LENS.w - LENS.gel.x, LENS.h - LENS.gel.y)).toBeGreaterThan(56 + 9);
    expect(PENCIL.tip.x).toBeLessThan(8);
    expect(PENCIL.tip.y).toBeCloseTo(PENCIL.h / 2, 0);
    expect(BINDING.w - 2 * BINDING.pad.x).toBeCloseTo(BINDING.padW, 0);
    // The mirror's glass picture is the opening and its bleed.
    expect(MIRROR.glassW).toBe(MIRROR.width - 2 * MIRROR.inset + 2 * MIRROR.bleed);
  });
});

describe.each(["heat", "mirror"] as const)("the %s sheet with its rendered prop", (kind) => {
  // The card is only what's written (never a line of narration before it); a colon in it is part of the writing.
  const card = "Never the last: the rug.";
  const open = () =>
    render(
      <GestureHandlerRootView>
        <Reveal kind={kind} title="Blank letter" text={card} onClose={jest.fn()} />
      </GestureHandlerRootView>,
    );

  it("shows its pictures where the drawing was, and is still one button for the screen reader", async () => {
    await open();
    const art = (id: string) => screen.getByTestId(id, { includeHiddenElements: true });
    const source = (id: string) => art(id).props.source;
    if (kind === "heat") {
      // The lamp off, the lamp lit over it (the same framing: they register).
      expect(source("v2-reveal-lamp")).toBe(LAMP.off);
      expect(source("v2-reveal-lamp-lit")).toBe(LAMP.lit);
      expect(StyleSheet.flatten(art("v2-reveal-lamp-lit").props.style)).toMatchObject(art("v2-reveal-lamp").props.style);
    } else {
      expect(source("v2-reveal-mirror-glass")).toBe(MIRROR.glass);
      expect(source("v2-reveal-mirror-frame")).toBe(MIRROR.frame);
    }
    const page = screen.getByTestId("v2-reveal-page");
    expect(page.props.accessibilityRole).toBe("button");
    expect(page.props.accessibilityLabel).toMatch(/^Blank letter: hold it to the/);
  });

  it("says nothing about how to read it until she's left it alone for five seconds, then a few words", async () => {
    jest.useFakeTimers();
    try {
      await open();
      expect(screen.queryByTestId("v2-reveal-hint")).toBeNull();
      await act(async () => jest.advanceTimersByTime(HINT_AFTER_MS - 200));
      expect(screen.queryByTestId("v2-reveal-hint")).toBeNull();
      await act(async () => jest.advanceTimersByTime(400));
      const hint = screen.getByTestId("v2-reveal-hint");
      expect(String(hint.props.children).split(" ").length).toBeLessThanOrEqual(5);
      // The screen reader's label always says how, in full.
      expect(screen.getByTestId("v2-reveal-page").props.accessibilityLabel).toMatch(/^Blank letter: hold it to the/);
    } finally {
      jest.useRealTimers();
    }
  });

  it("still reads at once for a screen reader's activate", async () => {
    await open();
    await fireEvent(screen.getByTestId("v2-reveal-page"), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(screen.getByTestId("v2-reveal-page").props.accessibilityLabel).toBe("Blank letter: Never the last: the rug.");
    expect(screen.getByTestId("v2-reveal-text").props.accessibilityLabel).toBe("Never the last: the rug.");
    // Read: nothing is said under it (no narration, no hint).
    expect(screen.queryByTestId("v2-reveal-lead")).toBeNull();
    expect(screen.queryByTestId("v2-reveal-hint")).toBeNull();
    expect(screen.getByTestId("v2-reveal-close").props.accessibilityLabel).toBe("Done");
  });
});
