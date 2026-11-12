// The mode cards' dioramas (ModeScene): three rendered depth layers per mode, covering the card from its top with
// picture to spare for their slide, the wall going with the eye and the nearest thing against it, inside the frame.
import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { PARALLAX, SCENE } from "../nook";
import { ModeScene, sceneBox } from "../ModeScene";

const ROOT = path.join(__dirname, "../../../../..");
const CARDS = JSON.parse(fs.readFileSync(path.join(ROOT, "assets/home/cards/cards.json"), "utf8")) as {
  card: number[]; bleed: number; modes: Record<string, Record<string, number[]>>;
};
const GENRES = ["noir", "crime_scene", "paranormal"] as const;
const FILES = { noir: "noir", crime_scene: "crime", paranormal: "moonlit" } as const;
const hidden = { includeHiddenElements: true } as const;

describe("the mode cards' dioramas", () => {
  it("has three rendered layers for each mode: the wall whole behind the card and past it, the table across it, something nearest", () => {
    expect(Object.keys(CARDS.modes).sort()).toEqual(["crime", "moonlit", "noir"]);
    const [cw, ch] = CARDS.card;
    for (const genre of GENRES) {
      const place = CARDS.modes[FILES[genre]];
      expect(Object.keys(place)).toEqual(["back", "table", "mid", "front"]);
      for (const [layer, kind] of [["back", "jpg"], ["table", "jpg"], ["mid", "png"], ["front", "png"]]) {
        expect(fs.existsSync(path.join(ROOT, "assets/home/cards", `${FILES[genre]}-${layer}.${kind}`))).toBe(true);
      }
      // The wall reaches the bleed past every edge of the card.
      expect(place.back).toEqual([-CARDS.bleed, -CARDS.bleed, cw + 2 * CARDS.bleed, ch + 2 * CARDS.bleed]);
      // The table runs across the whole card and off its foot, and starts about where the words' plate ends: half way down.
      const [x, y, w, h] = place.table;
      expect(x).toBeLessThanOrEqual(-CARDS.bleed + 1);
      expect(x + w).toBeGreaterThanOrEqual(cw + CARDS.bleed - 1);
      expect(y + h).toBeGreaterThanOrEqual(ch + CARDS.bleed - 1);
      expect(y).toBeGreaterThan(ch * 0.4);
      expect(y).toBeLessThan(ch * 0.55);
      // What stands up past the table's far edge lies over the table's first rows (no seam between the two pictures).
      expect(place.mid[1]).toBeLessThan(y);
      expect(place.mid[1] + place.mid[3]).toBeGreaterThan(y);
      // The nearest thing lies in the card's lower half.
      expect(place.front[1] + place.front[3]).toBeGreaterThan(ch * 0.8);
    }
  });

  it("slides inside its bleed: the wall with the eye, the table barely, the nearest thing against it", () => {
    const D = SCENE.depth;
    expect(D.back).toBeGreaterThan(D.mid);
    expect(D.mid).toBeGreaterThanOrEqual(0);
    expect(D.front).toBeLessThan(0);
    for (const depth of Object.values(D)) expect(Math.abs(depth)).toBeLessThanOrEqual(CARDS.bleed - 2);
  });

  it("covers the card from its top at every size a card takes, even slid as far as it goes", () => {
    for (const genre of GENRES) {
      for (const [w, h] of [[358, 250], [343, 146], [398, 284], [288, 126], [358, 300]]) {
        const back = sceneBox(genre, "back", w, h);
        const slideX = SCENE.depth.back, slideY = SCENE.depth.back * PARALLAX.vertical;
        expect(back.left + slideX).toBeLessThanOrEqual(0);
        expect(back.left + back.width - slideX).toBeGreaterThanOrEqual(w);
        expect(back.top + slideY).toBeLessThanOrEqual(0);
        expect(back.top + back.height - slideY).toBeGreaterThanOrEqual(h);
        // From the top: the table's far edge keeps its place under the words whatever the card's height.
        const table = sceneBox(genre, "table", w, h);
        const k = Math.max(w / CARDS.card[0], h / CARDS.card[1]);
        expect(table.top).toBeCloseTo(CARDS.modes[FILES[genre]].table[1] * k, 6);
        expect(table.top + table.height - SCENE.depth.mid * PARALLAX.vertical).toBeGreaterThanOrEqual(h);
      }
    }
  });

  it("draws the three layers once it knows its frame, hidden from the screen reader; still without a tilt", async () => {
    await render(<ModeScene genre="noir" testID="scene" style={{ width: 358, height: 250 }} />);
    const frame = screen.getByTestId("scene", hidden);
    expect(frame.props.accessibilityElementsHidden).toBe(true);
    expect(frame.props.pointerEvents).toBe("none");
    expect(screen.queryByTestId("scene-back", hidden)).toBeNull();
    await fireEvent(frame, "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 358, height: 250 } } });
    for (const layer of ["back", "mid", "front"]) expect(screen.getByTestId(`scene-${layer}`, hidden)).toBeTruthy();
    expect(StyleSheet.flatten(frame.props.style).overflow).toBe("hidden");
    // No tilt: plain views, nothing animated.
    expect(StyleSheet.flatten(screen.getByTestId("scene-back", hidden).props.style).transform).toBeUndefined();
  });
});
