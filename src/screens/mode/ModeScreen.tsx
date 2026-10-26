// A mode's screen, /mode/<genre> (MODES_PROMPT.md Part 2), all in the mode's
// palette: a banner of the mode's art (the same photo as its home card) with
// the camera's square back button on it; the mode's name in its display face
// and its tagline; the player's cases in this mode as case files with their
// stamps; on noir, The Study as a case to replay; and New case, the mode's
// one strong action, pinned to the foot. New case runs openCapture({ genre })
// (the guide, camera, review and build all take the mode's look); a player
// without Pro sees the Pro lock on it, and the tap takes them to /pro.
// The screen sets the active mode each time it gains focus.
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WarningIcon, WifiSlashIcon, ICON_WEIGHT } from "@/components/icons";
import { openCapture } from "@/capture/openCapture";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { ensureSession, isNetworkError } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { STUDY_ART, useModeArt } from "./art";
import { CaseFileRow } from "./CaseFileRow";
import { MODE_COPY, STAMP_WORDS, caseDate, caseHref, caseLabel, studyAction } from "./caseFiles";
import { FootShade, ModeBanner, ModeBar, ModeHeader, TextButton, useModeScroll } from "./parts";
import { useModeCases } from "./useModeCases";
import { modeThemes, ref } from "@/theme/tokens";

const L = ref.layout.mode;

const COPY = {
  newCase: "New case",
  yourCases: "Your cases",
  firstCase: "The first case",
  study: "The Study",
  offline: "You're offline. Your cases show when you connect.",
  tryLater: "Couldn't load your cases. Try again in a moment.",
  retry: "Try again",
  studyOffline: "You're offline. Connect to begin.",
  studyFailed: "Couldn't start the case. Try again in a moment.",
} as const;

type Busy = "new" | "study";

export function ModeScreen({ genre }: { genre: Genre }) {
  const theme = modeThemes[genre];
  const insets = useSafeAreaInsets();
  const art = useModeArt();
  const { cases, study, locked, reload } = useModeCases(genre);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<{ offline: boolean } | null>(null);
  const action = useRef<AbortController | null>(null);
  const scroll = useModeScroll();

  useModeOnFocus(genre);

  // Leaving drops a late result and returns a busy control to idle.
  useFocusEffect(
    useCallback(
      () => () => {
        action.current?.abort();
        action.current = null;
        setBusy(null);
        setNotice(null);
      },
      [],
    ),
  );

  const begin = (what: Busy) => {
    setNotice(null);
    const controller = new AbortController();
    action.current = controller;
    setBusy(what);
    return controller.signal;
  };
  const end = (signal: AbortSignal) => {
    if (action.current?.signal !== signal) return;
    action.current = null;
    setBusy(null);
  };

  const back = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  // New case: openCapture checks access (a guest to /account, no Pro to
  // /pro, the monthly cap to the build screen), then the guide. If the check
  // can't run it carries on to /capture, whose backstop shows the guide and
  // whose build checks access again before anything is sent.
  const newCase = async () => {
    const signal = begin("new");
    try {
      await openCapture({ genre, signal });
    } catch {
      if (!signal.aborted) router.push("/capture");
    } finally {
      end(signal);
    }
  };

  // The Study (noir): resume or replay through /tutorial.
  const openStudy = async () => {
    const signal = begin("study");
    try {
      await ensureSession();
      if (!signal.aborted) router.push("/tutorial");
    } catch (error) {
      if (!signal.aborted) setNotice({ offline: isNetworkError(error) });
    } finally {
      end(signal);
    }
  };

  const bannerHeight = insets.top + L.banner;

  return (
    <View style={[styles.root, { backgroundColor: theme.ground }]} testID="mode-screen">
      {/* Back first in reading order, fixed over the banner; its backing fades in as the list scrolls under it. */}
      <ModeHeader theme={theme} scrollY={scroll.y} onBack={back} />

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        {...scroll.props}
        testID="mode-scroll"
      >
        <View style={{ height: bannerHeight }}>
          <ModeBanner genre={genre} theme={theme} art={art} height={bannerHeight} />
        </View>
        <View style={styles.column}>
          <Text accessibilityRole="header" style={[theme.display, { color: theme.ink }]}>
            {theme.name}
          </Text>
          <Text style={[L.type.tagline, styles.tagline, { color: theme.inkMuted }]}>{theme.tagline}</Text>

          <Text accessibilityRole="header" style={[L.type.section, styles.section, { color: theme.ink }]}>
            {COPY.yourCases}
          </Text>
          <View style={styles.list} accessibilityState={{ busy: cases.kind === "loading" }} testID="mode-cases">
            {cases.kind === "ready" && cases.files.length > 0
              ? cases.files.map((file) => (
                  <CaseFileRow
                    key={file.roomId}
                    genre={genre}
                    theme={theme}
                    title={file.title}
                    meta={caseDate(file.createdAt)}
                    stamp={file.stamp}
                    thumb={file.cover ? { source: { uri: file.cover.uri }, cacheKey: file.cover.id } : null}
                    accessibilityLabel={caseLabel(file)}
                    disabled={busy !== null}
                    onPress={() => router.push(caseHref(file))}
                    testID={`mode-case-${file.roomId}`}
                  />
                ))
              : null}
            {cases.kind === "ready" && cases.files.length === 0 ? (
              <View style={[styles.empty, { borderColor: theme.inkMuted }]} testID="mode-empty">
                <Text style={[L.type.body, styles.emptyText, { color: theme.inkMuted }]}>{MODE_COPY[genre].empty}</Text>
              </View>
            ) : null}
            {cases.kind === "offline" || cases.kind === "tryLater" ? (
              <View style={styles.line} testID="mode-error">
                <Text style={[L.type.body, { color: theme.inkMuted }]}>{cases.kind === "offline" ? COPY.offline : COPY.tryLater}</Text>
                <TextButton theme={theme} label={COPY.retry} onPress={reload} testID="mode-retry" />
              </View>
            ) : null}
          </View>

          {genre === "noir" ? (
            <>
              <Text accessibilityRole="header" style={[L.type.section, styles.section, { color: theme.ink }]}>
                {COPY.firstCase}
              </Text>
              <View style={styles.list}>
                <CaseFileRow
                  genre={genre}
                  theme={theme}
                  title={COPY.study}
                  meta={studyAction(study ?? "open")}
                  stamp={study}
                  thumb={{ source: STUDY_ART }}
                  accessibilityLabel={
                    study ? `${COPY.study}. ${STAMP_WORDS[study]}. ${studyAction(study)}.` : `${COPY.study}. ${studyAction("open")}.`
                  }
                  busy={busy === "study"}
                  disabled={busy !== null && busy !== "study"}
                  onPress={() => {
                    openStudy();
                  }}
                  testID="mode-study"
                />
              </View>
            </>
          ) : null}
        </View>
      </Animated.ScrollView>

      {/* New case, pinned to the foot; the list scrolls under a short fade. */}
      <View style={[styles.footer, { backgroundColor: theme.ground, paddingBottom: insets.bottom + L.bar.foot }]}>
        <FootShade theme={theme} />
        <View accessibilityLiveRegion="polite" testID="mode-notice-slot">
          {notice ? (
            <View style={styles.notice} accessible accessibilityLabel={notice.offline ? COPY.studyOffline : COPY.studyFailed} testID="mode-notice">
              {notice.offline ? (
                <WifiSlashIcon size={ref.layout.hub.noticeIcon} weight={ICON_WEIGHT} color={theme.ink} />
              ) : (
                <WarningIcon size={ref.layout.hub.noticeIcon} weight={ICON_WEIGHT} color={theme.ink} />
              )}
              <Text style={[L.type.meta, styles.noticeText, { color: theme.ink }]}>{notice.offline ? COPY.studyOffline : COPY.studyFailed}</Text>
            </View>
          ) : null}
        </View>
        <ModeBar theme={theme} label={COPY.newCase} locked={locked === true} busy={busy === "new"} onPress={newCase} testID="mode-new-case" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: L.sectionTop },
  column: { paddingHorizontal: L.inset, paddingTop: L.titleTop },
  tagline: { marginTop: L.taglineGap },
  section: { marginTop: L.sectionTop, marginBottom: L.sectionGap },
  list: { gap: L.file.gap },
  line: { marginTop: L.emptyTop },
  // An empty file's dashed outline round the friendly line.
  empty: {
    minHeight: L.file.minHeight,
    justifyContent: "center",
    padding: L.empty.pad,
    borderWidth: L.empty.border,
    borderStyle: "dashed",
    borderRadius: L.file.radius,
  },
  emptyText: { textAlign: "center" },
  footer: { paddingTop: L.bar.pad, paddingHorizontal: L.inset },
  notice: { flexDirection: "row", alignItems: "center", gap: ref.space.sm, marginBottom: L.bar.pad },
  noticeText: { flexShrink: 1 },
});
