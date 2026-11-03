// How a v2 game went, for case closed: the hints taken, the wrong answers and
// the time spent playing, counted on the device as the room is played. A room
// played on the device writes no session, so there is nothing else to read
// them from; the count is kept per room (AsyncStorage) so a game that is left
// and resumed keeps its count, and starts again with the room.
//
// - Hints: the hint rungs taken (the room's own state, so they resume with it).
// - Wrong answers: every wrong submit starts the wrong-answer cooldown (and
//   nothing else does), so each cooldown that starts while it is watched is one.
// - Time: while the room is on screen, ready, the app in the foreground and the
//   case still open.
//
// And what case closed shows of the case itself (`finish`): its own title (a
// room planned on the device from a v1 one carries the planner's stand-in,
// "The Scene"; the v1 room has the case's name), the accusation that held
// (crime scene, a room planned on the device: the plan is seeded by the room,
// so planning it again finds the same answer) and the room's photo.
//
// And the recap (`caseRecap`): what happened in the case, told from its
// answer (noir: the combination; crime scene: who, why and how; paranormal:
// the ritual's order and what it meant), the casebook cards that proved it,
// and the clues she found of the case's. A room planned on the device has its
// secret here to tell it from; a room played on the server tells it in the
// mode's words, from the clues she found. It is handed to case closed beside
// the closed-case stash (`keepRecap`, `recapFor`, `loadRecap`: in memory, and
// on the device for a reload).
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccuseOption, Genre, PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import type { RoomDefinitionV2, RoomSecretV2 } from "@/engine/v2";
import type { ScenePhoto, SceneSources } from "@/game/useSceneSources";
import type { SceneSource } from "@/render/SceneView";
import type { CaseRecap, CaseStats, StoryPart } from "@/render/victory";
import { planFromV1 } from "./adapter";
import type { RoomV2 } from "./useRoomV2";

/** Crime scene: who did it, why and how, as the accusation that held named them. */
export interface Accusation {
  who: AccuseOption;
  why?: AccuseOption;
  how?: AccuseOption;
}

/** What the v2 player hands on when the case is closed. */
export interface V2Completion {
  title: string;
  ending: string;
  genre: Genre;
  stats: CaseStats;
  accusation?: Accusation;
  /** The room's first photo, ready to draw, and which one it is (to sign again after a reload). */
  photo?: SceneSource;
  photoRef?: ScenePhoto;
  /** What happened in the case, and the clues found (also kept for case closed: keepRecap). */
  recap?: CaseRecap;
}

interface Kept {
  wrong: number;
  ms: number;
  /** The case was closed: the next game in this room counts from zero. */
  done?: boolean;
}

const KEY = (roomId: string) => `escapd.v2.record.${roomId}`;

/**
 * The accusation that holds in a planned room: the answer the door's submit
 * rule takes ("suspect|motive|method"), as the finale's options.
 */
export function solvedAccusation(def: RoomDefinitionV2, secret: RoomSecretV2): Accusation | undefined {
  const f = def.finale;
  if (f.kind !== "accusation") return undefined;
  for (const rule of secret.rules) {
    if (rule.trigger.on !== "submit" || rule.trigger.object !== f.object) continue;
    for (const c of rule.when) {
      if (c.if !== "submitted") continue;
      const value = "slot" in c.eq ? secret.slots[c.eq.slot]?.value : String(c.eq.lit);
      const [who, why, how] = (value ?? "").split("|");
      const suspect = f.suspects.find((o) => o.id === who);
      if (suspect) return { who: suspect, why: f.motives.find((o) => o.id === why), how: f.methods.find((o) => o.id === how) };
    }
  }
  return undefined;
}

/** A slot and every slot it is derived from, down to the ones the cards show. */
function leafSlots(secret: RoomSecretV2, slot: string, seen = new Set<string>()): string[] {
  if (seen.has(slot)) return [];
  seen.add(slot);
  const from = secret.slots[slot]?.from;
  return from?.length ? from.flatMap((s) => leafSlots(secret, s, seen)) : [slot];
}

/** The finale's answer slot: what the exit's submit rule compares. */
function finaleSlot(def: RoomDefinitionV2, secret: RoomSecretV2): string | undefined {
  for (const rule of secret.rules) {
    if (rule.trigger.on !== "submit" || rule.trigger.object !== def.finale.object) continue;
    for (const c of rule.when) if (c.if === "submitted" && "slot" in c.eq) return c.eq.slot;
  }
  return undefined;
}

/** A motive or method mid-sentence: its capital dropped ("A staged fall" to "a staged fall"; an acronym kept). */
const lower = (s: string) => (/^[A-Z]([a-z]|\s)/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
const the = (label: string) => (/^(the|a|an|her|his|my|your)\s/i.test(label) ? label : `the ${label}`);
const NUMBERS = ["no", "one", "two", "three", "four", "five", "six"];

/** The story, in the mode's words, when the answer isn't on the device (a room played on the server). */
const PLAIN_STORY: Record<Genre, StoryPart[]> = {
  noir: [{ text: "You found every piece of the combination, put them in order, and walked out into the night." }],
  crime_scene: [{ text: "You named who did it, why and how, and every piece of evidence held up behind it." }],
  paranormal: [{ text: "You learned the ritual's order from what the room gave up, and finished it. The presence let go." }],
};

/**
 * What happened in the case: the solution's story (from the room's answer
 * when its secret is here), the cards that proved it (the found ones, by
 * their casebook titles) and the clues found of the case's. `found`: the ids
 * of the cards she found. `accusation`: crime scene's, when known.
 */
export function caseRecap(def: RoomDefinitionV2, secret: RoomSecretV2 | null, found: readonly string[], accusation?: Accusation): CaseRecap {
  const have = new Set(found);
  const cards = def.cards.filter((c) => have.has(c.id));
  const total = def.cards.length;
  const clues = { found: cards.length, total };
  const slot = secret ? finaleSlot(def, secret) : undefined;
  // The cards that carry the answer's pieces (the found ones), else the clues she found.
  const leaves = secret && slot ? leafSlots(secret, slot) : [];
  const proving = leaves.length ? def.cards.filter((c) => leaves.some((l) => c.text.includes(`{{${l}}}`))) : [];
  const evidence = (proving.length ? proving : cards).map((c) => c.title).slice(0, 3);
  const f = def.finale;
  const story = ((): StoryPart[] => {
    if (f.kind === "accusation" && accusation) {
      const parts: StoryPart[] = [{ text: accusation.who.name, strong: true }, { text: " did it" }];
      if (accusation.why) parts.push({ text: ", for " }, { text: lower(accusation.why.name), strong: true });
      if (accusation.how) parts.push({ text: ", by " }, { text: lower(accusation.how.name), strong: true });
      parts.push({ text: ". The evidence ruled out every other name, motive and method." });
      return parts;
    }
    if (!secret || !slot) return PLAIN_STORY[def.mode];
    const answer = secret.slots[slot];
    if (f.kind === "combination" && answer) {
      const code = answer.value.split("|").join(" ");
      const pieces = leaves.length > 1 ? `${NUMBERS[leaves.length] ?? leaves.length} pieces you found and fit together` : "the number you found";
      return [{ text: "The combination was " }, { text: code, strong: true }, { text: `: ${pieces}. The last wheel turned, and you walked out into the night.` }];
    }
    if (f.kind === "ritual" && answer) {
      const names = answer.value.split("|").map((id) => def.objects.find((o) => o.id === id)?.label).filter((l): l is string => !!l).map(the);
      if (names.length) {
        const parts: StoryPart[] = [{ text: "It wanted its ritual finished in order: " }];
        names.forEach((n, i) => {
          if (i > 0) parts.push({ text: i === names.length - 1 ? ", then " : ", " });
          parts.push({ text: n, strong: true });
        });
        parts.push({ text: ". Once it was done, it let go of the room, and of you." });
        return parts;
      }
    }
    return PLAIN_STORY[def.mode];
  })();
  return { story, evidence, ...clues };
}

const RECAP_KEY = "escapd.v2.recap";
let lastRecap: { roomId: string; recap: CaseRecap } | null = null;

/** Hand the recap to case closed: in memory, and on the device (the last case only) for a reload. */
export function keepRecap(roomId: string, recap: CaseRecap) {
  lastRecap = { roomId, recap };
  AsyncStorage.setItem(RECAP_KEY, JSON.stringify(lastRecap)).catch(() => {});
}

/** The recap of the case just closed in this room (in memory), or null. */
export function recapFor(roomId: string): CaseRecap | null {
  return lastRecap?.roomId === roomId ? lastRecap.recap : null;
}

/** The recap of the case last closed in this room: in memory, else as kept on the device; null when there is none. */
export async function loadRecap(roomId: string): Promise<CaseRecap | null> {
  const memory = recapFor(roomId);
  if (memory) return memory;
  try {
    const raw = await AsyncStorage.getItem(RECAP_KEY);
    const kept = raw ? (JSON.parse(raw) as { roomId?: string; recap?: CaseRecap }) : null;
    return kept?.roomId === roomId && kept.recap && Array.isArray(kept.recap.story) ? kept.recap : null;
  } catch {
    return null;
  }
}

/** A v1 room (the definition a room planned on the device was planned from). */
function v1Room(scene: unknown): PuzzleDefinitionV1 | null {
  const s = scene as Partial<PuzzleDefinitionV1> | null;
  return s && s.schema_version === 1 && Array.isArray(s.hotspots) ? (s as PuzzleDefinitionV1) : null;
}

/**
 * `paused`: the room is up but not being played yet (the brief over it): the
 * clock waits for it.
 */
export function useCaseRecord(roomId: string, v2: RoomV2, { paused = false }: { paused?: boolean } = {}) {
  const { phase, def, mode, scene, state, hintsUsed, cooldown, completed } = v2;
  const kept = useRef<Kept>({ wrong: 0, ms: 0 });
  // When the current stretch of play began (null: not counting).
  const since = useRef<number | null>(null);
  const lastCooldown = useRef<number | null>(null);
  const moved = useRef(false);
  const closed = useRef(completed);
  useEffect(() => {
    closed.current = completed;
  }, [completed]);
  // The kept count has been read (until then, a closed case's isn't written over).
  const loaded = useRef(false);
  const roomKey = KEY(roomId);

  const flush = useCallback(() => {
    if (since.current !== null) {
      const now = Date.now();
      kept.current.ms += now - since.current;
      since.current = now;
    }
  }, []);
  const save = useCallback(() => {
    flush();
    AsyncStorage.setItem(roomKey, JSON.stringify(kept.current)).catch(() => {});
  }, [flush, roomKey]);
  const keepClosed = useCallback(() => {
    kept.current = { ...kept.current, done: true };
    AsyncStorage.setItem(roomKey, JSON.stringify(kept.current)).catch(() => {});
  }, [roomKey]);

  // The count so far in this room (a finished case's doesn't carry over).
  useEffect(() => {
    let cancelled = false;
    kept.current = { wrong: 0, ms: 0 };
    loaded.current = false;
    AsyncStorage.getItem(roomKey)
      .then((raw) => {
        const k = raw ? (JSON.parse(raw) as Partial<Kept>) : null;
        // A closed case's count is only for that case (a finished room opens on its ending); a new game starts from zero.
        if (cancelled || !k || (k.done && !closed.current)) return;
        // Anything counted while it loaded is added to it.
        kept.current = {
          wrong: kept.current.wrong + (Number(k.wrong) || 0),
          ms: kept.current.ms + (Number(k.ms) || 0),
          ...(k.done ? { done: true } : {}),
        };
      })
      .catch(() => {})
      .finally(() => {
        if (cancelled) return;
        loaded.current = true;
        if (closed.current) keepClosed();
      });
    return () => {
      cancelled = true;
    };
  }, [roomKey, keepClosed]);

  // The clock runs while the room is ready, the app is in front and the case is open.
  const ready = phase.kind === "ready" && !!state;
  useEffect(() => {
    if (!ready || completed || paused) return;
    // A game after a closed one counts from zero.
    if (kept.current.done) kept.current = { wrong: 0, ms: 0 };
    const start = () => {
      if (since.current === null) since.current = Date.now();
    };
    const stop = () => {
      flush();
      since.current = null;
    };
    if (AppState.currentState !== "background") start();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") start();
      else {
        stop();
        save();
      }
    });
    return () => {
      sub.remove();
      stop();
      save();
    };
  }, [ready, completed, paused, flush, save]);

  // A wrong answer: a cooldown starting (not one already running when the room loaded).
  useEffect(() => {
    if (!ready) return;
    const before = lastCooldown.current;
    lastCooldown.current = cooldown;
    if (before !== null && before === 0 && cooldown > 0) {
      kept.current.wrong += 1;
      save();
    }
  }, [ready, cooldown, save]);

  // Started again from the top (the casebook's restart): the count starts again too.
  const progress = state ? state.cards.length + state.solved.length + state.inventory.length + hintsUsed : 0;
  useEffect(() => {
    if (!ready) return;
    if (progress > 0) moved.current = true;
    else if (moved.current) {
      moved.current = false;
      kept.current = { wrong: 0, ms: 0 };
      if (since.current !== null) since.current = Date.now();
      save();
    }
  }, [ready, progress, save]);

  // Closed: the count is final, and the next game here starts from zero.
  useEffect(() => {
    if (!completed) return;
    flush();
    since.current = null;
    if (loaded.current) keepClosed();
  }, [completed, flush, keepClosed]);

  /** What case closed needs, once the case is closed. */
  const finish = useCallback((sources?: SceneSources): V2Completion => {
    flush();
    const v1 = mode === "local" ? v1Room(scene) : null;
    let accusation: Accusation | undefined;
    let secret: RoomSecretV2 | null = null;
    if (def && v1) {
      const plan = planFromV1(roomId, v1);
      // Only when it is the same room (the plan's finale and cards are the ones played).
      const same = plan.ok && JSON.stringify(plan.definition.finale) === JSON.stringify(def.finale)
        && JSON.stringify(plan.definition.cards) === JSON.stringify(def.cards);
      if (plan.ok && same) {
        secret = plan.secret;
        if (def.finale.kind === "accusation") accusation = solvedAccusation(plan.definition, plan.secret);
      }
    }
    const recap = def ? caseRecap(def, secret, state?.cards ?? [], accusation) : undefined;
    if (recap) keepRecap(roomId, recap);
    return {
      title: v1?.title?.trim() || def?.title || "",
      ending: v2.ending ?? "",
      genre: def?.mode ?? "noir",
      stats: { hints: hintsUsed, wrong: kept.current.wrong, ms: kept.current.ms },
      ...(accusation ? { accusation } : {}),
      ...(recap ? { recap } : {}),
      ...(sources?.kind === "ready" && sources.sources[0] !== undefined ? { photo: sources.sources[0] } : {}),
      ...(scene?.photos[0] ? { photoRef: scene.photos[0] } : {}),
    };
  }, [flush, mode, scene, def, state, roomId, v2.ending, hintsUsed]);

  return { finish };
}
