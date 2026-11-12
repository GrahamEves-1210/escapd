// Readable. "card": nothing to work (what it says shows as a note in it).
// "pages": dial the page number on three digit wheels and turn straight to
// it (no thumbing page by page); onSet("page", "47"). The wheels stand at the
// page it's open at.
//
// Drawn as the book lying open: two cream pages over its cloth boards, lines
// of print, a ribbon down the gutter, where it's open pencilled at the head
// of the left page, both pages numbered at the foot.
import { memo, useCallback, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useModeTheme } from "@/game/mode";
import { ref } from "@/theme/tokens";
import { Stage, domainOf } from "./kit";
import { ENAMEL, INK, Ink, hidden, rng, useGradId, useMaterials, type Materials } from "./materials";
import { WheelBank } from "./Wheels";
import type { MechanismProps } from "./types";

export function Readable(props: MechanismProps) {
  if (props.target.variant !== "pages") return null;
  return <Pages {...props} />;
}

const BOOK = { w: 288, h: 78 };

function Pages({ target, state, onSet, onChange, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const mat = useMaterials();
  const domain = domainOf(target, "page");
  const max = domain?.kind === "page" ? domain.max : 300;
  const turn = useCallback((digits: string[]) => {
    const n = Number(digits.join(""));
    onSet("page", String(Math.min(max, Math.max(1, n || 1))));
  }, [max, onSet]);
  const at = typeof state.page === "string" ? state.page : "1";
  // The page on the wheels, three digits ("1" is 001).
  const start = useMemo(() => at.padStart(3, "0").slice(-3).split(""), [at]);
  const hand = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  const n = Number(at) || 1;
  // An odd page is a right-hand one.
  const [left, right] = n % 2 ? [n - 1, n] : [n, n + 1];
  return (
    <Stage width={width} style={styles.flush}>
      <View style={styles.col}>
        <View style={{ width: BOOK.w, height: BOOK.h }}>
          <OpenBook mat={mat} seed={n} />
          <Text style={[styles.folio, styles.folioLeft, { fontFamily: hand }]} {...hidden}>{left > 0 ? left : ""}</Text>
          <Text style={[styles.folio, styles.folioRight, { fontFamily: hand }]} {...hidden}>{right}</Text>
          {/* The page it's open at is on its folios; said only to a screen reader. */}
          <View accessible accessibilityRole="text" accessibilityLabel={`Open at page ${at}`} accessibilityLiveRegion="polite" style={styles.unsaid} testID="mech-page-at" />
        </View>
        <WheelBank alphabet="digits" count={3} width={width} busy={busy} cooldown={0} done={false} submitLabel="Turn to page" onSubmit={turn} onChange={onChange} start={start} status={false} />
      </View>
    </Stage>
  );
}

/** A book open flat: its boards, the two pages rising to the gutter, lines of print (different on every page), a ribbon. */
const OpenBook = memo(function OpenBook({ mat, seed }: { mat: Materials; seed: number }) {
  const g = useGradId();
  const [lp, rp] = [g("l"), g("r")];
  const { w, h } = BOOK;
  const c = w / 2;
  const art = useMemo(() => {
    const rnd = rng(seed * 7 + 3);
    const page = (x0: number, x1: number, from: number) => {
      let d = "";
      for (let y = from; y < h - 20; y += 7) {
        const short = rnd() < 0.25 ? (x1 - x0) * (0.3 + rnd() * 0.4) : 0;
        d += `M${x0} ${y}H${x1 - short}`;
      }
      return d;
    };
    return {
      print: page(18, c - 12, 34) + page(c + 12, w - 18, 20),
      left: `M8 9Q${c * 0.5} 2 ${c} 9V${h - 9}Q${c * 0.5} ${h - 15} 8 ${h - 9}Z`,
      right: `M${w - 8} 9Q${c * 1.5} 2 ${c} 9V${h - 9}Q${c * 1.5} ${h - 15} ${w - 8} ${h - 9}Z`,
    };
  }, [seed, w, h, c]);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={lp.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={ENAMEL.mid} />
          <Stop offset="0.8" stopColor={ENAMEL.light} />
          <Stop offset="1" stopColor={ENAMEL.shade} />
        </LinearGradient>
        <LinearGradient id={rp.id} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={ENAMEL.shade} />
          <Stop offset="0.2" stopColor={ENAMEL.light} />
          <Stop offset="1" stopColor={ENAMEL.mid} />
        </LinearGradient>
      </Defs>
      {/* Its boards under the pages, the block's edge at each side. */}
      <Rect x={2} y={6} width={w - 4} height={h - 8} rx={5} fill={mat.cloth.mid} stroke={INK} strokeWidth={1.8} />
      <Path d={`M5 ${h - 6}H${w - 5}`} stroke={mat.cloth.deep} strokeWidth={2} />
      <Path d={art.left} fill={lp.url} />
      <Path d={art.right} fill={rp.url} />
      <Path d={art.print} stroke={ENAMEL.ink} strokeOpacity={0.3} strokeWidth={1.3} strokeLinecap="round" />
      <Ink d={art.left} w={1.5} />
      <Ink d={art.right} w={1.5} />
      {/* The ribbon down the gutter, its tail out at the foot. */}
      <Path d={`M${c - 1} 8V${h - 6}l-3 8l4 -3l4 3l-2 -8V8Z`} fill="#A8323F" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
    </Svg>
  );
});

const styles = StyleSheet.create({
  flush: { paddingVertical: 0 },
  col: { alignItems: "center", gap: ref.space.sm },
  // Where it's open, written across the head of the page.
  unsaid: { position: "absolute", left: 14, top: 9, width: 1, height: 1 },
  folio: { position: "absolute", bottom: 10, fontSize: 15, lineHeight: 18, color: ENAMEL.ink, opacity: 0.75 },
  folioLeft: { left: 20 },
  folioRight: { right: 20 },
});
