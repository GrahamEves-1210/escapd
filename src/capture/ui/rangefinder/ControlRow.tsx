// The control row under the viewfinder: flash in the back-button column, the
// lens segment centred, the framing grid in the library column. Flash and
// grid are the live IconButton (48 round, plain) as switches: the glyph is
// color.text when on and color.textSecondary when off, eased over
// ref.motion.control. Flash also swaps its glyph (Lightning on,
// LightningSlash off) and the grid's state shows as its lines on the
// viewfinder, so colour is never the only cue. Pressed and disabled are the
// live IconButton's own (0.75 and 0.4). The centre slot stays empty when no
// ultra-wide lens is reported, and the row height holds.
//
// The row is 48 tall plus SLOP above and below (the Rangefinder's padding), so
// the IconButtons' 56 hit boxes and the lens halves' 50 x 48 fit inside it.
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { IconButton } from "@/components/IconButton";
import { GridNineIcon, ICON_SIZE, LightningIcon, LightningSlashIcon } from "@/components/icons";
import { GlyphStack, useStateProgress, type NoirIcon } from "@/components/noir";
import { color, ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { Dimmable } from "./Dimmable";
import { LensSegment } from "./LensSegment";
import type { LensChoice } from "./useLenses";

const L = ref.layout.camera;

export interface ControlRowProps {
  flash: boolean;
  onFlash: () => void;
  flashDisabled: boolean;
  grid: boolean;
  onGrid: () => void;
  gridDisabled: boolean;
  /** Shown only once the camera is ready and reports an ultra-wide lens; it fades in. */
  showLens: boolean;
  lens: LensChoice;
  onLens: (lens: LensChoice) => void;
  lensDisabled: boolean;
  style?: StyleProp<ViewStyle>;
}

export function ControlRow({
  flash,
  onFlash,
  flashDisabled,
  grid,
  onGrid,
  gridDisabled,
  showLens,
  lens,
  onLens,
  lensDisabled,
  style,
}: ControlRowProps) {
  return (
    <View style={[styles.row, style]}>
      <Toggle
        icon={flash ? LightningIcon : LightningSlashIcon}
        label={COPY.flash}
        on={flash}
        disabled={flashDisabled}
        onPress={onFlash}
        testID="flash"
      />
      <View style={styles.lensSlot}>
        {showLens ? (
          <Dimmable dimmed={lensDisabled} appear>
            <LensSegment value={lens} onChange={onLens} disabled={lensDisabled} testID="lens" />
          </Dimmable>
        ) : null}
      </View>
      <Toggle icon={GridNineIcon} label={COPY.grid} on={grid} disabled={gridDisabled} onPress={onGrid} testID="grid" />
    </View>
  );
}

/** A utility switch on the live IconButton: role switch with `checked`; the glyph eases secondary to text as it turns on. */
function Toggle({ icon, label, on, disabled, onPress, testID }: {
  icon: NoirIcon;
  label: string;
  on: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const lit = useStateProgress(on);
  return (
    <IconButton
      icon={<GlyphStack icon={icon} size={ICON_SIZE} base={color.textSecondary} layers={[{ color: color.text, opacity: lit }]} />}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: L.buttons.edge },
  // The centre slot takes the row's 48 band between the toggles; the 48-tall
  // lens halves sit inside it, centred on the row.
  lensSlot: { flex: 1, alignItems: "center" },
});
