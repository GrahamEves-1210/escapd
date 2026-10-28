import { GestureHandlerRootView } from "react-native-gesture-handler";
import { fireEvent, render, screen } from "@testing-library/react-native";
import type { ActionResult, ItemDef } from "@/engine/v2";
import { CARRY, dropOutcome, tiltFor, useCarry } from "../Carry";
import { ItemTray } from "../ItemTray";
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

describe("the magnifier", () => {
  it("looks through its lens: up and left of its middle, as the art draws it", () => {
    const p = lensPoint(200, 300);
    expect(p.x).toBeLessThan(200);
    expect(p.y).toBeLessThan(300);
    expect(200 - p.x).toBeLessThan(TOOL / 2);
  });

  it("is drawn in its corner, ready to pick up", async () => {
    await render(<GestureHandlerRootView><Lens onDragStart={jest.fn()} onDrop={jest.fn()} /></GestureHandlerRootView>);
    expect(screen.getByTestId("v2-lens").props.accessibilityLabel).toMatch(/drag onto something/);
  });
});
