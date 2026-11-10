import { GestureHandlerRootView } from "react-native-gesture-handler";
import { createGestureController } from "react-native-gesture-handler/jest-utils";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import type { ActionResult, ItemDef } from "@/engine/v2";
import { CARRY, dropOutcome, tiltFor, useCarry } from "../Carry";
import { HOLD, holdEnds, ItemTray } from "../ItemTray";
import { lensPoint, Magnifier, TOOL } from "../Tools";

const items: ItemDef[] = [
  { id: "half_a", name: "torn half", kind: "half" },
  { id: "half_b", name: "torn half", kind: "half" },
  { id: "uv", name: "UV flashlight", kind: "tool", archetype: "Light", variant: "torch" },
];

function Tray(props: Partial<React.ComponentProps<typeof ItemTray>>) {
  const carry = useCarry(() => {});
  return (
    <ItemTray items={items} shown={null} equipped={false} carry={carry} onTap={jest.fn()} onExamine={jest.fn()} onDragStart={jest.fn()}
      onDrop={jest.fn()} register={jest.fn()} slots={6} width={360} {...props} />
  );
}

function Lens(props: { onDragStart: () => void; onDrop: (x: number, y: number) => void }) {
  const carry = useCarry(() => {});
  return <Magnifier at={{ left: 8, top: 600 }} carry={carry} {...props} />;
}

describe("the carry", () => {
  it("leans into the motion, never past its limit, and stands upright at rest", () => {
    expect(tiltFor(0)).toBe(0);
    expect(tiltFor(300)).toBeGreaterThan(0);
    expect(tiltFor(-300)).toBeLessThan(0);
    expect(tiltFor(10_000)).toBe(CARRY.maxTilt);
    expect(tiltFor(-10_000)).toBe(-CARRY.maxTilt);
  });

  it("reads a drop's result: used up, snapped in, or nothing came of it", () => {
    const ok = (effects: ActionResult["effects"]): ActionResult => ({ outcome: "ok", effects });
    expect(dropOutcome(null, "k")).toBe("home");
    expect(dropOutcome({ outcome: "nothing", effects: [] }, "k")).toBe("home");
    expect(dropOutcome({ outcome: "wrong", effects: [] }, "k")).toBe("home");
    expect(dropOutcome(ok([{ do: "open", object: "box" }]), "k")).toBe("snap");
    expect(dropOutcome(ok([{ do: "open", object: "box" }, { do: "consume", item: "k" }]), "k")).toBe("vanish");
    // Another item used up (the other half) leaves this one held.
    expect(dropOutcome(ok([{ do: "consume", item: "other" }]), "k")).toBe("snap");
  });
});

describe("the tray", () => {
  it("says what an item is on a tap, examines it on a hold; there's no fit-together button", async () => {
    const onTap = jest.fn();
    const onExamine = jest.fn();
    await render(<GestureHandlerRootView><Tray onTap={onTap} onExamine={onExamine} /></GestureHandlerRootView>);
    await fireEvent(screen.getByTestId("v2-item-uv"), "accessibilityAction", { nativeEvent: { actionName: "activate" } });
    expect(onTap).toHaveBeenCalledWith("uv");
    await fireEvent(screen.getByTestId("v2-item-half_a"), "accessibilityAction", { nativeEvent: { actionName: "longpress" } });
    expect(onExamine).toHaveBeenCalledWith("half_a");
    expect(screen.queryByText("Fit together")).toBeNull();
    expect(screen.getByTestId("v2-item-uv").props.accessibilityHint).toMatch(/onto your flashlight/);
  });
});

describe("a hold and a drag on a held item", () => {
  it("a hold looks closer only when it ends without a drag: a press that pauses, then drags onto its neighbour, is a drag", () => {
    expect(holdEnds(true, false)).toBe("examine");
    expect(holdEnds(true, true)).toBe("nothing");
    expect(holdEnds(false, true)).toBe("nothing");
    expect(holdEnds(false, false)).toBe("nothing");
  });

  it("lets the drag take over well before movement would call the hold off", () => {
    // A neighbouring slot is 60 points away: the drag has long begun by then, and the hold hasn't been cancelled into a look.
    expect(HOLD.drag).toBeLessThan(HOLD.slack);
    expect(HOLD.slack).toBeLessThan(60);
    expect(HOLD.ms).toBeGreaterThanOrEqual(400);
  });

  it("drops a held item where it's let go after a pause, without examining it", async () => {
    const onExamine = jest.fn();
    const onDrop = jest.fn();
    const onDragStart = jest.fn();
    await render(<GestureHandlerRootView><Tray onExamine={onExamine} onDrop={onDrop} onDragStart={onDragStart} /></GestureHandlerRootView>);
    // The finger lands and rests past the hold's time, then creeps across to the next slot and lets go.
    const hold = createGestureController("v2-item-hold-half_a");
    const pan = createGestureController("v2-item-pan-half_a");
    hold.begin();
    pan.begin({ x: 20, y: 20, absoluteX: 40, absoluteY: 800 });
    hold.activate();
    pan.activate({ x: 30, y: 20, absoluteX: 50, absoluteY: 800 });
    pan.update({ x: 80, y: 20, absoluteX: 100, absoluteY: 800 });
    pan.end({ x: 80, y: 20, absoluteX: 100, absoluteY: 800 });
    hold.end();
    // The callbacks come back from the UI thread a moment later.
    await act(async () => {});
    expect(onDragStart).toHaveBeenCalledWith("half_a", expect.any(Number));
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onDrop.mock.calls[0][0]).toBe("half_a");
    expect(onExamine).not.toHaveBeenCalled();
  });

  it("examines a held item that's held still and let go", async () => {
    const onExamine = jest.fn();
    const onDrop = jest.fn();
    await render(<GestureHandlerRootView><Tray onExamine={onExamine} onDrop={onDrop} /></GestureHandlerRootView>);
    const hold = createGestureController("v2-item-hold-half_b");
    hold.begin();
    hold.activate();
    // Nothing yet: it's looked at when it's let go.
    await act(async () => {});
    expect(onExamine).not.toHaveBeenCalled();
    hold.end();
    await act(async () => {});
    expect(onExamine).toHaveBeenCalledWith("half_b");
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe("the magnifier", () => {
  it("looks through its lens: up and right of its middle, as the art draws it", () => {
    const p = lensPoint(200, 300);
    expect(p.x).toBeGreaterThan(200);
    expect(p.y).toBeLessThan(300);
    expect(p.x - 200).toBeLessThan(TOOL / 2);
    expect(300 - p.y).toBeLessThan(TOOL / 2);
  });

  it("is drawn in its corner, ready to pick up", async () => {
    await render(<GestureHandlerRootView><Lens onDragStart={jest.fn()} onDrop={jest.fn()} /></GestureHandlerRootView>);
    expect(screen.getByTestId("v2-lens").props.accessibilityLabel).toMatch(/drag onto something/);
  });
});
