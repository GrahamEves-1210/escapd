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
import { GENRES, setMode, useModeTheme } from "@/game/mode";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { isNetworkError } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { hasSeenIntro } from "@/screens/mode/introSeen";
import { introHref } from "@/screens/mode/routes";
import { useTheme } from "@/theme/ThemeProvider";
import { modeThemes, motion, ref } from "@/theme/tokens";
import { continueHref, type CaseToContinue } from "./caseStatus";
import { Chip, GearGlyph } from "./Chip";
import { CharmChip } from "@/screens/collection/CharmChip";
import { deckTilt, homeDeck } from "./deck";
import { SittingCat } from "@/play2/SittingCat";
import { HubNotice } from "./HubNotice";
import { ModeCard } from "./ModeCard";
import { ResumeSheet } from "./ResumeSheet";
import { SettingsSheet, type SettingsRoute } from "./SettingsSheet";
import { useHubData } from "./useHubData";
import { WindowBackdrop, WindowForeground, windowGeometry } from "./WindowBackdrop";
import { CAT, COVER, FALL, MUG_REST, PARALLAX } from "./art/nook";
import { useParallax } from "./parallax/ParallaxLayer";
import { useTilt, type TiltValues } from "./parallax/useTilt";
import { LogoSparkle } from "./LogoSparkle";
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
  // Home is the shell: its velvet plum, glow and foil (useModeOnFocus(null) below).
  const shell = useModeTheme();
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
  // The deck fills the column down to the room the cat needs on the window's
  // sill; the cat sits under it, never touching it, and is left out where
  // there's too little room (or the deck scrolls).
  const sillTop = windowHeight - windowGeometry(windowWidth, windowHeight).sill;
  const { deck, fits, bottom: deckBottom, cat: catWidth } = homeDeck({
    room: column - M.top - insets.bottom - M.foot,
    top: columnTop + M.top,
    sillTop,
    cardWidth: windowWidth - 2 * M.edge,
    words: Math.max(0, ...Object.values(words)),
    count: GENRES.length,
  });

  // Home is the shell: no mode while it is in front.
  useModeOnFocus(null);
  // Each time home comes to the front is a visit: the cat's mug is back on the sill (it may knock it off again).
  const [sillVisit, setSillVisit] = useState({ n: 0, active: false });
  useFocusEffect(
    useCallback(() => {
      setSillVisit((v) => ({ n: v.n + 1, active: true }));
      return () => setSillVisit((v) => ({ ...v, active: false }));
    }, []),
  );

  // The set's layers slide with the phone's tilt while home is in front (never under reduced motion).
  const tilt = useTilt(sillVisit.active && !reducedMotion);
  const logoSlide = useParallax(tilt, PARALLAX.depth.logo);

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
      {/* A rainy night through the window, the frame round the screen: the set's layers, sliding with the tilt. */}
      <WindowBackdrop tilt={tilt} />
      {/* Everything behind a sheet: hidden from TalkBack while it is open (VoiceOver is trapped by the sheet). */}
      <View
        style={styles.screen}
        testID="hub-screen"
        accessibilityElementsHidden={covered}
        importantForAccessibility={covered ? "no-hide-descendants" : "auto"}
      >
        {/* Chip row: the 36 discs at safe top + 12, 16 from the edges, each in its 48 hit box. */}
        <View style={[styles.header, { paddingTop: insets.top + H.header.top - CHIP_PAD }]}>
          {/* Her charm board (home is the root, so the left slot is free): a dot while there's a charm she hasn't seen. */}
          <View style={[styles.lift, { shadowColor: shell.ground }]}>
            <CharmChip disabled={busy !== null} />
          </View>
          {/* The ESCAPD logo, large and centred: the brand art's cream letters with the lit keyhole, keyed onto the black. */}
          <Animated.View style={[styles.titleGroup, logoIn]}>
            <Animated.View accessible accessibilityRole="header" accessibilityLabel="ESCAPD" testID="hub-logo" style={[styles.lift, { shadowColor: shell.ground }, logoSlide]}>
              <Image source={WORDMARK} style={styles.logo} resizeMode="contain" accessibilityIgnoresInvertColors />
              <LogoSparkle color={shell.glow} />
            </Animated.View>
          </Animated.View>
          <View style={[styles.lift, { shadowColor: shell.ground }]}>
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
              turn={deckTilt(i)}
              shadow={modeThemes[genre].ground}
              tilt={tilt}
              testID={`hub-card-${genre}-deal`}
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
        {catWidth > 0 ? (
          <View style={[styles.sillCat, { right: CAT.right, bottom: windowHeight - sillTop - CAT.sink }]} pointerEvents="box-none">
            <SittingCat width={catWidth} delay={FALL.delay + FALL.cat * FALL.stagger} label="The black cat, on the window sill"
              mug={{ visit: sillVisit.n, active: sillVisit.active, base: CAT.sink - MUG_REST }} />
          </View>
        ) : null}
        {/* The curtains' edges, nearest of all: over the sill and the cat, under the cards and the header (styles.column, styles.header). */}
        <WindowForeground tilt={tilt} />

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

function useFallIn(index: number) {
  const { reducedMotion } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withDelay(FALL.delay + index * FALL.stagger, withTiming(1, { duration: reducedMotion ? FALL.reducedDuration : FALL.duration, easing: Easing.out(Easing.back(FALL.back)) })));
  }, [p, index, reducedMotion]);
  return useAnimatedStyle(() => ({
    opacity: Math.min(1, p.get() * FALL.fade),
    transform: reducedMotion ? [] : [{ translateY: (1 - p.get()) * FALL.from }],
  }));
}

/**
 * A card falling into the deck. Its turn is on a still wrapper: the fall's
 * animated transform (translateY) would replace a rotate in the same style
 * (and so would the slide with the phone's tilt, on a wrapper of its own).
 */
function FallIn({ index, turn, shadow, tilt, style, testID, children }: { index: number; turn: number; shadow: string; tilt: TiltValues; style: ViewStyle; testID: string; children: ReactNode }) {
  const fall = useFallIn(index);
  // Held in the hand, in front of the window: each card slides a little against the tilt, the upper cards of the deck more.
  const slide = useParallax(tilt, PARALLAX.depth.card + (index - 1) * PARALLAX.depth.cardStep);
  return (
    <View style={[style, { transform: [{ rotate: `${turn}deg` }] }]} testID={testID}>
      <Animated.View style={slide}>
        <Animated.View style={[styles.card, { shadowColor: shadow }, fall]}>{children}</Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The shell's ground, under the window art.
  root: { flex: 1, backgroundColor: ref.color.void },
  sillCat: { position: "absolute" },
  // Every element on the window casts a soft shadow in the ground's colour (never black), so it reads on the night and the rain.
  lift: { shadowOpacity: COVER.shadow.opacity, shadowRadius: COVER.shadow.radius / 2, shadowOffset: { width: 0, height: COVER.shadow.y / 2 } },
  card: { shadowOpacity: COVER.shadow.opacity, shadowRadius: COVER.shadow.radius, shadowOffset: { width: 0, height: COVER.shadow.y }, elevation: COVER.shadow.elevation },
  screen: { ...StyleSheet.absoluteFill },
  // Over the curtains' edges (WindowForeground), as the cards are.
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: ref.space.lg - CHIP_PAD,
    zIndex: 1,
  },
  // Centred between the two 48 slots, so on the screen's axis.
  titleGroup: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { height: H.header.logo, width: H.header.logo * H.header.logoAspect },
  // Over the curtains' edges too; only the cards themselves take touches, so the cat under the deck (and under
  // the curtains) can still be petted.
  column: { flex: 1, zIndex: 1, pointerEvents: "box-none" },
  cards: { flexGrow: 1, paddingTop: M.top, paddingHorizontal: M.edge, pointerEvents: "box-none" },
  noticeSlot: { position: "absolute", left: M.edge + M.pad, right: M.edge + M.pad, alignItems: "center", zIndex: 2 },
});
