// The objects' real outlines on a photo: the glint hugs each object's shape.
// A room generated with segmentation carries each object's outline (Gemini's
// mask, traced on the server: supabase/functions/_shared/v2/segment.ts); for
// an object without one (older rooms, or a mask that failed), it is traced on
// the device (src/game/outline.ts) in idle moments once the photo is up. Kept
// for the launch, keyed by the photo and the box. An object whose shape can't
// be found (or any failure) keeps the faint oval.
import { useEffect, useState } from "react";
import type { Rect as Box } from "@/engine/v2";
import { traceOutline, type Point } from "@/game/outline";
import { regionGeometry } from "@/game/removal";
import { skiaAvailable } from "@/lib/skiaReady";
import { idle, readRegion, skia } from "@/render/removalPatch";
import type { SceneSource } from "@/render/SceneView";

/** Traced at this size at most (the region's long edge, px): enough for a smooth edge, quick to work. */
const TRACE_EDGE = 180;

const traced = new Map<string, Point[] | null>();
const keyOf = (photo: string, id: string, b: Box) => `${photo}|${id}|${b.x.toFixed(4)},${b.y.toFixed(4)},${b.w.toFixed(4)},${b.h.toFixed(4)}`;

/** Outlines in photo fractions, by object id; an object missing from it has none (yet). */
export function useOutlines(
  source: SceneSource | null,
  cacheKey: string | undefined,
  objects: { id: string; box: Box; outline?: Point[] }[],
): Record<string, Point[]> {
  const photo = cacheKey ?? (source == null ? "" : typeof source === "number" ? `asset:${source}` : source.uri);
  // Only objects without a stored outline are traced.
  const given = objects.filter((o) => o.outline && o.outline.length >= 3);
  const wanted = objects.filter((o) => !given.includes(o)).map((o) => ({ ...o, key: keyOf(photo, o.id, o.box) }));
  const signature = wanted.map((w) => w.key).join(";");
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (source == null || !skiaAvailable()) return;
    const todo = wanted.filter((w) => !traced.has(w.key));
    if (!todo.length) return;
    let live = true;
    (async () => {
      try {
        await idle();
        const S = skia();
        const input = typeof source === "number" ? source : source.uri;
        const image = await S.loadData(input, (data) => S.Skia.Image.MakeImageFromEncoded(data));
        if (!image) return;
        try {
          for (const w of todo) {
            if (!live) return;
            const g = regionGeometry(w.box, image.width(), image.height(), TRACE_EDGE);
            const data = readRegion(S, image, g);
            const pts = data ? traceOutline({ data, width: g.width, height: g.height, box: g.box }) : null;
            // Back into photo fractions.
            traced.set(w.key, pts ? pts.map((p) => ({ x: g.rect.x + (p.x / g.width) * g.rect.w, y: g.rect.y + (p.y / g.height) * g.rect.h })) : null);
            await idle();
          }
        } finally {
          image.dispose();
        }
        if (live) setVersion((v) => v + 1);
      } catch {
        for (const w of todo) if (!traced.has(w.key)) traced.set(w.key, null);
      }
    })();
    return () => {
      live = false;
    };
    // The signature holds every object's photo, id and box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, source]);

  const out: Record<string, Point[]> = {};
  for (const o of given) out[o.id] = o.outline!;
  for (const w of wanted) {
    const pts = traced.get(w.key);
    if (pts) out[w.id] = pts;
  }
  return out;
}
