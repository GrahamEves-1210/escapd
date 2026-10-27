// The close-up (gameplay v2 §2 "Inspect"): a vignetted crop of the real photo
// around the object, settling in slowly, with the object's mechanism under it
// (mechanisms/). What looking turned up shows here too: a found card on paper,
// an item that came out. Held items can be tried on the object from the strip
// at the foot ("Use"). Opens over the room; Close (or Android back) returns.
import { useEffect, useMemo, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Canvas, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import type { FinaleDef, ItemDef, Rect as Box, StateValue } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { V2 } from "./layout";
import { Mechanism } from "./mechanisms";
import type { MechanismTarget } from "./mechanisms/types";

export interface FoundCard {
  id: string;
  title: string;
  text: string;
}

export interface InspectViewProps {
  target: MechanismTarget;
  /** The photo and the object's box on it; absent for a held item (no crop: the item on the dark ground). */
  photo?: { source: SceneSource; cacheKey?: string; box: Box; aspect: number };
  genre: Genre;
  state: Record<string, StateValue>;
  /** Cards this look turned up, newest last. */
  cards: FoundCard[];
  /** A line under the title: what changed ("It's locked.", "Something slid out."). */
  note: string | null;
  held: ItemDef[];
  busy: boolean;
  cooldown: number;
  finale?: FinaleDef;
  ritualChoices?: { id: string; label: string }[];
  onSet: (control: string, value: StateValue) => void;
  onSubmit: (value: string[]) => void;
  onUse: (itemId: string) => void;
  /** A small object the player can pocket: "Take it" (it leaves the photo). */
  onTake?: () => void;
  onClose: () => void;
  /** Bumped after every action: the mechanism redraws from the engine's state (a refused pull falls back). */
  revision: number;
}

/** The crop (photo fractions) around a box: grown, at least `min` of the photo, at the view's aspect, kept inside the photo. */
export function cropAround(box: Box, photoAspect: number, viewAspect: number): Box {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Work in photo-height units so the crop keeps the view's aspect on the real image.
  let w = Math.max(box.w * V2.inspect.grow, V2.inspect.min);
  let h = Math.max(box.h * V2.inspect.grow, V2.inspect.min);
  // aspect of crop in pixels = (w * photoAspect) / h; match viewAspect by growing one side.
  if ((w * photoAspect) / h < viewAspect) w = (h * viewAspect) / photoAspect;
  else h = (w * photoAspect) / viewAspect;
  if (w > 1) { h /= w; w = 1; }
  if (h > 1) { w /= h; h = 1; }
  const x = Math.min(1 - w, Math.max(0, cx - w / 2));
  const y = Math.min(1 - h, Math.max(0, cy - h / 2));
  return { x, y, w, h };
}

export function InspectView(props: InspectViewProps) {
  const { target, photo, genre, state, cards, note, held, busy, cooldown, finale, ritualChoices, onSet, onSubmit, onUse, onTake, onClose, revision } = props;
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cropW = width - ref.space.lg * 2;
  const cropH = Math.min(cropW * 0.8, height * 0.38);
  const crop = useMemo(() => (photo ? cropAround(photo.box, photo.aspect, cropW / cropH) : null), [photo, cropW, cropH]);

  const settle = useSharedValue(reducedMotion ? 1 : V2.inspect.settleFrom);
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.set(withTiming(1, { duration: reducedMotion ? 120 : 240 }));
    if (!reducedMotion) settle.set(withTiming(1, { duration: V2.inspect.settleMs, easing: Easing.out(Easing.cubic) }));
  }, [fade, settle, reducedMotion]);
  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.get() }));
  const imageStyle = useAnimatedStyle(() => ({ transform: [{ scale: settle.get() }] }));

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  // The image drawn so the crop fills the frame.
  const imgW = crop ? cropW / crop.w : 0;
  const imgH = crop ? cropH / crop.h : 0;
  const [usedOpen, setUsedOpen] = useState(false);

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.ground, paddingTop: insets.top + ref.space.sm, paddingBottom: insets.bottom + ref.space.sm }, rootStyle]} testID="v2-inspect">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[ref.type.serifTitle, { color: theme.ink }]} accessibilityRole="header" numberOfLines={1}>{capitalise(target.label)}</Text>
          {note ? <Text style={[ref.type.meta, { color: theme.inkMuted }]} testID="v2-inspect-note">{note}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} testID="v2-inspect-close" style={[styles.close, { backgroundColor: theme.raised }]}>
          <Text style={[ref.type.headline, { color: theme.ink }]}>×</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {photo && crop ? (
          <View style={[styles.crop, { width: cropW, height: cropH, borderColor: theme.rim }]}>
            <Animated.View style={[{ width: cropW, height: cropH }, imageStyle]}>
              <TreatedImage
                source={photo.source}
                genre={genre}
                cacheKey={photo.cacheKey}
                contentFit="fill"
                accessible={false}
                style={{ position: "absolute", width: imgW, height: imgH, left: -crop.x * imgW, top: -crop.y * imgH }}
              />
            </Animated.View>
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              <Rect x={0} y={0} width={cropW} height={cropH}>
                <RadialGradient c={vec(cropW / 2, cropH / 2)} r={Math.max(cropW, cropH) * 0.75} colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.75)"]} positions={[0, 0.55, 1]} />
              </Rect>
            </Canvas>
          </View>
        ) : null}

        <View style={styles.mechanism}>
          <Mechanism
            key={revision}
            target={target}
            state={state}
            onSet={onSet}
            onSubmit={onSubmit}
            busy={busy}
            cooldown={cooldown}
            finale={finale}
            ritualChoices={ritualChoices}
            width={cropW}
          />
        </View>

        {onTake ? (
          <Pressable
            onPress={onTake}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Take it"
            testID="v2-take"
            style={[styles.chip, { backgroundColor: theme.accent, borderColor: theme.rim, alignSelf: "center" }]}
          >
            <Text style={[ref.type.headline, { color: theme.accentInk }]}>Take it</Text>
          </Pressable>
        ) : null}

        {cards.map((c) => (
          <View key={c.id} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.rim }]} testID={`v2-card-${c.id}`}>
            <Text style={[ref.type.headline, { color: theme.ink }]}>{c.title}</Text>
            <Text style={[ref.type.body, { color: theme.inkMuted }]}>{c.text}</Text>
          </View>
        ))}
      </ScrollView>

      {held.length && target.kind === "object" ? (
        <View style={styles.use}>
          {usedOpen ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.useRow}>
              {held.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setUsedOpen(false);
                    onUse(item.id);
                  }}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${item.name}`}
                  testID={`v2-use-${item.id}`}
                  style={[styles.chip, { backgroundColor: theme.raised, borderColor: theme.rim }]}
                >
                  <Text style={[ref.type.body, { color: theme.ink }]}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <Pressable
              onPress={() => setUsedOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Use something you're holding"
              testID="v2-use"
              style={[styles.chip, { backgroundColor: theme.raised, borderColor: theme.rim, alignSelf: "center" }]}
            >
              <Text style={[ref.type.body, { color: theme.ink }]}>Use something you're holding</Text>
            </Pressable>
          )}
        </View>
      ) : null}
    </Animated.View>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 50 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: ref.space.lg, gap: ref.space.sm, marginBottom: ref.space.sm },
  headerText: { flex: 1, gap: 2 },
  close: { width: ref.hit.min, height: ref.hit.min, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: ref.space.lg, gap: ref.space.lg, paddingBottom: ref.space.lg },
  crop: { borderRadius: V2.inspect.cropRadius, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  mechanism: { alignItems: "center" },
  card: { borderRadius: ref.radius.sheet, borderWidth: StyleSheet.hairlineWidth, padding: ref.space.lg, gap: ref.space.xs },
  use: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm },
  useRow: { gap: ref.space.sm },
  chip: { minHeight: ref.hit.min, paddingHorizontal: ref.space.lg, borderRadius: ref.hit.min / 2, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
});
