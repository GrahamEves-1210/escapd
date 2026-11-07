// Detective Noir's correspondence (src/play2/letters): a letter typed on thin
// hotel onion-skin, folded in three and opened out, a second sheet showing
// under it, a paper clip on its corner. The letterhead engraved in plum (the
// series line, under a fine double rule), the case's number typed where a
// date would go, the brief struck out on a worn typewriter (each word's ink
// its own, one word misspelled and x'd out), what she's to find typed in the
// ribbon's red half, and the cat's line added by hand in fountain-pen ink
// with a lipstick blot beside it. The cat sits on the desk at its corner.
//
// The reply, at the way out: a hotel notecard from the same stationery, the
// headline typed large, the ending under it, "The End" by hand (no second
// lipstick blot: the brief's one is the trope, once); the cat sitting on the
// card, and its inky paw prints walked across it.
import { StyleSheet, Text, View } from "react-native";
import { LETTER, LETTER_FONT, handType } from "@/theme/payoff";
import { keepTogether, splitHead } from "./paper";
import { Paper } from "./Paper";
import { Kiss, PaperClip, PawPrints } from "./Marks";
import { Typed } from "./Typed";
import { LetterCat } from "./LetterCat";
import type { BriefLetterProps, ReplyLetterProps } from "./types";

const P = LETTER.noir;
export const NOIR_TYPE = {
  head: { fontFamily: LETTER_FONT.engraved, fontSize: 16, lineHeight: 21 },
  ref: { fontFamily: LETTER_FONT.typewriter, fontSize: 15, lineHeight: 20 },
  body: { fontFamily: LETTER_FONT.typewriter, fontSize: 17, lineHeight: 26 },
  headline: { fontFamily: LETTER_FONT.typewriter, fontSize: 38, lineHeight: 44 },
  replyBody: { fontFamily: LETTER_FONT.typewriter, fontSize: 19, lineHeight: 29 },
} as const;
const CAT = 74;

function Letterhead({ text, right }: { text: string; right?: string }) {
  return (
    <View style={styles.letterhead}>
      <View style={styles.headRow}>
        <Text style={[NOIR_TYPE.head, { color: P.head }]}>{text}</Text>
        {right ? <Text style={[NOIR_TYPE.ref, styles.folio, { color: P.muted }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{right}</Text> : null}
      </View>
      <View style={[styles.rule, { backgroundColor: P.head }]} />
      <View style={[styles.ruleThin, { backgroundColor: P.head }]} />
    </View>
  );
}

export function NoirBrief({ label, series, context, objective, objectiveLabel, postscript, catLabel, catDelay }: BriefLetterProps) {
  return (
    <View style={styles.wrap}>
      {/* The sheet under it. */}
      <Paper color={P.under} seed={`${label}:under`} shade={P.shade} grain={0.45} style={[StyleSheet.absoluteFill, styles.under]} />
      <Paper
        color={P.paper}
        seed={label}
        folds={[0.35, 0.68]}
        ring={{ x: 0.12, y: 0.06, r: 0.16 }}
        grain={0.55}
        age={0.18}
        ageColor="#B07A62"
        shade={P.shade}
        style={styles.sheet}
        padding={styles.pad}
        testID="brief-page"
      >
        <Letterhead text={series} />
        <Text style={[NOIR_TYPE.ref, styles.ref, { color: P.ink }]} accessibilityRole="header" testID="brief-case">{label}</Text>
        <Typed text={context} seed={label} color={P.ink} style={NOIR_TYPE.body} slip testID="brief-context" />
        <View style={styles.objective} accessible accessibilityLabel={`${objectiveLabel}: ${objective}`} testID="brief-objective">
          <Text style={[NOIR_TYPE.body, styles.underlined, { color: P.ribbon, textDecorationColor: P.ribbon }]}>{`${objectiveLabel}:`}</Text>
          <Typed text={objective} seed={`${label}:goal`} color={P.ribbon} style={NOIR_TYPE.body} />
        </View>
        <View style={styles.signoff}>
          <Text style={[handType(21, 25), styles.hand, { color: P.pen }]} testID="brief-postscript">{keepTogether(postscript)}</Text>
          <Kiss color={P.lipstick} paper={P.paper} seed={label} width={52} rotate={-12} style={styles.kiss} />
        </View>
      </Paper>
      <PaperClip color={P.clip} size={62} rotate={-4} style={styles.clip} />
      <LetterCat width={CAT} delay={catDelay} label={catLabel} style={styles.cat} />
    </View>
  );
}

export function NoirReply({ head, headline, text, seed, catLabel, catDelay }: ReplyLetterProps) {
  const [series, caseNo] = splitHead(head);
  return (
    <View style={styles.replyWrap}>
      <Paper color={P.paper} seed={`${seed}:reply`} grain={0.55} age={0.16} ageColor="#B07A62" shade={P.shade} lift={1.4} style={styles.card} padding={styles.cardPad}>
        <View testID="v2-ending-head" accessible accessibilityLabel={head} style={styles.replyHead}>
          <Letterhead text={series} />
          {caseNo ? <Text style={[NOIR_TYPE.ref, styles.ref, { color: P.ink }]}>{caseNo}</Text> : null}
        </View>
        <Text style={[NOIR_TYPE.headline, { color: P.ink }]} accessibilityRole="header" testID="v2-ending-headline">{keepTogether(headline)}</Text>
        {text ? <Typed text={text} seed={seed} color={P.ink} style={[NOIR_TYPE.replyBody, styles.replyText]} testID="v2-ending-text" /> : null}
        <View style={styles.spacer} />
        <View style={styles.endRow} accessible accessibilityLabel="The End" testID="v2-ending-end">
          <Text style={[handType(38, 42), styles.theEnd, { color: P.pen }]}>The End</Text>
        </View>
        <PawPrints color={P.ink} seed={seed} width={250} height={130} size={17} path={[[20, 118], [58, 112], [96, 104], [134, 96], [172, 86], [208, 74]]} style={styles.paws} />
      </Paper>
      <LetterCat width={124} delay={catDelay} label={catLabel} style={styles.replyCat} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 18, paddingBottom: 30 },
  under: { top: 26, bottom: 36, left: 6, right: -2, transform: [{ rotate: "2.2deg" }] },
  sheet: { transform: [{ rotate: "-1.1deg" }] },
  pad: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 26, gap: 14 },
  letterhead: { gap: 0, marginBottom: 2 },
  headRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  folio: { fontSize: 14 },
  rule: { height: 1.2, marginTop: 6, opacity: 0.8 },
  ruleThin: { height: 0.6, marginTop: 2, opacity: 0.6 },
  ref: { alignSelf: "flex-end", marginTop: -2 },
  objective: { gap: 2, marginTop: 2 },
  underlined: { textDecorationLine: "underline", alignSelf: "flex-start" },
  signoff: { marginTop: 4, paddingRight: CAT + 8, flexDirection: "row", alignItems: "flex-end" },
  hand: { flexShrink: 1, transform: [{ rotate: "-2.5deg" }] },
  kiss: { marginLeft: -6, marginBottom: -14 },
  clip: { position: "absolute", top: 2, right: 46 },
  cat: { position: "absolute", right: 10, bottom: 34 },
  // The reply.
  replyWrap: { paddingBottom: 30 },
  card: { transform: [{ rotate: "1.4deg" }] },
  cardPad: { paddingHorizontal: 26, paddingTop: 24, paddingBottom: 96, gap: 18, minHeight: 420 },
  spacer: { flexGrow: 1, minHeight: 4 },
  theEnd: { transform: [{ rotate: "-3deg" }] },
  replyText: { marginTop: -4 },
  endRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  paws: { position: "absolute", left: 0, bottom: 4 },
  replyCat: { position: "absolute", right: 6, bottom: 12 },
  replyHead: { gap: 10 },
});
