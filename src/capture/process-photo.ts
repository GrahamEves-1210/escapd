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

export interface CropRect {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/**
 * The centred crop of a `width` x `height` image to `aspect` (width / height),
 * in whole pixels and always inside the image; null when it already is that
 * shape (within 1 %).
 */
export function centreCrop(width: number, height: number, aspect: number): CropRect | null {
  if (!(width > 0) || !(height > 0) || !(aspect > 0)) return null;
  const w = Math.floor(width);
  const h = Math.floor(height);
  if (w / h > aspect * 1.01) {
    const cw = Math.max(1, Math.min(w, Math.round(h * aspect)));
    return { originX: Math.floor((w - cw) / 2), originY: 0, width: cw, height: h };
  }
  if (w / h < aspect / 1.01) {
    const ch = Math.max(1, Math.min(h, Math.round(w / aspect)));
    return { originX: 0, originY: Math.floor((h - ch) / 2), width: w, height: ch };
  }
  return null;
}

/**
 * `aspect` (width / height, portrait): centre-crop to the viewfinder's frame,
 * so the photo is what the player framed (both lenses shoot tall, 9:16). The
 * crop is worked out on the decoded image itself, as the phone hands it over
 * (upright, its long edge capped), never on the camera's reported size, so it
 * can't fall outside the image whatever way round or however rounded that is.
 */
export async function processPhoto(source: RawPhoto, aspect?: number): Promise<ProcessedPlate> {
  let image = await ImageManipulator.manipulate(source.uri, {
    maxWidth: LONG_EDGE,
    maxHeight: LONG_EDGE,
  }).renderAsync();
  const crop = aspect ? centreCrop(image.width, image.height, aspect) : null;
  if (crop) image = await ImageManipulator.manipulate(image).crop(crop).renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
