import { addPlate, clearPlates, currentTicket, firstOpenSlot, getPlates, getSlots, removePlate, replacePlate, setTicketRoom } from "../roll";

const plate = (n: number) => ({ uri: `file://plate-${n}.jpg`, width: 1200, height: 1600 });
const uris = () => getSlots().map((slot) => slot?.uri ?? null);

beforeEach(() => {
  clearPlates();
});

describe("photos by slot", () => {
  it("keeps up to six photos and replaces one in place", () => {
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
