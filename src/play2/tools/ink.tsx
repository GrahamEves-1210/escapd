// Skia pieces the drawn reveal sheets share (the pencil rubbing, the red-lens card, the fold-in):
// their rendered props' pictures (props.ts), read once and kept, and how they are sampled;
// writing set by a face's own measure (revealText.ts, setHand) and drawn word by word, each a little
// off true, with the door's wheel symbols drawn by hand; a sheet of paper with the letters' grain and
// shadow (as letters/Paper.tsx draws it, here inside a canvas that has more to draw on it).
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ColorMatrix, FilterMode, FractalNoise, Group, MipmapMode, Path, Rect, Shadow, Skia, Text, loadData, type SkFont, type SkImage, type SkTypeface } from "@shopify/react-native-skia";
import { alpha } from "@/theme/payoff";

import { BINDING, LENS, MUSICBOX, PAPERWEIGHT, PENCIL, RIBBON } from "./props";
import { handLayout, setHand, SYMBOL, type Placed, type Setting } from "./revealText";

/** The hand face (Patrick Hand, as everything written in the world) and a typewriter's (a printed page). */
export const FACE = {
  hand: require("@expo-google-fonts/patrick-hand/400Regular/PatrickHand_400Regular.ttf"),
  typed: require("@expo-google-fonts/special-elite/400Regular/SpecialElite_400Regular.ttf"),
} as const;

export type Face = keyof typeof FACE;

/** How a rendered prop's picture (props.ts) is sampled when a sheet turns or scales it: smoothly. */
export const SMOOTH = { filter: FilterMode.Linear, mipmap: MipmapMode.Linear } as const;

/** Made on first use, never at import (on the web Skia isn't there until CanvasKit has loaded). */
export function once<T>(make: () => T): () => T {
  let made: { value: T } | null = null;
  return () => (made ??= { value: make() }).value;
}

// A face is read from its file once and kept: the second sheet opened has its writing at once.
const kept: Partial<Record<Face, SkTypeface>> = {};
const reading: Partial<Record<Face, Promise<SkTypeface | null>>> = {};
function readFace(face: Face): Promise<SkTypeface | null> {
  return (reading[face] ??= loadData(FACE[face], (data) => Skia.Typeface.MakeFreeTypeFaceFromData(data)).then(
    (typeface) => {
      if (typeface) kept[face] = typeface;
      else delete reading[face];
      return typeface;
    },
    () => {
      delete reading[face];
      return null;
    },
  ));
}

// A prop's picture is decoded once and kept, like a face: a sheet opened later has its lens or its pencil at once.
const pictures = new Map<number, SkImage>();
const decoding = new Map<number, Promise<SkImage | null>>();
function readArt(source: number): Promise<SkImage | null> {
  let read = decoding.get(source);
  if (!read) {
    read = loadData(source, (data) => Skia.Image.MakeImageFromEncoded(data)).then(
      (image) => {
        if (image) pictures.set(source, image);
        else decoding.delete(source);
        return image;
      },
      () => {
        decoding.delete(source);
        return null;
      },
    );
    decoding.set(source, read);
  }
  return read;
}

/** A rendered prop's picture (props.ts) for a canvas: null until it has been read (at once if it was warmed). */
export function useArt(source: number): SkImage | null {
  const [image, setImage] = useState<SkImage | null>(pictures.get(source) ?? null);
  useEffect(() => {
    let live = true;
    if (!pictures.has(source)) readArt(source).then((read) => live && setImage(read));
    return () => {
      live = false;
    };
  }, [source]);
  return pictures.get(source) ?? image;
}

/** The canvas sheets' pictures, by the kind of card that opens them (the lamp's and the mirror's are views': Reveal.tsx). */
const ART: Record<string, readonly number[]> = {
  rub: [PENCIL.art, BINDING.art],
  lens: [LENS.art],
  fold: [PAPERWEIGHT.art],
  tune: [MUSICBOX.art, MUSICBOX.crank],
  ribbon: [RIBBON.spool, RIBBON.flange, RIBBON.clip],
};

/**
 * Starts reading both faces, and the pictures of the sheets this case can open (`kinds`: its cards' reveals),
 * so a sheet opened later has its writing and its props at once and a case without one holds none of them.
 */
export function warmFaces(kinds: readonly string[] = []): void {
  try {
    void readFace("hand");
    void readFace("typed");
    for (const kind of kinds) for (const art of ART[kind] ?? []) void readArt(art);
  } catch {
    // Skia not up yet (the web, before CanvasKit): the sheet reads them itself when it opens.
  }
}

/** A face at `size`, for a canvas (null until its file has been read). */
export function useFace(face: Face, size: number): SkFont | null {
  const [typeface, setTypeface] = useState<SkTypeface | null>(kept[face] ?? null);
  useEffect(() => {
    let live = true;
    if (!kept[face]) readFace(face).then((t) => live && setTypeface(t));
    return () => {
      live = false;
    };
  }, [face]);
  const have = kept[face] ?? typeface;
  return useMemo(() => (have ? Skia.Font(have, size) : null), [have, size]);
}

/** A word's set width in a face: its glyphs' advances. */
export function measureWith(font: SkFont): (word: string) => number {
  return (word) => font.getGlyphWidths(font.getGlyphIDs(word)).reduce((s, w) => s + w, 0);
}

/** The writing set `width` wide in a face at `size` (null until the face has loaded). `steady` calms the hand's tilt (type). */
export function useWriting(text: string, seed: string, size: number, width: number, face: Face = "hand", align: "left" | "center" = "left", steady = 1): { font: SkFont; setting: Setting } | null {
  const font = useFace(face, size);
  return useMemo(() => {
    if (!font) return null;
    const lines = handLayout(text, seed).map((ws) => ws.map((w) => ({ ...w, rot: w.rot * steady, dy: w.dy * steady })));
    return { font, setting: setHand(lines, size, width, measureWith(font), align) };
  }, [font, text, seed, size, width, align, steady]);
}

const symbolPaths: Record<string, ReturnType<typeof Skia.Path.MakeFromSVGString>> = {};
const symbolPath = (word: string) => (symbolPaths[word] ??= Skia.Path.MakeFromSVGString(SYMBOL[word]));

/**
 * Set writing, drawn: each word turned a little about its own middle; a wheel symbol as its drawn
 * shape. Its paint (colour, opacity, blend, stroke) is the Group's it is drawn in.
 */
export function Written({ words, font, size, x = 0, y = 0 }: { words: readonly Placed[]; font: SkFont; size: number; x?: number; y?: number }) {
  return (
    <Group transform={[{ translateX: x }, { translateY: y }]}>
      {words.map((p, i) => {
        const origin = { x: p.x + p.w / 2, y: p.y - size * 0.3 };
        const turn = [{ rotate: (p.rot * Math.PI) / 180 }];
        if (p.symbol) {
          const path = symbolPath(p.word);
          const box = size * 0.66;
          return path ? (
            <Group key={i} origin={origin} transform={turn}>
              <Path path={path} transform={[{ translateX: p.x + (p.w - box) / 2 }, { translateY: p.y - box * 0.94 }, { scale: box / 24 }]} />
            </Group>
          ) : null;
        }
        return (
          <Group key={i} origin={origin} transform={turn}>
            <Text x={p.x} y={p.y} text={p.word} font={font} />
          </Group>
        );
      })}
    </Group>
  );
}

/** Noise to white with grey flecks where it dips (as letters/Paper.tsx's grain), multiplied in. */
const tooth = (k: number) => [k, 0, 0, 0, 1 - 0.5 * k, k, 0, 0, 0, 1 - 0.5 * k, k, 0, 0, 0, 1 - 0.5 * k, 0, 0, 0, 0, 1];

/** A sheet lying on the desk: its colour, a contact shadow and a softer one, its grain; whatever is on it drawn inside its edge. */
export function Sheet({ x, y, w, h, r = 2, color, shade, lift = 1, grain = 0.5, seed = 3, children }: {
  x: number; y: number; w: number; h: number; r?: number; color: string; shade: string; lift?: number; grain?: number; seed?: number; children?: ReactNode;
}) {
  const box = Skia.RRectXY(Skia.XYWHRect(x, y, w, h), r, r);
  return (
    <Group>
      <Rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} color={color}>
        <Shadow dx={0} dy={2 * lift} blur={2.5 * lift} color={shade} />
        <Shadow dx={0} dy={10 * lift} blur={16 * lift} color={alpha("#000000", 0.3)} />
      </Rect>
      <Group clip={box}>
        <Rect x={x} y={y} width={w} height={h} color={color} />
        {grain > 0 ? (
          <Rect x={x} y={y} width={w} height={h} opacity={grain} blendMode="multiply">
            <FractalNoise freqX={1.4} freqY={1.1} octaves={2} seed={seed} tileWidth={0} tileHeight={0} />
            <ColorMatrix matrix={tooth(0.55)} />
          </Rect>
        ) : null}
        {children}
      </Group>
    </Group>
  );
}
