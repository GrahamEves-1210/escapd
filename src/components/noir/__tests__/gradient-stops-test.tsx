/// <reference types="node" />
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react-native";
import { ref, type GradientStop } from "@/theme/tokens";
import { FloorGlow, LightPool, LightPools } from "..";

// react-native-svg packs each gradient stop as [offset, ARGB int] and takes the
// alpha byte from stopOpacity (default 1), ignoring any alpha inside an rgba()
// stopColor. A stop with its transparency in the colour therefore paints solid:
// the old light pools showed on device as opaque rectangles. These tests read
// the packed stops the native view would receive.

const ROOT = path.join(__dirname, "../../../..");

type Json = { type: string; props: Record<string, unknown>; children: Json[] | null } | string;

function nativeGradients(tree: unknown): number[][] {
  const found: number[][] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as Exclude<Json, string>;
    if (/Gradient$/.test(n.type) && Array.isArray(n.props.gradient)) found.push(n.props.gradient as number[]);
    n.children?.forEach(walk);
  };
  walk(tree);
  return found;
}

// The packed list alternates offset, colour.
const argbs = (gradient: number[]) => gradient.filter((_, i) => i % 2 === 1);
const alphas = (gradient: number[]) => argbs(gradient).map((argb) => (argb >>> 24) & 0xff);
const rgbs = (gradient: number[]) => argbs(gradient).map((argb) => `#${(argb & 0xffffff).toString(16).padStart(6, "0").toUpperCase()}`);
const expectedAlphas = (stops: readonly GradientStop[]) => stops.map((s) => Math.round(s.opacity * 255));

// A pool shaped like pushr's haze (ref.gradient.haze's stops), to exercise LightPool.
const POOL = { cx: 228, cy: 124, r: 200, stops: ref.gradient.haze.stops };

describe("gradient stops keep their transparency", () => {
  it.each(Object.keys(ref.gradient) as (keyof typeof ref.gradient)[])("ref.gradient.%s stops are a plain hex colour plus a separate opacity", (name) => {
    const stops: readonly GradientStop[] = ref.gradient[name].stops;
    expect(stops.length).toBeGreaterThanOrEqual(2);
    for (const stop of stops) {
      expect(stop.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(stop.opacity).toBeGreaterThanOrEqual(0);
      expect(stop.opacity).toBeLessThanOrEqual(1);
      expect(stop.offset).toBeGreaterThanOrEqual(0);
      expect(stop.offset).toBeLessThanOrEqual(1);
    }
    // Offsets never run backwards.
    expect(stops.map((s) => s.offset)).toEqual([...stops.map((s) => s.offset)].sort((a, b) => a - b));
  });

  it("the haze reaches the native view with each stop's opacity, transparent at its edge", async () => {
    const glow = POOL;
    await render(<LightPool glow={glow} />);
    const [gradient] = nativeGradients(screen.toJSON());
    expect(gradient).toBeDefined();
    expect(alphas(gradient)).toEqual(expectedAlphas(glow.stops));
    expect(rgbs(gradient)).toEqual(glow.stops.map((s) => s.color));
    // The bounding square's corners take the last stop: it must be clear.
    expect(alphas(gradient).at(-1)).toBe(0);
  });

  it("two pools in one layer both keep their opacities", async () => {
    const glow = POOL;
    await render(<LightPools pools={[{ glow }, { glow, cx: 120, cy: 600, r: 100 }]} />);
    const gradients = nativeGradients(screen.toJSON());
    expect(gradients).toHaveLength(2);
    for (const g of gradients) expect(alphas(g)).toEqual(expectedAlphas(glow.stops));
  });

  it("the floor glow draws its colours across and fades in from its ground", async () => {
    const glow = ref.gradient.bottomGlow;
    await render(<FloorGlow />);
    const [across, fade] = nativeGradients(screen.toJSON());
    expect(rgbs(across)).toEqual(glow.stops.map((s) => s.color));
    expect(alphas(across)).toEqual(expectedAlphas(glow.stops));
    // The overlay: the ground at full strength at fadeStart, clear from fadeEnd.
    expect(rgbs(fade)).toEqual([glow.ground, glow.ground]);
    expect(alphas(fade)).toEqual([255, 0]);
  });

  it("no source file puts an rgba()/hsla() colour on a gradient stop", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name !== "node_modules" && entry.name !== "__tests__") walk(full);
        } else if (/\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(path.join(ROOT, "src"));
    walk(path.join(ROOT, "app"));
    const offenders = files.filter((file) => /stopColor=\{?\s*["'`](rgba|hsla)\(/.test(fs.readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
