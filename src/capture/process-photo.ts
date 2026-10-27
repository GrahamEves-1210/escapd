// Re-encode every plate as JPEG. A fresh encode drops EXIF, including GPS.
// The long edge is capped while decoding so a 12-megapixel frame does not
// have to sit fully in memory first.
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { LONG_EDGE } from "./fit";

export interface RawPhoto {
  uri: string;
  width: number;
  height: number;
}

export interface ProcessedPlate {
  uri: string;
  width: number;
  height: number;
}

/**
 * `aspect` (width / height, portrait): centre-crop to the viewfinder's frame,
 * so the photo is what the player framed (0.5x shoots tall, 9:16).
 */
export async function processPhoto(source: RawPhoto, aspect?: number): Promise<ProcessedPlate> {
  const context = ImageManipulator.manipulate(source.uri, {
    maxWidth: LONG_EDGE,
    maxHeight: LONG_EDGE,
  });
  if (aspect && source.width > 0 && source.height > 0) {
    // The decoded size: the long edge capped at LONG_EDGE.
    const scale = Math.min(1, LONG_EDGE / Math.max(source.width, source.height));
    const w = Math.floor(source.width * scale);
    const h = Math.floor(source.height * scale);
    if (w / h > aspect + 0.01) {
      const cw = Math.floor(h * aspect);
      context.crop({ originX: Math.floor((w - cw) / 2), originY: 0, width: cw, height: h });
    } else if (w / h < aspect - 0.01) {
      const ch = Math.floor(w / aspect);
      context.crop({ originX: 0, originY: Math.floor((h - ch) / 2), width: w, height: ch });
    }
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
