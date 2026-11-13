import { crankStep, flangeFrame, GEAR, LEAD_IN, LEADER, CLEAR, NOTE_STEP, parkedTurn, pinAngle, PLUCK_AT, plucks, pullToRead, TUNE_MARKS, tuneOf } from "../tune";

test("a tune card is the teeth it plucks, low to high being the wheel's marks in order", () => {
  expect(TUNE_MARKS).toEqual(["▲", "●", "◆", "■", "★", "✚"]);
  expect(tuneOf("◆ ★ ▲ ●")).toEqual([2, 4, 0, 1]);
  expect(tuneOf("✚ ✚ ■ ▲")).toEqual([5, 5, 3, 0]);      // a mark may repeat
  expect(tuneOf("  ◆★\n▲ - ● .")).toEqual([2, 4, 0, 1]);  // only the marks count
  expect(tuneOf("no marks")).toEqual([]);
});

test("each pin plucks as it comes to the comb: the first a little after the box is opened, the rest a step apart, and again every turn", () => {
  for (let k = 0; k < 4; k++) {
    const at = LEAD_IN + k * NOTE_STEP;
    expect(plucks(k, at - 0.01)).toBe(0);
    expect(plucks(k, at)).toBe(1);
    expect(plucks(k, at + 359.9)).toBe(1);
    expect(plucks(k, at + 360)).toBe(2);
    // It plucks where it goes over the cylinder's edge onto the tooth.
    expect(pinAngle(k, at)).toBeCloseTo(PLUCK_AT);
    expect(pinAngle(k, at + 360)).toBeCloseTo(PLUCK_AT);
  }
  expect(plucks(0, 0)).toBe(0);
});

test("cranking plays the notes in order, then a bare stretch, then the same again", () => {
  const notes = tuneOf("◆ ★ ▲ ●");
  const heard: number[] = [];
  let turn = 0;
  // Two and a half turns of the cylinder, in the small steps a finger gives it.
  for (let step = 0; step < 4500; step++) {
    const next = turn + 0.2;
    notes.forEach((tooth, j) => plucks(j, next) > plucks(j, turn) && heard.push(tooth));
    turn = next;
  }
  expect(heard).toEqual([2, 4, 0, 1, 2, 4, 0, 1, 2, 4, 0, 1]);
  // The whole tune takes less than half the cylinder: it has a beginning.
  expect(3 * NOTE_STEP).toBeLessThan(180);
  // A turn of the crank is a third of a turn of the cylinder: two notes or so.
  expect(360 * GEAR).toBeGreaterThan(2 * NOTE_STEP);
});

test("shown still, the cylinder lies with every pin in view, the first nearest the comb, none yet plucked", () => {
  const turn = parkedTurn(4);
  const angles = [0, 1, 2, 3].map((k) => pinAngle(k, turn));
  for (const a of angles) expect(Math.abs(a)).toBeLessThan(90);
  expect(angles[0]).toBeGreaterThan(angles[1]);
  expect(angles[0]).toBeCloseTo(-angles[3]);
  for (let k = 0; k < 4; k++) expect(plucks(k, turn)).toBe(0);
});

test("the crank follows the finger the short way round, clockwise or back", () => {
  expect(crankStep(0.1, 0.3)).toBeCloseTo(0.2);
  expect(crankStep(0.3, 0.1)).toBeCloseTo(-0.2);
  expect(crankStep(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);   // across the seam of atan2
  expect(crankStep(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
});

test("the ribbon's line is out once its last letter is clear of the spool", () => {
  // 100 points out already, the spool hiding 88: a 200-point line needs the leader, itself, a little clear, and what the spool hides.
  expect(pullToRead(200, 100, 88)).toBe(LEADER + 200 + CLEAR + 88 - 100);
  expect(pullToRead(0, 500, 10)).toBe(0);
});

test("the spool's top flange steps through its pictures as the ribbon is pulled, and comes round every sixth of a turn", () => {
  const radius = 52;
  const sixth = (radius * Math.PI) / 3;
  expect(flangeFrame(0, radius, 8)).toBe(0);
  expect(flangeFrame(sixth * 0.51, radius, 8)).toBe(4);
  expect(flangeFrame(sixth * 0.999, radius, 8)).toBe(7);
  expect(flangeFrame(sixth * 1.01, radius, 8)).toBe(0);
  const seen = new Set(Array.from({ length: 200 }, (_, i) => flangeFrame((i * sixth) / 200, radius, 8)));
  expect([...seen].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
});
