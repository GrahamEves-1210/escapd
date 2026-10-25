// 01 · Game mode, the hub at / (docs/DESIGN.md). Three case files on the
// silk, each a small film plate on a walnut mount with a brass plate label,
// under the painted brass reading glass: the play screen's look. It replaces
// the old title screen and keeps what it offered, through the cards: THE STUDY
// (the guided first case), YOUR ROOM (photograph a room, behind openCapture's
// access check) and YOUR CASE (the newest own case).
import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from "react";
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type HostInstance,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { openCapture } from "@/capture/openCapture";
import { Grain } from "@/components/Grain";
import { IconButton, type IconButtonProps } from "@/components/IconButton";
import { ICON_SIZE, ICON_WEIGHT, QuestionIcon } from "@/components/icons";
import { BackgroundStill } from "@/components/noir";
import { Text } from "@/components/Text";
import { Wordmark } from "@/components/Wordmark";
import { ensureSession, isNetworkError } from "@/lib/escapd-api";
import { useTheme } from "@/theme/ThemeProvider";
import { color, hit, motion, ref, space } from "@/theme/tokens";
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
import { HowYouPlaySheet } from "./HowYouPlaySheet";
import { HubNotice } from "./HubNotice";
import { columnHeight, fanFits, glassFits, type Marks } from "./layout";
import { Magnifier } from "./Magnifier";
import { useHubData } from "./useHubData";

const H = ref.layout.hub;
const W = H.weights;

// The live IconButton hands every Pressable prop on, ref included (React 19
// passes ref as a prop); its props type just doesn't declare one. The ref is
// how focus returns here when the sheet closes.
const HelpButton = IconButton as ComponentType<IconButtonProps & { ref?: Ref<HostInstance> }>;

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

  // Large text (from the first larger step) or a screen under 375 wide stacks
  // the cards; the glass goes first, and on short screens it goes alone.
  // Decided from the window, text size and safe areas; never animated.
  const stacked = !fanFits(width, fontScale);
  const withGlass = !stacked && glassFits(marks.column ?? columnHeight(height, insets), fontScale);

  const mark = useCallback((patch: Partial<Marks>) => {
    setMarks((current) => {
      const keys = Object.keys(patch) as (keyof Marks)[];
      return keys.every((key) => current[key] === patch[key]) ? current : { ...current, ...patch };
    });
  }, []);
  const onColumnLayout = (e: LayoutChangeEvent) => mark({ column: e.nativeEvent.layout.height });
  const onTopSpacerLayout = (e: LayoutChangeEvent) => {
    if (!notice) mark({ topSpacer: e.nativeEvent.layout.height });
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

  // YOUR ROOM: openCapture() checks access, then sends a first-timer to the
  // guide and everyone else to the camera. If the check can't run it rejects
  // without navigating and the card carries on to /capture: its backstop still
  // shows a first-timer the guide, and /capture/develop checks access again
  // before anything is sent.
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
  // fresh); a developing or failed one opens the darkroom.
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
  // to the How you play button once the sheet has left: until then its modal
  // layer is still mounted and VoiceOver ignores the move. The live Sheet has
  // no exit callback, so this waits out its exit (the 200 ms slide, or
  // motion.reducedFade) plus a margin for the layer's removal.
  const closeSheet = useCallback(() => {
    cancelFocusReturn();
    setSheetOpen(false);
    const exit = reducedMotion ? motion.reducedFade : H.sheetExit;
    focusReturn.current = setTimeout(() => {
      focusReturn.current = null;
      const help = helpRef.current;
      if (help) AccessibilityInfo.sendAccessibilityEvent(help, "focus");
    }, exit + H.sheetFocusMargin);
  }, [reducedMotion, cancelFocusReturn]);
  // Replay never clears the guide's seen flag; the guide sets it when closed or finished.
  const openGuide = () => {
    cancelFocusReturn();
    setSheetOpen(false);
    router.push({ pathname: "/capture/guide", params: { replay: "1" } });
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
      // Already at 0.4 when its own state disables it: never dimmed twice.
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
      <Text variant="narrativeTitle" align="center" accessibilityRole="header" style={styles.title}>
        Choose a case
      </Text>
      <Text variant="caption" tone="secondary" align="center" style={styles.subtitle}>
        Three files on the desk.
      </Text>
    </>
  );

  return (
    <View style={styles.root}>
      <BackgroundStill />
      <Grain />
      {/* Everything behind the sheet: hidden from TalkBack while it is open (VoiceOver is trapped by the sheet). */}
      <View
        style={styles.screen}
        accessibilityElementsHidden={sheetOpen}
        importantForAccessibility={sheetOpen ? "no-hide-descendants" : "auto"}
      >
        <View style={[styles.header, { paddingTop: insets.top + space.xs }]}>
          {/* Left slot: an empty spacer, not focusable (the hub has no account entry). */}
          <View style={styles.headerSlot} />
          <View
            // iOS reads a View only as an accessibility element. On Android the
            // Svg's own label is read, and `accessible` would also make the mark
            // keyboard-focusable.
            accessible={Platform.OS === "ios"}
            accessibilityRole={Platform.OS === "ios" ? "image" : undefined}
            accessibilityLabel={Platform.OS === "ios" ? "ESCAPD" : undefined}
          >
            <Wordmark height={H.wordmarkHeight} />
          </View>
          {/*
            The live IconButton draws its own brass focus ring (the kit's pill
            ring, 2 outside the 48 circle). Its hitSlop 4 and that ring both
            stay inside the header, which pads 4 below the row and 20 at the
            side: a touch outside a parent's bounds never reaches its children.
          */}
          <HelpButton
            ref={helpRef}
            accessibilityLabel="How you play"
            icon={<QuestionIcon size={ICON_SIZE} weight={ICON_WEIGHT} color={color.text} />}
            onPress={openSheet}
            disabled={busy !== null}
            testID="hub-how-you-play"
          />
        </View>
        <View style={styles.rule} />

        {stacked ? (
          <ScrollView
            style={styles.column}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom }]}
            testID="hub-stacked"
          >
            <View
              onLayout={onTopSpacerLayout}
              style={notice && marks.topSpacer !== undefined ? { height: marks.topSpacer } : { flex: W.aboveHero }}
            />
            {heading}
            <CardStack cards={cards} style={styles.deck} />
            {noticeSlot(notice ? styles.stackNotice : null)}
            <View style={{ flex: W.belowHero }} />
          </ScrollView>
        ) : (
          <View style={[styles.column, { marginBottom: insets.bottom }]} onLayout={onColumnLayout} testID="hub-fanned">
            <View style={{ flex: withGlass ? W.aboveGlass : W.aboveHero }} />
            {withGlass ? (
              <>
                <Magnifier enabled={!sheetOpen} />
                <View style={{ flex: W.belowGlass }} />
              </>
            ) : null}
            {heading}
            <Fan cards={cards} style={styles.deck} />
            {/* The notice overlays this space, so the layout never shifts. */}
            <View style={{ flex: withGlass ? W.belowFan : W.belowHero }}>{noticeSlot(styles.fanNotice)}</View>
          </View>
        )}
      </View>

      {sheetOpen ? <HowYouPlaySheet onClose={closeSheet} onGuide={openGuide} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Canvas, then the silk still, then the live grain, then content.
  root: { flex: 1, backgroundColor: color.canvas },
  screen: { ...StyleSheet.absoluteFill },
  // /play's top bar: safe top + xs, the 48 row, xs. The spacer and How you
  // play sit on the 20 gutter, as on the light table; the wordmark is centred
  // between them. The header ends xs below the button, so its hitSlop 4
  // (56 x 56) lies inside it.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.gutter,
    paddingBottom: space.xs,
  },
  headerSlot: { width: hit.min, height: hit.min },
  // A 1 pt brass hairline on the gutters, as the case-closed screen rules off a section.
  rule: { height: H.hairline, marginHorizontal: space.gutter, backgroundColor: color.hairline },
  column: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  // Title and subtitle wrap at large text; nothing shrinks.
  title: { paddingHorizontal: space.gutter },
  subtitle: { marginTop: space.xs, paddingHorizontal: space.gutter },
  deck: { marginTop: space.xl },
  // 24 below the fan container, on the 20 gutters.
  fanNotice: { position: "absolute", top: space.xl, left: space.gutter, right: space.gutter },
  stackNotice: { marginTop: space.xl, marginHorizontal: space.gutter },
});
