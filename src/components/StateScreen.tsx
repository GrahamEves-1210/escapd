// The calm full-screen state: loading, offline, error, or an unplayable
// definition (the player, the build wait, /account/confirmed). Reference look
// (ref.layout.state): 07's flat ground, a centred column with 01's title and
// grey subtitle, a caller's glyph in a void well (02), and the photo guide's
// foot (04): its pill as the primary and a quiet text button under it, in the
// guide's reading column, the pill's foot ref.space.ctaBottom over the safe
// area (the quiet button's, when there is one).
// Loading is the kit's ThinkingStates line (the title, body size) instead of
// a spinner: it is its own polite status, so the rest of the column carries
// the live region only when it isn't loading.
// Inside a mode (useModeTheme) the screen takes the mode's colours: its
// surface (the capture flow's page), ink and muted ink, the well in its
// ground, the pill in its accent (ModePill, exactly as the guide's "Next" is
// tinted) and the quiet button in its ink. In the shell it is the guide's own
// look: the dark hairline pill and a white quiet label.
// Haptics (src/game/feedback.ts): both buttons give `press` on press-in, as
// the kit's pills do; a StateAction can ask for `thud` (a weighty commit) or
// none (an outcome haptic follows at once).
import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModePill } from "@/capture/ui/ModePill";
import { ThinkingStates } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { ctaBottomPad, ref } from "@/theme/tokens";

const L = ref.layout.state;

interface Action {
  label: string;
  onPress: () => void;
}

/** A state screen's action, as StateActions takes it (the build wait's foot reuses them). */
export interface StateAction extends Action {
  testID?: string;
  /** The haptic on press-in: "press" (the default, as the kit's pills), "thud" for a weighty commit, or false. */
  haptic?: "press" | "thud" | false;
}

/** Full-screen calm state: loading, offline, error, or an unplayable definition. */
export function StateScreen({ title, body, icon, primary, secondary, loading }: {
  title: string;
  body?: string;
  icon?: ReactNode;
  primary?: StateAction;
  secondary?: StateAction;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const theme = useModeTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.surface, paddingTop: insets.top }]} testID="state-screen">
      <View style={styles.center}>
        {loading ? (
          <ThinkingStates lines={[title]} variant="body" accessibilityLabel={title} testID="state-loading" style={styles.line} />
        ) : null}
        <View style={styles.copy} accessibilityLiveRegion={loading ? undefined : "polite"}>
          {!loading && icon ? (
            <View style={[styles.well, { backgroundColor: theme.ground }]} testID="state-icon">
              {icon}
            </View>
          ) : null}
          {loading ? null : <Text style={[styles.title, { color: theme.ink }]}>{title}</Text>}
          {body ? <Text style={[styles.body, { color: theme.inkMuted }, !loading && styles.bodyUnderTitle]}>{body}</Text> : null}
        </View>
      </View>
      <StateActions primary={primary} secondary={secondary} bottom={insets.bottom} />
    </View>
  );
}

/**
 * The photo guide's foot: its pill (primary), then a quiet text button
 * (secondary), in the guide's reading column. With neither, only the bottom
 * safe area. `bottom` is the bottom safe-area inset.
 */
export function StateActions({ primary, secondary, bottom }: { primary?: StateAction; secondary?: StateAction; bottom: number }) {
  if (!primary && !secondary) return <View style={{ height: bottom }} />;
  return (
    <View style={[styles.actions, { paddingBottom: ctaBottomPad(bottom) }]} testID="state-actions">
      {primary ? (
        <ModePill
          variant="ghost"
          label={primary.label}
          onPress={primary.onPress}
          haptic={primary.haptic ?? "press"}
          testID={primary.testID}
        />
      ) : null}
      {secondary ? (
        <ModePill
          variant="quiet"
          ground="dark"
          fullWidth
          label={secondary.label}
          onPress={secondary.onPress}
          haptic={secondary.haptic ?? "press"}
          testID={secondary.testID}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: L.textInset, gap: L.gap.body },
  line: { alignSelf: "stretch" },
  copy: { alignSelf: "stretch", alignItems: "center" },
  well: {
    width: L.well.size,
    height: L.well.size,
    borderRadius: ref.radius.round,
    borderWidth: L.well.rim,
    borderColor: L.well.rimColor,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: L.gap.title,
  },
  title: { ...ref.type.title, textAlign: "center" },
  body: { ...ref.type.subtitle, textAlign: "center" },
  bodyUnderTitle: { marginTop: L.gap.body },
  actions: { paddingTop: L.footer.pad, paddingHorizontal: ref.space.reading, gap: L.footer.gap },
});
