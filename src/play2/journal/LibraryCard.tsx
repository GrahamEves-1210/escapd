// Crime scene's evidence board as library cards, one per list (who, why,
// how): a ruled card with its heading typed at the top, each option written
// on a line. Tap a line to strike it off in red marker (a "ruled out" stamp
// lands in the date column); tap again to put it back. When only one is left
// on a card it gets circled, and red string runs between the circled ones
// (EvidenceBoard). Each line is a full-width target.
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutRectangle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ref } from "@/theme/tokens";
import { Pin, Strike } from "./Doodles";
import { rand, type HandType, type JournalPalette } from "./palette";
import { softShadow } from "./Paper";

export interface BoardList {
  title: string;
  options: { id: string; name: string }[];
}

const KIND: Record<string, string> = { who: "Suspects", why: "Motive", how: "Method" };

type Point = { x: number; y: number };

/** The lists as library cards, and red string between the ones narrowed to one. */
export function EvidenceBoard({ lists, struck, onStrike, palette: p, hand }: {
  lists: BoardList[];
  struck: readonly string[];
  onStrike?: (id: string) => void;
  palette: JournalPalette;
  hand: HandType;
}) {
  const [cards, setCards] = useState<Record<number, LayoutRectangle>>({});
  const [knots, setKnots] = useState<Record<number, Point | null>>({});
  const points = lists.flatMap((_, i) => {
    const c = cards[i];
    const k = knots[i];
    return c && k ? [{ x: c.x + k.x, y: c.y + k.y }] : [];
  });
  let d = "";
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    // A little slack: the string sags out to the right between its pins.
    d += `M${a.x} ${a.y} Q${Math.max(a.x, b.x) + 46} ${(a.y + b.y) / 2} ${b.x} ${b.y} `;
  }
  return (
    <View style={styles.board}>
      {lists.map((list, i) => (
        <View key={list.title} onLayout={(e) => { const l = e.nativeEvent.layout; setCards((all) => ({ ...all, [i]: l })); }}>
          <LibraryCard list={list} struck={struck} onStrike={onStrike} palette={p} hand={hand} index={i} onKnot={(k) => setKnots((all) => (sameKnot(all[i], k) ? all : { ...all, [i]: k }))} />
        </View>
      ))}
      {d ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Svg width="100%" height="100%">
            <Path d={d} stroke={p.marker} strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.9} />
          </Svg>
          {points.map((pt, i) => <Pin key={i} color={p.marker} size={16} style={{ position: "absolute", left: pt.x - 8, top: pt.y - 9 }} />)}
        </View>
      ) : null}
    </View>
  );
}

const sameKnot = (a: Point | null | undefined, b: Point | null) => (a ?? null) === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5);

export function LibraryCard({ list, struck, onStrike, palette: p, hand, index, onKnot }: {
  list: BoardList;
  struck: readonly string[];
  onStrike?: (id: string) => void;
  palette: JournalPalette;
  hand: HandType;
  index: number;
  /** Where the circled one's loop ends (card coordinates), for the string; null when none is circled. */
  onKnot?: (point: Point | null) => void;
}) {
  const left = list.options.filter((o) => !struck.includes(o.id));
  const narrowed = left.length === 1 && list.options.length > 1;
  // Every line's and name's layout (one becomes the circled one without moving, so no new layout comes then).
  const [rows, setRows] = useState<Record<string, LayoutRectangle>>({});
  const [names, setNames] = useState<Record<string, LayoutRectangle>>({});
  const row = narrowed ? rows[left[0].id] : undefined;
  const name = narrowed ? names[left[0].id] : undefined;
  const knot = narrowed && row && name ? { x: CARD_PAD + name.x + name.width + 14, y: row.y + row.height / 2 } : null;
  const kx = knot?.x ?? -1;
  const ky = knot?.y ?? -1;
  useEffect(() => {
    onKnot?.(kx < 0 ? null : { x: kx, y: ky });
    // onKnot is a fresh closure each render; the point is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kx, ky]);
  const kind = KIND[list.title.toLowerCase()] ?? list.title;
  return (
    <View style={[styles.card, { backgroundColor: p.note, transform: [{ rotate: `${index % 2 ? 0.7 : -0.7}deg` }] }, softShadow(p.shadow)]}>
      <Pin color={p.marker} size={20} style={styles.pin} />
      <View style={styles.head}>
        <Text style={[styles.typed, styles.headTitle, { color: p.ink }]} accessibilityRole="header">{`${list.title.toUpperCase()}?`}</Text>
        <Text style={[styles.typed, { color: p.inkSoft }]}>{kind.toUpperCase()}</Text>
      </View>
      <View style={[styles.columns, { borderColor: p.marker }]}>
        <Text style={[styles.typed, styles.small, styles.flex, { color: p.inkSoft }]} accessibilityElementsHidden importantForAccessibility="no">{"NAME"}</Text>
        <Text style={[styles.typed, styles.small, styles.dateCol, { color: p.inkSoft }]} accessibilityElementsHidden importantForAccessibility="no">{"STATUS"}</Text>
      </View>
      {list.options.map((o, i) => {
        const off = struck.includes(o.id);
        const circled = narrowed && !off;
        return (
          <Pressable
            key={o.id}
            onPress={() => onStrike?.(o.id)}
            accessibilityRole="button"
            accessibilityLabel={o.name}
            accessibilityState={{ checked: off }}
            accessibilityHint={off ? "Ruled out. Tap to put it back." : "Tap to rule it out."}
            testID={`v2-board-${o.id}`}
            onLayout={(e) => { const l = e.nativeEvent.layout; setRows((all) => ({ ...all, [o.id]: l })); }}
            style={({ pressed }) => [styles.line, { borderBottomColor: p.rule }, pressed && { backgroundColor: p.rule }]}
          >
            <View style={[styles.flex, styles.nameCell]}>
              <View style={styles.nameWrap} onLayout={(e) => { const l = e.nativeEvent.layout; setNames((all) => ({ ...all, [o.id]: l })); }}>
                <Text style={[hand.body, { color: off ? p.inkSoft : p.ink }]}>{o.name}</Text>
                {off ? <Strike color={p.marker} seed={o.id} /> : null}
                {circled ? <Circle color={p.marker} seed={o.id} /> : null}
              </View>
            </View>
            <View style={styles.dateCol}>
              {off ? (
                <View style={[styles.stamp, { borderColor: p.marker, transform: [{ rotate: `${-6 + rand(o.id, i) * 8}deg` }] }]}>
                  <Text style={[styles.typed, styles.stampText, { color: p.marker }]}>{"RULED OUT"}</Text>
                </View>
              ) : circled ? (
                <Text style={[hand.small, { color: p.pen }]}>{"this one?"}</Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A marker loop round the one that's left. */
function Circle({ color, seed }: { color: string; seed: string }) {
  const j = rand(seed, 9) * 6;
  return (
    <View style={styles.loop} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 100 40" preserveAspectRatio="none">
        <Path d={`M60 ${5 + j / 3} C88 3 100 14 97 23 C93 35 40 39 14 34 C-2 30 0 12 18 7 C34 2 58 3 74 6`} stroke={color} strokeWidth={2.2} vectorEffect="non-scaling-stroke" fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const CARD_PAD = 14;

const styles = StyleSheet.create({
  board: { gap: 22, paddingTop: 10 },
  card: { borderRadius: 3, paddingHorizontal: CARD_PAD, paddingTop: 12, paddingBottom: 8 },
  pin: { position: "absolute", top: -7, left: "50%", marginLeft: -10, zIndex: 2 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 },
  typed: { fontFamily: ref.font.typewriter, fontSize: 12, lineHeight: 16, letterSpacing: 1.2 },
  headTitle: { fontFamily: ref.font.typewriterBold, fontSize: 15, lineHeight: 20 },
  small: { fontSize: 10, lineHeight: 14 },
  columns: { flexDirection: "row", borderTopWidth: 1.5, borderBottomWidth: 1.5, paddingVertical: 2, marginBottom: 2 },
  flex: { flex: 1 },
  dateCol: { width: 88, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "center", minHeight: ref.hit.min, borderBottomWidth: 1 },
  nameCell: { paddingVertical: 4, paddingRight: 6 },
  nameWrap: { alignSelf: "flex-start", paddingHorizontal: 4 },
  loop: { position: "absolute", left: -10, right: -12, top: -5, bottom: -5 },
  stamp: { borderWidth: 1.5, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, opacity: 0.88 },
  stampText: { fontFamily: ref.font.typewriterBold, fontSize: 10, lineHeight: 13, letterSpacing: 0.8 },
});
