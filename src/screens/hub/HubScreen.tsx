// 01 · Home, at / (MODES_PROMPT.md Part 2, round 6), the shell: it keeps the
// reference look (black, Opal's header with the ESCAPD wordmark and the
// Settings chip, white type, the brass focus ring), and below the header a
// deck of three solid mode cards, DETECTIVE NOIR, CRIME SCENE and PARANORMAL,
// each in its own mode's palette (ModeCard), dealt down the screen so each
// lies partly over the one above, turned a little, casting a soft shadow up
// onto it (deck.ts). A short screen or large text scrolls them.
// A card's tap (one at a time):
// - First time: noir runs The Study (/tutorial) while it has never been
//   played (studyEntry's Unseal); crime scene and paranormal show their
//   one-screen intro (/mode/intro/<genre>), whose button starts a new case.
// - After that, with a case to go back to in that mode (caseStatus.ts,
//   caseToContinue; noir's part-played Study counts when the player has no
//   case of their own): the continue prompt (ResumeSheet) over home in the
//   mode's colours: Continue resumes it (/play/<id>, the build wait, or The
//   Study); Start a new case runs openCapture({ genre }).
// - Otherwise a new case straight away: openCapture({ genre }) (guide,
//   camera, photos, build; a guest to /account, no Pro to /pro). If the
//   access check can't run it carries on to /capture, whose backstop shows
//   the guide first and whose build checks access again.
// The tap uses this focus's fetch once it has landed; until then the card
// goes busy while it waits for it. A failure shows the notice.
// Home is the shell, so it clears the active mode each time it gains focus.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, View, useWindowDimensions, type HostInstance } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect } from "react-native-svg";
import { openCapture } from "@/capture/openCapture";
import { Wordmark } from "@/components/Wordmark";
import { gradientLine, gradientStops } from "@/components/noir";
import { GENRES, setMode } from "@/game/mode";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { ensureSession, isNetworkError } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { hasIntro, hasSeenIntro } from "@/screens/mode/introSeen";
import { introHref } from "@/screens/mode/routes";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { continueHref, type CaseToContinue } from "./caseStatus";
import { Chip, SlidersGlyph } from "./Chip";
import { deckLayout, deckTilt } from "./deck";
import { HubNotice } from "./HubNotice";
import { ModeCard } from "./ModeCard";
import { ResumeSheet } from "./ResumeSheet";
import { SettingsSheet, type SettingsRoute } from "./SettingsSheet";
import { useHubData } from "./useHubData";

const H = ref.layout.hub;
const M = H.modes;
const DIVIDER = ref.gradient.divider;
/** The 6 between a chip's 48 hit box and its 36 disc. */
const CHIP_PAD = (ref.button.chip.hit - ref.button.chip.size) / 2;
/** The header's height under the safe top: the chip row and the divider under it. */
const HEADER = H.header.top - CHIP_PAD + ref.button.chip.hit + ref.space.lg - CHIP_PAD + H.hairline;

interface Notice {
  /** Bumped per failure, so a repeat failure fades in and is announced again. */
  id: number;
  offline: boolean;
}

interface Prompt {
  genre: Genre;
  target: CaseToContinue;
  /** Bumped on every open, so a tap while the last prompt is still sliding away opens a fresh one. */
  key: number;
}

export function HubScreen() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { reducedMotion } = useTheme();
  const hub = useHubData();
  const [busy, setBusy] = useState<Genre | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bumped on every open, so a tap on Settings while the last sheet is still sliding away opens a fresh one.
  const [sheetKey, setSheetKey] = useState(0);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const prompts = useRef(0);
  const helpRef = useRef<HostInstance>(null);
  const cardRefs = useRef<Partial<Record<Genre, HostInstance | null>>>({});
  const action = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const focusReturn = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dividerId = `divider${useId().replace(/[^A-Za-z0-9]/g, "")}`;

  // The deck: the scroll view's height (measured; until then from the window), and each card's words.
  const [viewport, setViewport] = useState<number | null>(null);
  const [words, setWords] = useState<Partial<Record<Genre, number>>>({});
  const column = viewport ?? windowHeight - insets.top - HEADER;
  const deck = deckLayout(column - M.top - insets.bottom - M.foot, Math.max(0, ...Object.values(words)), GENRES.length);

  // Home is the shell: no mode while it is in front.
  useModeOnFocus(null);

  // Leaving home drops a late result (nothing navigates a player who has
  // gone), returns a busy card to idle, closes the prompt and clears the
  // notice, which stays only until the next focus.
  useFocusEffect(
    useCallback(
      () => () => {
        action.current?.abort();
        action.current = null;
        setBusy(null);
        setNotice(null);
        setPrompt(null);
      },
      [],
    ),
  );

  const begin = (genre: Genre) => {
    setNotice(null);
    action.current?.abort();
    const controller = new AbortController();
    action.current = controller;
    setBusy(genre);
    return controller.signal;
  };
  // Only the current action ends the busy state; an aborted one already has.
  const end = (signal: AbortSignal) => {
    if (action.current?.signal !== signal) return;
    action.current = null;
    setBusy(null);
  };
  const fail = (error: unknown) => {
    failures.current += 1;
    setNotice({ id: failures.current, offline: isNetworkError(error) });
  };

  // A new case in the mode: openCapture checks access first. If the check
  // can't run it carries on to /capture (the mode already set), whose
  // backstop shows the guide and whose build checks access again.
  const startNew = async (genre: Genre, signal: AbortSignal) => {
    try {
      await openCapture({ genre, signal });
    } catch {
      if (!signal.aborted) router.push("/capture");
    }
  };

  // A card's tap (see the top of this file). One at a time: a second tap
  // while the first chooses is dropped.
  const choosing = useRef(false);
  const openMode = async (genre: Genre) => {
    if (choosing.current) return;
    choosing.current = true;
    setNotice(null);
    // The card goes busy only when there's something to wait for.
    const run: { signal: AbortSignal | null } = { signal: null };
    const working = () => (run.signal ??= begin(genre));
    try {
      if (hasIntro(genre) && !(await hasSeenIntro(genre))) {
        router.push(introHref(genre));
        return;
      }
      let data = hub.fresh();
      if (!data) {
        const signal = working();
        data = await hub.entry();
        if (signal.aborted) return;
      }
      if (genre === "noir" && data.study === "unseal") {
        const signal = working();
        await ensureSession();
        if (!signal.aborted) router.push("/tutorial");
        return;
      }
      const target = data.cases[genre];
      if (target) {
        if (run.signal) end(run.signal);
        run.signal = null;
        prompts.current += 1;
        setPrompt({ genre, target, key: prompts.current });
        return;
      }
      await startNew(genre, working());
    } catch (error) {
      if (run.signal && !run.signal.aborted) fail(error);
    } finally {
      if (run.signal) end(run.signal);
      choosing.current = false;
    }
  };

  const cancelFocusReturn = useCallback(() => {
    if (focusReturn.current) clearTimeout(focusReturn.current);
    focusReturn.current = null;
  }, []);
  // A pending focus return never outlives home.
  useEffect(() => cancelFocusReturn, [cancelFocusReturn]);

  // Closing a sheet returns screen-reader focus to what opened it once the
  // sheet has left: until then its modal layer is still mounted and
  // VoiceOver ignores the move. Close and the scrim slide the sheet away
  // first and call back once it has gone (`exited`); Android back unmounts it
  // at once, so this waits out its exit animation (ref.motion.sheetFall, or
  // motion.reducedFade). Either way, plus a margin for the layer's removal.
  const returnFocus = useCallback(
    (target: () => HostInstance | null | undefined, exited: boolean) => {
      cancelFocusReturn();
      const exit = exited ? 0 : reducedMotion ? motion.reducedFade : ref.motion.sheetFall.duration;
      focusReturn.current = setTimeout(() => {
        focusReturn.current = null;
        const node = target();
        if (node) AccessibilityInfo.sendAccessibilityEvent(node, "focus");
      }, exit + H.sheet.focusMargin);
    },
    [reducedMotion, cancelFocusReturn],
  );

  const openSheet = () => {
    // Reopened before the last close finished leaving: that focus return is moot.
    cancelFocusReturn();
    setSheetKey((k) => k + 1);
    setSheetOpen(true);
  };
  const closeSheet = useCallback(
    (exited = false) => {
      setSheetOpen(false);
      returnFocus(() => helpRef.current, exited);
    },
    [returnFocus],
  );
  // A Settings row that leaves home: the sheet closes (no focus return), then the route opens.
  // Adding an email comes back here when done, as everywhere else that asks.
  const openRoute = (route: SettingsRoute) => {
    cancelFocusReturn();
    setSheetOpen(false);
    if (route === "/account") router.push({ pathname: "/account", params: { next: "back" } });
    else router.push(route);
  };

  // The continue prompt.
  const closePrompt = useCallback(
    (exited = false) => {
      if (!prompt) return;
      const { genre } = prompt;
      setPrompt(null);
      returnFocus(() => cardRefs.current[genre], exited);
    },
    [prompt, returnFocus],
  );
  // Continue: the sheet goes as the route opens. The build wait takes the
  // mode's look from the store (the player and The Study set their own).
  const resume = (open: Prompt) => {
    cancelFocusReturn();
    if (action.current) return;
    if (open.target.kind === "build") setMode(open.genre);
    setPrompt(null);
    router.push(continueHref(open.target));
  };
  const resumeFresh = async (open: Prompt) => {
    if (action.current) return;
    const signal = begin(open.genre);
    try {
      await startNew(open.genre, signal);
      if (!signal.aborted) setPrompt(null);
    } finally {
      end(signal);
    }
  };

  // Android back: a sheet closes first; a busy card swallows it until it
  // navigates or shows the notice; otherwise the system leaves the app (root).
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (busy !== null) return true;
        if (prompt) {
          closePrompt();
          return true;
        }
        if (sheetOpen) {
          closeSheet();
          return true;
        }
        return false;
      });
      return () => subscription.remove();
    }, [sheetOpen, prompt, busy, closeSheet, closePrompt]),
  );

  const covered = sheetOpen || prompt !== null;

  return (
    <View style={styles.root}>
      {/* Everything behind a sheet: hidden from TalkBack while it is open (VoiceOver is trapped by the sheet). */}
      <View
        style={styles.screen}
        testID="hub-screen"
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
      >
        {/* Chip row: the 36 discs at safe top + 12, 16 from the edges, each in its 48 hit box. */}
        <View style={[styles.header, { paddingTop: insets.top + H.header.top - CHIP_PAD }]}>
          {/* Opal's dismiss chevron: left out (home is the root). Its place keeps the wordmark centred. */}
          <View style={styles.chipSlot} />
          {/* The ESCAPD wordmark in white, its doorway edge grey (no brass), centred: the screen's name (the shell keeps its look). */}
          <View style={styles.titleGroup}>
            <View accessible accessibilityRole="header" accessibilityLabel="ESCAPD" testID="hub-logo">
              <Wordmark height={H.header.logo} tint={ref.color.textPrimary} edgeColor={ref.color.textSecondary} />
            </View>
          </View>
          <Chip
            ref={helpRef}
            accessibilityLabel="Settings"
            icon={<SlidersGlyph />}
            onPress={openSheet}
            disabled={busy !== null}
            testID="hub-settings"
          />
        </View>
        {/* The faint divider, lg 16 under the chips: white 0 to 10 % to 0 across the screen. */}
        <View style={styles.divider} pointerEvents="none" accessible={false}>
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} viewBox="0 0 1 1" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={dividerId} {...gradientLine(DIVIDER.angle)}>
                {gradientStops(DIVIDER.stops)}
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={1} height={1} fill={`url(#${dividerId})`} />
          </Svg>
        </View>

        <ScrollView
          style={styles.column}
          contentContainerStyle={[styles.cards, { paddingBottom: insets.bottom + M.foot }]}
          onLayout={(e) => setViewport(e.nativeEvent.layout.height)}
          testID="hub-cards"
        >
          {/* Reading order is the deck's order; later cards lie on top (no zIndex). */}
          {GENRES.map((genre, i) => (
            <ModeCard
              key={genre}
              ref={(node) => {
                cardRefs.current[genre] = node;
              }}
              genre={genre}
              inProgress={!!hub.cases?.[genre]}
              busy={busy === genre}
              disabled={busy !== null && busy !== genre}
              onPress={() => {
                openMode(genre);
              }}
              onWordsLayout={(height) => {
                const h = Math.ceil(height);
                setWords((w) => (w[genre] === h ? w : { ...w, [genre]: h }));
              }}
              style={{
                height: deck.card,
                marginTop: i === 0 ? 0 : -deck.overlap,
                transform: [{ rotate: `${deckTilt(i)}deg` }],
              }}
            />
          ))}
        </ScrollView>

        {/* Always mounted: Android speaks a polite live region when its content changes, never one that has just mounted. Over the last card's foot. */}
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="box-none"
          style={[styles.noticeSlot, { bottom: insets.bottom + M.foot + M.pad }]}
          testID="hub-notice-slot"
        >
          {notice ? <HubNotice key={notice.id} offline={notice.offline} /> : null}
        </View>
      </View>

      {sheetOpen ? (
        <SettingsSheet key={sheetKey} study={hub.study} onClose={() => closeSheet(true)} onOpen={openRoute} />
      ) : null}
      {prompt ? (
        <ResumeSheet
          key={prompt.key}
          genre={prompt.genre}
          target={prompt.target}
          busy={busy === prompt.genre}
          onContinue={() => resume(prompt)}
          onStartNew={() => {
            resumeFresh(prompt);
          }}
          onClose={() => closePrompt(true)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // The shell's black. No glow, no grain.
  root: { flex: 1, backgroundColor: ref.color.void },
  screen: { ...StyleSheet.absoluteFill },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ref.space.lg - CHIP_PAD,
  },
  chipSlot: { width: ref.button.chip.hit, height: ref.button.chip.hit },
  // Centred between the two 48 slots, so on the screen's axis.
  titleGroup: { flex: 1, alignItems: "center", justifyContent: "center" },
  divider: { height: H.hairline, marginTop: ref.space.lg - CHIP_PAD },
  column: { flex: 1 },
  cards: { flexGrow: 1, paddingTop: M.top, paddingHorizontal: M.edge },
  noticeSlot: { position: "absolute", left: M.edge + M.pad, right: M.edge + M.pad, alignItems: "center" },
});
