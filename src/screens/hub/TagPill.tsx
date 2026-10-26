// Opal's label pill on a game card (docs/DESIGN.md, 01 · Layout: Tag pill):
// no fill, a 1 pt rim (white 10 %), radius 8 (ref.radius.tag, not
// continuous), 26 tall with 9 from the outer edge to the text (the stroke
// included), the text in ref.type.tag (Semibold 13/16, +0.4, uppercase) at
// ref.color.textLabel (white 82 %). Width follows the text; it grows with the
// system text size. THE STUDY, YOUR ROOM, YOUR CASE, and SOLVED.
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { trackingPad } from "@/components/noir";
import { ref } from "@/theme/tokens";

const H = ref.layout.hub;
const TAG = ref.type.tag;

export function TagPill({ label, style }: { label: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[pillStyles.pill, style]}>
      <Text accessible={false} style={[TAG, pillStyles.text, trackingPad(TAG)]}>
        {label}
      </Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    minHeight: ref.button.gameCard.tagHeight,
    // The 9 to the text includes the 1 pt stroke.
    paddingHorizontal: ref.button.gameCard.tagPadX - H.hairline,
    paddingVertical: (ref.button.gameCard.tagHeight - TAG.lineHeight) / 2 - H.hairline,
    borderWidth: H.hairline,
    borderColor: ref.color.rim,
    borderRadius: ref.button.gameCard.tagRadius,
    justifyContent: "center",
  },
  text: { color: ref.color.textLabel, textAlign: "center" },
});
