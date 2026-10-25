// /capture, the camera route (docs/DESIGN.md 02 and 03). A shell over its two
// states on one flat ground, so nothing flashes between them: color.canvas
// with the live Grain, as /play and the light table lay it, and no silk (the
// camera route stays flat, so 03 hands over to 02 with no change of ground):
// - CameraPermission (03): Checking, the permission sheet and everything else
//   before camera access is granted;
// - Rangefinder (02): the camera, mounted only once access is granted.
// Checking lasts until the permission read and, outside retake mode, the photo
// guide's seen-flag backstop have both resolved; an unseen guide replaces this
// route with /capture/guide before anything else shows. With ?retake=<index> a
// new photo replaces that plate and returns to the light table.
import { useCallback, useEffect } from "react";
import { AppState, StyleSheet, View } from "react-native";
import Animated, { FadeIn, ReduceMotion } from "react-native-reanimated";
import { useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { usePlates } from "@/capture/roll";
import { CameraPermission } from "@/capture/ui/CameraPermission";
import { useGuideBackstop } from "@/capture/ui/permission/useGuideBackstop";
import { Rangefinder } from "@/capture/ui/Rangefinder";
import { Grain } from "@/components/Grain";
import { useTheme } from "@/theme/ThemeProvider";
import { color, motion } from "@/theme/tokens";

// Granted: the rangefinder fades in on the same ground while 03's sheet slides
// out and its back control crossfades into 02's.
const SCENE_IN = FadeIn.duration(motion.sceneCrossfade).reduceMotion(ReduceMotion.Never);
const SCENE_IN_REDUCED = FadeIn.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);

/** ?retake must name a plate on the roll. Anything else is normal capture. */
function retakeIndexFrom(retake: string | undefined, plateCount: number): number | null {
  if (retake === undefined) return null;
  const index = Number(retake);
  return Number.isInteger(index) && index >= 0 && index < plateCount ? index : null;
}

export default function CaptureScreen() {
  const { retake } = useLocalSearchParams<{ retake?: string }>();
  const plates = usePlates();
  const retakeIndex = retakeIndexFrom(retake, plates.length);
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const guide = useGuideBackstop(retakeIndex === null);
  const { reducedMotion } = useTheme();
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

  // A first-timer who reached /capture some other way sees the guide first.
  useEffect(() => {
    if (guide === "unseen") router.replace("/capture/guide");
  }, [guide]);

  const checking = permission === null || guide !== "seen";
  const granted = permission !== null && guide === "seen" && permission.granted;

  return (
    <View style={styles.root}>
      {/* Under both states: 02 and its feed draw above it, so the grain never lies on a photo. */}
      <Grain />
      {granted ? (
        <Animated.View entering={reducedMotion ? SCENE_IN_REDUCED : SCENE_IN} style={StyleSheet.absoluteFill}>
          <Rangefinder retakeIndex={retakeIndex} onClose={close} />
        </Animated.View>
      ) : null}
      {/* After the rangefinder in the tree, so its leaving sheet and arrow draw above it. */}
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
  root: { flex: 1, backgroundColor: color.canvas },
});
