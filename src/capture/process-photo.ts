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

export async function processPhoto(source: RawPhoto): Promise<ProcessedPlate> {
  const image = await ImageManipulator.manipulate(source.uri, {
    maxWidth: LONG_EDGE,
    maxHeight: LONG_EDGE,
  }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
