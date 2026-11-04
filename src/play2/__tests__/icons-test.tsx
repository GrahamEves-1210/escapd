import { GestureHandlerRootView } from "react-native-gesture-handler";
import { render, screen } from "@testing-library/react-native";
import type { ItemDef } from "@/engine/v2";
import { useCarry } from "../Carry";
import { ItemIcons } from "../icons/ItemIcons";
import { ItemTray, itemIcon } from "../ItemTray";
import { sparkleSeeds } from "../Stage";

const icon = (name: string, extra: Partial<ItemDef> = {}) => itemIcon({ name, kind: "prop", ...extra });

describe("item icons", () => {
  it("draw each item as what it is, by its kind, archetype or name", () => {
    expect(icon("UV flashlight", { kind: "tool", archetype: "Light", variant: "torch" })).toBe(ItemIcons.uvLight);
    expect(icon("Cipher wheel", { kind: "decoder", archetype: "Decoder" })).toBe(ItemIcons.wheel);
    expect(icon("Brass key", { kind: "key" })).toBe(ItemIcons.key);
    expect(icon("Iron key")).toBe(ItemIcons.key);
    expect(icon("Torn note (left)", { kind: "half" })).toBe(ItemIcons.tornLeft);
    expect(icon("Torn statement (right)", { kind: "half" })).toBe(ItemIcons.tornRight);
    expect(icon("Taped note", { kind: "assembled" })).toBe(ItemIcons.taped);
    expect(icon("Mended page")).toBe(ItemIcons.taped);
    expect(icon("Photograph")).toBe(ItemIcons.photo);
    expect(icon("Telegram")).toBe(ItemIcons.letter);
    expect(icon("Theatre stub")).toBe(ItemIcons.ticket);
    expect(icon("Wedding ring")).toBe(ItemIcons.ring);
    expect(icon("Locket")).toBe(ItemIcons.ring);
    expect(icon("Old map")).toBe(ItemIcons.map);
    expect(icon("Diary")).toBe(ItemIcons.book);
    expect(icon("Gold coin")).toBe(ItemIcons.coin);
    expect(icon("Matchbook")).toBe(ItemIcons.matchbook);
    expect(icon("Calling card")).toBe(ItemIcons.note);
    expect(icon("Christening spoon", { kind: "taken" })).toBe(ItemIcons.box);
  });

  it("know the UV light by its name where the casebook has no variant", () => {
    expect(itemIcon({ name: "UV flashlight", kind: "tool", archetype: "Light" })).toBe(ItemIcons.uvLight);
  });

  it("render at a size, lit or not", async () => {
    await render(<ItemIcons.uvLight size={40} lit />);
    await render(<ItemIcons.key size={28} weight="fill" color="#fff" />);
  });
});

const uv: ItemDef = { id: "uv", name: "UV flashlight", kind: "tool", archetype: "Light", variant: "torch" };

function Tray({ equipped }: { equipped: boolean }) {
  const carry = useCarry(() => {});
  return (
    <ItemTray items={[uv]} shown={null} equipped={equipped} carry={carry} onTap={jest.fn()} onExamine={jest.fn()} onDragStart={jest.fn()}
      onDrop={jest.fn()} register={jest.fn()} slots={4} width={360} />
  );
}

describe("the UV light in the hotbar", () => {
  it("looks in use while it's on, and says a tap switches it back", async () => {
    await render(<GestureHandlerRootView><Tray equipped /></GestureHandlerRootView>);
    expect(screen.getByTestId("v2-item-in-use")).toBeTruthy();
    expect(screen.getByTestId("v2-item-uv").props.accessibilityHint).toMatch(/Tap to switch back/);
    expect(screen.getByTestId("v2-item-uv").props.accessibilityValue).toEqual({ text: "On" });
  });

  it("is a plain item while it's off", async () => {
    await render(<GestureHandlerRootView><Tray equipped={false} /></GestureHandlerRootView>);
    expect(screen.queryByTestId("v2-item-in-use")).toBeNull();
    expect(screen.getByTestId("v2-item-uv").props.accessibilityHint).toMatch(/onto your flashlight/);
  });
});

describe("the glints' sparkles", () => {
  const o = { id: "lamp", box: { x: 0.2, y: 0.3, w: 0.3, h: 0.2 } };
  const W = 400, H = 600;

  it("scatter a few round each object, near its box, the same every time", () => {
    const seeds = sparkleSeeds(o, undefined, W, H);
    expect(seeds.length).toBeGreaterThanOrEqual(4);
    expect(seeds.length).toBeLessThanOrEqual(10);
    for (const s of seeds) {
      expect(s.x).toBeGreaterThanOrEqual(o.box.x * W - 8);
      expect(s.x).toBeLessThanOrEqual((o.box.x + o.box.w) * W + 8);
      expect(s.y).toBeGreaterThanOrEqual(o.box.y * H - 8);
      expect(s.y).toBeLessThanOrEqual((o.box.y + o.box.h) * H + 8);
    }
    expect(sparkleSeeds(o, undefined, W, H)).toEqual(seeds);
  });

  it("sit along an outline when there is one, never far off it", () => {
    const outline = [{ x: 0.25, y: 0.32 }, { x: 0.45, y: 0.32 }, { x: 0.45, y: 0.48 }, { x: 0.25, y: 0.48 }, { x: 0.9, y: 0.95 }];
    const seeds = sparkleSeeds(o, outline, W, H);
    for (const s of seeds) {
      expect(s.x).toBeLessThanOrEqual((o.box.x + o.box.w) * W + 6);
      expect(s.y).toBeLessThanOrEqual((o.box.y + o.box.h) * H + 6);
    }
  });

  it("have none for an empty box", () => {
    expect(sparkleSeeds({ id: "x", box: { x: 0, y: 0, w: 0, h: 0 } }, undefined, W, H)).toEqual([]);
  });
});
