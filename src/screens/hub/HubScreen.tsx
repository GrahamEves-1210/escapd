// 01 · Game mode, the hub at / (docs/DESIGN.md), in Opal's look: a black room
// with a green-teal glow rising from the floor, a header of round dark chips
// with a centred title and a faint gradient divider, a large empty band, then
// the title and a grey subtitle over three tilted glass cards: THE STUDY (the
// guided first case), YOUR ROOM (photograph a room, behind openCapture's
// access check) and YOUR CASE (the newest own case). The hub is the app's
// root, so Opal's dismiss chevron and X disc are left out; the chevron's place
// stays empty so the title stays centred, and the space under the cards is
// floor glow.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type HostInstance,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect } from "react-native-svg";
import { openCapture } from "@/capture/openCapture";
import { Wordmark } from "@/components/Wordmark";
import { FloorGlow, gradientLine, gradientStops } from "@/components/noir";
import { ensureSession, isNetworkError } from "@/lib/escapd-api";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import {
  ROOM_LABEL,
  ROOM_NOTE,
  TAGS,
  caseDisabled,
  caseHint,
  caseLabel,
  caseNote,
  caseSolved,
  studyLabel,
  studyNote,
  type CardId,
} from "./caseStatus";
import { CardStack, Fan, type DeckCard } from "./Deck";
import { Chip, SlidersGlyph } from "./Chip";
import { SettingsSheet, type SettingsRoute } from "./SettingsSheet";
import { HubNotice } from "./HubNotice";
import { CHIP_PAD, columnHeight, fanFits, fanGlow, fanScale, fanTop, type Marks } from "./layout";
import { useHubData } from "./useHubData";


const H = ref.layout.hub;
const W = H.weights;
const T = ref.type;
const DIVIDER = ref.gradient.divider;

type Busy = Extract<CardId, "study" | "room">;

interface Notice {
  /** Bumped per failure, so a repeat failure fades in and is announced again. */
  id: number;
  offline: boolean;
}

export function HubScreen() {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const { reducedMotion } = useTheme();
  const { study, ownCase } = useHubData();
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [marks, setMarks] = useState<Marks>({});
  const helpRef = useRef<HostInstance>(null);
  const action = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const focusReturn = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dividerId = `divider${useId().replace(/[^A-Za-z0-9]/g, "")}`;

  // A narrow or short screen scales the whole fan down; large text (from the
  // first larger step), or a fan that would drop under 0.75, stacks the
  // cards. Decided from the window, text size and safe areas; never animated.
  const scale = fanScale(width, columnHeight(height, insets), fontScale);
  const stacked = !fanFits(fontScale, scale);
  // Fanned, the floor glow rises with the fan; stacked, it keeps its own place.
  const glow = stacked ? undefined : fanGlow(height, fanTop(height, insets, fontScale, scale), scale);

  const onTopSpacerLayout = (e: LayoutChangeEvent) => {
    if (notice) return;
    const topSpacer = e.nativeEvent.layout.height;
    setMarks((current) => (current.topSpacer === topSpacer ? current : { ...current, topSpacer }));
  };

  // Leaving the hub drops a late result (nothing navigates a player who has
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

  const begin = (card: Busy) => {
    setNotice(null);
    const controller = new AbortController();
    action.current = controller;
    setBusy(card);
    return controller.signal;
  };
  // Only the current action ends the busy state; an aborted one already has.
  const end = (signal: AbortSignal) => {
    if (action.current?.signal !== signal) return;
    action.current = null;
    setBusy(null);
  };

  // THE STUDY: sign a new player in as a guest, then resume or start through
  // /tutorial (start_or_resume_session). A failure shows the notice.
  const openStudy = async () => {
    const signal = begin("study");
    try {
      await ensureSession();
      if (!signal.aborted) router.push("/tutorial");
    } catch (error) {
      if (!signal.aborted) {
        failures.current += 1;
        setNotice({ id: failures.current, offline: isNetworkError(error) });
      }
    } finally {
      end(signal);
    }
  };

  // YOUR ROOM: openCapture() checks access, then opens the photo guide, which
  // shows before every new room and continues to the camera. If the check
  // can't run it rejects without navigating and the card carries on to
  // /capture: its backstop still shows the guide first, and /capture/develop
  // checks access again before anything is sent.
  const openRoom = async () => {
    const signal = begin("room");
    try {
      await openCapture({ signal });
    } catch {
      if (!signal.aborted) router.push("/capture");
    } finally {
      end(signal);
    }
  };

  // YOUR CASE: play a ready case (start_or_resume_session resumes or starts
  // fresh); a building or failed one opens the build wait (/capture/develop).
  const openCase = () => {
    setNotice(null);
    if (ownCase.kind === "ready") router.push({ pathname: "/play/[roomId]", params: { roomId: ownCase.roomId } });
    else if (ownCase.kind === "developing" || ownCase.kind === "failed") {
      router.push({ pathname: "/capture/develop", params: { roomId: ownCase.roomId } });
    }
  };

  const cancelFocusReturn = useCallback(() => {
    if (focusReturn.current) clearTimeout(focusReturn.current);
    focusReturn.current = null;
  }, []);
  // A pending focus return never outlives the hub.
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
  // A Settings row that leaves the hub: the sheet closes (no focus return), then the route opens.
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

  const caseOff = caseDisabled(ownCase);
  const cards: DeckCard[] = [
    {
      id: "study",
      tag: TAGS.study,
      note: studyNote(study),
      accessibilityLabel: studyLabel(study),
      busy: busy === "study",
      dimmed: busy !== null && busy !== "study",
      onPress: () => {
        openStudy();
      },
      testID: "hub-card-study",
    },
    {
      id: "room",
      tag: TAGS.room,
      note: ROOM_NOTE,
      accessibilityLabel: ROOM_LABEL,
      busy: busy === "room",
      dimmed: busy !== null && busy !== "room",
      onPress: () => {
        openRoom();
      },
      testID: "hub-card-room",
    },
    {
      id: "case",
      tag: TAGS.case,
      note: caseNote(ownCase),
      developing: ownCase.kind === "developing",
      solved: caseSolved(ownCase),
      accessibilityLabel: caseLabel(ownCase),
      accessibilityHint: caseHint(ownCase),
      unavailable: caseOff,
      // Already at 0.45 when its own state disables it: never dimmed twice.
      dimmed: busy !== null && !caseOff,
      waiting: ownCase.kind === "loading",
      onPress: openCase,
      testID: "hub-card-case",
    },
  ];

  // Always mounted: Android speaks a polite live region when its content
  // changes, never one that has just mounted.
  const noticeSlot = (style: StyleProp<ViewStyle>) => (
    <View accessibilityLiveRegion="polite" style={style} testID="hub-notice-slot">
      {notice ? <HubNotice key={notice.id} offline={notice.offline} /> : null}
    </View>
  );

  const heading = (
    <>
      <Text accessibilityRole="header" style={[T.title, styles.title]}>
        Choose a case
      </Text>
      <Text style={[T.subtitle, styles.subtitle]}>Three files on the desk.</Text>
    </>
  );

  return (
    <View style={styles.root}>
      {/* Black, with the green-teal glow rising from the floor (static). */}
      <FloorGlow glow={glow} />
      {/* Everything behind the sheet: hidden from TalkBack while it is open (VoiceOver is trapped by the sheet). */}
      <View
        style={styles.screen}
        accessibilityElementsHidden={sheetOpen}
        importantForAccessibility={sheetOpen ? "no-hide-descendants" : "auto"}
      >
        {/* Chip row: the 36 discs at safe top + 12, 16 from the edges, each in its 48 hit box. */}
        <View style={[styles.header, { paddingTop: insets.top + H.header.top - CHIP_PAD }]}>
          {/* Opal's dismiss chevron: left out (the hub is the root). Its place keeps the title centred. */}
          <View style={styles.chipSlot} />
          {/* The ESCAPD wordmark in white, its doorway edge grey (no brass), centred: the screen's name. */}
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

        {stacked ? (
          <ScrollView
            style={styles.column}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + ref.space.lg }]}
            testID="hub-stacked"
          >
            <View
              onLayout={onTopSpacerLayout}
              style={notice && marks.topSpacer !== undefined ? { height: marks.topSpacer } : styles.aboveHero}
            />
            {heading}
            <CardStack cards={cards} style={styles.deck} />
            {noticeSlot(notice ? styles.stackNotice : null)}
            <View style={{ flex: W.below }} />
          </ScrollView>
        ) : (
          // Divider to the safe bottom: Opal's 124 band (at most) above the title; the rest below the cards.
          <View style={[styles.column, { marginBottom: insets.bottom }]} testID="hub-fanned">
            <View style={styles.aboveHero} />
            {heading}
            <Fan cards={cards} scale={scale} style={styles.deck} />
            {/* The notice overlays this space, so the layout never shifts. */}
            <View style={{ flex: W.below }}>{noticeSlot(styles.fanNotice)}</View>
          </View>
        )}
      </View>

      {sheetOpen ? <SettingsSheet onClose={closeSheet} onOpen={openRoute} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Opal's black, then the floor glow, then content. No grain.
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
  // Opal's band above the title: the spacer's share of the free space, never more than 124.
  aboveHero: { flex: W.above, maxHeight: H.band },
  scrollContent: { flexGrow: 1 },
  // Title and subtitle wrap at large text; nothing shrinks.
  title: { color: ref.color.textPrimary, textAlign: "center", paddingHorizontal: ref.space.edge },
  subtitle: { color: ref.color.textSecondaryAlpha, textAlign: "center", marginTop: ref.space.xs, paddingHorizontal: ref.space.edge },
  deck: { marginTop: ref.space.band },
  // xl 24 below the fan container, centred.
  fanNotice: { position: "absolute", top: ref.space.xl, left: ref.space.edge, right: ref.space.edge },
  stackNotice: { marginTop: ref.space.xl, marginHorizontal: ref.space.edge },
});
