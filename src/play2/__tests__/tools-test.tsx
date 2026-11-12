// The two tools' art (rendered by scripts/blender/props) and how Tools.tsx holds it.
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react-native";
import { Flashlight, LIGHT_LENS_Y, lensPoint, TOOL } from "../Tools";

const BRAND = path.join(__dirname, "../../../assets/brand");
/** A PNG's pixel size, from its header. */
function pngSize(file: string): { width: number; height: number; bytes: number } {
  const b = fs.readFileSync(path.join(BRAND, file));
  expect(b.toString("latin1", 1, 4)).toBe("PNG");
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), bytes: b.length };
}

function Light({ uv, beamX = 0.5, beamY = 0.2 }: { uv: boolean; beamX?: number; beamY?: number }) {
  // The shared values only need get() here: the mock runs the style once.
  const value = (v: number) => ({ get: () => v, value: v }) as never;
  return <Flashlight at={{ left: 294, top: 600 }} beamX={value(beamX)} beamY={value(beamY)} frame={{ x: 0, y: 60, width: 390, height: 600 }} uv={uv} />;
}

describe("the tools' art", () => {
  it.each(["magnifier", "flashlight", "flashlight-uv"])("%s is exported at the size it's shown, x1, x2 and x3, and stays light", (name) => {
    for (const [suffix, scale] of [["", 1], ["@2x", 2], ["@3x", 3]] as const) {
      const { width, height, bytes } = pngSize(`${name}${suffix}.png`);
      expect([width, height]).toEqual([TOOL * scale, TOOL * scale]);
      expect(bytes).toBeLessThan(150 * 1024);
    }
  });

  it("the magnifier looks through its lens: up and right of its middle, inside the glass", () => {
    const p = lensPoint(200, 300);
    // The rendered lens is centred about 2% right and 6% up of the picture's middle, over a quarter of the picture in radius.
    expect(p.x - 200).toBeGreaterThan(0);
    expect(p.x - 200).toBeLessThan(TOOL * 0.2);
    expect(300 - p.y).toBeGreaterThan(TOOL * 0.05);
    expect(300 - p.y).toBeLessThan(TOOL * 0.25);
  });

  it("the flashlight's lens is at its top, on its centre line (what turns toward the beam)", () => {
    expect(LIGHT_LENS_Y).toBeGreaterThan(0.1);
    expect(LIGHT_LENS_Y).toBeLessThan(0.25);
  });
});

describe("the flashlight", () => {
  const art = () => screen.getByTestId("v2-flashlight-art").props.source;

  it("is the brass torch, and its blackened twin with the UV light on", async () => {
    const view = await render(<Light uv={false} />);
    const brass = art();
    await view.rerender(<Light uv />);
    expect(art()).not.toEqual(brass);
  });

  it("never takes touches: the beam's pan passes through it", async () => {
    await render(<Light uv={false} />);
    expect(screen.getByTestId("v2-flashlight").props.pointerEvents).toBe("none");
  });
});
