// Resolves each entry of photos[] to an image source: a bundled file for
// `asset_key`, or a short-lived signed URL for `photo_id` that is refreshed
// before it expires.
import { useEffect, useState } from "react";
import { getRoomPhotos, signedPhotoUrl } from "@/lib/escapd-api";
import type { SceneSource } from "@/render/SceneView";
import { bundledScene } from "@/render/bundledScenes";

// Signed URLs last 15 minutes; refresh with margin.
const REFRESH_MS = 12 * 60 * 1000;

/** One photo of a room: an uploaded one (`photo_id`) or a bundled one (`asset_key`). */
export type ScenePhoto = { photo_id: string } | { asset_key: string };

export type SceneSources =
  | { kind: "loading" }
  | { kind: "ready"; sources: SceneSource[] }
  | { kind: "error"; reason: "missing_asset" | "load_failed" };

/** Any room definition with photos (v1, or v2's stored rooms). Keep it stable across renders: a new object resolves again. */
export function useSceneSources(roomId: string, definition: { photos: readonly ScenePhoto[] } | null): SceneSources {
  const [result, setResult] = useState<SceneSources>({ kind: "loading" });

  useEffect(() => {
    if (!definition) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const photos = definition.photos;

    const resolve = async () => {
      const needsSigning = photos.some((p) => "photo_id" in p);
      try {
        const paths = needsSigning
          ? new Map((await getRoomPhotos(roomId)).map((row) => [row.id, row.storage_path]))
          : new Map<string, string>();
        const sources = await Promise.all(photos.map(async (p): Promise<SceneSource | null> => {
          if ("asset_key" in p) return bundledScene(p.asset_key) ?? null;
          const path = paths.get(p.photo_id);
          return path ? { uri: await signedPhotoUrl(path) } : null;
        }));
        if (cancelled) return;
        if (sources.some((s) => s === null)) {
          setResult({ kind: "error", reason: "missing_asset" });
          return;
        }
        setResult({ kind: "ready", sources: sources as SceneSource[] });
        if (needsSigning) timer = setTimeout(resolve, REFRESH_MS);
      } catch {
        if (!cancelled) setResult({ kind: "error", reason: "load_failed" });
      }
    };

    resolve();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [roomId, definition]);

  return result;
}
