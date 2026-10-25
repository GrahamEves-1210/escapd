// The title and body (docs/DESIGN.md 04, Layout: Title, Body; States: Large
// text, Narrow screen): the light table's heading pattern, a Playfair
// narrativeTitle over a Jakarta body in the secondary tone. Bottom-anchored
// above the 62 gap: when it grows, it grows upward; when it still doesn't
// fit, it scrolls while the button stays pinned. Hidden copies of every
// step's text reserve the tallest block, so a step whose text wraps to more
// lines never moves the mount above.
import { useState, type Ref } from "react";
import { PixelRatio, ScrollView, StyleSheet, View } from "react-native";
import type { SharedValue } from "react-native-reanimated";
import { Text, type TextRef } from "@/components/Text";
import { space } from "@/theme/tokens";
import { STEPS } from "./copy";
import { FadeLayer, type StepLayer } from "./stepper";

function Block({ step, titleRef }: { step: number; titleRef?: Ref<TextRef> }) {
  return (
    <>
      <Text ref={titleRef} variant="narrativeTitle" accessibilityRole="header">
        {STEPS[step].title}
      </Text>
      <Text variant="body" tone="secondary" style={styles.body}>
        {STEPS[step].body}
      </Text>
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
  titleRef: Ref<TextRef>;
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
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.sizers}
      >
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
  // x 20, max width 353 on the base device: the light table's gutter.
  layer: { paddingHorizontal: space.gutter },
  // A leaving block keeps its bottom edge where it was while the next fades in.
  leaving: { position: "absolute", left: 0, right: 0, bottom: 0 },
  sizers: { position: "absolute", top: 0, left: 0, right: 0, opacity: 0 },
  body: { marginTop: space.xs },
});
