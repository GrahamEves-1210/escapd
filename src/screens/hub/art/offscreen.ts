// The surface a cover is baked on (bake.ts), on iOS and Android: the GPU's,
// where the covers' wide soft blurs and noise cost little (on the CPU noir
// takes a long while), else a raster one. The web's is offscreen.web.ts.
import type { SkSurface } from "@shopify/react-native-skia";
import type { SkiaLib } from "./kit";

/** A surface `width` x `height` px to draw a cover on, or null if none can be made. */
export function coverSurface(lib: SkiaLib, width: number, height: number): SkSurface | null {
  return lib.Skia.Surface.MakeOffscreen(width, height) ?? lib.Skia.Surface.Make(width, height);
}
