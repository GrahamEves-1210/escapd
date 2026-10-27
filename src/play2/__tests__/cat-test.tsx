// The cat mounts with its eyes and lids, takes a find and a wrong answer, thinks with "?"s, and dozes off when the light is still.
import { act, render, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import { PeekingCat } from "../PeekingCat";

describe("PeekingCat", () => {
  it("draws, follows a beam and reacts", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const frame = { x: 0, y: 100, width: 390, height: 600 };
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={null} />);
    expect(screen.getByTestId("v2-cat")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "found", at: 1 }} />);
    expect(screen.getByText("!")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "wrong", at: 2 }} />);
    expect(screen.getByLabelText("A black cat watches your light")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "wrong", at: 2 }} mood="thinking" />);
    expect(screen.getAllByText("?")).toHaveLength(3);
    await view.unmount();
  });

  it("dozes off when the light is still", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} />);
      expect(screen.queryAllByText("z")).toHaveLength(0);
      await act(async () => {
        jest.advanceTimersByTime(25000);
      });
      expect(screen.getAllByText("z")).toHaveLength(2);
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});
