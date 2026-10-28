// A mode's first-time "how this mode works" (MODES_PROMPT.md Part 2), for
// every mode, read as the book's first page (docs/ART_DIRECTION.md, the
// mystery-book core): one screen in the mode's palette, under the banner of
// its drawn cover: the series line in foil ("A Moonlit Mystery"), the mode's
// name and tagline, a foil fleuron, "Chapter One" over the chapter's title
// (the kicker), three short numbered steps, a handwritten p.s. in the
// mode's sweet colour,
// and its start button ("Take the job", "Take the case", "Step inside";
// copy.ts, MODE_INTRO) pinned to the foot as the photo guide's pill in the
// mode's accent (ModePill). Start remembers it (introSeen.ts) and
// starts the mode's first case: openCapture({ genre }) in place of the intro
// (a guest to /account, no Pro to /pro, else the guide), so back from there
// returns home; if the access check can't run it carries on to /capture,
// whose backstop shows the guide first. Back leaves without remembering:
// the intro shows again next time.
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Animated from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openCapture } from "@/capture/openCapture";
import { ModePill } from "@/capture/ui/ModePill";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import type { Genre } from "@/lib/puzzle-types";
import { ctaBottomPad, modeThemes, ref } from "@/theme/tokens";
import { COVER_ASPECT, PAGE } from "@/screens/hub/art/nook";
import { CHAPTER_ONE, MODE_INTRO, SERIES } from "./copy";
import { markIntroSeen } from "./introSeen";
import { Fleuron, FootShade, ModeBanner, ModeHeader, useModeScroll } from "./parts";

const L = ref.layout.mode;
const I = L.intro;

export function ModeIntro({ genre }: { genre: Genre }) {
  const theme = modeThemes[genre];
  const insets = useSafeAreaInsets();
  const intro = MODE_INTRO[genre];
  const steps = intro.steps;
  const scroll = useModeScroll();
  const [busy, setBusy] = useState(false);
  const action = useRef<AbortController | null>(null);
  useModeOnFocus(genre);

  // Leaving drops a late access check (nothing moves a player who has gone) and returns Start to idle.
  useFocusEffect(
    useCallback(
      () => () => {
        action.current?.abort();
        action.current = null;
        setBusy(false);
      },
      [],
    ),
  );

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const start = async () => {
    if (action.current) return;
    const controller = new AbortController();
    action.current = controller;
    setBusy(true);
    try {
      await markIntroSeen(genre);
      await openCapture({ genre, replace: true, signal: controller.signal });
    } catch {
      if (!controller.signal.aborted) router.replace("/capture");
    } finally {
      if (action.current === controller) {
        action.current = null;
        setBusy(false);
      }
    }
  };

  // The banner grows into the room the steps leave, up to the art's own
  // proportions at full width; whatever room is still left centres the words
  // between it and the button. A short screen or large text keeps the
  // minimum banner and scrolls.
  const { width } = useWindowDimensions();
  const [scrollHeight, setScrollHeight] = useState(0);
  const [columnHeight, setColumnHeight] = useState(0);
  const spare = scrollHeight > 0 && columnHeight > 0 ? scrollHeight - insets.top - columnHeight - L.foot.pad : 0;
  const banner = Math.round(Math.max(L.banner, Math.min(width * COVER_ASPECT, spare)));
  const bannerHeight = insets.top + banner;
  const numeral = { fontFamily: theme.display.fontFamily, ...L.type.numeral };

  return (
    <View style={[styles.root, { backgroundColor: theme.ground }]} testID="mode-intro">
      {/* Back first in reading order, fixed over the banner, backed once the steps scroll under it (large text). */}
      <ModeHeader theme={theme} scrollY={scroll.y} banner={banner} onBack={back} backTestID="mode-intro-back" />

      <Animated.ScrollView style={styles.scroll} contentContainerStyle={styles.content} 
        {...scroll.props}
        onLayout={(e) => setScrollHeight(e.nativeEvent.layout.height)}
        testID="mode-intro-scroll"
      >
        <View style={{ height: bannerHeight }}>
          <ModeBanner genre={genre} theme={theme} height={bannerHeight} />
        </View>
        <View style={styles.middle}>
          <View style={styles.column} onLayout={(e) => setColumnHeight(e.nativeEvent.layout.height)}>
            <Text style={[styles.series, { color: theme.foil }]} testID="mode-intro-series">
              {SERIES[genre]}
            </Text>
            <Text accessibilityRole="header" style={[theme.display, { color: theme.ink }]}>
              {theme.name}
            </Text>
            <Text style={[L.type.tagline, styles.tagline, { color: theme.inkMuted }]}>{theme.tagline}</Text>
            <Fleuron theme={theme} />
            <Text style={[L.type.kicker, PAGE.chapter, { color: theme.foil }]}>{CHAPTER_ONE}</Text>
            <Text style={[styles.chapterTitle, { color: theme.ink }]}>{intro.kicker}</Text>
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
            <Text style={[theme.hand, PAGE.note, styles.note, { color: theme.sweet }]} testID="mode-intro-note">
              {intro.note}
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.ground, paddingBottom: ctaBottomPad(insets.bottom) }]}>
        <FootShade theme={theme} />
        <ModePill
          variant="ghost"
          label={intro.start}
          busy={busy}
          spinner
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
  content: { flexGrow: 1, paddingBottom: L.foot.pad },
  // The words, centred in whatever room the banner leaves above the button.
  middle: { flexGrow: 1, justifyContent: "center" },
  column: { paddingHorizontal: L.inset, paddingTop: I.introTop },
  series: { fontFamily: ref.font.coverItalic, ...PAGE.series, marginBottom: L.taglineGap },
  tagline: { marginTop: L.taglineGap },
  chapterTitle: { fontFamily: ref.font.coverItalic, ...PAGE.chapterTitle, marginTop: L.taglineGap },
  steps: { marginTop: I.stepsTop, gap: I.stepGap },
  note: { marginTop: PAGE.noteTop, transform: [{ rotate: PAGE.noteTurn }] },
  step: { flexDirection: "row", alignItems: "flex-start" },
  numeral: { width: I.numeralWidth, letterSpacing: 0 },
  // The step's words wrap at large text; the numeral keeps its column.
  stepWords: { flex: 1, paddingTop: (L.type.numeral.lineHeight - L.type.step.lineHeight) / 2 },
  stepBody: { marginTop: I.stepTextGap },
  // The photo guide's foot: its reading column, the pill ctaBottom above the safe bottom.
  footer: { paddingTop: L.foot.pad, paddingHorizontal: ref.space.reading },
});
