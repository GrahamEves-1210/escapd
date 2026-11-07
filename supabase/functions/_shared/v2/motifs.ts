// The motif library: small reusable dependency patterns the planner composes
// threads from. Data only; planner.ts holds the builders. `steps` is the motif's
// own step count (min, or [min, max] when it recurses into an upstream value).
import type { ArchetypeId } from "./archetypes.ts";
import type { Mode, MotifId } from "./types.ts";

export interface MotifSpec {
  id: MotifId;
  summary: string;
  delivers: ("info" | "item")[];   // what it can hand to the step downstream
  minSteps: number;                // including the upstream steps it always needs
  fixed?: boolean;                 // exactly minSteps (no recursion)
  leaf?: boolean;                  // needs nothing upstream; never a whole thread on its own
  archetypes: ArchetypeId[];
  maxPerRoom?: number;
  weight: Record<Mode, number>;    // mode flavour: how often the planner reaches for it
}

const w = (noir: number, crime_scene: number, paranormal: number) => ({ noir, crime_scene, paranormal });

export const MOTIFS: Record<Exclude<MotifId, "finale">, MotifSpec> = {
  read: { id: "read", summary: "a readable card states the value", delivers: ["info"], minSteps: 1, fixed: true, leaf: true, archetypes: ["Readable"], weight: w(1, 1.4, 1) },
  contain: { id: "contain", summary: "a prop is found inside a real object", delivers: ["info", "item"], minSteps: 1, fixed: true, leaf: true, archetypes: ["Drawer", "LiftUnder", "FrameTilt"], weight: w(1, 1, 1) },
  split: { id: "split", summary: "two halves found apart, assembled into one value", delivers: ["info"], minSteps: 3, fixed: true, archetypes: ["Assemble"], maxPerRoom: 1, weight: w(1.6, 1.4, 1.1) },
  set_state: { id: "set_state", summary: "a value learned elsewhere sets a mechanism (a tuning dial; a clock, to a time worked out from two facts)", delivers: ["info", "item"], minSteps: 2, archetypes: ["ClockHands", "TuningDial"], weight: w(1.5, 1, 1.2) },
  cross_reference: { id: "cross_reference", summary: "one object says where in a book to look", delivers: ["info"], minSteps: 2, archetypes: ["Readable"], maxPerRoom: 1, weight: w(1, 1.4, 0.9) },
  decode: { id: "decode", summary: "an encoded message plus a cipher wheel set to an offset", delivers: ["info"], minSteps: 4, archetypes: ["Decoder"], maxPerRoom: 1, weight: w(1.8, 0.8, 1.3) },
  tool_reveal: { id: "tool_reveal", summary: "a found UV torch shows traces on the photo (then read under the magnifier), or a mark on something already seen", delivers: ["info"], minSteps: 2, archetypes: ["Light"], maxPerRoom: 1, weight: w(1.3, 1.5, 1.3) },
  room_change: { id: "room_change", summary: "a lamp changes the room and marks another object", delivers: ["info"], minSteps: 2, fixed: true, archetypes: ["Light"], maxPerRoom: 1, weight: w(1, 0.8, 1.1) },
  ordering: { id: "ordering", summary: "an order learned in pieces, entered in sequence (the ritual)", delivers: ["info"], minSteps: 1, archetypes: ["Door"], weight: w(0, 0, 1) },
  contain_lock: { id: "contain_lock", summary: "a key or a code opens a container (at most one per room)", delivers: ["info", "item"], minSteps: 2, archetypes: ["Drawer", "CombinationLock"], maxPerRoom: 1, weight: w(1, 0.7, 0.7) },
  warm_reveal: { id: "warm_reveal", summary: "a blank letter in lemon juice, warmed at a lamp the player switches on", delivers: ["info"], minSteps: 2, archetypes: ["Light"], maxPerRoom: 1, weight: w(1.4, 1.2, 1.4) },
  mirror_reveal: { id: "mirror_reveal", summary: "a note in mirror writing, read by holding it to the room's mirror", delivers: ["info"], minSteps: 2, archetypes: [], maxPerRoom: 1, weight: w(1.3, 1.2, 1.5) },
  story_fragment: { id: "story_fragment", summary: "an optional prop that rewards looking", delivers: [], minSteps: 0, archetypes: ["Drawer", "LiftUnder", "FrameTilt"], weight: w(1, 1, 1) },
};
