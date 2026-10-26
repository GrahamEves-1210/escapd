import { WRONG_ACCUSATION, cooldownText, secondsUntil } from "../accuse";

describe("the Accuse screen's cooldown line", () => {
  const now = Date.parse("2026-10-26T12:00:00.000Z");

  it("counts whole seconds to retry_after, rounding up, and never below zero", () => {
    expect(secondsUntil("2026-10-26T12:00:45.000Z", now)).toBe(45);
    expect(secondsUntil("2026-10-26T12:00:44.200Z", now)).toBe(45);
    expect(secondsUntil("2026-10-26T11:59:00.000Z", now)).toBe(0);
    expect(secondsUntil(undefined, now)).toBe(0);
    expect(secondsUntil("not a time", now)).toBe(0);
  });

  it("says the wait in plain words, minutes and seconds, and nothing once it's over", () => {
    expect(cooldownText(45)).toBe("You can accuse again in 0:45.");
    expect(cooldownText(90)).toBe("You can accuse again in 1:30.");
    expect(cooldownText(605)).toBe("You can accuse again in 10:05.");
    expect(cooldownText(0)).toBeNull();
  });

  it("answers every wrong accusation the same way", () => {
    expect(WRONG_ACCUSATION).toBe("That doesn't add up.");
  });
});
