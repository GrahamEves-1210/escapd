// The permission sheet's own rules (docs/DESIGN.md 03): pushr's white sheet,
// its type, bottom padding, the cap below the safe top, and the large-text
// steps (drop the panel, then scroll the text while the controls stay pinned).
import { StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { ref, shellTheme } from "@/theme/tokens";
import { CAP_BELOW_SAFE_TOP, PermissionSheet } from "../PermissionSheet";

const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

// The base device (393 x 852, safe areas 59 / 34) and a short one with no bottom inset.
const BASE = { frame: { x: 0, y: 0, width: 393, height: 852 }, insets: { top: 59, bottom: 34, left: 0, right: 0 } };
const SHORT = { frame: { x: 0, y: 0, width: 375, height: 667 }, insets: { top: 20, bottom: 0, left: 0, right: 0 } };

async function renderSheet(metrics = BASE) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider reducedMotion>
        <PermissionSheet copyKey="default" title="Let ESCAPD use the camera" body="Body" notice={null} testID="permission-sheet">
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
  it("is the app's dark sheet: 40 pt continuous top corners (the camera's), no edge, rule or shadow", async () => {
    await renderSheet();
    const sheet = styleOf(screen.getByTestId("permission-sheet", hidden));
    expect(sheet).toMatchObject({
      backgroundColor: ref.color.ground,
      borderTopLeftRadius: ref.radius.bottomSheet,
      borderTopRightRadius: ref.radius.bottomSheet,
      borderCurve: "continuous",
      overflow: "hidden",
    });
    expect(sheet.borderWidth ?? 0).toBe(0);
    expect(sheet.borderTopWidth ?? 0).toBe(0);
    expect(sheet.shadowOpacity ?? 0).toBe(0);
    expect(screen.queryByTestId("permission-sheet-rule", hidden)).toBeNull();
    // The panel first, full-bleed; the text in the 24 gutter, 24 below it.
    expect(styleOf(screen.getByTestId("permission-illustration", hidden))).toMatchObject({ height: ref.layout.permission.panel });
    expect(styleOf(screen.getByTestId("permission-text", hidden))).toMatchObject({ paddingHorizontal: ref.space.xl, paddingTop: ref.space.xl });
    // Title in the theme's display face, sentence case; body in the system font, grey, titleToBody 14 below.
    expect(styleOf(screen.getByRole("header", { name: "Let ESCAPD use the camera" }))).toMatchObject({
      ...shellTheme.display,
      textTransform: "none",
      color: ref.color.textPrimary,
    });
    expect(styleOf(screen.getByText("Body"))).toMatchObject({ ...ref.type.body, color: ref.color.textSecondary });
    expect(styleOf(screen.getByText("Body")).textTransform).toBeUndefined();
    expect(styleOf(screen.getByText("Body").parent as never).marginTop).toBe(ref.layout.permission.titleToBody);
    // The controls: 28 below the body, 8 apart, in the gutter.
    expect(styleOf(screen.getByTestId("permission-controls", hidden))).toMatchObject({
      paddingTop: ref.space.band,
      gap: ref.space.sm,
      paddingHorizontal: ref.space.xl,
    });
  });

  it("caps the sheet just under the screen's close square", async () => {
    await renderSheet();
    expect(CAP_BELOW_SAFE_TOP).toBe(ref.layout.camera.top + ref.button.square.size + ref.space.sm);
    expect(styleOf(screen.getByTestId("permission-sheet-host", hidden)).paddingTop).toBe(BASE.insets.top + CAP_BELOW_SAFE_TOP);
  });

  it("ends the last button ref.space.ctaBottom above the home indicator, or ctaFloor + ctaBottom above a 0 inset", async () => {
    await renderSheet();
    expect(styleOf(screen.getByTestId("permission-controls", hidden)).paddingBottom).toBe(BASE.insets.bottom + ref.space.ctaBottom);
    await renderSheet(SHORT);
    expect(styleOf(screen.getByTestId("permission-controls", hidden)).paddingBottom).toBe(ref.space.ctaFloor + ref.space.ctaBottom);
  });

  it("keeps the panel while the sheet fits under the cap", async () => {
    await renderSheet();
    await layout("permission-sheet-host", BASE.frame.height);
    await layout("permission-text", 260);
    await layout("permission-controls", 170);
    expect(screen.getByTestId("permission-illustration", hidden)).toBeTruthy();
    expect(screen.queryByTestId("permission-scroll", hidden)).toBeNull();
  });

  it("large text: drops the panel first, then scrolls the text with the controls pinned", async () => {
    await renderSheet();
    await layout("permission-sheet-host", BASE.frame.height);
    await layout("permission-controls", 170);

    // The room under the cap is 852 - 75 = 777: 500 + 170 fits, but not with the 150 panel.
    await layout("permission-text", 500);
    expect(screen.queryByTestId("permission-illustration", hidden)).toBeNull();
    expect(screen.queryByTestId("permission-scroll", hidden)).toBeNull();

    // 650 + 170 = 820 doesn't fit at all: the text scrolls.
    await layout("permission-text", 650);
    expect(screen.queryByTestId("permission-illustration", hidden)).toBeNull();
    expect(screen.getByTestId("permission-scroll", hidden)).toBeTruthy();
    // The controls stay outside the scroll view, pinned at the bottom.
    expect(screen.getByTestId("permission-controls", hidden)).toBeTruthy();
  });
});
