// The cat mounts with its eyes and lids, takes a find and a wrong answer, thinks with "?"s, and dozes off when the light is still.
// It says lines (one at a time, rule lines first), glances where it's told, and has had enough after too much petting.
// Its cues: a scolding after three wrong answers in a row, a perk once per thing the light finds, glances when the player is stuck.
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";
import type { PlayState, RoomDefinitionV2 } from "@/engine/v2";
import { PeekingCat } from "../PeekingCat";
import { useCatCues } from "../useCatCues";

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

  it("says a line, one at a time, and takes it down", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} say={{ text: "Empty.", at: 1 }} />);
      expect(screen.getByText("Empty.")).toBeTruthy();
      // Another flavour line too soon: dropped. A rule line: cuts in.
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={null} say={{ text: "Hm.", at: 2 }} />);
      expect(screen.queryByText("Hm.")).toBeNull();
      await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={null} say={{ text: "Think. Don't guess.", at: 3, rule: true }} waiting />);
      expect(screen.getByText("Think. Don't guess.")).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.queryByTestId("v2-cat-speech")).toBeNull();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it("glances where it's told, with a \"?\" when it wonders", async () => {
    const x = makeMutable(0.5), y = makeMutable(0.4);
    const frame = { x: 0, y: 100, width: 390, height: 600 };
    const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={{ x: 300, y: 200, wonder: true }} />);
    expect(screen.getAllByText("?")).toHaveLength(1);
    await view.rerender(<PeekingCat width={58} beamX={x} beamY={y} frame={frame} lookAt={null} />);
    expect(screen.queryAllByText("?")).toHaveLength(0);
    await view.unmount();
  });

  it("has had enough after too much petting", async () => {
    jest.useFakeTimers();
    try {
      const x = makeMutable(0.5), y = makeMutable(0.4);
      const view = await render(<PeekingCat width={58} beamX={x} beamY={y} frame={null} />);
      for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByTestId("v2-cat-pet"));
      expect(screen.queryByText("Enough.")).toBeNull();
      await fireEvent.press(screen.getByTestId("v2-cat-pet"));
      expect(screen.getByText("Enough.")).toBeTruthy();
      await view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("useCatCues", () => {
  const box = { x: 0.2, y: 0.3, w: 0.2, h: 0.2 };
  const def = {
    objects: [
      { id: "desk", label: "desk", photo_index: 0, box, archetype: "Drawer", controls: [] },
      { id: "lamp", label: "lamp", photo_index: 1, box, archetype: "Light", controls: [] },
    ],
  } as unknown as RoomDefinitionV2;
  const state = { objects: {}, items: {}, inventory: [], solved: [], fired: [], cards: [], seen: [], overlays: [], completed: false } as PlayState;
  const frame = { x: 0, y: 100, width: 390, height: 600 };

  it("scolds a third wrong answer in a row and perks up once per thing", async () => {
    const react = jest.fn();
    const { result } = await renderHook(() => useCatCues({ def, state, view: 0, photos: 2, frame, watching: true, cooldown: 0, contents: {}, react }));
    await act(async () => {
      result.current.wrong();
      result.current.wrong();
    });
    expect(result.current.say).toBeNull();
    await act(async () => result.current.wrong());
    expect(result.current.say).toMatchObject({ text: "Think. Don't guess.", rule: true });
    await act(async () => {
      result.current.hover("desk");
      result.current.hover("desk");
    });
    expect(react).toHaveBeenCalledTimes(1);
    expect(react).toHaveBeenCalledWith(expect.objectContaining({ kind: "warm" }));
  });

  it("glances at what hasn't been looked at when the player is stuck", async () => {
    jest.useFakeTimers();
    try {
      const { result, rerender } = await renderHook((p: { view: number; seen: string[] }) => useCatCues({
        def, state: { ...state, seen: p.seen }, view: p.view, photos: 2, frame, watching: true, cooldown: 0, contents: {}, react: () => {},
      }), { initialProps: { view: 0, seen: [] } });
      expect(result.current.lookAt).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(47000);
      });
      // The desk, on this view: its middle, in window points.
      expect(result.current.lookAt?.x).toBeCloseTo(0.3 * 390);
      expect(result.current.lookAt?.y).toBeCloseTo(100 + 0.4 * 600);
      // The desk looked at: progress ends the glance; stuck again, it looks toward the lamp's side.
      await rerender({ view: 0, seen: ["desk"] });
      expect(result.current.lookAt).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(47000);
      });
      // The turn arrow's height (the photo's middle), on the right (the nearer way round, ties go forward).
      expect(result.current.lookAt?.y).toBe(400);
      expect(result.current.lookAt!.x).toBeGreaterThan(195);
    } finally {
      jest.useRealTimers();
    }
  });
});
