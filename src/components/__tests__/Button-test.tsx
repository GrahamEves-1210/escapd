import { StyleSheet } from "react-native";
import { act, render, screen, within } from "@testing-library/react-native";
import { color, radius, ref } from "@/theme/tokens";
import { Button } from "../Button";

const hidden = { includeHiddenElements: true } as const;
const styleOf = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as never) ?? {};

// Opacity applied to a node by its own style or by any ancestor's.
function opacityOf(node: { props: { style?: unknown }; parent: unknown } | null): number {
  let opacity = 1;
  for (let n = node; n; n = n.parent as typeof node) {
    const value = styleOf(n).opacity;
    if (typeof value === "number") opacity *= value;
  }
  return opacity;
}

const ringsIn = (button: ReturnType<typeof screen.getByRole>) =>
  button.queryAll((node) => styleOf(node).borderColor === ref.focus.color && styleOf(node).borderWidth === ref.focus.width);

describe("the play screen's Button", () => {
  it("draws an 8 pt brass primary on an inner surface", async () => {
    await render(<Button label="Develop the case" />);
    const button = screen.getByRole("button", { name: "Develop the case" });
    expect(styleOf(within(button).getByTestId("button-surface", hidden))).toMatchObject({
      backgroundColor: color.accent,
      borderRadius: radius.control,
    });
  });

  it.each([
    ["disabled", { disabled: true }],
    ["loading", { loading: true }],
  ] as const)("keeps its brass focus ring at full strength while %s, though the button dims", async (_, props) => {
    await render(<Button label="Allow the camera" {...props} />);
    const button = screen.getByRole("button", { name: "Allow the camera" });
    await act(() => button.props.onFocus?.({ nativeEvent: {} }));
    const [ring] = ringsIn(button);
    expect(ring).toBeDefined();
    expect(ref.focus.color).toBe(color.accent);
    expect(opacityOf(ring)).toBe(1);
    expect(opacityOf(within(button).getByTestId("button-surface", hidden))).toBeLessThan(1);
  });
});
