// Sound: short effects for the game's moments and a soft room tone under a
// case. Presentation only: nothing here may throw or block, and a platform
// without audio (the web), a failed load or a failed play is simply silence.
//
// Callers don't play sounds directly: feedback.ts gives each cue its sound
// (following the player's sound_enabled), and useRoomTone.ts runs the
// ambience. The files and how they were made are in docs/AUDIO.md; they are
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

const supported = Platform.OS === "ios" || Platform.OS === "android";

/** Run something that may throw or reject; neither may reach the screen. */
function quietly(fn: () => unknown) {
  try {
    const result = fn() as { catch?: (f: () => void) => unknown } | undefined;
    if (result && typeof result.catch === "function") result.catch(() => {});
  } catch {}
}

let configured = false;
function configure() {
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

function load(source: number): AudioPlayer | null {
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
function canSeek(player: AudioPlayer): boolean {
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

function applyVolume(genre: Genre, tone: Tone) {
  quietly(() => {
    tone.player.volume = TONES[genre].volume * tone.level * tone.level;
  });
}

function step() {
  let moving = false;
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

/** Forget every player. For tests. */
export function resetSoundsForTests() {
  for (const p of Object.values(players)) quietly(() => p?.remove());
  for (const t of Object.values(tones)) quietly(() => t?.player.remove());
  for (const k of Object.keys(players)) delete players[k as SoundName];
  for (const k of Object.keys(tones)) delete tones[k as Genre];
  if (ticker) clearInterval(ticker);
  ticker = null;
  configured = false;
}
