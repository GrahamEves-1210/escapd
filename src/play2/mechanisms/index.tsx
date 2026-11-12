// The mechanism for a target: its archetype (and variant) picks the component.
// Scenery (no archetype) and Assemble (worked in the tray) draw nothing here.
import { ClockHands } from "./ClockHands";
import { CombinationLock } from "./CombinationLock";
import { Decoder } from "./Decoder";
import { Door } from "./Door";
import { Drawer } from "./Drawer";
import { FrameTilt } from "./FrameTilt";
import { LiftUnder } from "./LiftUnder";
import { Light } from "./Light";
import { Readable } from "./Readable";
import { useEffect } from "react";
import { warmSprites } from "./sprites";
import { TuningDial } from "./TuningDial";
import type { MechanismProps } from "./types";

export type { MechanismProps, MechanismTarget } from "./types";

// The mechanisms' rendered parts, read into memory a moment after the game's code loads (never in a test).
if (process.env.NODE_ENV !== "test") setTimeout(warmSprites, 1200);

export function Mechanism(props: MechanismProps) {
  // (And at the first close-up, if that comes sooner.)
  useEffect(warmSprites, []);
  switch (props.target.archetype) {
    case "Drawer": return <Drawer {...props} />;
    case "LiftUnder": return <LiftUnder {...props} />;
    case "Readable": return <Readable {...props} />;
    case "FrameTilt": return <FrameTilt {...props} />;
    case "ClockHands": return <ClockHands {...props} />;
    case "TuningDial": return <TuningDial {...props} />;
    case "CombinationLock": return <CombinationLock {...props} />;
    case "Light": return <Light {...props} />;
    case "Decoder": return <Decoder {...props} />;
    case "Door": return <Door {...props} />;
    case "Assemble":
    case null:
    default:
      return null;
  }
}
