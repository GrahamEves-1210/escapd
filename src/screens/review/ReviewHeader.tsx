// The header row, as the reference's: a 44 row under the safe top with a text
// button on the left (the reference's "Close", here "Back" to the camera) and
// the screen title centred over the screen (Bold 16). Three columns, the two
// sides flexing equally, so the title stays centred and never runs under Back
// at large text sizes (it wraps instead).
import { Pressable, StyleSheet, Text, View } from "react-native";
import { FocusRing, useFocusRing } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { COPY } from "./copy";

const L = ref.layout.review;

export function ReviewHeader({ top, onBack }: { top: number; onBack: () => void }) {
  const focus = useFocusRing();
  return (
    <View style={[styles.row, { marginTop: top }]}>
      <View style={styles.side}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={COPY.backLabel}
          onPress={onBack}
          onFocus={focus.onFocus}
          onBlur={focus.onBlur}
          testID="review-back"
          style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
        >
          <Text style={styles.backLabel}>{COPY.back}</Text>
          <FocusRing visible={focus.focused} shape="panel" radius={L.header.focusRadius} />
        </Pressable>
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {COPY.title}
      </Text>
      <View style={styles.side} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: L.gutter, minHeight: L.header.height },
  side: { flex: 1, alignItems: "flex-start" },
  back: { minWidth: ref.hit.min, minHeight: L.header.height, justifyContent: "center" },
  // Nudged onto the title's baseline, as the reference's "Close" sits on "Photos"'s.
  backLabel: { ...L.type.back, color: ref.color.textPrimary, top: L.header.backDrop },
  title: { ...L.type.navTitle, color: ref.color.textPrimary, textAlign: "center", flexShrink: 1 },
  pressed: { opacity: L.pressedOpacity },
});
