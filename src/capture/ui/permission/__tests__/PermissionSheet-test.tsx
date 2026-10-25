// The permission sheet's own rules (docs/DESIGN.md 03): bottom padding, the
// cap below the back arrow, and the large-text steps (drop the zone, then
// scroll the text while the controls stay pinned).
import { StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { PermissionSheet } from "../PermissionSheet";

const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

// The base device (393 x 852, safe areas 59 / 34) and a short one with no bottom inset.
const BASE = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } };
const SHORT = { frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 20, bottom: 0, left: 0, right: 0 } };

// The back arrow's 48 hit area ends 2 below its 44 box (safe top + 8); the cap is 8 below that.
const CAP = ref.space.sm + ref.button.bare.hit + (ref.hit.comfortable - ref.button.bare.hit) / 2 + ref.space.sm;

async function renderSheet(metrics = BASE) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider reducedMotion>
        <PermissionSheet copyKey="default" title="Let ESCAPD use the camera" body="Body" notice={null}>
          <Text>controls</Text>
        </PermissionSheet>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}

async function layout(testID: string, height: number) {
  await fireEvent(screen.getByTestId(testID, hidden), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 393, height } } });
}

describe("PermissionSheet", () => {
  it("caps the sheet ref.space.sm below the back arrow's hit area", async () => {
    await renderSheet();
    expect(styleOf(screen.getByTestId("permission-sheet-host", hidden)).paddingTop).toBe(BASE.insets.top + CAP);
    // y 121 on the base device.
    expect(BASE.insets.top + CAP).toBe(121);
  });

  it("ends the last button ctaBottom above the home indicator, or ref.space.lg above a 0 inset", async () => {
    await renderSheet();
    expect(styleOf(screen.getByTestId("permission-controls", hidden)).paddingBottom).toBe(BASE.insets.bottom + ref.space.ctaBottom);
    await renderSheet(SHORT);
    expect(styleOf(screen.getByTestId("permission-controls", hidden)).paddingBottom).toBe(ref.space.lg);
  });

  it("keeps the illustration while the sheet fits under the cap", async () => {
    await renderSheet();
    await layout("permission-sheet-host", BASE.frame.height);
    await layout("permission-text", 228);
    await layout("permission-controls", 170);
    expect(screen.getByTestId("permission-illustration", hidden)).toBeTruthy();
    expect(screen.queryByTestId("permission-scroll", hidden)).toBeNull();
  });

  it("large text: drops the zone first, then scrolls the text with the controls pinned", async () => {
    await renderSheet();
    await layout("permission-sheet-host", BASE.frame.height);
    await layout("permission-controls", 170);

    // 1 + 450 + 170 = 621 fits under the cap (731 tall), but not with the 150 zone.
    await layout("permission-text", 450);
    expect(screen.queryByTestId("permission-illustration", hidden)).toBeNull();
    expect(screen.queryByTestId("permission-scroll", hidden)).toBeNull();

    // 1 + 600 + 170 = 771 doesn't fit at all: the text scrolls.
    await layout("permission-text", 600);
    expect(screen.queryByTestId("permission-illustration", hidden)).toBeNull();
    expect(screen.getByTestId("permission-scroll", hidden)).toBeTruthy();
    // The controls stay outside the scroll view, pinned at the bottom.
    expect(screen.getByTestId("permission-controls", hidden)).toBeTruthy();
  });
});
