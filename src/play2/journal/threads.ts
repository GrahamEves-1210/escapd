// The casebook's red string (docs/ART_DIRECTION.md: "a corkboard with red
// string"): which found cards belong together, and whether the lead they make
// has been followed. Worked out from what the player's side of the room sees
// in either mode (the steps and their threads stay secret on a server room):
//   - where a card turned up: the object acted on (a UV trace counts as the
//     thing it is on or near), so the bookshelf's margin note, the ink on the
//     wall beside it and the prints on it are one lead;
//   - what it is: cards with the same title (two lab slips, two sets of small
//     handprints) are the same kind of evidence;
//   - when: cards one action turned up together.
// Consecutive cards of a lead (in the casebook's order) are joined by a
// string. A string sags while its lead is new and pulls taut once the room has
// moved on (a step solved) since both its cards were found.
import type { Action, ObjectDef } from "@/engine/v2";

/** What the casebook remembers about each card: when (steps solved by then), where, and in which batch it turned up. */
export interface CardNote {
  at: number;
  place: string | null;
  batch: number;
}

export interface ThreadLog {
  v: 1;
  cards: Record<string, CardNote>;
  /** Strings already seen taut (their twang played). */
  taut: string[];
  /** Steps solved when the casebook was last looked at (new ticks pop in). */
  ticked: number;
  /** The last batch number given out. */
  batch: number;
}

export const emptyLog = (): ThreadLog => ({ v: 1, cards: {}, taut: [], ticked: 0, batch: 0 });

/** A saved log, or an empty one when it is missing or unreadable. */
export function readLog(raw: string | null): ThreadLog {
  try {
    const s = raw ? JSON.parse(raw) : null;
    if (s && s.v === 1 && s.cards && typeof s.cards === "object" && Array.isArray(s.taut)) {
      return { v: 1, cards: s.cards, taut: s.taut.filter((k: unknown) => typeof k === "string"), ticked: Number(s.ticked) || 0, batch: Number(s.batch) || 0 };
    }
  } catch {
    // Unreadable: start over.
  }
  return emptyLog();
}

/** Where an action happened: the object acted on (a held item's control: that item), or null (combining two items). */
export function placeOf(action: Action): string | null {
  switch (action.type) {
    case "inspect":
    case "submit":
    case "use_item":
      return action.object;
    case "set_control":
      return action.target;
    default:
      return null;
  }
}

/**
 * The log with the casebook's cards as they are now: each new card noted with
 * the steps solved by now, where the last action happened and this batch. No
 * cards at all (a restart): an empty log. Unchanged: the same object.
 * `restored`: cards already in a save the log never saw (another device, an
 * older version): nowhere, no batch (0), and found before anything since.
 */
export function record(log: ThreadLog, cardIds: readonly string[], solved: number, place: string | null, restored = false): ThreadLog {
  if (!cardIds.length) return Object.keys(log.cards).length || log.taut.length || log.ticked ? emptyLog() : log;
  const fresh = cardIds.filter((id) => !log.cards[id]);
  if (!fresh.length) return log;
  const batch = restored ? log.batch : log.batch + 1;
  const cards = { ...log.cards };
  for (const id of fresh) cards[id] = restored ? { at: -1, place: null, batch: 0 } : { at: solved, place, batch };
  return { ...log, cards, batch, ticked: restored ? solved : log.ticked };
}

/** The log once the casebook has shown these strings taut and this many steps solved. */
export function markSeen(log: ThreadLog, taut: readonly string[], ticked: number): ThreadLog {
  const add = taut.filter((k) => !log.taut.includes(k));
  if (!add.length && ticked === log.ticked) return log;
  return { ...log, taut: [...log.taut, ...add], ticked };
}

export interface CaseString {
  /** "from>to", stable for the pair. */
  key: string;
  from: string;
  to: string;
  /** Which page margin the string runs down (leads alternate, so two never tangle). */
  side: "left" | "right";
  /** Which lead it belongs to, in order of the lead's first card. */
  lead: number;
  taut: boolean;
  /** Taut, and not seen taut before: it pulls tight with a twang. */
  twang: boolean;
}

/** A UV trace's place is the object it marks. */
function anchorOf(place: string | null, objects: readonly Pick<ObjectDef, "id" | "trace">[]): string | null {
  if (!place) return null;
  const o = objects.find((x) => x.id === place);
  return o?.trace?.anchor ?? place;
}

const norm = (title: string) => title.trim().toLowerCase().replace(/\s+/g, " ");

/** The strings between the casebook's cards (in the casebook's order). */
export function stringsOf(
  cards: readonly { id: string; title: string }[],
  log: ThreadLog,
  solved: number,
  objects: readonly Pick<ObjectDef, "id" | "trace">[] = [],
): CaseString[] {
  // Union-find over the cards: same place, same title, same batch.
  const parent = cards.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (a: number, b: number) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  const by = new Map<string, number>();
  cards.forEach((c, i) => {
    const note = log.cards[c.id];
    const keys = [`t:${norm(c.title)}`];
    const place = anchorOf(note?.place ?? null, objects);
    if (place) keys.push(`p:${place}`);
    if (note?.batch) keys.push(`b:${note.batch}`);
    for (const k of keys) {
      const first = by.get(k);
      if (first === undefined) by.set(k, i);
      else join(first, i);
    }
  });
  // Each lead's cards in order; leads numbered by their first card.
  const leads = new Map<number, number[]>();
  cards.forEach((_, i) => {
    const r = find(i);
    leads.set(r, [...(leads.get(r) ?? []), i]);
  });
  const out: CaseString[] = [];
  let lead = 0;
  for (const members of leads.values()) {
    if (members.length < 2) continue;
    for (let j = 1; j < members.length; j++) {
      const a = cards[members[j - 1]], b = cards[members[j]];
      const key = `${a.id}>${b.id}`;
      const since = Math.max(log.cards[a.id]?.at ?? solved, log.cards[b.id]?.at ?? solved);
      const taut = solved > since;
      out.push({ key, from: a.id, to: b.id, side: lead % 2 ? "right" : "left", lead, taut, twang: taut && !log.taut.includes(key) });
    }
    lead++;
  }
  return out;
}

/** Where the case stands, for the margin's scribbles. */
export type Stage = "start" | "going" | "close" | "last";

export function stageOf(solved: number, total: number): Stage {
  if (total <= 0 || solved <= 0) return "start";
  const left = total - solved;
  if (left <= 1) return "last";
  if (solved / total >= 0.6) return "close";
  return "going";
}
