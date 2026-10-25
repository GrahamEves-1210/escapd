import { HEADER_HEIGHT, columnHeight, fanFits, glassFits, heroBlock } from "../layout";

// docs/DESIGN.md, 01 Layout totals on 393 x 852 with safe areas 59 / 34.
describe("hub geometry", () => {
  it("matches the totals: a 57 header, a 702 column and a 302 hero block", () => {
    expect(HEADER_HEIGHT).toBe(57);
    expect(columnHeight(852, { top: 59, bottom: 34 })).toBe(702);
    expect(heroBlock(1)).toBe(302);
  });

  it("keeps the glass only with a column of at least 649.4 (375 x 812 keeps it, 375 x 667 drops it)", () => {
    expect(glassFits(702, 1)).toBe(true);
    // 375 x 812 with safe areas 44 / 34: a 677 column.
    expect(glassFits(columnHeight(812, { top: 44, bottom: 34 }), 1)).toBe(true);
    expect(glassFits(650, 1)).toBe(true);
    expect(glassFits(649, 1)).toBe(false);
    // 375 x 667 with safe areas 20 / 0: a 590 column.
    expect(glassFits(columnHeight(667, { top: 20, bottom: 0 }), 1)).toBe(false);
  });

  it("fans only at the default text size or smaller on screens at least 375 wide", () => {
    expect(fanFits(393, 1)).toBe(true);
    expect(fanFits(375, 0.9)).toBe(true);
    expect(fanFits(393, 1.12)).toBe(false);
    expect(fanFits(374, 1)).toBe(false);
  });
});
