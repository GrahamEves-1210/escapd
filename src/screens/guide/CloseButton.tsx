// Close (docs/DESIGN.md 04, Top bar): the light table's header control, the
// live IconButton (48 round, transparent, pressed at 0.75 opacity) with the
// Phosphor X at ICON_SIZE / ICON_WEIGHT in color.text. The live IconButton
// draws no focus outline, so the kit's ring is composed in here: a 2 pt ring
// 2 pt outside the 48 circle while it has keyboard, D-pad or switch focus.
import { IconButton } from "@/components/IconButton";
import { ICON_SIZE, ICON_WEIGHT, XIcon } from "@/components/icons";
import { FocusRing, useFocusRing } from "@/components/noir";
import { color } from "@/theme/tokens";
import { CLOSE_SLOP } from "./layout";

export function CloseButton({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) {
  const focus = useFocusRing();
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      icon={
        <>
          <XIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />
          <FocusRing visible={focus.focused} shape="pill" />
        </>
      }
      hitSlop={CLOSE_SLOP}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID="guide-close"
    />
  );
}
