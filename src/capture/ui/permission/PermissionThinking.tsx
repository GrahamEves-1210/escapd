// 03 · Camera permission: a thinking line that carries a status (docs/DESIGN.md
// 03, States "Checking" and "Library busy"). The kit's ThinkingStates draws the
// line in its warm tone, the play screen's (`caption` type, the sweep from
// color.textSecondary to color.text, the count swaps, a still
// color.textSecondary line under reduced motion); this View carries the fixed
// status label and the polite live region.
//
// Composed here instead of with ThinkingStates' own status container, which is
// always `accessible`: on Android that makes it a keyboard, D-pad and Switch
// Access focus stop (ReactViewManager.setAccessible sets isFocusable, and
// focusable={false} can't undo it), and 03's keyboard and switch focus never
// lands on text (back, primary, quiet button(s) only). So the line is drawn
// `decorative` (hidden from screen readers) and this View is the status: one
// accessibility element on iOS; on Android not `accessible`, so not a keyboard
// stop, while TalkBack still reads it as one element by its label
// (screenReaderFocusable, importantForAccessibility "yes").
import { useEffect, useRef } from "react";
import { AccessibilityInfo, Platform, View } from "react-native";
import { ThinkingStates } from "@/components/noir";

export interface PermissionThinkingProps {
  /** The drawn line(s): one real status line, e.g. "Re-encoding photo 1 of 4". */
  lines: readonly string[];
  /** Extra strings measured for the box width, so the box never resizes when the count changes. */
  sizeTo?: readonly string[];
  /** The fixed status screen readers hear, e.g. "Re-encoding your photos". Never the moving copy. */
  label: string;
  testID?: string;
}

/** Mount it only while the line shows (past ~1 s where the spec says so); unmount it the moment the wait ends. */
export function PermissionThinking({ lines, sizeTo, label, testID }: PermissionThinkingProps) {
  // Decorative lines announce nothing, so the status is spoken here: once as
  // the line appears, then on a label change (iOS; Android's polite live
  // region speaks the new label itself).
  const spoken = useRef<string | null>(null);
  useEffect(() => {
    if (spoken.current === label) return;
    const first = spoken.current === null;
    spoken.current = label;
    if (first || Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(label);
  }, [label]);

  return (
    <View
      accessible={Platform.OS === "ios"}
      screenReaderFocusable
      importantForAccessibility="yes"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <ThinkingStates decorative tone="warm" lines={lines} sizeTo={sizeTo} />
    </View>
  );
}
