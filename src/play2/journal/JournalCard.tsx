// A found card, taped into the casebook. What it looks like follows what it
// is (its title is the room's word for it, copy.ts): a UV finding is a violet
// scrap glowing in the dark; two halves taped together show the tear and the
// tape; something found on an object is a polaroid of it with her note beside;
// a page from a book keeps its dog-ear and a pressed flower; a sticky note is
// a sticky note; anything else is a torn notebook page. Text stays text.
import { StyleSheet, Text, View } from "react-native";
import { Arrow, Paperclip, PressedFlower, Sparkle, SubjectDoodle, Underline, type Subject } from "./Doodles";
import { rand, UV, type HandType, type JournalPalette } from "./palette";
import { Scrap, softShadow, Tape } from "./Paper";

export interface CardLike {
  id: string;
  title: string;
  text: string;
}

export type Look = "uv" | "taped" | "pages" | "sticky" | "polaroid" | "notebook";

const OBJECTS: [RegExp, Subject][] = [
  [/match/i, "matchbook"],
  [/ticket|slip|receipt|\btag\b|stub/i, "ticket"],
  [/napkin/i, "napkin"],
  [/envelope/i, "envelope"],
  [/burnt|letter/i, "flame"],
  [/bag/i, "bag"],
  [/drawing/i, "drawing"],
  [/card/i, "card"],
  [/photo/i, "photo"],
  [/scrap/i, "notepad"],
];

/** What a card looks like in the journal, and what its polaroid shows. */
export function lookOf(card: CardLike): { look: Look; subject: Subject } {
  const t = card.title;
  if (/\bUV\b|ultraviolet/i.test(t)) return { look: "uv", subject: "bulb" };
  if (/^(taped|mended)\b/i.test(t)) return { look: "taped", subject: "notepad" };
  if (/between the pages/i.test(t)) return { look: "pages", subject: /photograph/i.test(card.text) ? "photo" : "book" };
  if (/sticky/i.test(t)) return { look: "sticky", subject: "notepad" };
  const object = OBJECTS.find(([re]) => re.test(t));
  if (object) return { look: "polaroid", subject: object[1] };
  if (/on the air/i.test(t)) return { look: "notebook", subject: "radio" };
  if (/in the light/i.test(t)) return { look: "notebook", subject: "bulb" };
  if (/decoded/i.test(t)) return { look: "notebook", subject: "dial" };
  return { look: "notebook", subject: "notepad" };
}

interface Props {
  card: CardLike;
  palette: JournalPalette;
  hand: HandType;
  /** Its place in the journal: alternates the tilt and which side a polaroid sits. */
  index: number;
  /** Read up close (the note-reading overlay): larger, no neighbours. */
  large?: boolean;
  testID?: string;
}

/** A small, stable tilt for the card at `index` (degrees). */
function tilt(id: string, index: number, max = 1.6) {
  return (index % 2 ? 1 : -1) * (0.5 + rand(id, 7) * (max - 0.5));
}

export function JournalCard({ card, palette: p, hand, index, large = false, testID }: Props) {
  const { look, subject } = lookOf(card);
  const rot = tilt(card.id, index);
  const scale = large ? 1.18 : 1;
  const sized = (s: { fontSize?: number; lineHeight?: number }) => (large ? { fontSize: Math.round((s.fontSize ?? 16) * scale), lineHeight: Math.round((s.lineHeight ?? 22) * scale) } : null);
  const titleStyle = [hand.title, sized(hand.title)];
  const bodyStyle = [hand.body, sized(hand.body)];
  const tape = p.tape[index % 3];
  const pattern = (["stripes", "dots", "plain"] as const)[index % 3];
  const pad = large ? styles.padLarge : styles.pad;

  const title = (color: string, underline?: string) => (
    <View style={styles.titleRow}>
      <Text style={[titleStyle, { color }]}>{card.title}</Text>
      {underline ? <Underline color={underline} width={Math.min(150, 26 + card.title.length * 8)} seed={card.id} style={styles.underline} /> : null}
    </View>
  );
  const body = (color: string) => <Text style={[bodyStyle, { color }]}>{card.text}</Text>;

  if (look === "uv") {
    return (
      <Scrap
        testID={testID}
        color={UV.paper}
        seed={card.id}
        torn={{ top: true, bottom: true }}
        rotate={rot}
        shadow={large ? UV.glow : p.shadow}
        style={styles.wide}
        contentStyle={pad}
        overlay={<Tape color={tape} pattern={pattern} width={64} rotate={-4} style={styles.tapeTop} />}
      >
        <Sparkle color={UV.glow} size={14} style={styles.sparkleA} />
        <Sparkle color={UV.ink} size={9} style={styles.sparkleB} />
        {title(UV.glow)}
        <Text style={[bodyStyle, styles.uvGlow, { color: UV.ink }]}>{card.text}</Text>
      </Scrap>
    );
  }

  if (look === "taped") {
    return (
      <Scrap
        testID={testID}
        color={p.note}
        seed={card.id}
        torn={{ top: true, bottom: true }}
        rotate={rot}
        ruled={p.rule}
        shadow={p.shadow}
        style={styles.wide}
        contentStyle={pad}
        overlay={(
          <>
            <Tape color={tape} pattern={pattern} width={56} height={18} rotate={84} style={styles.tapeTearTop} />
            <Tape color={p.tape[(index + 1) % 3]} pattern="plain" width={50} height={18} rotate={-80} style={styles.tapeTearBottom} />
          </>
        )}
      >
        <View style={[styles.tear, { borderColor: p.rule }]} pointerEvents="none" />
        {title(p.pen, p.pen)}
        {body(p.ink)}
      </Scrap>
    );
  }

  if (look === "sticky") {
    return (
      <View testID={testID} style={[styles.sticky, { backgroundColor: p.sweet === "#F6D776" ? p.sweet : "#F8E08A", transform: [{ rotate: `${rot * 1.6}deg` }] }, softShadow(p.shadow), pad]}>
        <View style={styles.stickyTop} />
        {title("#3A2A10")}
        <Text style={[bodyStyle, { color: "#2A1D0B" }]}>{card.text}</Text>
      </View>
    );
  }

  if (look === "pages") {
    return (
      <Scrap
        testID={testID}
        color={p.note}
        seed={card.id}
        rotate={rot}
        shadow={p.shadow}
        style={styles.wide}
        contentStyle={[pad, styles.pageBody]}
        overlay={(
          <>
            <View style={[styles.dogEar, { borderTopColor: p.paper, borderRightColor: p.rule }]} pointerEvents="none" />
            <Paperclip color={p.inkSoft} size={36} rotate={8} style={styles.clip} />
          </>
        )}
      >
        <PressedFlower color={p.pen} fill={p.sweet} size={46} rotate={18} style={styles.flower} />
        {title(p.pen, p.pen)}
        {body(p.ink)}
        <Text style={[styles.folio, { color: p.inkSoft }]} accessibilityElementsHidden importantForAccessibility="no">{`p. ${(Math.round(rand(card.id, 3) * 280) + 12).toString()}`}</Text>
      </Scrap>
    );
  }

  if (look === "polaroid" && !large) {
    const flip = index % 2 === 1;
    return (
      <View testID={testID} style={[styles.polaroidRow, flip && styles.rowFlip]}>
        <Polaroid subject={subject} palette={p} hand={hand} caption={card.title} rotate={flip ? 3.5 : -3.5} tape={tape} pattern={pattern} />
        <View style={styles.beside}>
          <Arrow color={p.pen} size={40} style={flip ? styles.arrowFlip : styles.arrow} />
          {body(p.ink)}
        </View>
      </View>
    );
  }

  // A notebook page (and a polaroid, read up close: the photo clipped to its note).
  return (
    <Scrap
      testID={testID}
      color={p.note}
      seed={card.id}
      torn={{ top: true }}
      rotate={rot}
      ruled={p.rule}
      shadow={p.shadow}
      style={styles.wide}
      contentStyle={pad}
      overlay={look === "polaroid"
        ? <Polaroid subject={subject} palette={p} hand={hand} rotate={6} tape={tape} pattern={pattern} small large={large} style={styles.pinnedPhoto} />
        : <Tape color={tape} pattern={pattern} width={70} rotate={-3} style={styles.tapeTop} />}
    >
      {look !== "polaroid" && subject !== "notepad" ? (
        <View style={styles.corner}><SubjectDoodle subject={subject} color={p.inkSoft} accent={p.pen} size={34} /></View>
      ) : null}
      <View style={look === "polaroid" ? [styles.besidePinned, large && styles.besidePinnedLarge] : null}>
        {title(p.pen, p.pen)}
      </View>
      {body(p.ink)}
    </Scrap>
  );
}

/** A polaroid of the thing a card was found on: a chalk doodle on the photo's dark, a caption below. */
export function Polaroid({ subject, palette: p, hand, caption, rotate, tape, pattern, small, large, style }: {
  subject: Subject; palette: JournalPalette; hand: HandType; caption?: string; rotate: number; tape: string; pattern: "stripes" | "dots" | "plain"; small?: boolean; large?: boolean; style?: object;
}) {
  const w = small ? (large ? 100 : 78) : 112;
  return (
    <View style={[{ width: w, transform: [{ rotate: `${rotate}deg` }] }, style]}>
      <View style={[styles.polaroid, { backgroundColor: p.polaroid, paddingBottom: caption ? 6 : small ? 14 : 22 }, softShadow(p.shadow)]}>
        <View style={[styles.photo, { backgroundColor: p.photo, height: w - 14 }]}>
          <View style={[styles.photoGlow, { backgroundColor: p.glow }]} />
          <SubjectDoodle subject={subject} color={p.chalk} accent={p.sweet} size={small && !large ? 46 : 64} />
        </View>
        {caption ? <Text style={[hand.small, styles.caption, { color: p.ink }]} numberOfLines={2}>{caption}</Text> : null}
      </View>
      <Tape color={tape} pattern={pattern} width={small ? 40 : 52} height={small ? 14 : 17} rotate={-rotate * 2} style={styles.polaroidTape} />
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { alignSelf: "stretch" },
  pad: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 14, gap: 4 },
  padLarge: { paddingHorizontal: 24, paddingTop: 26, paddingBottom: 22, gap: 8 },
  titleRow: { alignSelf: "flex-start", marginBottom: 2 },
  underline: { marginTop: -3 },
  uvGlow: { textShadowColor: UV.glow, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } },
  sparkleA: { position: "absolute", right: 16, top: 12 },
  sparkleB: { position: "absolute", right: 34, top: 26 },
  tapeTop: { position: "absolute", top: -8, alignSelf: "center" },
  tapeTearTop: { position: "absolute", top: -14, left: "50%", marginLeft: -28 },
  tapeTearBottom: { position: "absolute", bottom: -12, left: "50%", marginLeft: -25 },
  tear: { position: "absolute", top: 0, bottom: 0, left: "50%", borderLeftWidth: 1, borderStyle: "dashed" },
  sticky: { alignSelf: "flex-start", width: "78%", minHeight: 120, borderRadius: 2, borderBottomRightRadius: 14 },
  stickyTop: { position: "absolute", left: 0, right: 0, top: 0, height: 16, backgroundColor: "rgba(0,0,0,0.05)" },
  pageBody: { paddingRight: 54 },
  dogEar: { position: "absolute", top: 0, right: 0, width: 0, height: 0, borderTopWidth: 22, borderRightWidth: 22, borderLeftWidth: 0, borderLeftColor: "transparent", borderBottomColor: "transparent" },
  clip: { position: "absolute", top: -12, left: 22 },
  flower: { position: "absolute", right: 6, bottom: 22 },
  folio: { position: "absolute", bottom: 6, right: 14, fontSize: 11, fontStyle: "italic" },
  polaroidRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 4, paddingVertical: 4 },
  rowFlip: { flexDirection: "row-reverse" },
  beside: { flex: 1, paddingTop: 6, gap: 2 },
  arrow: { marginLeft: -8, transform: [{ scaleX: -1 }] },
  arrowFlip: { alignSelf: "flex-end", marginRight: -8 },
  polaroid: { padding: 7, borderRadius: 2 },
  photo: { alignItems: "center", justifyContent: "center", overflow: "hidden", borderRadius: 1 },
  photoGlow: { position: "absolute", width: "90%", height: "90%", borderRadius: 999, opacity: 0.16, top: "-20%", right: "-30%" },
  caption: { textAlign: "center", marginTop: 4 },
  polaroidTape: { position: "absolute", top: -8, alignSelf: "center" },
  pinnedPhoto: { position: "absolute", top: -14, right: 8 },
  besidePinned: { paddingRight: 80, minHeight: 64 },
  besidePinnedLarge: { paddingRight: 104, minHeight: 84 },
  corner: { position: "absolute", top: 12, right: 12, opacity: 0.9 },
});
