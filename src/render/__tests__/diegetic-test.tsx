// The diegetic play screen's parts on their own (GAME_FEEL_PROMPT.md, 4):
// the case clock, the idle glint, the pickup's flight, the clue objects and
// the informant's ladder. The player wires them together in play-screen-test.
import { StyleSheet } from "react-native";
import { act, render, renderHook, screen } from "@testing-library/react-native";
import type { HintResult, Hotspot } from "@/lib/puzzle-types";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { CaseClock, formatClock, spokenClock } from "../CaseClock";
import { polaroidCrop } from "../ClueObjects";
import { HotspotLayer } from "../HotspotLayer";
import { glintTargets, useIdle } from "../idle";
import { EMPTY_LADDER, INFORMANTS, isDry, ladderFrom, nextLadder, visibleLadder } from "../informantLadder";
import { cluePaper, evidenceMaterial, tornEdge } from "../materials";
import { aspectOf } from "../geometry";
import { PickupFlight, finiteRect, flightPoint, flightRects, landingScale, measureInWindow } from "../PickupFlight";

jest.mock("@/lib/supabase", () => ({ supabase: { rpc: jest.fn() } }));

const P = ref.layout.play;

afterEach(() => {
  jest.useRealTimers();
});

describe("the case clock", () => {
  it("formats elapsed time as a clock, and says it in words", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_400)).toBe("1:05");
    expect(formatClock(12 * 60_000 + 30_000)).toBe("12:30");
    expect(formatClock(3_729_000)).toBe("1:02:09");
    expect(formatClock(-5_000)).toBe("0:00");
    expect(spokenClock(65_000)).toBe("On the case for 1 minute 5 seconds");
    expect(spokenClock(3_720_000)).toBe("On the case for 1 hour 2 minutes");
  });

  it("ticks once a second from its start, in the mono plate label", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-26T12:00:00Z") });
    const since = Date.now() - 65_000;
    await render(<CaseClock since={since} />);
    const clock = screen.getByTestId("case-clock");
    expect(clock.props.children).toBe("1:05");
    expect(clock.props.accessibilityRole).toBe("timer");
    expect(StyleSheet.flatten(clock.props.style)).toMatchObject({ fontFamily: P.type.clock.fontFamily });
    await act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId("case-clock").props.children).toBe("1:06");
    await act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByTestId("case-clock").props.children).toBe("2:06");
  });
});

const spot = (id: string, x = 0.1): Hotspot => ({
  id, photo_index: 0, shape: { x, y: 0.1, w: 0.2, h: 0.2 }, name: id, object_label: "drawer", description: "",
} as unknown as Hotspot);

describe("the idle glint", () => {
  it("picks only visible hotspots not yet solved or tapped", () => {
    const visible = [spot("a"), spot("b"), spot("c")];
    expect(glintTargets(visible, new Set(["a"]), new Set(["b"]))).toEqual(["c"]);
    // Every open one tapped: the unsolved ones (the check seal already marks the rest).
    expect(glintTargets(visible, new Set(["a"]), new Set(["b", "c"]))).toEqual(["b", "c"]);
    // A hidden hotspot is never in the visible set, so it can never glint.
    expect(glintTargets([], new Set(), new Set())).toEqual([]);
  });

  it("fires only after the idle spell, restarts on a touch, and holds off while disabled", async () => {
    jest.useFakeTimers();
    const { result, rerender } = await renderHook(({ enabled }: { enabled: boolean }) => useIdle(P.glint.idle, enabled), { initialProps: { enabled: true } });
    expect(result.current.idleKey).toBeNull();
    await act(() => jest.advanceTimersByTime(P.glint.idle - 1000));
    expect(result.current.idleKey).toBeNull();
    await act(() => result.current.touch());
    await act(() => jest.advanceTimersByTime(P.glint.idle - 1000));
    expect(result.current.idleKey).toBeNull();
    await act(() => jest.advanceTimersByTime(1000));
    expect(result.current.idleKey).not.toBeNull();
    // A touch ends the glint.
    await act(() => result.current.touch());
    expect(result.current.idleKey).toBeNull();
    // A sheet up: no glint however long it waits.
    await rerender({ enabled: false });
    await act(() => jest.advanceTimersByTime(P.glint.idle * 3));
    expect(result.current.idleKey).toBeNull();
  });

  const layer = (glint?: { key: number; ids: string[] }) => (
    <HotspotLayer
      hotspots={[spot("drawer", 0.1), spot("shelf", 0.5)]}
      stage={{ width: 300, height: 400 }}
      persistent={false}
      labelFor={(h) => h.id}
      onPress={jest.fn()}
      glint={glint}
    />
  );

  it("pulses only the hotspots it is given, and nothing without a glint", async () => {
    await render(layer());
    expect(screen.queryByTestId("glint-drawer", { includeHiddenElements: true })).toBeNull();
    await render(layer({ key: 1, ids: ["shelf"] }));
    expect(screen.getByTestId("glint-shelf", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId("glint-drawer", { includeHiddenElements: true })).toBeNull();
  });

  it("holds a still, faint mark under reduced motion", async () => {
    await render(<ThemeProvider reducedMotion>{layer({ key: 1, ids: ["drawer"] })}</ThemeProvider>);
    expect(screen.getByTestId("glint-drawer", { includeHiddenElements: true })).toHaveAnimatedStyle({ opacity: P.glint.rest });
  });
});

describe("the pickup's flight", () => {
  const from = { x: 100, y: 100, width: 60, height: 40 };
  const to = { x: 20, y: 700, width: 80, height: 72 };

  it("starts on the object, lands on the slot, and arcs above the straight line", () => {
    expect(flightPoint(from, to, 0)).toEqual({ x: 130, y: 120 });
    expect(flightPoint(from, to, 1)).toEqual({ x: 60, y: 736 });
    const mid = flightPoint(from, to, 0.5);
    expect(mid.x).toBe(95);
    expect(mid.y).toBe((120 + 736) / 2 - P.pickup.arc);
  });

  it("measures in window coordinates, and gives up on a node that never answers", async () => {
    jest.useFakeTimers();
    const answers = { measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(1, 2, 30, 40) };
    await expect(measureInWindow(answers)).resolves.toEqual({ x: 1, y: 2, width: 30, height: 40 });
    const silent = measureInWindow({ measureInWindow: () => {} });
    jest.advanceTimersByTime(P.pickup.measureTimeout);
    await expect(silent).resolves.toBeNull();
    await expect(measureInWindow(null)).resolves.toBeNull();
  });

  it("lands after its flight", async () => {
    jest.useFakeTimers();
    const onLanded = jest.fn();
    const flight = { key: 7, item: { id: "brass_key", name: "Brass key" }, from, to };
    await render(<PickupFlight flight={flight as never} onLanded={onLanded} />);
    expect(screen.getByTestId("pickup-flight-brass_key", { includeHiddenElements: true })).toBeTruthy();
    await act(() => jest.advanceTimersByTime(P.pickup.flight - 1));
    expect(onLanded).not.toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(1));
    expect(onLanded).toHaveBeenCalledWith(7);
    // The animation's end and the fallback timer both report: it lands once.
    await act(() => jest.advanceTimersByTime(P.pickup.flight + P.pickup.landSlack + 100));
    expect(onLanded).toHaveBeenCalledTimes(1);
  });

  it("never lands once it has unmounted mid-flight", async () => {
    jest.useFakeTimers();
    const onLanded = jest.fn();
    const flight = { key: 8, item: { id: "brass_key", name: "Brass key" }, from, to };
    const view = await render(<PickupFlight flight={flight as never} onLanded={onLanded} />);
    await act(() => jest.advanceTimersByTime(P.pickup.flight / 2));
    await view.unmount();
    await act(() => jest.advanceTimersByTime(P.pickup.flight + P.pickup.landSlack + 100));
    expect(onLanded).not.toHaveBeenCalled();
  });

  it("only ever measures a finite box with a size: NaN, Infinity or nothing is no box", async () => {
    const answer = (...box: number[]) => ({
      measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(box[0], box[1], box[2], box[3]),
    });
    await expect(measureInWindow(answer(NaN, 2, 30, 40))).resolves.toBeNull();
    await expect(measureInWindow(answer(1, 2, Infinity, 40))).resolves.toBeNull();
    await expect(measureInWindow(answer(1, 2, 30, NaN))).resolves.toBeNull();
    await expect(measureInWindow(answer(0, 0, 0, 0))).resolves.toBeNull();
    await expect(measureInWindow({ measureInWindow: () => {
      throw new Error("unmounted");
    } })).resolves.toBeNull();
    await expect(measureInWindow({} as never)).resolves.toBeNull();
    expect(finiteRect(1, 2, 3, 4)).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    expect(finiteRect(1, 2, 3, -4)).toBeNull();
  });

  it("answers once: a late answer after the timeout changes nothing", async () => {
    jest.useFakeTimers();
    let late: ((x: number, y: number, w: number, h: number) => void) | null = null;
    const result = measureInWindow({ measureInWindow: (cb) => {
      late = cb;
    } });
    jest.advanceTimersByTime(P.pickup.measureTimeout);
    late!(1, 2, 30, 40);
    await expect(result).resolves.toBeNull();
  });

  it("flies only between finite boxes, in the overlay's coordinates", () => {
    const root = { x: 0, y: 50, width: 393, height: 800 };
    expect(flightRects(root, from, to)).toEqual({
      from: { x: 100, y: 50, width: 60, height: 40 },
      to: { x: 20, y: 650, width: 80, height: 72 },
    });
    expect(flightRects(null, from, to)).toBeNull();
    expect(flightRects(root, null, to)).toBeNull();
    expect(flightRects(root, from, null)).toBeNull();
    expect(flightRects({ ...root, x: NaN }, from, to)).toBeNull();
    expect(flightRects(root, { ...from, y: Infinity }, to)).toBeNull();
  });

  it("lands at the slot's size, never larger, and never at a non-finite scale", () => {
    expect(landingScale({ x: 0, y: 0, width: 22, height: 30 }, 44)).toBe(0.5);
    expect(landingScale({ x: 0, y: 0, width: 88, height: 88 }, 44)).toBe(1);
    expect(landingScale({ x: 0, y: 0, width: NaN, height: 88 }, 44)).toBe(1);
    expect(landingScale({ x: 0, y: 0, width: 22, height: 30 }, 0)).toBe(1);
  });
});

describe("clue objects and materials", () => {
  it("crops a polaroid to the object, never past the photo's edges", () => {
    // A 3:4 photo, the object a fifth of it across, in a 92 pt square window.
    const crop = polaroidCrop({ x: 0.4, y: 0.4, w: 0.2, h: 0.15 }, 0.75, { width: 92, height: 92 });
    // The object covers the window: its width and height both reach 92.
    expect(0.2 * crop.width).toBeGreaterThanOrEqual(92 - 1e-9);
    expect(0.15 * crop.height).toBeGreaterThanOrEqual(92 - 1e-9);
    // Centred on it.
    expect(crop.left + 0.5 * crop.width).toBeCloseTo(46);
    expect(crop.top + 0.475 * crop.height).toBeCloseTo(46);
    // An object at the corner: clamped so no void shows.
    const corner = polaroidCrop({ x: 0, y: 0, w: 0.2, h: 0.2 }, 0.75, { width: 92, height: 92 });
    expect(corner.left).toBe(0);
    expect(corner.top).toBeLessThanOrEqual(0);
    expect(corner.top).toBeGreaterThanOrEqual(92 - corner.height);
    // Anywhere on the photo, any size: the window stays on the photo.
    for (const shape of [{ x: 0.8, y: 0.9, w: 0.2, h: 0.1 }, { x: 0, y: 0, w: 1, h: 1 }, { x: 0.95, y: 0.95, w: 0.05, h: 0.05 }]) {
      const c = polaroidCrop(shape, 0.75, { width: 92, height: 92 });
      expect(c.left).toBeLessThanOrEqual(0);
      expect(c.top).toBeLessThanOrEqual(0);
      expect(c.left + c.width).toBeGreaterThanOrEqual(92 - 1e-9);
      expect(c.top + c.height).toBeGreaterThanOrEqual(92 - 1e-9);
    }
  });

  it("never crops to NaN or Infinity, whatever the photo or shape reports", () => {
    const box = { width: 92, height: 92 };
    for (const aspect of [NaN, Infinity, 0, -1]) {
      const c = polaroidCrop({ x: 0.4, y: 0.4, w: 0.2, h: 0.15 }, aspect, box);
      for (const v of Object.values(c)) expect(Number.isFinite(v)).toBe(true);
    }
    const c = polaroidCrop({ x: NaN, y: Infinity, w: NaN, h: 0 }, 0.75, box);
    for (const v of Object.values(c)) expect(Number.isFinite(v)).toBe(true);
    // A photo's size: only finite and positive makes an aspect.
    expect(aspectOf(1200, 1600)).toBe(0.75);
    expect(aspectOf(0, 0)).toBeNull();
    expect(aspectOf(1200, 0)).toBeNull();
    expect(aspectOf(NaN, 1600)).toBeNull();
    expect(aspectOf(undefined, 1600)).toBeNull();
  });

  it("tears each note the same way every time", () => {
    expect(tornEdge("The desk drawer", 6)).toBe(tornEdge("The desk drawer", 6));
    expect(tornEdge("The desk drawer", 6)).not.toBe(tornEdge("The rug", 6));
  });

  it("keeps every mode's materials in its own palette, and never green", () => {
    const hue = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max === min) return null;
      const h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
      return (h * 60 + 360) % 360;
    };
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      const all = [...Object.values(evidenceMaterial(genre)), ...Object.values(cluePaper(genre))].filter((c) => c.startsWith("#"));
      for (const c of all) {
        const h = hue(c);
        // Green and mint live between about 75 and 170 degrees.
        if (h !== null) expect(h < 75 || h > 170).toBe(true);
      }
    }
    // Shell (no mode) falls back to noir's.
    expect(evidenceMaterial(null)).toBe(evidenceMaterial("noir"));
  });
});

describe("the informant's ladder", () => {
  const ok = (rung: number, hint: string, puzzle = "find_key"): HintResult => ({
    status: "ok", puzzle_id: puzzle, rung, total_rungs: 3, hint, already_revealed: false, hints_used: rung,
  });

  it("starts from the session row, and hides a ladder whose step is solved", () => {
    const ladder = ladderFrom({ puzzle_id: "find_key", rungs: ["The drawer sticks."] });
    expect(ladder.rungs).toEqual(["The drawer sticks."]);
    expect(visibleLadder(ladder, [])).toBe(ladder);
    expect(visibleLadder(ladder, ["find_key"])).toEqual(EMPTY_LADDER);
    expect(ladderFrom({})).toEqual(EMPTY_LADDER);
  });

  it("keeps the server's rungs in order, verbatim, and starts over on a new step", () => {
    let l = nextLadder(EMPTY_LADDER, ok(1, "Try the desk."));
    l = nextLadder(l, ok(2, "The drawer, left side."));
    expect(l).toMatchObject({ puzzleId: "find_key", rungs: ["Try the desk.", "The drawer, left side."], total: 3 });
    expect(isDry(l)).toBe(false);
    l = nextLadder(l, ok(3, "Pull the drawer."));
    expect(isDry(l)).toBe(true);
    expect(nextLadder(l, ok(1, "Look at the shelf.", "find_note_left")).rungs).toEqual(["Look at the shelf."]);
    // Out of rungs: dry.
    const dry = nextLadder(EMPTY_LADDER, {
      status: "rung_unavailable", puzzle_id: "find_key", rung: 4, next_rung: null, total_rungs: 3, hints_used: 3, message: "Hints open one rung at a time.",
    });
    expect(isDry(dry)).toBe(true);
  });

  it("gives each mode its own informant", () => {
    expect(INFORMANTS.noir.ask).toBe("Ask the informant");
    expect(INFORMANTS.crime_scene.ask).toBe("Ask the beat cop");
    expect(INFORMANTS.paranormal.ask).toBe("Ask the medium");
  });
});

// Reanimated's matcher (jest/setup.js runs its setUpTests).
declare global {
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
    interface Matchers<R, T = {}> {
      toHaveAnimatedStyle(style: Record<string, unknown>, config?: { shouldMatchAllProps?: boolean }): R;
    }
  }
}
