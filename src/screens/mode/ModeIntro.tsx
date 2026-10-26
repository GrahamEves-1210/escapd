// A mode's first-time "how this mode works" (MODES_PROMPT.md Part 2), for
// crime scene and paranormal: one screen in the mode's palette, under the
// same banner as its mode screen: the mode's name and tagline, three short
// numbered steps, and Start, pinned to the foot. Start remembers it
// (introSeen.ts) and replaces itself with the mode's screen, so back from
// there returns home. Back leaves without remembering: the intro shows again
// next time.
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { modeThemes, ref } from "@/theme/tokens";
import { useModeArt } from "./art";
import { MODE_COPY } from "./caseFiles";
import { markIntroSeen } from "./introSeen";
import { FootShade, ModeBanner, ModeBar, ModeHeader, useModeScroll } from "./parts";
import { modeHref } from "./routes";

const L = ref.layout.mode;
const I = L.intro;

export function ModeIntro({ genre }: { genre: "crime_scene" | "paranormal" }) {
  const theme = modeThemes[genre];
  const insets = useSafeAreaInsets();
  const art = useModeArt();
  const steps = MODE_COPY[genre].intro;
  const scroll = useModeScroll();
  useModeOnFocus(genre);

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const start = async () => {
    await markIntroSeen(genre);
    router.replace(modeHref(genre));
  };

  const bannerHeight = insets.top + L.banner;
  const numeral = { fontFamily: theme.display.fontFamily, ...L.type.numeral };

  return (
    <View style={[styles.root, { backgroundColor: theme.ground }]} testID="mode-intro">
      {/* Back first in reading order, fixed over the banner, backed once the steps scroll under it (large text). */}
      <ModeHeader theme={theme} scrollY={scroll.y} onBack={back} backTestID="mode-intro-back" />

      <Animated.ScrollView style={styles.scroll} contentContainerStyle={styles.content} 
        {...scroll.props}
        testID="mode-intro-scroll"
      >
        <View style={{ height: bannerHeight }}>
          <ModeBanner genre={genre} theme={theme} art={art} height={bannerHeight} />
        </View>
        <View style={styles.column}>
          <Text style={[L.type.kicker, styles.kicker, { color: theme.inkMuted }]}>How this mode works</Text>
          <Text accessibilityRole="header" style={[theme.display, { color: theme.ink }]}>
            {theme.name}
          </Text>
          <Text style={[L.type.tagline, styles.tagline, { color: theme.inkMuted }]}>{theme.tagline}</Text>
          <View style={styles.steps}>
            {steps.map((step, i) => (
              <View
                key={step.title}
                accessible
                accessibilityLabel={`Step ${i + 1} of ${steps.length}. ${step.title}. ${step.body}`}
                style={styles.step}
                testID={`mode-intro-step-${i + 1}`}
              >
                <Text style={[numeral, styles.numeral, { color: theme.stamp }]}>{i + 1}</Text>
                <View style={styles.stepWords}>
                  <Text style={[L.type.step, { color: theme.ink }]}>{step.title}</Text>
                  <Text style={[L.type.body, styles.stepBody, { color: theme.inkMuted }]}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </Animated.ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.ground, paddingBottom: insets.bottom + L.bar.foot }]}>
        <FootShade theme={theme} />
        <ModeBar
          theme={theme}
          label="Start"
          onPress={() => {
            start();
          }}
          testID="mode-intro-start"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: L.sectionTop },
  column: { paddingHorizontal: L.inset, paddingTop: I.introTop },
  kicker: { marginBottom: L.taglineGap },
  tagline: { marginTop: L.taglineGap },
  steps: { marginTop: I.stepsTop, gap: I.stepGap },
  step: { flexDirection: "row", alignItems: "flex-start" },
  numeral: { width: I.numeralWidth, letterSpacing: 0 },
  // The step's words wrap at large text; the numeral keeps its column.
  stepWords: { flex: 1, paddingTop: (L.type.numeral.lineHeight - L.type.step.lineHeight) / 2 },
  stepBody: { marginTop: I.stepTextGap },
  footer: { paddingTop: L.bar.pad, paddingHorizontal: L.inset },
});
