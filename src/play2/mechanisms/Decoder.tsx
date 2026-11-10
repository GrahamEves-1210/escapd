// Decoder: a two-ring cipher disc. The outer ring is the plain alphabet (for a
// coded number, A..J also carry 0..9); the inner disc is the cipher alphabet,
// and turns under it in detents. Set to +k, the letter under plain A is A + k,
// as the clue writes it ("+5"). Above the disc lies the coded line the player
// found, and under each coded letter what it reads at this setting, live, so
// turning the ring shows its effect: the coded letters are marked on the inner
// disc and the plain letters they sit under light up on the outer ring. Once
// the engine has shown the decoded note, the line is stamped "It reads" at that
// setting. Offset 1..max; onSet("offset", "3") on release. It never knows the
// answer: the reading is the player's.
//
// Drawn as the thing in the hand: a brass wheel, its plain alphabet engraved
// round the rim, an enamel disc turning in it with the cipher alphabet in ink,
// a knurled brass boss to turn it by, and an index bracket at twelve.
import { memo, useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { FadeIn, cancelAnimation, useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { scheduleOnRN } from "react-native-worklets";
import { ArrowsClockwiseIcon } from "phosphor-react-native";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { ref } from "@/theme/tokens";
import { handType, journalPalette } from "../journal/palette";
import { useCipher } from "./cipher";
import { Stage, adjustable, domainOf, mod, settle } from "./kit";
import { BRASS, ENAMEL, INK, useGradId } from "./materials";
import type { MechanismProps } from "./types";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const N = LETTERS.length;
const STEP = 360 / N;
const A = 65;
/** The columns either side of the disc: the turn hint, the setting. */
const SIDE = 74;

/** A step's offset kept in 1..max: 0 (no shift) and anything past max land on the nearest end. */
function valid(k: number, max: number) {
  const m = mod(k, N);
  if (m === 0) return 1;
  return Math.min(m, max);
}

/** The places (0..25) of the letters in a coded line. */
const placesOf = (coded: string) => new Set([...coded.toUpperCase()].filter((c) => c >= "A" && c <= "Z").map((c) => c.charCodeAt(0) - A));

export function Decoder({ target, state, onSet, onChange, busy, width }: MechanismProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const feedback = useFeedback();
  const cipher = useCipher();
  const domain = domainOf(target, "offset");
  const max = Math.min(domain?.kind === "offset" ? domain.max : N - 1, N - 1);
  const committed = valid(Number(state.offset) || 1, max);
  const [shown, setShown] = useState(committed);
  const [turned, setTurned] = useState(false);

  const numeric = cipher.numeric;
  const band = numeric ? 32 : 26;
  const D = Math.min(width - 2 * SIDE, 206);
  const R = D / 2;
  const inner = D - 2 * band;
  const pos = useSharedValue(committed);
  const start = useSharedValue(0);
  const acc = useSharedValue(0);
  const last = useSharedValue(0);
  const live = useSharedValue(false);
  const enabled = useSharedValue(!busy);
  const reduced = useSharedValue(reducedMotion);
  useEffect(() => {
    enabled.set(!busy);
    reduced.set(reducedMotion);
  }, [busy, reducedMotion, enabled, reduced]);

  useEffect(() => {
    if (live.get()) return;
    setShown(committed);
    const here = pos.get();
    const target = here + (((committed - here) % N) + N + N / 2) % N - N / 2;
    pos.set(withTiming(target, settle(reducedMotion)));
  }, [committed, reducedMotion, pos, live]);

  const passed = useCallback((k: number) => {
    feedback.tick();
    setTurned(true);
    setShown(mod(k, N));
    onChange?.();
  }, [feedback, onChange]);
  const commit = useCallback((k: number) => {
    setShown(k);
    onSet("offset", String(k));
  }, [onSet]);

  useAnimatedReaction(
    () => Math.round(pos.get()),
    (now, before) => {
      if (before !== null && now !== before && live.get()) scheduleOnRN(passed, now);
    },
  );

  const pan = usePanGesture({
    enabled,
    maxPointers: 1,
    minDistance: 3,
    onActivate: (e) => {
      "worklet";
      cancelAnimation(pos);
      start.set(pos.get());
      acc.set(0);
      last.set((Math.atan2(e.x - R, -(e.y - R)) * 180) / Math.PI);
      live.set(true);
    },
    onUpdate: (e) => {
      "worklet";
      const a = (Math.atan2(e.x - R, -(e.y - R)) * 180) / Math.PI;
      let d = a - last.get();
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      last.set(a);
      acc.set(acc.get() + d);
      // The inner disc follows the finger: turning it anticlockwise brings later letters under A.
      pos.set(start.get() - acc.get() / STEP);
    },
    onDeactivate: () => {
      "worklet";
      const r = Math.round(pos.get());
      const m = ((r % N) + N) % N;
      const k = m === 0 ? 1 : Math.min(m, max);
      const dest = r + (k - m);
      pos.set(withTiming(dest, { duration: reduced.get() ? 0 : 160 }, (finished) => {
        if (finished) live.set(false);
      }));
      scheduleOnRN(commit, k);
    },
  });

  const discStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${-pos.get() * STEP}deg` }] }));

  const step = (delta: 1 | -1) => {
    if (busy) return;
    let next = valid(shown, max) + delta;
    if (next > max) next = 1;
    if (next < 1) next = max;
    feedback.tick();
    setTurned(true);
    commit(next);
  };

  const k = mod(shown, N);
  const coded = cipher.coded;
  const places = coded ? placesOf(coded) : new Set<number>();
  // The plain letters the coded ones sit under at this setting: lit on the outer ring.
  const lit = new Set([...places].map((p) => mod(p - k, N)));
  const reads = cipher.solved && cipher.solved.offset === k;
  const under = LETTERS[k];

  return (
    <Stage width={width} style={styles.stage}>
      <CodedLine coded={coded} source={cipher.source} k={k} numeric={numeric} reads={reads ? cipher.solved?.note ?? "" : null} width={width} />
      <View style={styles.row}>
        {/* Which way: a turn arrow until the ring has been turned once. */}
        <View style={styles.side} pointerEvents="none">
          {!turned && committed === 1 ? (
            <>
              <ArrowsClockwiseIcon size={26} color={theme.inkMuted} weight="bold" />
              <Text style={[handType(theme).small, { color: theme.inkMuted }]}>turn the ring</Text>
            </>
          ) : null}
        </View>
        <GestureDetector gesture={pan}>
          <View
            {...adjustable("Cipher ring", `Ring at plus ${k}: A reads as ${under}`, step)}
            testID="mech-decoder"
            style={[styles.ring, { width: D, height: D, borderRadius: R }]}
          >
            <WheelFace size={D} />
            <OuterRing size={D} lit={lit} numeric={numeric} ink={ENGRAVED} muted="#4A3413" accent={LIT} />
            <Animated.View style={[styles.disc, { width: inner, height: inner, borderRadius: inner / 2 }, discStyle]}>
              <DiscFace size={inner} />
              <InnerRing size={inner} marked={places} ink={ENAMEL.ink} mark={theme.accent} markInk={theme.accentInk} />
            </Animated.View>
            {/* The index at twelve: plain A over the letter it becomes. */}
            <View pointerEvents="none" style={[styles.window, { height: band + 22 }]} />
          </View>
        </GestureDetector>
        {/* The setting, written the way the clue writes it. */}
        <View style={styles.side} pointerEvents="none" testID="mech-decoder-setting">
          <Text style={[ref.type.tag, { color: theme.inkMuted }]}>ring</Text>
          <Text style={[styles.setting, { color: theme.ink }]} testID="mech-decoder-offset">+{k}</Text>
          <Text style={[ref.type.meta, { color: theme.inkMuted }]}>
            A <Text style={{ color: theme.inkMuted }}>→</Text> <Text style={[styles.under, { color: theme.stamp }]} testID="mech-decoder-letter">{under}</Text>
          </Text>
        </View>
      </View>
    </Stage>
  );
}

/**
 * The coded line on a slip of paper, each coded letter over what it reads at this setting. Before its
 * card is found, one line saying there's something to find.
 */
function CodedLine({ coded, source, k, numeric, reads, width }: {
  coded: string | null; source: string | null; k: number; numeric: boolean; width: number;
  /** Set where the decoded note was shown: the note's words (or ""), stamped on the slip. */
  reads: string | null;
}) {
  const theme = useModeTheme();
  const p = journalPalette(theme);
  const hand = handType(theme);
  if (!coded) {
    return (
      <View style={[styles.slip, styles.slipEmpty, { borderColor: theme.rim }]} testID="mech-decoder-line">
        <Text style={[hand.small, { color: theme.inkMuted, textAlign: "center" }]}>No coded message yet. Find one, then turn the ring to read it.</Text>
      </View>
    );
  }
  const chars = [...coded];
  const cell = Math.max(14, Math.min(26, (width - 120) / Math.max(1, chars.length)));
  return (
    <View style={[styles.slip, { backgroundColor: p.note }]} testID="mech-decoder-line" accessible accessibilityLabel={`${source ?? "Coded line"}: ${coded}. At this setting it reads ${decodeLine(coded, k, numeric)}`}>
      <View style={styles.slipLabels}>
        <Text style={[styles.slipLabel, { color: p.inkSoft }]} numberOfLines={1}>{source ?? "Coded"}</Text>
        <Text style={[styles.slipLabel, { color: reads !== null ? p.marker : p.pen }]}>{reads !== null ? "It reads" : "Reads"}</Text>
      </View>
      <View style={styles.cells}>
        {chars.map((c, i) => {
          const letter = /[A-Za-z]/.test(c);
          const plain = letter ? readChar(c, k, numeric) : c;
          return (
            <View key={i} style={[styles.cell, { width: c === " " ? cell * 0.5 : cell }]}>
              <Text style={[styles.coded, { color: p.inkSoft, fontSize: Math.min(18, cell * 0.8), lineHeight: Math.min(18, cell * 0.8) * 1.2 }]}>{c}</Text>
              <View style={[styles.tick, { backgroundColor: letter ? p.rule : "transparent" }]} />
              <Animated.Text
                key={`${i}-${plain}`}
                entering={letter ? FadeIn.duration(140) : undefined}
                testID={letter ? `mech-decoder-reads-${i}` : undefined}
                style={[styles.plain, { fontFamily: hand.family, color: reads !== null ? p.marker : p.pen, fontSize: Math.min(26, cell), lineHeight: Math.min(26, cell) * 1.25 }]}
              >
                {plain}
              </Animated.Text>
            </View>
          );
        })}
      </View>
      {reads !== null ? (
        <View pointerEvents="none" style={[styles.stamp, { borderColor: p.marker }]} testID="mech-decoder-decoded">
          <Text style={[styles.stampText, { color: p.marker }]}>Decoded</Text>
          {reads ? <Text style={[hand.small, { color: p.marker, textAlign: "center" }]}>{reads}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

function readChar(c: string, k: number, numeric: boolean) {
  const i = mod(c.toUpperCase().charCodeAt(0) - A - k, N);
  return numeric && i < 10 ? String(i) : LETTERS[i];
}
const decodeLine = (coded: string, k: number, numeric: boolean) => [...coded].map((c) => (/[A-Za-z]/.test(c) ? readChar(c, k, numeric) : c)).join("");

/** Engraved in brass, and a letter in play picked out in oxblood. */
const ENGRAVED = "#2A1A0C";
const LIT = "#7A1420";

/** The wheel: turned brass, lit from the upper left, a bead inside its rim, its shadow under it. */
const WheelFace = memo(function WheelFace({ size }: { size: number }) {
  const g = useGradId()("wf");
  const r = size / 2;
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={g.id} x1="0.12" y1="0" x2="0.88" y2="1">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.3" stopColor={BRASS.light} />
          <Stop offset="0.62" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.shade} />
        </LinearGradient>
      </Defs>
      <Circle cx={r} cy={r} r={r - 1.2} fill={g.url} stroke={INK} strokeWidth={2} />
      <Circle cx={r} cy={r} r={r - 4} fill="none" stroke={BRASS.deep} strokeOpacity={0.55} strokeWidth={1} />
    </Svg>
  );
});

/** The turning disc: cream enamel, dark where it sits down into the wheel, a knurled brass boss at its middle to turn it by. */
const DiscFace = memo(function DiscFace({ size }: { size: number }) {
  const g = useGradId();
  const [face, boss] = [g("df"), g("db")];
  const r = size / 2, b = size * 0.17;
  let knurl = "";
  for (let i = 0; i < 24; i++) {
    const a = (i * 15 * Math.PI) / 180;
    knurl += `M${(r + Math.sin(a) * (b - 4)).toFixed(1)} ${(r - Math.cos(a) * (b - 4)).toFixed(1)}L${(r + Math.sin(a) * b).toFixed(1)} ${(r - Math.cos(a) * b).toFixed(1)}`;
  }
  return (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient id={face.id} cx="42%" cy="38%" rx="70%" ry="70%">
          <Stop offset="0" stopColor={ENAMEL.light} />
          <Stop offset="0.75" stopColor={ENAMEL.mid} />
          <Stop offset="1" stopColor={ENAMEL.shade} />
        </RadialGradient>
        <RadialGradient id={boss.id} cx="38%" cy="32%" rx="72%" ry="72%">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.5" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </RadialGradient>
      </Defs>
      <Circle cx={r + 0.6} cy={r + 1.6} r={r} fill="#000000" fillOpacity={0.3} />
      <Circle cx={r} cy={r} r={r - 1} fill={face.url} stroke={INK} strokeWidth={1.8} />
      <Circle cx={r} cy={r} r={r - 21} fill="none" stroke={ENAMEL.ink} strokeOpacity={0.3} strokeWidth={0.8} />
      <Circle cx={r + 1} cy={r + 2} r={b + 1} fill="#000000" fillOpacity={0.25} />
      <Circle cx={r} cy={r} r={b} fill={boss.url} stroke={INK} strokeWidth={1.6} />
      <Path d={knurl} stroke={BRASS.deep} strokeOpacity={0.8} strokeWidth={1.3} />
      <Circle cx={r} cy={r} r={b * 0.42} fill={BRASS.light} stroke={INK} strokeWidth={1.1} />
    </Svg>
  );
});

/** The plain alphabet round the rim, upright at its own angle as a printed wheel; A..J carry 0..9 for a code. */
const OuterRing = memo(function OuterRing({ size, lit, numeric, ink, muted, accent }: { size: number; lit: Set<number>; numeric: boolean; ink: string; muted: string; accent: string }) {
  return (
    <>
      {LETTERS.map((l, i) => {
        const on = lit.has(i);
        return (
          <View key={l} pointerEvents="none" style={[styles.spoke, { width: size, height: size, transform: [{ rotate: `${i * STEP}deg` }] }]}>
            <Text style={[styles.letter, { color: on ? accent : ink, marginTop: 5 }, on && styles.lit]}>{l}</Text>
            {numeric && i < 10 ? <Text style={[styles.digit, { color: on ? accent : muted }]}>{i}</Text> : null}
          </View>
        );
      })}
    </>
  );
});

/** The cipher alphabet on the turning disc; the coded line's letters are marked on it. */
const InnerRing = memo(function InnerRing({ size, marked, ink, mark, markInk }: { size: number; marked: Set<number>; ink: string; mark: string; markInk: string }) {
  return (
    <>
      {LETTERS.map((l, i) => {
        const on = marked.has(i);
        return (
          <View key={l} pointerEvents="none" style={[styles.spoke, { width: size, height: size, transform: [{ rotate: `${i * STEP}deg` }] }]}>
            <View style={[styles.innerCell, on && { backgroundColor: mark }]}>
              <Text style={[styles.innerLetter, { color: on ? markInk : ink }]}>{l}</Text>
            </View>
          </View>
        );
      })}
    </>
  );
});

const styles = StyleSheet.create({
  stage: { gap: ref.space.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  side: { width: SIDE, alignItems: "center", justifyContent: "center", gap: 2 },
  ring: { alignItems: "center", justifyContent: "center" },
  disc: { position: "absolute", alignItems: "center", justifyContent: "center" },
  spoke: { position: "absolute", alignItems: "center" },
  letter: { ...ref.type.label, fontVariant: ["tabular-nums"] },
  lit: { fontWeight: "800", transform: [{ scale: 1.25 }] },
  digit: { fontSize: 9, lineHeight: 11, fontWeight: "700", marginTop: 1 },
  innerLetter: { fontSize: 12, lineHeight: 15, fontWeight: "600" },
  innerCell: { marginTop: 3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  // The index bracket: an oxblood line round the pair that reads.
  window: { position: "absolute", top: 1, width: 26, borderWidth: 2, borderRadius: ref.radius.tag, borderColor: LIT },
  setting: { fontFamily: ref.font.typewriterBold, fontSize: 30, lineHeight: 36 },
  under: { fontFamily: ref.font.typewriterBold, fontSize: 15, lineHeight: 18 },
  slip: {
    minHeight: 56, alignSelf: "stretch", marginHorizontal: ref.space.sm, borderRadius: 3, paddingVertical: 3, paddingHorizontal: ref.space.plate,
    flexDirection: "row", alignItems: "center", gap: ref.space.sm, transform: [{ rotate: "-0.8deg" }],
  },
  slipEmpty: { borderWidth: 1, borderStyle: "dashed", justifyContent: "center", transform: [] },
  slipLabels: { width: 64, gap: 10 },
  slipLabel: { fontFamily: ref.font.typewriter, fontSize: 11, lineHeight: 14, textTransform: "uppercase", letterSpacing: 0.5 },
  cells: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "flex-start" },
  cell: { alignItems: "center" },
  coded: { fontFamily: ref.font.typewriterBold },
  tick: { width: 1, height: 4 },
  plain: { textAlign: "center" },
  stamp: { position: "absolute", right: 8, top: 6, borderWidth: 1.5, borderRadius: 4, paddingHorizontal: 5, transform: [{ rotate: "-8deg" }] },
  stampText: { fontFamily: ref.font.typewriterBold, fontSize: 11, lineHeight: 14, textTransform: "uppercase", letterSpacing: 1 },
});
