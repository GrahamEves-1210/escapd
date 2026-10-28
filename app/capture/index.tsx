// /capture, the camera route (docs/DESIGN.md 02 and 03). A shell over its two
// states:
// - CameraPermission (03): Checking, the permission sheet and everything else
//   before camera access is granted, on its own white ground (pushr's paper
//   and haze);
// - Rangefinder (02): the camera, mounted only once access is granted, on the
//   flat ref.color.ground this shell lays under both states.
// On a grant the rangefinder fades in while 03's white ground fades out over it
// and its sheet slides away: one crossfade from white to the camera's dark
// ground, nothing else flashes. Checking lasts until the permission read and,
// outside retake mode, the photo guide's seen-flag backstop have both
// resolved; an unseen guide replaces this route with /capture/guide before
// anything else shows. With ?retake=<index> a new photo replaces that plate
// and returns to the light table. Leaving is the camera's back button, or the
// system's back on both states (the iOS edge swipe stays on, Android's back
// and VoiceOver's escape are handled by each state).
// Inside a mode (src/capture/ui/palette.ts) the ground is the mode's and 03
// is the mode's dark sheet, so the status bar keeps light glyphs throughout.
import { useCallback, useEffect } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useCameraPermissions } from "expo-camera";
import { Stack, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { usePlates, useSlots } from "@/capture/roll";
import { CameraPermission } from "@/capture/ui/CameraPermission";
import { useCapturePalette } from "@/capture/ui/palette";
import { useGuideBackstop } from "@/capture/ui/permission/useGuideBackstop";
import { Rangefinder } from "@/capture/ui/Rangefinder";
import { useShowAfter } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { motion } from "@/theme/tokens";

// Granted: the rangefinder fades in under 03's leaving ground and sheet.
const SCENE_IN = FadeIn.duration(motion.sceneCrossfade).reduceMotion(ReduceMotion.Never);
const SCENE_IN_REDUCED = FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);
// The iOS edge swipe back works on both states (no back control on 03).
const SCREEN_OPTIONS = { gestureEnabled: true } as const;

/**
 * ?retake must name a slot up to the last filled one: a photo to retake in
 * place, or an open slot (a removed photo) to fill. Anything else is normal
 * capture, which fills the first open slot.
 */
function retakeIndexFrom(retake: string | undefined, slotCount: number): number | null {
  if (retake === undefined) return null;
  const index = Number(retake);
  return Number.isInteger(index) && index >= 0 && index < slotCount ? index : null;
}

export default function CaptureScreen() {
  const { retake } = useLocalSearchParams<{ retake?: string }>();
  const plates = usePlates();
  const slots = useSlots();
  const retakeIndex = retakeIndexFrom(retake, slots.length);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const guide = useGuideBackstop(retakeIndex === null);
  const { reducedMotion } = useTheme();
  const palette = useCapturePalette();
  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/")), []);

  // Settings return (03, "Open Settings"): re-read the permission whenever the
  // app becomes active. A grant opens the rangefinder; otherwise the sheet
  // stays as it was, with no notice.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") getPermission().catch(() => {});
    });
    return () => subscription.remove();
  }, [getPermission]);

  // A new room reached /capture some other way: the guide shows first, as it does before every new room.
  useEffect(() => {
    if (guide === "unseen") router.replace("/capture/guide");
  }, [guide]);

  const checking = permission === null || guide !== "seen";
  const granted = permission !== null && guide === "seen" && permission.granted;

  // The status bar: dark glyphs only on a paper 03 (the capture palette's
  // `paper`; none today, as every 03 is dark), back to the app's light ones
  // once the camera's ground has faded in (and whenever /capture loses focus,
  // so the light table and the rest of the app keep theirs).
  const cameraShown = useShowAfter(granted, reducedMotion ? motion.reducedFade : motion.sceneCrossfade);
  const lightGlyphs = cameraShown || !palette.paper;
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(lightGlyphs ? "light" : "dark");
      return () => setStatusBarStyle("light");
    }, [lightGlyphs]),
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.page }]}>
      <Stack.Screen options={SCREEN_OPTIONS} />
      {granted ? (
        <Animated.View entering={reducedMotion ? SCENE_IN_REDUCED : SCENE_IN} style={StyleSheet.absoluteFill}>
          <Rangefinder retakeIndex={retakeIndex} onClose={close} />
        </Animated.View>
      ) : null}
      {/* After the rangefinder in the tree, so its leaving ground and sheet draw above it. */}
      {granted ? null : (
        <CameraPermission
          permission={permission}
          checking={checking}
          requestPermission={requestPermission}
          retakeIndex={retakeIndex}
          plateCount={plates.length}
          onClose={close}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // The camera's flat ground (02, the palette's page), under both states: 03
  // covers it with its own ground until a grant fades that out.
  root: { flex: 1 },
});
