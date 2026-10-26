// The calm full-screen state: loading, offline, error, or an unplayable
// definition (the player, the darkroom, /account/confirmed). Reference look
// (ref.layout.state): 07's flat ground, a centred column with 01's title and
// grey subtitle, a caller's glyph in a void well (02), and 07's pinned band
// with the white bar as the primary and a quiet text button under it.
// Loading is the kit's ThinkingStates line (the title, body size) instead of
// a spinner: it is its own polite status, so the rest of the column carries
// the live region only when it isn't loading.
// Haptics (src/game/feedback.ts): both buttons give `press` on press-in, as
// the kit's pills do; a StateAction can ask for `thud` (a weighty commit) or
// none (an outcome haptic follows at once).
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FocusRing, PillButton, ThinkingStates, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";

const L = ref.layout.state;

interface Action {
  label: string;
  onPress: () => void;
}

/** A state screen's action, as StateActions takes it (the darkroom's footer reuses them). */
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
  primary?: Action;
  secondary?: Action;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="state-screen">
      <View style={styles.center}>
        {loading ? (
          <ThinkingStates lines={[title]} variant="body" accessibilityLabel={title} testID="state-loading" style={styles.line} />
        ) : null}
        <View style={styles.copy} accessibilityLiveRegion={loading ? undefined : "polite"}>
          {!loading && icon ? (
            <View style={styles.well} testID="state-icon">
              {icon}
            </View>
          ) : null}
          {loading ? null : <Text style={styles.title}>{title}</Text>}
          {body ? <Text style={[styles.body, !loading && styles.bodyUnderTitle]}>{body}</Text> : null}
        </View>
      </View>
      <StateActions primary={primary} secondary={secondary} bottom={insets.bottom} />
    </View>
  );
}

/**
 * 07's pinned band: the white bar (primary), then a quiet text button
 * (secondary). With neither, only the bottom safe area. `bottom` is the
 * bottom safe-area inset.
 */
export function StateActions({ primary, secondary, bottom }: { primary?: StateAction; secondary?: StateAction; bottom: number }) {
  if (!primary && !secondary) return <View style={{ height: bottom }} />;
  return (
    <View style={[styles.actions, { paddingBottom: L.footer.pad + bottom }]}>
      {primary ? <PrimaryBar {...primary} /> : null}
      {secondary ? (
        <PillButton
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

function PrimaryBar({ label, onPress, testID, haptic = "press" }: StateAction) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={haptic ? () => feedback[haptic]() : undefined}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.bar, pressed ? styles.pressed : null]}
    >
      <Text style={styles.barLabel}>{label}</Text>
      <FocusRing visible={focus.focused} shape="panel" radius={L.bar.radius} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ref.color.ground },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: L.textInset, gap: L.gap.body },
  line: { alignSelf: "stretch" },
  copy: { alignSelf: "stretch", alignItems: "center" },
  well: {
    width: L.well.size,
    height: L.well.size,
    borderRadius: ref.radius.round,
    backgroundColor: L.well.fill,
    borderWidth: L.well.rim,
    borderColor: L.well.rimColor,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: L.gap.title,
  },
  title: { ...ref.type.title, color: ref.color.textPrimary, textAlign: "center" },
  body: { ...ref.type.subtitle, color: ref.color.textSecondary, textAlign: "center" },
  bodyUnderTitle: { marginTop: L.gap.body },
  actions: { paddingTop: L.footer.pad, paddingHorizontal: ref.space.edge, gap: L.footer.gap },
  bar: {
    minHeight: L.bar.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ref.space.lg,
    borderRadius: L.bar.radius,
    backgroundColor: L.bar.fill,
    ...ref.curve,
  },
  barLabel: { ...L.bar.type, color: L.bar.label, textAlign: "center" },
  pressed: { opacity: L.bar.pressedOpacity },
});
