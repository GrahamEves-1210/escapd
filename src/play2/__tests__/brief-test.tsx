// The brief (Brief.tsx): a page of context before the case, styled per mode
// (a book's opening page, a case dossier, a moonlit note), from the room's own
// brief or the mode's opening and its objective; never the case's invented
// title, only its series line and number; Begin dismisses it, and it is
// remembered per room (useBrief): a case already under way opens on the room.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { BRIEF_PAPER, PAGE_INK } from "@/theme/payoff";
import { caseLabel } from "@/render/victory";
import { BEGIN, BRIEF_OPENING, Brief, OBJECTIVE_LABEL, briefWords, ownBrief, useBrief, withoutObjective } from "../Brief";

const OBJECTIVE = "Somebody locked you in and left the combination scattered in pieces. Find every piece and walk out through the door.";
const def = (mode: "noir" | "crime_scene" | "paranormal", brief?: unknown) => ({ mode, objective: OBJECTIVE, title: "The Long Night", ...(brief === undefined ? {} : { brief }) });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("the brief's words", () => {
  it("are the room's own brief when it has one, else the mode's opening; the objective under them", () => {
    expect(briefWords(def("noir"))).toEqual({ context: BRIEF_OPENING.noir, objective: OBJECTIVE });
    expect(briefWords(def("crime_scene", "A body at dawn. You're the detective.")).context).toBe("A body at dawn. You're the detective.");
    expect(ownBrief(def("noir", "  "))).toBeNull();
    expect(ownBrief(def("noir", ["One.", "Two."]))).toBe("One. Two.");
    expect(ownBrief(def("noir", { what: "A body.", who: "You're the detective." }))).toBe("A body. You're the detective.");
  });

  it("leave out a sentence of the brief that only says the objective again", () => {
    const brief = "Nobody has slept here for years. You've come to put it to rest. Find every piece of the combination and walk out through the door.";
    expect(withoutObjective(brief, OBJECTIVE)).toBe("Nobody has slept here for years. You've come to put it to rest.");
    // At least two sentences are kept.
    expect(withoutObjective("A body. Find every piece and walk out through the door.", OBJECTIVE)).toBe("A body. Find every piece and walk out through the door.");
  });
});

describe("Brief", () => {
  it.each(["noir", "crime_scene", "paranormal"] as const)("%s: the mode's page, the case's number (no invented title), the objective, the cat, Begin", async (mode) => {
    const onBegin = jest.fn();
    jest.useFakeTimers();
    await render(<ThemeProvider reducedMotion><Brief def={def(mode)} roomId="room-1" onBegin={onBegin} /></ThemeProvider>);
    expect(screen.getByTestId(`v2-brief-${mode}`)).toBeTruthy();
    const label = screen.getByTestId("brief-case").props.children as string;
    expect(label.toLowerCase()).toBe(caseLabel("room-1").toLowerCase());
    expect(screen.queryByText("The Long Night")).toBeNull();
    expect(screen.getByTestId("brief-objective").props.accessibilityLabel).toBe(`${OBJECTIVE_LABEL[mode]}: ${OBJECTIVE}`);
    expect(screen.getByLabelText(/^The black cat/)).toBeTruthy();
    await fireEvent.press(screen.getByText(BEGIN));
    await act(() => jest.advanceTimersByTime(400));
    expect(onBegin).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});

describe("useBrief", () => {
  const hook = (fresh: boolean, room = "r1") => renderHook(({ ready }: { ready: boolean }) => useBrief(room, { ready, fresh }), { initialProps: { ready: false } });
  const settle = () => act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

  it("is up for a fresh case once the room is ready, and stays dismissed for that room", async () => {
    const first = await hook(true);
    await settle();
    expect(first.result.current.open).toBe(false);
    await first.rerender({ ready: true });
    expect(first.result.current.open).toBe(true);
    await act(() => first.result.current.dismiss());
    expect(first.result.current.open).toBe(false);
    await settle();
    await first.unmount();

    const again = await hook(true);
    await settle();
    await again.rerender({ ready: true });
    expect(again.result.current.open).toBe(false);
    // Another room has its own.
    const other = await hook(true, "r2");
    await settle();
    await other.rerender({ ready: true });
    expect(other.result.current.open).toBe(true);
  });

  it("stays down for a case already under way, and counts as seen", async () => {
    const { result, rerender } = await hook(false);
    await settle();
    await rerender({ ready: true });
    expect(result.current.open).toBe(false);
    await settle();
    expect(await AsyncStorage.getItem("escapd.v2.brief.r1")).toBe("1");
  });
});

// Every ink on the brief's paper reads at 4.5:1 or more.
describe("Brief: contrast", () => {
  const lum = (hex: string) => {
    const n = parseInt(hex.slice(1, 7), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it("the paper's inks and the mode's page ink on each mode's paper; the folder's tab label", () => {
    for (const mode of ["noir", "crime_scene", "paranormal"] as const) {
      const P = BRIEF_PAPER[mode];
      for (const ink of [P.ink, P.muted, PAGE_INK[mode]]) expect(contrast(ink, P.paper)).toBeGreaterThanOrEqual(4.5);
      if (P.tab) expect(contrast(P.ink, P.tab)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
