// Turning to another photo shows it at once: the photo in view and the ones
// either side of it are kept loaded and decoded, mounted out of sight at the
// size the room is drawn (Neighbours: so a turn back and forth never lets go
// of one), the rest of the room's photos are
// fetched into the image cache as soon as the room opens, and every photo's
// shape is remembered the first time any of them loads (rememberAspect), so a
// Stage turned to lays its frame out on its first render instead of loading
// the photo once to measure it. Nothing here is seen or heard.
import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { aspectOf } from "@/render/geometry";
import { bundledAspect, type SceneSource } from "@/render/SceneView";

/** The cache a room's photos are kept in: in memory as well as on disk, so a turn never waits on decoding. */
export const PHOTO_CACHE = "memory-disk" as const;

const aspects = new Map<string, number>();
const keyOf = (source: SceneSource, cacheKey?: string) => cacheKey ?? (typeof source === "number" ? `asset:${source}` : source.uri);

/** A photo's shape (width over height), once anything has loaded it. */
export function knownAspect(source: SceneSource, cacheKey?: string): number | null {
  return aspects.get(keyOf(source, cacheKey)) ?? bundledAspect(source);
}

export function rememberAspect(source: SceneSource, cacheKey: string | undefined, width: unknown, height: unknown): number | null {
  const a = aspectOf(width, height);
  if (a !== null) aspects.set(keyOf(source, cacheKey), a);
  return a;
}

/** The views either side of `view` in a room of `count` (one each way; none for a single photo). */
export function neighbourViews(view: number, count: number): number[] {
  if (count < 2) return [];
  const next = (view + 1) % count;
  const prev = (view - 1 + count) % count;
  return next === prev ? [next] : [next, prev];
}

/**
 * The room's other photos, ready before they are turned to: the neighbours
 * mounted out of sight at `size`, everything else prefetched once.
 */
export function Neighbours({ sources, view, keyOf: cacheKeyOf, size }: {
  sources: readonly SceneSource[];
  view: number;
  keyOf: (index: number) => string | undefined;
  /** The size the room's photo is drawn at (the Stage's frame), so what's decoded is what's shown. */
  size: { width: number; height: number } | null;
}) {
  // Every photo of the room into the cache, once (a signed URL renewed is a new one), the neighbours first.
  const fetched = useRef(new Set<string>());
  const uris = sources.map((s) => (typeof s === "number" ? null : s.uri));
  const key = [...neighbourViews(view, sources.length), ...sources.map((_, i) => i)]
    .map((i) => uris[i])
    .filter((u, k, all): u is string => !!u && all.indexOf(u) === k)
    .join("\n");
  useEffect(() => {
    const list = key.split("\n").filter((u) => u && !fetched.current.has(u));
    if (list.length === 0) return;
    list.forEach((u) => fetched.current.add(u));
    Image.prefetch(list, PHOTO_CACHE).catch(() => {});
  }, [key]);

  if (!size || size.width <= 0 || size.height <= 0) return null;
  return (
    <View style={styles.hidden} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="v2-neighbours">
      {[view, ...neighbourViews(view, sources.length)].sort((a, b) => a - b).map((i) => {
        const source = sources[i];
        if (source === undefined) return null;
        const cacheKey = cacheKeyOf(i);
        return (
          <Image
            key={`${i}:${cacheKey ?? ""}`}
            source={source}
            cachePolicy={PHOTO_CACHE}
            contentFit="fill"
            priority="high"
            transition={0}
            accessible={false}
            style={{ position: "absolute", left: 0, top: 0, width: size.width, height: size.height }}
            onLoad={(e) => rememberAspect(source, cacheKey, e.source.width, e.source.height)}
            testID={`v2-neighbour-${i}`}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Out of sight, but laid out and drawn (an image the size of nothing may never be decoded).
  hidden: { ...StyleSheet.absoluteFill, opacity: 0, overflow: "hidden" },
});
