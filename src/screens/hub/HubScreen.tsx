// 01 · Game mode, the hub at / (docs/DESIGN.md). Three case files dealt on a
// dark desk under a lamp, with the brass reading glass laid above them. It
// replaces the old title screen and keeps what it offered, now through the
// cards: THE STUDY (the guided first case), YOUR ROOM (photograph a room,
// behind openCapture's access check) and YOUR CASE (the newest own case).
import { useCallback, useRef, useState, type ReactNode } from "react";
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
import { QuestionIcon, WarningIcon, WifiSlashIcon } from "@/components/icons";
import { BackgroundStill, IconButton, LightPools, NoirText, NoticeLine, Rule } from "@/components/noir";
import { Wordmark } from "@/components/Wordmark";
import { ensureSession, isNetworkError } from "@/lib/escapd-api";
import { ref } from "@/theme/tokens";
import {
  ROOM_LABEL,
  ROOM_NOTE,
  STUDY_FAILED,
  STUDY_OFFLINE,
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
import { columnHeight, fanFits, fanPools, glassFits, stackPools, type Marks } from "./layout";
import { Magnifier } from "./Magnifier";
import { useHubData } from "./useHubData";

const H = ref.layout.hub;
const W = H.weights;
// How you play's hitSlop (44 to 48). A touch outside a parent's bounds never
// reaches its children, so the header carries the slop inside its own box.
const SLOP = (ref.hit.comfortable - ref.button.icon.size) / 2;

type Busy = Extract<CardId, "study" | "room">;

interface Notice {
  /** Bumped per failure, so a repeat failure fades in and is announced again. */
  id: number;
  offline: boolean;
}

export function HubScreen() {
  const insets = useSafeAreaInsets();
  const { width, height, fontScale } = useWindowDimensions();
  const { study, ownCase, flipped } = useHubData();
  const [busy, setBusy] = useState<Busy | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [marks, setMarks] = useState<Marks>({});
  const helpRef = useRef<HostInstance>(null);
  const action = useRef<AbortController | null>(null);
  const failures = useRef(0);
  const returnFocus = useRef(false);

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
  const onColumnLayout = (e: LayoutChangeEvent) => mark({ columnY: e.nativeEvent.layout.y, column: e.nativeEvent.layout.height });
  const onTitleLayout = (e: LayoutChangeEvent) => mark({ titleY: e.nativeEvent.layout.y });
  const onSubtitleLayout = (e: LayoutChangeEvent) => {
    const { y, height: h } = e.nativeEvent.layout;
    mark({ subtitleBottom: y + h });
  };
  const onGlassLayout = (e: LayoutChangeEvent) => mark({ glassX: e.nativeEvent.layout.x, glassY: e.nativeEvent.layout.y });
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

  const openSheet = () => {
    // Reopened before the last close finished leaving: that focus return is moot.
    returnFocus.current = false;
    setSheetOpen(true);
  };
  const closeSheet = useCallback(() => {
    returnFocus.current = true;
    setSheetOpen(false);
  }, []);
  // Replay never clears the guide's seen flag; the guide sets it when closed or finished.
  const openGuide = () => {
    setSheetOpen(false);
    router.push({ pathname: "/capture/guide", params: { replay: "1" } });
  };

  // Closing the sheet (Close, scrim, Android back) returns screen-reader focus
  // to the How you play button, once the sheet has finished leaving: until
  // then its modal layer is still mounted and VoiceOver ignores the move.
  const onSheetExited = useCallback(() => {
    if (!returnFocus.current) return;
    returnFocus.current = false;
    const help = helpRef.current;
    if (help) AccessibilityInfo.sendAccessibilityEvent(help, "focus");
  }, []);

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
      noteFromShimmer: flipped,
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

  const noticeLine = (style: StyleProp<ViewStyle>): ReactNode =>
    notice ? (
      <NoticeLine
        key={notice.id}
        text={notice.offline ? STUDY_OFFLINE : STUDY_FAILED}
        icon={notice.offline ? WifiSlashIcon : WarningIcon}
        variant="body"
        framed
        fadeIn
        testID="hub-notice"
        style={style}
      />
    ) : null;

  const heading = (
    <>
      <NoirText variant="title" align="center" accessibilityRole="header" onLayout={onTitleLayout} style={styles.title}>
        Choose a case
      </NoirText>
      <NoirText variant="body" align="center" onLayout={onSubtitleLayout} style={styles.subtitle}>
        Three files on the desk.
      </NoirText>
    </>
  );

  return (
    <View style={styles.root}>
      <BackgroundStill />
      {/* Everything behind the sheet: hidden from TalkBack while it is open (VoiceOver is trapped by the sheet). */}
      <View
        style={styles.screen}
        accessibilityElementsHidden={sheetOpen}
        importantForAccessibility={sheetOpen ? "no-hide-descendants" : "auto"}
      >
        {stacked ? null : <LightPools pools={fanPools(marks, width, withGlass)} />}
        <View style={[styles.header, { paddingTop: insets.top + ref.space.sm }]}>
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
            <Wordmark height={H.wordmarkHeight} tint={ref.color.bright} edgeColor={ref.color.bright} />
          </View>
          <IconButton
            ref={helpRef}
            icon={QuestionIcon}
            accessibilityLabel="How you play"
            onPress={openSheet}
            disabled={busy !== null}
            testID="hub-how-you-play"
          />
        </View>
        <Rule style={styles.divider} />

        {stacked ? (
          <ScrollView
            style={styles.column}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom }]}
            testID="hub-stacked"
          >
            <LightPools pools={stackPools(marks, width)} />
            <View
              onLayout={onTopSpacerLayout}
              style={notice && marks.topSpacer !== undefined ? { height: marks.topSpacer } : { flex: W.aboveHero }}
            />
            {heading}
            <CardStack cards={cards} style={styles.deck} />
            {noticeLine(styles.stackNotice)}
            <View style={{ flex: W.belowHero }} />
          </ScrollView>
        ) : (
          <View style={[styles.column, { marginBottom: insets.bottom }]} onLayout={onColumnLayout} testID="hub-fanned">
            <View style={{ flex: withGlass ? W.aboveGlass : W.aboveHero }} />
            {withGlass ? (
              <>
                <Magnifier enabled={!sheetOpen} onLayout={onGlassLayout} />
                <View style={{ flex: W.belowGlass }} />
              </>
            ) : null}
            {heading}
            <Fan cards={cards} style={styles.deck} />
            {/* The notice overlays this space, so the layout never shifts. */}
            <View style={{ flex: withGlass ? W.belowFan : W.belowHero }}>{noticeLine(styles.fanNotice)}</View>
          </View>
        )}
      </View>

      {sheetOpen ? <HowYouPlaySheet onClose={closeSheet} onGuide={openGuide} onExited={onSheetExited} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ref.color.ground },
  screen: { ...StyleSheet.absoluteFill },
  // Buttons at safe top + 8, 16 from the edges; the wordmark centred between
  // two 44 slots, level with the right button. The header ends SLOP below the
  // buttons, so How you play's 48 x 48 (x 331-379, y 65-113) lies inside it.
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: ref.space.lg,
    paddingBottom: SLOP,
  },
  headerSlot: { width: ref.button.icon.size, height: ref.button.icon.size },
  // y 123, x 16-377: 12 below the buttons (SLOP of it inside the header).
  divider: { marginTop: ref.space.md - SLOP, marginHorizontal: ref.space.lg },
  column: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  // Title and subtitle wrap at large text; nothing shrinks.
  title: { paddingHorizontal: ref.space.edge },
  subtitle: { marginTop: ref.space.xs, paddingHorizontal: ref.space.edge },
  deck: { marginTop: ref.space.band },
  // 24 below the fan container, 20 from the sides.
  fanNotice: { position: "absolute", top: ref.space.xl, left: ref.space.edge, right: ref.space.edge },
  stackNotice: { marginTop: ref.space.xl, marginHorizontal: ref.space.edge },
});
