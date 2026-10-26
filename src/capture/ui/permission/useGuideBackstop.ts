// The photo guide's entry rule as /capture's backstop (docs/DESIGN.md 04,
// Entry rule; 03, States: Checking). The guide shows before every new room:
// openCapture() always opens it, and clears the room's guide flag first. Any
// other way into /capture outside retake mode (an offline fallback, a deep
// link) checks that flag here: /capture shows bare ground until it resolves,
// and a guide not yet shown for this room replaces the route. Coming back to
// the camera for the same room ("Add a photo") passes straight through.
// Retake mode never shows the guide.
import { useEffect, useState } from "react";
import { captureGuideSeenThisSession, hasSeenCaptureGuide } from "@/capture/guideSeen";

export type GuideBackstop = "checking" | "seen" | "unseen";

/** `active` is false in retake mode, which never shows the guide. */
export function useGuideBackstop(active: boolean): GuideBackstop {
  // The session flag is synchronous, so a returning player resolves at once.
  const [seen, setSeen] = useState<boolean | null>(() => (captureGuideSeenThisSession() ? true : null));

  useEffect(() => {
    if (!active || seen !== null) return;
    let live = true;
    // hasSeenCaptureGuide never rejects: a failed read counts as unseen.
    void hasSeenCaptureGuide().then((value) => {
      if (live) setSeen(value);
    });
    return () => {
      live = false;
    };
  }, [active, seen]);

  if (!active) return "seen";
  if (seen === null) return "checking";
  return seen ? "seen" : "unseen";
}
