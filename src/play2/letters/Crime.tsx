// Crime Scene's correspondence (src/play2/letters): a case intake sheet
// slid out of a kraft evidence envelope (its flap and string-and-button tie
// showing behind), two holes punched down its margin. The form's printed
// oxblood labels and rules; the case's number typed in a ruled box with a
// CONFIDENTIAL stamp that didn't take evenly; a print of her own room
// paper-clipped to the corner; the summary typed into its box; the
// assignment filled in by hand in blue ballpoint on the form's lines; the
// cat's line on a sticky note stuck over the foot. The cat sits by it.
//
// The reply, at the way out: the file's closing sheet, the door she walked
// out of clipped to it, the headline printed heavy, the ending typed, and
// "The End" stamped across the foot in red; the cat sits on the sheet, its
// red paw prints leading from the stamp (it stepped in the pad).
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Path } from "react-native-svg";
import { TreatedImage } from "@/components/noir";
import { LETTER, LETTER_FONT, alpha, handType } from "@/theme/payoff";
import { modeThemes } from "@/theme/tokens";
import { keepTogether, splitHead } from "./paper";
import { Paper } from "./Paper";
import { PaperClip, PawPrints, Punched, RubberStamp, StringTie } from "./Marks";
import { LetterCat } from "./LetterCat";
import type { BriefLetterProps, Photo, ReplyLetterProps } from "./types";

const P = LETTER.crime_scene;
const DESK = modeThemes.crime_scene.ground;
export const CRIME_TYPE = {
  series: { fontFamily: LETTER_FONT.form, fontSize: 15, lineHeight: 19 },
  label: { fontFamily: LETTER_FONT.form, fontSize: 13, lineHeight: 16, letterSpacing: 1.1, textTransform: "uppercase" },
  caseNo: { fontFamily: LETTER_FONT.reportBold, fontSize: 17, lineHeight: 22, letterSpacing: 0.5 },
  typed: { fontFamily: LETTER_FONT.report, fontSize: 16, lineHeight: 23 },
  stamp: { fontFamily: LETTER_FONT.formHeavy, fontSize: 14, lineHeight: 17, letterSpacing: 1.6, textTransform: "uppercase" },
  bigStamp: { fontFamily: LETTER_FONT.formHeavy, fontSize: 30, lineHeight: 34, letterSpacing: 2, textTransform: "uppercase" },
  headline: { fontFamily: LETTER_FONT.formHeavy, fontSize: 40, lineHeight: 43, letterSpacing: -0.6 },
  replyTyped: { fontFamily: LETTER_FONT.report, fontSize: 18, lineHeight: 26 },
} as const;
const PRINT = 104;
const CAT = 70;

/** A print of the room, paper-clipped on. */
function Print({ photo, tilt, width = PRINT }: { photo: Photo; tilt: number; width?: number }) {
  return (
    <View style={[styles.print, { width, transform: [{ rotate: `${tilt}deg` }] }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.photo, { height: width - 14 }]}>
        <TreatedImage source={photo.source} cacheKey={photo.cacheKey} genre="crime_scene" style={StyleSheet.absoluteFill} accessible={false} />
        <View style={[StyleSheet.absoluteFill, styles.gloss]} />
      </View>
      <PaperClip color={P.clip} size={54} rotate={8} style={styles.printClip} />
    </View>
  );
}

/** Ruled lines under handwriting, one per line of it, as a form's lines are. */
function Ruled({ lineHeight, children }: { lineHeight: number; children: React.ReactNode }) {
  const [h, setH] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setH(e.nativeEvent.layout.height);
  const lines = Math.max(1, Math.round(h / lineHeight));
  return (
    <View onLayout={onLayout}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: lines }, (_, i) => (
          <View key={i} style={[styles.line, { top: (i + 1) * lineHeight - 4, backgroundColor: P.rule }]} />
        ))}
      </View>
      {children}
    </View>
  );
}

/** The envelope behind the sheet: kraft, its flap's edge and the tie. */
function Envelope({ seed }: { seed: string }) {
  return (
    <View style={styles.envelope} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Paper color={P.kraft} seed={`${seed}:env`} grain={0.7} age={0.35} ageColor="#6B4420" shade={alpha("#000000", 0.5)} style={StyleSheet.absoluteFill} />
      <View style={StyleSheet.absoluteFill}>
        <Svg width="100%" height={60}>
          <Path d="M0 2 L140 40 L1000 40" stroke={P.kraftDeep} strokeWidth={1.4} fill="none" />
          <Path d="M0 4 L140 42 L1000 42" stroke={alpha("#FFFFFF", 0.25)} strokeWidth={1} fill="none" />
        </Svg>
      </View>
      <StringTie card={P.kraftDeep} string="#E8DCC4" style={styles.tie} />
    </View>
  );
}

export function CrimeBrief({ label, series, context, objective, objectiveLabel, postscript, catLabel, catDelay, photo }: BriefLetterProps) {
  return (
    <View style={styles.wrap}>
      <Envelope seed={label} />
      <Paper color={P.paper} seed={label} grain={0.4} age={0.08} ageColor="#9A7A50" shade={P.shade} style={styles.sheet} padding={styles.pad} testID="brief-page">
        <Punched desk={DESK} gap={170} style={styles.holes} />
        <View style={[styles.header, photo ? { paddingRight: PRINT - 18 } : null]}>
          <Text style={[CRIME_TYPE.series, { color: P.form }]}>{series}</Text>
          <View style={[styles.heavyRule, { backgroundColor: P.form }]} />
          <View style={styles.caseRow}>
            <View style={[styles.caseBox, { borderColor: P.form }]}>
              <Text style={[CRIME_TYPE.caseNo, { color: P.ink }]} accessibilityRole="header" testID="brief-case">{label.toUpperCase()}</Text>
            </View>
          </View>
        </View>
        <View style={styles.field}>
          <RubberStamp text="Confidential" color={P.stamp} paper={P.paper} seed={label} rotate={-7} type={CRIME_TYPE.stamp} style={styles.confidential} />
          <Text style={[CRIME_TYPE.label, { color: P.form }]}>Summary</Text>
          <View style={[styles.box, { borderColor: P.rule }]}>
            <Text style={[CRIME_TYPE.typed, { color: P.ink }]} testID="brief-context">{context}</Text>
          </View>
        </View>
        <View style={styles.field} accessible accessibilityLabel={`${objectiveLabel}: ${objective}`} testID="brief-objective">
          <Text style={[CRIME_TYPE.label, { color: P.form }]}>{objectiveLabel}</Text>
          <Ruled lineHeight={27}>
            <Text style={[handType(21, 27), styles.filled, { color: P.pen }]}>{objective}</Text>
          </Ruled>
        </View>
      </Paper>
      {photo ? <View style={styles.printAt}><Print photo={photo} tilt={5} /></View> : null}
      {/* The sticky note with the cat's word. */}
      <Paper color={P.note} seed={`${label}:note`} grain={0.45} shade={alpha("#000000", 0.45)} lift={0.8} style={styles.note} padding={styles.notePad}>
        <Text style={[handType(19, 23), { color: P.noteInk }]} testID="brief-postscript">{keepTogether(postscript)}</Text>
      </Paper>
      <LetterCat width={CAT} delay={catDelay} label={catLabel} style={styles.cat} />
    </View>
  );
}

export function CrimeReply({ head, headline, text, seed, catLabel, catDelay, door }: ReplyLetterProps) {
  const [series, caseNo] = splitHead(head);
  return (
    <View style={styles.replyWrap}>
      <Paper color={P.paper} seed={`${seed}:closing`} grain={0.4} age={0.08} ageColor="#9A7A50" shade={P.shade} lift={1.4} style={styles.replySheet} padding={styles.replyPad}>
        <Punched desk={DESK} gap={150} style={styles.holes} />
        <View style={[styles.replyHead, door ? styles.replyHeadDoor : null]} testID="v2-ending-head" accessible accessibilityLabel={head}>
          <Text style={[CRIME_TYPE.series, { color: P.form }]}>{series}</Text>
          <View style={[styles.heavyRule, { backgroundColor: P.form }]} />
          {caseNo ? (
            <View style={[styles.caseBox, styles.replyCase, { borderColor: P.form }]}>
              <Text style={[CRIME_TYPE.caseNo, { color: P.ink }]}>{caseNo.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[CRIME_TYPE.headline, { color: P.ink }]} accessibilityRole="header" testID="v2-ending-headline">{keepTogether(headline)}</Text>
        {text ? <Text style={[CRIME_TYPE.replyTyped, styles.replyText, { color: P.ink }]} testID="v2-ending-text">{text}</Text> : null}
        <View style={styles.spacer} />
        <RubberStamp text="The End" color={P.stamp} paper={P.paper} seed={seed} rotate={-9} type={CRIME_TYPE.bigStamp} style={styles.endStamp} testID="v2-ending-end" accessible />
        <PawPrints color={P.stamp} seed={seed} width={200} height={90} size={16} path={[[14, 70], [50, 66], [86, 58], [122, 52], [158, 40]]} style={styles.paws} />
      </Paper>
      {door ? <View style={styles.doorAt}><Print photo={door} tilt={6} width={112} /></View> : null}
      <LetterCat width={116} delay={catDelay} label={catLabel} style={styles.replyCat} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 40, paddingBottom: 70 },
  envelope: { position: "absolute", top: 0, left: -6, right: 18, height: 230, transform: [{ rotate: "-3.5deg" }] },
  tie: { position: "absolute", top: 2, left: 30 },
  sheet: { transform: [{ rotate: "-0.9deg" }] },
  pad: { paddingLeft: 34, paddingRight: 20, paddingTop: 20, paddingBottom: 40, gap: 16 },
  holes: { position: "absolute", left: 8, top: 60 },
  header: { gap: 8 },
  heavyRule: { height: 2.5 },
  caseRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  caseBox: { borderWidth: 1.2, paddingHorizontal: 8, paddingTop: 3, paddingBottom: 2 },
  confidential: { position: "absolute", right: 6, top: -8, zIndex: 2 },
  field: { gap: 6 },
  box: { borderWidth: 1, padding: 10, paddingTop: 8 },
  filled: { transform: [{ rotate: "-0.6deg" }], paddingLeft: 2 },
  line: { position: "absolute", left: 0, right: 0, height: 1 },
  printAt: { position: "absolute", top: 4, right: 4 },
  print: { backgroundColor: "#FFFDF8", padding: 7, paddingBottom: 24, boxShadow: "0px 6px 14px rgba(0, 0, 0, 0.35)" },
  photo: { backgroundColor: "#1A1418", overflow: "hidden" },
  gloss: { backgroundColor: "rgba(255, 255, 255, 0.06)" },
  printClip: { position: "absolute", top: -18, left: 18 },
  note: { position: "absolute", left: 18, bottom: 0, width: 200, transform: [{ rotate: "-3deg" }] },
  notePad: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 16 },
  cat: { position: "absolute", right: 12, bottom: 4 },
  // The reply.
  replyWrap: { paddingTop: 12, paddingBottom: 26 },
  replySheet: { transform: [{ rotate: "1deg" }] },
  replyPad: { paddingLeft: 36, paddingRight: 22, paddingTop: 22, paddingBottom: 40, gap: 16, minHeight: 420 },
  replyHead: { gap: 8 },
  replyHeadDoor: { paddingRight: PRINT - 4, minHeight: 104 },
  spacer: { flexGrow: 1, minHeight: 4 },
  replyCase: { alignSelf: "flex-start", marginTop: 2 },
  replyText: { marginTop: -2 },
  endStamp: { marginTop: 10, marginLeft: 6 },
  paws: { position: "absolute", right: 96, bottom: 30 },
  doorAt: { position: "absolute", top: 0, right: 2 },
  replyCat: { position: "absolute", right: 4, bottom: 14 },
});
