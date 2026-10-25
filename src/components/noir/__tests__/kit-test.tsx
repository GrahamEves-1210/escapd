/// <reference types="node" />
import fs from "fs";
import path from "path";
import type { ReactElement } from "react";
import { Platform, StyleSheet } from "react-native";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { LightningIcon, LightningSlashIcon, XIcon } from "@/components/icons";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import {
  BackgroundStill,
  BareIconButton,
  Dither,
  IconButton,
  LightPool,
  NoticeLine,
  Panel,
  PillButton,
  Segment,
  Stamp,
  ThinkingStates,
} from "..";

const ROOT = path.join(__dirname, "../../../..");
const PERIOD = ref.motion.thinking.gap + ref.motion.thinking.swap + ref.motion.thinking.hold;
const hidden = { includeHiddenElements: true } as const;

function renderReduced(ui: ReactElement) {
  return render(<ThemeProvider reducedMotion>{ui}</ThemeProvider>);
}

const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

describe("PillButton", () => {
  it.each(["primary", "secondary", "signal", "quiet"] as const)("renders %s as a labelled button that presses", async (variant) => {
    const onPress = jest.fn();
    await render(<PillButton label="Open the camera" variant={variant} onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Open the camera" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: false, busy: false });
    expect(styleOf(button).minHeight).toBe(variant === "quiet" ? ref.button.quiet.height : ref.button[variant].height);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("pads filled pills to their height, but gives a quiet button no vertical padding (44 until its label outgrows it)", async () => {
    await render(
      <>
        <PillButton label="Unlock Pro" variant="signal" />
        <PillButton label="Not now" variant="quiet" />
      </>,
    );
    expect(styleOf(screen.getByRole("button", { name: "Unlock Pro" })).paddingVertical).toBe(
      (ref.button.signal.height - ref.type.button.lineHeight) / 2,
    );
    expect(styleOf(screen.getByRole("button", { name: "Not now" })).paddingVertical).toBe(0);
  });

  it("dims to disabledOpacity and ignores presses when disabled", async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Not now" variant="quiet" disabled onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Not now" });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    expect(styleOf(button).opacity).toBe(ref.button.disabledOpacity);
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("keeps its label and full opacity, shows the indicator and ignores taps while busy", async () => {
    const onPress = jest.fn();
    await render(<PillButton label="Unlock Pro" variant="signal" busy spinner onPress={onPress} testID="unlock" />);
    const button = screen.getByRole("button", { name: "Unlock Pro" });
    expect(screen.getByText("Unlock Pro")).toBeTruthy();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
    expect(styleOf(button).opacity).toBeUndefined();
    // 16 + 20 + 8 reserved on both sides so the label never shifts.
    expect(styleOf(button).paddingHorizontal).toBe(ref.space.lg + ref.icon.header + ref.space.sm);
    expect(screen.getByTestId("unlock-spinner", hidden)).toBeTruthy();
    // A real tap through the Pressable (fireEvent would call the composite's own onPress prop).
    await userEvent.setup().press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("shows no indicator when busy without spinner", async () => {
    await render(<PillButton label="Allow the camera" busy testID="allow" />);
    expect(screen.getByRole("button", { name: "Allow the camera" }).props.accessibilityState).toMatchObject({ busy: true });
    expect(screen.queryByTestId("allow-spinner", hidden)).toBeNull();
  });
});

describe("icon buttons", () => {
  it("IconButton is a labelled 44 button with a 48 hit area", async () => {
    const onPress = jest.fn();
    await render(<IconButton icon={XIcon} accessibilityLabel="Close" onPress={onPress} />);
    const button = screen.getByRole("button", { name: "Close" });
    expect(styleOf(button).width).toBe(ref.button.icon.size);
    expect(button.props.hitSlop).toBe((ref.hit.comfortable - ref.button.icon.size) / 2);
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("BareIconButton with checked is a switch", async () => {
    const { rerender } = await render(<BareIconButton icon={LightningSlashIcon} accessibilityLabel="Flash" checked={false} />);
    expect(screen.getByRole("switch", { name: "Flash" }).props.accessibilityState).toMatchObject({ checked: false });
    await rerender(<BareIconButton icon={LightningIcon} accessibilityLabel="Flash" checked />);
    expect(screen.getByRole("switch", { name: "Flash" }).props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe("Segment", () => {
  const lens = [
    { value: "wide", label: "0.5×", accessibilityLabel: "Ultra-wide lens" },
    { value: "main", label: "1×", accessibilityLabel: "Main lens" },
  ] as const;

  it("radio mode: each option is a selected-aware radio of at least 44 x 44", async () => {
    const onChange = jest.fn();
    await render(<Segment options={lens} value="main" onChange={onChange} accessibilityLabel="Lens" optionWidth={ref.hit.min} />);
    const main = screen.getByRole("radio", { name: "Main lens" });
    expect(main.props.accessibilityState).toMatchObject({ selected: true });
    expect(styleOf(main).width).toBeGreaterThanOrEqual(ref.hit.min);
    expect(styleOf(main).height).toBeGreaterThanOrEqual(ref.hit.min);
    await fireEvent.press(screen.getByRole("radio", { name: "Ultra-wide lens" }));
    expect(onChange).toHaveBeenCalledWith("wide");
  });

  it("switch mode: one switch element that toggles", async () => {
    const onChange = jest.fn();
    await render(
      <Segment
        mode="switch"
        options={[
          { value: "off", label: "Off" },
          { value: "on", label: "On" },
        ]}
        value="off"
        onChange={onChange}
        accessibilityLabel="Show interactives"
        optionWidth={ref.hit.min}
      />,
    );
    const toggle = screen.getByRole("switch", { name: "Show interactives" });
    expect(toggle.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    await fireEvent.press(toggle);
    expect(onChange).toHaveBeenCalledWith("on");
  });
});

describe("ThinkingStates", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const visibleLine = (text: string) =>
    screen.queryAllByText(text, hidden).filter((node) => styleOf(node).color === ref.color.read);

  it("under reduced motion is a plain read line with a fixed label, rotating every 2200 ms", async () => {
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

  it("a single line doesn't rotate, and decorative mode hides it from accessibility", async () => {
    await renderReduced(<ThinkingStates lines={["Developing"]} variant="note" decorative testID="note" />);
    const container = screen.getByTestId("note", hidden);
    expect(container.props.accessible).toBe(false);
    expect(container.props.importantForAccessibility).toBe("no-hide-descendants");
    await act(() => jest.advanceTimersByTime(PERIOD * 2));
    expect(visibleLine("Developing")).toHaveLength(1);
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
    // Without layout (as in Jest) only the hidden sizer exists; nothing is drawn in read.
    expect(screen.getAllByText("Preparing plate III", hidden)).toHaveLength(1);
    expect(visibleLine("Preparing plate III")).toHaveLength(0);
  });
});

describe("Dither", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows nothing until the show delay passes, then one progressbar", async () => {
    await renderReduced(<Dither showDelay={ref.motion.dither.duration} />);
    expect(screen.queryByRole("progressbar")).toBeNull();
    await act(() => jest.advanceTimersByTime(ref.motion.dither.duration));
    expect(screen.getByRole("progressbar", { name: "Loading" })).toBeTruthy();
  });
});

describe("static pieces", () => {
  it("NoticeLine is one element labelled by its text, in a polite live region", async () => {
    await render(<NoticeLine text="The camera didn't start." testID="notice" />);
    const notice = screen.getByTestId("notice");
    expect(notice.props.accessibilityLabel).toBe("The camera didn't start.");
    expect(notice.props.accessibilityLiveRegion).toBe("polite");
  });

  it("a framed NoticeLine draws the panel; error text is read, never the error colour", async () => {
    await render(<NoticeLine text="You're offline. Connect to begin." variant="body" framed testID="framed" />);
    expect(styleOf(screen.getByTestId("framed"))).toMatchObject({ backgroundColor: ref.panel.fill, borderRadius: ref.panel.radius });
    const text = screen.getByText("You're offline. Connect to begin.", hidden);
    expect(styleOf(text).color).toBe(ref.color.read);
  });

  it("Stamp, Panel and LightPool render", async () => {
    await render(
      <Panel testID="panel">
        <Stamp label="Solved" />
        <LightPool kind="object" cx={ref.light.object.radius} cy={ref.light.object.radius} />
      </Panel>,
    );
    expect(screen.getByText("Solved")).toBeTruthy();
    expect(screen.getByTestId("panel")).toBeTruthy();
  });

  it("BackgroundStill's static require matches ref.background.asset", async () => {
    expect(fs.existsSync(path.join(ROOT, ref.background.asset))).toBe(true);
    const source = fs.readFileSync(path.join(ROOT, "src/components/noir/BackgroundStill.tsx"), "utf8");
    expect(source).toContain(`require("../../../${ref.background.asset}")`);
    await render(<BackgroundStill />);
  });
});

// On Android `accessible` sets isFocusable, which would make a status or notice
// a keyboard and D-pad stop; screenReaderFocusable keeps it one TalkBack element.
describe.each([
  { os: "ios", accessible: true },
  { os: "android", accessible: false },
] as const)("status elements on $os", ({ os, accessible }) => {
  let platform: jest.ReplaceProperty<typeof Platform.OS> | undefined;
  beforeEach(() => {
    platform = jest.replaceProperty(Platform, "OS", os);
  });
  afterEach(() => platform?.restore());

  const element = { accessible, screenReaderFocusable: true, importantForAccessibility: "yes" };

  it("NoticeLine is one screen-reader element, never a keyboard stop", async () => {
    await render(<NoticeLine text="The camera didn't start." testID="notice" />);
    expect(screen.getByTestId("notice", hidden).props).toMatchObject({
      ...element,
      accessibilityLabel: "The camera didn't start.",
      accessibilityLiveRegion: "polite",
    });
  });

  it("ThinkingStates' status is one screen-reader element, never a keyboard stop", async () => {
    await renderReduced(<ThinkingStates lines={["Checking the file"]} accessibilityLabel="Checking access" testID="status" />);
    expect(screen.getByTestId("status", hidden).props).toMatchObject({
      ...element,
      accessibilityLabel: "Checking access",
      accessibilityLiveRegion: "polite",
    });
  });

  it("Dither is one progressbar for screen readers and never takes focus", async () => {
    await renderReduced(<Dither testID="dither" />);
    expect(screen.getByTestId("dither", hidden).props).toMatchObject({
      ...element,
      accessibilityRole: "progressbar",
      accessibilityLabel: "Loading",
      focusable: false,
    });
  });
});
