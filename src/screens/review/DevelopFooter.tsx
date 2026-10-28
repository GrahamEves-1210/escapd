// The pinned foot, as the photo guide's (04): "Build the case" is the
// guide's own pill (ModePill "ghost": 52 tall, a full capsule, the headline
// label; the guide's dark hairline pill in the shell, the mode's accent with
// its accent ink inside a mode, exactly as the guide's "Next"), in the
// guide's reading column, its foot ref.space.ctaBottom over the bottom safe
// area. The band is the page colour, with a fade above it so the photos slip
// under it. When the case can't be built yet, the reason sits over the pill
// (Regular 15, centred: the warning colour for marked photos, the muted ink
// for too few) and the pill dims to ref.button.disabledOpacity.pill. Pressing
// in on the live pill gives the medium `thud` haptic: committing to build a case.
import { StyleSheet, Text, View } from "react-native";
import { ModePill } from "@/capture/ui/ModePill";
import { useCapturePalette } from "@/capture/ui/palette";
import { ctaBottomPad, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { PageFade } from "./PageFade";

const L = ref.layout.review;
const F = L.footer;

export interface DevelopFooterProps {
  bottom: number;
  /** "flagged": photos still marked; "few": fewer than MIN_PLATES; null: ready. */
  blocked: { kind: "flagged" } | { kind: "few"; min: number } | null;
  onDevelop: () => void;
}

export function DevelopFooter({ bottom, blocked, onDevelop }: DevelopFooterProps) {
  const palette = useCapturePalette();
  return (
    <View style={[styles.footer, { backgroundColor: palette.page, paddingBottom: ctaBottomPad(bottom) }]} testID="develop-footer">
      <PageFade color={palette.page} height={F.fade} solidAt="bottom" style={styles.fade} />
      {blocked ? (
        <Text
          style={[styles.helper, { color: blocked.kind === "flagged" ? L.warning : palette.inkMuted }]}
          accessibilityLiveRegion="polite"
          testID="develop-helper"
        >
          {blocked.kind === "flagged" ? COPY.flaggedHelp : COPY.tooFew(blocked.min)}
        </Text>
      ) : null}
      <ModePill
        variant="ghost"
        label={COPY.develop}
        disabled={blocked !== null}
        haptic="thud"
        onPress={onDevelop}
        testID="develop"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingTop: F.pad, paddingHorizontal: ref.space.reading, gap: F.helperGap },
  fade: { top: -F.fade },
  helper: { ...L.type.note, textAlign: "center" },
});
