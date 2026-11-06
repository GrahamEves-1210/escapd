// The charm collection, as plain data (round 7: a reason to come back). Every
// closed case earns a charm, a tiny enamel pin or sticker themed by its mode,
// pinned to her charm board; how the case went sets its finish; the number of
// cases she has closed gives her a wry detective title; and some titles
// unlock a little outfit for the cat. Pure, so the rules are tested on their
// own (__tests__/collection-test.ts); store.ts keeps her board on the device,
// src/screens/collection draws it.
import type { Genre } from "@/lib/puzzle-types";

/** The charms, three per mode. */
export type CharmKind =
  | "key" | "fedora" | "matchbook"
  | "magnifier" | "fingerprint" | "tag"
  | "moon" | "planchette" | "candle";

/**
 * How it went: a gold pin (no tips and no wrong answers), a silver pin (at
 * most one tip and two wrong answers), or a paper sticker (every other closed
 * case, and one whose count isn't known).
 */
export type Finish = "gold" | "silver" | "sticker";

export const FINISHES: readonly Finish[] = ["gold", "silver", "sticker"];
/** Higher is better: a replay can only lift a charm's finish. */
export const FINISH_RANK: Record<Finish, number> = { sticker: 0, silver: 1, gold: 2 };
export const FINISH_LABEL: Record<Finish, string> = { gold: "Gold pin", silver: "Silver pin", sticker: "Sticker" };

/** Each mode's charms, in the board's order. */
export const MODE_CHARMS: Record<Genre, readonly CharmKind[]> = {
  noir: ["key", "fedora", "matchbook"],
  crime_scene: ["magnifier", "fingerprint", "tag"],
  paranormal: ["moon", "planchette", "candle"],
};

/** The modes in the board's order (home's deck order, top to bottom). */
export const BOARD_MODES: readonly Genre[] = ["noir", "crime_scene", "paranormal"];

export const CHARM_INFO: Record<CharmKind, { name: string; genre: Genre }> = {
  key: { name: "Skeleton Key", genre: "noir" },
  fedora: { name: "Fedora", genre: "noir" },
  matchbook: { name: "Matchbook", genre: "noir" },
  magnifier: { name: "Magnifier", genre: "crime_scene" },
  fingerprint: { name: "Fingerprint", genre: "crime_scene" },
  tag: { name: "Evidence Tag", genre: "crime_scene" },
  moon: { name: "Sleepy Moon", genre: "paranormal" },
  planchette: { name: "Planchette", genre: "paranormal" },
  candle: { name: "Spirit Candle", genre: "paranormal" },
};

export const ALL_CHARMS: readonly CharmKind[] = BOARD_MODES.flatMap((g) => MODE_CHARMS[g]);

/** Charms an older build gave under another name (read as their new one). */
export const RENAMED_CHARMS: Readonly<Record<string, CharmKind>> = { glass: "matchbook" };

/** A kept charm's kind, its old name read as its new one; null when it isn't one. */
export function charmKindOf(v: unknown): CharmKind | null {
  if (typeof v !== "string") return null;
  if (Object.prototype.hasOwnProperty.call(RENAMED_CHARMS, v)) return RENAMED_CHARMS[v];
  return isCharmKind(v) ? v : null;
}

export function isCharmKind(v: unknown): v is CharmKind {
  return typeof v === "string" && (ALL_CHARMS as readonly string[]).includes(v);
}
export function isFinish(v: unknown): v is Finish {
  return typeof v === "string" && (FINISHES as readonly string[]).includes(v);
}

const count = (n: unknown): number | undefined => (typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined);

/** The finish a case earns from how it went (the same rule as case closed's magnifiers). */
export function finishFor(stats: { hints?: number; wrong?: number } | null | undefined): Finish {
  const hints = count(stats?.hints);
  const wrong = count(stats?.wrong);
  if (hints === undefined || wrong === undefined) return "sticker";
  if (hints === 0 && wrong === 0) return "gold";
  if (hints <= 1 && wrong <= 2) return "silver";
  return "sticker";
}

/** A steady number from a room's id (the same room, the same number). */
export function charmSeed(roomId: string): number {
  let n = 17;
  for (const ch of roomId) n = (n * 31 + ch.charCodeAt(0)) % 1000003;
  return n;
}

/**
 * The charm a case earns: the room's own one of its mode's three (from its
 * id), or, when she already has that one and is still missing another of the
 * mode's, the next one she's missing, so a new case fills the board before it
 * repeats. Kept with the case once given (store.ts), so a replay never changes it.
 */
export function pickCharm(genre: Genre, roomId: string, owned: ReadonlySet<CharmKind>): CharmKind {
  const kinds = MODE_CHARMS[genre];
  const start = charmSeed(roomId) % kinds.length;
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[(start + i) % kinds.length];
    if (!owned.has(kind)) return kind;
  }
  return kinds[start];
}

/** The cat's outfits, a detective's cat's (the other half of the key's values is "none"). */
export type Accessory = "collar" | "scarf" | "specs" | "deerstalker";
export type AccessoryChoice = Accessory | "none";
export const ACCESSORIES: readonly Accessory[] = ["collar", "scarf", "specs", "deerstalker"];
export const ACCESSORY_NAME: Record<AccessoryChoice, string> = { none: "Just the cat", collar: "Collar", scarf: "Scarf", specs: "Specs", deerstalker: "Deerstalker" };

export function isAccessoryChoice(v: unknown): v is AccessoryChoice {
  return v === "none" || (typeof v === "string" && (ACCESSORIES as readonly string[]).includes(v));
}

/** Her detective title, by cases closed; some titles bring the cat an outfit. */
export interface Title {
  /** Cases closed to earn it. */
  at: number;
  title: string;
  /** The cat's outfit this title unlocks. */
  unlocks?: Accessory;
}

export const TITLES: readonly Title[] = [
  { at: 0, title: "Armchair Amateur" },
  { at: 1, title: "Keyhole Snoop", unlocks: "collar" },
  { at: 3, title: "Night-Owl Sleuth", unlocks: "scarf" },
  { at: 6, title: "Inkwell Inspector", unlocks: "specs" },
  { at: 10, title: "Unflappable Detective", unlocks: "deerstalker" },
  { at: 15, title: "Legendary Know-It-All" },
];

const cases = (n: number) => Math.max(0, Math.floor(Number.isFinite(n) ? n : 0));

/** Her title after `closed` cases. */
export function titleFor(closed: number): Title {
  const n = cases(closed);
  let best = TITLES[0];
  for (const t of TITLES) if (n >= t.at) best = t;
  return best;
}

/** The next title up, or null at the top. */
export function nextTitle(closed: number): Title | null {
  const n = cases(closed);
  return TITLES.find((t) => t.at > n) ?? null;
}

/** When an outfit unlocks (cases closed). */
export function unlockAt(accessory: Accessory): number {
  return TITLES.find((t) => t.unlocks === accessory)?.at ?? Infinity;
}

/** The outfits unlocked after `closed` cases. */
export function unlockedAccessories(closed: number): Accessory[] {
  const n = cases(closed);
  return ACCESSORIES.filter((a) => n >= unlockAt(a));
}

/** "a Keyhole Snoop" / "an Inkwell Inspector". */
export function withArticle(title: string): string {
  return `${/^[AEIOU]/i.test(title) ? "an" : "a"} ${title}`;
}

/** An outfit as a gift: "a bell collar", "spectacles". */
export const ACCESSORY_GIFT: Record<Accessory, string> = { collar: "a bell collar", scarf: "a knitted scarf", specs: "spectacles", deerstalker: "a deerstalker" };
export function accessoryGift(a: Accessory): string {
  return ACCESSORY_GIFT[a];
}

/** Case closed's line when a case lifts her title: "Now a Night-Owl Sleuth · a knitted scarf for the cat". */
export function titleNews(title: Title): string {
  const now = `Now ${withArticle(title.title)}`;
  return title.unlocks ? `${now} · ${accessoryGift(title.unlocks)} for the cat` : now;
}
