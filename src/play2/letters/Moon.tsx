// Paranormal's correspondence (src/play2/letters): a letter on old laid
// paper, deckled all round, foxed and stained with age, folded once; its wax
// seal (a crescent moon pressed in plum wax) broken in two where it was
// opened, a candle's wax run down its top edge, a sprig of lavender pressed
// in it. Set in IM Fell, a face cut for a seventeenth-century press, in
// iron-gall ink: the series line in its italic, the case's number in the
// same ink faded, the brief, and what it wants. The cat's line is added by
// hand at the foot, and the cat sits by the letter.
//
// The reply, at the way out: the same paper, the headline in the italic, the
// ending, "The End" beside the seal, whole again; the cat on the letter.
import { StyleSheet, Text, View } from "react-native";
import { LETTER, LETTER_FONT, handType } from "@/theme/payoff";
import { hang, keepTogether } from "./paper";
import { Paper } from "./Paper";
import { PawPrints, Sprig, WaxDrop, WaxSeal } from "./Marks";
import { LetterCat } from "./LetterCat";
import type { BriefLetterProps, ReplyLetterProps } from "./types";

const P = LETTER.paranormal;
export const MOON_TYPE = {
  series: { fontFamily: LETTER_FONT.fellItalic, fontSize: 19, lineHeight: 24 },
  small: { fontFamily: LETTER_FONT.fell, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: LETTER_FONT.fell, fontSize: 18, lineHeight: 27 },
  italic: { fontFamily: LETTER_FONT.fellItalic, fontSize: 18, lineHeight: 27 },
  headline: { fontFamily: LETTER_FONT.fellItalic, fontSize: 42, lineHeight: 47 },
  replyBody: { fontFamily: LETTER_FONT.fell, fontSize: 20, lineHeight: 30 },
  end: { fontFamily: LETTER_FONT.fellItalic, fontSize: 32, lineHeight: 38 },
} as const;
const CAT = 72;

const paper = (seed: string) => ({ color: P.paper, seed, edges: "deckle" as const, grain: 0.6, age: 0.5, ageColor: P.fox, foxing: 26, foxColor: P.fox, laid: true, shade: P.shade });

/** Text whose opening quote hangs in the margin. */
function Hung({ text, style, testID }: { text: string; style: object; testID?: string }) {
  const [mark, rest] = hang(text);
  return (
    <Text style={style} testID={testID} accessibilityLabel={text}>
      {mark ? <Text style={styles.hung}>{mark}</Text> : null}
      {rest}
    </Text>
  );
}

export function MoonBrief({ label, series, context, objective, objectiveLabel, postscript, catLabel, catDelay }: BriefLetterProps) {
  return (
    <View style={styles.wrap}>
      {/* A sprig pressed in the letter, poking out from under it. */}
      <Sprig flower={P.sprig} stem={P.stem} seed={label} width={66} rotate={-52} style={styles.sprig} />
      <Paper {...paper(label)} folds={[0.5]} style={styles.sheet} padding={styles.pad} testID="brief-page">
        <View style={styles.head}>
          <Text style={[MOON_TYPE.series, { color: P.ink }]}>{series}</Text>
          <Text style={[MOON_TYPE.small, { color: P.faded }]} accessibilityRole="header" testID="brief-case">{label}</Text>
        </View>
        <Hung text={context} style={[MOON_TYPE.body, { color: P.ink }]} testID="brief-context" />
        <View style={styles.objective} accessible accessibilityLabel={`${objectiveLabel}: ${objective}`} testID="brief-objective">
          <Text style={[MOON_TYPE.italic, { color: P.faded }]}>{`${objectiveLabel}:`}</Text>
          <Text style={[MOON_TYPE.body, { color: P.ink }]}>{objective}</Text>
        </View>
        <Text style={[handType(20, 25), styles.hand, { color: P.ink }]} testID="brief-postscript">{keepTogether(postscript)}</Text>
      </Paper>
      <WaxDrop color={P.candle} seed={label} size={30} style={styles.drips} />
      <WaxSeal wax={P.wax} light={P.waxLight} deep={P.waxDeep} seed={label} broken size={88} rotate={-12} style={styles.seal} />
      <LetterCat width={CAT} delay={catDelay} label={catLabel} style={styles.cat} />
    </View>
  );
}

export function MoonReply({ head, headline, text, seed, catLabel, catDelay }: ReplyLetterProps) {
  return (
    <View style={styles.replyWrap}>
      <Sprig flower={P.sprig} stem={P.stem} seed={seed} width={56} rotate={40} style={styles.replySprig} />
      <Paper {...paper(`${seed}:reply`)} lift={1.4} style={styles.replySheet} padding={styles.replyPad}>
        <View style={styles.headRow} testID="v2-ending-head" accessible accessibilityLabel={head}>
          <Text style={[MOON_TYPE.small, styles.flex, { color: P.faded }]}>{head}</Text>
        </View>
        <Text style={[MOON_TYPE.headline, { color: P.ink }]} accessibilityRole="header" testID="v2-ending-headline">{keepTogether(headline)}</Text>
        {text ? <Hung text={text} style={[MOON_TYPE.replyBody, styles.replyText, { color: P.ink }]} testID="v2-ending-text" /> : null}
        <View style={styles.spacer} />
        <View style={styles.endRow} accessible accessibilityLabel="The End" testID="v2-ending-end">
          <WaxSeal wax={P.wax} light={P.waxLight} deep={P.waxDeep} seed={seed} size={70} rotate={8} />
          <Text style={[MOON_TYPE.end, { color: P.ink }]}>The End</Text>
        </View>
        <PawPrints color={P.faded} seed={seed} width={240} height={60} size={15} path={[[14, 44], [50, 40], [86, 36], [122, 34], [158, 26]]} style={styles.paws} />
      </Paper>
      <LetterCat width={118} delay={catDelay} label={catLabel} style={styles.replyCat} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 22, paddingBottom: 58 },
  sheet: { transform: [{ rotate: "0.8deg" }] },
  pad: { paddingHorizontal: 28, paddingTop: 30, paddingBottom: 30, gap: 14 },
  head: { gap: 2, paddingRight: 76 },
  // An opening quote set out in the margin, so the words line up on the measure.
  hung: { marginLeft: -7 },
  objective: { gap: 0 },
  hand: { transform: [{ rotate: "-1.5deg" }], paddingRight: CAT - 10, marginTop: 4 },
  drips: { position: "absolute", top: 70, right: 30 },
  seal: { position: "absolute", top: -6, right: 16 },
  sprig: { position: "absolute", left: -26, bottom: 18 },
  cat: { position: "absolute", right: 0, bottom: 0 },
  // The reply.
  replyWrap: { paddingBottom: 24 },
  replySheet: { transform: [{ rotate: "-1.2deg" }] },
  replyPad: { paddingHorizontal: 28, paddingTop: 26, paddingBottom: 76, gap: 18, minHeight: 420 },
  spacer: { flexGrow: 1, minHeight: 4 },
  headRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  flex: { flex: 1 },
  replyText: { marginTop: -4 },
  endRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
  paws: { position: "absolute", left: 20, bottom: 8 },
  replySprig: { position: "absolute", right: -14, top: -40 },
  replyCat: { position: "absolute", right: 8, bottom: 12 },
});
