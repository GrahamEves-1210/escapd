// 03 · Camera permission (docs/DESIGN.md 03): every state of /capture before
// camera access is granted, in pushr's look. A single decision, bright and
// quiet: white paper with a soft grey haze behind the status bar, then, once
// Checking is over, a white sheet rising from below with a light grey panel
// holding a heavy black phone outline, a wide black lowercase title, a grey
// paragraph, one black pill and a quiet grey way out. No back control, as in
// the reference: leaving is the system's back (the iOS edge swipe, Android's
// back, VoiceOver's escape gesture).
//
// States: Checking (the ground alone; a thinking line only past ~1 s),
// Default, Requesting (the pill busy), Denied (new copy, "Open Settings"),
// Library busy (a thinking line with real progress; the buttons hold still),
// Library partial and error, Request error, Roll ready (a second quiet
// button), Roll full and Retake mode. On a grant the route shell swaps in the
// rangefinder: the sheet slides out and the ground fades out over it (exiting
// animations in PermissionSheet and PermissionGround).
//
// Inside a mode (src/capture/ui/palette.ts) the same screen is the mode's
// dark sheet: the mode's ground, a `surface` sheet with a `raised` panel, the
// title in its ink and the body in its muted ink, the pill the mode's primary
// button and the quiet ways out in its muted ink (ModePill), no haze.
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getPlates, useRollPlan } from "@/capture/roll";
import { MIN_PLATES } from "@/capture/slots";
import { useLibraryImport } from "@/capture/useLibraryImport";
import { ThinkingStates, useShowAfter } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { ModePill } from "./ModePill";
import { useCapturePalette } from "./palette";
import { COPY, PERMISSION_COPY } from "./permission/copy";
import { PermissionGround } from "./permission/PermissionGround";
import { PermissionNotice } from "./permission/PermissionNotice";
import { PermissionSheet, type SheetNotice } from "./permission/PermissionSheet";
import type { CameraPermissionProps } from "./types";

const P = ref.layout.permission;
// The kit's pill labels and the drawn thinking lines take the screen's
// lowercase as lowercased strings (neither takes a textTransform); screen
// readers hear the sentence-case copy as their accessibility labels.
const lower = (text: string) => text.toLowerCase();
const CHECKING_LINES = [lower(COPY.checking)] as const;

interface Notice {
  /** "error": the Warning icon, then the text. "progress": the text alone. Both in ref.color.inkMuted. */
  kind: "error" | "progress";
  text: string;
}

export function CameraPermission({ permission, checking, requestPermission, retakeIndex, plateCount, onClose }: CameraPermissionProps) {
  const library = useLibraryImport({ retakeIndex });
  const rollPlan = useRollPlan();
  const feedback = useFeedback();
  const { paper } = useCapturePalette();
  const thinkingGround = paper ? "paper" : "dark";
  const [requesting, setRequesting] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // The roll count the quiet buttons are drawn from while a library import
  // has it (see choose); null otherwise, when they follow the live roll.
  const [heldCount, setHeldCount] = useState<number | null>(null);
  const choosing = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // Back from the light table that an import pushed: the buttons follow the
  // roll again (Roll ready or Roll full, as the roll now stands).
  useFocusEffect(
    useCallback(() => {
      setHeldCount(null);
    }, []),
  );

  // Android's hardware back leaves the screen in every state (as the iOS edge
  // swipe does). Only while /capture is the focused route, so it never
  // reaches the light table.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        onClose();
        return true;
      });
      return () => subscription.remove();
    }, [onClose]),
  );

  const retake = retakeIndex !== null;
  const denied = permission !== null && !permission.granted && !permission.canAskAgain;
  const copyKey = denied ? "denied" : "default";
  const copy = PERMISSION_COPY[copyKey];
  // Roll ready (3 up to the plan's count) adds the light-table button; Roll
  // full (the plan's count: 5 on 0.5x, 6 on 1x or before any camera has said)
  // puts it in the quiet button's slot. Retake mode has neither.
  const rollCount = heldCount ?? plateCount;
  const full = !retake && rollCount >= rollPlan.shots;
  const rollReady = !retake && !full && rollCount >= MIN_PLATES;
  const busy = library.busy;

  const request = async () => {
    if (requesting || busy) return;
    setNotice(null);
    setRequesting(true);
    try {
      // A grant reaches the route shell, which swaps in the rangefinder. A
      // final deny switches this sheet to Denied; a deny that can still ask
      // (Android's first) leaves it on Default.
      const result = await requestPermission();
      // Access granted: an outcome the camera fading in also shows.
      if (result.granted) feedback.success();
    } catch {
      if (alive.current) setNotice({ kind: "error", text: COPY.requestError });
    } finally {
      if (alive.current) setRequesting(false);
    }
  };

  // The re-check on return from Settings is the route shell's AppState listener.
  const openSettings = () => {
    Linking.openSettings().catch(() => {});
  };

  const choose = async () => {
    // One import at a time: a second tap before the picker covers the screen
    // must not release the first import's held count.
    if (requesting || busy || choosing.current) return;
    choosing.current = true;
    setNotice(null);
    // Library busy keeps the quiet buttons' labels and the sheet's height (the
    // thinking line is its only growth), yet addPlate grows the roll one photo
    // at a time. So the buttons are drawn from the count as the import starts
    // until it ends, or, after the push to the light table, until /capture is
    // focused again, so nothing changes as the route fades out.
    setHeldCount(plateCount);
    try {
      const result = await library.pick();
      // The screen closed, or a retake that replaced its plate has already
      // gone back to the light table: nothing more happens here.
      if (!alive.current || result?.retaken) return;
      const plates = getPlates().length;
      if (result && !retake && result.added > 0 && plates >= MIN_PLATES) {
        router.push("/capture/review");
        return;
      }
      setHeldCount(null);
      // Cancelled or nothing picked: nothing to say.
      if (!result) return;
      if (result.failed > 0) setNotice({ kind: "error", text: COPY.libraryError });
      else if (!retake && plates < MIN_PLATES) setNotice({ kind: "progress", text: COPY.partial(plates) });
    } finally {
      choosing.current = false;
    }
  };

  const toLightTable = () => router.push("/capture/review");

  // Library busy: the thinking line shows real progress. With one photo
  // (retake mode, or one pick) it shows only if the work runs past ~1 s.
  const progress = library.progress;
  const single = progress !== null && progress.total <= 1;
  const lateSingle = useShowAfter(busy && single, P.thinkingDelay);
  const thinking = progress !== null && (!single || lateSingle) ? progress : null;

  let slot: SheetNotice | null = null;
  if (thinking) {
    const current = Math.min(thinking.done + 1, thinking.total);
    slot = {
      key: "busy",
      fadeOut: false,
      node: (
        <ThinkingStates
          ground={thinkingGround}
          lines={[lower(COPY.busyLine(current, thinking.total))]}
          sizeTo={[lower(COPY.busyLine(thinking.total, thinking.total))]}
          accessibilityLabel={COPY.busyLabel}
          announceOnMount
          style={styles.startAligned}
          testID="permission-busy"
        />
      ),
    };
  } else if (notice) {
    slot = {
      key: `${notice.kind}:${notice.text}`,
      fadeOut: true,
      node: <PermissionNotice kind={notice.kind} text={notice.text} testID="permission-notice" />,
    };
  }

  return (
    // VoiceOver's escape gesture (a two-finger Z) leaves the screen from
    // anywhere on it, as the system back does.
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onAccessibilityEscape={onClose} testID="camera-permission">
      <PermissionGround />

      {checking ? (
        // Checking past ~1 s: one line at the screen's centre. Neither it nor
        // its label exists before then, and it stops the moment Checking ends.
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
          <ThinkingStates
            ground={thinkingGround}
            lines={CHECKING_LINES}
            accessibilityLabel={COPY.checking}
            announceOnMount
            showDelay={P.thinkingDelay}
            testID="permission-checking"
          />
        </View>
      ) : (
        <PermissionSheet copyKey={copyKey} title={copy.title} body={copy.body} notice={slot} testID="permission-sheet">
          <ModePill
            label={lower(copy.action)}
            accessibilityLabel={copy.action}
            onPress={denied ? openSettings : request}
            busy={requesting}
            spinner
            disabled={busy}
            testID="permission-primary"
          />
          {full ? (
            <QuietPill label={COPY.lightTable} onPress={toLightTable} requesting={requesting} busy={busy} testID="permission-light-table" />
          ) : (
            <QuietPill
              label={retake ? COPY.choosePhoto : COPY.choosePhotos}
              onPress={choose}
              requesting={requesting}
              busy={busy}
              testID="permission-library"
            />
          )}
          {rollReady ? (
            <QuietPill label={COPY.lightTable} onPress={toLightTable} requesting={requesting} busy={busy} testID="permission-light-table" />
          ) : null}
        </PermissionSheet>
      )}
    </View>
  );
}

interface QuietPillProps {
  label: string;
  onPress: () => void;
  requesting: boolean;
  busy: boolean;
  testID: string;
}

/**
 * The kit's quiet pill on paper (ref.button.quiet.paper: the reference's grey,
 * darkening when pressed; in a mode, the mode's muted ink), lowercase like
 * the rest of the screen. Requesting:
 * disabled. Library busy: disabled and busy, so dimmed, inert and
 * { disabled, busy }, its label kept and still focusable (the button that
 * started an import keeps focus; the thinking line carries the progress).
 */
function QuietPill({ label, onPress, requesting, busy, testID }: QuietPillProps) {
  return (
    <ModePill
      variant="quiet"
      ground="paper"
      label={lower(label)}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={requesting || busy}
      busy={busy}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  centre: { justifyContent: "center" },
  // The thinking line starts at the column's left edge, under the body.
  startAligned: { alignItems: "flex-start" },
});
