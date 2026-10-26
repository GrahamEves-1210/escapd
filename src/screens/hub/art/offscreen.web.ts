// The surface a cover is baked on (bake.ts), on the web: a render target on
// one WebGL context kept for every cover, made the first time it is needed.
// CanvasKit's raster surfaces draw in WebAssembly on the main thread, where
// a cover's soft blurs take seconds; on the GPU they take milliseconds.
// Skia's own MakeOffscreen opens a new WebGL context per surface and never
// releases it, and a browser keeps only about sixteen live, dropping the
// oldest (the cards' own canvases among them), so the bakes share this one.
// When it can't be made (no WebGL) or is lost, the bake falls back to a
// raster surface.
import type { SkSurface } from "@shopify/react-native-skia";
import type { CanvasKit, GrDirectContext, Surface } from "canvaskit-wasm";
import type { SkiaLib } from "./kit";

interface Shared {
  gl: WebGLRenderingContext | WebGL2RenderingContext | null;
  context: GrDirectContext;
}

let shared: Shared | null = null;
/** WebGL couldn't be had once: every later bake is drawn on a raster surface. */
let unavailable = false;

function sharedContext(ck: CanvasKit): Shared | null {
  if (shared && !shared.gl?.isContextLost()) return shared;
  shared = null;
  if (unavailable) return null;
  try {
    const element: OffscreenCanvas | HTMLCanvasElement | null =
      typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : typeof document !== "undefined" ? document.createElement("canvas") : null;
    if (!element) {
      unavailable = true;
      return null;
    }
    const handle = ck.GetWebGLContext(element);
    const context = handle ? ck.MakeWebGLContext(handle) : null;
    if (!context) {
      unavailable = true;
      return null;
    }
    const gl = (element as HTMLCanvasElement).getContext("webgl2") ?? (element as HTMLCanvasElement).getContext("webgl");
    shared = { gl: gl as Shared["gl"], context };
    return shared;
  } catch {
    unavailable = true;
    return null;
  }
}

/** A surface `width` x `height` px to draw a cover on, or null if none can be made. */
export function coverSurface(lib: SkiaLib, width: number, height: number): SkSurface | null {
  const ck = (globalThis as { CanvasKit?: CanvasKit }).CanvasKit;
  const gpu = ck ? sharedContext(ck) : null;
  let target: Surface | null = null;
  try {
    target = gpu ? ck!.MakeRenderTarget(gpu.context, width, height) : null;
  } catch {
    target = null;
  }
  if (target) {
    // Skia's own wrapper for a CanvasKit surface, required here (not at the
    // top) like the rest of Skia: only once CanvasKit has loaded.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JsiSkSurface } = require("@shopify/react-native-skia/lib/module/skia/web/JsiSkSurface") as {
      JsiSkSurface: new (ck: CanvasKit, ref: Surface) => SkSurface;
    };
    return new JsiSkSurface(ck!, target);
  }
  return lib.Skia.Surface.Make(width, height);
}
