// The bottom of the game's frame: a shelf of the mode's wood under the room,
// a brass strip along its front edge (the cat's paws rest on it), and let
// into it a row of felt-lined wells for what the player holds (TrayWells,
// drawn by ItemTray at its own size). Static art: drawn once.
import { memo, useId } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { BRASS, EdgeShadow, hidden, INK, Plank, useHudMaterials } from "./materials";

/** The shelf's brass lip (points): the ledge's top padding starts under it. */
export const SHELF_LIP = 3;

/** The shelf, behind whatever the ledge holds (it fills its parent). `cast`: a shadow up onto the room. */
export const Shelf = memo(function Shelf({ height = 80, cast = true }: { height?: number; cast?: boolean }) {
  const m = useHudMaterials();
  return (
    <View style={StyleSheet.absoluteFill} {...hidden}>
      {cast ? <EdgeShadow height={12} from="bottom" color={m.shadow} opacity={0.7} style={styles.cast} /> : null}
      <Plank height={height} lit="top" brass={SHELF_LIP} seed={29} />
    </View>
  );
});

/**
 * The wells: `count` slots `size` square, `gap` apart, each cut into the wood
 * and lined with the mode's felt (dark under its upper lip, where the light
 * doesn't reach), a fine brass rim round it.
 */
export const TrayWells = memo(function TrayWells({ count, size, gap }: { count: number; size: number; gap: number }) {
  const m = useHudMaterials();
  const id = `tw${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const w = count * size + Math.max(0, count - 1) * gap;
  const r = Math.min(10, size * 0.2);
  return (
    <View style={[StyleSheet.absoluteFill, styles.wells]} {...hidden}>
      <Svg width={w} height={size}>
        <Defs>
          <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={m.felt.deep} />
            <Stop offset={0.45} stopColor={m.felt.mid} />
            <Stop offset={1} stopColor={m.felt.light} />
          </LinearGradient>
          <LinearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset={0} stopColor={BRASS.shade} />
            <Stop offset={0.5} stopColor={BRASS.mid} />
            <Stop offset={1} stopColor={BRASS.light} />
          </LinearGradient>
          <LinearGradient id={`${id}s`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor="#000000" stopOpacity={0.6} />
            <Stop offset={1} stopColor="#000000" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {Array.from({ length: count }, (_, i) => {
          const x = i * (size + gap);
          return <Slot key={i} x={x} size={size} r={r} felt={`url(#${id}f)`} rim={`url(#${id}r)`} shade={`url(#${id}s)`} />;
        })}
      </Svg>
    </View>
  );
});

function Slot({ x, size, r, felt, rim, shade }: { x: number; size: number; r: number; felt: string; rim: string; shade: string }) {
  const i = 1.5;
  return (
    <>
      <Rect x={x + 0.6} y={0.6} width={size - 1.2} height={size - 1.2} rx={r} fill={rim} stroke={INK} strokeWidth={1} />
      <Rect x={x + i + 1} y={i + 1} width={size - 2 * i - 2} height={size - 2 * i - 2} rx={r - 2} fill={felt} stroke={INK} strokeWidth={0.8} strokeOpacity={0.8} />
      <Rect x={x + i + 1.4} y={i + 1.4} width={size - 2 * i - 2.8} height={size * 0.3} rx={r - 2} fill={shade} />
    </>
  );
}

const styles = StyleSheet.create({
  cast: { position: "absolute", left: 0, right: 0, top: -12 },
  wells: { alignItems: "center", justifyContent: "center" },
});
