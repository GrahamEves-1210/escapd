// The photo guide's entry rule as /capture's backstop (docs/DESIGN.md 04,
// Entry rule; 03, States: Checking). Every caller of openCapture() already
// checks the seen flag, but any other way into /capture outside retake mode
// checks it again: the session flag first, then the stored key. /capture shows
// bare ground until it resolves, and an unseen guide replaces the route.
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
