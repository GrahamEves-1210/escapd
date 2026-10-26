/// <reference types="node" />
import fs from "fs";
import path from "path";
import type { ReactElement } from "react";
import { Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { radius, ref } from "@/theme/tokens";
import { FocusRing, focusRingStyle, gradientLine, PillButton, ThinkingStates, trackingPad } from "..";

const ROOT = path.join(__dirname, "../../../..");
const PERIOD = ref.motion.thinking.gap + ref.motion.thinking.swap + ref.motion.thinking.hold;
const hidden = { includeHiddenElements: true } as const;

function renderReduced(ui: ReactElement) {
  return render(<ThemeProvider reducedMotion>{ui}</ThemeProvider>);
}

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

type Json = { type: string; props: Record<string, unknown>; children: Json[] | null } | string;

/** Host views in the rendered tree whose flattened style matches `match`. */
function viewsWhere(match: (style: Record<string, unknown>) => boolean) {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as Exclude<Json, string>;
    const style = StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined;
    if (n.type === "View" && style && match(style)) found.push(style);
    n.children?.forEach(walk);
  };
  walk(screen.toJSON());
  return found;
}

describe("tokens", () => {
  it("system-font styles set a weight and no family; named faces set a family and no weight", () => {
    const named: string[] = Object.values(ref.font);
    for (const [name, style] of Object.entries(ref.type) as [string, Record<string, unknown>][]) {
      if ("fontFamily" in style) {
        expect({ name, named: named.includes(style.fontFamily as string) }).toEqual({ name, named: true });
        expect({ name, fontWeight: style.fontWeight }).toEqual({ name, fontWeight: undefined });
      } else {
        expect({ name, fontWeight: typeof style.fontWeight }).toEqual({ name, fontWeight: "string" });
      }
    }
  });

  it("app/_layout.tsx loads every ref.font face", () => {
    const layout = fs.readFileSync(path.join(ROOT, "app/_layout.tsx"), "utf8");
    for (const face of Object.values(ref.font)) expect(layout).toMatch(new RegExp(`^\\s*${face},$`, "m"));
  });

  it("the focus ring stays brass", () => {
    expect(ref.focus).toEqual({ width: 2, offset: 2, color: "#C89D54" });
  });
});

describe("PillButton", () => {
  it.each(["primary", "ghost", "quiet"] as const)("renders %s as a labelled button that presses", async (variant) => {
    const onPress = jest.fn();
    await render(<PillButton label="Open the camera" variant={variant} onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Open the camera" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(styleOf(button).minHeight).toBe(ref.button[variant].height);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("pads the 64 pt primary and the 52 pt ghost to their height, a quiet button not at all", async () => {
    await render(
      <>
        <PillButton label="Allow the camera" />
        <PillButton label="Next" variant="ghost" />
        <PillButton label="Not now" variant="quiet" />
      </>,
    );
    const pad = (name: string) => styleOf(screen.getByRole("button", { name })).paddingVertical;
    expect(pad("Allow the camera")).toBe((ref.button.primary.height - ref.type.ctaLabel.lineHeight) / 2);
    expect(pad("Next")).toBe((ref.button.ghost.height - ref.type.headline.lineHeight) / 2);
    expect(pad("Not now")).toBe(0);
  });

  it("filled pills stretch to the content width; a quiet button hugs its label", async () => {
    await render(
      <>
        <PillButton label="Allow the camera" />
        <PillButton label="Not now" variant="quiet" />
      </>,
    );
    expect(styleOf(screen.getByRole("button", { name: "Allow the camera" })).alignSelf).toBe("stretch");
    expect(styleOf(screen.getByRole("button", { name: "Not now" }))).toMatchObject({ alignSelf: "center", paddingHorizontal: ref.button.quiet.padX });
  });

  it("the ghost pill draws its solid 1 pt hairline; the primary pill has no edge", async () => {
    await render(<PillButton label="Next" variant="ghost" />);
    expect(viewsWhere((s) => s.borderColor === ref.button.ghost.border && s.borderWidth === 1)).toHaveLength(1);
    await render(<PillButton label="Allow the camera" />);
    expect(viewsWhere((s) => s.borderWidth !== undefined)).toHaveLength(0);
  });

  it("dims to disabledOpacity.pill and ignores presses when disabled", async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Not now" variant="quiet" disabled onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Not now" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(styleOf(button).opacity).toBe(ref.button.disabledOpacity.pill);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps its label and full opacity, shows the indicator and ignores taps while busy", async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Unlock Pro" busy spinner onPress={onPress} testID="unlock" />);
    const button = screen.getByRole("button", { name: "Unlock Pro" });
    expect(screen.getByText("Unlock Pro")).toBeTruthy();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(styleOf(button).opacity).toBeUndefined();
    // 16 + 20 + 8 reserved on both sides so the label never shifts.
    expect(styleOf(button).paddingHorizontal).toBe(ref.space.lg + ref.icon.header + ref.space.sm);
    expect(screen.getByTestId("unlock-spinner", hidden).props.color).toBe(ref.button.primary.label);
    // A real tap through the Pressable (fireEvent would call the composite's own onPress prop).
    await userEvent.setup().press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows no indicator when busy without spinner", async () => {
    await render(<PillButton label="Allow the camera" busy testID="allow" />);
    expect(screen.getByRole("button", { name: "Allow the camera" }).props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId("allow-spinner", hidden)).toBeNull();
  });

  it("a quiet button on dark takes the dark label colour", async () => {
    await render(<PillButton label="Not now" variant="quiet" ground="dark" busy spinner testID="later" />);
    expect(screen.getByTestId("later-spinner", hidden).props.color).toBe(ref.button.quiet.dark.label);
  });

  it("shows the brass pill ring while focused", async () => {
    await render(<PillButton label="Next" variant="ghost" />);
    const ring = (s: Record<string, unknown>) => s.borderColor === ref.focus.color;
    expect(viewsWhere(ring)).toHaveLength(0);
    await fireEvent(screen.getByRole("button", { name: "Next" }), "focus", { nativeEvent: {} });
    expect(viewsWhere(ring)).toEqual([expect.objectContaining({ borderWidth: ref.focus.width, borderRadius: ref.radius.round })]);
    await fireEvent(screen.getByRole("button", { name: "Next" }), "blur", { nativeEvent: {} });
    expect(viewsWhere(ring)).toHaveLength(0);
  });
});

describe("focus ring", () => {
  const out = ref.focus.offset + ref.focus.width;

  it("follows the control's shape, concentric with its corners", () => {
    expect(focusRingStyle("pill")).toMatchObject({ top: -out, borderRadius: ref.radius.round, borderColor: ref.focus.color });
    expect(focusRingStyle("control").borderRadius).toBe(radius.control + out);
    expect(focusRingStyle("panel").borderRadius).toBe(ref.radius.sheet + out);
    expect(focusRingStyle("panel", ref.radius.square).borderRadius).toBe(ref.radius.square + out);
  });

  it("FocusRing takes the control's radius and border width", async () => {
    await render(<FocusRing visible shape="panel" radius={ref.radius.frame} edge={1} />);
    expect(viewsWhere((s) => s.borderColor === ref.focus.color)).toEqual([
      expect.objectContaining({ top: -out - 1, borderRadius: ref.radius.frame + out + 1 }),
    ]);
  });
});

describe("helpers", () => {
  it("gradientLine follows CSS angles, corners on 0 and 1", () => {
    expect(gradientLine(180)).toEqual({ x1: 0.5, y1: 0, x2: 0.5, y2: 1 });
    expect(gradientLine(90)).toEqual({ x1: 0, y1: 0.5, x2: 1, y2: 0.5 });
    expect(gradientLine(135)).toEqual({ x1: 0, y1: 0, x2: 1, y2: 1 });
    expect(gradientLine(225)).toEqual({ x1: 1, y1: 0, x2: 0, y2: 1 });
    // In user space on a 122 x 209 card, top to bottom.
    expect(gradientLine(180, 122, 209)).toEqual({ x1: 61, y1: 0, x2: 61, y2: 209 });
  });

  it("trackingPad pads tracked text on iOS only", () => {
    const platform = jest.replaceProperty(Platform, "OS", "ios");
    expect(trackingPad(ref.type.counter)).toEqual({ paddingLeft: ref.type.counter.letterSpacing });
    expect(trackingPad(ref.type.meta)).toBeNull();
    platform.replaceValue("android");
    expect(trackingPad(ref.type.counter)).toBeNull();
    platform.restore();
  });
});

describe("ThinkingStates", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const lineIn = (color: string) => (text: string) => screen.queryAllByText(text, hidden).filter((node) => styleOf(node).color === color);
  const visibleLine = lineIn(ref.motion.thinking.shimmer.still);

  it("under reduced motion is a plain grey line with a fixed label, rotating every 2200 ms", async () => {
    await renderReduced(
      <ThinkingStates
        lines={["Finding the objects", "Choosing what to hide", "Writing the case"]}
        accessibilityLabel="Developing your case"
        testID="thinking"
      />,
    );
    const container = screen.getByTestId("thinking");
    expect(container.props.accessibilityLabel).toBe("Developing your case");
    expect(container.props.accessibilityLiveRegion).toBe("polite");
    expect(visibleLine("Finding the objects")).toHaveLength(1);

    await act(() => jest.advanceTimersByTime(PERIOD));
    expect(visibleLine("Choosing what to hide")).toHaveLength(1);
    // The label stays fixed while the lines rotate.
    expect(screen.getByTestId("thinking").props.accessibilityLabel).toBe("Developing your case");
  });

  it("sets the line in the system font at the variant's weight", async () => {
    await renderReduced(<ThinkingStates lines={["Checking the file"]} accessibilityLabel="Checking access" />);
    const [line] = visibleLine("Checking the file");
    expect(styleOf(line)).toMatchObject({ fontSize: ref.type.meta.fontSize, fontWeight: ref.type.meta.fontWeight });
    expect(styleOf(line).fontFamily).toBeUndefined();
  });

  it("on paper uses the ink greys", async () => {
    await renderReduced(<ThinkingStates lines={["Checking the camera"]} accessibilityLabel="Checking access" ground="paper" />);
    expect(lineIn(ref.motion.thinking.shimmerPaper.still)("Checking the camera")).toHaveLength(1);
  });

  it("a single tag line doesn't rotate, and decorative mode hides it from accessibility", async () => {
    await renderReduced(<ThinkingStates lines={["Developing"]} variant="tag" decorative testID="note" />);
    const container = screen.getByTestId("note", hidden);
    expect(container.props.accessible).toBe(false);
    expect(container.props.importantForAccessibility).toBe("no-hide-descendants");
    await act(() => jest.advanceTimersByTime(PERIOD * 2));
    const [line] = visibleLine("Developing");
    expect(styleOf(line)).toMatchObject({ textTransform: "uppercase", letterSpacing: ref.type.tag.letterSpacing });
  });

  it("with showDelay renders nothing until the delay passes", async () => {
    await renderReduced(
      <ThinkingStates lines={["Checking the file"]} accessibilityLabel="Checking access" showDelay={PERIOD} testID="late" />,
    );
    expect(screen.queryByTestId("late", hidden)).toBeNull();
    await act(() => jest.advanceTimersByTime(PERIOD));
    expect(screen.getByTestId("late").props.accessibilityLabel).toBe("Checking access");
  });

  it("measures its lines with hidden sizers before drawing the shimmer", async () => {
    await render(<ThinkingStates lines={["Preparing plate III"]} accessibilityLabel="Preparing plate III" testID="busy" />);
    // Without layout (as in Jest) only the hidden sizer exists; nothing is drawn in the still grey.
    expect(screen.getAllByText("Preparing plate III", hidden)).toHaveLength(1);
    expect(visibleLine("Preparing plate III")).toHaveLength(0);
  });
});

// On Android `accessible` sets isFocusable, which would make a status a
// keyboard and D-pad stop; screenReaderFocusable keeps it one TalkBack element.
describe.each([
  { os: "ios", accessible: true },
  { os: "android", accessible: false },
] as const)("status elements on $os", ({ os, accessible }) => {
  let platform: jest.ReplaceProperty<typeof Platform.OS> | undefined;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, "OS", os);
  });
  afterEach(() => platform?.restore());

  it("ThinkingStates' status is one screen-reader element, never a keyboard stop", async () => {
    await renderReduced(<ThinkingStates lines={["Checking the file"]} accessibilityLabel="Checking access" testID="status" />);
    expect(screen.getByTestId("status", hidden).props).toMatchObject({
      accessible,
      screenReaderFocusable: true,
      importantForAccessibility: "yes",
      accessibilityLabel: "Checking access",
      accessibilityLiveRegion: "polite",
    });
  });
});
