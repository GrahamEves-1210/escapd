// The guide's one real wait when it was opened directly (?replay=1), with no
// access check behind it (docs/DESIGN.md 04, Tappable elements: Open the
// camera; States: Check wait and Check error). The continue (step 4 or the X)
// marks the guide shown for this room, then runs the same access check as
// 01's YOUR ROOM through openCapture({ replace: true, skipGuide: true }), which
// navigates on its own: the camera, or the account, Pro or monthly-limit
// screen. The guide leaves the stack either way. A failed check shows the
// error line; the button stays live for a retry, which clears the line and
// waits again.
import { useCallback, useEffect, useRef, useState } from "react";
import { markCaptureGuideSeen } from "@/capture/guideSeen";
import { openCapture } from "@/capture/openCapture";

/**
 * idle: nothing running. checking: the access check is running. failed: it
 * couldn't run (the error line). left: it navigated away, so the guide is
 * leaving: the wait is over, but the button stays busy.
 */
export type ReplayCheck = "idle" | "checking" | "failed" | "left";

/**
 * @param onLeave Called as soon as the check has navigated away, before the
 * next render: the guide is on its way out and must ignore every control
 * from then on (a Close tap would otherwise go back from the screen the check
 * just opened). Keep it stable (useCallback).
 */
export function useReplayCheck(onLeave: () => void) {
  const [status, setStatus] = useState<ReplayCheck>("idle");
  const pending = useRef<AbortController | null>(null);

  // Leaving the guide mid-check drops the navigation, so a late result never
  // moves a player who has already gone.
  useEffect(() => {
    return () => {
      pending.current?.abort();
    };
  }, []);

  const start = useCallback(() => {
    if (pending.current) return;
    // In order: the room's guide flag, then the check.
    void markCaptureGuideSeen();
    const controller = new AbortController();
    pending.current = controller;
    setStatus("checking");
    openCapture({ replace: true, skipGuide: true, signal: controller.signal }).then(
      (destination) => {
        // Null: cancelled before it navigated (cancel has already reset everything).
        if (destination === null) return;
        // It navigated. The wait ends here, so the thinking line unmounts at
        // once rather than shimmering through the route's exit fade. `pending`
        // stays set, so nothing can start another check.
        onLeave();
        setStatus("left");
      },
      () => {
        if (controller.signal.aborted) return;
        pending.current = null;
        setStatus("failed");
      },
    );
  }, [onLeave]);

  /** Drops a running check and clears the error line (leaving step 4, or the guide). */
  const cancel = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    setStatus("idle");
  }, []);

  /** The step button ignores taps: while the check runs, and once it has navigated. */
  const busy = status === "checking" || status === "left";

  return { status, busy, start, cancel };
}
