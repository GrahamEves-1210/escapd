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
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AccuseOption, Genre, PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import type { RoomDefinitionV2, RoomSecretV2 } from "@/engine/v2";
import type { ScenePhoto, SceneSources } from "@/game/useSceneSources";
import type { SceneSource } from "@/render/SceneView";
import type { CaseStats } from "@/render/victory";
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

/** A v1 room (the definition a room planned on the device was planned from). */
function v1Room(scene: unknown): PuzzleDefinitionV1 | null {
  const s = scene as Partial<PuzzleDefinitionV1> | null;
  return s && s.schema_version === 1 && Array.isArray(s.hotspots) ? (s as PuzzleDefinitionV1) : null;
}

export function useCaseRecord(roomId: string, v2: RoomV2) {
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
    if (!ready || completed) return;
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
  }, [ready, completed, flush, save]);

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
    if (def && v1 && def.finale.kind === "accusation") {
      const plan = planFromV1(roomId, v1);
      // Only when it is the same room (the plan's options are the ones played).
      if (plan.ok && JSON.stringify(plan.definition.finale) === JSON.stringify(def.finale)) accusation = solvedAccusation(plan.definition, plan.secret);
    }
    return {
      title: v1?.title?.trim() || def?.title || "",
      ending: v2.ending ?? "",
      genre: def?.mode ?? "noir",
      stats: { hints: hintsUsed, wrong: kept.current.wrong, ms: kept.current.ms },
      ...(accusation ? { accusation } : {}),
      ...(sources?.kind === "ready" && sources.sources[0] !== undefined ? { photo: sources.sources[0] } : {}),
      ...(scene?.photos[0] ? { photoRef: scene.photos[0] } : {}),
    };
  }, [flush, mode, scene, def, roomId, v2.ending, hintsUsed]);

  return { finish };
}
