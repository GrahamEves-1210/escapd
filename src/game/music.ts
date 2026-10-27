// Music: one looping track at a time, chosen by the active mode, faded in and
// crossfaded between modes. Presentation only, like sound.ts: nothing here
// may throw or block, and the web, a failed load or a failed play is silence.
//
// useMusic.ts (mounted once at the app's root) says which track is wanted;
// this module owns the players and the fades. The files, levels and fade
// times are in sound.ts (MUSIC), beside the effects and the room tone, and
// the music shares their audio session (silent switch respected, mixed with
// the player's own audio).
//
// - A track already playing keeps playing when it is asked for again (the
//   shell and noir share the theme, so moving between them never restarts it).
// - A track coming back after another mode's played starts from its top; one
//   coming back after a pause (music off, the app in the background) carries
//   on where it was.
// - A track that has faded to silence is paused, not unloaded.
// - Only a loaded player is ever sought: iOS raises an uncatchable native
//   exception for a seek on an item that isn't ready (see canSeek in sound.ts).
import type { AudioPlayer } from "expo-audio";
import type { Genre } from "@/lib/puzzle-types";
import { MUSIC, canSeek, configure, load, quietly, setRoomToneDucked, supported, type TrackName } from "./sound";

/** The track for a mode: the theme for the shell (null) and noir; each other mode its own. */
export function trackFor(mode: Genre | null): TrackName {
  if (mode === "crime_scene") return "crime";
  if (mode === "paranormal") return "paranormal";
  return "theme";
}

interface Track {
  player: AudioPlayer;
  /** 0..1 along the fade; the volume is the level times this, squared for an even fade. */
  level: number;
  target: number;
  /** ms for a full fade down: a crossfade, or the shorter stop. */
  out: number;
}

const tracks: Partial<Record<TrackName, Track | null>> = {};
/** The track last asked for, kept through a pause so a return resumes it rather than restarting it. */
let current: TrackName | null = null;
let ticker: ReturnType<typeof setInterval> | null = null;

function applyVolume(name: TrackName, track: Track) {
  quietly(() => {
    track.player.volume = MUSIC.level * MUSIC.tracks[name].trim * track.level * track.level;
  });
}

function step() {
  let moving = false;
  for (const name of Object.keys(tracks) as TrackName[]) {
    const track = tracks[name];
    if (!track || track.level === track.target) continue;
    const delta = track.target > track.level ? MUSIC.fade.step / MUSIC.fade.cross : -MUSIC.fade.step / track.out;
    track.level = delta > 0 ? Math.min(track.target, track.level + delta) : Math.max(track.target, track.level + delta);
    applyVolume(name, track);
    if (track.level === 0) quietly(() => track.player.pause());
    if (track.level !== track.target) moving = true;
  }
  if (!moving && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function open(name: TrackName): Track | null {
  if (!(name in tracks)) {
    const player = load(MUSIC.tracks[name].source);
    tracks[name] = player ? { player, level: 0, target: 0, out: MUSIC.fade.cross } : null;
    if (player) {
      quietly(() => {
        player.loop = true;
        player.volume = 0;
      });
    }
  }
  return tracks[name] ?? null;
}

/**
 * Fade to this track (crossfading from any other), or to silence with null.
 * `immediate` silences and pauses at once instead (the app has gone to the
 * background, where timers may not run to finish a fade).
 */
export function setMusic(name: TrackName | null, { immediate = false }: { immediate?: boolean } = {}) {
  if (!supported) return;
  const changed = name !== null && name !== current;
  if (name) {
    configure();
    current = name;
    const fresh = !(name in tracks);
    const track = open(name);
    // Back after another mode's track: from its top, if it has loaded and isn't still fading out.
    if (track && changed && !fresh && track.level === 0 && canSeek(track.player)) quietly(() => track.player.seekTo(0));
  }
  let playing = false;
  for (const n of Object.keys(tracks) as TrackName[]) {
    const track = tracks[n];
    if (!track) continue;
    track.target = n === name ? 1 : 0;
    // Away to another track: a crossfade. Away to silence: the quicker stop.
    track.out = name ? MUSIC.fade.cross : MUSIC.fade.stop;
    if (track.target === 1) {
      playing = true;
      quietly(() => track.player.play());
    } else if (immediate) {
      track.level = 0;
      applyVolume(n, track);
      quietly(() => track.player.pause());
    }
  }
  setRoomToneDucked(playing);
  if (!ticker) ticker = setInterval(step, MUSIC.fade.step);
}

/** Forget every player. For tests. */
export function resetMusicForTests() {
  for (const t of Object.values(tracks)) quietly(() => t?.player.remove());
  for (const k of Object.keys(tracks)) delete tracks[k as TrackName];
  if (ticker) clearInterval(ticker);
  ticker = null;
  current = null;
}
