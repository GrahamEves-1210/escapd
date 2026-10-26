import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import * as Haptics from "expo-haptics";
import { useFeedback } from "../feedback";
import { setMode } from "../mode";
import { ROOM_TONE_FADE, resetSoundsForTests } from "../sound";
import { useRoomTone } from "../useRoomTone";

// The real cues: setup.js replaces feedback with spies for everyone else.
jest.unmock("@/game/feedback");

const mockPrefs = { sound_enabled: true, haptics_enabled: true };
jest.mock("@/game/preferences", () => ({ usePreferences: () => mockPrefs }));

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));

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
jest.mock("../../../assets/audio/unlock.m4a", () => "unlock.m4a");
jest.mock("../../../assets/audio/shutter.m4a", () => "shutter.m4a");
jest.mock("../../../assets/audio/typewriter.m4a", () => "typewriter.m4a");
jest.mock("../../../assets/audio/room-noir.m4a", () => "room-noir.m4a");
jest.mock("../../../assets/audio/room-paranormal.m4a", () => "room-paranormal.m4a");
const SOURCE = {
  unlock: "unlock.m4a",
  shutter: "shutter.m4a",
  typewriter: "typewriter.m4a",
  noir: "room-noir.m4a",
  paranormal: "room-paranormal.m4a",
};

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
  mockFocused = true;
  setMode(null);
});

afterEach(() => {
  jest.useRealTimers();
});

describe("cues with sound", () => {
  it("sets the session to respect the silent switch and mix with the player's own audio", async () => {
    await renderHook(() => useFeedback());
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }),
    );
  });

  it("preloads the effects once, then a cue plays its own sound from the start, with its haptic", async () => {
    const { result } = await renderHook(() => useFeedback());
    const loaded = audio.createAudioPlayer.mock.calls.length;
    expect(loaded).toBeGreaterThan(5);
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

  it("plays nothing when sound is off, and the haptics are untouched", async () => {
    mockPrefs.sound_enabled = false;
    const { result } = await renderHook(() => useFeedback());
    for (const cue of ["press", "thud", "paper", "pickup", "wrongCode", "unlock", "stamp", "solved", "shutter", "typewriter"] as const) {
      result.current[cue]();
    }
    jest.runAllTimers();
    expect(audio.createAudioPlayer).not.toHaveBeenCalled();
    expect(played()).toEqual([]);
    expect(haptics()).toBeGreaterThan(9);
  });

  it("haptics off leaves the sound on", async () => {
    mockPrefs.haptics_enabled = false;
    const { result } = await renderHook(() => useFeedback());
    result.current.shutter();
    result.current.solved();
    jest.runAllTimers();
    expect(haptics()).toBe(0);
    expect(playerFor(SOURCE.shutter)!.play).toHaveBeenCalledTimes(1);
    expect(played()).toHaveLength(2);
  });

  it("tick and the outcomes are silent; typewriter is sound only", async () => {
    const { result } = await renderHook(() => useFeedback());
    result.current.tick();
    result.current.success();
    result.current.warning();
    result.current.error();
    expect(played()).toEqual([]);
    const before = haptics();
    result.current.typewriter();
    expect(haptics()).toBe(before);
    expect(played()).toEqual([playerFor(SOURCE.typewriter)]);
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

  it("a player that throws on play is silence too", async () => {
    const { result } = await renderHook(() => useFeedback());
    playerFor(SOURCE.unlock)!.play.mockImplementation(() => {
      throw new Error("no audio session");
    });
    expect(() => result.current.unlock()).not.toThrow();
  });
});

describe("room tone", () => {
  const fadeIn = () => act(() => jest.advanceTimersByTime(ROOM_TONE_FADE.in + 2 * ROOM_TONE_FADE.step));
  const fadeOut = () => act(() => jest.advanceTimersByTime(ROOM_TONE_FADE.out + 2 * ROOM_TONE_FADE.step));

  it("starts and stops with active, fading in and out", async () => {
    const { rerender } = await renderHook(({ on }: { on: boolean }) => useRoomTone(on), { initialProps: { on: false } });
    expect(audio.__players).toHaveLength(0);

    await rerender({ on: true });
    const tone = playerFor(SOURCE.noir)!;
    expect(tone.loop).toBe(true);
    expect(tone.play).toHaveBeenCalled();
    expect(tone.volume).toBe(0);
    await act(() => jest.advanceTimersByTime(ROOM_TONE_FADE.in / 2));
    const half = tone.volume;
    expect(half).toBeGreaterThan(0);
    await fadeIn();
    expect(tone.volume).toBeGreaterThan(half);
    expect(tone.pause).not.toHaveBeenCalled();

    await rerender({ on: false });
    await fadeOut();
    expect(tone.volume).toBe(0);
    expect(tone.pause).toHaveBeenCalled();
  });

  it("plays the active mode's tone and crossfades when the mode changes", async () => {
    setMode("noir");
    await renderHook(() => useRoomTone(true));
    await fadeIn();
    await act(async () => setMode("paranormal"));
    await fadeIn();
    const noir = playerFor(SOURCE.noir)!;
    const paranormal = playerFor(SOURCE.paranormal)!;
    expect(noir.volume).toBe(0);
    expect(noir.pause).toHaveBeenCalled();
    expect(paranormal.volume).toBeGreaterThan(0);
  });

  it("stays silent when sound is off", async () => {
    mockPrefs.sound_enabled = false;
    await renderHook(() => useRoomTone(true));
    await fadeIn();
    expect(audio.__players).toHaveLength(0);
  });

  it("fades out when the screen loses focus or unmounts", async () => {
    const { rerender, unmount } = await renderHook(() => useRoomTone(true));
    await fadeIn();
    const tone = playerFor(SOURCE.noir)!;
    mockFocused = false;
    await rerender({});
    await fadeOut();
    expect(tone.volume).toBe(0);
    mockFocused = true;
    await rerender({});
    await fadeIn();
    expect(tone.volume).toBeGreaterThan(0);
    await unmount();
    await fadeOut();
    expect(tone.volume).toBe(0);
  });

  it("fades out when the app goes to the background", async () => {
    const listeners: ((state: string) => void)[] = [];
    // React Native's AppState mock: swap in a listener store and a real state, then put both back.
    const addEventListener = AppState.addEventListener;
    const original = AppState.currentState;
    const set = (key: "addEventListener" | "currentState", value: unknown) =>
      Object.defineProperty(AppState, key, { value, configurable: true, writable: true });
    const setState = (value: unknown) => set("currentState", value);
    set("addEventListener", (_type: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    });
    setState("active");
    await renderHook(() => useRoomTone(true));
    await fadeIn();
    const tone = playerFor(SOURCE.noir)!;
    expect(tone.volume).toBeGreaterThan(0);
    setState("background");
    await act(async () => listeners.forEach((l) => l("background")));
    await fadeOut();
    expect(tone.volume).toBe(0);
    expect(tone.pause).toHaveBeenCalled();
    setState(original);
    set("addEventListener", addEventListener);
  });

  it("a newer screen's claim wins over an older one letting go", async () => {
    const older = await renderHook(() => useRoomTone(true));
    await renderHook(() => useRoomTone(true));
    await fadeIn();
    await older.unmount();
    await fadeOut();
    expect(playerFor(SOURCE.noir)!.volume).toBeGreaterThan(0);
  });
});
