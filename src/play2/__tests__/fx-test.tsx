// The little celebrations (fx/): how big a moment is, the stamped word (never
// twice in a row), the roll, where a burst's bits fly, the room's ambient
// timing, and the hook that ties them to the player's results and sounds.
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import type { ActionResult } from "@/engine/v2";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ModeScope } from "@/game/mode";
import { AMBIENT, eventAt } from "../fx/Ambient";
import { BURST, Burst, bitsFor } from "../fx/Burst";
import { ROLL_WORD, STREAK, WORDS, pickWord, streakAfter, strengthOf } from "../fx/celebrate";
import { useCelebrate } from "../fx/useCelebrate";
import { Mechanism } from "../mechanisms";
import { JUST_GAVE_MS, justGave, markTry } from "../mechanisms/kit";

jest.mock("@shopify/react-native-skia", () => {
  const base = jest.requireActual("../../../jest/skia-mock");
  const { createElement } = jest.requireActual("react");
  const host = (name: string) => (props: Record<string, unknown>) => createElement(name, props, props.children);
  return {
    ...base,
    Circle: host("SkiaCircle"), Path: host("SkiaPath"), RadialGradient: host("SkiaRadialGradient"),
    Skia: { ...base.Skia, Path: { MakeFromSVGString: (d: string) => ({ d }) } },
  };
});

const mockFeedback = { solved: jest.fn(), stamp: jest.fn(), detent: jest.fn(), press: jest.fn(), tick: jest.fn() };
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

type Node = { type: string; children?: (Node | string)[] | null };
/** How many host elements of a type the screen draws. */
function hosts(type: string): number {
  const walk = (n: Node | Node[] | string | null): number =>
    !n || typeof n === "string" ? 0 : Array.isArray(n) ? n.reduce((s, c) => s + walk(c), 0) : (n.type === type ? 1 : 0) + walk((n.children ?? []) as Node[]);
  return walk(screen.toJSON() as Node | Node[] | null);
}

const ok = (...effects: ActionResult["effects"]): ActionResult => ({ outcome: "ok", effects });

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.useRealTimers());

describe("strengthOf", () => {
  it("makes a solved step bigger than a find, and nothing new nothing", () => {
    expect(strengthOf(ok({ do: "show_card", card: "c", title: "T", text: "x" }))).toBe("find");
    expect(strengthOf(ok({ do: "grant", item: "key" }))).toBe("find");
    expect(strengthOf(ok({ do: "grant", item: "key" }, { do: "solved", step: "s1" }))).toBe("solve");
    expect(strengthOf(ok({ do: "open", object: "drawer" }))).toBeNull();
    expect(strengthOf({ outcome: "wrong", effects: [] })).toBeNull();
    expect(strengthOf(null)).toBeNull();
  });

  it("leaves the case closing to the Ending", () => {
    expect(strengthOf(ok({ do: "solved", step: "s9" }, { do: "complete", ending: "Out." }))).toBeNull();
    expect(strengthOf({ ...ok({ do: "solved", step: "s9" }), completed: true })).toBeNull();
  });
});

describe("streakAfter", () => {
  it("starts a roll at three finds inside the window, and grows to its cap", () => {
    let times: number[] = [];
    const levels: number[] = [];
    for (let i = 0; i < 6; i++) {
      const r = streakAfter(times, 1000 + i * 5000);
      times = r.times;
      levels.push(r.level);
    }
    expect(levels).toEqual([0, 0, 1, 2, 3, 3]);
  });

  it("forgets finds older than the window", () => {
    const r = streakAfter([0, 1000], 1000 + STREAK.windowMs);
    expect(r.count).toBe(1);
    expect(r.level).toBe(0);
  });
});

describe("pickWord", () => {
  it("never stamps the same word twice in a row", () => {
    for (const genre of ["noir", "crime_scene", "paranormal"] as const) {
      let last: string | null = null;
      for (let i = 0; i < 200; i++) {
        const strength = i % 3 ? "find" : "solve";
        const word = pickWord(genre, strength, last, i % 5);
        expect(word).not.toBe(last);
        expect([...WORDS[genre][strength], ROLL_WORD]).toContain(word);
        last = word;
      }
    }
  });

  it("says the roll's word as a roll starts (sometimes), never off a roll", () => {
    expect(pickWord("noir", "find", null, 1, () => 0)).toBe(ROLL_WORD);
    expect(pickWord("noir", "find", ROLL_WORD, 1, () => 0)).not.toBe(ROLL_WORD);
    expect(pickWord("noir", "find", null, 0, () => 0)).not.toBe(ROLL_WORD);
  });
});

describe("bitsFor", () => {
  const colors = { star: "a", star5: "b", spark: "c", smoke: "d", marker: "e", glint: "f", wisp: "g", moon: "h" };
  it("throws more, further, for a solved step and on a roll", () => {
    const find = bitsFor("noir", "find", 0, 1, colors);
    const solve = bitsFor("noir", "solve", 0, 1, colors);
    const roll = bitsFor("noir", "solve", 2, 1, colors);
    expect(find).toHaveLength(BURST.find.bits);
    expect(solve.length).toBeGreaterThan(find.length);
    expect(roll.length).toBe(solve.length + 2 * BURST.perLevel.bits);
  });

  it("throws each mode's own things", () => {
    const kinds = (g: "noir" | "crime_scene" | "paranormal") => new Set(Array.from({ length: 12 }, (_, s) => bitsFor(g, "solve", 0, s, colors)).flat().map((b) => b.kind));
    expect(kinds("crime_scene")).toContain("marker");
    expect(kinds("crime_scene")).not.toContain("spark");
    expect(kinds("noir")).toContain("spark");
    expect(kinds("paranormal")).toContain("moon");
    expect(kinds("paranormal")).toContain("wisp");
    expect(kinds("noir")).toContain("smoke");
  });
});

describe("eventAt", () => {
  it("is the share of the way through an event, or -1 outside it", () => {
    const [a, b] = AMBIENT.moth;
    expect(eventAt(a - 0.01, AMBIENT.moth)).toBe(-1);
    expect(eventAt(a, AMBIENT.moth)).toBeCloseTo(0);
    expect(eventAt((a + b) / 2, AMBIENT.moth)).toBeCloseTo(0.5);
    expect(eventAt(1 + a, AMBIENT.moth)).toBeCloseTo(0);
  });

  it("keeps every visitor in its own slot of the loop", () => {
    const slots = [AMBIENT.moth, AMBIENT.wisp, AMBIENT.car, AMBIENT.car2].sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < slots.length; i++) expect(slots[i][0]).toBeGreaterThanOrEqual(slots[i - 1][1]);
  });
});

describe("Burst", () => {
  it("stamps its word, framed for a solved step, with a sparkle per find on a roll", async () => {
    await render(<ModeScope genre="noir"><Burst x={10} y={10} genre="noir" strength="solve" word="Aha!" level={1} count={3} seed={4} /></ModeScope>);
    expect(screen.getByText("Aha!", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId("v2-burst-word", { includeHiddenElements: true }).props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderWidth: 2 })]));
    expect(hosts("SkiaPath")).toBeGreaterThan(0);
  });

  it("only fades its word under reduced motion: nothing flies", async () => {
    await render(<ThemeProvider reducedMotion><Burst x={0} y={0} genre="paranormal" strength="find" word="Oh!" level={0} count={1} seed={1} /></ThemeProvider>);
    expect(screen.getByText("Oh!", { includeHiddenElements: true })).toBeTruthy();
    expect(hosts("SkiaCanvas")).toBe(0);
  });
});

describe("useCelebrate", () => {
  const box = { x: 0.1, y: 0.2, w: 0.3, h: 0.2 };
  const locate = (id: string) => (id === "drawer" ? box : null);

  it("bursts on the object in view, a stamp's thump for a solved step, then clears", async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useCelebrate("noir", locate));
    await act(async () => result.current.result(ok({ do: "solved", step: "s1" }), { object: "drawer" }));
    expect(result.current.stage).toMatchObject({ strength: "solve", box, level: 0 });
    await act(async () => jest.advanceTimersByTime(400));
    expect(mockFeedback.stamp).toHaveBeenCalledTimes(1);
    expect(mockFeedback.solved).not.toHaveBeenCalled();
    await act(async () => jest.advanceTimersByTime(3000));
    expect(result.current.stage).toBeNull();
  });

  it("counts an item in a close-up only once it's picked up, and rings the roll's shimmer on the third find", async () => {
    jest.useFakeTimers();
    const { result } = await renderHook(() => useCelebrate("crime_scene", locate));
    await act(async () => result.current.result(ok({ do: "grant", item: "key" }), { object: "drawer" }, { grants: false }));
    expect(result.current.stage).toBeNull();
    await act(async () => result.current.find({ object: "drawer" }));
    await act(async () => result.current.result(ok({ do: "show_card", card: "c", title: "T", text: "x" }), { object: "drawer" }));
    await act(async () => result.current.find({ x: 40, y: 600 }));
    expect(result.current.screen).toMatchObject({ point: { x: 40, y: 600 }, level: 1, count: 3 });
    await act(async () => jest.advanceTimersByTime(400));
    expect(mockFeedback.solved).toHaveBeenCalledTimes(1);
  });

  it("draws nothing for an object out of view, and nothing without a mode", async () => {
    const { result } = await renderHook(() => useCelebrate("noir", locate));
    await act(async () => result.current.find({ object: "elsewhere" }));
    expect(result.current.stage).toBeNull();
    const none = await renderHook(() => useCelebrate(null, locate));
    await act(async () => none.result.current.find({ object: "drawer" }));
    expect(none.result.current.stage).toBeNull();
  });
});

describe("a mechanism's final click", () => {
  it("counts a mount as the moment it gave only just after the try, and only once", () => {
    markTry("object:drawer");
    expect(justGave("object:drawer")).toBe(true);
    expect(justGave("object:drawer")).toBe(false);
    markTry("object:lock");
    expect(justGave("object:lock", Date.now() + JUST_GAVE_MS + 1)).toBe(false);
    expect(justGave(undefined)).toBe(false);
  });

  it("seats a lock's wheels one by one, each with a detent, when it mounts open just after its code was tried", async () => {
    jest.useFakeTimers();
    const target = { kind: "object" as const, id: "lock", label: "Lock", archetype: "CombinationLock" as const, controls: [], submit: { kind: "wheels" as const, alphabet: "digits" as const, count: 3 } };
    const base = { target, onSet: jest.fn(), onSubmit: jest.fn(), busy: false, cooldown: 0, width: 360 };
    const first = await render(<GestureHandlerRootView><Mechanism {...base} state={{ locked: true }} /></GestureHandlerRootView>);
    await act(async () => fireEvent.press(screen.getByTestId("mech-submit")));
    first.unmount();
    await render(<GestureHandlerRootView><Mechanism {...base} state={{ open: true, locked: false }} /></GestureHandlerRootView>);
    expect(screen.getByTestId("mech-solved")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(1000));
    expect(mockFeedback.detent).toHaveBeenCalledTimes(3);
  });
});
