import { GestureHandlerRootView } from "react-native-gesture-handler";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { Puzzle } from "@/lib/puzzle-types";
import { setMode } from "@/game/mode";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { modeThemes, motion, ref } from "@/theme/tokens";
import { CodePad, type CodeOutcome } from "../CodePad";

// Haptics with stable spies (the full shape, as jest/setup.js).
const mockFeedback = {
  tick: jest.fn(), tap: jest.fn(), press: jest.fn(), thud: jest.fn(), success: jest.fn(), warning: jest.fn(), error: jest.fn(),
  paper: jest.fn(), pickup: jest.fn(), wrongCode: jest.fn(), unlock: jest.fn(), stamp: jest.fn(), solved: jest.fn(),
  shutter: jest.fn(), typewriter: jest.fn(),
};
jest.mock("@/game/feedback", () => ({ useFeedback: () => mockFeedback }));

const J = ref.motion.juice;
const LK = ref.layout.play.codePad.lock;
const hidden = { includeHiddenElements: true } as const;

const TUMBLER: Puzzle = { id: "open_safe", kind: "code", hotspot_id: "safe", title: "The safe", answer_format: { kind: "digits", length: 4 } };
const KEYPAD: Puzzle = { id: "phone", kind: "code", hotspot_id: "phone", answer_format: { kind: "digits" } };

type Animated = { opacity?: number; transform?: Record<string, number | string>[] };
/** Reanimated's Jest copy of a view's animated style. */
const animated = (testID: string): Animated =>
  (screen.getByTestId(testID, hidden).props.jestAnimatedStyle as { value?: Animated } | undefined)?.value ?? {};
const transformOf = (testID: string, key: string) => {
  const entry = animated(testID).transform?.find((t) => key in t);
  return entry ? entry[key] : undefined;
};
const translateX = () => Number(transformOf("code-pad", "translateX") ?? 0);
const shackleY = () => Number(transformOf("code-lock-shackle", "translateY") ?? 0);

async function renderPad(onSubmit: (answer: string) => Promise<CodeOutcome>, { reducedMotion = false, puzzle = TUMBLER } = {}) {
  return render(
    <GestureHandlerRootView>
      <ThemeProvider reducedMotion={reducedMotion}>
        <CodePad puzzle={puzzle} items={[]} onSubmit={onSubmit} />
      </ThemeProvider>
    </GestureHandlerRootView>,
  );
}

const advance = (ms: number) => act(async () => {
  jest.advanceTimersByTime(ms);
});
const submit = () => act(async () => {
  fireEvent.press(screen.getByTestId("code-submit"));
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  setMode("noir");
});
afterEach(() => {
  jest.useRealTimers();
  setMode(null);
});

describe("CodePad: a wrong code", () => {
  it("gives wrongCode, rattles the pad side to side and lets it come to rest", async () => {
    await renderPad(async () => ({ kind: "wrong", message: "Nothing happens." }));
    await submit();
    expect(mockFeedback.wrongCode).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Nothing happens.")).toBeTruthy();
    // Partway through, the pad is off centre; it swings both ways.
    const seen = new Set<number>();
    for (let t = 0; t < J.rattle.duration; t += J.rattle.duration / 12) {
      await advance(J.rattle.duration / 12);
      seen.add(Math.sign(Math.round(translateX())));
    }
    expect(seen.has(1) && seen.has(-1)).toBe(true);
    await advance(J.rattle.duration);
    expect(translateX()).toBeCloseTo(0, 5);
    expect(Math.abs(translateX())).toBeLessThanOrEqual(J.rattle.distance);
  });

  it("under reduced motion doesn't move: the pad dims and comes back, and the haptic stays", async () => {
    await renderPad(async () => ({ kind: "wrong", message: "Nothing happens." }), { reducedMotion: true });
    await submit();
    expect(mockFeedback.wrongCode).toHaveBeenCalledTimes(1);
    await advance(motion.reducedFade / 2);
    expect(translateX()).toBe(0);
    expect(animated("code-pad").opacity).toBeLessThan(1);
    await advance(motion.reducedFade * 2);
    expect(translateX()).toBe(0);
    expect(animated("code-pad").opacity).toBeCloseTo(1, 5);
  });

  it("a keypad code rattles the same way", async () => {
    await renderPad(async () => ({ kind: "wrong", message: "Wrong number." }), { puzzle: KEYPAD });
    await fireEvent(screen.getByTestId("key-4"), "pressIn");
    expect(mockFeedback.press).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByTestId("key-4"));
    await submit();
    expect(mockFeedback.wrongCode).toHaveBeenCalledTimes(1);
    await advance(J.rattle.duration / 6);
    expect(Math.abs(translateX())).toBeGreaterThan(0);
  });
});

describe("CodePad: a correct code", () => {
  it("gives unlock, opens the lock, and only then runs proceed", async () => {
    const proceed = jest.fn();
    await renderPad(async () => ({ kind: "solved", proceed }));
    await submit();
    expect(mockFeedback.unlock).toHaveBeenCalledTimes(1);
    expect(mockFeedback.wrongCode).not.toHaveBeenCalled();
    // The shackle is on its way up; the flow waits.
    await advance(J.latch.lift / 2);
    expect(shackleY()).toBeLessThan(0);
    expect(proceed).not.toHaveBeenCalled();
    await advance(J.latch.hold - J.latch.lift / 2 - 1);
    expect(proceed).not.toHaveBeenCalled();
    // Open: lifted clear and swung, the ring lit.
    expect(shackleY()).toBeCloseTo(-LK.room, 3);
    expect(transformOf("code-lock-shackle", "rotate")).toBe(`${J.latch.swing}deg`);
    expect(animated("code-ring").opacity).toBeCloseTo(1, 3);
    await advance(1);
    expect(proceed).toHaveBeenCalledTimes(1);
    // Spent: the button stays busy, with no indicator over the latch.
    expect(screen.getByTestId("code-submit").props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId("code-submit-spinner")).toBeNull();
  });

  it("under reduced motion nothing slides: the lock fades open and proceed runs within 150 ms", async () => {
    const proceed = jest.fn();
    await renderPad(async () => ({ kind: "solved", proceed }), { reducedMotion: true });
    await submit();
    expect(mockFeedback.unlock).toHaveBeenCalledTimes(1);
    await advance(motion.reducedFade);
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(motion.reducedFade).toBeLessThanOrEqual(150);
    expect(shackleY()).toBe(0);
    expect(animated("code-lock-open").opacity).toBeCloseTo(1, 3);
    expect(animated("code-ring").opacity).toBeCloseTo(1, 3);
  });

  it("closed before the latch finishes, the flow still goes on at once", async () => {
    const proceed = jest.fn();
    const view = await renderPad(async () => ({ kind: "solved", proceed }));
    await submit();
    expect(proceed).not.toHaveBeenCalled();
    await act(async () => view.unmount());
    expect(proceed).toHaveBeenCalledTimes(1);
    await advance(J.latch.hold * 2);
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it("the lock and its ring wear the mode's accent", async () => {
    setMode("crime_scene");
    await renderPad(async () => ({ kind: "solved" }));
    expect(screen.getByTestId("code-ring", hidden)).toHaveStyle({ borderColor: modeThemes.crime_scene.accent });
    expect(screen.getByTestId("code-lock-shackle", hidden)).toHaveStyle({ borderColor: modeThemes.crime_scene.accent });
  });
});

describe("CodeWheel: the roll", () => {
  it("each step is one tick, and the wheel seats on the digit after its detent", async () => {
    await renderPad(async () => ({ kind: "wrong", message: "x" }));
    await fireEvent.press(screen.getByTestId("tumbler-0-next", hidden));
    await fireEvent.press(screen.getByTestId("tumbler-0-next", hidden));
    expect(mockFeedback.tick).toHaveBeenCalledTimes(2);
    await advance(1000);
    expect(screen.getByTestId("tumbler-0").props.accessibilityValue).toEqual({ text: "2" });
  });
});
