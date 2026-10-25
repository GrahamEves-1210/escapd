// The one way into the camera (docs/DESIGN.md, 04 · Entry rule, as changed by
// 05 · Entry rule). It checks access first, then the photo guide's seen flag.
// Callers: 01's YOUR ROOM card (push), the guide replay's last step
// ({ replace: true, skipGuide: true }), /pro after its test purchase
// ({ replace: true }) and /tutorial/complete ({ replace: true }, not wired
// yet). Every caller sits directly on the hub, so back from wherever this
// lands returns to the hub.
import { router, type Href } from "expo-router";
import { ensureSession, getMyAccess } from "@/lib/escapd-api";
import type { MyAccess } from "@/lib/puzzle-types";
import { hasSeenCaptureGuide } from "./guideSeen";

export interface OpenCaptureOptions {
  /** Navigate with router.replace instead of router.push, so the caller leaves the stack. */
  replace?: boolean;
  /** Skip the seen-flag step and go straight to /capture once access is confirmed (the guide replay's last step). */
  skipGuide?: boolean;
  /**
   * Drops the navigation. Abort it when the caller loses focus or unmounts:
   * once aborted, openCapture resolves null and navigates nowhere, so a late
   * result never moves a player who has already left.
   */
  signal?: AbortSignal;
}

/**
 * Where openCapture sent the player:
 * - "account": a guest, sent to /account?next=back (the server requires an email account);
 * - "pro": no custom_rooms entitlement, sent to /pro?cap=<generations_cap>;
 * - "develop": monthly cap reached, sent to /capture/develop?from=hub (develop's cap state);
 * - "guide": access, first time, sent to /capture/guide;
 * - "capture": access, sent to /capture.
 */
export type CaptureDestination = "account" | "pro" | "develop" | "guide" | "capture";

/** The access branch of the entry rule, checked in this order. Null means the player has access. */
function accessDestination(access: MyAccess): "account" | "pro" | "develop" | null {
  if (access.is_anonymous) return "account";
  if (!access.has_custom_rooms_entitlement) return "pro";
  if (!access.can_generate) return "develop";
  return null;
}

function hrefFor(destination: CaptureDestination, access: MyAccess): Href {
  switch (destination) {
    case "account":
      return { pathname: "/account", params: { next: "back" } };
    case "pro":
      // /pro renders its default state from ?cap with no second check. Without
      // a usable cap it runs its own check (its Loading state).
      return Number.isFinite(access.generations_cap)
        ? { pathname: "/pro", params: { cap: String(access.generations_cap) } }
        : "/pro";
    case "develop":
      // Develop repeats its own check and shows its cap state. from=hub is for
      // its button ("Back" instead of "Back to the title"); develop.tsx doesn't
      // read it yet.
      return { pathname: "/capture/develop", params: { from: "hub" } };
    case "guide":
      return "/capture/guide";
    case "capture":
      return "/capture";
  }
}

/**
 * Opens the camera the way docs/DESIGN.md's entry rule says: ensureSession(),
 * then getMyAccess(), routing a guest to /account?next=back, a player without
 * the custom_rooms entitlement to /pro, and a player at the monthly cap to
 * /capture/develop?from=hub. With access it goes to /capture/guide the first
 * time (the seen flag: session flag, then AsyncStorage), otherwise /capture.
 *
 * Resolves with where it went, or null when `signal` was aborted first. When
 * the check can't run (offline, a server error) it rejects without
 * navigating, and the caller decides: 01 continues to /capture, whose
 * backstop still shows a first-timer the guide; the guide replay shows its
 * error line.
 */
export async function openCapture(options: OpenCaptureOptions = {}): Promise<CaptureDestination | null> {
  const { replace = false, skipGuide = false, signal } = options;
  if (signal?.aborted) return null;
  await ensureSession();
  if (signal?.aborted) return null;
  const access = await getMyAccess();
  if (signal?.aborted) return null;
  const destination: CaptureDestination = accessDestination(access)
    ?? (skipGuide || (await hasSeenCaptureGuide()) ? "capture" : "guide");
  if (signal?.aborted) return null;
  const href = hrefFor(destination, access);
  if (replace) router.replace(href);
  else router.push(href);
  return destination;
}
