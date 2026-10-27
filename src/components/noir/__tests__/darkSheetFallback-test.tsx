// DarkSheet's close when its slide never reports its end (cut short, or the
// UI thread's callback lost): onClose still runs, once, after the slide's
// duration plus ref.layout.hub.sheet.closeSlack. Without it an invisible
// sheet would keep the screen modal (the player ignores objects while a sheet
// is up), so a lost callback must never strand it.
import { Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { DarkSheet } from "@/components/noir";
import { ref } from "@/theme/tokens";

// Timings that never call back: the value jumps, the callback is dropped.
jest.mock("react-native-reanimated", () => {
  const actual = jest.requireActual("react-native-reanimated");
  return { __esModule: true, ...actual, default: actual.default, withTiming: (value: unknown) => value };
});

it("still closes, once, if the slide never reports its end", async () => {
  const onClose = jest.fn();
  await render(
    <DarkSheet title="Sheet" onClose={onClose} closeTestID="close" testID="sheet">
      <Text>Inside</Text>
    </DarkSheet>,
  );
  await fireEvent.press(screen.getByTestId("close"));
  await fireEvent.press(screen.getByTestId("close"));
  expect(onClose).not.toHaveBeenCalled();
  const wait = ref.motion.sheetFall.duration + ref.layout.hub.sheet.closeSlack;
  await act(() => new Promise((resolve) => setTimeout(resolve, wait + 50)));
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(() => new Promise((resolve) => setTimeout(resolve, wait)));
  expect(onClose).toHaveBeenCalledTimes(1);
});
