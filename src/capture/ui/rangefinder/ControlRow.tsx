// The control row under the viewfinder, Once's: the flash glyph in the back
// button's column (x 43), the 0.5 / 1.0 segment on the screen's centre, and
// ESCAPD's framing grid on Once's flip glyph (x 347.6, ref.layout.camera
// .controlColumns, just inside the library button's 350). Both glyphs are bare
// white Phosphor at 22 (ref.button.bare, ref.layout.camera.controlIcon); each
// shows its state in the glyph itself, so colour never carries it: flash
// LightningSlash (off) / Lightning (on), both filled as Once's bolt; the grid
// GridNine outline (off; regular, as its nine cells already weigh as much as
// Once's 2 pt flip arrows) / filled (on), and the grid's lines on the
// viewfinder. The centre slot stays empty when no ultra-wide lens is
// reported, and the row's height holds.
//
// The row is 48 tall (the glyphs' hit boxes and the lens halves), the 40 track
// centred in it: the Rangefinder's gaps above and below allow for the 4.
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GridNineIcon, LightningIcon, LightningSlashIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";
import { BareToggle } from "./BareToggle";
import { COPY } from "./copy";
import { Dimmable } from "./Dimmable";
import { LensSegment } from "./LensSegment";
import type { LensChoice } from "./useLenses";

const L = ref.layout.camera;

/** The glyphs' 48 boxes centred on their columns: 43 - 24 = 19 from the left edge, 45.4 - 24 = 21.4 from the right. */
const HALF_BOX = ref.button.bare.hit / 2;

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
      <BareToggle
        icon={flash ? LightningIcon : LightningSlashIcon}
        weight="fill"
        accessibilityLabel={COPY.flash}
        on={flash}
        disabled={flashDisabled}
        onPress={onFlash}
        testID="flash"
      />
      {/* The segment centred on the screen whatever the glyphs' insets; only the segment takes touches. */}
      <View pointerEvents="box-none" style={styles.lensSlot}>
        {showLens ? (
          <Dimmable dimmed={lensDisabled} appear>
            <LensSegment value={lens} onChange={onLens} disabled={lensDisabled} testID="lens" />
          </Dimmable>
        ) : null}
      </View>
      <BareToggle
        icon={GridNineIcon}
        weight={grid ? "fill" : "regular"}
        accessibilityLabel={COPY.grid}
        on={grid}
        disabled={gridDisabled}
        onPress={onGrid}
        testID="grid"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: L.controlColumns.left - HALF_BOX,
    paddingRight: L.controlColumns.right - HALF_BOX,
  },
  lensSlot: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
});
