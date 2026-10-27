// DarkSheet's close: it slides away while still mounted, and only then calls
// onClose. A sheet that animated out only on unmount lost its stacking on the
// way down, so the tray and header drew over it.
import { Text } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { DarkSheet, useSheetClose } from "@/components/noir";
import { ref } from "@/theme/tokens";

function Inner() {
  const close = useSheetClose();
  return <Text onPress={() => close?.()} testID="inner-close">Done</Text>;
}

const sheet = (onClose: () => void, extra: Partial<Parameters<typeof DarkSheet>[0]> = {}) => (
  <DarkSheet title="Sheet" onClose={onClose} closeTestID="close" testID="sheet" {...extra}>
    <Inner />
  </DarkSheet>
);

describe("DarkSheet closing", () => {
  it("slides away first, then calls onClose once, however many times Close is pressed", async () => {
    const onClose = jest.fn();
    await render(sheet(onClose));
    await fireEvent.press(screen.getByTestId("close"));
    await fireEvent.press(screen.getByTestId("close"));
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("closes the same way from inside (useSheetClose) and from a function footer", async () => {
    const fromInside = jest.fn();
    await render(sheet(fromInside));
    await fireEvent.press(screen.getByTestId("inner-close"));
    await waitFor(() => expect(fromInside).toHaveBeenCalledTimes(1));

    const fromFooter = jest.fn();
    await render(sheet(fromFooter, { footer: (close: () => void) => <Text onPress={close} testID="footer-close">Go</Text> }));
    await fireEvent.press(screen.getByTestId("footer-close"));
    await waitFor(() => expect(fromFooter).toHaveBeenCalledTimes(1));
  });

  it("calls onClose once when both the slide's end and the fallback come", async () => {
    const onClose = jest.fn();
    await render(sheet(onClose));
    await fireEvent.press(screen.getByTestId("close"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, ref.motion.sheetFall.duration + ref.layout.hub.sheet.closeSlack + 50)));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("never calls onClose late once it has been unmounted mid-slide", async () => {
    const onClose = jest.fn();
    const view = await render(sheet(onClose));
    await fireEvent.press(screen.getByTestId("close"));
    view.unmount();
    await act(() => new Promise((resolve) => setTimeout(resolve, ref.motion.sheetFall.duration + 100)));
    expect(onClose).not.toHaveBeenCalled();
  });
});
