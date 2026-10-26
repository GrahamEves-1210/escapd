// Bakes home's mode covers (draw.ts): each cover is drawn once per mode and
// size into an image the size of the frame it fills (a card, a mode screen's
// banner) at the screen's pixel scale, and never again: the card then draws
// that image (ModeCover). Results stay in memory for the launch, keyed by
// mode, size in pixels and scale; a cover is the same drawing every time,
// so nothing goes to disk.
//
// Bakes never run during a render or layout: a frame asks for its cover
// once it has been laid out, from an effect. They run one at a time, each
// in its own idle moment, so the screen paints first (each frame in its
// mode's surface colour) and a screenful of covers never stalls it all at
// once; a cover asked for twice is baked once. They draw on the
// GPU where there is one (offscreen.ts, offscreen.web.ts) and read the
// result back into an ordinary image, which any canvas can then draw.
//
// Skia is required lazily, inside the bake: on the web its module can only
// be evaluated once CanvasKit has loaded (src/lib/skiaReady.web.ts). Metro
// still bundles it; it just doesn't run before then. Until a cover is
// ready, and when Skia isn't available, the frame shows the mode's surface.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import type { SkImage, SkTypeface } from "@shopify/react-native-skia";
import { Archivo_800ExtraBold } from "@expo-google-fonts/archivo/800ExtraBold";
import type { Genre } from "@/lib/puzzle-types";
import { skiaAvailable } from "@/lib/skiaReady";
import { modeThemes } from "@/theme/tokens";
import { drawCover } from "./draw";
import type { ArtFonts, SkiaLib } from "./kit";
import { coverSurface } from "./offscreen";

/** A frame to fill: its size in points and the screen's device pixels per point. */
export interface CoverFrame {
  w: number;
  h: number;
  scale: number;
}

// Covers kept in memory, oldest dropped first: three cards and their banners,
// at a size or two each (a rotation, a change of text size).
const MEMORY_ENTRIES = 12;
// The longest a bake waits for the JS thread to be idle before it goes anyway.
const IDLE_WAIT = 500;
// How long a bake waits for the typeface before drawing without it (the tape's words then don't show).
const FONT_WAIT = 3000;

interface Job {
  key: string;
  genre: Genre;
  /** The image's size in pixels. */
  pw: number;
  ph: number;
  scale: number;
}

/**
 * The web's pixel-scale cap. CanvasKit may fall back to software WebGL, where a
 * cover at 3x takes seconds; 2x is under half the pixels, and the canvas
 * scales the image up to the frame.
 */
const WEB_MAX_SCALE = 2;

function jobFor(genre: Genre | null | undefined, frame: CoverFrame | null | undefined): Job | null {
  if (!genre || !frame) return null;
  const screen = frame.scale > 0 ? frame.scale : 1;
  const scale = Platform.OS === "web" ? Math.min(screen, WEB_MAX_SCALE) : screen;
  const pw = Math.round(frame.w * scale);
  const ph = Math.round(frame.h * scale);
  if (!(pw > 0 && ph > 0)) return null;
  return { key: `${genre}|${pw}x${ph}@${scale}`, genre, pw, ph, scale };
}

// ---------------------------------------------------------------------------
// Cache and queue
// ---------------------------------------------------------------------------

/** Finished covers. A failed bake isn't kept, so the next frame to ask tries again. */
const done = new Map<string, SkImage>();
const pending = new Map<string, Promise<SkImage | null>>();
let queue: Promise<unknown> = Promise.resolve();

function remember(key: string, image: SkImage) {
  done.delete(key);
  done.set(key, image);
  // Dropped, not disposed: a frame may still be drawing it; it goes with its last user.
  while (done.size > MEMORY_ENTRIES) done.delete(done.keys().next().value as string);
}

/**
 * Resolves when the JS thread is next idle (requestIdleCallback, on the web
 * and in React Native), at most IDLE_WAIT later; else after a turn of the
 * event loop. The screen paints its frames first.
 */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    const whenIdle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof whenIdle === "function") whenIdle(() => resolve(), { timeout: IDLE_WAIT });
    else setTimeout(resolve, 0);
  });
}

/** One bake at a time, each in its own idle moment: three covers are never drawn in one go. */
function enqueue<R>(task: () => Promise<R>): Promise<R> {
  const run = queue.then(idle).then(task);
  queue = run.catch(() => undefined);
  return run;
}

/**
 * The mode's cover for a frame, baking it first if needed. Resolves null
 * when there is nothing to bake (no mode, an empty frame), when Skia isn't
 * available (the web before CanvasKit loads, or if it failed), or when the
 * bake fails; the frame then keeps the mode's surface colour.
 */
export function bakeCover(genre: Genre | null | undefined, frame: CoverFrame | null | undefined): Promise<SkImage | null> {
  const job = jobFor(genre, frame);
  if (!job || !skiaAvailable()) return Promise.resolve(null);
  const known = done.get(job.key);
  if (known) return Promise.resolve(known);
  const inFlight = pending.get(job.key);
  if (inFlight) return inFlight;
  const work = enqueue(() => produce(job))
    .then(
      (image) => image,
      () => null,
    )
    .then((image) => {
      pending.delete(job.key);
      if (image) remember(job.key, image);
      return image;
    });
  pending.set(job.key, work);
  return work;
}

/** The cover if it is already baked; undefined while it isn't (not baked, or baking). */
export function peekCover(genre: Genre | null | undefined, frame: CoverFrame | null | undefined): SkImage | undefined {
  const job = jobFor(genre, frame);
  return job ? done.get(job.key) : undefined;
}

/** Forgets every cover and the typeface, as a new launch would. For tests. */
export function clearCovers() {
  done.clear();
  pending.clear();
  queue = Promise.resolve();
  fonts = null;
}

// ---------------------------------------------------------------------------
// The bake
// ---------------------------------------------------------------------------

/** The Skia module, evaluated on first use (see the header: not before CanvasKit on the web). */
function skia(): SkiaLib {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@shopify/react-native-skia") as SkiaLib;
}

/** The faces the covers set words in, loaded once per launch. A face that won't load is null. */
let fonts: Promise<ArtFonts> | null = null;

function artFonts(S: SkiaLib): Promise<ArtFonts> {
  fonts ??= (async () => {
    const load = S.loadData<SkTypeface>(Archivo_800ExtraBold, (data) => S.Skia.Typeface.MakeFreeTypeFaceFromData(data)).catch(() => null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), FONT_WAIT);
    });
    const grotesk = await Promise.race([load, late]);
    clearTimeout(timer);
    return { grotesk };
  })();
  return fonts;
}

async function produce(job: Job): Promise<SkImage | null> {
  const S = skia();
  const fontsFor = await artFonts(S);
  const surface = coverSurface(S, job.pw, job.ph);
  if (!surface) return null;
  try {
    const canvas = surface.getCanvas();
    canvas.scale(job.scale, job.scale);
    drawCover(S, canvas, job.genre, modeThemes[job.genre], { w: job.pw / job.scale, h: job.ph / job.scale, scale: job.scale }, fontsFor);
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    // Out of the GPU into memory: any canvas, on any thread or context, can draw it.
    const image = snapshot.makeNonTextureImage();
    if (image !== snapshot) snapshot.dispose();
    return image;
  } finally {
    surface.dispose();
  }
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/**
 * The mode's cover for a frame: the image, or null until it is baked (or
 * when it can't be: no frame yet, no Skia). A cover baked before reads back
 * on the first render, with no wait.
 */
export function useCover(genre: Genre | null | undefined, frame: CoverFrame | null | undefined): SkImage | null {
  const job = jobFor(genre, frame);
  const key = job?.key ?? null;
  const [result, setResult] = useState<{ key: string | null; image: SkImage | null }>({ key: null, image: null });
  const w = frame?.w;
  const h = frame?.h;
  const scale = frame?.scale;

  useEffect(() => {
    if (key === null || done.has(key) || w === undefined || h === undefined || scale === undefined) return;
    let live = true;
    bakeCover(genre, { w, h, scale }).then((image) => {
      if (live) setResult({ key, image });
    });
    return () => {
      live = false;
    };
  }, [key, genre, w, h, scale]);

  if (key === null) return null;
  return done.get(key) ?? (result.key === key ? result.image : null);
}
