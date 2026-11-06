// Her charm board, at /collection (opened from home's charm chip): the
// reason to come back. In the shell's velvet plum, under a header like home's
// (a back chip, the screen's name in the cover face):
// - her detective title on a little name card: the cat beside it (wearing
//   what she picked), the title in the cover face, the cases she has closed
//   and how many more to the next title, a gold-foil bar between;
// - the board: a velvet pin board, a row per mode (its series line over its
//   three charms); each charm she has earned is pinned on in its best finish
//   with its name and three pips for the finishes she has of it (gold,
//   silver, sticker); the ones she hasn't are soft silhouettes. A tap on an
//   earned charm wiggles it and says what it is;
// - the cat's wardrobe: just the cat, or a bell collar, a knitted scarf,
//   round spectacles, a deerstalker (a detective's cat), each unlocked by a
//   title; the pick is kept for the cats to wear ("escapd.cat.accessory").
// Opening it marks her charms as seen (home's chip loses its dot).
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { CaretLeftIcon } from "phosphor-react-native";
import { SquashPressable } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import {
  ACCESSORIES, ACCESSORY_NAME, ALL_CHARMS, BOARD_MODES, CHARM_INFO, FINISHES, FINISH_LABEL, FINISH_RANK, MODE_CHARMS,
  nextTitle, titleFor, unlockAt, unlockedAccessories,
  type AccessoryChoice, type CharmKind, type Finish,
} from "@/game/collection/charms";
import { casesClosed, loadAccessory, loadCollection, markBoardSeen, saveAccessory, type Collection } from "@/game/collection/store";
import { SittingCat } from "@/play2/SittingCat";
import { Chip } from "@/screens/hub/Chip";
import { SERIES_LINE } from "@/render/victory";
import { useTheme } from "@/theme/ThemeProvider";
import { alpha } from "@/theme/payoff";
import { modeThemes, ref, shellTheme } from "@/theme/tokens";
import { AccessoryIcon, Charm, LockMark } from "./CharmArt";

const S = shellTheme;
const CHIP_PAD = (ref.button.chip.hit - ref.button.chip.size) / 2;

/** This screen's sizes. */
export const BOARD = {
  edge: 16,
  radius: 24,
  pad: 16,
  charm: 64,
  tile: 58,
  cat: 74,
} as const;

/** The board's tones: a velvet a shade off the ground, a silhouette's soft shape on it. */
const VELVET = "#2A1D31";
const SILHOUETTE = "#3D2D45";
const STITCH = "rgba(217, 178, 106, 0.2)";
/** The plum ink pooled low on the ground. */
const PLUM = "#7B4A80";
const PIP: Record<Finish, string> = { gold: "#D9B26A", silver: "#C9CEDA", sticker: "#FFFDF8" };

/** What she has of one charm: its best finish, the finishes she has, from how many cases. */
export interface CharmHeld {
  best: Finish;
  finishes: Set<Finish>;
  cases: number;
}

export function heldCharms(c: Collection): Partial<Record<CharmKind, CharmHeld>> {
  const out: Partial<Record<CharmKind, CharmHeld>> = {};
  for (const x of Object.values(c.cases)) {
    const h = (out[x.kind] ??= { best: x.finish, finishes: new Set(), cases: 0 });
    h.finishes.add(x.finish);
    h.cases += 1;
    if (FINISH_RANK[x.finish] > FINISH_RANK[h.best]) h.best = x.finish;
  }
  return out;
}

export function CollectionScreen() {
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const [board, setBoard] = useState<Collection | null>(null);
  const [accessory, setAccessory] = useState<AccessoryChoice>("none");
  const [picked, setPicked] = useState<CharmKind | null>(null);
  useModeOnFocus(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([loadCollection(), loadAccessory()]).then(([c, a]) => {
        if (cancelled) return;
        setBoard(c);
        setAccessory(a);
        markBoardSeen().catch(() => {});
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const closed = board ? casesClosed(board) : 0;
  const held = board ? heldCharms(board) : {};
  const title = titleFor(closed);
  const next = nextTitle(closed);
  const unlocked = new Set(unlockedAccessories(closed));
  const earned = ALL_CHARMS.filter((k) => held[k]).length;
  const golds = ALL_CHARMS.filter((k) => held[k]?.finishes.has("gold")).length;
  const progress = next ? Math.min(1, (closed - title.at) / Math.max(1, next.at - title.at)) : 1;

  const choose = (a: AccessoryChoice) => {
    if (a !== "none" && !unlocked.has(a)) return;
    feedback.tick();
    setAccessory(a);
    saveAccessory(a);
  };

  return (
    <View style={[styles.root, { backgroundColor: S.ground }]} testID="collection-screen">
      <Glow />
      <View style={[styles.header, { paddingTop: insets.top + ref.layout.hub.header.top - CHIP_PAD }]}>
        <Chip accessibilityLabel="Back" icon={<CaretLeftIcon size={ref.icon.chip} weight="bold" color={ref.color.textPrimary} />} onPress={back} testID="collection-back" />
        <Text style={[styles.screenTitle, { color: S.ink }]} accessibilityRole="header">Charm board</Text>
        <View style={styles.chipSlot} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + ref.space.xl }]} testID="collection-scroll">
        {/* Her name card: the cat, her title, how far to the next. */}
        <View style={[styles.nameCard, { backgroundColor: S.surface, borderColor: S.rim }]} testID="collection-title-card">
          <View style={styles.catSpot}>
            {/* Mounted again on a new outfit, so it puts it on (it says what it's wearing itself). */}
            <SittingCat key={accessory} width={BOARD.cat} label="The black cat" />
          </View>
          <View style={styles.nameWords}>
            <Text style={[ref.type.series, { color: S.inkMuted }]}>Your detective title</Text>
            <Text style={[styles.title, { color: S.ink }]} testID="collection-title">{title.title}</Text>
            <View style={[styles.bar, { backgroundColor: alpha(S.foil, 0.18) }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: S.foil }]} />
            </View>
            <Text style={[ref.type.handSmall, { color: S.foil }]} testID="collection-progress">
              {`${closed} ${closed === 1 ? "case" : "cases"} closed`}
              {next ? ` · ${next.at - closed} more to ${next.title}` : " · the very top"}
            </Text>
          </View>
        </View>

        {/* The board. */}
        <View style={[styles.board, { backgroundColor: VELVET, borderColor: S.rim }]} testID="collection-board">
          <View style={[styles.stitch, { borderColor: STITCH }]} pointerEvents="none" />
          {BOARD_MODES.map((genre) => (
            <View key={genre} style={styles.modeRow}>
              <Text style={[styles.series, { color: modeThemes[genre].stamp }]} accessibilityRole="header">{SERIES_LINE[genre]}</Text>
              <View style={styles.charms}>
                {MODE_CHARMS[genre].map((kind) => (
                  <CharmSlot key={kind} kind={kind} held={held[kind]} picked={picked === kind} onPress={() => setPicked((p) => (p === kind ? null : kind))} />
                ))}
              </View>
            </View>
          ))}
          <Text style={[ref.type.handSmall, styles.centre, { color: S.inkMuted }]} testID="collection-count" accessibilityLiveRegion="polite">
            {picked && held[picked] ? pickedLine(picked, held[picked]!) : `${earned} of ${ALL_CHARMS.length} charms${golds ? ` · ${golds} in gold` : ""}`}
          </Text>
        </View>

        {/* The cat's wardrobe. */}
        <View style={styles.wardrobe} testID="collection-wardrobe">
          <Text style={[styles.heading, { color: S.ink }]} accessibilityRole="header">The cat&apos;s wardrobe</Text>
          <Text style={[ref.type.handSmall, { color: S.inkMuted }]}>Every new title brings the cat something to wear.</Text>
          <View style={styles.tiles} accessibilityRole="radiogroup">
            {(["none", ...ACCESSORIES] as AccessoryChoice[]).map((a) => {
              const open = a === "none" || unlocked.has(a);
              const on = accessory === a;
              const at = a === "none" ? 0 : unlockAt(a);
              return (
                <SquashPressable
                  key={a}
                  onPress={() => choose(a)}
                  disabled={!open}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on, disabled: !open, checked: on }}
                  accessibilityLabel={open ? ACCESSORY_NAME[a] : `${ACCESSORY_NAME[a]}, locked`}
                  accessibilityHint={open ? undefined : `Close ${at} ${at === 1 ? "case" : "cases"} to unlock`}
                  testID={`collection-accessory-${a}`}
                  style={styles.tileHit}
                >
                  <View style={[styles.tile, { backgroundColor: on ? S.raised : S.surface, borderColor: on ? S.foil : S.rim, borderWidth: on ? 2 : 1 }]}>
                    <AccessoryIcon accessory={a} size={38} muted={!open} tone={SILHOUETTE} />
                    {!open ? (
                      <View style={[styles.lock, { backgroundColor: S.raised, borderColor: S.rim }]}>
                        <LockMark size={11} color={S.inkMuted} />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.tileLabel, { color: on ? S.ink : S.inkMuted }]} numberOfLines={1}>
                    {open ? (a === "none" ? "None" : ACCESSORY_NAME[a]) : `${at} ${at === 1 ? "case" : "cases"}`}
                  </Text>
                </SquashPressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function pickedLine(kind: CharmKind, h: CharmHeld): string {
  const finishes = FINISHES.filter((f) => h.finishes.has(f)).map((f) => FINISH_LABEL[f].toLowerCase());
  return `${CHARM_INFO[kind].name} · ${finishes.join(", ")} · ${h.cases} ${h.cases === 1 ? "case" : "cases"}`;
}

/** One charm on the board: pinned on in its best finish, or its soft silhouette. */
function CharmSlot({ kind, held, picked, onPress }: { kind: CharmKind; held?: CharmHeld; picked: boolean; onPress: () => void }) {
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const wiggle = useSharedValue(0);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.get()}deg` }] }));
  useEffect(() => {
    if (!picked || reducedMotion) return;
    const t = (to: number) => withTiming(to, { duration: 70 });
    wiggle.set(withSequence(t(-9), t(7), t(-4), t(2), t(0)));
  }, [picked, reducedMotion, wiggle]);
  const info = CHARM_INFO[kind];
  if (!held) {
    return (
      <View style={styles.slot} accessible accessibilityLabel={`${info.name}: not found yet`} testID={`collection-charm-${kind}`}>
        <Charm kind={kind} size={BOARD.charm} silhouette tone={SILHOUETTE} />
        <Text style={[styles.slotName, { color: alpha(S.inkMuted, 0.7) }]} numberOfLines={1}>Not yet</Text>
        <View style={styles.pips} />
      </View>
    );
  }
  return (
    <SquashPressable
      onPress={() => {
        feedback.tick();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${info.name}, ${FINISH_LABEL[held.best].toLowerCase()}. From ${held.cases} ${held.cases === 1 ? "case" : "cases"}.`}
      testID={`collection-charm-${kind}`}
      style={styles.slot}
    >
      <Animated.View style={style}>
        <Charm kind={kind} finish={held.best} size={BOARD.charm} />
      </Animated.View>
      <Text style={[styles.slotName, { color: S.ink }]} numberOfLines={1}>{info.name}</Text>
      <View style={styles.pips} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {FINISHES.map((f) => (
          <View key={f} style={[styles.pip, held.finishes.has(f) ? { backgroundColor: PIP[f], borderColor: PIP[f] } : { borderColor: alpha(PIP[f], 0.45) }]} />
        ))}
      </View>
    </SquashPressable>
  );
}

/** A candle's glow high on the ground, and a little plum ink low down. Decorative. */
function Glow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="cbGlow" cx="50%" cy="18%" rx="80%" ry="40%" fx="50%" fy="18%">
            <Stop offset={0} stopColor={S.glow} stopOpacity={0.14} />
            <Stop offset={1} stopColor={S.glow} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="cbSweet" cx="85%" cy="92%" rx="60%" ry="30%" fx="85%" fy="92%">
            <Stop offset={0} stopColor={PLUM} stopOpacity={0.22} />
            <Stop offset={1} stopColor={PLUM} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cbGlow)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#cbSweet)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: ref.space.lg - CHIP_PAD },
  chipSlot: { width: ref.button.chip.hit, height: ref.button.chip.hit },
  screenTitle: { flex: 1, textAlign: "center", fontFamily: ref.font.cover, fontSize: 22, lineHeight: 28 },
  content: { paddingHorizontal: BOARD.edge, paddingTop: ref.space.sm, gap: ref.space.lg },
  centre: { textAlign: "center" },
  nameCard: { flexDirection: "row", alignItems: "flex-end", gap: 12, padding: BOARD.pad, paddingBottom: 12, borderRadius: BOARD.radius, borderWidth: 1, ...ref.curve },
  catSpot: { width: BOARD.cat, alignItems: "center", justifyContent: "flex-end" },
  nameWords: { flex: 1, gap: 4, paddingBottom: 4 },
  title: { fontFamily: ref.font.cover, fontSize: 24, lineHeight: 30 },
  bar: { height: 6, borderRadius: 3, overflow: "hidden", marginTop: 2 },
  barFill: { height: 6, borderRadius: 3 },
  board: { borderRadius: BOARD.radius, borderWidth: 1, paddingVertical: BOARD.pad, paddingHorizontal: 8, gap: 10, ...ref.curve },
  stitch: { ...StyleSheet.absoluteFill, margin: 6, borderRadius: BOARD.radius - 6, borderWidth: 1, borderStyle: "dashed" },
  modeRow: { gap: 2, alignItems: "center" },
  series: { ...ref.type.series, fontSize: 15, lineHeight: 20, textAlign: "center" },
  charms: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-around" },
  slot: { flex: 1, alignItems: "center", gap: 0, paddingVertical: 2 },
  slotName: { ...ref.type.handSmall, textAlign: "center" },
  pips: { flexDirection: "row", gap: 4, height: 8, marginTop: 2 },
  pip: { width: 7, height: 7, borderRadius: 3.5, borderWidth: 1.2 },
  wardrobe: { gap: 4 },
  heading: { fontFamily: ref.font.cover, fontSize: 19, lineHeight: 24 },
  tiles: { flexDirection: "row", justifyContent: "space-between", marginTop: ref.space.sm },
  tileHit: { alignItems: "center", gap: 4, minWidth: 60 },
  tile: { width: BOARD.tile, height: BOARD.tile, borderRadius: BOARD.tile / 2, alignItems: "center", justifyContent: "center" },
  lock: { position: "absolute", right: -2, bottom: -2, width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  tileLabel: { ...ref.type.handSmall, textAlign: "center" },
});
