// 01 · Home, at / (MODES_PROMPT.md Part 2, round 6), the shell: it keeps the
// reference look (black, Opal's header with the ESCAPD wordmark and the
// Settings chip, white type, the brass focus ring), and below the header a
// deck of three solid mode cards, DETECTIVE NOIR, CRIME SCENE and PARANORMAL,
// each in its own mode's palette (ModeCard), dealt down the screen so each
// lies partly over the one above, turned a little, casting a soft shadow up
// onto it (deck.ts). A short screen or large text scrolls them.
// A card's tap (one at a time):
// - With a case to go back to in that mode (caseStatus.ts, caseToContinue):
//   the continue prompt (ResumeSheet) over home in the mode's colours, even
//   the first time on a device: Continue resumes it (/play/<id> or the build
//   wait); Start a new case runs openCapture({ genre }) (through the intro
//   if it hasn't shown yet).
// - First time, with no case open: each mode shows its one-screen intro
//   (/mode/intro/<genre>), whose button starts a new case. When home can't
//   find out (offline) the intro still shows.
// - Otherwise a new case straight away: openCapture({ genre }) (guide,
//   camera, photos, build; a guest to /account, no Pro to /pro). If the
//   access check can't run it carries on to /capture, whose backstop shows
//   the guide first and whose build checks access again.
// The tap uses this focus's fetch once it has landed; until then the card
// goes busy while it waits for it. A failure shows the notice.
// Home is the shell, so it clears the active mode each time it gains focus.
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { BackHandler, Image, ScrollView, StyleSheet, View, useWindowDimensions, type HostInstance, type ViewStyle } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openCapture } from "@/capture/openCapture";
import { GENRES, setMode } from "@/game/mode";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { isNetworkError } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { hasSeenIntro } from "@/screens/mode/introSeen";
import { introHref } from "@/screens/mode/routes";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { continueHref, type CaseToContinue } from "./caseStatus";
import { Chip, GearGlyph } from "./Chip";
import { deckLayout, deckTilt } from "./deck";
import { SittingCat } from "@/play2/SittingCat";
import { HubNotice } from "./HubNotice";
import { ModeCard } from "./ModeCard";
import { ResumeSheet } from "./ResumeSheet";
import { SettingsSheet, type SettingsRoute } from "./SettingsSheet";
import { useHubData } from "./useHubData";
import { WindowBackdrop, windowGeometry } from "./WindowBackdrop";
import { focusForAccessibility } from "@/lib/a11y";

const H = ref.layout.hub;
const M = H.modes;
/** The 6 between a chip's 48 hit box and its 36 disc. */
const CHIP_PAD = (ref.button.chip.hit - ref.button.chip.size) / 2;
/** The header's height under the safe top: the chip row and the divider under it. */
/** The ESCAPD logo cut from the brand art (docs/DESIGN.md, 01 · Home). */
const WORDMARK = require("../../../assets/brand/wordmark.png");

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
  // The logo falls in with the cards, a beat after the window.
  const logoIn = useFallIn(0);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
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

  // The deck: the scroll view's top and height (measured; until then from the window), and each card's words.
  const [viewport, setViewport] = useState<{ y: number; height: number } | null>(null);
  const [words, setWords] = useState<Partial<Record<Genre, number>>>({});
  const columnTop = viewport?.y ?? insets.top + HEADER;
  const column = viewport?.height ?? windowHeight - insets.top - HEADER;
  // The deck takes most of the column, leaving the window's sill clear for the cat.
  const deckRoom = column - M.top - insets.bottom - M.foot;
  const deck = deckLayout(deckRoom * DECK_SHARE, Math.max(0, ...Object.values(words)), GENRES.length);
  const fits = deck.height <= deckRoom;
  // The cat sits on the sill, under the deck: as large as the room between
  // them allows, and left out where there's too little (or the deck scrolls).
  const sillTop = windowHeight - windowGeometry(windowWidth, windowHeight).sill;
  const deckBottom = columnTop + M.top + deck.height + tiltOverhang(windowWidth - 2 * M.edge);
  const catWidth = Math.min(CAT.width, (sillTop + CAT.sink - deckBottom - CAT.gap) / CAT.aspect);
  const showCat = fits && catWidth >= CAT.minWidth;

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
      const seen = await hasSeenIntro(genre);
      // An open case comes first, even before the intro (a new device, an
      // existing account): the intro's button only starts a new case.
      let data = hub.fresh();
      if (!data) {
        const signal = working();
        try {
          data = await hub.entry();
        } catch (error) {
          // Can't tell whether there's a case: the intro needs no network.
          if (seen) throw error;
          if (!signal.aborted) router.push(introHref(genre));
          return;
        }
        if (signal.aborted) return;
      }
      const target = data.cases[genre];
      if (target) {
        if (run.signal) end(run.signal);
        run.signal = null;
        prompts.current += 1;
        setPrompt({ genre, target, key: prompts.current });
        return;
      }
      if (!seen) {
        router.push(introHref(genre));
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
        focusForAccessibility(node);
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
  // Set while Settings slides away behind a route one of its rows opened: no focus to return then.
  const sheetLeaving = useRef(false);
  const closeSheet = useCallback(
    (exited = false) => {
      setSheetOpen(false);
      if (sheetLeaving.current) {
        sheetLeaving.current = false;
        return;
      }
      returnFocus(() => helpRef.current, exited);
    },
    [returnFocus],
  );
  // A Settings row that leaves home: the route opens, and the sheet slides
  // away on its own close (no focus return). Adding an email comes back here
  // when done, as everywhere else that asks.
  const openRoute = (route: SettingsRoute) => {
    cancelFocusReturn();
    sheetLeaving.current = true;
    if (route === "/account") router.push({ pathname: "/account", params: { next: "back", from: "settings" } });
    else router.push(route);
  };

  // The continue prompt. Set while it slides away behind a route it opened: no focus to return then.
  const leaving = useRef(false);
  const closePrompt = useCallback(
    (exited = false) => {
      if (!prompt) return;
      const { genre } = prompt;
      setPrompt(null);
      if (leaving.current) {
        leaving.current = false;
        return;
      }
      returnFocus(() => cardRefs.current[genre], exited);
    },
    [prompt, returnFocus],
  );
  // Continue: the route opens and the sheet slides away on its own (the
  // sheet's close; it stays mounted, and on top, until it has gone). The
  // build wait takes the mode's look from the store (the player sets its
  // own). Returns whether it went.
  const resume = (open: Prompt) => {
    cancelFocusReturn();
    if (action.current) return false;
    if (open.target.kind === "build") setMode(open.genre);
    leaving.current = true;
    router.push(continueHref(open.target));
    return true;
  };
  // Start a new case: once the new case's route has opened, the sheet slides
  // away the same way. A mode whose intro hasn't shown yet goes through it
  // (its button starts the new case).
  const resumeFresh = async (open: Prompt) => {
    if (action.current) return false;
    const signal = begin(open.genre);
    try {
      if (!(await hasSeenIntro(open.genre))) {
        if (signal.aborted) return false;
        leaving.current = true;
        router.push(introHref(open.genre));
        return true;
      }
      await startNew(open.genre, signal);
      if (signal.aborted) return false;
      leaving.current = true;
      return true;
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
      {/* A rainy night through the window, the frame round the screen. */}
      <WindowBackdrop />
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
          {/* The ESCAPD logo, large and centred: the brand art's cream letters with the lit keyhole, keyed onto the black. */}
          <Animated.View style={[styles.titleGroup, logoIn]}>
            <View accessible accessibilityRole="header" accessibilityLabel="ESCAPD" testID="hub-logo" style={styles.lift}>
              <Image source={WORDMARK} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
            </View>
          </Animated.View>
          <View style={styles.lift}>
          <Chip
            ref={helpRef}
            accessibilityLabel="Settings"
            icon={<GearGlyph />}
            lens
            onPress={openSheet}
            disabled={busy !== null}
            testID="hub-settings"
          />
          </View>
        </View>
        <ScrollView
          style={styles.column}
          contentContainerStyle={[styles.cards, { paddingBottom: insets.bottom + M.foot }]}
          onLayout={(e) => {
            const { y, height } = e.nativeEvent.layout;
            setViewport((v) => (v && v.y === y && v.height === height ? v : { y, height }));
          }}
          testID="hub-cards"
        >
          {/* Reading order is the deck's order; later cards lie on top (no zIndex). */}
          {GENRES.map((genre, i) => (
            <FallIn
              key={genre}
              index={i + 1}
              tilt={deckTilt(i)}
              style={{ marginTop: i === 0 ? 0 : -deck.overlap }}
            >
            <ModeCard
              ref={(node) => {
                cardRefs.current[genre] = node;
              }}
              genre={genre}
              busy={busy === genre}
              disabled={busy !== null && busy !== genre}
              onPress={() => {
                openMode(genre);
              }}
              onWordsLayout={(height) => {
                const h = Math.ceil(height);
                setWords((w) => (w[genre] === h ? w : { ...w, [genre]: h }));
              }}
              style={{ height: deck.card }}
            />
            </FallIn>
          ))}
        </ScrollView>

        {/* The cat, sitting on the window sill, watching the rain. Tap it. */}
        {showCat ? (
          <View style={[styles.sillCat, { bottom: windowHeight - sillTop - CAT.sink }]} pointerEvents="box-none">
            <SittingCat width={Math.floor(catWidth)} delay={FALL.delay + 4 * FALL.stagger} label="The black cat, on the window sill" />
          </View>
        ) : null}

        {/* Always mounted: Android speaks a polite live region when its content changes, never one that has just mounted. Over the last card's foot, clear of the cat on the sill. */}
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="box-none"
          style={[styles.noticeSlot, { bottom: fits ? windowHeight - deckBottom + M.pad : insets.bottom + M.foot + M.pad }]}
          testID="hub-notice-slot"
        >
          {notice ? <HubNotice key={notice.id} offline={notice.offline} /> : null}
        </View>
      </View>

      {sheetOpen ? (
        <SettingsSheet key={sheetKey} onClose={() => closeSheet(true)} onOpen={openRoute} />
      ) : null}
      {prompt ? (
        <ResumeSheet
          key={prompt.key}
          genre={prompt.genre}
          target={prompt.target}
          busy={busy === prompt.genre}
          onContinue={() => resume(prompt)}
          onStartNew={() => resumeFresh(prompt)}
          onClose={() => closePrompt(true)}
        />
      ) : null}
    </View>
  );
}

/** How much of the column the deck fills: smaller cards, the sill and the cat in view below them. */
const DECK_SHARE = 0.8;

/**
 * The sill cat: `width` at most, never under `minWidth` (else it's left
 * out); its art's height / width (assets/characters/cat_sit.png); its feet
 * `sink` below the sill's top edge; at least `gap` clear of the deck.
 */
const CAT = { width: 64, minWidth: 34, aspect: 640 / 444, sink: 6, gap: 6 } as const;

/** How far the turned cards reach below their unturned box: half the card's width times the steepest tilt's sine. */
function tiltOverhang(cardWidth: number): number {
  const steepest = Math.max(...ref.layout.hub.modes.deck.tilt.map(Math.abs));
  return Math.ceil((cardWidth / 2) * Math.sin((steepest * Math.PI) / 180));
}

/** Home's elements arrive a beat after the window: they fall into place (fade only under reduced motion). */
const FALL = { delay: 1000, stagger: 120, from: -70, duration: 620 } as const;

function useFallIn(index: number) {
  const { reducedMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(FALL.delay + index * FALL.stagger, withTiming(1, { duration: reducedMotion ? 200 : FALL.duration, easing: Easing.out(Easing.back(1.1)) })));
  }, [p, index, reducedMotion]);
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get() * 1.6),
    transform: reducedMotion ? [] : [{ translateY: (1 - p.get()) * FALL.from }],
  }));
}

/**
 * A card falling into the deck. The tilt is on a still wrapper: the fall's
 * animated transform (translateY) would replace a rotate in the same style.
 */
function FallIn({ index, tilt, style, children }: { index: number; tilt: number; style: ViewStyle; children: ReactNode }) {
  const fall = useFallIn(index);
  return (
    <View style={[style, { transform: [{ rotate: `${tilt}deg` }] }]}>
      <Animated.View style={[styles.card, fall]}>{children}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shell's black. No glow, no grain.
  root: { flex: 1, backgroundColor: ref.color.void },
  sillCat: { position: "absolute", right: ref.space.xl + 8 },
  // Every element on the window casts a shadow, so it reads on the night and the rain.
  lift: { shadowColor: "#000000", shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  card: { shadowColor: "#000000", shadowOpacity: 0.65, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 14 },
  screen: { ...StyleSheet.absoluteFill },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ref.space.lg - CHIP_PAD,
  },
  chipSlot: { width: ref.button.chip.hit, height: ref.button.chip.hit },
  // Centred between the two 48 slots, so on the screen's axis.
  titleGroup: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { height: H.header.logo, width: H.header.logo * H.header.logoAspect },
  column: { flex: 1 },
  cards: { flexGrow: 1, paddingTop: M.top, paddingHorizontal: M.edge },
  noticeSlot: { position: "absolute", left: M.edge + M.pad, right: M.edge + M.pad, alignItems: "center" },
});
