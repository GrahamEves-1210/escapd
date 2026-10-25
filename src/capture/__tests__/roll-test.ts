import { addPlate, clearPlates, getPlates, replacePlate } from "../roll";

const plate = (n: number) => ({ uri: `file://plate-${n}.jpg`, width: 1200, height: 1600 });

beforeEach(() => {
  clearPlates();
});

describe("roll", () => {
  it("keeps up to six plates and replaces one in place", () => {
    for (let i = 0; i < 6; i++) expect(addPlate(plate(i))).toBe(true);
    expect(addPlate(plate(6))).toBe(false);
    expect(getPlates()).toHaveLength(6);
    expect(replacePlate(1, plate(9))).toBe(true);
    expect(getPlates()[1].uri).toBe("file://plate-9.jpg");
    expect(replacePlate(8, plate(0))).toBe(false);
  });
});
