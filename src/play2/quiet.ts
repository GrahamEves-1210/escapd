// Show, never tell, for every room, old or new. Rooms planned now have no
// beats (the room's own line about what just happened) and no report on a UV
// trace; rooms stored before (the cases already on a player's phone) still
// carry both. The player's screen is kept quiet for those too, in one place:
//
// - quietResult: what an action's result may show. Beats are dropped (nothing
//   narrates what the player just saw happen). A card "found" by acting on a
//   UV trace is dropped as an arrival: lighting a trace shows the trace, and
//   nothing pops, bursts or sounds for it. And a thing's own card (what it
//   is, what's written on it) never arrives as a note beside the thing: the
//   thing is there to be picked up and looked at; its card is read by
//   examining it, or in the casebook.
// - withoutTraceReports: the casebook's cards without a trace's report. A
//   report says what a trace means ("Fingerprint report: ...not the
//   gardener's"); the trace itself is the evidence. The one card a trace may
//   keep is a writing trace's own words, bare (the card's text is exactly
//   what is written on the wall).
//
// Pure functions: PlayerV2 passes every result and the casebook's list
// through them.
import type { Action, ActionResult, ItemDef, ObjectDef, TraceSpec } from "@/engine/v2";
import { placeOf, type ThreadLog } from "./journal/threads";

type Objects = readonly Pick<ObjectDef, "id" | "trace">[];
type Items = readonly Pick<ItemDef, "id" | "card">[];
type Card = { id: string; title: string; text: string };

/** The trace an action is aimed at, if it is aimed at one. */
function traceAimedAt(objects: Objects, action: Action): TraceSpec | undefined {
  const at = placeOf(action);
  return at ? objects.find((o) => o.id === at)?.trace : undefined;
}

/**
 * An action's result as the player's screen takes it: no beats, no card arriving from a UV trace, and no
 * note that is only a held thing's own card (the casebook keeps its own list of all of them). Everything else
 * is as the engine gave it; a result with nothing to drop is returned as it is.
 */
export function quietResult<R extends ActionResult | null>(def: { objects: Objects; items?: Items } | null | undefined, action: Action, result: R): R {
  if (!result) return result;
  const atTrace = def ? traceAimedAt(def.objects, action) !== undefined : false;
  const ofItem = new Set((def?.items ?? []).flatMap((i) => (i.card ? [i.card] : [])));
  const kept = result.effects.filter((e) => e.do !== "beat" && !(e.do === "show_card" && (atTrace || ofItem.has(e.card))));
  return kept.length === result.effects.length ? result : { ...result, effects: kept };
}

/** A trace as rooms stored before round 14 have it: nothing of what it looks like, drawn from its seed alone (its meaning was in a report). */
export function isOldTrace(t: TraceSpec): boolean {
  return t.size === undefined && t.tread === undefined && t.pattern === undefined && t.scar === undefined && t.stain === undefined && t.hand === undefined && t.text === undefined;
}

/**
 * The titles old rooms gave a trace's report (copy.ts, before round 14), for a card found before the casebook
 * kept track of where cards turn up. ("Finger-writing" is left out: it is also what paranormal calls plain UV
 * writing on a thing, which is no report.)
 */
export const OLD_REPORT_TITLES: ReadonlySet<string> = new Set([
  "Lab slip", "Fingerprint report", "Palm print report", "Handwriting report", "Stain analysis", "Footprint report",
  "Fingermarks", "Small handprints", "Wax drips", "Bare footprints",
]);

const bare = (s: string) => s.replace(/\s+/g, " ").trim().replace(/[.]$/, "");

/**
 * The casebook's cards, without any UV trace's report. A card that turned up at a trace (the casebook's log
 * knows where each did) stays only if it is a writing trace's own words and nothing else; a card found before
 * the log was kept is dropped if an old room titled it as a report.
 */
export function withoutTraceReports<C extends Card>(
  cards: C[],
  def: { objects: Objects } | null | undefined,
  log: Pick<ThreadLog, "cards"> | null,
  overlays: readonly { object: string; overlay: string; mark?: string }[] = [],
): C[] {
  const traces = new Map((def?.objects ?? []).flatMap((o) => (o.trace ? [[o.id, o.trace] as const] : [])));
  if (traces.size === 0) return cards;
  const oldRoom = [...traces.values()].every(isOldTrace);
  const wordsAt = (id: string) => traces.get(id)?.text ?? overlays.find((ov) => ov.object === id && ov.overlay === "glow_mark")?.mark;
  const kept = cards.filter((card) => {
    const place = log?.cards[card.id]?.place ?? null;
    const trace = place ? traces.get(place) : undefined;
    if (trace) {
      const words = wordsAt(place!);
      return trace.kind === "writing" && !isOldTrace(trace) && words !== undefined && bare(card.text) === bare(words);
    }
    return !(oldRoom && place === null && OLD_REPORT_TITLES.has(card.title));
  });
  return kept.length === cards.length ? cards : kept;
}
