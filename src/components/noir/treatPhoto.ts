// Mode photo treatment (docs/DESIGN.md, Modes · Photo treatment). Each photo
// is baked once per mode, never per frame: decoded, drawn on an offscreen
// Skia surface at its own size (at most ref.treatment.maxEdge on the long
// edge) through the mode's colour matrix over its toe, then paranormal's
// glow, the grain and the vignette (modeThemes[genre].treatment),
// snapshotted and encoded to JPEG. Native writes it to the cache directory,
// where it outlives the session; the web keeps a data: URL in memory.
// Results are cached by (source, mode, size), and bakes run one at a time so
// a screenful of photos never stalls a frame all at once. Pan, zoom and the
// loupe then move an ordinary image, so the treatment costs nothing while
// they run.
//
// Files on disk are named for the recipe (the bake settings and every mode's
// treatment) and, for a photo with no lasting identity, for the launch. The
// first write of each launch deletes every other launch's and recipe's files,
// so the cache directory only holds bakes this build can still use.
//
// Skia is required lazily, inside the bake: on the web its module can only
// be evaluated once CanvasKit has loaded (src/lib/skiaReady.web.ts). Metro
// still bundles it; it just doesn't run before then.
import { useEffect, useState } from "react";
import { AssetRegistry, Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { SkImage } from "@shopify/react-native-skia";
import type { Genre } from "@/lib/puzzle-types";
import { skiaAvailable } from "@/lib/skiaReady";
import { modeThemes, ref, type PhotoTreatment } from "@/theme/tokens";

/** A photo to treat: a bundled asset (require), a uri, or an image source with a uri. */
export type TreatSource = number | string | { uri: string };

export interface TreatOptions {
  /** Bake no larger than this on the long edge (thumbnails); at most ref.treatment.maxEdge. */
  maxEdge?: number;
  /**
   * What identifies the photo when its uri doesn't (a signed URL whose token
   * changes, say a photo id). By default an http(s) uri without its query
   * string, any other uri as it is, or the bundled asset.
   */
  cacheKey?: string;
}

const T = ref.treatment;
const CACHE_DIR = "treated-photos";
// Names this launch's files for photos with no lasting identity, so a later
// build never shows a file baked from a different photo under the same name.
const LAUNCH = Date.now().toString(36);
// Results kept in memory, oldest dropped first. Native ones also stay on disk.
const MEMORY_ENTRIES = 48;

/** FNV-1a over UTF-16 code units, twice with different seeds: a 64-bit hex name. */
function hash(text: string) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 0x01000193) >>> 0;
    b = Math.imul(b ^ text.charCodeAt(i), 0x01000193) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

/** A bundled asset's content hash (Metro's, from the asset registry), or null if it has none. */
function assetHash(asset: number): string | null {
  try {
    const content = AssetRegistry.getAssetByID(asset)?.hash;
    return typeof content === "string" && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}

/**
 * The photo's identity and whether its bake may be kept on disk past this
 * launch. A bundled asset is named by its content hash, so it is baked once
 * and a changed picture gets a new name; one without a hash (its module id
 * can change between builds) lasts this launch only, as do data:, blob: and
 * content: uris (no stable identity).
 */
function sourceIdentity(source: TreatSource, cacheKey?: string): { id: string; durable: boolean } {
  if (cacheKey) return { id: `key:${cacheKey}`, durable: true };
  if (typeof source === "number") {
    const content = assetHash(source);
    return content ? { id: `asset-hash:${content}`, durable: true } : { id: `asset:${source}`, durable: false };
  }
  const uri = typeof source === "string" ? source : source.uri;
  if (/^https?:/i.test(uri)) return { id: uri.replace(/[?#].*$/, ""), durable: true };
  return { id: uri, durable: /^file:/i.test(uri) };
}

function edgeFor(options: TreatOptions) {
  return Math.min(T.maxEdge, Math.max(1, Math.round(options.maxEdge ?? T.maxEdge)));
}

// Everything a bake depends on besides the photo, so changed tokens never reuse an old file.
const RECIPE = hash(JSON.stringify([T, modeThemes.noir.treatment, modeThemes.crime_scene.treatment, modeThemes.paranormal.treatment]));

interface Job {
  key: string;
  durable: boolean;
  source: TreatSource;
  treatment: PhotoTreatment;
  edge: number;
}

function jobFor(source: TreatSource | null | undefined, genre: Genre | null | undefined, options: TreatOptions): Job | null {
  if (source == null || !genre) return null;
  const treatment = modeThemes[genre].treatment;
  if (!treatment) return null;
  const edge = edgeFor(options);
  const { id, durable } = sourceIdentity(source, options.cacheKey);
  return { key: `${RECIPE}|${genre}|${edge}|${id}`, durable, source, treatment, edge };
}

// ---------------------------------------------------------------------------
// Cache and queue
// ---------------------------------------------------------------------------

/** Finished bakes: the treated uri. A failed bake isn't kept, so the photo's next mount tries again. */
const done = new Map<string, string | null>();
const pending = new Map<string, Promise<string | null>>();
let queue: Promise<unknown> = Promise.resolve();

function remember(key: string, uri: string | null) {
  done.delete(key);
  done.set(key, uri);
  while (done.size > MEMORY_ENTRIES) done.delete(done.keys().next().value as string);
}

/** One bake at a time, each after a turn of the event loop. */
function enqueue<R>(task: () => Promise<R>): Promise<R> {
  const run = queue.then(() => new Promise<void>((resolve) => setTimeout(resolve, 0))).then(task);
  queue = run.catch(() => undefined);
  return run;
}

/** `<recipe>-<photo>.jpg`, or `<recipe>-<photo>-<launch>.jpg` for a photo with no lasting identity. */
function cacheFile(job: Job) {
  const name = job.durable ? `${RECIPE}-${hash(job.key)}` : `${RECIPE}-${hash(job.key)}-${LAUNCH}`;
  return new File(new Directory(Paths.cache, CACHE_DIR), `${name}.jpg`);
}

/** A file this launch can still use: this recipe's, and lasting or this launch's. */
const KEEP = new RegExp(`^${RECIPE}-[0-9a-f]{16}(-${LAUNCH})?\\.jpg$`);
let swept = false;

/**
 * Once per launch, before its first write: deletes the files that other
 * launches and recipes left behind. Never fails a bake.
 */
function sweep(dir: Directory) {
  if (swept) return;
  swept = true;
  try {
    for (const entry of dir.list()) {
      if (entry instanceof File && !KEEP.test(entry.name)) entry.delete();
    }
  } catch {
    // A file that can't be listed or deleted stays for the OS to clear.
  }
}

/**
 * The treated photo's uri, baking it first if needed. Resolves null when
 * there is nothing to treat (no mode, the shell, no source), when Skia isn't
 * available (the web before CanvasKit loads, or if it failed), or when the
 * bake fails; callers then show the original.
 */
export function treatPhoto(
  source: TreatSource | null | undefined,
  genre: Genre | null | undefined,
  options: TreatOptions = {},
): Promise<string | null> {
  const job = jobFor(source, genre, options);
  if (!job || !skiaAvailable()) return Promise.resolve(null);
  const known = done.get(job.key);
  if (known !== undefined) return Promise.resolve(known);
  const inFlight = pending.get(job.key);
  if (inFlight) return inFlight;
  const work = enqueue(() => produce(job)).then(
    (uri) => uri,
    () => null,
  ).then((uri) => {
    pending.delete(job.key);
    if (uri !== null) remember(job.key, uri);
    return uri;
  });
  pending.set(job.key, work);
  return work;
}

/** The treated uri if it is already baked; undefined while unknown (not baked, or baking). */
export function peekTreatedPhoto(
  source: TreatSource | null | undefined,
  genre: Genre | null | undefined,
  options: TreatOptions = {},
): string | null | undefined {
  const job = jobFor(source, genre, options);
  return job ? done.get(job.key) : null;
}

/** Forgets every in-memory result and the grain tile, as a new launch would. Files on disk stay. For tests. */
export function clearTreatedPhotos() {
  done.clear();
  pending.clear();
  queue = Promise.resolve();
  grainTile = null;
  swept = false;
}

async function produce(job: Job): Promise<string | null> {
  const native = Platform.OS !== "web";
  if (native && job.durable) {
    const file = cacheFile(job);
    if (file.exists) return file.uri;
  }
  const baked = await bake(job, native ? "bytes" : "base64");
  if (baked === null) return null;
  if (typeof baked === "string") return `data:image/jpeg;base64,${baked}`;
  const dir = new Directory(Paths.cache, CACHE_DIR);
  dir.create({ intermediates: true, idempotent: true });
  sweep(dir);
  const file = cacheFile(job);
  await file.write(baked);
  return file.uri;
}

// ---------------------------------------------------------------------------
// The bake
// ---------------------------------------------------------------------------

type Skia = typeof import("@shopify/react-native-skia");

// The grain tile is the same for every photo and mode: made once.
let grainTile: SkImage | null = null;

function makeGrainTile(S: Skia): SkImage | null {
  const { tile, frequency, octaves, seed, stretch } = T.grain;
  const surface = S.Skia.Surface.Make(tile, tile);
  if (!surface) return null;
  const paint = S.Skia.Paint();
  paint.setShader(S.Skia.Shader.MakeFractalNoise(frequency, frequency, octaves, seed, tile, tile));
  // Grey from the noise's red channel, stretched about mid-grey, opaque.
  const k = stretch;
  const bias = 0.5 - 0.5 * k;
  paint.setColorFilter(S.Skia.ColorFilter.MakeMatrix([k, 0, 0, 0, bias, k, 0, 0, 0, bias, k, 0, 0, 0, bias, 0, 0, 0, 0, 1]));
  surface.getCanvas().drawPaint(paint);
  surface.flush();
  const image = surface.makeImageSnapshot();
  surface.dispose();
  return image;
}

/** The Skia module, evaluated on first use (see the header: not before CanvasKit on the web). */
function skia(): Skia {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@shopify/react-native-skia") as Skia;
}

async function bake(job: Job, output: "bytes" | "base64"): Promise<Uint8Array | string | null> {
  const S = skia();
  const { Skia, BlendMode, FilterMode, ImageFormat, MipmapMode, TileMode } = S;
  const input = typeof job.source === "object" ? job.source.uri : job.source;
  const photo = await S.loadData(input, (data) => Skia.Image.MakeImageFromEncoded(data));
  if (!photo) return null;
  const disposables: { dispose(): void }[] = [photo];
  try {
    const scale = Math.min(1, job.edge / Math.max(photo.width(), photo.height()));
    const w = Math.max(1, Math.round(photo.width() * scale));
    const h = Math.max(1, Math.round(photo.height() * scale));
    const surface = Skia.Surface.Make(w, h);
    if (!surface) return null;
    disposables.push(surface);
    const canvas = surface.getCanvas();
    const from = Skia.XYWHRect(0, 0, photo.width(), photo.height());
    const to = Skia.XYWHRect(0, 0, w, h);
    const mipmap = scale < 1 ? MipmapMode.Linear : MipmapMode.None;
    const { matrix, toe, grain, vignette, bloom } = job.treatment;

    // 1. The photo through the mode's colour matrix, over its toe: each
    // channel keeps the brighter of the two, so the shadows never clip.
    if (toe) {
      const floor = Skia.Paint();
      floor.setColorFilter(Skia.ColorFilter.MakeMatrix([...toe]));
      canvas.drawImageRectOptions(photo, from, to, FilterMode.Linear, mipmap, floor);
    }
    const base = Skia.Paint();
    base.setColorFilter(Skia.ColorFilter.MakeMatrix([...matrix]));
    if (toe) base.setBlendMode(BlendMode.Lighten);
    canvas.drawImageRectOptions(photo, from, to, FilterMode.Linear, mipmap, base);

    // 2. Paranormal's glow: the graded photo, small and blurred, screened back over it.
    if (bloom > 0) {
      const gw = Math.max(1, Math.round(w * T.bloom.scale));
      const gh = Math.max(1, Math.round(h * T.bloom.scale));
      const small = Skia.Surface.Make(gw, gh);
      if (small) {
        disposables.push(small);
        surface.flush();
        const graded = surface.makeImageSnapshot();
        disposables.push(graded);
        const blur = Skia.Paint();
        const sigma = Math.max(w, h) * T.bloom.sigma * T.bloom.scale;
        blur.setImageFilter(Skia.ImageFilter.MakeBlur(sigma, sigma, TileMode.Clamp, null));
        small.getCanvas().drawImageRectOptions(graded, to, Skia.XYWHRect(0, 0, gw, gh), FilterMode.Linear, MipmapMode.Linear, blur);
        small.flush();
        const glow = small.makeImageSnapshot();
        disposables.push(glow);
        const screen = Skia.Paint();
        screen.setBlendMode(BlendMode.Screen);
        screen.setAlphaf(bloom);
        canvas.drawImageRectOptions(glow, Skia.XYWHRect(0, 0, gw, gh), to, FilterMode.Linear, MipmapMode.None, screen);
      }
    }

    // 3. Grain, overlaid at full size.
    if (grain > 0) {
      grainTile ??= makeGrainTile(S);
      if (grainTile) {
        const paint = Skia.Paint();
        paint.setShader(grainTile.makeShaderOptions(TileMode.Repeat, TileMode.Repeat, FilterMode.Nearest, MipmapMode.None));
        paint.setBlendMode(BlendMode.Overlay);
        paint.setAlphaf(grain);
        canvas.drawRect(to, paint);
      }
    }

    // 4. The vignette: clear to `from` of the way to the corners, then black at the mode's strength.
    if (vignette > 0) {
      const paint = Skia.Paint();
      const clear = Skia.Color("rgba(0, 0, 0, 0)");
      paint.setShader(Skia.Shader.MakeRadialGradient(
        { x: w / 2, y: h / 2 },
        Math.hypot(w, h) / 2,
        [clear, clear, Skia.Color(`rgba(0, 0, 0, ${vignette})`)],
        [0, T.vignette.from, 1],
        TileMode.Clamp,
      ));
      canvas.drawRect(to, paint);
    }

    surface.flush();
    const result = surface.makeImageSnapshot();
    disposables.push(result);
    return output === "bytes" ? result.encodeToBytes(ImageFormat.JPEG, T.quality) : result.encodeToBase64(ImageFormat.JPEG, T.quality);
  } finally {
    for (const item of disposables) item.dispose();
  }
}

// ---------------------------------------------------------------------------
// The hook
// ---------------------------------------------------------------------------

/**
 * The photo baked in the mode's treatment: its uri, or null while it bakes,
 * when there is nothing to treat (no mode or the shell) and when the bake
 * failed. Show the original whenever this is null (TreatedImage does).
 * A photo baked before reads back on the first render, with no wait.
 */
export function useTreatedPhoto(
  source: TreatSource | null | undefined,
  genre: Genre | null | undefined,
  options: TreatOptions = {},
): string | null {
  const { maxEdge, cacheKey } = options;
  // The source as a plain value, so a fresh { uri } object each render is the same photo.
  const input = source == null ? null : typeof source === "object" ? source.uri : source;
  const key = jobFor(input, genre, { maxEdge, cacheKey })?.key ?? null;
  const [result, setResult] = useState<{ key: string | null; uri: string | null }>(() => ({ key, uri: key ? done.get(key) ?? null : null }));

  useEffect(() => {
    if (key === null) return;
    let live = true;
    treatPhoto(input, genre, { maxEdge, cacheKey }).then((uri) => {
      if (live) setResult({ key, uri });
    });
    return () => {
      live = false;
    };
  }, [key, input, genre, maxEdge, cacheKey]);

  if (!key) return null;
  return result.key === key ? result.uri : done.get(key) ?? null;
}
