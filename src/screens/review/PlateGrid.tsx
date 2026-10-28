// The photos by slot, as the camera shows its last photo (02,
// ref.button.thumbnail), grown into tiles: two columns ref.space.edge from the
// screen edges and grid.gap apart, rows grid.rowGap apart. A tile is 3:4, the
// shot as the viewfinder framed it (ref.layout.camera.frameAspect): the photo
// (cover) at the thumbnail's nested corners inside its near-black frame
// (palette.frame, the thumbnail's frame width and corners, continuous), with
// the thumbnail's faint 1 pt rim over the photo. Under the tile, its name:
// the numeral in 02's counter italic (the palette's lit colour), then the
// photo's name in 02's serif title. Tapping a tile retakes the photo.
//
// Its × (Phosphor X bold, white, on a disc of the palette's well at 02's
// privacy-note strength, in from the photo's top right corner; a 44 hit area)
// empties its slot (the others keep theirs). A flagged photo (a build that
// failed on it) gets a warning ring on its frame's outer edge, where the
// camera draws its way-on ring, and its reason under its name ("Someone's in
// this shot") in the warning colour, until it is retaken; screen readers
// hear the reason with the tile. A slot the player emptied, inside the taken
// range, is an open tile: the tile's shape in a dashed tertiary rim with the
// camera glyph and "Take this photo", under its own name; tapping it takes
// exactly that slot. Pressing in on a tile or a × gives the light `press`
// haptic.
//
// Screen-reader order per photo: the tile (Retake photo 1), the × (Remove
// photo 1), then its name (Photo 1, From the doorway). The tile and the × are
// siblings, never nested, so both stay reachable.
//
// Inside a mode each photo is shown in the mode's baked treatment
// (TreatedImage at ref.layout.review.tile.bake): the photo as taken until its
// bake is ready, then the treatment fades in over ref.motion.treatment (at
// once under reduced motion). Names, frames and the open tile take the mode's
// colours (src/capture/ui/palette.ts); the × stays white over its disc.
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { RetakeReason } from "@/capture/failure";
import type { Plate, Slot } from "@/capture/roll";
import { promptFor, type PlatePrompt } from "@/capture/slots";
import { useCapturePalette, type CapturePalette } from "@/capture/ui/palette";
import { XIcon } from "@/components/icons";
import { FocusRing, TreatedImage, useFocusRing, SquashPressable } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { curve, ref } from "@/theme/tokens";
import { COPY, fillLabel, removeLabel, retakeLabel } from "./copy";
import { CameraGlyph } from "./Glyphs";

const L = ref.layout.review;
const G = L.grid;
const T = L.tile;
const R = T.remove;
const THUMB = ref.button.thumbnail;
const ASPECT = ref.layout.camera.frameAspect;

export interface PlateGridProps {
  /** The slots up to the last filled one; null is a slot the player emptied. */
  slots: readonly Slot[];
  /** The roll's prompts (its plan's, one per photo): each tile's numeral and name. */
  prompts: readonly PlatePrompt[];
  /** Photos still marked by a failed build, by URI, with the reason. */
  marks: ReadonlyMap<string, RetakeReason>;
  /** Retake a photo in place, or take an open slot: both open the camera on that slot. */
  onRetake: (slot: number) => void;
  onRemove: (slot: number) => void;
  /** The height the grid must fit in (no scrolling): tiles shrink to it. */
  fitHeight?: number;
}

/** The number line under each tile. */
const LABEL_H = 24;

export function PlateGrid({ slots, prompts, marks, onRetake, onRemove, fitHeight }: PlateGridProps) {
  const { width } = useWindowDimensions();
  // Two across up to four photos, three across for more: every photo on one screen.
  const columns = slots.length > 4 ? 3 : G.columns;
  const rowCount = Math.max(1, Math.ceil(slots.length / columns));
  const byWidth = (width - ref.space.edge * 2 - G.gap * (columns - 1)) / columns;
  const perRow = fitHeight ? (fitHeight - G.rowGap * (rowCount - 1)) / rowCount - G.labelGap - LABEL_H : Infinity;
  const tile = Math.max(60, Math.min(byWidth, perRow * ASPECT));
  const size = { width: tile, height: tile / ASPECT };
  const rows: number[][] = [];
  slots.forEach((_, i) => {
    if (i % columns === 0) rows.push([]);
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
                prompt={promptFor(i, prompts)}
                plate={plate}
                size={size}
                reason={marks.get(plate.uri) ?? null}
                onRetake={onRetake}
                onRemove={onRemove}
              />
            ) : (
              <OpenCell key={`open-${i}`} index={i} prompt={promptFor(i, prompts)} size={size} onTake={onRetake} />
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface Size {
  width: number;
  height: number;
}

interface PlateCellProps {
  index: number;
  prompt: PlatePrompt;
  plate: Plate;
  size: Size;
  /** Set while the photo is marked for a retake. */
  reason: RetakeReason | null;
  onRetake: (slot: number) => void;
  onRemove: (slot: number) => void;
}

function PlateCell({ index, prompt, plate, size, reason, onRetake, onRemove }: PlateCellProps) {
  const tileFocus = useFocusRing();
  const removeFocus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  const why = reason ? COPY.reasons[reason] : null;
  return (
    <View style={[styles.cell, { width: size.width }]} testID={`plate-${index}`}>
      <View style={size}>
        <SquashPressable
          squash={ref.motion.juice.press.panel}
          accessibilityRole="button"
          accessibilityLabel={why ? `${retakeLabel(prompt)}. ${why}.` : retakeLabel(prompt)}
          onPressIn={feedback.press}
          onPress={() => onRetake(index)}
          onFocus={tileFocus.onFocus}
          onBlur={tileFocus.onBlur}
          testID={`plate-${index}-retake`}
          style={({ pressed }) => [styles.frame, { backgroundColor: palette.frame }, pressed ? styles.pressed : null]}
        >
          <View style={[styles.photo, { backgroundColor: palette.raised }]} testID={`plate-${index}-frame`}>
            <TreatedImage
              source={plate.uri}
              genre={palette.genre}
              maxEdge={T.bake}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              testID={`plate-${index}-photo`}
            />
          </View>
          <View pointerEvents="none" style={styles.rim} />
          {why ? <View pointerEvents="none" style={styles.flagged} testID={`plate-${index}-ring`} /> : null}
          <FocusRing visible={tileFocus.focused} shape="panel" radius={THUMB.radius} />
        </SquashPressable>
        <SquashPressable
          accessibilityRole="button"
          accessibilityLabel={removeLabel(prompt)}
          onPressIn={feedback.press}
          onPress={() => onRemove(index)}
          onFocus={removeFocus.onFocus}
          onBlur={removeFocus.onBlur}
          testID={`plate-${index}-remove`}
          style={({ pressed }) => [styles.remove, pressed ? styles.pressed : null]}
        >
          <View pointerEvents="none" style={styles.disc}>
            <View style={[StyleSheet.absoluteFill, styles.discFill, { backgroundColor: palette.well }]} />
            <XIcon size={R.icon} weight={R.weight} color={ref.color.textPrimary} />
          </View>
          <FocusRing visible={removeFocus.focused} shape="pill" />
        </SquashPressable>
      </View>
      <View style={styles.label}>
        <PlateName prompt={prompt} palette={palette} />
        {why ? (
          // Drawn only: the tile carries the reason for screen readers.
          <Text
            style={[styles.reason, styles.warning]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            testID={`plate-${index}-flag`}
          >
            {why}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * A slot the player emptied: the tile's shape in a dashed rim (no photo) with
 * the camera glyph and "Take this photo", then its name as usual. Tapping it
 * opens the camera on exactly this slot.
 */
function OpenCell({ index, prompt, size, onTake }: { index: number; prompt: PlatePrompt; size: Size; onTake: (slot: number) => void }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const palette = useCapturePalette();
  return (
    <View style={[styles.cell, { width: size.width }]} testID={`plate-${index}`}>
      <SquashPressable
        squash={ref.motion.juice.press.panel}
        accessibilityRole="button"
        accessibilityLabel={fillLabel(prompt)}
        onPressIn={feedback.press}
        onPress={() => onTake(index)}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={`plate-${index}-open`}
        style={({ pressed }) => [styles.open, size, pressed ? styles.pressed : null]}
      >
        <CameraGlyph color={palette.inkMuted} />
        <Text style={[styles.reason, styles.openText, { color: palette.inkMuted }]}>{COPY.openTile}</Text>
        <FocusRing visible={focus.focused} shape="panel" radius={THUMB.radius} edge={T.open.border} />
      </SquashPressable>
      <PlateName prompt={prompt} palette={palette} />
    </View>
  );
}

/** The photo's number only, in the counter's italic: no "Left" or "Behind" (they meant nothing to players). */
function PlateName({ prompt, palette }: { prompt: PlatePrompt; palette: CapturePalette }) {
  return (
    <View style={styles.name} accessible accessibilityLabel={`Photo ${prompt.numeral}`}>
      <Text style={[styles.numeral, { color: palette.lit }]}>{prompt.numeral}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { marginHorizontal: ref.space.edge, gap: G.rowGap },
  row: { flexDirection: "row", gap: G.gap, alignItems: "flex-start", justifyContent: "center" },
  cell: { gap: G.labelGap },
  // 02's last-photo frame, grown: no border, so the focus ring measures from its outer edge.
  frame: { ...StyleSheet.absoluteFill, borderRadius: THUMB.radius, ...curve },
  photo: {
    position: "absolute",
    top: THUMB.frameWidth,
    left: THUMB.frameWidth,
    right: THUMB.frameWidth,
    bottom: THUMB.frameWidth,
    overflow: "hidden",
    borderRadius: THUMB.imageRadius,
    ...curve,
  },
  rim: {
    position: "absolute",
    top: THUMB.frameWidth,
    left: THUMB.frameWidth,
    right: THUMB.frameWidth,
    bottom: THUMB.frameWidth,
    borderWidth: ref.layout.camera.hairline,
    borderColor: THUMB.imageRim,
    borderRadius: THUMB.imageRadius,
    ...curve,
  },
  // Where the camera draws its way-on ring: on the frame's outer edge, inside its box, so nothing moves.
  flagged: {
    ...StyleSheet.absoluteFill,
    borderWidth: T.flaggedRing,
    borderColor: L.warning,
    borderRadius: THUMB.radius,
    ...curve,
  },
  // The ×'s 44 hit area, centred on its disc.
  remove: {
    position: "absolute",
    top: THUMB.frameWidth + R.inset + R.disc / 2 - ref.hit.min / 2,
    right: THUMB.frameWidth + R.inset + R.disc / 2 - ref.hit.min / 2,
    width: ref.hit.min,
    height: ref.hit.min,
    alignItems: "center",
    justifyContent: "center",
  },
  disc: { width: R.disc, height: R.disc, borderRadius: ref.radius.round, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  discFill: { opacity: R.fillOpacity },
  // The open slot: the tile's shape in a dashed tertiary rim on the ground, the glyph and its line centred.
  open: {
    alignItems: "center",
    justifyContent: "center",
    gap: T.open.gap,
    borderWidth: T.open.border,
    borderStyle: "dashed",
    borderColor: T.open.rim,
    borderRadius: THUMB.radius,
    ...curve,
  },
  openText: { textAlign: "center" },
  label: { gap: G.reasonGap },
  name: { flexDirection: "row", alignItems: "baseline", gap: G.numeralGap },
  numeral: { ...L.type.numeral },
  title: { ...ref.type.serifTitle, flexShrink: 1 },
  reason: { ...L.type.reason },
  warning: { color: L.warning },
  pressed: { opacity: THUMB.pressedOpacity },
});
