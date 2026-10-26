// Case closed, per mode (docs/DESIGN.md, Modes · Case closed): the mode's
// ground, a centred column, then 07's pinned band of actions. Celebrates
// observation, not speed: no ranking, no stars.
// - Noir: the CASE CLOSED stamp slams down in brass.
// - Crime scene: the accused suspect's card under the GUILTY stamp (it
//   already slammed on the reveal, so here it is simply there).
// - Paranormal: the room in full colour again, CASE CLOSED and "The presence
//   is gone." in the mode's face.
// Then the case's name in 02's serif, the server's message and exit line,
// the time and hints on 07's cards. Under reduced motion everything fades.
import { useLayoutEffect, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Genre } from "@/lib/puzzle-types";
import { setMode, themeFor } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { Card } from "./parts";
import type { SceneSource } from "./SceneView";
import { Stamp } from "./Stamp";
import { SuspectFile, type SuspectFace } from "./SuspectFile";

const P = ref.layout.play;
const C = P.complete;
const GONE_LINE = /the presence is gone/i;

export interface CaseSummary {
  time: string;
  hints: number;
}

export interface CaseClosedProps {
  genre: Genre;
  title: string;
  message?: string;
  exit?: string;
  summary?: CaseSummary | null;
  /** Crime scene: the suspect the player accused. */
  accused?: SuspectFace | null;
  /** Paranormal: the room, shown in full colour. */
  photo?: SceneSource | null;
  /** A closing line under the stats. */
  next?: string;
  /** The pinned band, as the photo guide's foot: its pill (ModePill "ghost", the mode's accent), then quiet pills (ModePill "quiet"). */
  actions: ReactNode;
}

export function CaseClosed({ genre, title, message, exit, summary, accused, photo, next, actions }: CaseClosedProps) {
  const theme = themeFor(genre);
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  // Case closed is the mode's last screen: its parts take the mode's look.
  useLayoutEffect(() => setMode(genre), [genre]);

  const enter = (delay: number) => FadeIn.duration(reducedMotion ? motion.reducedFade : 500).delay(reducedMotion ? 0 : delay);
  const guilty = genre === "crime_scene" && accused;
  // Paranormal says it once: not again when the case's own lines already do.
  const gone = genre === "paranormal" && ![message, exit].some((line) => line && GONE_LINE.test(line));

  return (
    <View style={[styles.root, { backgroundColor: theme.ground, paddingTop: insets.top }]} testID={`case-closed-${genre}`}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.head}>
          {guilty ? (
            <Animated.View entering={enter(0)} style={styles.accused}>
              <SuspectFile
                suspect={accused}
                size="large"
                testID="closed-accused"
                stamp={<Stamp text="Guilty" size="large" testID="closed-guilty" />}
                stampLabel="Guilty"
              />
            </Animated.View>
          ) : null}
          {genre === "paranormal" && photo ? (
            <Animated.View entering={enter(0)} style={styles.photoFrame}>
              <Image
                source={photo}
                style={styles.photo}
                contentFit="cover"
                accessible
                accessibilityLabel="The room, back to its own colours"
                testID="closed-photo"
              />
            </Animated.View>
          ) : null}
          {!guilty ? (
            <Stamp
              text="Case closed"
              size="large"
              slam={genre === "noir"}
              style={styles.stamp}
              testID="closed-stamp"
            />
          ) : null}
          {gone ? (
            <Animated.Text entering={enter(200)} style={[P.type.gone, styles.centre, { color: theme.ink }]} testID="closed-gone">
              The presence is gone.
            </Animated.Text>
          ) : null}
          <Animated.View entering={enter(genre === "noir" ? P.stamp.slamDelay : 150)} style={styles.titleBlock}>
            <Text style={[P.type.caseTitle, styles.centre, { color: theme.ink }]} accessibilityRole="header">{title}</Text>
            {message ? <Text style={[P.type.body, styles.centre, styles.message, { color: theme.ink }]}>{message}</Text> : null}
            {exit ? <Text style={[ref.type.subtitle, styles.centre, styles.exit, { color: theme.inkMuted }]}>{exit}</Text> : null}
          </Animated.View>
        </View>

        {summary ? (
          <Animated.View entering={enter(400)} style={styles.stats}>
            <Card style={styles.stat}>
              <View accessible accessibilityLabel={`Time: ${summary.time}`} style={styles.statInner}>
                <Text style={[ref.type.meta, { color: theme.inkMuted }]}>Time</Text>
                <Text style={[P.type.stat, { color: theme.ink }]}>{summary.time}</Text>
              </View>
            </Card>
            <Card style={styles.stat}>
              <View accessible accessibilityLabel={`Hints used: ${summary.hints}`} style={styles.statInner}>
                <Text style={[ref.type.meta, { color: theme.inkMuted }]}>Hints used</Text>
                <Text style={[P.type.stat, { color: theme.ink }]}>{summary.hints}</Text>
              </View>
            </Card>
          </Animated.View>
        ) : null}

        {next ? (
          <Animated.View entering={enter(600)}>
            <Text style={[P.type.hint, styles.centre, { color: theme.inkMuted }]}>{next}</Text>
          </Animated.View>
        ) : null}
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: insets.bottom + ref.space.ctaBottom }]}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: C.inset, paddingVertical: ref.space.xxl, gap: C.gap.stats },
  head: { alignItems: "center", gap: C.gap.tag },
  accused: { alignSelf: "stretch", marginBottom: C.gap.tag },
  photoFrame: { alignSelf: "stretch", aspectRatio: C.photo.aspect, borderRadius: C.photo.radius, overflow: "hidden", ...ref.curve },
  photo: { width: C.photo.width, height: C.photo.width },
  stamp: { alignSelf: "center", marginVertical: P.stamp.tiltRoom },
  titleBlock: { alignItems: "center", alignSelf: "stretch" },
  centre: { textAlign: "center" },
  message: { marginTop: C.gap.title * 2 },
  exit: { marginTop: C.gap.title },
  stats: { flexDirection: "row", gap: ref.space.sm },
  stat: { flex: 1 },
  statInner: { gap: ref.space.xs },
  // The photo guide's foot: its reading column, the pill to the quiet buttons ref.space.sm apart.
  actions: { paddingTop: ref.space.lg, paddingHorizontal: ref.space.reading, gap: ref.space.sm },
});
