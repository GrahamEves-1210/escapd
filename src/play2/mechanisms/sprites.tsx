// The mechanisms' rendered parts: walnut, brass, steel and glass modelled and lit
// in Blender (scripts/blender/props/mech_*.py, one studio, one ink line) and
// exported at the boxes the mechanisms give them, in points. Each moving part
// is its own picture on a clear ground, so the mechanisms' own transforms
// slide, turn and swap them exactly as they did the drawn ones; what changes
// with the mode or the state (cloth, felt, numerals, light) stays drawn live
// under or over them.
import { memo } from "react";
import { Image as NativeImage, Platform, StyleSheet, View, type DimensionValue, type ImageStyle, type StyleProp } from "react-native";
import { Image } from "expo-image";
import { GADGET } from "./gadgets/sprites";
import { hidden } from "./materials";

export const ART = {
  // Drawer.tsx (mech_drawer.py)
  drawerCarcass: require("../../../assets/mech/drawer-carcass.png") as number,
  drawerFront: require("../../../assets/mech/drawer-front.png") as number,
  cabinetCarcass: require("../../../assets/mech/cabinet-carcass.png") as number,
  cabinetDoor: require("../../../assets/mech/cabinet-door.png") as number,
  pull: require("../../../assets/mech/pull.png") as number,
  keyhole: require("../../../assets/mech/keyhole.png") as number,
  hinge: require("../../../assets/mech/hinge.png") as number,
  // CombinationLock.tsx, Wheels.tsx (mech_lock.py)
  lockShackle: require("../../../assets/mech/lock-shackle.png") as number,
  lockBody: require("../../../assets/mech/lock-body.png") as number,
  lockBed: require("../../../assets/mech/lock-bed.png") as number,
  // LiftUnder.tsx (mech_lift.py): the dyed ones once per mode.
  cushion: {
    noir: require("../../../assets/mech/cushion-noir.png") as number,
    crime_scene: require("../../../assets/mech/cushion-crime.png") as number,
    paranormal: require("../../../assets/mech/cushion-paranormal.png") as number,
  },
  book: {
    noir: require("../../../assets/mech/book-noir.png") as number,
    crime_scene: require("../../../assets/mech/book-crime.png") as number,
    paranormal: require("../../../assets/mech/book-paranormal.png") as number,
  },
  pot: {
    noir: require("../../../assets/mech/pot-noir.png") as number,
    crime_scene: require("../../../assets/mech/pot-crime.png") as number,
    paranormal: require("../../../assets/mech/pot-paranormal.png") as number,
  },
  box: require("../../../assets/mech/box.png") as number,
  // ClockHands.tsx (mech_clock.py)
  clockDial: require("../../../assets/mech/clock-dial.png") as number,
  clockHatch: require("../../../assets/mech/clock-hatch.png") as number,
  clockHour: require("../../../assets/mech/clock-hand-hour.png") as number,
  clockMinute: require("../../../assets/mech/clock-hand-minute.png") as number,
  clockGlass: require("../../../assets/mech/clock-glass.png") as number,
  // Light.tsx (mech_lamp.py): cold in each mode's cloth, alight in each mode's light, and the ultraviolet one.
  lamp: {
    noir: require("../../../assets/mech/lamp-noir.png") as number,
    crime_scene: require("../../../assets/mech/lamp-crime.png") as number,
    paranormal: require("../../../assets/mech/lamp-paranormal.png") as number,
  },
  lampLit: {
    noir: require("../../../assets/mech/lamp-noir-lit.png") as number,
    crime_scene: require("../../../assets/mech/lamp-crime-lit.png") as number,
    paranormal: require("../../../assets/mech/lamp-paranormal-lit.png") as number,
    uv: require("../../../assets/mech/lamp-uv-lit.png") as number,
  },
  lampChain: require("../../../assets/mech/lamp-chain.png") as number,
  lampFob: require("../../../assets/mech/lamp-fob.png") as number,
  // TuningDial.tsx (mech_radio.py)
  radioCabinet: require("../../../assets/mech/radio-cabinet.png") as number,
  radioKnob: require("../../../assets/mech/radio-knob.png") as number,
  // FrameTilt.tsx (mech_frame.py)
  frameGilt: require("../../../assets/mech/frame-gilt.png") as number,
  frameNail: require("../../../assets/mech/frame-nail.png") as number,
  // Door.tsx (mech_door.py)
  doorPanel: require("../../../assets/mech/door-panel.png") as number,
  doorAjar: require("../../../assets/mech/door-ajar.png") as number,
} as const;

/**
 * How every part is shown: stretched to its box, never faded in, kept decoded in memory. A close-up mounts
 * its mechanism afresh after every action (a wheel tried, a hand set): from memory the part is there on
 * that same frame, where it would blink if it were read again. A part never takes a touch: the gesture is
 * the mechanism's, on the view the part sits in (and on the web a picture under the pointer would be picked
 * up and dragged off by the browser, ending the pull).
 */
const SHOWN = { contentFit: "fill", cachePolicy: "memory-disk", transition: 0, accessible: false, pointerEvents: "none", ...hidden } as const;

/** A rendered part at its box (points); nothing to a screen reader. */
export const Sprite = memo(function Sprite({ source, w, h, style }: { source: number; w: number; h: number; style?: StyleProp<ImageStyle> }) {
  return <Image source={source} style={[{ width: w, height: h }, style]} {...SHOWN} />;
});

let warmed = false;
/**
 * Reads every part into memory once, ahead of the first close-up (in Expo Go each comes over the network
 * the first time it's shown: without this a drawer's front would arrive a moment after its felt). Best
 * effort, and never in the way: a part that isn't warmed is simply read when it's first shown.
 */
export function warmSprites() {
  if (warmed) return;
  warmed = true;
  // On a phone only: a browser keeps its own cache, and react-native-web has no asset registry to ask.
  if (Platform.OS === "web" || typeof NativeImage.resolveAssetSource !== "function") return;
  try {
    const uris = Object.values({ ...ART, ...GADGET })
      .flatMap((part) => (typeof part === "number" ? [part] : Object.values(part)))
      .map((part) => NativeImage.resolveAssetSource(part)?.uri)
      .filter((uri): uri is string => typeof uri === "string" && uri.length > 0);
    if (uris.length) Image.prefetch(uris, "memory-disk").catch(() => {});
  } catch {
    // (no asset registry or image cache here)
  }
}

/**
 * A rendered plate stretched to fill whatever it's behind (a lock's body round any number of wheels): the
 * picture is `size` points square; its corners (`cap` points: the rounded corner, its rivet) keep their
 * size, its edges stretch one way and its middle both. Laid out in percentages of its parent, so it needs
 * no measuring and is there on the first frame.
 */
export const NineSlice = memo(function NineSlice({ source, size, cap }: { source: number; size: number; cap: number }) {
  const mid = size - 2 * cap;
  const long = `${(size / mid) * 100}%` as DimensionValue, back = `${(-cap / mid) * 100}%` as DimensionValue;
  // The edges and the middle run half a point under the corners (which are drawn over them): no seam between pieces.
  const c = cap - 0.5;
  const piece = (box: object, art: ImageStyle, key: string) => (
    <View key={key} style={[styles.piece, box]}>
      <Image source={source} style={[styles.art, art]} {...SHOWN} />
    </View>
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" {...hidden}>
      {piece({ left: c, right: c, top: c, bottom: c }, { left: back, top: back, width: long, height: long }, "m")}
      {piece({ left: c, right: c, top: 0, height: cap }, { left: back, top: 0, width: long, height: size }, "t")}
      {piece({ left: c, right: c, bottom: 0, height: cap }, { left: back, bottom: 0, width: long, height: size }, "b")}
      {piece({ left: 0, top: c, bottom: c, width: cap }, { left: 0, top: back, width: size, height: long }, "l")}
      {piece({ right: 0, top: c, bottom: c, width: cap }, { right: 0, top: back, width: size, height: long }, "r")}
      {piece({ left: 0, top: 0, width: cap, height: cap }, { left: 0, top: 0, width: size, height: size }, "tl")}
      {piece({ right: 0, top: 0, width: cap, height: cap }, { right: 0, top: 0, width: size, height: size }, "tr")}
      {piece({ left: 0, bottom: 0, width: cap, height: cap }, { left: 0, bottom: 0, width: size, height: size }, "bl")}
      {piece({ right: 0, bottom: 0, width: cap, height: cap }, { right: 0, bottom: 0, width: size, height: size }, "br")}
    </View>
  );
});

const styles = StyleSheet.create({
  piece: { position: "absolute", overflow: "hidden" },
  art: { position: "absolute" },
});
