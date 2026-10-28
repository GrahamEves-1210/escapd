// The casebook (gameplay v2 §2 "Learn"): her annotated reading journal for
// the case (docs/ART_DIRECTION.md, mystery-book core). A warm paper page in
// the mode's dark sheet, set like a mystery paperback she's been writing in:
// the series line in foil, a fleuron, then chapters. Chapter One is the case
// (the objective, written in her hand); then what she found, taped in (notes,
// polaroids, violet UV scraps; journal/JournalCard); crime scene's evidence
// board as library cards to strike off; what she's holding as stickers; and
// the hints as margin notes from the cat ("psst —"), with a sticker to ask for
// another. A bookmark ribbon, sticky tabs at each chapter, a page number.
// Below the page, on the sheet: the glints switch and restart.
import { createElement, useEffect, useState, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { DarkSheet } from "@/components/noir";
import { useModeTheme } from "@/game/mode";
import { font, ref, type ModeTheme } from "@/theme/tokens";
import type { FoundCard } from "./InspectView";
import { itemIcon } from "./ItemTray";
import { Heart, Moon, Paw, PressedFlower, Sparkle, Star, Underline } from "./journal/Doodles";
import { JournalCard, Polaroid } from "./journal/JournalCard";
import { EvidenceBoard } from "./journal/LibraryCard";
import { handType, journalPalette, type HandType, type JournalPalette } from "./journal/palette";
import { Fleuron, Ribbon, Rules, softShadow, StickyTab, TornEdge } from "./journal/Paper";

const GRAIN = require("../../assets/grain.png");

export interface CasebookProps {
  objective: string;
  cards: FoundCard[];
  /** What she holds. `kind` and `archetype` (ItemDef's), when given, pick each sticker's icon. */
  items: { id: string; name: string; examinable: boolean; kind?: string; archetype?: string }[];
  hints: string[];
  /** False when there is nothing more to hint: every step done, or the current step's ladder used up. */
  canHint: boolean;
  /** Crime scene: the accusation's lists, an evidence board the player crosses options off. */
  board?: { title: string; options: { id: string; name: string }[] }[];
  struck?: string[];
  onStrike?: (id: string) => void;
  /** Objects glint in the torch's beam; off is the hard way. */
  glints: boolean;
  onGlints: (on: boolean) => void;
  onHint: () => void;
  onExamine: (itemId: string) => void;
  onRestart: () => void;
  onClose: () => void;
  /** The cat, peering over the casebook's top edge (thinking along when you ask for a hint). */
  cat?: ReactNode;
}

const CHAPTERS = ["One", "Two", "Three", "Four", "Five", "Six"];
/** What the cat says before each margin note, in turn. */
const PSST = ["psst —", "ooh, and —", "also —", "and —"];

export function Casebook({ objective, cards, items, hints, canHint, board, struck = [], onStrike, glints, onGlints, onHint, onExamine, onRestart, onClose, cat }: CasebookProps) {
  const theme = useModeTheme();
  const p = journalPalette(theme);
  const hand = handType(theme);
  // Restarting wipes the case: the first tap asks, a second within a few seconds does it.
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(false), RESTART_CONFIRM_MS);
    return () => clearTimeout(t);
  }, [confirming]);

  let chapter = 0;
  const next = () => CHAPTERS[chapter++] ?? String(chapter);
  const head = (title: string, tab: number) => <Chapter number={next()} title={title} palette={p} theme={theme} tab={p.tape[tab % 3]} />;

  return (
    <DarkSheet title="Casebook" titleStyle="display" onClose={onClose} maxHeight="84%" testID="v2-casebook" closeTestID="v2-casebook-close" peek={cat}>
      <View style={[styles.page, { backgroundColor: p.paper }, softShadow(p.shadow)]}>
        <View style={[StyleSheet.absoluteFill, styles.pageClip]} pointerEvents="none">
          <Rules color={p.rule} gap={30} top={64} />
          <View style={[styles.margin, { backgroundColor: p.margin }]} />
          <Image source={GRAIN} resizeMode="repeat" style={[StyleSheet.absoluteFill, styles.grain]} />
        </View>
        <Ribbon color={p.ribbon} style={styles.ribbon} />
        <CornerDoodles genre={theme.genre} palette={p} />

        <Text style={[styles.series, { color: p.foilInk }]}>{p.series}</Text>
        <Fleuron foil={p.foil} ink={p.inkSoft} width={180} style={styles.fleuron} />

        <View style={styles.chapter}>
          {head("The case", 0)}
          <Text style={[hand.lead, { color: p.ink }]} testID="v2-casebook-objective">{objective}</Text>
          <Underline color={p.pen} width={150} seed={objective} />
        </View>

        <View style={styles.chapter}>
          {head("What I found", 1)}
          {cards.length ? (
            <View style={styles.cards}>
              {cards.map((c, i) => (
                <View key={c.id} testID={`v2-casebook-card-${c.id}`}>
                  <JournalCard card={c} palette={p} hand={hand} index={i} />
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.empty}>
              <Polaroid subject="photo" palette={p} hand={hand} rotate={-4} tape={p.tape[0]} pattern="dots" small />
              <Text style={[hand.body, styles.flex, { color: p.inkSoft }]} testID="v2-casebook-empty">Nothing yet. Sweep the light across the room.</Text>
            </View>
          )}
        </View>

        {board ? (
          <View style={styles.chapter} testID="v2-board">
            {head("The usual suspects", 2)}
            <Text style={[hand.body, { color: p.pen }]}>Cross off what the evidence rules out.</Text>
            <EvidenceBoard lists={board} struck={struck} onStrike={onStrike} palette={p} hand={hand} />
          </View>
        ) : null}

        {items.length ? (
          <View style={styles.chapter}>
            {head("In my pockets", 3)}
            <Text style={[hand.small, { color: p.inkSoft }]}>Tap one to look closer.</Text>
            <View style={styles.stickers}>
              {items.map((item, i) => <Sticker key={item.id} item={item} index={i} palette={p} hand={hand} onExamine={onExamine} />)}
            </View>
          </View>
        ) : null}

        <View style={styles.chapter}>
          {head("Notes in the margin", 4)}
          {hints.map((h, i) => (
            <View key={i} style={styles.hint}>
              <Paw color={p.pen} size={18} rotate={i % 2 ? 14 : -12} style={styles.paw} />
              <Text style={[hand.body, styles.flex, { color: p.pen }]}>
                {`${PSST[i % PSST.length]} `}
                <Text style={{ color: p.ink }}>{h}</Text>
              </Text>
            </View>
          ))}
          {canHint ? (
            <Pressable
              onPress={onHint}
              accessibilityRole="button"
              accessibilityLabel={hints.length ? "Another hint" : "Get a hint"}
              testID="v2-hint"
              style={({ pressed }) => [styles.sticker, { backgroundColor: p.sweet, borderColor: p.polaroid }, softShadow(p.shadow), pressed && styles.stickerPressed]}
            >
              <Paw color={p.ink} size={20} />
              <Text style={[hand.title, { color: p.ink }]}>{hints.length ? "Another hint" : "Get a hint"}</Text>
              <Sparkle color={p.polaroid} size={12} style={styles.stickerSparkle} />
            </Pressable>
          ) : hints.length ? (
            <Text style={[hand.body, { color: p.inkSoft }]} testID="v2-hints-spent">{"That's every hint for this step."}</Text>
          ) : null}
        </View>

        <Text style={[styles.folio, { color: p.inkSoft }]} accessibilityElementsHidden importantForAccessibility="no">{`— ${cards.length + 1} —`}</Text>
        {/* The page's deckled foot. */}
        <View style={styles.deckle}><TornEdge color={p.paper} side="bottom" seed="page" height={5} teeth={60} /></View>
      </View>

      <View style={styles.settings}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={[ref.type.body, { color: theme.ink }]}>Glints</Text>
            <Text style={[ref.type.meta, { color: theme.inkMuted }]}>Things catch the light as you sweep. Off is harder.</Text>
          </View>
          <Switch value={glints} onValueChange={onGlints} accessibilityLabel="Glints" testID="v2-glints" trackColor={{ true: theme.accent, false: theme.raised }} thumbColor={theme.ink} {...{ activeThumbColor: theme.ink }} />
        </View>
        <Pressable
          onPress={() => {
            if (confirming) {
              setConfirming(false);
              onRestart();
            } else setConfirming(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={confirming ? "Tap again to restart. Your progress in this case will be lost." : "Restart this case"}
          testID="v2-restart"
          style={styles.restart}
        >
          <Text style={[confirming ? ref.type.label : ref.type.meta, { color: confirming ? theme.stamp : theme.inkMuted }]}>
            {confirming ? "Tap again to restart. Progress will be lost." : "Restart this case"}
          </Text>
        </Pressable>
      </View>
    </DarkSheet>
  );
}

/** A chapter heading: "Chapter Two" in foil small caps over its title in the mode's display face, a sticky tab at the page's edge. */
function Chapter({ number, title, palette: p, theme, tab }: { number: string; title: string; palette: JournalPalette; theme: ModeTheme; tab: string }) {
  return (
    <View style={styles.chapterHead}>
      <StickyTab color={tab} top={4} style={styles.tab} />
      <Text style={[styles.chapterNo, { color: p.foilInk }]}>{`Chapter ${number}`}</Text>
      <Text style={[styles.chapterTitle, { fontFamily: theme.display.fontFamily, fontStyle: theme.display.fontStyle, color: p.ink }]} accessibilityRole="header">{title}</Text>
    </View>
  );
}

/** A held item as a die-cut sticker: its icon and name on the mode's dark, a white edge. Tap to examine. */
function Sticker({ item, index, palette: p, hand, onExamine }: { item: CasebookProps["items"][number]; index: number; palette: JournalPalette; hand: HandType; onExamine: (id: string) => void }) {
  const n = item.name.toLowerCase();
  const kind = (item.kind ?? (/\((left|right)\)|half/.test(n) ? "half" : /^(taped|mended)/.test(n) ? "assembled" : "prop")) as Parameters<typeof itemIcon>[0]["kind"];
  const glyph = itemIcon({ name: item.name, kind, archetype: item.archetype as Parameters<typeof itemIcon>[0]["archetype"] });
  const face = (
    <View style={[styles.stickerFace, { backgroundColor: p.photo, borderColor: p.polaroid, transform: [{ rotate: `${index % 2 ? 3 : -3}deg` }] }, softShadow(p.shadow)]}>
      <Sparkle color={p.sweet} size={10} style={styles.faceSparkle} />
      {createElement(glyph, { size: 30, weight: "duotone", color: p.chalk })}
      <Text style={[hand.small, styles.stickerName, { color: p.chalk }]} numberOfLines={2}>{item.name}</Text>
    </View>
  );
  if (!item.examinable) return <View style={styles.stickerSlot}>{face}</View>;
  return (
    <Pressable
      onPress={() => onExamine(item.id)}
      accessibilityRole="button"
      accessibilityLabel={`Examine ${item.name}`}
      testID={`v2-examine-${item.id}`}
      style={({ pressed }) => [styles.stickerSlot, pressed && styles.stickerPressed]}
    >
      {face}
    </Pressable>
  );
}

/** The page's corner doodles, by mode: a moon and stars, a heart and sparkles, a star and a pressed flower. */
function CornerDoodles({ genre, palette: p }: { genre: ModeTheme["genre"]; palette: JournalPalette }) {
  if (genre === "paranormal") {
    return (
      <>
        <Moon color={p.ink} fill={p.foil[0]} size={30} rotate={-12} style={styles.cornerA} />
        <Star color={p.pen} size={12} style={styles.cornerB} />
        <Sparkle color={p.foil[2]} size={10} style={styles.cornerC} />
        <PressedFlower color={p.pen} fill={p.sweet} size={52} rotate={-24} style={styles.cornerFoot} />
      </>
    );
  }
  if (genre === "crime_scene") {
    return (
      <>
        <Star color={p.pen} fill={p.sweet} size={22} rotate={-10} style={styles.cornerA} />
        <Sparkle color={p.foil[2]} size={10} style={styles.cornerC} />
        <PressedFlower color={p.pen} fill={p.sweet} size={48} rotate={-24} style={styles.cornerFoot} />
      </>
    );
  }
  return (
    <>
      <Heart color={p.pen} fill={p.sweet} size={22} rotate={-12} style={styles.cornerA} />
      <Sparkle color={p.foil[2]} size={12} style={styles.cornerB} />
      <Sparkle color={p.pen} size={8} style={styles.cornerC} />
      <PressedFlower color={p.pen} fill={p.sweet} size={48} rotate={-24} style={styles.cornerFoot} />
    </>
  );
}

/** How long "Tap again to restart" waits for the second tap (ms). */
const RESTART_CONFIRM_MS = 4000;

const styles = StyleSheet.create({
  deckle: { position: "absolute", left: 0, right: 0, bottom: -4 },
  page: { borderRadius: 6, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingLeft: 30, paddingRight: 18, paddingTop: 18, paddingBottom: 14, gap: 26, marginHorizontal: -6 },
  pageClip: { borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: "hidden" },
  margin: { position: "absolute", left: 20, top: 0, bottom: 0, width: 1.5 },
  grain: { opacity: 0.05 },
  ribbon: { position: "absolute", top: -4, right: 26 },
  series: { fontFamily: font.narrativeItalic, fontSize: 14, lineHeight: 18, letterSpacing: 0.6, textAlign: "center", marginBottom: -18 },
  fleuron: { marginBottom: -8 },
  chapter: { gap: 8 },
  chapterHead: { marginBottom: 2 },
  tab: { right: -32 },
  chapterNo: { fontFamily: font.narrative, fontSize: 12, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  chapterTitle: { fontSize: 23, lineHeight: 29 },
  cards: { gap: 24, paddingTop: 6 },
  empty: { flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 6 },
  stickers: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4 },
  stickerSlot: { width: 92 },
  stickerFace: { borderWidth: 3, borderRadius: 18, alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 6, gap: 4, minHeight: 92 },
  faceSparkle: { position: "absolute", top: 7, right: 8 },
  stickerName: { textAlign: "center" },
  hint: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  paw: { marginTop: 3 },
  sticker: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 48, paddingHorizontal: 20,
    borderRadius: 999, borderWidth: 3, marginTop: 6, transform: [{ rotate: "-2deg" }],
  },
  stickerSparkle: { position: "absolute", top: 4, right: 10 },
  stickerPressed: { transform: [{ scale: 0.96 }, { rotate: "-2deg" }] },
  folio: { fontFamily: font.narrativeItalic, fontSize: 13, lineHeight: 18, textAlign: "center", marginTop: -6 },
  cornerA: { position: "absolute", top: 12, left: 10 },
  cornerB: { position: "absolute", top: 40, left: 36 },
  cornerC: { position: "absolute", top: 46, left: 12 },
  cornerFoot: { position: "absolute", bottom: 8, right: 10 },
  settings: { gap: ref.space.sm },
  row: { flexDirection: "row", alignItems: "center", minHeight: ref.hit.min, gap: ref.space.sm },
  flex: { flex: 1 },
  restart: { alignSelf: "center", minHeight: ref.hit.min, justifyContent: "center" },
});
