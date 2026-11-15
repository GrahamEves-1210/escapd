// Pieces of the player's own photos, baked once on the device (Skia, offscreen) and kept for the launch:
//   cutout    the thing itself, cut out of the room's photo (in the room's own treatment, so it is the
//             thing she saw there) along its outline, or its box with soft corners, the edge feathered:
//             what she lifts off the floor in a close-up (mechanisms/LiftUnder);
//   snapshot  an old print of a corner of the room round a thing: a crop about its box, sepia, faded and
//             vignetted, the way a drugstore print goes in a drawer (journal/Snapshot).
// Both are PNG/JPEG data URIs with the crop's aspect. Anything that fails gives null, and the caller
// draws its fallback (a rendered sprite; the print from the photo itself, tinted).
import { useEffect, useState } from "react";
import type { Rect } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { skiaAvailable } from "@/lib/skiaReady";
import { treatPhoto } from "@/components/noir/treatPhoto";
import { idle, skia } from "@/render/removalPatch";
import type { SceneSource } from "@/render/SceneView";

export interface Crop {
  source: SceneSource;
  /** What identifies the photo (its photo id): the same key the stage's bake uses. */
  cacheKey?: string;
  /** The thing's box on the photo (fractions). */
  box: Rect;
  /** Its real outline (photo fractions), when the room has one. */
  outline?: { x: number; y: number }[];
}

export type BakeKind = "cutout" | "snapshot";

export interface Baked {
  uri: string;
  /** Width over height of the baked piece. */
  aspect: number;
  /** cutout: the thing's own box inside the piece (fractions of it), to stand it on its feet. */
  inner: Rect;
}

/** The largest a piece is baked (px, long edge): sharp at its size on a 3x screen. */
const EDGE = { cutout: 480, snapshot: 420 } as const;
/** How far past its box a snapshot looks (of the box, each side): enough of the room round it to know where it is. */
const SNAP_PAD = 0.38;
/** A cutout's margin past its box (each side), so the feathered edge never clips the thing. */
const CUT_PAD = 0.05;

const done = new Map<string, Baked | null>();
const pending = new Map<string, Promise<Baked | null>>();

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function bakeKey(kind: BakeKind, genre: Genre | null, c: Crop): string {
  const src = c.cacheKey ?? (typeof c.source === "number" ? `asset:${c.source}` : c.source.uri.split("?")[0]);
  const b = c.box;
  return `${kind}|${genre ?? "-"}|${src}|${b.x.toFixed(4)},${b.y.toFixed(4)},${b.w.toFixed(4)},${b.h.toFixed(4)}|${c.outline?.length ?? 0}`;
}

/** The crop on the photo, in fractions: the box padded, and for a snapshot squared up toward a print's shape. */
export function cropRect(kind: BakeKind, box: Rect, photoAspect: number): Rect {
  const pad = kind === "snapshot" ? SNAP_PAD : CUT_PAD;
  let w = box.w * (1 + 2 * pad), h = box.h * (1 + 2 * pad);
  if (kind === "snapshot") {
    // A print is between 4:5 and 5:4; in the photo's own pixels.
    const px = (w * photoAspect) / h;
    if (px > 1.25) h = (w * photoAspect) / 1.25;
    else if (px < 0.8) w = (h * 0.8) / photoAspect;
    w = Math.min(1, w);
    h = Math.min(1, h);
  }
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const x = clamp01(Math.min(cx - w / 2, 1 - w)), y = clamp01(Math.min(cy - h / 2, 1 - h));
  return { x, y, w: Math.min(w, 1 - x), h: Math.min(h, 1 - y) };
}

/** Sepia, faded: one luma, toned warm, blacks lifted and whites held down, as an old print goes. */
const SEPIA = (() => {
  const L = [0.2126, 0.7152, 0.0722];
  const tone = [1.07, 0.9, 0.68];
  const contrast = 0.82, lift = 0.1;
  const rows: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) rows.push(L[c] * tone[r] * contrast);
    rows.push(0, lift * tone[r] + 0.02);
  }
  return [...rows, 0, 0, 0, 1, 0];
})();

async function produce(kind: BakeKind, genre: Genre | null, c: Crop): Promise<Baked | null> {
  const S = skia();
  const { Skia, FilterMode, MipmapMode, BlendMode, BlurStyle, TileMode, ImageFormat } = S;
  // A cutout is the thing as it stands in the room (the stage's own bake: usually a cache hit); a snapshot
  // starts from the photo as it was taken.
  const treated = kind === "cutout" && genre ? await treatPhoto(c.source, genre, { cacheKey: c.cacheKey }) : null;
  const input = treated ?? (typeof c.source === "number" ? c.source : c.source.uri);
  const photo = await S.loadData(input, (data) => Skia.Image.MakeImageFromEncoded(data));
  if (!photo) return null;
  try {
    const pw = photo.width(), ph = photo.height();
    const r = cropRect(kind, c.box, pw / ph);
    const sw = r.w * pw, sh = r.h * ph;
    const scale = Math.min(1, EDGE[kind] / Math.max(sw, sh));
    const W = Math.max(8, Math.round(sw * scale)), H = Math.max(8, Math.round(sh * scale));
    const surface = Skia.Surface.Make(W, H);
    if (!surface) return null;
    try {
      const canvas = surface.getCanvas();
      // Where the thing is in the piece (px).
      const bx = ((c.box.x - r.x) / r.w) * W, by = ((c.box.y - r.y) / r.h) * H, bw = (c.box.w / r.w) * W, bh = (c.box.h / r.h) * H;
      const paint = Skia.Paint();
      if (kind === "cutout") {
        // Only the thing: its outline (or its box, corners softened), the edge feathered a little. The mask is
        // laid first, and the photo drawn into it (SrcIn keeps the photo only where the mask is).
        const path = Skia.PathBuilder.Make();
        const pts = c.outline && c.outline.length >= 3 ? c.outline : null;
        if (pts) {
          pts.forEach((p, i) => {
            const x = ((p.x - r.x) / r.w) * W, y = ((p.y - r.y) / r.h) * H;
            if (i === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          });
          path.close();
        } else {
          const inset = Math.min(bw, bh) * 0.05;
          path.addRRect(Skia.RRectXY(Skia.XYWHRect(bx + inset, by + inset, bw - 2 * inset, bh - 2 * inset), Math.min(bw, bh) * 0.18, Math.min(bw, bh) * 0.18));
        }
        const mask = Skia.Paint();
        mask.setColor(Skia.Color("#FFFFFF"));
        mask.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, Math.max(1.2, Math.min(W, H) * (pts ? 0.008 : 0.028)), true));
        canvas.drawPath(path.build(), mask);
        paint.setBlendMode(BlendMode.SrcIn);
      } else {
        paint.setColorFilter(Skia.ColorFilter.MakeMatrix(SEPIA));
      }
      canvas.drawImageRectOptions(photo, Skia.XYWHRect(r.x * pw, r.y * ph, sw, sh), Skia.XYWHRect(0, 0, W, H),
        FilterMode.Linear, sw > W * 2 ? MipmapMode.Linear : MipmapMode.None, paint);
      if (kind === "snapshot") {
        // The print's vignette: the corners darker and browner, the middle as it was.
        const v = Skia.Paint();
        v.setShader(Skia.Shader.MakeRadialGradient(Skia.Point(W / 2, H / 2), Math.hypot(W, H) * 0.62,
          [Skia.Color("rgba(255,255,255,0)"), Skia.Color("rgba(120,86,48,0.28)"), Skia.Color("rgba(52,34,18,0.62)")], [0.45, 0.8, 1], TileMode.Clamp));
        v.setBlendMode(BlendMode.Multiply);
        canvas.drawRect(Skia.XYWHRect(0, 0, W, H), v);
      }
      surface.flush();
      const image = surface.makeImageSnapshot();
      try {
        const encoded = image.encodeToBase64(kind === "cutout" ? ImageFormat.PNG : ImageFormat.JPEG, kind === "cutout" ? 100 : 86);
        if (!encoded) return null;
        return {
          uri: `data:image/${kind === "cutout" ? "png" : "jpeg"};base64,${encoded}`,
          aspect: W / H,
          inner: { x: bx / W, y: by / H, w: bw / W, h: bh / H },
        };
      } finally {
        image.dispose();
      }
    } finally {
      surface.dispose();
    }
  } finally {
    photo.dispose();
  }
}

/** Bakes a piece (or returns the one already baked); null when it can't be. */
export function bake(kind: BakeKind, genre: Genre | null, c: Crop): Promise<Baked | null> {
  if (!skiaAvailable()) return Promise.resolve(null);
  const key = bakeKey(kind, genre, c);
  const known = done.get(key);
  if (known !== undefined) return Promise.resolve(known);
  const inFlight = pending.get(key);
  if (inFlight) return inFlight;
  const work = idle()
    .then(() => produce(kind, genre, c))
    .catch(() => null)
    .then((b) => {
      done.set(key, b);
      pending.delete(key);
      return b;
    });
  pending.set(key, work);
  return work;
}

/** A piece once it is baked: at once when it was baked before (the room warms them as it loads), else when it is. */
export function useBaked(kind: BakeKind, genre: Genre | null, c: Crop | null): Baked | null | undefined {
  const key = c ? bakeKey(kind, genre, c) : null;
  // Bumped when a bake this component waited for lands (the result itself lives in `done`).
  const [, setLanded] = useState(0);
  useEffect(() => {
    if (!key || !c || done.get(key) !== undefined) return;
    let live = true;
    bake(kind, genre, c).then(() => {
      if (live) setLanded((n) => n + 1);
    });
    return () => {
      live = false;
    };
    // The key holds everything the bake reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  // undefined: still baking.
  return key ? done.get(key) : null;
}
