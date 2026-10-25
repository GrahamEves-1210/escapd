// Mirrors the app's upload processing (src/capture/process-photo.ts): every
// plate is decoded with its EXIF orientation applied, scaled so the long edge
// is at most 1600 px (src/capture/fit.ts, shared, never upscaled), and
// re-encoded as JPEG at quality 0.8. The fresh encode carries no EXIF, so GPS
// and camera metadata never reach the model.
import { Jimp } from "npm:jimp@1.6.0";
import { fittedLongEdge, LONG_EDGE } from "../../src/capture/fit.ts";

export const JPEG_QUALITY = 80;   // expo-image-manipulator compress: 0.8

export interface ProcessedPhoto {
  name: string;
  bytes: Uint8Array;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export class UnsupportedPhotoError extends Error {}

/** "heic" for HEIC/HEIF (ISO BMFF brands), "jpeg" / "png" when supported, otherwise null. */
export function sniffFormat(bytes: Uint8Array): "jpeg" | "png" | "heic" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.subarray(4, 8)) === "ftyp") {
    const brand = String.fromCharCode(...bytes.subarray(8, 12));
    if (/^(heic|heix|hevc|hevx|heim|heis|mif1|msf1|avif)$/.test(brand)) return "heic";
  }
  return null;
}

export const HEIC_HELP =
  "is a HEIC photo. Export it as JPEG first: on iPhone, share it to Files or AirDrop it with " +
  "Options > Automatic off, or set Settings > Camera > Formats > Most Compatible before taking new photos. " +
  "Google Photos downloads and Windows Photos > Save as also produce JPEGs.";

export async function processPhoto(name: string, source: Uint8Array): Promise<ProcessedPhoto> {
  const format = sniffFormat(source);
  if (format === "heic" || /\.(heic|heif)$/i.test(name)) throw new UnsupportedPhotoError(`${name} ${HEIC_HELP}`);
  if (format === null) throw new UnsupportedPhotoError(`${name} is not a JPEG or PNG photo.`);

  // Jimp applies the EXIF orientation while decoding, as the phone does.
  const image = await Jimp.fromBuffer(source.slice().buffer);
  const sourceWidth = image.bitmap.width;
  const sourceHeight = image.bitmap.height;
  const fitted = fittedLongEdge(sourceWidth, sourceHeight, LONG_EDGE);
  if (!fitted) throw new UnsupportedPhotoError(`${name} has no readable size.`);
  if (fitted.width !== sourceWidth || fitted.height !== sourceHeight) {
    image.resize({ w: fitted.width, h: fitted.height });
  }
  const bytes = new Uint8Array(await image.getBuffer("image/jpeg", { quality: JPEG_QUALITY }));
  return { name, bytes, width: image.bitmap.width, height: image.bitmap.height, sourceWidth, sourceHeight };
}

/** True when the JPEG carries an APP1 Exif segment (used by tests to prove it was stripped). */
export function hasExif(bytes: Uint8Array): boolean {
  let o = 2;
  while (o + 4 < bytes.length && bytes[o] === 0xff) {
    const marker = bytes[o + 1];
    if (marker === 0xda) return false;   // start of scan: no more metadata segments
    const length = (bytes[o + 2] << 8) | bytes[o + 3];
    if (marker === 0xe1 && String.fromCharCode(...bytes.subarray(o + 4, o + 8)) === "Exif") return true;
    o += 2 + length;
  }
  return false;
}
