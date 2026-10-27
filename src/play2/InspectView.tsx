// The close-up (gameplay v2 §2 "Inspect"): a vignetted crop of the real photo
// around the object, settling in slowly, with the object's mechanism under it
// (mechanisms/). Nothing scrolls: the crop takes the room the mechanism and
// the tray leave. What the object holds shows physically once it's open: a
// note to tap and read, an item to pick up. Held items are icons along the
// foot to drag onto the object. Close (or Android back) returns to the room.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from "react-native-reanimated";
import { Canvas, RadialGradient, Rect, vec } from "@shopify/react-native-skia";
import { NoteIcon, XIcon } from "phosphor-react-native";
import type { FinaleDef, ItemDef, Rect as Box, StateValue } from "@/engine/v2";
import type { Genre } from "@/lib/puzzle-types";
import { TreatedImage } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import type { SceneSource } from "@/render/SceneView";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { itemIcon } from "./ItemTray";
import { V2 } from "./layout";
import { Mechanism } from "./mechanisms";
import type { MechanismTarget } from "./mechanisms/types";

export interface FoundCard {
  id: string;
  title: string;
  text: string;
}

/** Something the object holds: a note to read, or an item the player hasn't picked up yet. */
export type Content = { kind: "card"; card: FoundCard } | { kind: "item"; item: ItemDef };

export interface InspectViewProps {
  target: MechanismTarget;
  /** The photo and the object's box on it; absent for a held item (no crop: the item on the dark ground). */
  photo?: { source: SceneSource; cacheKey?: string; box: Box; aspect: number };
  genre: Genre;
  state: Record<string, StateValue>;
  /** What it holds (shown once it's open). */
  contents: Content[];
  /** A line under the title: what changed ("It's locked.", "The drawer slides out."). */
  note: string | null;
  busy: boolean;
  cooldown: number;
  finale?: FinaleDef;
  ritualChoices?: { id: string; label: string }[];
  onSet: (control: string, value: StateValue) => void;
  onSubmit: (value: string[]) => void;
  /** A small object the player can pocket: "Take it" (it leaves the photo). */
  onTake?: () => void;
  /** An item lying in the object was picked up (it's in the tray already). */
  onPickUp: (itemId: string) => void;
  onClose: () => void;
  /** Bumped after every action: the mechanism redraws from the engine's state (a refused pull falls back). */
  revision: number;
  /** The held items, as the tray (drag one onto the close-up to use it here). */
  tray: ReactNode;
}

/** Open, lifted, tilted or its panel open: what's inside can be seen. Things with none of these always show theirs. */
function showsInside(state: Record<string, StateValue>): boolean {
  const keys = ["open", "lifted", "tilted", "panel", "on"].filter((k) => k in state);
  return keys.length === 0 || keys.some((k) => state[k] === true);
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
  const { target, photo, genre, state, contents, note, busy, cooldown, finale, ritualChoices, onSet, onSubmit, onTake, onPickUp, onClose, revision, tray } = props;
  const theme = useModeTheme();
  const feedback = useFeedback();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cropW = width - ref.space.lg * 2;
  // The crop gets what's left after the header, the mechanism and the tray: never a scroll.
  const free = height - insets.top - insets.bottom - 44 - V2.inspect.mechanismH - V2.tray.height - 5 * ref.space.lg;
  const cropH = Math.max(120, Math.min(cropW * 0.8, free));
  const crop = useMemo(() => (photo ? cropAround(photo.box, photo.aspect, cropW / cropH) : null), [photo, cropW, cropH]);
  const [reading, setReading] = useState<FoundCard | null>(null);

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
      if (reading) setReading(null);
      else onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose, reading]);

  const imgW = crop ? cropW / crop.w : 0;
  const imgH = crop ? cropH / crop.h : 0;
  const inside = showsInside(state) ? contents : [];

  return (
    <Animated.View style={[styles.root, { backgroundColor: theme.ground, paddingTop: insets.top + ref.space.sm, paddingBottom: insets.bottom + ref.space.sm }, rootStyle]} testID="v2-inspect">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[ref.type.serifTitle, { color: theme.ink }]} accessibilityRole="header" numberOfLines={1}>{capitalise(target.label)}</Text>
          {note ? <Text style={[ref.type.meta, { color: theme.inkMuted }]} numberOfLines={2} testID="v2-inspect-note">{note}</Text> : null}
        </View>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} testID="v2-inspect-close" style={[styles.close, { backgroundColor: theme.raised }]}>
          <XIcon size={22} weight="bold" color={theme.ink} />
        </Pressable>
      </View>

      <View style={styles.body}>
        {photo && crop ? (
          <View style={[styles.crop, { width: cropW, height: cropH, borderColor: theme.rim }]} testID="v2-inspect-crop">
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
            {/* What it holds, lying in it: tap a note to read it, an item to pick it up. */}
            {inside.length ? (
              <View style={styles.contents} testID="v2-contents">
                {inside.map((c) => {
                  const Glyph = c.kind === "card" ? NoteIcon : itemIcon(c.item);
                  return (
                    <Pressable
                      key={c.kind === "card" ? c.card.id : c.item.id}
                      onPress={() => {
                        if (c.kind === "card") {
                          feedback.paper();
                          setReading(c.card);
                        } else {
                          feedback.pickup();
                          onPickUp(c.item.id);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={c.kind === "card" ? `Read: ${c.card.title}` : `Pick up ${c.item.name}`}
                      testID={c.kind === "card" ? `v2-note-${c.card.id}` : `v2-found-${c.item.id}`}
                      style={[styles.found, c.kind === "card" ? styles.paperFound : { backgroundColor: theme.raised, borderColor: theme.ink }]}
                    >
                      <Glyph size={30} weight="fill" color={c.kind === "card" ? PAPER_INK : theme.ink} />
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.mechanism, { height: V2.inspect.mechanismH }]}>
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
          {onTake ? (
            <Pressable
              onPress={onTake}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Take it"
              testID="v2-take"
              style={[styles.take, { backgroundColor: theme.accent }]}
            >
              <Text style={[ref.type.headline, { color: theme.accentInk }]}>Take it</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {target.kind === "object" ? <View style={styles.tray}>{tray}</View> : null}

      {/* A note, read: paper over the close-up. Tap anywhere to put it down. */}
      {reading ? (
        <Pressable style={styles.readingScrim} onPress={() => setReading(null)} accessibilityRole="button" accessibilityLabel="Put the note down" testID="v2-reading">
          <View style={styles.paper}>
            <Text style={[ref.type.headline, styles.paperInk]}>{reading.title}</Text>
            <Text style={[ref.type.body, styles.paperInk]}>{reading.text}</Text>
          </View>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const PAPER = "rgb(236,228,210)";
const PAPER_INK = "rgb(52,44,34)";

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 50 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: ref.space.lg, gap: ref.space.sm, marginBottom: ref.space.sm, minHeight: 44 },
  headerText: { flex: 1, gap: 2 },
  close: { width: ref.hit.min, height: ref.hit.min, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, paddingHorizontal: ref.space.lg, gap: ref.space.lg, alignItems: "center" },
  crop: { borderRadius: V2.inspect.cropRadius, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  contents: { position: "absolute", left: 0, right: 0, bottom: ref.space.lg, flexDirection: "row", justifyContent: "center", gap: ref.space.lg },
  found: { width: 56, height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  paperFound: { backgroundColor: PAPER, borderColor: "rgba(0,0,0,0.25)", transform: [{ rotate: "-4deg" }] },
  mechanism: { alignItems: "center", justifyContent: "center", gap: ref.space.sm },
  take: { minHeight: ref.hit.min, paddingHorizontal: ref.space.xl, borderRadius: ref.hit.min / 2, alignItems: "center", justifyContent: "center" },
  tray: { paddingHorizontal: ref.space.lg, paddingTop: ref.space.sm },
  readingScrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: ref.space.xl },
  paper: { backgroundColor: PAPER, borderRadius: 4, padding: ref.space.xl, gap: ref.space.sm, maxWidth: 360, width: "100%", transform: [{ rotate: "-1.5deg" }] },
  paperInk: { color: PAPER_INK },
});
