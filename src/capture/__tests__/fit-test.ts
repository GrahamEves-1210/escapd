import { fittedLongEdge } from "../fit";

describe("fittedLongEdge", () => {
  it("caps the long side at 1600 and keeps the aspect", () => {
    expect(fittedLongEdge(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fittedLongEdge(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fittedLongEdge(8000, 1000)).toEqual({ width: 1600, height: 200 });
  });

  it("does not enlarge a plate that is already small", () => {
    expect(fittedLongEdge(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("refuses an unknown size", () => {
    expect(fittedLongEdge(0, 1200)).toBeNull();
    expect(fittedLongEdge(1200, 0)).toBeNull();
  });
});
