import { renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useFeedback } from "../feedback";
import { resetSoundsForTests } from "../sound";

// The real cues: setup.js replaces feedback with spies for everyone else.
jest.unmock("@/game/feedback");

const mockPrefs = { sound_enabled: true, haptics_enabled: true };
jest.mock("@/game/preferences", () => ({ usePreferences: () => mockPrefs }));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: "light", Medium: "medium", Heavy: "heavy" },
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const audio = require("expo-audio") as {
  createAudioPlayer: jest.Mock;
  setAudioModeAsync: jest.Mock;
  __players: { source: unknown; volume: number; loop: boolean; playing: boolean; play: jest.Mock; pause: jest.Mock; seekTo: jest.Mock }[];
  __failNextLoad: (count?: number) => void;
  __reset: () => void;
};

// Jest turns every asset into the same number; these get their own names so a
// test can tell the players apart.
jest.mock("../../../assets/audio/paper.m4a", () => "paper.m4a");
jest.mock("../../../assets/audio/unlock.m4a", () => "unlock.m4a");
jest.mock("../../../assets/audio/stamp.m4a", () => "stamp.m4a");
jest.mock("../../../assets/audio/drawer.m4a", () => "drawer.m4a");
jest.mock("../../../assets/audio/shutter.m4a", () => "shutter.m4a");
jest.mock("../../../assets/audio/door-out.m4a", () => "door-out.m4a");
jest.mock("../../../assets/audio/candle-out.m4a", () => "candle-out.m4a");
jest.mock("../../../assets/audio/music-note-0.m4a", () => "music-note-0.m4a");
jest.mock("../../../assets/audio/music-note-1.m4a", () => "music-note-1.m4a");
jest.mock("../../../assets/audio/music-note-2.m4a", () => "music-note-2.m4a");
jest.mock("../../../assets/audio/music-note-3.m4a", () => "music-note-3.m4a");
jest.mock("../../../assets/audio/music-note-4.m4a", () => "music-note-4.m4a");
jest.mock("../../../assets/audio/music-note-5.m4a", () => "music-note-5.m4a");
const SOURCE = {
  paper: "paper.m4a",
  unlock: "unlock.m4a",
  stamp: "stamp.m4a",
  drawer: "drawer.m4a",
  shutter: "shutter.m4a",
  doorOut: "door-out.m4a",
  candleOut: "candle-out.m4a",
} as const;

// The few cues with a sound: something physical in the world that the player earned.
const SOUNDING = ["paper", "unlock", "stamp", "drawer", "shutter", "doorOut", "candleOut"] as const;
// Everything else is felt, not heard: buttons, taps, selections, outcomes, the letter, the cat, the tools.
const SILENT = [
  "tick", "tap", "press", "thud", "success", "warning", "error", "pickup", "wrongCode", "solved", "typewriter", "cloth",
  "snap", "detent", "uvSwitch", "lensUp", "lensDown", "purr", "mugBreak", "pencilRub", "paperFold", "waxCrack", "stringOff",
] as const;

const playerFor = (source: unknown) => audio.__players.find((p) => p.source === source);
const played = () => audio.__players.filter((p) => p.play.mock.calls.length > 0);
const haptics = () =>
  (Haptics.selectionAsync as jest.Mock).mock.calls.length +
  (Haptics.impactAsync as jest.Mock).mock.calls.length +
  (Haptics.notificationAsync as jest.Mock).mock.calls.length;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetSoundsForTests();
  audio.__reset();
  mockPrefs.sound_enabled = true;
  mockPrefs.haptics_enabled = true;
});

afterEach(() => {
  jest.useRealTimers();
});

describe("cues", () => {
  it("sets the session to respect the silent switch and mix with the player's own audio", async () => {
    await renderHook(() => useFeedback());
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }),
    );
  });

  it("loading the effects plays nothing: no screen sounds by opening", async () => {
    await renderHook(() => useFeedback());
    jest.runAllTimers();
    expect(audio.createAudioPlayer.mock.calls.length).toBeGreaterThan(5);
    expect(played()).toEqual([]);
  });

  it("preloads the effects once, then a cue plays its own sound from the start, with its haptic", async () => {
    const { result } = await renderHook(() => useFeedback());
    const loaded = audio.createAudioPlayer.mock.calls.length;
    result.current.unlock();
    const unlock = playerFor(SOURCE.unlock)!;
    expect(unlock.seekTo).toHaveBeenCalledWith(0);
    expect(unlock.play).toHaveBeenCalledTimes(1);
    expect(played()).toEqual([unlock]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
    // Again: the same player, not a new load.
    result.current.unlock();
    expect(unlock.play).toHaveBeenCalledTimes(2);
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(loaded);
  });

  it("each sounding cue plays one sound of its own", async () => {
    const { result } = await renderHook(() => useFeedback());
    for (const cue of SOUNDING) {
      result.current[cue]();
      expect(played()).toEqual([playerFor(SOURCE[cue])]);
      playerFor(SOURCE[cue])!.play.mockClear();
    }
  });

  it("every other cue is silent, and still felt (all but the sound-only ones, which are now nothing)", async () => {
    const { result } = await renderHook(() => useFeedback());
    for (const cue of SILENT) {
      const before = haptics();
      result.current[cue]();
      jest.runAllTimers();
      expect(played()).toEqual([]);
      if (cue === "typewriter" || cue === "mugBreak" || cue === "pencilRub") expect(haptics()).toBe(before);
      else expect(haptics()).toBeGreaterThan(before);
    }
  });

  it("a sounding cue asked to be quiet keeps its haptic and makes no sound", async () => {
    const { result } = await renderHook(() => useFeedback());
    result.current.paper(false);
    result.current.stamp(false);
    result.current.unlock(false);
    jest.runAllTimers();
    expect(played()).toEqual([]);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.impactAsync).toHaveBeenCalledWith("heavy");
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("plays nothing when sound is off, and the haptics are untouched", async () => {
    mockPrefs.sound_enabled = false;
    const { result } = await renderHook(() => useFeedback());
    for (const cue of SOUNDING) result.current[cue]();
    for (let i = 0; i < 6; i++) result.current.musicNote(i);
    jest.runAllTimers();
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(played()).toEqual([]);
    expect(haptics()).toBeGreaterThanOrEqual(SOUNDING.length + 6);
  });

  it("haptics off leaves the sound on", async () => {
    mockPrefs.haptics_enabled = false;
    const { result } = await renderHook(() => useFeedback());
    result.current.shutter();
    result.current.drawer();
    jest.runAllTimers();
    expect(haptics()).toBe(0);
    expect(played()).toHaveLength(2);
  });

  it("every effect sits low in the mix, well under the music; the ending's moment and the lock a touch over a page", async () => {
    const { result } = await renderHook(() => useFeedback());
    for (const cue of SOUNDING) result.current[cue]();
    const volume = (cue: (typeof SOUNDING)[number]) => playerFor(SOURCE[cue])!.volume;
    for (const cue of SOUNDING) {
      expect(volume(cue)).toBeGreaterThan(0);
      expect(volume(cue)).toBeLessThanOrEqual(0.25);
    }
    expect(volume("paper")).toBeLessThan(volume("unlock"));
    expect(volume("paper")).toBeLessThan(volume("doorOut"));
  });

  it("the drawer's firm haptic lands at its stop, on the sound's knock", async () => {
    const { result } = await renderHook(() => useFeedback());
    result.current.drawer();
    expect(playerFor(SOURCE.drawer)!.play).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(Haptics.impactAsync).not.toHaveBeenCalledWith("medium");
    jest.advanceTimersByTime(170);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("medium");
  });

  it("the lock's light haptic lands on its latch, 110 ms in", async () => {
    const { result } = await renderHook(() => useFeedback());
    result.current.unlock();
    expect(Haptics.impactAsync).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(110);
    expect(Haptics.impactAsync).toHaveBeenLastCalledWith("light");
  });

  it("the candle's sound starts at once; its light tap waits for the puff, 450 ms in", async () => {
    const { result } = await renderHook(() => useFeedback());
    result.current.candleOut();
    expect(played()).toEqual([playerFor(SOURCE.candleOut)]);
    expect(haptics()).toBe(0);
    jest.advanceTimersByTime(449);
    expect(haptics()).toBe(0);
    jest.advanceTimersByTime(1);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(haptics()).toBe(1);
  });

  describe("the music box", () => {
    const notePlayers = (i: number) => audio.__players.filter((p) => p.source === `music-note-${i}.m4a`);
    const notePlays = (i: number) => notePlayers(i).reduce((n, p) => n + p.play.mock.calls.length, 0);

    it("each of the six teeth plays its own file, low to high, with the tick haptic, at one gentle level", async () => {
      const { result } = await renderHook(() => useFeedback());
      for (let i = 0; i < 6; i++) {
        result.current.musicNote(i);
        // Its own file and no other: every tooth so far has played once.
        expect([0, 1, 2, 3, 4, 5].map(notePlays)).toEqual([0, 1, 2, 3, 4, 5].map((j) => (j <= i ? 1 : 0)));
        expect(Haptics.selectionAsync).toHaveBeenCalledTimes(i + 1);
      }
      expect(played().every((p) => String(p.source).startsWith("music-note-"))).toBe(true);
      const volumes = new Set(played().map((p) => p.volume));
      expect(volumes.size).toBe(1);
      expect([...volumes][0]).toBeGreaterThan(0);
      expect([...volumes][0]).toBeLessThanOrEqual(0.15);
    });

    it("ignores anything that isn't one of the six teeth: no sound, no haptic, no throw", async () => {
      const { result } = await renderHook(() => useFeedback());
      expect(() => {
        for (const i of [-1, 6, 7, 100, 1.5, NaN, Infinity]) result.current.musicNote(i);
      }).not.toThrow();
      expect(played()).toEqual([]);
      expect(haptics()).toBe(0);
    });

    it("notes ring out: another tooth never touches the one still sounding, and the same tooth again takes its second voice", async () => {
      const { result } = await renderHook(() => useFeedback());
      result.current.musicNote(0);
      const first = played()[0];
      first.seekTo.mockClear();
      // A different tooth: a different player; the first is neither sought, paused nor replayed.
      result.current.musicNote(3);
      expect(first.play).toHaveBeenCalledTimes(1);
      expect(first.seekTo).not.toHaveBeenCalled();
      expect(first.pause).not.toHaveBeenCalled();
      // The same tooth again: its other voice, so the first keeps ringing.
      result.current.musicNote(0);
      expect(notePlayers(0)).toHaveLength(2);
      expect(notePlayers(0).map((p) => p.play.mock.calls.length)).toEqual([1, 1]);
      expect(first.seekTo).not.toHaveBeenCalled();
      // A run on one tooth alternates between its two voices.
      for (let i = 0; i < 8; i++) result.current.musicNote(0);
      expect(notePlayers(0).map((p) => p.play.mock.calls.length)).toEqual([5, 5]);
    });

    it("plays without a haptic when the box plays by itself, and not at all with sound off", async () => {
      const { result, rerender } = await renderHook(() => useFeedback());
      result.current.musicNote(2, false);
      expect(notePlays(2)).toBe(1);
      expect(haptics()).toBe(0);
      mockPrefs.sound_enabled = false;
      await rerender({});
      result.current.musicNote(2);
      expect(notePlays(2)).toBe(1);
      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    });
  });

  it("a failed load is silence: no throw, no retry storm, the haptic still lands", async () => {
    audio.__failNextLoad(100);
    const { result } = await renderHook(() => useFeedback());
    const attempts = audio.createAudioPlayer.mock.calls.length;
    expect(() => {
      result.current.stamp();
      result.current.stamp();
    }).not.toThrow();
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(attempts);
    expect(Haptics.impactAsync).toHaveBeenCalledWith("heavy");
  });

  it("never seeks a sound that hasn't loaded (iOS kills the app for that); it still plays from its start", async () => {
    const { result } = await renderHook(() => useFeedback());
    const unlock = playerFor(SOURCE.unlock)! as (typeof audio.__players)[number] & { isLoaded: boolean };
    // Still loading, or failed: no seek, just play.
    unlock.isLoaded = false;
    result.current.unlock();
    expect(unlock.seekTo).not.toHaveBeenCalled();
    expect(unlock.play).toHaveBeenCalledTimes(1);
    // Loaded: a replay starts over.
    unlock.isLoaded = true;
    result.current.unlock();
    expect(unlock.seekTo).toHaveBeenCalledWith(0);
    expect(unlock.play).toHaveBeenCalledTimes(2);
  });

  it("a page turned again and again reuses one player", async () => {
    const { result } = await renderHook(() => useFeedback());
    const loaded = audio.createAudioPlayer.mock.calls.length;
    for (let i = 0; i < 20; i++) result.current.paper();
    expect(audio.createAudioPlayer).toHaveBeenCalledTimes(loaded);
    expect(played()).toEqual([playerFor(SOURCE.paper)]);
    expect(playerFor(SOURCE.paper)!.play).toHaveBeenCalledTimes(20);
  });

  it("a player that throws on play is silence too", async () => {
    const { result } = await renderHook(() => useFeedback());
    playerFor(SOURCE.unlock)!.play.mockImplementation(() => {
      throw new Error("no audio session");
    });
    expect(() => result.current.unlock()).not.toThrow();
  });
});
