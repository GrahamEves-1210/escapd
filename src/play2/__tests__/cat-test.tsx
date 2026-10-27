// The cat mounts with its eyes and lids, and takes a find and a wrong answer without trouble.
import { render, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import { PeekingCat } from "../PeekingCat";

describe("PeekingCat", () => {
  it("draws, follows a beam and reacts", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const frame = { x: 0, y: 100, width: 390, height: 600 };
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={null} />);
    expect(screen.getByTestId("v2-cat")).toBeTruthy();
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "found", at: 1 }} />);
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} reaction={{ kind: "wrong", at: 2 }} />);
    expect(screen.getByLabelText("A black cat watches your light")).toBeTruthy();
  });
});
