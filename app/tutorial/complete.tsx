// Tutorial result. Celebrates observation, not speed: no ranking, no stars.
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import Animated, { FadeIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { getLatestSession } from "@/lib/escapd-api";
import { formatDuration } from "@/game/format";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { useTheme } from "@/theme/ThemeProvider";
import { color, curve, motion, radius, space } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Grain } from "@/components/Grain";
import { Text } from "@/components/Text";

export default function TutorialCompleteScreen() {
  const { message, exit } = useLocalSearchParams<{ message?: string; exit?: string }>();
  const { reducedMotion } = useTheme();
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
    <View style={styles.root}>
      <Grain />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <Animated.View entering={enter(0)} style={styles.dossier}>
            <Text variant="stamp" tone="accent">CASE CLOSED</Text>
            <Text variant="caseDisplay" accessibilityRole="header">The Study</Text>
            {message ? <Text variant="slip" tone="ink">{message}</Text> : null}
            <Text variant="narrative" tone="ink">{exit || "The door swings open."}</Text>
          </Animated.View>

          {summary ? (
            <Animated.View entering={enter(250)} style={styles.stats}>
              <View style={styles.stat} accessible accessibilityLabel={`Time: ${summary.time}`}>
                <Text variant="caption" tone="secondary">Time</Text>
                <Text variant="sectionTitle">{summary.time}</Text>
              </View>
              <View style={styles.stat} accessible accessibilityLabel={`Hints used: ${summary.hints}`}>
                <Text variant="caption" tone="secondary">Hints used</Text>
                <Text variant="sectionTitle">{summary.hints}</Text>
              </View>
            </Animated.View>
          ) : null}

          <Animated.View entering={enter(500)} style={styles.next}>
            <View style={styles.rule} />
            <Text variant="narrativeTitle">The next case is your own room.</Text>
          </Animated.View>
        </ScrollView>
        <View style={styles.actions}>
          <Button label="Photograph your room" onPress={() => router.replace("/capture")} testID="complete-capture" />
          <Button label="Back to start" variant="secondary" onPress={() => router.replace("/")} />
          <Button label="Replay The Study" variant="quiet" onPress={() => router.replace("/tutorial")} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.canvas },
  safe: { flex: 1, paddingHorizontal: space.gutter },
  content: { flexGrow: 1, justifyContent: "center", gap: space.xxl, paddingVertical: space.xxl },
  dossier: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.slip,
    ...curve,
    backgroundColor: color.manila,
  },
  stats: { flexDirection: "row", gap: space.md },
  stat: {
    flex: 1,
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.control,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  next: { gap: space.xl },
  rule: { height: 1, backgroundColor: color.hairline },
  actions: { gap: space.sm, paddingBottom: space.xl },
});
