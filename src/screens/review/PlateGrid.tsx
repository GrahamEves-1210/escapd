// The photos by slot, as the reference's photo grid: three square tiles a row,
// ref.space.edge from the screen edges and grid.gap apart both ways. Each
// photo has its label above it (its prompt, "1 · From the doorway", Regular
// 12/17 grey, wrapping), and the labels of a row sit on the tiles' shoulders:
// every cell in a row is as tall as the tallest, its content pushed to the
// bottom, so the tiles line up and a one-line label sits on the same baseline
// as the last line of a two-line one.
//
// A tile is the photo in full colour (cover) inside a 1 pt faint rim with
// tile.radius corners; tapping it retakes the photo. Its × (Phosphor X
// regular 16, white, centred tile.remove.centre from the top and right edges)
// empties its slot (the others keep theirs). A flagged photo (a build that
// failed on it) gets a 2 pt warning rim and its reason under its label
// ("Someone's in this shot"), both in the warning colour, until it is
// retaken; screen readers hear the reason with the tile. A slot the player
// emptied, inside the taken range, is an open tile: a dashed rim with the
// camera glyph and "Take this photo", under its own label; tapping it takes
// exactly that slot. Pressing in on a tile or a × gives the light `press`
// haptic.
//
// Screen-reader order per photo: its label, the tile (Retake photo 1), the ×
// (Remove photo 1). The tile and the × are siblings, never nested, so both
// stay reachable.
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Line } from "react-native-svg";
import { Image } from "expo-image";
import type { RetakeReason } from "@/capture/failure";
import type { Plate, Slot } from "@/capture/roll";
import { promptFor } from "@/capture/slots";
import { XIcon } from "@/components/icons";
import { FocusRing, useFocusRing } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { curve, ref } from "@/theme/tokens";
import { COPY, fillLabel, plateLabel, plateLabelSpoken, removeLabel, retakeLabel } from "./copy";
import { CameraGlyph } from "./Glyphs";

const L = ref.layout.review;
const G = L.grid;
const T = L.tile;
const R = T.remove;

export interface PlateGridProps {
  /** The slots up to the last filled one; null is a slot the player emptied. */
  slots: readonly Slot[];
  /** Photos still marked by a failed build, by URI, with the reason. */
  marks: ReadonlyMap<string, RetakeReason>;
  /** Retake a photo in place, or take an open slot: both open the camera on that slot. */
  onRetake: (slot: number) => void;
  onRemove: (slot: number) => void;
}

export function PlateGrid({ slots, marks, onRetake, onRemove }: PlateGridProps) {
  const { width } = useWindowDimensions();
  const tile = (width - ref.space.edge * 2 - G.gap * (G.columns - 1)) / G.columns;
  const rows: number[][] = [];
  slots.forEach((_, i) => {
    if (i % G.columns === 0) rows.push([]);
    rows[rows.length - 1].push(i);
  });
  return (
    <View style={styles.grid} testID="plate-grid">
      {rows.map((row) => (
        <View key={row[0]} style={styles.row}>
          {row.map((i) => {
            const plate = slots[i];
            return plate ? (
              <PlateCell
                key={plate.uri}
                index={i}
                plate={plate}
                size={tile}
                reason={marks.get(plate.uri) ?? null}
                onRetake={onRetake}
                onRemove={onRemove}
              />
            ) : (
              <OpenCell key={`open-${i}`} index={i} size={tile} onTake={onRetake} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface PlateCellProps {
  index: number;
  plate: Plate;
  size: number;
  /** Set while the photo is marked for a retake. */
  reason: RetakeReason | null;
  onRetake: (slot: number) => void;
  onRemove: (slot: number) => void;
}

function PlateCell({ index, plate, size, reason, onRetake, onRemove }: PlateCellProps) {
  const prompt = promptFor(index);
  const tileFocus = useFocusRing();
  const removeFocus = useFocusRing();
  const feedback = useFeedback();
  const marked = reason !== null;
  const rim = marked ? T.flaggedRim : T.rim;
  const why = reason ? COPY.reasons[reason] : null;
  return (
    <View style={[styles.cell, { width: size }]} testID={`plate-${index}`}>
      <View style={styles.label}>
        <Text style={[styles.labelText, marked && styles.warning]} accessibilityLabel={plateLabelSpoken(prompt)}>
          {plateLabel(prompt)}
        </Text>
        {why ? (
          // Drawn only: the tile carries the reason for screen readers.
          <Text
            style={[styles.labelText, styles.warning]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID={`plate-${index}-flag`}
          >
            {why}
          </Text>
        ) : null}
      </View>
      <View style={{ width: size, height: size }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={why ? `${retakeLabel(prompt)}. ${why}.` : retakeLabel(prompt)}
          onPressIn={feedback.press}
          onPress={() => onRetake(index)}
          onFocus={tileFocus.onFocus}
          onBlur={tileFocus.onBlur}
          testID={`plate-${index}-retake`}
          style={({ pressed }) => [StyleSheet.absoluteFill, pressed ? styles.pressed : null]}
        >
          <View
            style={[styles.frame, { borderWidth: rim, borderColor: marked ? L.warning : ref.color.rim }]}
            testID={`plate-${index}-frame`}
          >
            <View style={styles.loading} />
            <Image source={{ uri: plate.uri }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
          </View>
          <FocusRing visible={tileFocus.focused} shape="panel" radius={T.radius} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel(prompt)}
          onPressIn={feedback.press}
          onPress={() => onRemove(index)}
          onFocus={removeFocus.onFocus}
          onBlur={removeFocus.onBlur}
          testID={`plate-${index}-remove`}
          style={({ pressed }) => [styles.remove, pressed ? styles.pressed : null]}
        >
          <RemoveGlyph />
          <FocusRing visible={removeFocus.focused} shape="pill" />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A slot the player emptied: its label as usual, then a dashed tile (no
 * photo) with the camera glyph and "Take this photo". Tapping it opens the
 * camera on exactly this slot.
 */
function OpenCell({ index, size, onTake }: { index: number; size: number; onTake: (slot: number) => void }) {
  const prompt = promptFor(index);
  const focus = useFocusRing();
  const feedback = useFeedback();
  return (
    <View style={[styles.cell, { width: size }]} testID={`plate-${index}`}>
      <View style={styles.label}>
        <Text style={styles.labelText} accessibilityLabel={plateLabelSpoken(prompt)}>
          {plateLabel(prompt)}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={fillLabel(prompt)}
        onPressIn={feedback.press}
        onPress={() => onTake(index)}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={`plate-${index}-open`}
        style={({ pressed }) => [styles.open, { width: size, height: size }, pressed ? styles.pressed : null]}
      >
        <CameraGlyph color={ref.color.textSecondary} />
        <Text style={styles.openText}>{COPY.openTile}</Text>
        <FocusRing visible={focus.focused} shape="panel" radius={T.radius} edge={T.open.border} />
      </Pressable>
    </View>
  );
}

// Phosphor X's two strokes (256 units: 56 to 200 each way) as a soft dark
// halo under the white glyph, so the × still reads over a bright wall. Over
// a dark photo, as in the reference, the halo disappears into it.
const X_FROM = (R.icon * R.haloFrom) / R.haloBox;
const X_TO = (R.icon * R.haloTo) / R.haloBox;

function RemoveGlyph() {
  return (
    <View pointerEvents="none" style={{ width: R.icon, height: R.icon }}>
      <Svg width={R.icon} height={R.icon} style={StyleSheet.absoluteFill}>
        <Line x1={X_FROM} y1={X_FROM} x2={X_TO} y2={X_TO} stroke={ref.color.void} strokeOpacity={R.haloOpacity} strokeWidth={R.halo} strokeLinecap="round" />
        <Line x1={X_TO} y1={X_FROM} x2={X_FROM} y2={X_TO} stroke={ref.color.void} strokeOpacity={R.haloOpacity} strokeWidth={R.halo} strokeLinecap="round" />
      </Svg>
      {/* Positioned too, so the web paints it over the (positioned) halo. */}
      <View style={StyleSheet.absoluteFill}>
        <XIcon size={R.icon} weight={R.weight} color={ref.color.textPrimary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { marginHorizontal: ref.space.edge, gap: G.gap },
  row: { flexDirection: "row", gap: G.gap, alignItems: "stretch" },
  cell: { justifyContent: "flex-end", gap: G.labelGap },
  label: { justifyContent: "flex-end" },
  labelText: { ...L.type.label, color: ref.color.textSecondary },
  warning: { color: L.warning },
  // No fill on the frame itself: the rim composites over the ground (#282828,
  // 1.29:1, as faint as the reference's edge). The loading fill sits inside it.
  frame: { flex: 1, overflow: "hidden", borderRadius: T.radius, ...curve },
  loading: { ...StyleSheet.absoluteFill, backgroundColor: ref.color.raised },
  // The open slot: a dashed grey rim on the ground, the glyph and its line centred.
  open: {
    alignItems: "center",
    justifyContent: "center",
    gap: T.open.gap,
    borderWidth: T.open.border,
    borderStyle: "dashed",
    borderColor: T.open.rim,
    borderRadius: T.radius,
    ...curve,
  },
  openText: { ...L.type.label, color: ref.color.textSecondary, textAlign: "center" },
  remove: {
    position: "absolute",
    top: R.centre - ref.hit.min / 2,
    right: R.centre - ref.hit.min / 2,
    width: ref.hit.min,
    height: ref.hit.min,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: L.pressedOpacity },
});
