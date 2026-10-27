// Bakes the room's taken-object patch (docs/DESIGN.md, Game feel · 4a):
// once per room and mode, after the scene is up, in idle moments. It reads
// the candidates' regions from the treated photos (the same bake the stage
// shows, so the fill matches what the player sees), lets the chooser pick
// one (src/game/removal.ts), fills it (src/game/inpaint.ts) and encodes the
// patch as a PNG data URI with its feathered alpha, placed by its rect in
// photo fractions. Results stay in memory for the launch, keyed by mode and
// each candidate's photo and box. Anything that fails gives no patch: the
// object then simply stays in the room.
//
// Skia is required lazily, inside the bake, as in treatPhoto.ts.
import { useEffect, useState } from "react";
import type { SkImage } from "@shopify/react-native-skia";
import type { Genre, Id, PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { skiaAvailable } from "@/lib/skiaReady";
import { treatPhoto } from "@/components/noir/treatPhoto";
import { makePatch, type PixelRegion, type Rect } from "@/game/inpaint";
import { chooseRemovable, regionGeometry, removableCandidates, type RegionGeometry } from "@/game/removal";
import type { SceneSource } from "./SceneView";

export interface RemovalPatch {
  hotspotId: Id;
  /** The inspect puzzle whose solve takes the object. */
  puzzleId: Id;
  photoIndex: number;
  /** Where the patch goes, in photo fractions. */
  rect: Rect;
  /** The patch: a PNG data URI with its feathered alpha. */
  uri: string;
}

type Skia = typeof import("@shopify/react-native-skia");

function skia(): Skia {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require("@shopify/react-native-skia") as Skia;
}

// The longest a step waits for the JS thread to be idle before it goes anyway.
const IDLE_WAIT = 800;

/** The JS thread's next idle moment (at most IDLE_WAIT away), else the next turn of the event loop. */
function idle(): Promise<void> {
  return new Promise((resolve) => {
    const whenIdle = (globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
    if (typeof whenIdle === "function") whenIdle(() => resolve(), { timeout: IDLE_WAIT });
    else setTimeout(resolve, 0);
  });
}

const photoId = (photo: PuzzleDefinitionV1["photos"][number] | undefined) =>
  !photo ? "?" : "photo_id" in photo ? `photo:${photo.photo_id}` : `asset:${photo.asset_key}`;

/** The cache key: the mode and each candidate's photo and box. Null when the room has no candidate. */
export function removalKey(def: PuzzleDefinitionV1 | null | undefined, genre: Genre | null | undefined): string | null {
  if (!def || !genre) return null;
  const candidates = removableCandidates(def);
  if (candidates.length === 0) return null;
  const boxes = candidates.map((h) => {
    const s = h.shape;
    return `${photoId(def.photos[h.photo_index])}#${h.id}@${s.x},${s.y},${s.w},${s.h}`;
  });
  return `${genre}|${boxes.join(";")}`;
}

const done = new Map<string, RemovalPatch | null>();
const pending = new Map<string, Promise<RemovalPatch | null>>();

/** Forgets every patch. For tests. */
export function clearRemovalPatches() {
  done.clear();
  pending.clear();
}

/** The room's patch, baking it first if needed; null when no object qualifies or anything fails. */
export function roomRemoval(def: PuzzleDefinitionV1, sources: readonly SceneSource[], genre: Genre): Promise<RemovalPatch | null> {
  const key = removalKey(def, genre);
  if (!key || !skiaAvailable()) return Promise.resolve(null);
  const known = done.get(key);
  if (known !== undefined) return Promise.resolve(known);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const work = idle()
    .then(() => produce(def, sources, genre))
    .catch(() => null)
    .then((patch) => {
      pending.delete(key);
      done.set(key, patch);
      return patch;
    });
  pending.set(key, work);
  return work;
}

/** A seed from the hotspot id, so a room's grain is the same every time. */
function seedFor(id: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/** The region's pixels (RGBA, unpremultiplied), read off the photo at the region's size. */
function readRegion(S: Skia, photo: SkImage, g: RegionGeometry): Uint8Array | null {
  const { Skia, FilterMode, MipmapMode, ColorType, AlphaType } = S;
  const surface = Skia.Surface.Make(g.width, g.height);
  if (!surface) return null;
  try {
    const mipmap = g.width < g.src.w * 0.5 ? MipmapMode.Linear : MipmapMode.None;
    surface.getCanvas().drawImageRectOptions(
      photo, Skia.XYWHRect(g.src.x, g.src.y, g.src.w, g.src.h), Skia.XYWHRect(0, 0, g.width, g.height),
      FilterMode.Linear, mipmap, Skia.Paint(),
    );
    surface.flush();
    const snapshot = surface.makeImageSnapshot();
    try {
      const pixels = snapshot.readPixels(0, 0, { width: g.width, height: g.height, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
      return pixels instanceof Uint8Array && pixels.length >= g.width * g.height * 4 ? new Uint8Array(pixels.subarray(0, g.width * g.height * 4)) : null;
    } finally {
      snapshot.dispose();
    }
  } finally {
    surface.dispose();
  }
}

async function produce(def: PuzzleDefinitionV1, sources: readonly SceneSource[], genre: Genre): Promise<RemovalPatch | null> {
  const S = skia();
  const candidates = removableCandidates(def);
  const read = new Map<Id, { region: PixelRegion; rect: Rect }>();
  for (const photoIndex of [...new Set(candidates.map((h) => h.photo_index))]) {
    const source = sources[photoIndex];
    if (source === undefined) continue;
    const photo = def.photos[photoIndex];
    // The stage's own bake (same key), so this is usually a cache hit.
    const treated = await treatPhoto(source, genre, { cacheKey: photo && "photo_id" in photo ? `photo:${photo.photo_id}` : undefined });
    const input = treated ?? (typeof source === "number" ? source : source.uri);
    const image = await S.loadData(input, (data) => S.Skia.Image.MakeImageFromEncoded(data));
    if (!image) continue;
    try {
      for (const hotspot of candidates) {
        if (hotspot.photo_index !== photoIndex) continue;
        const g = regionGeometry(hotspot.shape, image.width(), image.height());
        const data = readRegion(S, image, g);
        if (data) read.set(hotspot.id, { region: { data, width: g.width, height: g.height, box: g.box }, rect: g.rect });
      }
    } finally {
      image.dispose();
    }
    await idle();
  }

  const choice = chooseRemovable(def, (hotspot) => read.get(hotspot.id)?.region ?? null);
  if (!choice) return null;
  await idle();
  const { width, height } = choice.region;
  const pixels = makePatch(choice.region, seedFor(choice.hotspot.id));
  const image = S.Skia.Image.MakeImage(
    { width, height, colorType: S.ColorType.RGBA_8888, alphaType: S.AlphaType.Unpremul },
    S.Skia.Data.fromBytes(pixels),
    width * 4,
  );
  if (!image) return null;
  try {
    const encoded = image.encodeToBase64(S.ImageFormat.PNG, 100);
    if (!encoded) return null;
    return {
      hotspotId: choice.hotspot.id,
      puzzleId: choice.puzzleId,
      photoIndex: choice.hotspot.photo_index,
      rect: read.get(choice.hotspot.id)!.rect,
      uri: `data:image/png;base64,${encoded}`,
    };
  } finally {
    image.dispose();
  }
}

/** The fill over one known box (gameplay v2's removable object): its rect on the photo and the PNG. */
export interface BoxPatch {
  rect: Rect;
  uri: string;
}

/** Bakes a fill for one box on one photo, as produce() does for the chosen object; null when anything fails. */
async function bakeBox(source: SceneSource, genre: Genre, cacheKey: string | undefined, box: Rect, seedId: string): Promise<BoxPatch | null> {
  const S = skia();
  const treated = await treatPhoto(source, genre, { cacheKey });
  const input = treated ?? (typeof source === "number" ? source : source.uri);
  const photo = await S.loadData(input, (data) => S.Skia.Image.MakeImageFromEncoded(data));
  if (!photo) return null;
  let region: PixelRegion;
  let rect: Rect;
  try {
    const g = regionGeometry(box, photo.width(), photo.height());
    const data = readRegion(S, photo, g);
    if (!data) return null;
    region = { data, width: g.width, height: g.height, box: g.box };
    rect = g.rect;
  } finally {
    photo.dispose();
  }
  await idle();
  const pixels = makePatch(region, seedFor(seedId));
  const image = S.Skia.Image.MakeImage(
    { width: region.width, height: region.height, colorType: S.ColorType.RGBA_8888, alphaType: S.AlphaType.Unpremul },
    S.Skia.Data.fromBytes(pixels),
    region.width * 4,
  );
  if (!image) return null;
  try {
    const encoded = image.encodeToBase64(S.ImageFormat.PNG, 100);
    return encoded ? { rect, uri: `data:image/png;base64,${encoded}` } : null;
  } finally {
    image.dispose();
  }
}

const boxDone = new Map<string, BoxPatch | null>();

/**
 * Gameplay v2: the fill for the room's removable object, baked in idle
 * moments once the photo is up (the object is known, no chooser). Null until
 * then, and for good when there is none or the bake fails.
 */
export function useBoxPatch(
  target: { id: string; source: SceneSource; cacheKey?: string; box: Rect } | null,
  genre: Genre | null | undefined,
): BoxPatch | null {
  const key = target && genre ? `${genre}|${target.cacheKey ?? target.id}|${target.box.x},${target.box.y},${target.box.w},${target.box.h}` : null;
  const [patch, setPatch] = useState<BoxPatch | null>(() => (key ? boxDone.get(key) ?? null : null));
  useEffect(() => {
    if (!key || !target || !genre || !skiaAvailable()) return;
    const known = boxDone.get(key);
    if (known !== undefined) {
      setPatch(known);
      return;
    }
    let live = true;
    idle()
      .then(() => bakeBox(target.source, genre, target.cacheKey, target.box, target.id))
      .catch(() => null)
      .then((p) => {
        boxDone.set(key, p);
        if (live) setPatch(p);
      });
    return () => {
      live = false;
    };
    // The key holds everything the bake reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return key ? patch : null;
}

/**
 * The room's taken-object patch once it is baked; null until then, and for
 * good when no object qualifies, there is no mode, or the bake fails.
 */
export function useRoomRemoval(def: PuzzleDefinitionV1 | null | undefined, sources: readonly SceneSource[], genre: Genre | null | undefined): RemovalPatch | null {
  const key = removalKey(def, genre);
  const [result, setResult] = useState<{ key: string | null; patch: RemovalPatch | null }>(() => ({ key, patch: key ? done.get(key) ?? null : null }));
  useEffect(() => {
    if (!key || !def || !genre) return;
    let live = true;
    roomRemoval(def, sources, genre).then((patch) => {
      if (live && patch) setResult({ key, patch });
    });
    return () => {
      live = false;
    };
  }, [key, def, sources, genre]);
  if (!key) return null;
  return result.key === key ? result.patch : done.get(key) ?? null;
}
