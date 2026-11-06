// The casebook's margin life: what she scribbles beside the case as it goes.
// A row of leads under the objective, a question mark for each step of the
// case; each one followed is crossed out with a tick (the new ones flick in as
// the casebook opens). And a note in the margin that changes with how far
// she's got, in the mode's voice: where to start, it's coming together,
// "you're close", one more.
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from "react-native-reanimated";
import type { ModeTheme } from "@/theme/tokens";
import { Arrow, Moon, Question, Sparkle, Star, Tick } from "./Doodles";
import type { HandType, JournalPalette } from "./palette";
import { stageOf, type Stage } from "./threads";

/** What she calls the steps, by mode. */
const NOUN: Record<NonNullable<ModeTheme["genre"]>, string> = { noir: "leads", crime_scene: "leads", paranormal: "signs" };

/** The margin note for each stage of the case, by mode. */
export const MARGIN_NOTES: Record<NonNullable<ModeTheme["genre"]>, Record<Stage, string>> = {
  noir: {
    start: "every room keeps a secret…",
    going: "it's coming together",
    close: "you're close. I can feel it.",
    last: "one more piece!",
  },
  crime_scene: {
    start: "follow the evidence",
    going: "check it against the board",
    close: "you're close. Cross them off!",
    last: "nearly ready to name them",
  },
  paranormal: {
    start: "listen to the room…",
    going: "the room is answering",
    close: "you're close. The veil is thin.",
    last: "one last thing, then the ritual",
  },
};

/** One step of the case: a question mark, or (followed) one crossed out with a tick over it. */
function Lead({ done, fresh, delay, palette: p, reduced, index }: { done: boolean; fresh: boolean; delay: number; palette: JournalPalette; reduced: boolean; index: number }) {
  const pop = useSharedValue(fresh && !reduced ? 0 : 1);
  useEffect(() => {
    if (fresh && !reduced) pop.set(withDelay(delay, withSpring(1, { damping: 7, stiffness: 220 })));
    // Once, as the casebook opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tick = useAnimatedStyle(() => ({ opacity: Math.min(1, pop.get() * 1.4), transform: [{ scale: 0.3 + pop.get() * 0.7 }, { rotate: `${(1 - pop.get()) * -30}deg` }] }));
  const tilt = (index % 3) * 4 - 4;
  return (
    <View style={styles.lead}>
      <Question color={done ? p.inkSoft : p.pen} size={20} rotate={tilt} struck={done} style={done ? styles.faded : null} />
      {done ? (
        <Animated.View style={[styles.tick, tick]}>
          <Tick color={p.pen} size={22} rotate={-tilt} />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** The case's leads: one mark per step, "3 of 8 leads followed" in her hand. */
export function LeadTracker({ solved, total, ticked, genre, palette: p, hand, reduced, delay = 600 }: {
  solved: number;
  total: number;
  /** Steps solved when the casebook was last looked at: the ones since tick in. */
  ticked: number;
  genre: ModeTheme["genre"];
  palette: JournalPalette;
  hand: HandType;
  reduced: boolean;
  delay?: number;
}) {
  if (total <= 0) return null;
  const noun = NOUN[genre ?? "noir"];
  const label = `${solved} of ${total} ${noun} followed`;
  return (
    <View style={styles.tracker} accessible accessibilityLabel={label} testID="v2-casebook-leads">
      <View style={styles.marks}>
        {Array.from({ length: total }, (_, i) => (
          <Lead key={i} index={i} done={i < solved} fresh={i < solved && i >= ticked} delay={delay + Math.max(0, i - ticked) * 220} palette={p} reduced={reduced} />
        ))}
      </View>
      <Text style={[hand.small, { color: p.pen }]}>{label}</Text>
    </View>
  );
}

/** Her note in the margin for where the case stands, with a doodle in the mode's style. */
export function MarginNote({ solved, total, genre, palette: p, hand }: { solved: number; total: number; genre: ModeTheme["genre"]; palette: JournalPalette; hand: HandType }) {
  const g = genre ?? "noir";
  const stage = stageOf(solved, total);
  const text = MARGIN_NOTES[g][stage];
  const near = stage === "close" || stage === "last";
  const doodle = g === "paranormal"
    ? <Moon color={p.pen} fill={near ? p.sweet : undefined} size={22} rotate={-14} />
    : g === "crime_scene"
      ? <Star color={p.pen} fill={near ? p.sweet : undefined} size={20} rotate={-8} />
      : near ? <Tick color={p.pen} size={20} rotate={-6} /> : <Question color={p.pen} size={20} rotate={-10} />;
  return (
    <View style={styles.note} testID={`v2-casebook-margin-${stage}`}>
      <Arrow color={p.pen} size={34} style={styles.noteArrow} />
      <View style={styles.noteBody}>
        {doodle}
        <Text style={[hand.body, styles.noteText, { color: p.pen }]}>{text}</Text>
        {near ? <Sparkle color={p.foil[2]} size={10} style={styles.noteSparkle} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tracker: { gap: 2, paddingTop: 6 },
  marks: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  lead: { width: 26, height: 28, alignItems: "center", justifyContent: "center" },
  faded: { opacity: 0.55 },
  tick: { position: "absolute", left: 4, top: 1 },
  note: { flexDirection: "row", alignItems: "flex-start", alignSelf: "flex-end", maxWidth: "92%", marginTop: 2, transform: [{ rotate: "-2.5deg" }] },
  noteArrow: { marginTop: 2, transform: [{ scaleX: -1 }, { rotate: "-20deg" }] },
  noteBody: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  noteText: { flexShrink: 1 },
  noteSparkle: { position: "absolute", right: -10, top: -4 },
});
