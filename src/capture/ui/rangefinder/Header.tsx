// The header row: back, the plate prompt, library. Back and library are the
// live IconButton (48 round, plain, glyph in color.text at ICON_SIZE), as on
// /play and the light table. The prompt is a Playfair title (narrativeTitle
// 24/30) over a Jakarta detail (caption 13/18, secondary): one line each is
// exactly the buttons' 48, so the block is centred on their centre line; a
// second line grows it downward and the viewfinder shrinks to match. The
// detail slot holds the plate detail, an error line, or (during a wait over
// ~1 s) the warm thinking line. Title and detail are one screen-reader
// element, role header, announced politely when they change.
//
// Keyboard and switch focus reaches controls only. On Android `accessible`
// makes a View keyboard-focusable (and focusable={false} can't undo it), so
// there the prompt is screenReaderFocusable instead: one TalkBack element that
// is not a keyboard stop. Its texts are kept out of Android's accessibility
// tree, so on Android 7-8.1, where screenReaderFocusable does nothing,
// TalkBack still reads the prompt once, by its label.
import type { Ref } from "react";
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type HostInstance,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { IconButton } from "@/components/IconButton";
import { ArrowLeftIcon, ICON_SIZE, ICON_WEIGHT, ImagesIcon, WarningIcon } from "@/components/icons";
import { ThinkingStates } from "@/components/noir";
import { Text } from "@/components/Text";
import { color, hit, ref, space, type as typeScale } from "@/theme/tokens";

const L = ref.layout.camera;

// 48 - (30 + 18) = 0 above and below a one-line title and detail.
const PROMPT_PAD = Math.max(0, (hit.min - typeScale.narrativeTitle.lineHeight - typeScale.caption.lineHeight) / 2);

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
  /** The prompt's screen-reader text: the title, then what the detail slot says. */
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
  return (
    <View style={[styles.row, style]}>
      <IconButton
        icon={<ArrowLeftIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
        accessibilityLabel={backLabel}
        onPress={onBack}
        testID="back"
      />
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
        <Text variant="narrativeTitle" align="center" importantForAccessibility="no">
          {title}
        </Text>
        <Subtitle subtitle={subtitle} />
      </View>
      <IconButton
        icon={<ImagesIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
        accessibilityLabel={libraryLabel}
        onPress={onLibrary}
        disabled={libraryDisabled}
        testID="library"
      />
    </View>
  );
}

function Subtitle({ subtitle }: { subtitle: PromptSubtitle }) {
  switch (subtitle.kind) {
    case "thinking":
      // The prompt's own label carries the status, so the line itself is hidden.
      return <ThinkingStates decorative tone="warm" lines={[subtitle.line]} sizeTo={subtitle.sizeTo} testID="thinking" />;
    case "notice":
      // The prompt element speaks and announces it, so the line stays silent here.
      return (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ErrorLine text={subtitle.text} />
        </View>
      );
    case "detail":
      return (
        <Text variant="caption" tone="secondary" align="center" importantForAccessibility="no">
          {subtitle.text}
        </Text>
      );
  }
}

/**
 * The error line: Phosphor Warning (16, regular) in color.warning, centred on
 * the first caption line, a space.sm gap, then the words in caption /
 * secondary (the error red is 2.3:1 on the dark ground, so it is never the
 * text). The group is centred and its lines wrap centred. Drawn here rather
 * than with the kit's NoticeLine, which is always `accessible` and so a
 * keyboard stop on Android.
 */
function ErrorLine({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  // The glyph stays 16 at every text size; its box follows the first line.
  const firstLine = typeScale.caption.lineHeight * fontScale;
  return (
    <View style={styles.errorLine} testID="notice">
      <View style={[styles.errorIcon, { height: firstLine }]} testID="notice-icon">
        <WarningIcon size={L.noticeIcon} color={color.warning} weight={ICON_WEIGHT} />
      </View>
      <Text variant="caption" tone="secondary" align="center" style={styles.errorText}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: L.buttons.edge },
  // Between the buttons, space.sm clear of each: 243 wide on a 393 screen.
  prompt: { flex: 1, marginHorizontal: space.sm, paddingVertical: PROMPT_PAD },
  errorLine: { flexDirection: "row", alignItems: "flex-start", alignSelf: "center", justifyContent: "center", gap: space.sm },
  errorIcon: { justifyContent: "center" },
  errorText: { flexShrink: 1 },
});
