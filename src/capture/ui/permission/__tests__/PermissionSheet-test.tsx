// The permission sheet's own rules (docs/DESIGN.md 03): the live Sheet's look,
// bottom padding, the cap below the back control, and the large-text steps
// (drop the zone, then scroll the text while the controls stay pinned).
import { StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { color, hit, radius, ref, space, type } from "@/theme/tokens";
import { MOUNT_HEIGHT, ZONE_HEIGHT } from "../IllustrationZone";
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
  it("takes the live Sheet's look: walnut, radius.sheet top corners, a brass top hairline and the inner brass rule, no handle", async () => {
    await renderSheet();
    expect(styleOf(screen.getByTestId("permission-sheet", hidden))).toMatchObject({
      backgroundColor: color.surface,
      borderTopLeftRadius: radius.sheet,
      borderTopRightRadius: radius.sheet,
      borderTopWidth: ref.layout.permission.hairline,
      borderColor: color.hairline,
      overflow: "hidden",
    });
    expect(styleOf(screen.getByTestId("permission-sheet-rule", hidden))).toMatchObject({
      top: space.xs,
      left: space.xs,
      right: space.xs,
      borderTopLeftRadius: radius.sheet - space.xs,
      borderColor: color.brassRule,
      borderBottomWidth: 0,
    });
    // Title in Playfair, body in Jakarta.
    expect(styleOf(screen.getByRole("header", { name: "Let ESCAPD use the camera" }))).toMatchObject({ ...type.narrativeTitle, color: color.text });
    expect(styleOf(screen.getByText("Body"))).toMatchObject({ ...type.body, color: color.textSecondary });
    // The zone: space.xl of walnut, then the 136 mount (a 128 plate, 4 in).
    expect(MOUNT_HEIGHT).toBe(136);
    expect(ZONE_HEIGHT).toBe(space.xl + MOUNT_HEIGHT);
  });

  it("caps the sheet space.sm below the back control's 48 box", async () => {
    await renderSheet();
    expect(CAP_BELOW_SAFE_TOP).toBe(ref.layout.permission.back.top + hit.min + space.sm);
    expect(styleOf(screen.getByTestId("permission-sheet-host", hidden)).paddingTop).toBe(BASE.insets.top + CAP_BELOW_SAFE_TOP);
    // y 121 on the base device.
    expect(BASE.insets.top + CAP_BELOW_SAFE_TOP).toBe(121);
  });

  it("ends the last button space.xs above the home indicator, or space.lg above a 0 inset", async () => {
    await renderSheet();
    expect(styleOf(screen.getByTestId("permission-controls", hidden)).paddingBottom).toBe(BASE.insets.bottom + space.xs);
    await renderSheet(SHORT);
    expect(styleOf(screen.getByTestId("permission-controls", hidden)).paddingBottom).toBe(space.lg);
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

    // 1 + 450 + 170 = 621 fits under the cap (731 tall), but not with the 160 zone.
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
