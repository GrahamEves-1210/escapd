// 06 · The top of the darkroom: the plates strip and, while a real wait runs,
// the drifting glass over it and the thinking line directly under it. When the
// wait ends (`wait` goes away) the glass and the line unmount at once and the
// strip stays where it is.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { ThinkingStates } from "@/components/noir";
import { ref } from "@/theme/tokens";
import type { WaitLine } from "./copy";
import { DarkroomGlass } from "./DarkroomGlass";

const L = ref.layout.develop;

export function DarkroomHero({ wait, children }: {
  /** The thinking line, only during a real wait. Without it: the strip alone. */
  wait?: WaitLine;
  /** The plates strip, if there are plates on this phone. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.hero}>
      <View style={wait ? styles.stage : styles.rest}>
        {children}
        {wait ? <DarkroomGlass /> : null}
      </View>
      {wait ? (
        <ThinkingStates
          lines={wait.lines}
          sizeTo={wait.sizeTo}
          accessibilityLabel={wait.label}
          testID="darkroom-status"
          style={styles.line}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The line keeps gap.line (over the kit's 8) clear of the stage.
  hero: { alignSelf: "stretch", alignItems: "center", gap: L.gap.line },
  stage: { alignSelf: "stretch", alignItems: "center", height: L.stage.height, paddingTop: L.stage.stripTop },
  rest: { alignSelf: "stretch", alignItems: "center" },
  // A definite width, so the kit's sizers measure (it centres the line itself).
  line: { alignSelf: "stretch" },
});
