// What the player hands to case closed: the case it just closed, its mode and
// title, how the game went (the device's own stats: a room played on the
// device writes no session to read them from), the accused suspect and the
// accusation that held (crime scene) and its photo (paranormal shows the room
// back in full colour). Route params carry the lines and the stats.
//
// It is kept in memory for the hand-off, and on the device (AsyncStorage, the
// last case only) so a reload or a deep link to case closed still has it. A
// photo's source isn't kept (a signed URL expires): which photo it was is,
// and resolveClosedPhoto signs it again.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccuseOption, Genre } from "@/lib/puzzle-types";
import { getRoomPhotos, signedPhotoUrl } from "@/lib/escapd-api";
import type { ScenePhoto } from "@/game/useSceneSources";
import { bundledScene } from "./bundledScenes";
import type { SceneSource } from "./SceneView";
import type { CaseStats } from "./victory";

export interface ClosedCase {
  roomId: string;
  genre: Genre;
  title?: string;
  /** The accused, and whether a clue had broken their alibi (it shows struck through). */
  accused?: AccuseOption & { contradicted?: boolean };
  /** Crime scene: why and how, as the accusation that held named them. */
  motive?: string;
  method?: string;
  /** How the game went, counted on the device (a v2 game). Absent: case closed reads the session. */
  stats?: CaseStats;
  /** The room's photo, ready to draw (in memory only). */
  photo?: SceneSource;
  /** Which photo it is, to sign again after a reload. */
  photoRef?: ScenePhoto;
}

const KEY = "escapd.closedCase";

let last: ClosedCase | null = null;

export function stashClosedCase(closed: ClosedCase) {
  last = closed;
  // The live source stays in memory: a bundled one is a module id, a signed URL expires.
  const { photo: _photo, ...kept } = closed;
  AsyncStorage.setItem(KEY, JSON.stringify(kept)).catch(() => {});
}

/** The case the player just closed, when it is this room's (in memory: the hand-off). */
export function closedCaseFor(roomId: string): ClosedCase | null {
  return last?.roomId === roomId ? last : null;
}

/** The case the player last closed, when it is this room's: in memory, else as kept on the device (a reload). */
export async function loadClosedCase(roomId: string): Promise<ClosedCase | null> {
  const memory = closedCaseFor(roomId);
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const kept = raw ? (JSON.parse(raw) as ClosedCase) : null;
    return kept && typeof kept === "object" && kept.roomId === roomId ? kept : null;
  } catch {
    return null;
  }
}

/**
 * The room's photo, ready to draw: `ref` (bundled, or one of its uploads,
 * signed again), else its first upload. Null when there is none to show.
 */
export async function resolveClosedPhoto(roomId: string, ref?: ScenePhoto): Promise<SceneSource | null> {
  if (ref && "asset_key" in ref) return bundledScene(ref.asset_key) ?? null;
  const rows = await getRoomPhotos(roomId);
  const row = ref && "photo_id" in ref
    ? rows.find((r) => r.id === ref.photo_id)
    : [...rows].sort((a, b) => a.position - b.position)[0];
  return row ? { uri: await signedPhotoUrl(row.storage_path) } : null;
}

/** The stats as route params (strings), so they survive the hand-off and a reload. */
export function statsToParams(stats: CaseStats | undefined): Record<string, string> {
  return stats ? { hints: String(stats.hints), wrong: String(stats.wrong), ms: String(Math.round(stats.ms)) } : {};
}

/** The stats back from route params; undefined unless all three are there and sane. */
export function statsFromParams(params: { hints?: string; wrong?: string; ms?: string }): CaseStats | undefined {
  const n = (s: string | undefined) => {
    if (s === undefined || s === "") return undefined;
    const v = Number(s);
    return Number.isFinite(v) && v >= 0 ? v : undefined;
  };
  const hints = n(params.hints);
  const wrong = n(params.wrong);
  const ms = n(params.ms);
  return hints === undefined || wrong === undefined || ms === undefined ? undefined : { hints, wrong, ms };
}
