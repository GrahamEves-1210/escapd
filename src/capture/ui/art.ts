// The camera's rendered chrome (scripts/blender/props/camera_*.py; sizes in
// ./look.ts CHROME): stills only, laid under or round the live controls.
import type { ImageSourcePropType } from "react-native";

export const ART = {
  /** The leather's grain, a repeating square laid over the mode's ground. */
  leather: require("../../../assets/capture/leather.png") as ImageSourcePropType,
  /** The studio's light across the back: warm upper left, plum lower right. Stretched. */
  light: require("../../../assets/capture/light.png") as number,
  /** The brass frame round the preview, per lens. */
  finder: require("../../../assets/capture/finder.png") as number,
  finderWide: require("../../../assets/capture/finder-wide.png") as number,
  /** The finder's glass: a slight darkening into the corners. Stretched. */
  glass: require("../../../assets/capture/glass.png") as number,
  shutter: require("../../../assets/capture/shutter.png") as number,
  shutterDown: require("../../../assets/capture/shutter-down.png") as number,
  lever: require("../../../assets/capture/lever.png") as number,
  counter: require("../../../assets/capture/counter.png") as number,
  lensTrack: require("../../../assets/capture/lens-track.png") as number,
  lensThumb: require("../../../assets/capture/lens-thumb.png") as number,
  buttonSquare: require("../../../assets/capture/button-square.png") as number,
  buttonRound: require("../../../assets/capture/button-round.png") as number,
  print: require("../../../assets/capture/print.png") as number,
  tray: require("../../../assets/capture/tray.png") as number,
} as const;
