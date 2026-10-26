// The header row, Once's: two 44 square buttons (back, library) 21 from the
// screen edges, and between them the plate prompt: the serif title
// (ref.type.serifTitle, Roboto Serif 17/22, textPrimary) over the grey meta
// line (ref.type.meta, system 13/16, textSecondary), both centred. The title's
// line box starts promptTop below the buttons' top and the meta line metaGap
// under it, so one line each fills the buttons' 44 exactly (baselines y 87 and
// 108 on 852). A second line grows the header downward and the viewfinder
// shrinks to match. The meta slot holds the plate detail, an error line, or
// (during a wait over ~1 s) the thinking line. Title and meta are one
// screen-reader element, role header, announced politely when they change.
//
// Keyboard and switch focus reaches controls only. On Android `accessible`
// makes a View keyboard-focusable (and focusable={false} can't undo it), so
// there the prompt is screenReaderFocusable instead: one TalkBack element that
// is not a keyboard stop. Its texts are kept out of Android's accessibility
// tree, so on Android 7-8.1, where screenReaderFocusable does nothing,
// TalkBack still reads the prompt once, by its label.
// Colours are the capture palette's (the shell's white and grey, or the
// mode's ink and muted ink).
import type { Ref } from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions, type HostInstance, type StyleProp, type ViewStyle } from "react-native";
import { ArrowLeftIcon, ICON_WEIGHT, ImagesIcon, WarningIcon } from "@/components/icons";
import { ThinkingStates } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { useCapturePalette } from "../palette";
import { SquareButton } from "./SquareButton";

const L = ref.layout.camera;

export type PromptSubtitle =
  | { kind: "detail"; text: string }
  | { kind: "notice"; text: string }
  | { kind: "thinking"; line: string; sizeTo?: readonly string[] };

export interface HeaderProps {
  backLabel: string;
  onBack: () => void;
  libraryLabel: string;
  onLibrary: () => void;
  libraryDisabled: boolean;
  title: string;
  subtitle: PromptSubtitle;
  /** The prompt's screen-reader text: the title, then what the meta slot says. */
  promptLabel: string;
  promptRef?: Ref<HostInstance>;
  style?: StyleProp<ViewStyle>;
}

export function Header({
  backLabel,
  onBack,
  libraryLabel,
  onLibrary,
  libraryDisabled,
  title,
  subtitle,
  promptLabel,
  promptRef,
  style,
}: HeaderProps) {
  const palette = useCapturePalette();
  return (
    <View style={[styles.row, style]}>
      <SquareButton icon={ArrowLeftIcon} accessibilityLabel={backLabel} onPress={onBack} testID="back" />
      <View
        ref={promptRef}
        accessible={Platform.OS === "ios"}
        screenReaderFocusable
        accessibilityRole="header"
        accessibilityLabel={promptLabel}
        accessibilityLiveRegion="polite"
        style={styles.prompt}
        testID="prompt"
      >
        <Text style={[styles.title, { color: palette.ink }]} importantForAccessibility="no">
          {title}
        </Text>
        <Subtitle subtitle={subtitle} />
      </View>
      <SquareButton
        icon={ImagesIcon}
        accessibilityLabel={libraryLabel}
        onPress={onLibrary}
        disabled={libraryDisabled}
        testID="library"
      />
    </View>
  );
}

function Subtitle({ subtitle }: { subtitle: PromptSubtitle }) {
  const palette = useCapturePalette();
  switch (subtitle.kind) {
    case "thinking":
      // The prompt's own label carries the status, so the line itself is hidden.
      return <ThinkingStates decorative variant="meta" ground="dark" lines={[subtitle.line]} sizeTo={subtitle.sizeTo} testID="thinking" style={styles.meta} />;
    case "notice":
      // The prompt element speaks and announces it, so the line stays silent here.
      return (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.meta}>
          <ErrorLine text={subtitle.text} />
        </View>
      );
    case "detail":
      return (
        <Text style={[styles.meta, styles.detail, { color: palette.inkMuted }]} importantForAccessibility="no">
          {subtitle.text}
        </Text>
      );
  }
}

/**
 * The error line, in the reference's own value steps: where the detail is
 * grey, an error is white (textPrimary), led by Phosphor Warning (regular, 14)
 * centred on the first meta line, space.xs before the words. The group is
 * centred and its lines wrap centred. No amber, no oxblood.
 */
function ErrorLine({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  const palette = useCapturePalette();
  // The glyph stays 14 at every text size; its box follows the first line.
  const firstLine = ref.type.meta.lineHeight * fontScale;
  return (
    <View style={styles.errorLine} testID="notice">
      <View style={[styles.errorIcon, { height: firstLine }]} testID="notice-icon">
        <WarningIcon size={L.noticeIcon} color={palette.ink} weight={ICON_WEIGHT} />
      </View>
      <Text style={[styles.error, styles.errorText, { color: palette.ink }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: L.edge },
  // Between the buttons, space.sm clear of each: 247 wide on a 393 screen.
  prompt: { flex: 1, marginHorizontal: ref.space.sm, paddingTop: L.promptTop, alignItems: "center" },
  title: { ...ref.type.serifTitle, textAlign: "center" },
  meta: { marginTop: L.metaGap },
  detail: { ...ref.type.meta, textAlign: "center" },
  error: { ...ref.type.meta, textAlign: "center" },
  errorLine: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: ref.space.xs },
  errorIcon: { justifyContent: "center" },
  errorText: { flexShrink: 1 },
});
