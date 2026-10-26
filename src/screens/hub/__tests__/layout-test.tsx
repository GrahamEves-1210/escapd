import {
  CARD_RADIUS,
  CHIP_PAD,
  HEADER_HEIGHT,
  TAG_TOP,
  columnHeight,
  coveredWidth,
  fanFits,
  fanGlow,
  fanScale,
  fanTop,
  heroBlock,
  topSpacer,
} from "../layout";

// docs/DESIGN.md, 01 Layout totals on 393 x 852 with safe areas 59 / 34.
describe("hub geometry", () => {
  it("matches the totals: a 65 header, a 694 column, a 417 hero block, Opal's 124 band and the fan from y 330", () => {
    expect(CHIP_PAD).toBe(6);
    expect(HEADER_HEIGHT).toBe(65);
    expect(columnHeight(852, { top: 59, bottom: 34 })).toBe(694);
    expect(heroBlock(1)).toBe(417);
    // The band is capped at Opal's 124: the title box at y 248, the cards from y 330 to their foot at 665.
    expect(topSpacer(694, 1)).toBe(124);
    expect(fanTop(852, { top: 59, bottom: 34 }, 1)).toBe(330);
    // A shorter column shares its free space at 131 : 96 until the share reaches 124.
    expect(topSpacer(417 + 113.5, 1)).toBe(65.5);
    expect(topSpacer(417 + 227, 1)).toBe(124);
    expect(topSpacer(400, 1)).toBe(0);
  });

  it("fits the floor glow to the fan: from the cards' centre to full by the fan's foot", () => {
    const glow = fanGlow(852, 330);
    expect(glow.fadeStart).toBeCloseTo((330 + 160) / 852, 6);
    expect(glow.fadeEnd).toBeCloseTo((330 + 335) / 852, 6);
    // Scaled, it follows the smaller hand.
    const small = fanGlow(667, 300, 0.8);
    expect(small.fadeStart).toBeCloseTo((300 + 128) / 667, 6);
    expect(small.fadeEnd).toBeCloseTo((300 + 268) / 667, 6);
  });

  it("sizes the cards to Opal's height with Opal's absolute tag offset", () => {
    expect(CARD_RADIUS).toBeCloseTo(23.66, 2);
    expect(TAG_TOP).toBe(24);
  });

  it("knows how much of a side card the centre card covers: 29.85 at its top, 63.49 at its foot, linear between", () => {
    expect(coveredWidth(0)).toBeCloseTo(29.85, 5);
    expect(coveredWidth(320)).toBeCloseTo(63.49, 5);
    expect(coveredWidth(160)).toBeCloseTo(46.67, 5);
  });

  it("scales the whole fan down on narrower or shorter screens, and stacks below 0.75 or at large text", () => {
    expect(fanScale(393, 694, 1)).toBe(1);
    expect(fanScale(440, 800, 1)).toBe(1);
    expect(fanScale(375, 582, 1)).toBeCloseTo(375 / 393, 6);
    expect(fanScale(360, 735, 1)).toBeCloseTo(360 / 393, 6);
    // 393 x 480 with no insets: a 415 column leaves 333 for the 335 fan.
    expect(fanScale(393, 415, 1)).toBeCloseTo(333 / 335, 6);
    expect(fanFits(1, 1)).toBe(true);
    expect(fanFits(0.9, 0.8)).toBe(true);
    expect(fanFits(1, 0.74)).toBe(false);
    expect(fanFits(1.12, 1)).toBe(false);
  });
});
