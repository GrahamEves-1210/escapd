import { ref } from "@/theme/tokens";
import { HEADER_HEIGHT, columnHeight, fanFits, fanPools, glassFits, heroBlock } from "../layout";

// docs/DESIGN.md, 01 Layout totals on 393 x 852 with safe areas 59 / 34.
describe("hub geometry", () => {
  it("matches the totals: a 65 header, a 694 column and a 310 hero block", () => {
    expect(HEADER_HEIGHT).toBe(65);
    expect(columnHeight(852, { top: 59, bottom: 34 })).toBe(694);
    expect(heroBlock(1)).toBe(310);
  });

  it("keeps the glass only with a column of at least 658 (375 x 812 keeps it, 375 x 667 drops it)", () => {
    expect(glassFits(694, 1)).toBe(true);
    expect(glassFits(663, 1)).toBe(true);
    expect(glassFits(658, 1)).toBe(true);
    expect(glassFits(657, 1)).toBe(false);
    expect(glassFits(582, 1)).toBe(false);
  });

  it("fans only at the default text size or smaller on screens at least 375 wide", () => {
    expect(fanFits(393, 1)).toBe(true);
    expect(fanFits(375, 0.9)).toBe(true);
    expect(fanFits(393, 1.12)).toBe(false);
    expect(fanFits(374, 1)).toBe(false);
  });

  it("centres the pools: glass (211.1, 188) clipped to 124-308, fan (196.5, 584)", () => {
    // Column top 124; glass box at x 132.5, 28 into the column; title at 184, subtitle bottom at 240.
    const pools = fanPools({ columnY: 124, titleY: 184, subtitleBottom: 240, glassX: 132.5, glassY: 28 }, 393, true);
    expect(pools).toHaveLength(2);
    const [glass, fan] = pools;
    expect(glass.kind).toBe("object");
    expect(glass.cx).toBeCloseTo(211.1, 1);
    expect(glass.cy).toBe(308 - ref.light.object.radius);
    expect(glass.clipTop).toBe(124);
    expect(glass.clipBottom).toBe(308);
    expect(fan).toEqual({ kind: "hero", cx: 196.5, cy: 584 });
  });

  it("drops the glass pool with the glass", () => {
    const pools = fanPools({ columnY: 124, titleY: 184, subtitleBottom: 240, glassX: 132.5, glassY: 28 }, 393, false);
    expect(pools.map((p) => p.kind)).toEqual(["hero"]);
  });
});
