// Sound: the game's few effects. Presentation only: nothing here may throw or
// block, and a platform without audio (the web), a failed load or a failed
// play is simply silence.
//
// The game is mostly silent on purpose. A touch is felt (the haptics in
// feedback.ts), not heard: no clicks on buttons, no beeps, no stingers. A
// sound is kept only where something physical happens in the world and the
// player earned it, and each is quiet, short and natural, mixed well under the
// player's music: a lock giving way, a drawer, a page turned, a stamp, the
// camera's shutter, the ending's door or candle, and the music box (which is
// an instrument). Nothing sounds on arriving anywhere (a room, the build wait,
// the brief): every cue answers something the player did.
//
// Callers don't play sounds directly: feedback.ts gives each cue its sound
// (following the player's sound_enabled), and music.ts / useMusic.ts run the
// music. Every file and its level is here, in one place: EFFECTS and MUSIC.
// The files and how they were made are in docs/AUDIO.md; they are rebuilt by
// scripts/audio/foley.py.
//
// The audio session respects the iOS silent switch (playsInSilentMode: false,
// the "ambient" category; Android likewise stays quiet in silent or vibrate
// ringer modes) and mixes with whatever the player is listening to: it never
// stops or ducks their music, and asks for no audio focus.
import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

export type SoundName =
  | "paper"
  | "unlock"
  | "stamp"
  | "drawer"
  | "shutter"
  | "doorOut"
  | "candleOut"
  | "musicNote0"
  | "musicNote1"
  | "musicNote2"
  | "musicNote3"
  | "musicNote4"
  | "musicNote5";

/** The music box's six teeth, low to high: C5, D5, E5, G5, A5, C6 (C major pentatonic). feedback's musicNote(i) plays the i-th. */
export const MUSIC_NOTES = ["musicNote0", "musicNote1", "musicNote2", "musicNote3", "musicNote4", "musicNote5"] as const satisfies readonly SoundName[];

/** The six music-box notes share one level: a small box, a little under the music. */
const MUSIC_NOTE_VOLUME = 0.1;
/** Two voices of one file: with two variants a cue alternates, so a replay never cuts the one still ringing. */
const twice = (source: number): readonly number[] => [source, source];

// The files (scripts/audio/foley.py) are levelled to one loudness (-18 LUFS
// momentary, peaks capped at -1.5 dBTP; the short impacts land on the peak
// cap and sit lower). These volumes are the mix: each cue's loudest 400 ms at
// playback sits at about -40 to -44 LUFS, under the music's own median (about
// -38.6 for the theme at MUSIC.level), and its peaks under the music's.
const EFFECTS: Record<SoundName, { source: number | readonly number[]; volume: number }> = {
  // A page turned: lifted at its corner, swung over, laid down flat (a clue found, the casebook's leaves).
  paper: { source: require("../../assets/audio/paper.m4a"), volume: 0.05 },
  // A lock giving way: the bolt drawn back to a solid clack, the latch dropping at 110 ms. No chime.
  unlock: { source: require("../../assets/audio/unlock.m4a"), volume: 0.16 },
  // A rubber stamp pressed onto paper on a wooden desk, and lifted with a faint peel.
  stamp: { source: require("../../assets/audio/stamp.m4a"), volume: 0.17 },
  // A wooden drawer sliding out on its runners, its soft knock at the stop at 170 ms.
  drawer: { source: require("../../assets/audio/drawer.m4a"), volume: 0.13 },
  // A film camera's shutter: two curtains 55 ms apart and the mechanism settling.
  shutter: { source: require("../../assets/audio/shutter.m4a"), volume: 0.18 },
  // The music box's comb, one plucked steel tooth each: C5, D5, E5, G5, A5, C6 (1.1 to 1.3 s). Each
  // note has two voices (its file twice: plays alternate between them), so the same tooth plucked
  // again rings over itself instead of being cut off; different notes are different players.
  musicNote0: { source: twice(require("../../assets/audio/music-note-0.m4a")), volume: MUSIC_NOTE_VOLUME },
  musicNote1: { source: twice(require("../../assets/audio/music-note-1.m4a")), volume: MUSIC_NOTE_VOLUME },
  musicNote2: { source: twice(require("../../assets/audio/music-note-2.m4a")), volume: MUSIC_NOTE_VOLUME },
  musicNote3: { source: twice(require("../../assets/audio/music-note-3.m4a")), volume: MUSIC_NOTE_VOLUME },
  musicNote4: { source: twice(require("../../assets/audio/music-note-4.m4a")), volume: MUSIC_NOTE_VOLUME },
  musicNote5: { source: twice(require("../../assets/audio/music-note-5.m4a")), volume: MUSIC_NOTE_VOLUME },
  // A case's ending. Noir: a heavy door's latch, a brief low creak, the rainy street coming in and
  // fading (1.8 s). The ending's own moment, a touch over a page.
  doorOut: { source: require("../../assets/audio/door-out.m4a"), volume: 0.16 },
  // Paranormal: a candle guttering (a soft flutter), the puff that takes it at 450 ms, the wick's faint hiss (0.8 s).
  candleOut: { source: require("../../assets/audio/candle-out.m4a"), volume: 0.1 },
};

export type TrackName = "theme" | "crime" | "paranormal";

/**
 * Music: one looping track at a time, over the effects (which sit under it,
 * see EFFECTS). `level` is every track's playback volume times its `trim`,
 * for evening out the supplied tracks' loudness. Fades are in ms: `cross` for
 * a crossfade between tracks (and fading in), `stop` for fading to silence
 * (music off, the app leaving the foreground).
 */
export const MUSIC = {
  level: 0.35,
  fade: { cross: 1200, stop: 500, step: 50 },
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
/** Set the shared audio session once (effects and music alike). */
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

/** A cue's players, one per variant. null marks a failed load: it stays silent rather than retrying on every cue. */
const players: Partial<Record<SoundName, (AudioPlayer | null)[]>> = {};
/** The variant each cue played last, so a run of one cue never plays the same variant twice running. */
const lastVariant: Partial<Record<SoundName, number>> = {};

/** Load every effect once, ahead of its first play. Safe to call often. */
export function preloadSounds() {
  if (!supported) return;
  configure();
  for (const name of Object.keys(EFFECTS) as SoundName[]) {
    if (name in players) continue;
    const source = EFFECTS[name].source;
    const sources: readonly number[] = Array.isArray(source) ? source : [source as number];
    players[name] = sources.map(load);
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
  const loaded = (players[name] ?? []).flatMap((p, i) => (p ? [i] : []));
  if (loaded.length === 0) return;
  // One of its variants, at random, but not the one it played last (when there's another).
  const fresh = loaded.length > 1 ? loaded.filter((i) => i !== lastVariant[name]) : loaded;
  const variant = fresh[Math.floor(Math.random() * fresh.length)] ?? fresh[0];
  lastVariant[name] = variant;
  const player = players[name]?.[variant];
  if (!player) return;
  quietly(() => {
    player.volume = EFFECTS[name].volume;
    // A replay starts over; seekTo is async but play picks up the new position.
    // Only a loaded sound is sought: one still loading starts from its start anyway.
    if (canSeek(player)) quietly(() => player.seekTo(0));
    player.play();
  });
}

/**
 * The room tone under a case (rain, a hum, a drone) is gone: it was a synthesized
 * bed nobody asked for under the player's music. Kept as a no-op so music.ts,
 * which lowered it while music played, needs no change.
 */
export function setRoomToneDucked(_ducked: boolean) {}

/** Forget every player. For tests. */
export function resetSoundsForTests() {
  for (const set of Object.values(players)) for (const p of set ?? []) quietly(() => p?.remove());
  for (const k of Object.keys(players)) delete players[k as SoundName];
  for (const k of Object.keys(lastVariant)) delete lastVariant[k as SoundName];
  configured = false;
}
