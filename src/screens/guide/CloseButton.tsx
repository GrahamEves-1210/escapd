// Close (docs/DESIGN.md 04, Top bar): the light table's header control, the
// live IconButton (48 round, transparent, pressed at 0.75 opacity) with the
// Phosphor X at ICON_SIZE / ICON_WEIGHT in color.text. The live IconButton
// draws its own brass focus ring (2 pt, 2 pt outside the 48 circle) while it
// has keyboard, D-pad or switch focus, so none is composed here.
import { IconButton } from "@/components/IconButton";
import { ICON_SIZE, ICON_WEIGHT, XIcon } from "@/components/icons";
import { color } from "@/theme/tokens";
import { CLOSE_SLOP } from "./layout";

export function CloseButton({ accessibilityLabel, onPress }: { accessibilityLabel: string; onPress: () => void }) {
  return (
    <IconButton
      accessibilityLabel={accessibilityLabel}
      icon={<XIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
      hitSlop={CLOSE_SLOP}
      onPress={onPress}
      testID="guide-close"
    />
  );
}
