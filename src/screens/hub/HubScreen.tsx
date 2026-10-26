// 01 · Home, at / (MODES_PROMPT.md Part 2), the shell: it keeps the
// reference look (black, Opal's header with the ESCAPD wordmark and the
// Settings chip, white type, the brass focus ring), and below the header
// three solid mode cards fill the screen: DETECTIVE NOIR, CRIME SCENE and
// PARANORMAL, each in its own mode's palette (ModeCard). A short screen or
// large text scrolls them.
// - Noir: the first tap runs The Study (/tutorial) while it has never been
//   played (studyEntry's Unseal); after that it opens /mode/noir.
// - Crime scene and paranormal: the first time, their one-screen intro
//   (/mode/<genre>/intro, which continues to the mode); after that /mode/<genre>.
// Home is the shell, so it clears the active mode each time it gains focus.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, ScrollView, StyleSheet, View, type HostInstance } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect } from "react-native-svg";
import { Wordmark } from "@/components/Wordmark";
import { gradientLine, gradientStops } from "@/components/noir";
import { GENRES } from "@/game/mode";
import { useModeOnFocus } from "@/game/useModeOnFocus";
import { ensureSession, getLatestSession, isNetworkError } from "@/lib/escapd-api";
import type { Genre } from "@/lib/puzzle-types";
import { useModeArt } from "@/screens/mode/art";
import { hasSeenIntro } from "@/screens/mode/introSeen";
import { introHref, modeHref } from "@/screens/mode/routes";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { TUTORIAL_ROOM_ID } from "@/tutorial/assets";
import { studyEntry } from "./caseStatus";
import { Chip, SlidersGlyph } from "./Chip";
import { HubNotice } from "./HubNotice";
import { ModeCard } from "./ModeCard";
import { SettingsSheet, type SettingsRoute } from "./SettingsSheet";
import { useHubData } from "./useHubData";

const H = ref.layout.hub;
const M = H.modes;
const DIVIDER = ref.gradient.divider;
/** The 6 between a chip's 48 hit box and its 36 disc. */
const CHIP_PAD = (ref.button.chip.hit - ref.button.chip.size) / 2;

interface Notice {
  /** Bumped per failure, so a repeat failure fades in and is announced again. */
  id: number;
  offline: boolean;
}

export function HubScreen() {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const { study, counts } = useHubData();
  const art = useModeArt();
  const [busy, setBusy] = useState<Genre | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const helpRef = useRef<HostInstance>(null);
  const action = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const focusReturn = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dividerId = `divider${useId().replace(/[^A-Za-z0-9]/g, "")}`;

  // Home is the shell: no mode while it is in front.
  useModeOnFocus(null);

  // Leaving home drops a late result (nothing navigates a player who has
  // gone), returns a busy card to idle and clears the notice, which stays
  // only until the next focus.
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

  const begin = (genre: Genre) => {
    setNotice(null);
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

  // Noir: The Study first. Once it has been played (Continue or Replay), the
  // mode screen, where The Study stays as a case to replay. Otherwise sign a
  // new player in as a guest and run /tutorial; when the focus fetch hasn't
  // said (still loading, or it failed), ask for the tutorial session first.
  const openNoir = async () => {
    if (study === "continue" || study === "replay") {
      setNotice(null);
      router.push(modeHref("noir"));
      return;
    }
    const signal = begin("noir");
    try {
      await ensureSession();
      if (signal.aborted) return;
      const entry = study ?? studyEntry(await getLatestSession(TUTORIAL_ROOM_ID));
      if (!signal.aborted) router.push(entry === "unseal" ? "/tutorial" : modeHref("noir"));
    } catch (error) {
      if (!signal.aborted) {
        failures.current += 1;
        setNotice({ id: failures.current, offline: isNetworkError(error) });
      }
    } finally {
      end(signal);
    }
  };

  // Crime scene and paranormal: the intro the first time, then the mode. The
  // flag is a quick local read, so the card shows no busy state; a second
  // tap while it reads is dropped.
  const opening = useRef(false);
  const openMode = async (genre: Genre) => {
    if (opening.current) return;
    opening.current = true;
    setNotice(null);
    try {
      const seen = await hasSeenIntro(genre);
      router.push(seen ? modeHref(genre) : introHref(genre));
    } finally {
      opening.current = false;
    }
  };

  const cancelFocusReturn = useCallback(() => {
    if (focusReturn.current) clearTimeout(focusReturn.current);
    focusReturn.current = null;
  }, []);
  // A pending focus return never outlives home.
  useEffect(() => cancelFocusReturn, [cancelFocusReturn]);

  const openSheet = () => {
    // Reopened before the last close finished leaving: that focus return is moot.
    cancelFocusReturn();
    setSheetOpen(true);
  };
  // Closing the sheet (Close, scrim, Android back) returns screen-reader focus
  // to the Settings chip once the sheet has left: until then its modal layer
  // is still mounted and VoiceOver ignores the move. This waits out its exit
  // (ref.motion.sheetFall, or motion.reducedFade) plus a margin for the
  // layer's removal.
  const closeSheet = useCallback(() => {
    cancelFocusReturn();
    setSheetOpen(false);
    const exit = reducedMotion ? motion.reducedFade : ref.motion.sheetFall.duration;
    focusReturn.current = setTimeout(() => {
      focusReturn.current = null;
      const help = helpRef.current;
      if (help) AccessibilityInfo.sendAccessibilityEvent(help, "focus");
    }, exit + H.sheet.focusMargin);
  }, [reducedMotion, cancelFocusReturn]);
  // A Settings row that leaves home: the sheet closes (no focus return), then the route opens.
  // Adding an email comes back here when done, as everywhere else that asks.
  const openRoute = (route: SettingsRoute) => {
    cancelFocusReturn();
    setSheetOpen(false);
    if (route === "/account") router.push({ pathname: "/account", params: { next: "back" } });
    else router.push(route);
  };

  // Android back: the sheet closes first; a busy card swallows it until it
  // navigates or shows the notice; otherwise the system leaves the app (root).
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (sheetOpen) {
          closeSheet();
          return true;
        }
        return busy !== null;
      });
      return () => subscription.remove();
    }, [sheetOpen, busy, closeSheet]),
  );

  return (
    <View style={styles.root}>
      {/* Everything behind the sheet: hidden from TalkBack while it is open (VoiceOver is trapped by the sheet). */}
      <View
        style={styles.screen}
        accessibilityElementsHidden={sheetOpen}
        importantForAccessibility={sheetOpen ? "no-hide-descendants" : "auto"}
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
          testID="hub-cards"
        >
          {GENRES.map((genre) => (
            <ModeCard
              key={genre}
              genre={genre}
              art={art}
              count={counts?.[genre]}
              busy={busy === genre}
              disabled={busy !== null && busy !== genre}
              onPress={() => {
                if (genre === "noir") openNoir();
                else openMode(genre);
              }}
              style={styles.card}
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

      {sheetOpen ? <SettingsSheet onClose={closeSheet} onOpen={openRoute} /> : null}
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
  // The cards share the column's height; each keeps its content and minimum, so large text scrolls.
  cards: { flexGrow: 1, paddingTop: M.top, paddingHorizontal: M.edge, gap: M.gap },
  card: { flexGrow: 1 },
  noticeSlot: { position: "absolute", left: M.edge + M.pad, right: M.edge + M.pad, alignItems: "center" },
});
