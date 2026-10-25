import { formatDuration, plateNumeral } from "../format";

describe("formatDuration", () => {
  it("reads naturally at every scale", () => {
    expect(formatDuration(20_000)).toBe("Under a minute");
    expect(formatDuration(9 * 60_000 + 40_000)).toBe("10 min");
    expect(formatDuration(65 * 60_000)).toBe("1 h 5 min");
    expect(formatDuration(120 * 60_000)).toBe("2 h");
  });
});

describe("plateNumeral", () => {
  it("stamps contact-sheet frames", () => {
    expect(plateNumeral(0)).toBe("I");
    expect(plateNumeral(2)).toBe("III");
    expect(plateNumeral(6)).toBe("7");
  });
});
