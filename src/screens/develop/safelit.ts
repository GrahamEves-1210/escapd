// 06 · A photo as it looks in the tray, under the safelight: its silver image
// on red-lit paper. Each photo is drawn once, small, through one colour matrix
// (SAFELIT) onto an offscreen Skia surface, and kept as an image the darkroom
// lays under the liquid (Darkroom.tsx). One at a time, so a roll of photos
// never decodes all at once; the full-size decode is let go as soon as the
// small print is made.
//
// Where Skia can't draw (the web before CanvasKit loads) or a photo can't be
// read, there is no print: the darkroom shows the photo under a red wash.
import { useEffect, useState } from "react";
import type { SkImage } from "@shopify/react-native-skia";
import { skiaAvailable } from "@/lib/skiaReady";

/** The print's long edge, px: the sheet's window is about 141 pt tall, at 3x. */
export const PRINT_EDGE = 432;
/** How many prints are kept: more than a roll holds (capture's MAX_PLATES is 7). */
const KEEP = 8;

/**
 * Luma to the print: near black where the photo is dark, the wet paper's red
 * (assets/develop/print-blank.png) where it is white, a little harder than
 * the photo so a dim room still reads. A 4 x 5 row-major colour matrix
 * (Skia's ColorFilter.MakeMatrix; offsets 0 to 1).
 */
export const SAFELIT: readonly number[] = (() => {
  const luma = [0.2126, 0.7152, 0.0722];
  const row = (black: number, paper: number) => [...luma.map((l) => l * (paper - black) * 1.45), 0, black];
  return [...row(0.07, 0.92), ...row(0.02, 0.46), ...row(0.014, 0.32), 0, 0, 0, 1, 0];
})();

type Skia = typeof import("@shopify/react-native-skia");

function skia(): Skia {
  // Loaded when first used: on the web the module must not be evaluated before CanvasKit is there.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@shopify/react-native-skia") as Skia;
}

const made = new Map<string, SkImage>();
const pending = new Map<string, Promise<SkImage | null>>();
let queue: Promise<unknown> = Promise.resolve();

async function draw(uri: string): Promise<SkImage | null> {
  const S = skia();
  const { Skia, FilterMode, MipmapMode } = S;
  const photo = await S.loadData(uri, (data) => Skia.Image.MakeImageFromEncoded(data));
  if (!photo) return null;
  try {
    const scale = Math.min(1, PRINT_EDGE / Math.max(photo.width(), photo.height()));
    const w = Math.max(1, Math.round(photo.width() * scale));
    const h = Math.max(1, Math.round(photo.height() * scale));
    const surface = Skia.Surface.Make(w, h);
    if (!surface) return null;
    try {
      const paint = Skia.Paint();
      paint.setColorFilter(Skia.ColorFilter.MakeMatrix([...SAFELIT]));
      surface.getCanvas().drawImageRectOptions(
        photo,
        Skia.XYWHRect(0, 0, photo.width(), photo.height()),
        Skia.XYWHRect(0, 0, w, h),
        FilterMode.Linear,
        scale < 1 ? MipmapMode.Linear : MipmapMode.None,
        paint,
      );
      paint.dispose();
      surface.flush();
      const snapshot = surface.makeImageSnapshot();
      const print = snapshot.makeNonTextureImage();
      if (print !== snapshot) snapshot.dispose();
      return print;
    } finally {
      surface.dispose();
    }
  } finally {
    photo.dispose();
  }
}

/** The photo's print under the safelight, made once; null when it can't be. */
export function safelitPrint(uri: string): Promise<SkImage | null> {
  const known = made.get(uri);
  if (known) return Promise.resolve(known);
  if (!skiaAvailable()) return Promise.resolve(null);
  const waiting = pending.get(uri);
  if (waiting) return waiting;
  // One at a time, each after a turn of the event loop.
  const run = queue.then(() => new Promise<void>((resolve) => setTimeout(resolve, 0))).then(() => draw(uri)).then(
    (print) => print,
    () => null,
  ).then((print) => {
    pending.delete(uri);
    if (print) {
      made.set(uri, print);
      while (made.size > KEEP) {
        const oldest = made.keys().next().value as string;
        made.get(oldest)?.dispose();
        made.delete(oldest);
      }
    }
    return print;
  });
  queue = run;
  pending.set(uri, run);
  return run;
}

/** The print for `uri` (null while it is being made, or if it can't be). */
export function useSafelit(uri: string | null): SkImage | null {
  const [print, setPrint] = useState<{ uri: string; image: SkImage } | null>(() => {
    const known = uri === null ? undefined : made.get(uri);
    return uri !== null && known ? { uri, image: known } : null;
  });
  useEffect(() => {
    if (uri === null) return;
    let live = true;
    void safelitPrint(uri).then((image) => {
      if (live && image) setPrint({ uri, image });
    });
    return () => {
      live = false;
    };
  }, [uri]);
  return print && print.uri === uri ? print.image : null;
}
