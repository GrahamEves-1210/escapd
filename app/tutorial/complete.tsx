// Tutorial result. Celebrates observation, not speed: no ranking, no stars.
// The reference look (docs/DESIGN.md, the in-game player: Case closed): the
// camera's flat ground, a centred column with 01's tag pill (CASE CLOSED),
// the case's name in 02's serif, the server's message and the exit line, the
// time and hints on 07's cards, and 07's pinned band: the white bar, then
// two quiet pills. No grain, brass or manila.
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getLatestSession } from "@/lib/escapd-api";
import { formatDuration } from "@/game/format";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { PillButton, trackingPad } from "@/components/noir";
import { Card, WhiteBar } from "@/render/parts";

const P = ref.layout.play;
const C = P.complete;

export default function TutorialCompleteScreen() {
  const { message, exit } = useLocalSearchParams<{ message?: string; exit?: string }>();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [summary, setSummary] = useState<{ time: string; hints: number } | null>(null);

  useEffect(() => {
    getLatestSession(TUTORIAL_ROOM_ID, "completed")
      .then((s) => {
        if (!s?.completed_at) return;
        setSummary({
          time: formatDuration(new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()),
          hints: s.hints_used,
        });
      })
      .catch(() => {});
  }, []);

  const enter = (delay: number) => FadeIn.duration(reducedMotion ? motion.reducedFade : 500).delay(reducedMotion ? 0 : delay);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Animated.View entering={enter(0)} style={styles.head}>
          <View style={styles.tag}>
            <Text style={[ref.type.tag, styles.tagText, trackingPad(ref.type.tag)]}>Case closed</Text>
          </View>
          <Text style={styles.title} accessibilityRole="header">The Study</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Text style={styles.exit}>{exit || "The door swings open."}</Text>
        </Animated.View>

        {summary ? (
          <Animated.View entering={enter(250)} style={styles.stats}>
            <Card style={styles.stat}>
              <View accessible accessibilityLabel={`Time: ${summary.time}`} style={styles.statInner}>
                <Text style={styles.statLabel}>Time</Text>
                <Text style={styles.statValue}>{summary.time}</Text>
              </View>
            </Card>
            <Card style={styles.stat}>
              <View accessible accessibilityLabel={`Hints used: ${summary.hints}`} style={styles.statInner}>
                <Text style={styles.statLabel}>Hints used</Text>
                <Text style={styles.statValue}>{summary.hints}</Text>
              </View>
            </Card>
          </Animated.View>
        ) : null}

        <Animated.View entering={enter(500)}>
          <Text style={styles.next}>The next case is your own room.</Text>
        </Animated.View>
      </ScrollView>
      <View style={[styles.actions, { paddingBottom: ref.space.lg + insets.bottom }]}>
        <WhiteBar label="Photograph your room" onPress={() => router.replace("/capture")} testID="complete-capture" />
        <PillButton variant="quiet" ground="dark" fullWidth label="Back to start" onPress={() => router.replace("/")} />
        <PillButton variant="quiet" ground="dark" fullWidth label="Replay The Study" onPress={() => router.replace("/tutorial")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ref.color.ground },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: C.inset, paddingVertical: ref.space.xxl, gap: C.gap.stats },
  head: { alignItems: "center" },
  // 01's tag pill: no fill, a 1 pt rim, 8 corners, Semibold 13 caps in textLabel.
  tag: {
    minHeight: C.tagHeight,
    paddingHorizontal: C.tagPadX,
    justifyContent: "center",
    borderRadius: ref.radius.tag,
    borderWidth: ref.layout.hub.hairline,
    borderColor: ref.color.rim,
    marginBottom: C.gap.tag,
  },
  tagText: { color: ref.color.textLabel },
  title: { ...P.type.caseTitle, color: ref.color.textPrimary, textAlign: "center" },
  message: { ...P.type.body, color: ref.color.textPrimary, textAlign: "center", marginTop: C.gap.title * 2 },
  exit: { ...ref.type.subtitle, color: ref.color.textSecondary, textAlign: "center", marginTop: C.gap.title },
  stats: { flexDirection: "row", gap: ref.space.sm },
  stat: { flex: 1 },
  statInner: { gap: ref.space.xs },
  statLabel: { ...ref.type.meta, color: ref.color.textSecondary },
  statValue: { ...P.type.stat, color: ref.color.textPrimary },
  next: { ...P.type.hint, color: ref.color.textSecondary, textAlign: "center" },
  actions: { paddingTop: ref.space.lg, paddingHorizontal: ref.space.edge, gap: ref.space.xs },
});
