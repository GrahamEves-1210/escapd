// A mode photo (docs/DESIGN.md, Modes · Photo treatment): everywhere a photo
// shows inside a mode (the /play pager and loupe, review tiles, the build
// wait strip, the camera's last photo, home's mode cards). The original shows
// until its baked treatment is ready, then the treatment fades in over it on
// ref.motion.treatment; under reduced motion it is simply there. Once the
// treatment covers it, the original unmounts, so a settled photo is one
// decoded image and one layer to move. A photo baked before this mounted
// shows straight away, with no original under it.
// original={true} fades the treatment away to the original (paranormal's case
// closed), waiting for the original to load first so the photo never blinks;
// back to false fades it in again.
//
// The frame (`style`) sizes and places the photo and clips both layers to
// its corners; accessibility props go on the frame. Both images are hidden
// from accessibility.
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { Image, type ImageLoadEventData, type ImageProps } from "expo-image";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import type { Genre } from "@/lib/puzzle-types";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { timingFor } from "./motion";
import { useTreatedPhoto, type TreatSource } from "./treatPhoto";

const FADE = timingFor(ref.motion.treatment);

export interface TreatedImageProps
  extends Pick<
      ViewProps,
      | "testID"
      | "pointerEvents"
      | "accessible"
      | "accessibilityLabel"
      | "accessibilityHint"
      | "accessibilityRole"
      | "accessibilityElementsHidden"
      | "importantForAccessibility"
    >,
    Pick<ImageProps, "contentFit" | "contentPosition" | "onError" | "priority" | "cachePolicy" | "recyclingKey" | "allowDownscaling"> {
  /** The photo: a bundled asset, a uri, or { uri }. */
  source: TreatSource;
  /** The mode whose treatment to bake; null shows the photo as it is (the shell). */
  genre: Genre | null;
  /** True fades the treatment away to the untreated photo (paranormal's snap to full colour). Default false. */
  original?: boolean;
  /** Bake no larger than this on the long edge (thumbnails). */
  maxEdge?: number;
  /** A stable id for the photo when its uri changes (a signed URL). */
  cacheKey?: string;
  /** The frame: size, place, corners. */
  style?: StyleProp<ViewStyle>;
  /** Once per photo, when its first layer loads. Its source size is the original's or the baked copy's: the same aspect. */
  onLoad?: (event: ImageLoadEventData) => void;
}

export function TreatedImage({
  source,
  genre,
  original: showOriginal = false,
  maxEdge,
  cacheKey,
  style,
  contentFit = "cover",
  contentPosition,
  onError,
  onLoad,
  priority,
  cachePolicy,
  recyclingKey,
  allowDownscaling,
  ...frame
}: TreatedImageProps) {
  const { reducedMotion } = useTheme();
  const uri = useTreatedPhoto(source, genre, { maxEdge, cacheKey });
  const treated = !showOriginal;
  const base = typeof source === "string" ? { uri: source } : source;

  // Baked before this frame mounted: shown with no fade and no original underneath.
  const [mountUri] = useState(uri);
  const instant = uri !== null && uri === mountUri;
  // The baked uri the top layer has loaded, or failed to load.
  const [topLoaded, setTopLoaded] = useState<string | null>(null);
  const [topFailed, setTopFailed] = useState<string | null>(null);
  // The baked uri whose fade-in has finished: the original under it unmounts.
  const [settled, setSettled] = useState<string | null>(null);
  const covered = instant || (uri !== null && settled === uri);
  const [lastTreated, setLastTreated] = useState(treated);
  if (treated !== lastTreated) {
    setLastTreated(treated);
    if (!treated) setSettled(null);
  }
  // The photo whose first load onLoad has reported: once per photo, not per layer.
  const sourceId = typeof source === "object" ? source.uri : source;
  const reported = useRef<string | number | null>(null);

  const wanted = treated && uri !== null && topFailed !== uri;
  const showTop = wanted && topLoaded === uri;
  const baseMounted = !(wanted && covered);
  // The photo the original underneath has loaded. An original that isn't
  // mounted isn't loaded: when the treatment goes from a covered photo, the
  // original mounts afresh and has to load before the treatment fades off it.
  const [baseLoaded, setBaseLoaded] = useState<string | number | null>(null);
  if (!baseMounted && baseLoaded !== null) setBaseLoaded(null);
  const baseReady = baseMounted && baseLoaded === sourceId;

  const opacity = useSharedValue(instant && treated ? 1 : 0);
  // Fading in; once it is over the original, the original goes.
  useEffect(() => {
    if (!showTop) return;
    if (instant) {
      opacity.set(1);
      return;
    }
    const top = uri;
    if (reducedMotion) {
      // At once; the original goes a frame later, once the treatment is drawn over it.
      opacity.set(1);
      const frame = requestAnimationFrame(() => setSettled(top));
      return () => cancelAnimationFrame(frame);
    }
    opacity.set(
      withTiming(1, FADE, (finished) => {
        if (finished) scheduleOnRN(setSettled, top);
      }),
    );
  }, [showTop, reducedMotion, instant, opacity, uri]);

  // Fading away: only once the original is there underneath.
  useEffect(() => {
    if (!showTop && baseReady) opacity.set(reducedMotion ? 0 : withTiming(0, FADE));
  }, [showTop, baseReady, reducedMotion, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const loaded = (event: ImageLoadEventData) => {
    if (reported.current === sourceId) return;
    reported.current = sourceId;
    onLoad?.(event);
  };

  return (
    <View style={[styles.frame, style]} {...frame}>
      {baseMounted ? (
        <Image
          source={base}
          style={StyleSheet.absoluteFill}
          contentFit={contentFit}
          contentPosition={contentPosition}
          priority={priority}
          cachePolicy={cachePolicy}
          recyclingKey={recyclingKey}
          allowDownscaling={allowDownscaling}
          transition={0}
          accessible={false}
          onLoad={(event) => {
            setBaseLoaded(sourceId);
            loaded(event);
          }}
          onError={onError}
          testID={frame.testID ? `${frame.testID}-original` : undefined}
        />
      ) : null}
      {uri !== null ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fade]}>
          <Image
            source={{ uri }}
            style={StyleSheet.absoluteFill}
            contentFit={contentFit}
            contentPosition={contentPosition}
            priority={priority}
            allowDownscaling={allowDownscaling}
            transition={0}
            accessible={false}
            onLoad={(event) => {
              setTopLoaded(uri);
              loaded(event);
            }}
            onError={() => setTopFailed(uri)}
            testID={frame.testID ? `${frame.testID}-treated` : undefined}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: "hidden" },
});
