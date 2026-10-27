// Clues as objects (GAME_FEEL_PROMPT.md, 4): what an object gives up is shown
// as something you could pick up off the desk, not a card. A text clue is a
// note on lined, torn paper in the typewriter; an object in the room is a
// polaroid of it (the room photo cropped to the object, in the mode's
// treatment); an item pocketed is an evidence tag. Every material is the
// mode's (materials.ts); the text on paper is 14:1 and its small print 6:1.
import { useState, type ReactNode } from "react";
import { StyleSheet, Text, View, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import type { InventoryItem } from "@/game/selectors";
import { TreatedImage } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { ItemIcon } from "./ItemIcon";
import { aspectOf } from "./geometry";
import { cluePaper, tornEdge } from "./materials";
import type { SceneSource } from "./SceneView";

const P = ref.layout.play;
const C = P.clue;
const NOTE = P.type.note;

/** A photo of one object in the room: the scene and the hotspot's rect in image fractions. */
export interface Snapshot {
  source: SceneSource;
  cacheKey?: string;
  genre: Genre;
  /** False shows the photo's own colours (paranormal's case closed). */
  treated: boolean;
  shape: { x: number; y: number; w: number; h: number };
  /** The object's name, the polaroid's caption. */
  caption: string;
}

/**
 * How to place a photo (`aspect` = width / height) in a `box` so `shape` (in
 * image fractions) is centred and covers it, without showing past the photo's
 * edges: the image's size and offset inside the box.
 */
export function polaroidCrop(shape: Snapshot["shape"], imageAspect: number, box: { width: number; height: number }) {
  // Every number here ends up in a style: a NaN or Infinity (a bad aspect or
  // shape) must never get there, so each input is made finite first.
  const unit = (v: number, fallback: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback);
  const aspect = Number.isFinite(imageAspect) && imageAspect > 0 ? imageAspect : 1;
  const sx = unit(shape.x, 0);
  const sy = unit(shape.y, 0);
  const sw = Math.max(unit(shape.w, 1), 0.01);
  const sh = Math.max(unit(shape.h, 1), 0.01);
  // The displayed image height at which the shape covers the box, and never smaller than the box.
  let height = Math.max(box.width / (sw * aspect), box.height / sh);
  height = Math.max(height, box.height, box.width / aspect);
  const width = height * aspect;
  const cx = (sx + sw / 2) * width;
  const cy = (sy + sh / 2) * height;
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  return {
    width,
    height,
    left: clamp(box.width / 2 - cx, box.width - width),
    top: clamp(box.height / 2 - cy, box.height - height),
  };
}

/** A note on lined, torn paper, tilted a touch. Its children are the typed lines. */
export function TornNote({ genre, seed, children, testID }: { genre: Genre | null; seed: string; children: ReactNode; testID?: string }) {
  const paper = cluePaper(genre);
  const { fontScale } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const line = NOTE.lineHeight * fontScale;
  const rules = Math.max(0, Math.floor((height - C.pad) / line));
  const onLayout = (e: LayoutChangeEvent) => setHeight(e.nativeEvent.layout.height);
  return (
    <View style={styles.noteWrap} testID={testID}>
      <Svg width="100%" height={C.tear} viewBox={`0 0 100 ${C.tear}`} preserveAspectRatio="none" style={styles.tear}>
        <Path d={tornEdge(seed, C.tear)} fill={paper.paper} />
      </Svg>
      <View style={[styles.note, { backgroundColor: paper.paper }]} onLayout={onLayout} testID={testID ? `${testID}-paper` : undefined}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: rules }, (_, i) => (
            <View key={i} style={[styles.rule, { top: C.pad + (i + 1) * line - C.rule * 3, backgroundColor: paper.rule }]} />
          ))}
          <View style={[styles.margin, { backgroundColor: paper.margin }]} />
        </View>
        {children}
      </View>
    </View>
  );
}

/** A line typed on a note: the clue's text in the typewriter, `muted` for small print. */
export function NoteLine({ genre, text, muted = false }: { genre: Genre | null; text: string; muted?: boolean }) {
  const paper = cluePaper(genre);
  return <Text style={[muted ? styles.noteSmall : styles.noteText, { color: muted ? paper.inkMuted : paper.ink }]}>{text}</Text>;
}

/** A polaroid of the object: the photo cropped to it in a white frame, its name on the foot. */
export function Polaroid({ snapshot, width = C.width }: { snapshot: Snapshot; width?: number }) {
  const paper = cluePaper(snapshot.genre);
  const [aspect, setAspect] = useState<number | null>(null);
  const window = width - C.frame * 2;
  const crop = aspect ? polaroidCrop(snapshot.shape, aspect, { width: window, height: window }) : null;
  return (
    <View
      style={[styles.polaroid, { width, backgroundColor: paper.frame, shadowColor: paper.shade }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Photo of the ${snapshot.caption.toLowerCase()}`}
      testID="clue-polaroid"
    >
      <View style={[styles.window, { width: window, height: window }]}>
        <TreatedImage
          source={snapshot.source}
          genre={snapshot.genre}
          original={!snapshot.treated}
          cacheKey={snapshot.cacheKey}
          contentFit="fill"
          accessible={false}
          onLoad={(e) => {
            // Only a real size: NaN or Infinity in the crop's style can crash iOS.
            const next = aspectOf(e.source.width, e.source.height);
            if (next !== null) setAspect(next);
          }}
          style={crop ? [styles.photo, crop] : styles.measure}
        />
      </View>
      <Text numberOfLines={2} style={[styles.caption, { color: paper.ink }]}>{snapshot.caption}</Text>
    </View>
  );
}

/** An item pocketed: a manila-coloured tag with a string hole, the glyph and the typed name, the description under it. */
export function EvidenceTag({ item, genre }: { item: InventoryItem; genre: Genre | null }) {
  const paper = cluePaper(genre);
  return (
    <View
      style={[styles.evidenceTag, { backgroundColor: paper.paper }]}
      accessible
      accessibilityLabel={`${item.name}. ${item.description ?? ""}`}
      testID={`clue-tag-${item.id}`}
    >
      <View style={[styles.tagHole, { borderColor: paper.inkMuted }]} />
      <View style={[styles.tagIcon, { borderColor: paper.rule }]}>
        <ItemIcon name={item.name} size={P.tray.icon} tint={paper.ink} />
      </View>
      <View style={styles.tagText}>
        <Text style={[styles.tagName, { color: paper.ink }]}>{item.name}</Text>
        {item.description ? <Text style={[styles.noteSmall, { color: paper.inkMuted }]}>{item.description}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  noteWrap: { transform: [{ rotate: `${C.tilt}deg` }] },
  tear: { marginBottom: -1 },
  note: {
    paddingTop: C.pad,
    paddingBottom: C.pad + ref.space.xs,
    paddingLeft: C.margin + ref.space.sm,
    paddingRight: C.pad,
    gap: ref.space.sm,
    borderBottomLeftRadius: ref.space.xs / 2,
    borderBottomRightRadius: ref.space.xs / 2,
  },
  rule: { position: "absolute", left: 0, right: 0, height: C.rule },
  margin: { position: "absolute", top: 0, bottom: 0, left: C.margin, width: C.rule },
  noteText: { ...NOTE },
  noteSmall: { ...P.type.noteSmall },
  polaroid: {
    paddingTop: C.frame,
    paddingHorizontal: C.frame,
    alignItems: "center",
    transform: [{ rotate: `${C.polaroidTilt}deg` }],
    shadowOpacity: 1,
    shadowRadius: ref.space.sm,
    shadowOffset: { width: 0, height: ref.space.xs },
    elevation: 4,
  },
  window: { overflow: "hidden", backgroundColor: ref.color.void },
  photo: { position: "absolute" },
  measure: { width: 1, height: 1, opacity: 0 },
  caption: { ...P.type.noteSmall, minHeight: C.foot, paddingTop: ref.space.xs, textAlign: "center", alignSelf: "stretch" },
  evidenceTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: C.gap,
    paddingVertical: ref.space.sm + ref.space.xs,
    paddingLeft: C.pad + ref.space.sm,
    paddingRight: C.pad,
    borderRadius: ref.space.xs,
    ...ref.curve,
  },
  tagHole: {
    position: "absolute",
    left: ref.space.sm,
    top: "50%",
    marginTop: -P.evidence.hole / 2,
    width: P.evidence.hole,
    height: P.evidence.hole,
    borderRadius: P.evidence.hole / 2,
    borderWidth: C.rule,
  },
  tagIcon: { width: P.card.well, height: P.card.well, alignItems: "center", justifyContent: "center", borderRightWidth: C.rule },
  tagText: { flex: 1, gap: ref.space.xs },
  tagName: { ...P.type.note },
});
