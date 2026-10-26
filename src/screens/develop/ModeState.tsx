// The build wait's calm states and pinned buttons in the active mode. In the
// shell they are the shared StateScreen and StateActions, unchanged. Inside
// a mode (src/capture/ui/palette.ts) the same layout (ref.layout.state) takes
// the mode's colours: its ground, the title in its ink and the body in its
// muted ink, the bar as the mode's primary button (its accent with the
// accent's ink) and the quiet button in its ink (ModePill). Loading is the
// kit's thinking line, as StateScreen's. Haptics as StateScreen's: `press`
// on press-in, or the action's own (`thud`, or none).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModePill } from "@/capture/ui/ModePill";
import { useCapturePalette, type CapturePalette } from "@/capture/ui/palette";
import { FocusRing, ThinkingStates, useFocusRing } from "@/components/noir";
import { StateActions, StateScreen, type StateAction } from "@/components/StateScreen";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";

const L = ref.layout.state;

interface Props {
  title: string;
  body?: string;
  primary?: StateAction;
  secondary?: StateAction;
  loading?: boolean;
}

/** A full-screen calm state (One moment, the account and access asks, failures): StateScreen, in the mode's colours inside a mode. */
export function DevelopStateScreen(props: Props) {
  const palette = useCapturePalette();
  if (palette.genre === null) return <StateScreen {...props} />;
  return <ModeStateScreen {...props} palette={palette} />;
}

function ModeStateScreen({ title, body, primary, secondary, loading, palette }: Props & { palette: CapturePalette }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: palette.page, paddingTop: insets.top }]} testID="state-screen">
      <View style={styles.center}>
        {loading ? (
          <ThinkingStates lines={[title]} variant="body" accessibilityLabel={title} testID="state-loading" style={styles.line} />
        ) : null}
        <View style={styles.copy} accessibilityLiveRegion={loading ? undefined : "polite"}>
          {loading ? null : <Text style={[styles.title, { color: palette.ink }]}>{title}</Text>}
          {body ? <Text style={[styles.body, { color: palette.inkMuted }, !loading && styles.bodyUnderTitle]}>{body}</Text> : null}
        </View>
      </View>
      <DevelopActions primary={primary} secondary={secondary} bottom={insets.bottom} />
    </View>
  );
}

/** The pinned band (the bar, then a quiet text button): StateActions, in the mode's colours inside a mode. */
export function DevelopActions(props: { primary?: StateAction; secondary?: StateAction; bottom: number }) {
  const palette = useCapturePalette();
  if (palette.genre === null) return <StateActions {...props} />;
  const { primary, secondary, bottom } = props;
  if (!primary && !secondary) return <View style={{ height: bottom }} />;
  return (
    <View style={[styles.actions, { paddingBottom: L.footer.pad + bottom }]}>
      {primary ? <PrimaryBar {...primary} palette={palette} /> : null}
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

function PrimaryBar({ label, onPress, testID, haptic = "press", palette }: StateAction & { palette: CapturePalette }) {
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
      style={({ pressed }) => [styles.bar, { backgroundColor: palette.primary }, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.barLabel, { color: palette.onPrimary }]}>{label}</Text>
      <FocusRing visible={focus.focused} shape="panel" radius={L.bar.radius} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: L.textInset, gap: L.gap.body },
  line: { alignSelf: "stretch" },
  copy: { alignSelf: "stretch", alignItems: "center" },
  title: { ...ref.type.title, textAlign: "center" },
  body: { ...ref.type.subtitle, textAlign: "center" },
  bodyUnderTitle: { marginTop: L.gap.body },
  actions: { paddingTop: L.footer.pad, paddingHorizontal: ref.space.edge, gap: L.footer.gap },
  bar: {
    minHeight: L.bar.height,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: ref.space.lg,
    borderRadius: L.bar.radius,
    ...ref.curve,
  },
  barLabel: { ...L.bar.type, textAlign: "center" },
  pressed: { opacity: L.bar.pressedOpacity },
});
