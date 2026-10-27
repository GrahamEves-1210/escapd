import { act, renderHook } from "@testing-library/react-native";
import { AppState } from "react-native";
import { setMode } from "../mode";
import { resetMusicForTests, setMusic, trackFor } from "../music";
import { MUSIC, ROOM_TONE_FADE, resetSoundsForTests } from "../sound";
import { useMusic } from "../useMusic";
import { useRoomTone } from "../useRoomTone";

const mockPrefs = { sound_enabled: true, music_enabled: true, haptics_enabled: true };
jest.mock("@/game/preferences", () => ({ usePreferences: () => mockPrefs }));
jest.mock("expo-router", () => ({ useIsFocused: () => true }));

interface MockPlayer {
  source: unknown;
  volume: number;
  loop: boolean;
  playing: boolean;
  isLoaded: boolean;
  play: jest.Mock;
  pause: jest.Mock;
  seekTo: jest.Mock;
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const audio = require("expo-audio") as {
  createAudioPlayer: jest.Mock;
  setAudioModeAsync: jest.Mock;
  __players: MockPlayer[];
  __failNextLoad: (count?: number) => void;
  __reset: () => void;
};

// Jest turns every asset into the same number; these get their own names so a test can tell the players apart.
jest.mock("../../../assets/music/theme.m4a", () => "theme.m4a");
jest.mock("../../../assets/music/crime.m4a", () => "crime.m4a");
jest.mock("../../../assets/music/paranormal.mp3", () => "paranormal.mp3");
jest.mock("../../../assets/audio/room-noir.m4a", () => "room-noir.m4a");
const SOURCE = { theme: "theme.m4a", crime: "crime.m4a", paranormal: "paranormal.mp3", roomNoir: "room-noir.m4a" };

const playerFor = (source: unknown) => audio.__players.find((p) => p.source === source);
const loadsOf = (source: unknown) => audio.createAudioPlayer.mock.calls.filter(([s]) => s === source).length;
const fade = () => act(() => jest.advanceTimersByTime(MUSIC.fade.cross + 2 * MUSIC.fade.step));
const stop = () => act(() => jest.advanceTimersByTime(MUSIC.fade.stop + 2 * MUSIC.fade.step));

// React Native's AppState mock: a listener store and a real state, put back after each test.
const listeners: ((state: string) => void)[] = [];
const originalAdd = AppState.addEventListener;
const originalState = AppState.currentState;
const set = (key: "addEventListener" | "currentState", value: unknown) =>
  Object.defineProperty(AppState, key, { value, configurable: true, writable: true });
const goTo = (state: string) =>
  act(async () => {
    set("currentState", state);
    listeners.forEach((l) => l(state));
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  resetSoundsForTests();
  resetMusicForTests();
  audio.__reset();
  mockPrefs.sound_enabled = true;
  mockPrefs.music_enabled = true;
  listeners.length = 0;
  set("addEventListener", (_type: string, listener: (state: string) => void) => {
    listeners.push(listener);
    return { remove: jest.fn() };
  });
  set("currentState", "active");
  setMode(null);
});

afterEach(() => {
  set("currentState", originalState);
  set("addEventListener", originalAdd);
  jest.useRealTimers();
});

describe("music", () => {
  it("picks a track per mode: the theme for the shell and noir, crime and paranormal their own", () => {
    expect(trackFor(null)).toBe("theme");
    expect(trackFor("noir")).toBe("theme");
    expect(trackFor("crime_scene")).toBe("crime");
    expect(trackFor("paranormal")).toBe("paranormal");
  });

  it("starts the theme at app start in the shell, looping and fading up to the music level, in the effects' session", async () => {
    await renderHook(() => useMusic());
    const theme = playerFor(SOURCE.theme)!;
    expect(theme.loop).toBe(true);
    expect(theme.play).toHaveBeenCalled();
    expect(theme.volume).toBe(0);
    await act(() => jest.advanceTimersByTime(MUSIC.fade.cross / 2));
    expect(theme.volume).toBeGreaterThan(0);
    expect(theme.volume).toBeLessThan(MUSIC.level);
    await fade();
    expect(theme.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
    expect(audio.setAudioModeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }),
    );
    expect(audio.__players).toHaveLength(1);
  });

  it("plays each mode's track: crime for Crime Scene, paranormal for Paranormal", async () => {
    setMode("crime_scene");
    await renderHook(() => useMusic());
    await fade();
    expect(playerFor(SOURCE.crime)!.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.crime.trim);
    await act(async () => setMode("paranormal"));
    await fade();
    expect(playerFor(SOURCE.paranormal)!.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.paranormal.trim);
    expect(playerFor(SOURCE.crime)!.volume).toBe(0);
    expect(playerFor(SOURCE.theme)).toBeUndefined();
  });

  it("keeps the theme playing, without a restart, between the shell and noir", async () => {
    await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    const volumes: number[] = [];
    await act(async () => setMode("noir"));
    for (let t = 0; t < MUSIC.fade.cross; t += MUSIC.fade.step) {
      await act(() => jest.advanceTimersByTime(MUSIC.fade.step));
      volumes.push(theme.volume);
    }
    await act(async () => setMode(null));
    await fade();
    expect(Math.min(...volumes)).toBeCloseTo(MUSIC.level);
    expect(theme.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
    expect(theme.seekTo).not.toHaveBeenCalled();
    expect(theme.pause).not.toHaveBeenCalled();
    expect(loadsOf(SOURCE.theme)).toBe(1);
  });

  it("crossfades over about 1.2 s on a mode change: one fades down as the other comes up, the old one then pauses", async () => {
    await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    await act(async () => setMode("crime_scene"));
    const crime = playerFor(SOURCE.crime)!;
    expect(crime.play).toHaveBeenCalled();
    await act(() => jest.advanceTimersByTime(MUSIC.fade.cross / 2));
    // Halfway: both sound.
    expect(theme.volume).toBeGreaterThan(0);
    expect(theme.volume).toBeLessThan(MUSIC.level);
    expect(crime.volume).toBeGreaterThan(0);
    expect(crime.volume).toBeLessThan(MUSIC.level);
    expect(theme.pause).not.toHaveBeenCalled();
    await fade();
    expect(theme.volume).toBe(0);
    expect(theme.pause).toHaveBeenCalled();
    expect(crime.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.crime.trim);
    expect(MUSIC.fade.cross).toBe(1200);
  });

  it("starts a mode's track again from its top when it comes back after another's", async () => {
    await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    await act(async () => setMode("paranormal"));
    await fade();
    await act(async () => setMode(null));
    expect(theme.seekTo).toHaveBeenCalledWith(0);
    expect(theme.play).toHaveBeenCalledTimes(2);
  });

  it("never seeks a track that hasn't loaded (iOS kills the app for that); it still plays", async () => {
    await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    await act(async () => setMode("crime_scene"));
    await fade();
    theme.isLoaded = false;
    await act(async () => setMode(null));
    expect(theme.seekTo).not.toHaveBeenCalled();
    expect(theme.play).toHaveBeenCalledTimes(2);
    await fade();
    expect(theme.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
  });

  it("follows music_enabled: off fades out at once and pauses, on fades back in where it was", async () => {
    const { rerender } = await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    mockPrefs.music_enabled = false;
    await rerender({});
    await act(() => jest.advanceTimersByTime(MUSIC.fade.step));
    expect(theme.volume).toBeLessThan(MUSIC.level);
    await stop();
    expect(theme.volume).toBe(0);
    expect(theme.pause).toHaveBeenCalled();
    mockPrefs.music_enabled = true;
    await rerender({});
    await fade();
    expect(theme.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
    // Resumed, not restarted.
    expect(theme.seekTo).not.toHaveBeenCalled();
  });

  it("is independent of sound_enabled, and never loads with music off", async () => {
    mockPrefs.sound_enabled = false;
    mockPrefs.music_enabled = false;
    const { rerender } = await renderHook(() => useMusic());
    await fade();
    expect(audio.__players).toHaveLength(0);
    mockPrefs.music_enabled = true;
    await rerender({});
    await fade();
    expect(playerFor(SOURCE.theme)!.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
  });

  it("fades out when the app goes inactive, pauses at once in the background, and resumes on return", async () => {
    await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    await goTo("inactive");
    await stop();
    expect(theme.volume).toBe(0);
    expect(theme.pause).toHaveBeenCalledTimes(1);
    await goTo("active");
    await fade();
    expect(theme.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
    // Straight to the background: silent and paused before any timer runs.
    await goTo("background");
    expect(theme.volume).toBe(0);
    expect(theme.pause).toHaveBeenCalledTimes(2);
    await goTo("active");
    await fade();
    expect(theme.volume).toBeCloseTo(MUSIC.level * MUSIC.tracks.theme.trim);
    expect(theme.seekTo).not.toHaveBeenCalled();
  });

  it("lowers the room tone while music plays and brings it back when the music stops", async () => {
    setMode("noir");
    await renderHook(() => useRoomTone(true));
    await act(() => jest.advanceTimersByTime(ROOM_TONE_FADE.in + 2 * ROOM_TONE_FADE.step));
    const tone = playerFor(SOURCE.roomNoir)!;
    const full = tone.volume;
    expect(full).toBeGreaterThan(0);
    const { rerender } = await renderHook(() => useMusic());
    await fade();
    expect(tone.volume).toBeCloseTo(full * MUSIC.roomTone);
    mockPrefs.music_enabled = false;
    await rerender({});
    await fade();
    expect(tone.volume).toBeCloseTo(full);
  });

  it("a failed load is silence: no throw, no retry storm, and the room tone isn't lowered for it", async () => {
    // The theme's load fails; the room tone's, after it, works.
    audio.__failNextLoad(1);
    const { rerender } = await renderHook(() => useMusic());
    expect(() => setMusic("theme")).not.toThrow();
    await act(async () => setMode("noir"));
    await rerender({});
    await renderHook(() => useRoomTone(true));
    await act(() => jest.advanceTimersByTime(ROOM_TONE_FADE.in + MUSIC.fade.duck));
    expect(loadsOf(SOURCE.theme)).toBe(1);
    expect(playerFor(SOURCE.theme)).toBeUndefined();
    const tone = playerFor(SOURCE.roomNoir)!;
    // The room tone at its full level: nothing is playing over it.
    expect(tone.volume).toBeCloseTo(0.12);
  });

  it("a player that throws on play or seek is silence too", async () => {
    await renderHook(() => useMusic());
    await fade();
    const theme = playerFor(SOURCE.theme)!;
    theme.play.mockImplementation(() => {
      throw new Error("no audio session");
    });
    theme.seekTo.mockImplementation(() => {
      throw new Error("not ready");
    });
    await act(async () => setMode("crime_scene"));
    await fade();
    expect(() => setMusic("theme")).not.toThrow();
  });
});
