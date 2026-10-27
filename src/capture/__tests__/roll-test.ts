import {
  addPlate,
  clearPlates,
  currentTicket,
  firstOpenSlot,
  getPlates,
  getRollGenre,
  getRollPlan,
  getRollPlanState,
  getSlots,
  removePlate,
  replacePlate,
  setRollGenre,
  setRollLens,
  setTicketRoom,
} from "../roll";

const plate = (n: number) => ({ uri: `file://plate-${n}.jpg`, width: 1200, height: 1600 });
const uris = () => getSlots().map((slot) => slot?.uri ?? null);

beforeEach(() => {
  clearPlates();
});

describe("photos by slot", () => {
  it("keeps up to six photos (1x, or no camera yet) and replaces one in place", () => {
    for (let i = 0; i < 6; i++) expect(addPlate(plate(i))).toBe(true);
    expect(addPlate(plate(6))).toBe(false);
    expect(getPlates()).toHaveLength(6);
    expect(firstOpenSlot()).toBeNull();
    expect(replacePlate(1, plate(9))).toBe(true);
    expect(getSlots()[1]?.uri).toBe("file://plate-9.jpg");
    expect(replacePlate(8, plate(0))).toBe(false);
  });

  it("removing a photo leaves its slot open; the others keep theirs", () => {
    for (let i = 0; i < 4; i++) addPlate(plate(i));
    expect(removePlate(1)).toBe(true);
    expect(uris()).toEqual(["file://plate-0.jpg", null, "file://plate-2.jpg", "file://plate-3.jpg"]);
    // The filled photos, in slot order, are what the rules count.
    expect(getPlates().map((p) => p.uri)).toEqual(["file://plate-0.jpg", "file://plate-2.jpg", "file://plate-3.jpg"]);
    // Removing an open slot, or one past the end, does nothing.
    expect(removePlate(1)).toBe(false);
    expect(removePlate(7)).toBe(false);
  });

  it("the next photo fills the first open slot, then continues after the last", () => {
    for (let i = 0; i < 4; i++) addPlate(plate(i));
    removePlate(0);
    removePlate(2);
    expect(firstOpenSlot()).toBe(0);
    addPlate(plate(10));
    expect(uris()).toEqual(["file://plate-10.jpg", "file://plate-1.jpg", null, "file://plate-3.jpg"]);
    addPlate(plate(12));
    expect(firstOpenSlot()).toBe(4);
    addPlate(plate(14));
    expect(uris()).toEqual(["file://plate-10.jpg", "file://plate-1.jpg", "file://plate-12.jpg", "file://plate-3.jpg", "file://plate-14.jpg"]);
  });

  it("a retake of an open slot fills exactly that slot; no slot past the next can be skipped to", () => {
    for (let i = 0; i < 4; i++) addPlate(plate(i));
    removePlate(2);
    expect(replacePlate(2, plate(22))).toBe(true);
    expect(uris()).toEqual(["file://plate-0.jpg", "file://plate-1.jpg", "file://plate-22.jpg", "file://plate-3.jpg"]);
    expect(replacePlate(5, plate(5))).toBe(false);
    expect(replacePlate(4, plate(4))).toBe(true);
  });

  it("removing the last photo shortens the set: no trailing open slots", () => {
    for (let i = 0; i < 4; i++) addPlate(plate(i));
    removePlate(1);
    removePlate(3);
    expect(uris()).toEqual(["file://plate-0.jpg", null, "file://plate-2.jpg"]);
    removePlate(2);
    expect(uris()).toEqual(["file://plate-0.jpg"]);
  });

  it("drops the build ticket whenever a slot changes", () => {
    addPlate(plate(0));
    const ticket = currentTicket();
    setTicketRoom("r1");
    expect(currentTicket()).toBe(ticket);
    addPlate(plate(1));
    expect(currentTicket()).not.toBe(ticket);
    const second = currentTicket();
    removePlate(0);
    expect(currentTicket()).not.toBe(second);
    const third = currentTicket();
    replacePlate(0, plate(2));
    expect(currentTicket()).not.toBe(third);
  });
});

describe("the roll's mode", () => {
  beforeEach(() => setRollGenre(null));

  it("drops the build ticket when it changes, not when it is set again", () => {
    addPlate(plate(0));
    setRollGenre("paranormal");
    const ticket = currentTicket();
    setTicketRoom("r1");
    setRollGenre("paranormal");
    expect(currentTicket()).toBe(ticket);
    setRollGenre("noir");
    expect(currentTicket()).not.toBe(ticket);
    expect(currentTicket().roomId).toBeNull();
  });

  it("stays through clearPlates, so a retake after a failed build keeps its mode", () => {
    setRollGenre("crime_scene");
    addPlate(plate(0));
    clearPlates();
    expect(getRollGenre()).toBe("crime_scene");
  });
});

describe("the roll's plan: its target and stops", () => {
  it("plans 1x's 6 (the server's cap) until a camera says which lens", () => {
    expect(getRollPlanState().lens).toBeNull();
    expect(getRollPlan().shots).toBe(6);
  });

  it("aims at 4 on 0.5x: the 5th photo is refused and the 4th fills the roll", () => {
    setRollLens("wide");
    expect(getRollPlan().stops).toEqual([0, 90, 180, 270]);
    for (let i = 0; i < 4; i++) expect(addPlate(plate(i))).toBe(true);
    expect(firstOpenSlot()).toBeNull();
    expect(addPlate(plate(4))).toBe(false);
    expect(replacePlate(4, plate(4))).toBe(false);
    expect(getPlates()).toHaveLength(4);
  });

  it("removing from a 4-photo plan leaves the slot open and the next photo fills it, within 4", () => {
    setRollLens("wide");
    for (let i = 0; i < 4; i++) addPlate(plate(i));
    removePlate(2);
    expect(firstOpenSlot()).toBe(2);
    expect(addPlate(plate(9))).toBe(true);
    expect(uris()[2]).toBe("file://plate-9.jpg");
    expect(firstOpenSlot()).toBeNull();
    // Removing the last leaves 3 in use: the 4th stop is still the target.
    removePlate(3);
    expect(firstOpenSlot()).toBe(3);
    expect(getRollPlan().shots).toBe(4);
  });

  it("re-spaces the stops still to take when the lens changes mid-roll, never below the photos taken", () => {
    setRollLens("wide");
    for (let i = 0; i < 3; i++) addPlate(plate(i));
    setRollLens("main");
    expect(getRollPlan().stops).toEqual([0, 90, 180, 225, 270, 315]);
    // Back on 0.5x before the next photo: its own 4 again.
    setRollLens("wide");
    expect(getRollPlan().stops).toEqual([0, 90, 180, 270]);
  });

  it("keeps the plan once every stop is taken: 4 on 0.5x stays 4 on 1x", () => {
    setRollLens("wide");
    for (let i = 0; i < 4; i++) addPlate(plate(i));
    setRollLens("main");
    expect(getRollPlan().shots).toBe(4);
    expect(addPlate(plate(4))).toBe(false);
  });

  it("starts an even circle again for the lens in use once the roll is empty, and clearPlates forgets the lens", () => {
    setRollLens("wide");
    for (let i = 0; i < 3; i++) addPlate(plate(i));
    setRollLens("main");
    for (let i = 2; i >= 0; i--) removePlate(i);
    expect(getRollPlan().stops).toEqual([0, 60, 120, 180, 240, 300]);
    expect(getRollPlanState().lens).toBe("main");
    clearPlates();
    expect(getRollPlanState().lens).toBeNull();
  });

  it("a lens change keeps the photos and the build ticket", () => {
    addPlate(plate(0));
    const ticket = currentTicket();
    setRollLens("wide");
    expect(currentTicket()).toBe(ticket);
    expect(getPlates()).toHaveLength(1);
  });
});
