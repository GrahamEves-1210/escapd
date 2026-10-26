// The title and body (docs/DESIGN.md 04, Layout: Title, Body; States: Large
// text): Apple Health's two-weight paragraph in the system font. A bold white
// ref.type.stepTitle over a regular grey (ref.layout.guide.bodyText) ref.type.stepBody, the same 22/28,
// left-aligned in the 317 column (ref.space.reading each side), the title's
// line box 3 above the body's. Bottom-anchored above the button's gap: when
// it grows, it grows upward; when it still doesn't fit, it scrolls while the
// button stays pinned. Hidden copies of every step's text reserve the tallest
// block, so a step whose text wraps to more lines never moves the drawing.
// Inside a mode: the mode's ink and muted ink (src/capture/ui/palette.ts).
import { useState, type ComponentRef, type Ref } from "react";
import { PixelRatio, ScrollView, StyleSheet, Text, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { useCapturePalette } from "@/capture/ui/palette";
import { ref } from "@/theme/tokens";
import { STEPS } from "./copy";
import { FadeLayer, type StepLayer } from "./stepper";

export type TitleRef = ComponentRef<typeof Text>;

function Block({ step, titleRef }: { step: number; titleRef?: Ref<TitleRef> }) {
  const palette = useCapturePalette();
  return (
    <>
      <Text ref={titleRef} accessibilityRole="header" style={[styles.title, { color: palette.ink }]}>
        {STEPS[step].title}
      </Text>
      <Text style={[styles.body, { color: palette.guideBody }]}>{STEPS[step].body}</Text>
    </>
  );
}

export function GuideText({
  layers,
  clock,
  titleRef,
}: {
  layers: readonly StepLayer[];
  clock: SharedValue<number>;
  /** Attached to the current step's title, for focus after a step change. */
  titleRef: Ref<TitleRef>;
}) {
  const [heights, setHeights] = useState<readonly number[]>([]);
  const reserve = heights.reduce((max, h) => Math.max(max, h), 0);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  // Scrolls only when large text overflows. Android makes a scroll-enabled
  // ScrollView a keyboard and D-pad focus stop, and focus goes Close -> button.
  const overflows = PixelRatio.roundToNearestPixel(content) > PixelRatio.roundToNearestPixel(viewport);
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { minHeight: reserve }]}
      scrollEnabled={overflows}
      onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
      onContentSizeChange={(_, height) => setContent(height)}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      testID="guide-text"
    >
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.sizers}>
        {STEPS.map((_, step) => (
          <View
            key={step}
            style={styles.layer}
            onLayout={(e) => {
              const height = e.nativeEvent.layout.height;
              setHeights((prev) => {
                if (prev[step] === height) return prev;
                const next = [...prev];
                next[step] = height;
                return next;
              });
            }}
          >
            <Block step={step} />
          </View>
        ))}
      </View>
      {layers.map((layer) => (
        <FadeLayer key={layer.step} clock={clock} layer={layer} style={[styles.layer, layer.leftAt !== null && styles.leaving]}>
          <Block step={layer.step} titleRef={layer.leftAt === null ? titleRef : undefined} />
        </FadeLayer>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Sizes to its content; shrinks (and scrolls) only when large text leaves no room.
  scroll: { flexGrow: 0, flexShrink: 1 },
  content: { justifyContent: "flex-end" },
  // x 38-355 on the base device: the reference's reading column.
  layer: { paddingHorizontal: ref.space.reading },
  // A leaving block keeps its bottom edge where it was while the next fades in.
  leaving: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sizers: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
  title: { ...ref.type.stepTitle },
  body: { ...ref.type.stepBody, marginTop: ref.layout.guide.titleGap },
});
