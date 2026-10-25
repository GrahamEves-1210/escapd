// Coach marks for The Study. Each step is derived from server-confirmed state
// (plus which views the player has looked at, which is navigation, not
// progress), so a mark disappears only after the expected action succeeded.
// Ids match supabase/seed.sql.
import type { Id, SessionState } from "@/lib/puzzle-types";

export type CoachTarget =
  | { kind: "hotspot"; hotspotId: Id; photoIndex: number }
  | { kind: "scene"; photoIndex: number }
  | { kind: "inventory" };

export interface CoachStep {
  id: string;
  text: string;
  target: CoachTarget;
}

export interface CoachContext {
  state: SessionState;
  visitedScenes: number[];
}

interface StepDef extends CoachStep {
  done: (c: CoachContext) => boolean;
  ready?: (c: CoachContext) => boolean;
}

const solved = (c: CoachContext, id: Id) => c.state.solved.includes(id);
const has = (c: CoachContext, id: Id) => c.state.inventory.includes(id);

const STEPS: StepDef[] = [
  {
    id: "inspect",
    text: "Tap the desk drawer to search it.",
    target: { kind: "hotspot", hotspotId: "desk_drawer", photoIndex: 0 },
    done: (c) => solved(c, "find_key"),
  },
  {
    id: "shelf",
    text: "Books hide things. Try the shelf.",
    target: { kind: "hotspot", hotspotId: "bookshelf", photoIndex: 0 },
    done: (c) => solved(c, "find_note_left"),
  },
  {
    id: "scenes",
    text: "The room has more than one view. Tap the second view below.",
    target: { kind: "scene", photoIndex: 1 },
    done: (c) => c.visitedScenes.includes(1),
  },
  {
    id: "rug",
    text: "One corner of the rug is curled. Look underneath.",
    target: { kind: "hotspot", hotspotId: "rug", photoIndex: 1 },
    done: (c) => solved(c, "find_note_right"),
  },
  {
    id: "combine",
    text: "Two torn halves. Select both notes, then close the clasp.",
    target: { kind: "inventory" },
    ready: (c) => has(c, "torn_note_left") && has(c, "torn_note_right"),
    done: (c) => solved(c, "join_notes"),
  },
  {
    id: "use",
    text: "Select the brass key, then tap the locked cabinet.",
    target: { kind: "hotspot", hotspotId: "cabinet", photoIndex: 1 },
    ready: (c) => has(c, "brass_key"),
    done: (c) => solved(c, "open_cabinet"),
  },
  {
    id: "code",
    text: "Something was hidden behind the cabinet. Tap it and enter the code from your note.",
    target: { kind: "hotspot", hotspotId: "safe", photoIndex: 1 },
    ready: (c) => c.state.revealed_hotspots.includes("safe"),
    done: (c) => solved(c, "open_safe"),
  },
  {
    id: "exit",
    text: "The safe held the door key. Find the door.",
    target: { kind: "hotspot", hotspotId: "door", photoIndex: 2 },
    ready: (c) => solved(c, "open_safe"),
    done: (c) => solved(c, "escape"),
  },
];

/** The first step that is not done and whose preconditions hold, or null. */
export function tutorialCoach(context: CoachContext): CoachStep | null {
  const step = STEPS.find((s) => !s.done(context) && (s.ready?.(context) ?? true));
  if (!step) return null;
  return { id: step.id, text: step.text, target: step.target };
}
