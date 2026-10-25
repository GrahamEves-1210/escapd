// The header row: back, the plate prompt, library. The prompt is a 40 pt block
// (headline title over a meta subtitle) centred on the buttons' centre line;
// a second line grows it downward and the viewfinder shrinks to match. The
// subtitle slot holds the plate detail, an error line, or (during a wait over
// ~1 s) the thinking line. Title and subtitle are one screen-reader element,
// role header, announced politely when they change.
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
import { IconButton, NoirText, ThinkingStates } from "@/components/noir";
import { ArrowLeftIcon, ImagesIcon, WarningIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";
import { Dimmable, slopBox, undimmed } from "./Dimmable";

const L = ref.layout.camera;

// 44 - (22 + 18) = 2 above and below a one-line title and subtitle.
const PROMPT_PAD = (ref.hit.min - ref.type.headline.lineHeight - ref.type.meta.lineHeight) / 2;

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
  /** The prompt's screen-reader text: the title, then what the subtitle slot says. */
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
      <IconButton icon={ArrowLeftIcon} accessibilityLabel={backLabel} onPress={onBack} testID="back" />
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
        <NoirText variant="headline" align="center" importantForAccessibility="no">
          {title}
        </NoirText>
        <Subtitle subtitle={subtitle} />
      </View>
      <Dimmable dimmed={libraryDisabled} style={slopBox}>
        <IconButton
          icon={ImagesIcon}
          accessibilityLabel={libraryLabel}
          onPress={onLibrary}
          disabled={libraryDisabled}
          style={undimmed}
          testID="library"
        />
      </Dimmable>
    </View>
  );
}

function Subtitle({ subtitle }: { subtitle: PromptSubtitle }) {
  switch (subtitle.kind) {
    case "thinking":
      // The prompt's own label carries the status, so the line itself is hidden.
      return <ThinkingStates decorative lines={[subtitle.line]} sizeTo={subtitle.sizeTo} testID="thinking" />;
    case "notice":
      // The prompt element speaks and announces it, so the line stays silent here.
      return (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <ErrorLine text={subtitle.text} />
        </View>
      );
    case "detail":
      return (
        <NoirText variant="meta" align="center" importantForAccessibility="no">
          {subtitle.text}
        </NoirText>
      );
  }
}

/**
 * The error line: Phosphor Warning (16, regular) in the error colour, centred
 * on the first line, a 4 gap, then the words in meta / read. The group is
 * centred and its lines wrap centred. Drawn here rather than with the kit's
 * NoticeLine, which is always `accessible` and so a keyboard stop on Android.
 */
function ErrorLine({ text }: { text: string }) {
  const { fontScale } = useWindowDimensions();
  // The glyph stays 16 at every text size; its box follows the first line.
  const firstLine = ref.type.meta.lineHeight * fontScale;
  return (
    <View style={styles.errorLine} testID="notice">
      <View style={[styles.errorIcon, { height: firstLine }]}>
        <WarningIcon size={ref.icon.small} color={ref.color.error} weight="regular" />
      </View>
      <NoirText variant="meta" tone="read" align="center" style={styles.errorText}>
        {text}
      </NoirText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: L.edge },
  // Between the buttons, 8 clear of each: 247 wide on a 393 screen.
  prompt: { flex: 1, marginHorizontal: ref.space.sm, paddingVertical: PROMPT_PAD },
  errorLine: { flexDirection: "row", alignItems: "flex-start", alignSelf: "center", justifyContent: "center", gap: ref.space.xs },
  errorIcon: { justifyContent: "center" },
  errorText: { flexShrink: 1 },
});
