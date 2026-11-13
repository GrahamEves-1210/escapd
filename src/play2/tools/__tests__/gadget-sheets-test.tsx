// The music box and the typewriter ribbon open on their own sheets (TuneSheet, RibbonSheet: canvases, stood in for
// here) from Reveal, with the card's text whole, nothing said about it, and the same screen-reader contract as
// the other sheets.
import { act, render, screen } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { HINT_AFTER_MS, Reveal } from "../Reveal";
import type { SheetProps } from "../sheet";

const sheets: Record<string, SheetProps> = {};
jest.mock("../TuneSheet", () => ({ TuneSheet: (props: SheetProps) => ((sheets.tune = props), null) }));
jest.mock("../RibbonSheet", () => ({ RibbonSheet: (props: SheetProps) => ((sheets.ribbon = props), null) }));

const open = (kind: "tune" | "ribbon", title: string, text: string) =>
  render(
    <GestureHandlerRootView>
      <Reveal kind={kind} title={title} text={text} onClose={jest.fn()} />
    </GestureHandlerRootView>,
  );

describe.each([
  ["tune", "Music box tune", "◆ ★ ▲ ●", /turn its crank/],
  ["ribbon", "Typed line", "Never the first: what holds the light.", /pull the ribbon/],
] as const)("the %s sheet", (kind, title, text, how) => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is handed the card's text whole, and says how it's read only to a screen reader", async () => {
    await open(kind, title, text);
    expect(screen.getByTestId(`v2-reveal-${kind}`)).toBeTruthy();
    expect(sheets[kind].text).toBe(text);
    expect(sheets[kind].labels.label).toMatch(how);
    expect(sheets[kind].labels.label.startsWith(`${title}: `)).toBe(true);
    // Nothing on the screen narrates it: no hint yet, no caption, not the card's words.
    expect(screen.queryByTestId("v2-reveal-hint")).toBeNull();
    expect(screen.queryByText(text)).toBeNull();
    expect(screen.queryByText(/./)).toBeNull();
  });

  it("a hint only after it's been left alone a while; none once it's read, and then the label is what it says", async () => {
    await open(kind, title, text);
    await act(async () => jest.advanceTimersByTime(HINT_AFTER_MS + 50));
    expect(screen.getByTestId("v2-reveal-hint")).toBeTruthy();
    await act(async () => sheets[kind].onRead());
    expect(screen.queryByTestId("v2-reveal-hint")).toBeNull();
    expect(sheets[kind].labels.label).toBe(`${title}: ${text}`);
    expect(sheets[kind].done).toBe(true);
    expect(screen.getByTestId("v2-reveal-close").props.accessibilityLabel).toBe("Done");
  });
});
