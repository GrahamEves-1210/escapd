// The contract between the inspection view and an archetype's mechanism: the
// interactive part drawn under the close-up crop (a drawer that slides, clock
// hands that turn, wheels that roll). A mechanism owns its gesture and its
// local feel (detents, haptics, sound); it reports a value only on release
// (`onSet`) or on a deliberate submit (`onSubmit`). The engine decides what
// that value means: a mechanism never knows an answer.
import type { ReactNode } from "react";
import type { ControlDef, ControlDomain, FinaleDef, StateValue } from "@/engine/v2";
import type { ArchetypeId } from "@/engine/v2";

/** What is being worked: an object in the photo or an item held in the tray. */
export interface MechanismTarget {
  kind: "object" | "item";
  id: string;
  label: string;
  archetype: ArchetypeId | null;
  variant?: string;
  controls: ControlDef[];
  submit?: ControlDomain;
}

export interface MechanismProps {
  target: MechanismTarget;
  /** The target's current state: control values ("time": "3:15") and flags (open, locked, lifted, on, tilted, panel). */
  state: Record<string, StateValue>;
  /** Commit one control's value, on release. Booleans for open/lifted/tilted/on; strings in the control's domain otherwise. */
  onSet: (control: string, value: StateValue) => void;
  /** Locks and the door: one submit (wheels' symbols, [suspect, motive, method], or ritual object ids in order). */
  onSubmit: (value: string[]) => void;
  /**
   * The player moved something without committing it (a wheel, a pick, a
   * chosen object): a note about the last try ("Not that.") is stale now.
   */
  onChange?: () => void;
  /** An action is in flight: hold still. */
  busy: boolean;
  /** A wrong-answer cooldown is running: submits are disabled, with its seconds left. */
  cooldown: number;
  /** The door: the finale's public shape (accusation options, wheel count, ritual length). */
  finale?: FinaleDef;
  /** The ritual's choices: the room's objects the player has seen, by id and label. */
  ritualChoices?: { id: string; label: string }[];
  /** Width available (the inspection view's content width). */
  width: number;
  /**
   * What it holds (notes, items), for a mechanism with an inside to lay it in:
   * a drawer's, under a cloth. The others leave it to the inspection view.
   */
  inside?: ReactNode;
}
