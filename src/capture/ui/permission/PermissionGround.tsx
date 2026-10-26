// 03 · Camera permission: the screen's ground (docs/DESIGN.md 03, Layout:
// Ground, Ambient haze). pushr's white (ref.color.paper) with its soft, cool
// grey haze out of focus behind the status bar, right of centre, cut off by
// the screen's top and gone to white well above the sheet: the kit's
// PaperHaze (ref.gradient.haze, shared with 05). Static in every mode. It is
// Checking's whole look, and stays still while the sheet rises over it. On a
// grant it fades out over the scene crossfade while the camera's flat ground
// shows through from the route shell, so white never flashes over the camera
// beyond that one crossfade. Inside a mode the ground is the mode's own
// (src/capture/ui/palette.ts) and there is no haze: a dark sheet rises on it.
import { StyleSheet } from "react-native";
import Animated, { FadeOut, ReduceMotion } from "react-native-reanimated";
import { PaperHaze } from "@/components/noir";
import { useTheme } from "@/theme/ThemeProvider";
import { motion } from "@/theme/tokens";
import { useCapturePalette } from "../palette";

const OUT = FadeOut.duration(motion.sceneCrossfade).reduceMotion(ReduceMotion.Never);
const OUT_REDUCED = FadeOut.duration(motion.reducedFade).reduceMotion(ReduceMotion.Never);

export function PermissionGround() {
  const { reducedMotion } = useTheme();
  const palette = useCapturePalette();
  return (
    <Animated.View
      exiting={reducedMotion ? OUT_REDUCED : OUT}
      pointerEvents="none"
      style={[styles.ground, { backgroundColor: palette.sheetGround }]}
      testID="permission-ground"
    >
      {palette.paper ? <PaperHaze testID="permission-haze" /> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ground: { ...StyleSheet.absoluteFill },
});
