// One play request on a v2 session, as a pure function: the play-action edge
// function wraps it with auth and storage, and the app runs the same code for
// rooms it plays on the device. It owns what the engine doesn't: the stored
// state's extras (hint rungs taken), the wrong-answer cooldown, the hint
// ladder and the rendered casebook.
import { applyAction, initialState, renderCard } from "./engine.ts";
import type { Action, ActionResult, PlayState, RoomDefinitionV2, RoomSecretV2, StepDef } from "./types.ts";

/** How long a wrong submit locks further submits. */
export const COOLDOWN_MS = 5000;

/** game_sessions.state for a v2 session: the engine's state, the hint rungs taken, and v1's required key. */
export interface StoredStateV2 extends PlayState {
  hints: Record<string, number>;
  revealed_hotspots: string[];
}

export interface PlayRequest {
  action?: Action;
  /** Take the next hint rung. Neither: just load. */
  hint?: boolean;
}

export interface FoundCardV2 {
  id: string;
  title: string;
  text: string;
}

export interface PlayResponse {
  state: PlayState;
  result?: ActionResult;
  /** Every card found so far, rendered, in the order found. */
  cards: FoundCardV2[];
  /** Every hint rung taken so far, rendered, oldest first. */
  hints: string[];
  /** The rung just taken (a hint request); null when nothing is left to hint. */
  hint?: { text: string; rung: number } | null;
  /** False once every required step is solved. */
  can_hint: boolean;
  /** Epoch ms while a cooldown runs, else null. */
  cooldown_until: number | null;
  completed: boolean;
  ending?: string;
}

/** What the caller stores after the request. */
export interface PlaySave {
  state: StoredStateV2;
  wrong: number;
  hints: number;
  actions: number;
  lockedUntil: number | null;
  completed: boolean;
}

/** The step a hint should help with: the first required step whose prerequisites are met and isn't solved. */
export function nextStep(secret: RoomSecretV2, solved: readonly string[]): StepDef | null {
  return secret.steps.find((s) => !s.optional && !solved.includes(s.id) && s.requires.every((r) => solved.includes(r))) ?? null;
}

/** A stored state, or a fresh one when the session was started with v1's empty shape. */
export function storedState(def: RoomDefinitionV2, raw: unknown): StoredStateV2 {
  const s = raw as Partial<StoredStateV2> | null;
  if (s && typeof s === "object" && s.objects && typeof s.objects === "object" && Array.isArray(s.cards)) {
    return { ...(s as StoredStateV2), hints: s.hints ?? {}, revealed_hotspots: s.revealed_hotspots ?? [] };
  }
  return { ...initialState(def), hints: {}, revealed_hotspots: [] };
}

function renderCards(def: RoomDefinitionV2, secret: RoomSecretV2, ids: readonly string[]): FoundCardV2[] {
  return ids.flatMap((id) => {
    const card = def.cards.find((c) => c.id === id);
    return card ? [{ id, title: card.title, text: renderCard(card, secret) }] : [];
  });
}

function renderHints(secret: RoomSecretV2, taken: Record<string, number>): string[] {
  const out: string[] = [];
  for (const step of secret.steps) {
    const n = taken[step.id] ?? 0;
    for (let i = 0; i < n; i++) out.push(renderCard({ id: step.id, title: step.title, text: step.hints[i] }, secret));
  }
  return out;
}

export function play(
  def: RoomDefinitionV2,
  secret: RoomSecretV2,
  raw: unknown,
  req: PlayRequest,
  now: number,
  lockedUntil: number | null,
): { response: PlayResponse; save: PlaySave | null } {
  let stored = storedState(def, raw);
  let locked = lockedUntil !== null && lockedUntil > now ? lockedUntil : null;
  let result: ActionResult | undefined;
  let hint: PlayResponse["hint"];
  let wrong = 0, hints = 0, actions = 0;
  let changed = false;

  if (req.action) {
    const { hints: taken, revealed_hotspots, ...state } = stored;
    const out = applyAction(def, secret, state, req.action, { cooldownActive: locked !== null });
    result = out.result;
    stored = { ...out.state, hints: taken, revealed_hotspots };
    actions = 1;
    if (result.outcome === "wrong") wrong = 1;
    if (result.start_cooldown) locked = now + COOLDOWN_MS;
    changed = true;
  } else if (req.hint) {
    const step = nextStep(secret, stored.solved);
    if (step) {
      const rung = Math.min(3, (stored.hints[step.id] ?? 0) + 1);
      if (rung !== stored.hints[step.id]) {
        stored = { ...stored, hints: { ...stored.hints, [step.id]: rung } };
        hints = 1;
        changed = true;
      }
      hint = { text: renderCard({ id: step.id, title: step.title, text: step.hints[rung - 1] }, secret), rung };
    } else {
      hint = null;
    }
  }

  const { hints: _h, revealed_hotspots: _r, ...state } = stored;
  const response: PlayResponse = {
    state,
    ...(result ? { result } : {}),
    cards: renderCards(def, secret, stored.cards),
    hints: renderHints(secret, stored.hints),
    ...(hint !== undefined ? { hint } : {}),
    can_hint: nextStep(secret, stored.solved) !== null,
    cooldown_until: locked,
    completed: stored.completed,
    ...(stored.completed ? { ending: secret.ending } : {}),
  };
  return {
    response,
    save: changed ? { state: stored, wrong, hints, actions, lockedUntil: locked, completed: stored.completed } : null,
  };
}
