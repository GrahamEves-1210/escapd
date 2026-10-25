// The control row under the viewfinder: flash in the back-button column, the
// lens segment centred, the framing grid in the library column. Utility
// toggles, so never signal: bright when on, meta when off. Flash also swaps
// its glyph (Lightning on, LightningSlash off) and the grid's state shows as
// its lines on the viewfinder, so colour is never the only cue. The centre
// slot stays empty when no ultra-wide lens is reported, and the row height
// holds.
//
// The row is 44 tall plus SLOP above and below (the Rangefinder's padding), so
// every hit area fits inside it: flash and grid are 44 boxes in 48 slop boxes,
// and the lens halves are 50 x 48.
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BareIconButton } from "@/components/noir";
import { GridNineIcon, LightningIcon, LightningSlashIcon } from "@/components/icons";
import { ref } from "@/theme/tokens";
import { COPY } from "./copy";
import { Dimmable, SLOP, slopBox, undimmed } from "./Dimmable";
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
      <Dimmable dimmed={flashDisabled} style={slopBox}>
        <BareIconButton
          icon={flash ? LightningIcon : LightningSlashIcon}
          accessibilityLabel={COPY.flash}
          checked={flash}
          disabled={flashDisabled}
          onPress={onFlash}
          style={undimmed}
          testID="flash"
        />
      </Dimmable>
      <View style={styles.lensSlot}>
        {showLens ? (
          <Dimmable dimmed={lensDisabled} appear>
            <LensSegment value={lens} onChange={onLens} disabled={lensDisabled} testID="lens" />
          </Dimmable>
        ) : null}
      </View>
      <Dimmable dimmed={gridDisabled} style={slopBox}>
        <BareIconButton
          icon={GridNineIcon}
          accessibilityLabel={COPY.grid}
          checked={grid}
          disabled={gridDisabled}
          onPress={onGrid}
          style={undimmed}
          testID="grid"
        />
      </Dimmable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: L.edge },
  // The centre slot spans the row's whole 48 band (its 44 plus the SLOP above
  // and below) while taking 44 of its height, so the 48-tall lens halves sit
  // inside every parent and the track stays centred on the row.
  lensSlot: { flex: 1, alignSelf: "stretch", alignItems: "center", marginVertical: -SLOP },
});
