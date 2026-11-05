// Her charm board, kept on the device (AsyncStorage), and the cat's outfit.
//
// - One charm per case (by room id): closing a case again never awards a
//   second one; a better run can only lift its finish (a sticker to a silver
//   pin, a silver pin to gold).
// - Missing, unreadable or half-written data reads as an empty board (or as
//   the entries that still make sense), never as an error.
// - Awards are queued, so two at once (a screen mounted twice) can't race.
// - Within one run of the app, the same case's award is answered as it was
//   the first time (case closed mounted again still says "New charm").
// - The cat's outfit: "escapd.cat.accessory", exactly "none" | "bow" |
//   "bell" | "beret" | "flowers" (the cats read it to dress up).
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Genre } from "@/lib/puzzle-types";
import { isGenre } from "@/game/mode";
import {
  FINISH_RANK, finishFor, isAccessoryChoice, isCharmKind, isFinish, pickCharm, titleFor,
  type AccessoryChoice, type CharmKind, type Finish, type Title,
} from "./charms";
import { setCatAccessory } from "@/play2/catAccessory";

export const COLLECTION_KEY = "escapd.collection.v1";
export const ACCESSORY_KEY = "escapd.cat.accessory";

/** The charm one case earned. */
export interface CaseCharm {
  genre: Genre;
  kind: CharmKind;
  finish: Finish;
  /** When it was earned or last lifted (ms since the epoch). */
  at: number;
}

export interface Collection {
  /** By room id. */
  cases: Record<string, CaseCharm>;
  /** When she last looked at her board (ms): newer charms are new to her. */
  seenAt: number;
}

export type AwardStatus = "new" | "upgraded" | "kept";

export interface Award {
  roomId: string;
  charm: CaseCharm;
  status: AwardStatus;
  /** Cases closed, counting this one. */
  closed: number;
  /** The title this case lifted her to, if it did. */
  title?: Title;
}

const empty = (): Collection => ({ cases: {}, seenAt: 0 });

/** A kept board, read leniently: anything that doesn't make sense is dropped. */
export function parseCollection(raw: string | null | undefined): Collection {
  if (!raw) return empty();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty();
  }
  if (!data || typeof data !== "object") return empty();
  const d = data as { cases?: unknown; seenAt?: unknown };
  const out = empty();
  out.seenAt = typeof d.seenAt === "number" && Number.isFinite(d.seenAt) ? d.seenAt : 0;
  if (d.cases && typeof d.cases === "object" && !Array.isArray(d.cases)) {
    for (const [roomId, value] of Object.entries(d.cases as Record<string, unknown>)) {
      const c = value as Partial<CaseCharm> | null;
      if (!roomId || !c || typeof c !== "object") continue;
      if (!isGenre(c.genre) || !isCharmKind(c.kind) || !isFinish(c.finish)) continue;
      out.cases[roomId] = { genre: c.genre, kind: c.kind, finish: c.finish, at: typeof c.at === "number" && Number.isFinite(c.at) ? c.at : 0 };
    }
  }
  return out;
}

export async function loadCollection(): Promise<Collection> {
  try {
    return parseCollection(await AsyncStorage.getItem(COLLECTION_KEY));
  } catch {
    return empty();
  }
}

async function save(c: Collection) {
  try {
    await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(c));
  } catch {
    // The board stays as it was on the device; this run still shows the award.
  }
}

/** Cases closed (one per room). */
export function casesClosed(c: Collection): number {
  return Object.keys(c.cases).length;
}

/** Charms newer than her last look at the board. */
export function unseenCount(c: Collection): number {
  return Object.values(c.cases).filter((x) => x.at > c.seenAt).length;
}

// One change to the board at a time.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => {});
  return next;
}

/** This run's awards, by room: the same case asked again answers the same. */
const given = new Map<string, Award>();

/** Forget this run's answers (tests). */
export function resetAwardMemory() {
  given.clear();
}

/**
 * Award the charm for a closed case (once per room): `stats` is how it went
 * (its finish). Never throws.
 */
export function awardCharm(roomId: string, genre: Genre, stats: { hints?: number; wrong?: number } | null | undefined, now = Date.now()): Promise<Award> {
  return serial(async () => {
    const finish = finishFor(stats);
    const c = await loadCollection();
    const existing = c.cases[roomId];
    const before = casesClosed(c);
    const memory = given.get(roomId);
    let award: Award;
    if (!existing) {
      const owned = new Set(Object.values(c.cases).map((x) => x.kind));
      const charm: CaseCharm = { genre, kind: pickCharm(genre, roomId, owned), finish, at: now };
      c.cases[roomId] = charm;
      const lifted = titleFor(before + 1);
      award = { roomId, charm, status: "new", closed: before + 1, ...(lifted !== titleFor(before) ? { title: lifted } : {}) };
      await save(c);
    } else if (FINISH_RANK[finish] > FINISH_RANK[existing.finish]) {
      const charm: CaseCharm = { ...existing, finish, at: now };
      c.cases[roomId] = charm;
      award = { roomId, charm, status: memory?.status === "new" ? "new" : "upgraded", closed: before, ...(memory?.title ? { title: memory.title } : {}) };
      await save(c);
    } else if (memory && memory.charm.kind === existing.kind && memory.charm.finish === existing.finish) {
      // Asked again this run: the same answer.
      return memory;
    } else {
      award = { roomId, charm: existing, status: "kept", closed: before };
    }
    given.set(roomId, award);
    return award;
  });
}

/**
 * What closing this case will do to her title, before its award (case
 * closed's line under the card): the title it lifts her to, if any.
 */
export async function titleIfClosed(roomId: string): Promise<Title | null> {
  const memory = given.get(roomId);
  if (memory) return memory.title ?? null;
  const c = await loadCollection();
  if (c.cases[roomId]) return null;
  const before = casesClosed(c);
  const after = titleFor(before + 1);
  return after !== titleFor(before) ? after : null;
}

/** She has looked at her board: every charm so far is no longer new. */
export function markBoardSeen(now = Date.now()): Promise<void> {
  return serial(async () => {
    const c = await loadCollection();
    c.seenAt = Math.max(now, ...Object.values(c.cases).map((x) => x.at));
    await save(c);
  });
}

// ---------------------------------------------------------------------------
// The cat's outfit
// ---------------------------------------------------------------------------

const listeners = new Set<(a: AccessoryChoice) => void>();

/** The cat's outfit: "none" when none is chosen or the kept value isn't one. */
export async function loadAccessory(): Promise<AccessoryChoice> {
  try {
    const raw = await AsyncStorage.getItem(ACCESSORY_KEY);
    return isAccessoryChoice(raw) ? raw : "none";
  } catch {
    return "none";
  }
}

/** Dress the cat (kept on the device; anything listening hears it at once). */
export async function saveAccessory(a: AccessoryChoice): Promise<void> {
  if (!isAccessoryChoice(a)) return;
  listeners.forEach((l) => l(a));
  // The cat's own setter: it keeps the key and changes every cat on screen at once.
  await setCatAccessory(a);
}

/** Hear the cat's outfit change (returns the unsubscribe). */
export function subscribeAccessory(listener: (a: AccessoryChoice) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
