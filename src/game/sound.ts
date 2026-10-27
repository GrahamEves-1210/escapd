// Sound: short effects for the game's moments and a soft room tone under a
// case. Presentation only: nothing here may throw or block, and a platform
// without audio (the web), a failed load or a failed play is simply silence.
//
// Callers don't play sounds directly: feedback.ts gives each cue its sound
// (following the player's sound_enabled), useRoomTone.ts runs the ambience
// and music.ts / useMusic.ts the music. Every file and its level is here, in
// one place: EFFECTS, TONES and MUSIC. The files and how they were made are in docs/AUDIO.md; they are
// rebuilt by scripts/audio/generate.mjs.
//
// The audio session respects the iOS silent switch (playsInSilentMode: false,
// the "ambient" category; Android likewise stays quiet in silent or vibrate
// ringer modes) and mixes with whatever the player is listening to: it never
// stops or ducks their music, and asks for no audio focus.
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type { Genre } from "@/lib/puzzle-types";

export type SoundName =
  | "press"
  | "knock"
  | "paper"
  | "shutter"
  | "typewriter"
  | "unlock"
  | "wrongCode"
  | "pickup"
  | "stamp"
  | "solved";

const EFFECTS: Record<SoundName, { source: number; volume: number }> = {
  // A felt click, kept very quiet so buttons don't clatter.
  press: { source: require("../../assets/audio/press.m4a"), volume: 0.22 },
  knock: { source: require("../../assets/audio/knock.m4a"), volume: 0.45 },
  paper: { source: require("../../assets/audio/paper.m4a"), volume: 0.55 },
  shutter: { source: require("../../assets/audio/shutter.m4a"), volume: 0.95 },
  typewriter: { source: require("../../assets/audio/typewriter.m4a"), volume: 0.45 },
  unlock: { source: require("../../assets/audio/unlock.m4a"), volume: 0.85 },
  wrongCode: { source: require("../../assets/audio/wrong-code.m4a"), volume: 0.5 },
  pickup: { source: require("../../assets/audio/pickup.m4a"), volume: 0.7 },
  stamp: { source: require("../../assets/audio/stamp.m4a"), volume: 0.9 },
  solved: { source: require("../../assets/audio/solved.m4a"), volume: 0.7 },
};

// Room tone sits well under the effects: a bed you notice only when it stops (the user found 0.3 too loud).
const TONES: Record<Genre, { source: number; volume: number }> = {
  // Rain on the office window, a radiator rumble, a faint mains hum.
  noir: { source: require("../../assets/audio/room-noir.m4a"), volume: 0.12 },
  // A low, tense transformer hum.
  crime_scene: { source: require("../../assets/audio/room-crime-scene.m4a"), volume: 0.1 },
  // A cold, airy drone: wind and a glassy, beating pad.
  paranormal: { source: require("../../assets/audio/room-paranormal.m4a"), volume: 0.11 },
};

/** Room tone fades, in ms. */
export const ROOM_TONE_FADE = { in: 1600, out: 700, step: 50 } as const;

export type TrackName = "theme" | "crime" | "paranormal";

/**
 * Music: one looping track at a time, under the effects (shutter 0.95, stamp
 * 0.9, unlock 0.85) and over the room tone. `level` is every track's
 * playback volume times its `trim`, for evening out the supplied tracks'
 * loudness. While music plays the room tone drops to `roomTone` of its level
 * (fading over `fade.duck`), so rain or a hum and the music don't muddy each
 * other; it comes back up when the music stops. Fades are in ms: `cross` for
 * a crossfade between tracks (and fading in), `stop` for fading to silence
 * (music off, the app leaving the foreground).
 */
export const MUSIC = {
  level: 0.35,
  roomTone: 0.5,
  fade: { cross: 1200, stop: 500, duck: 1200, step: 50 },
  tracks: {
    // The main theme, the sound stripped from the user's video (stream-copied AAC, the silent 1.6 s
    // head and 1.9 s tail cut on frame boundaries; nothing re-encoded): the shell and noir. -27.6 LUFS,
    // the reference the other trims match.
    theme: { source: require("../../assets/music/theme.m4a"), trim: 1 },
    // Crime Scene's track: the user's Jazz.wav (16-bit 44.1 kHz), its silent 4.2 s tail cut and encoded to
    // AAC 256 kbit/s (.m4a loops gaplessly on iOS; an MP3 adds a gap). -16.9 LUFS: trimmed 10.7 dB down to the theme.
    crime: { source: require("../../assets/music/crime.m4a"), trim: 0.29 },
    // Paranormal's track (the user's atmoseerie01.mp3, as supplied). -26.0 LUFS: trimmed 1.6 dB down to the theme.
    paranormal: { source: require("../../assets/music/paranormal.mp3"), trim: 0.83 },
  } satisfies Record<TrackName, { source: number; trim: number }>,
} as const;

export const supported = Platform.OS === "ios" || Platform.OS === "android";

/** Run something that may throw or reject; neither may reach the screen. */
export function quietly(fn: () => unknown) {
  try {
    const result = fn() as { catch?: (f: () => void) => unknown } | undefined;
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {}
}

let configured = false;
/** Set the shared audio session once (effects, room tone and music alike). */
export function configure() {
  if (configured) return;
  configured = true;
  quietly(() =>
    setAudioModeAsync({
      playsInSilentMode: false,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
    }),
  );
}

/** A player for a bundled file, or null when it won't load (silence, never a throw). */
export function load(source: number): AudioPlayer | null {
  try {
    return createAudioPlayer(source, { updateInterval: 1000 });
  } catch {
    return null;
  }
}

const players: Partial<Record<SoundName, AudioPlayer | null>> = {};

/** Load every effect once, ahead of its first play. Safe to call often. */
export function preloadSounds() {
  if (!supported) return;
  configure();
  for (const name of Object.keys(EFFECTS) as SoundName[]) {
    // null marks a failed load: it stays silent rather than retrying on every cue.
    if (!(name in players)) players[name] = load(EFFECTS[name].source);
  }
}

/**
 * Whether a player's sound has loaded and can be sought. iOS raises an
 * uncatchable native exception (the app dies, no red screen) for a seek on
 * an item that isn't ready to play: still loading, or failed (a broken file,
 * a dropped dev-server asset, media services reset).
 */
export function canSeek(player: AudioPlayer): boolean {
  try {
    return player.isLoaded === true;
  } catch {
    return false;
  }
}

/** Play one effect from its start. Never throws; silent where audio isn't available. */
export function playSound(name: SoundName) {
  if (!supported) return;
  preloadSounds();
  const player = players[name];
  if (!player) return;
  quietly(() => {
    player.volume = EFFECTS[name].volume;
    // A replay starts over; seekTo is async but play picks up the new position.
    // Only a loaded sound is sought: one still loading starts from its start anyway.
    if (canSeek(player)) quietly(() => player.seekTo(0));
    player.play();
  });
}

// ---------------------------------------------------------------------------
// Room tone: one looping player per mode, faded in and out. Only one mode's
// tone is wanted at a time; changing mode crossfades.
// ---------------------------------------------------------------------------

interface Tone {
  player: AudioPlayer;
  /** 0..1 along the fade; the volume is the tone's level times this, squared for an even fade. */
  level: number;
  target: number;
}

const tones: Partial<Record<Genre, Tone | null>> = {};
let ticker: ReturnType<typeof setInterval> | null = null;
/** The room tone's share of its level: 1, or MUSIC.roomTone while music plays (faded between). */
let duck = 1;
let duckTarget = 1;

function applyVolume(genre: Genre, tone: Tone) {
  quietly(() => {
    tone.player.volume = TONES[genre].volume * tone.level * tone.level * duck;
  });
}

function step() {
  let moving = false;
  if (duck !== duckTarget) {
    const delta = ((1 - MUSIC.roomTone) * ROOM_TONE_FADE.step) / MUSIC.fade.duck;
    duck = duckTarget > duck ? Math.min(duckTarget, duck + delta) : Math.max(duckTarget, duck - delta);
    for (const genre of Object.keys(tones) as Genre[]) {
      const tone = tones[genre];
      if (tone && tone.level > 0) applyVolume(genre, tone);
    }
    if (duck !== duckTarget) moving = true;
  }
  for (const genre of Object.keys(tones) as Genre[]) {
    const tone = tones[genre];
    if (!tone || tone.level === tone.target) continue;
    const delta = tone.target > tone.level ? ROOM_TONE_FADE.step / ROOM_TONE_FADE.in : -ROOM_TONE_FADE.step / ROOM_TONE_FADE.out;
    tone.level = delta > 0 ? Math.min(tone.target, tone.level + delta) : Math.max(tone.target, tone.level + delta);
    applyVolume(genre, tone);
    if (tone.level === 0) quietly(() => tone.player.pause());
    if (tone.level !== tone.target) moving = true;
  }
  if (!moving && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

/** Fade the room tone to this mode's (crossfading from any other), or out entirely with null. */
export function setRoomTone(genre: Genre | null) {
  if (!supported) return;
  if (genre) {
    configure();
    if (!(genre in tones)) {
      const player = load(TONES[genre].source);
      tones[genre] = player ? { player, level: 0, target: 0 } : null;
      if (player) {
        quietly(() => {
          player.loop = true;
          player.volume = 0;
        });
      }
    }
  }
  for (const g of Object.keys(tones) as Genre[]) {
    const tone = tones[g];
    if (!tone) continue;
    tone.target = g === genre ? 1 : 0;
    if (tone.target === 1) quietly(() => tone.player.play());
  }
  if (!ticker) ticker = setInterval(step, ROOM_TONE_FADE.step);
}

/** Lower the room tone while music plays (true), or bring it back up (false). Fades over MUSIC.fade.duck. */
export function setRoomToneDucked(ducked: boolean) {
  const target = ducked ? MUSIC.roomTone : 1;
  if (target === duckTarget) return;
  duckTarget = target;
  if (supported && !ticker) ticker = setInterval(step, ROOM_TONE_FADE.step);
}

/** Forget every player. For tests. */
export function resetSoundsForTests() {
  for (const p of Object.values(players)) quietly(() => p?.remove());
  for (const t of Object.values(tones)) quietly(() => t?.player.remove());
  for (const k of Object.keys(players)) delete players[k as SoundName];
  for (const k of Object.keys(tones)) delete tones[k as Genre];
  if (ticker) clearInterval(ticker);
  ticker = null;
  configured = false;
  duck = 1;
  duckTarget = 1;
}
