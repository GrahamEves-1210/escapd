/// <reference types="node" />
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react-native";
import { ref } from "@/theme/tokens";
import { LightPool, LightPools } from "..";

// react-native-svg packs each gradient stop as [offset, ARGB int] and takes the
// alpha byte from stopOpacity (default 1), ignoring any alpha inside an rgba()
// stopColor. A stop with its transparency in the colour therefore paints solid:
// the light pools showed on device as opaque #F2F2F2 rectangles. These tests read
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
const alphas = (gradient: number[]) =>
  gradient.filter((_, i) => i % 2 === 1).map((argb) => (argb >>> 24) & 0xff);

describe("gradient stops keep their transparency", () => {
  it.each(["hero", "object"] as const)("ref.light.%s stops are a plain colour plus a separate opacity", (kind) => {
    for (const stop of ref.light[kind].stops) {
      expect(stop.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(stop.opacity).toBeLessThan(1);
    }
  });

  it.each(["hero", "object"] as const)("a %s pool reaches the native view as a fading, mostly transparent gradient", async (kind) => {
    const r = ref.light[kind].radius;
    await render(<LightPool kind={kind} cx={r} cy={r} />);
    const [gradient] = nativeGradients(screen.toJSON());
    expect(gradient).toBeDefined();
    const expected = ref.light[kind].stops.map((s) => Math.round(s.opacity * 255));
    expect(alphas(gradient)).toEqual(expected);
    // Never an opaque stop: that is the solid-rectangle bug.
    expect(Math.max(...alphas(gradient))).toBeLessThan(255);
  });

  it("two pools in one layer both stay transparent", async () => {
    await render(<LightPools pools={[{ kind: "hero", cx: 220, cy: 220 }, { kind: "object", cx: 120, cy: 600 }]} />);
    const gradients = nativeGradients(screen.toJSON());
    expect(gradients).toHaveLength(2);
    for (const g of gradients) expect(Math.max(...alphas(g))).toBeLessThan(255);
  });

  it("the glass glare layers carry opacity separately", () => {
    const glare = ref.motion.tilt.glare;
    expect(glare.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    for (const layer of glare.layers) {
      expect(layer.opacities).toHaveLength(layer.offsets.length);
      expect(Math.max(...layer.opacities)).toBeLessThan(1);
    }
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
