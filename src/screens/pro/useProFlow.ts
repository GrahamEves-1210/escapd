// What /pro does (docs/DESIGN.md, 05 · Pro: Tappable elements and States):
// Loading when opened without ?cap, the test purchase ("Unlock Pro"),
// "Check again" when test purchases are off, the re-check when the app comes
// back to the foreground, and the routes out (Guest, Already has access, Not
// now). Every late result is dropped once the player has left: each async
// step checks the AbortSignal of the focus it started in.
import { useCallback, useRef, useState } from "react";
import { AppState, BackHandler } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { openCapture } from "@/capture/openCapture";
import { grantTestEntitlement, TestPurchaseError, TestPurchaseUnavailableError } from "@/capture/testPurchase";
import { useFeedback } from "@/game/feedback";
import { currentSession, ensureSession, getMyAccess, isNetworkError } from "@/lib/escapd-api";
import type { MyAccess } from "@/lib/puzzle-types";
import * as copy from "./copy";
import { announce } from "@/lib/a11y";

/**
 * - loading: opened without ?cap, so /pro runs its own access check first.
 * - ready: the Default layout. `cap` is null when the check failed (row 03's
 *   fallback line). `fadeIn` is true when it replaces Loading.
 */
export type ProView = { kind: "loading" } | { kind: "ready"; cap: number | null; fadeIn: boolean };

/** The action button's own work: Purchasing (test builds) or Check again (test purchases off). */
export type ProBusy = "idle" | "purchasing" | "checking";

/** The notice slot's error line. `offline` picks Phosphor WifiSlash over Warning. */
export interface ProNotice {
  text: string;
  offline: boolean;
}

/** ?cap=<generations_cap> from openCapture(). Anything else means /pro checks for itself. */
export function capFromParam(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value.trim() === "") return null;
  const cap = Number(value);
  return Number.isInteger(cap) && cap >= 0 ? cap : null;
}

function capOf(access: MyAccess): number | null {
  return Number.isInteger(access.generations_cap) && access.generations_cap >= 0 ? access.generations_cap : null;
}

/**
 * ensureSession() first, so a signed-out session comes back as a guest and
 * routes to /account instead of failing.
 */
async function checkAccess(): Promise<MyAccess> {
  await ensureSession();
  return getMyAccess();
}

/** The Error table in 05 · States. account_required never gets here: it routes as Guest. */
export function noticeFor(error: unknown): ProNotice {
  if (isNetworkError(error)) return { text: copy.OFFLINE, offline: true };
  // 403 test_purchases_off (the server secret is unset), or no
  // grant-test-entitlement function on this server yet (today's stub): either
  // way this server doesn't offer test purchases, and a retry won't change
  // that. The stub's own message is for logs, never the notice.
  if (error instanceof TestPurchaseUnavailableError || (error instanceof TestPurchaseError && error.code === "test_purchases_off")) {
    return { text: copy.SERVER_OFF, offline: false };
  }
  // 401, 5xx, the entitlement still missing after a grant, anything else.
  return { text: copy.COULD_NOT_UNLOCK, offline: false };
}

export function useProFlow(initialCap: number | null) {
  const feedback = useFeedback();
  const [view, setView] = useState<ProView>(() =>
    initialCap === null ? { kind: "loading" } : { kind: "ready", cap: initialCap, fadeIn: false },
  );
  const [busy, setBusy] = useState<ProBusy>("idle");
  const [notice, setNotice] = useState<ProNotice | null>(null);

  // Synchronous copies for the guards in async steps and native listeners.
  const viewRef = useRef(view);
  const busyRef = useRef<ProBusy>("idle");
  // True once /pro is navigating away: taps are ignored and late results dropped.
  const leavingRef = useRef(false);
  const recheckingRef = useRef(false);
  // Aborted when the screen loses focus or the player leaves.
  const controllerRef = useRef<AbortController | null>(null);

  const showView = useCallback((next: ProView) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const setBusyState = useCallback((next: ProBusy) => {
    busyRef.current = next;
    setBusy(next);
  }, []);

  /** Keeps row 03 true to the latest check. */
  const refreshCap = useCallback((access: MyAccess) => {
    const cap = capOf(access);
    const current = viewRef.current;
    if (cap !== null && current.kind === "ready" && current.cap !== cap) showView({ ...current, cap });
  }, [showView]);

  /** Guest: the server requires an email account. /account then goes back to the hub. */
  const toAccount = useCallback(() => {
    leavingRef.current = true;
    router.replace({ pathname: "/account", params: { next: "back" } });
  }, []);

  /**
   * Already has access, or Success: continue exactly as openCapture() would,
   * replacing /pro. Only called once this screen has seen the entitlement
   * itself (the loop guard).
   */
  const toCapture = useCallback(async (signal: AbortSignal) => {
    leavingRef.current = true;
    try {
      await openCapture({ replace: true, signal });
    } catch {
      // Its check couldn't run (offline, a server error): the entry rule's
      // fallback is the camera. /capture still shows a first-timer the guide,
      // and the darkroom checks access again before anything is sent.
      if (!signal.aborted) router.replace("/capture");
    } finally {
      if (signal.aborted) leavingRef.current = false;
    }
  }, []);

  /** "Not now", Android back: back to the opener, or the hub when there is no history. Changes nothing. */
  const leave = useCallback(() => {
    controllerRef.current?.abort();
    leavingRef.current = true;
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }, []);

  /** Loading: route as Guest or Already has access, or show Default (row 03's fallback if the check fails). */
  const loadAccess = useCallback(async (signal: AbortSignal) => {
    const access = await checkAccess().catch(() => null);
    if (signal.aborted) return;
    if (access?.is_anonymous) return toAccount();
    // The Loading indicator stays up until openCapture navigates.
    if (access?.has_custom_rooms_entitlement) return toCapture(signal);
    showView({ kind: "ready", cap: access ? capOf(access) : null, fadeIn: true });
  }, [showView, toAccount, toCapture]);

  /** AppState back to active: a silent check (access may have been granted by hand meanwhile). */
  const recheck = useCallback(async (signal: AbortSignal) => {
    if (viewRef.current.kind !== "ready" || busyRef.current !== "idle" || leavingRef.current || recheckingRef.current) return;
    recheckingRef.current = true;
    const access = await checkAccess().catch(() => null);
    recheckingRef.current = false;
    // A tap made since the check started decides for itself.
    if (!access || signal.aborted || busyRef.current !== "idle" || leavingRef.current) return;
    if (access.is_anonymous) return toAccount();
    if (access.has_custom_rooms_entitlement) return toCapture(signal);
    refreshCap(access);
  }, [refreshCap, toAccount, toCapture]);

  /** "Unlock Pro" (test builds): Purchasing, then Success or Error. */
  const unlock = useCallback(async () => {
    const signal = controllerRef.current?.signal;
    if (!signal || signal.aborted || busyRef.current !== "idle" || leavingRef.current) return;
    setBusyState("purchasing");
    setNotice(null);
    try {
      // /pro never calls the function for a guest (the stored session; no network).
      const session = await currentSession();
      if (signal.aborted) return;
      if (!session || session.user.is_anonymous) return toAccount();
      await grantTestEntitlement();
      const access = await getMyAccess();
      if (signal.aborted) return;
      if (access.is_anonymous) return toAccount();
      // Loop guard: a 200 without the entitlement is the generic error, never openCapture.
      if (!access.has_custom_rooms_entitlement) throw new Error("custom_rooms entitlement still missing after the grant");
      feedback.success();
      announce(copy.SAY_UNLOCKED);
      await toCapture(signal);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof TestPurchaseError && error.code === "account_required") return toAccount();
      setNotice(noticeFor(error));
    } finally {
      if (!leavingRef.current) setBusyState("idle");
    }
  }, [feedback, setBusyState, toAccount, toCapture]);

  /** "Check again" (test purchases off): re-runs the access check with the in-button indicator. */
  const checkAgain = useCallback(async () => {
    const signal = controllerRef.current?.signal;
    if (!signal || signal.aborted || busyRef.current !== "idle" || leavingRef.current) return;
    setBusyState("checking");
    // The info line returns for the new check.
    setNotice(null);
    try {
      const access = await checkAccess();
      if (signal.aborted) return;
      if (access.is_anonymous) return toAccount();
      if (access.has_custom_rooms_entitlement) return await toCapture(signal);
      refreshCap(access);
      announce(copy.SAY_NO_ACCESS);
    } catch (error) {
      if (signal.aborted) return;
      setNotice(noticeFor(error));
    } finally {
      if (!leavingRef.current) setBusyState("idle");
    }
  }, [refreshCap, setBusyState, toAccount, toCapture]);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    if (viewRef.current.kind === "loading") loadAccess(controller.signal);

    let appState = AppState.currentState;
    const appStateSub = AppState.addEventListener("change", (next) => {
      if (next === "active" && appState !== "active") recheck(controller.signal);
      appState = next;
    });
    // Same as "Not now" in every state, Purchasing included.
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      leave();
      return true;
    });

    return () => {
      controller.abort();
      appStateSub.remove();
      backSub.remove();
    };
  }, [leave, loadAccess, recheck]));

  return { view, busy, notice, unlock, checkAgain, leave };
}
