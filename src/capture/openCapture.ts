// The one way into the camera (docs/DESIGN.md, 04 · Entry rule, as changed by
// 05 · Entry rule). It checks access first; with access it always opens the
// photo guide, which shows before every new room and then continues to the
// camera. Callers: home's mode cards and its continue prompt's Start a new
// case ({ genre }, push), a mode's first-time intro ({ genre, replace: true }),
// case closed's Start a new case ({ genre, replace: true }), the guide's
// access-checked continue when it was opened directly ({ replace: true,
// skipGuide: true }) and /pro after its test purchase ({ replace: true }).
// Back from wherever this lands returns home. A genre sets the active mode
// (the guide, camera, review and build wait take its look) and the mode the
// room is built in; a caller without one keeps the roll's, so the trip
// through /pro keeps it.
import { router, type Href } from "expo-router";
import { setMode } from "@/game/mode";
import { ensureSession, getMyAccess } from "@/lib/escapd-api";
import type { Genre, MyAccess } from "@/lib/puzzle-types";
import { resetCaptureGuide } from "./guideSeen";
import { setRollGenre } from "./roll";

export interface OpenCaptureOptions {
  /**
   * The mode the new case is for: made the active mode and kept with the
   * roll, so the room is created in it. Omitted, the roll's mode stays.
   */
  genre?: Genre;
  /** Navigate with router.replace instead of router.push, so the caller leaves the stack. */
  replace?: boolean;
  /** Go straight to /capture once access is confirmed: the guide's own continue, when it already showed for this room. */
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
 * - "guide": access, sent to /capture/guide (every new room);
 * - "capture": access with skipGuide, sent to /capture.
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
 * /capture/develop?from=hub. With access it goes to /capture/guide, which
 * continues to the camera; with skipGuide (the guide itself) to /capture.
 * A genre is applied first, before any check, so a player sent to /account
 * or /pro comes back to the same mode.
 * Unless skipGuide is set, a new room starts: the guide's flag for the room
 * is cleared first, so /capture's backstop shows the guide even when the
 * caller falls back to /capture without this check.
 *
 * Resolves with where it went, or null when `signal` was aborted first. When
 * the check can't run (offline, a server error) it rejects without
 * navigating, and the caller decides: 01 continues to /capture, whose
 * backstop still shows the guide first; the guide shows its error line.
 */
export async function openCapture(options: OpenCaptureOptions = {}): Promise<CaptureDestination | null> {
  const { replace = false, skipGuide = false, signal, genre } = options;
  if (signal?.aborted) return null;
  if (genre) {
    setMode(genre);
    setRollGenre(genre);
  }
  if (!skipGuide) resetCaptureGuide();
  await ensureSession();
  if (signal?.aborted) return null;
  const access = await getMyAccess();
  if (signal?.aborted) return null;
  const destination: CaptureDestination = accessDestination(access) ?? (skipGuide ? "capture" : "guide");
  const href = hrefFor(destination, access);
  if (replace) router.replace(href);
  else router.push(href);
  return destination;
}
