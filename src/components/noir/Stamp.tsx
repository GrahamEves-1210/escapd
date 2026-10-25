import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ref } from "@/theme/tokens";
import { NoirText } from "./NoirText";

const S = ref.stamp;
const TRACKING = ref.type.label.letterSpacing;

export interface StampProps {
  /** Short mono label, e.g. "SOLVED" (set uppercase by ref.type.label). */
  label: string;
  testID?: string;
  /** Position only. Size, colour and shape come from ref.stamp. */
  style?: StyleProp<ViewStyle>;
}

/**
 * Case stamp (ref.stamp): signal fill, radius 6, label in ref.type.label,
 * bright. 24 tall (a minimum: it grows with the text size), label + 8 each
 * side, level and never a control. On iOS one tracking step comes off the
 * right padding so the label sits centred (DESIGN.md, Trailing tracking).
 */
export function Stamp({ label, testID, style }: StampProps) {
  return (
    <View testID={testID} style={[styles.stamp, style]}>
      <NoirText variant="label" tone="bright" style={styles.label}>
        {label}
      </NoirText>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    alignSelf: "flex-start",
    minHeight: S.height,
    paddingLeft: S.padX,
    paddingRight: Platform.OS === "ios" ? S.padX - TRACKING : S.padX,
    borderRadius: S.radius,
    backgroundColor: S.fill,
    justifyContent: "center",
    alignItems: "center",
    ...ref.curve,
  },
  label: { color: S.label },
});
