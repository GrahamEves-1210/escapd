// 03 · Camera permission (docs/DESIGN.md 03): every state of /capture before
// camera access is granted, in the play screen's look. A single decision,
// taken in the darkroom before the rangefinder opens: the route's flat
// color.canvas and grain with only the back control (the live IconButton, on
// 02's back centre), then, once Checking is over, a walnut sheet in the live
// Sheet's look rising from below, with a warm line drawing of a phone on a
// small film plate, a Playfair heading, a Jakarta paragraph, one brass button
// and a quiet way out. No oxblood, no light pool.
//
// States: Checking (ground and the back control; a thinking line only past ~1 s),
// Default, Requesting, Denied (new copy, "Open Settings"), Library busy (a
// thinking line with real progress; the buttons hold still), Library partial
// and error, Request error, Roll ready (a second quiet button), Roll full and
// Retake mode. On a grant the route shell swaps in the rangefinder: this
// screen's back control crossfades into 02's and the sheet slides out
// (exiting animations below).
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, Linking, StyleSheet, View } from "react-native";
import Animated, { FadeOut, ReduceMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { getPlates } from "@/capture/roll";
import { MAX_PLATES, MIN_PLATES } from "@/capture/slots";
import { useLibraryImport } from "@/capture/useLibraryImport";
import { Button } from "@/components/Button";
import { IconButton } from "@/components/IconButton";
import { ArrowLeftIcon, ICON_SIZE, ICON_WEIGHT } from "@/components/icons";
import { useShowAfter } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { color, hit, motion, ref, space } from "@/theme/tokens";
import { COPY, PERMISSION_COPY } from "./permission/copy";
import { PermissionNotice } from "./permission/PermissionNotice";
import { PermissionSheet, type SheetNotice } from "./permission/PermissionSheet";
import { PermissionThinking } from "./permission/PermissionThinking";
import { QuietAction } from "./permission/QuietAction";
import type { CameraPermissionProps } from "./types";

const P = ref.layout.permission;
// The back control is the live IconButton, a 48 circle; its hitSlop of
// space.xs takes the hit area to 56, so the wrapper is 56 and the slop stays
// inside a parent that receives touches (native hit-testing drops the rest).
const SLOP = space.xs;
const BACK_BOX = hit.min + SLOP * 2;
// Granted: the back control crossfades into 02's as the rangefinder fades in.
const ARROW_OUT = FadeOut.duration(motion.sceneCrossfade).reduceMotion(ReduceMotion.Never);
const ARROW_OUT_REDUCED = FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);
const CHECKING_LINES = [COPY.checking] as const;

interface Notice {
  /** "error": the Warning icon in color.warning, then the text. "progress": the text alone. Both in color.textSecondary. */
  kind: "error" | "progress";
  text: string;
}

export function CameraPermission({ permission, checking, requestPermission, retakeIndex, plateCount, onClose }: CameraPermissionProps) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const library = useLibraryImport({ retakeIndex });
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

  // Android hardware back does what the back control does, in every state. Only
  // while /capture is the focused route, so it never reaches the light table.
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
  // Roll ready (3-5 plates) adds the light-table button; Roll full (6) puts it
  // in the quiet button's slot. Retake mode has neither.
  const rollCount = heldCount ?? plateCount;
  const full = !retake && rollCount >= MAX_PLATES;
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
      await requestPermission();
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
    // thinking line's 26 is its only growth), yet addPlate grows the roll one
    // photo at a time. So the buttons are drawn from the count as the import
    // starts until it ends, or, after the push to the light table, until
    // /capture is focused again, so nothing changes as the route fades out.
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
        <PermissionThinking
          lines={[COPY.busyLine(current, thinking.total)]}
          sizeTo={[COPY.busyLine(thinking.total, thinking.total)]}
          label={COPY.busyLabel}
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

  // Checking past ~1 s: one non-rotating line at the screen's centre. Neither
  // it nor its label exists before then, and it stops the moment Checking ends.
  const checkingLate = useShowAfter(checking, P.thinkingDelay);
  const checkingLine = checkingLate ? (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centre]}>
      <PermissionThinking lines={CHECKING_LINES} label={COPY.checking} testID="permission-checking" />
    </View>
  ) : null;

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} testID="camera-permission">
      <Animated.View
        exiting={reducedMotion ? ARROW_OUT_REDUCED : ARROW_OUT}
        style={[styles.back, { top: insets.top + P.back.top - SLOP }]}
      >
        <IconButton
          icon={<ArrowLeftIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
          accessibilityLabel={retake ? COPY.cancelRetake : COPY.close}
          onPress={onClose}
          hitSlop={SLOP}
          testID="permission-back"
        />
      </Animated.View>

      {checking ? checkingLine : (
        <PermissionSheet copyKey={copyKey} title={copy.title} body={copy.body} notice={slot} testID="permission-sheet">
          <Button
            label={copy.action}
            onPress={denied ? openSettings : request}
            loading={requesting}
            disabled={busy}
            testID="permission-primary"
          />
          {full ? (
            <QuietAction label={COPY.lightTable} onPress={toLightTable} disabled={requesting} busy={busy} testID="permission-light-table" />
          ) : (
            <QuietAction
              label={retake ? COPY.choosePhoto : COPY.choosePhotos}
              onPress={choose}
              disabled={requesting}
              busy={busy}
              testID="permission-library"
            />
          )}
          {rollReady ? (
            <QuietAction label={COPY.lightTable} onPress={toLightTable} disabled={requesting} busy={busy} testID="permission-light-table" />
          ) : null}
        </PermissionSheet>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The 48 box at x 19-67, top = safe top + 6 (centre 43, 89 on 393 x 852), plus the slop all round.
  back: {
    position: "absolute",
    left: P.back.left - SLOP,
    width: BACK_BOX,
    height: BACK_BOX,
    alignItems: "center",
    justifyContent: "center",
  },
  centre: { justifyContent: "center" },
});
