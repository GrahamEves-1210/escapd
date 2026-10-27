/// <reference types="node" />
// Test-only: reads The Study straight from supabase/seed.sql so tests can
// never drift from the room the server actually publishes.
import fs from "fs";
import path from "path";
import type { GameSession } from "@/lib/escapd-api";
import type { PuzzleDefinitionV1, SessionState } from "@/lib/puzzle-types";

const SEED = fs.readFileSync(path.join(__dirname, "../../supabase/seed.sql"), "utf8");

function extract(variable: string) {
  const match = SEED.match(new RegExp(`${variable} jsonb := \\$json\\$([\\s\\S]*?)\\$json\\$`));
  if (!match) throw new Error(`${variable} not found in seed.sql`);
  return JSON.parse(match[1]);
}

/** The fixture room's id (the old bundled tutorial's seed, kept as test data only). */
export const FIXTURE_ROOM_ID = "00000000-0000-4000-8000-000000000001";

export const studyPublic = (): PuzzleDefinitionV1 => extract("v_public");

/** The secret solution. Tests may read it to script server responses; the app never sees it. */
export const studySecret = (): { puzzles: Record<string, { message?: string; answer?: string }> } => extract("v_secret");

/** What start_or_resume_session creates: every non-hidden hotspot revealed. */
export function initialState(def: PuzzleDefinitionV1): SessionState {
  return {
    solved: [],
    inventory: [],
    revealed_hotspots: def.hotspots.filter((h) => !h.hidden).map((h) => h.id),
  };
}

/** A fresh active game_sessions row for The Study, as start_or_resume_session returns it. */
export function sessionRow(def: PuzzleDefinitionV1, overrides: Partial<GameSession> = {}): GameSession {
  return {
    id: "s1", user_id: "u1", room_id: "r1", puzzle_version_id: "v1", status: "active",
    state: initialState(def) as unknown as GameSession["state"], action_count: 0, wrong_answer_count: 0,
    hints_used: 0, hint_progress: {}, code_wrong_streak: 0, code_locked_until: null,
    started_at: "", last_played_at: "", completed_at: null, created_at: "", updated_at: "",
    ...overrides,
  };
}
