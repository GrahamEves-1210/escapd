// "Ask the informant" (GAME_FEEL_PROMPT.md, 4): the hint ladder, presented
// as a character's line. All of the hint logic is the server's use_hint RPC
// (supabase/migrations: which step the ladder is pinned to, one rung at a
// time, replays free, each new rung counted in hints_used); this file only
// asks it for the next rung and keeps the rungs already shown. Hint text and
// the server's messages are shown verbatim; only the framing is in the
// mode's voice.
import type { Genre, HintProgress, HintResult, Id } from "@/lib/puzzle-types";
import { ApiError } from "@/lib/escapd-api";
import { supabase } from "@/lib/supabase";

/** Who gives the tips in each mode, and the framing around their line. */
export interface InformantVoice {
  /** The matchbook's label. */
  ask: string;
  /** The sheet's title. */
  name: string;
  /** The byline over his line. */
  lead: string;
  /** Asking for the next rung. */
  again: string;
  /** Before the first tip: what asking costs. */
  waiting: string;
  /** Every rung for this step is out. */
  dry: string;
  /** The line went dead (offline or a failed call). */
  cold: string;
  /** His silhouette. */
  figure: "fedora" | "cap" | "veil";
}

export const INFORMANTS: Readonly<Record<Genre, InformantVoice>> = {
  noir: {
    ask: "Ask the informant",
    name: "The informant",
    lead: "Word on the street",
    again: "Lean on him",
    waiting: "He keeps to the phone booth on the corner. A tip goes on your record.",
    dry: "That's all he knows. You're on your own, gumshoe.",
    cold: "The line went dead. Try again.",
    figure: "fedora",
  },
  crime_scene: {
    ask: "Ask the beat cop",
    name: "The beat cop",
    lead: "Off the record",
    again: "Press him",
    waiting: "He walked this block the night it happened. A tip goes on your record.",
    dry: "That's all he saw. The rest is on you, detective.",
    cold: "The radio crackled out. Try again.",
    figure: "cap",
  },
  paranormal: {
    ask: "Ask the medium",
    name: "The medium",
    lead: "The medium murmurs",
    again: "Ask her again",
    waiting: "She hears what the room won't say. A tip goes on your record.",
    dry: "The voices have gone quiet. That's all she can hear.",
    cold: "The connection broke. Try again.",
    figure: "veil",
  },
};

export function informantFor(genre: Genre | null | undefined): InformantVoice {
  return INFORMANTS[genre ?? "noir"];
}

/** The use_hint RPC: rung `rung` (1-based) for this session's current step. */
export async function askInformant(sessionId: string, rung: number): Promise<HintResult> {
  const { data, error } = await supabase.rpc("use_hint", { p_session_id: sessionId, p_rung: rung });
  if (error) throw new ApiError(error.message, error.code || undefined, error);
  if (data == null) throw new ApiError("Empty response");
  return data as unknown as HintResult;
}

/** The rungs shown so far for the step the ladder is pinned to. */
export interface Ladder {
  puzzleId: Id | null;
  rungs: string[];
  /** Known once the server has answered for this step. */
  total: number | null;
  /** Every rung is out (the server said there is no next one). */
  dry: boolean;
}

export const EMPTY_LADDER: Ladder = { puzzleId: null, rungs: [], total: null, dry: false };

/** The ladder as the session row stored it (game_sessions.hint_progress). */
export function ladderFrom(progress: HintProgress | null | undefined): Ladder {
  if (!progress?.puzzle_id || !Array.isArray(progress.rungs)) return EMPTY_LADDER;
  return { puzzleId: progress.puzzle_id, rungs: progress.rungs.filter((r) => typeof r === "string"), total: null, dry: false };
}

/** Every rung for this step has been shown. */
export function isDry(ladder: Ladder): boolean {
  return ladder.dry || (ladder.total !== null && ladder.rungs.filter(Boolean).length >= ladder.total);
}

/**
 * What is still shown: a ladder pinned to a step that has since been solved
 * shows nothing (the server's next call moves on), as hint_progress says.
 */
export function visibleLadder(ladder: Ladder, solved: readonly Id[]): Ladder {
  return ladder.puzzleId && solved.includes(ladder.puzzleId) ? EMPTY_LADDER : ladder;
}

/** The ladder after the server's answer to a request for rung `rung`. */
export function nextLadder(ladder: Ladder, result: HintResult): Ladder {
  if (result.status === "ok") {
    const same = result.puzzle_id === ladder.puzzleId;
    const rungs = same ? [...ladder.rungs] : [];
    rungs[result.rung - 1] = result.hint;
    return { puzzleId: result.puzzle_id, rungs: Array.from(rungs, (r) => r ?? ""), total: result.total_rungs, dry: false };
  }
  if (result.status === "rung_unavailable") {
    const same = result.puzzle_id === ladder.puzzleId;
    return {
      puzzleId: result.puzzle_id,
      rungs: same ? ladder.rungs : [],
      total: result.total_rungs,
      dry: result.next_rung === null,
    };
  }
  return ladder;
}
