// Settings (docs/DESIGN.md, 01 · Layout: Settings sheet; Tappable elements;
// States), opened from the hub's sliders chip. The kit's DarkSheet (it slides
// up on ref.motion.sheetRise with no spring, 40 pt top corners, Close
// concentric with the corner, focus to the title, VoiceOver trapped), holding
// grouped rows in the review screen's list style: a Bold 14 section heading
// over a raised panel with 8 pt corners, rows at least 52 tall split by rim
// lines. Only settings that work today:
// - Gameplay: Show interactives and Case clock (local, AsyncStorage), Sound
//   (the server's sound_enabled, which the sound player honours) and
//   Haptics (the server's haptics_enabled, which useFeedback honours).
// - Accessibility: Reduce motion (the server's reduced_motion, which drives
//   the app's reduced motion).
// - Gameplay also holds "Replay The Study" once The Study has been solved
//   (the mode screens that listed it are gone): it closes the sheet and runs
//   /tutorial again.
// - Account: "Add your email" for a guest (to /account), or the signed-in
//   email as a plain value; ESCAPD Pro (to /pro).
// - About: the app's version.
// A server-backed switch shows its new value at once and saves in the
// background (signing a new player in as a guest first, as THE STUDY does,
// since settings live on the account); if saving fails it flips back and a
// quiet grey line under the title says why. Each switch row is one
// accessible switch; each navigation row a button ending in a chevron.
// Haptics: a switch ticks when its value changes (Haptics itself ticks once
// just after it turns on, so the player feels it start, and not when it
// turns off); a navigation row gives the `press` on press-in; Close is the
// kit's, which presses too.
// Render it conditionally: it animates in on mount and out on unmount.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Constants from "expo-constants";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { DarkSheet, FocusRing, useFocusRing, useSheetClose } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { usePreferences } from "@/game/preferences";
import { currentSession, ensureSession, isNetworkError } from "@/lib/escapd-api";
import { ref } from "@/theme/tokens";
import type { StudyEntry } from "./caseStatus";

const H = ref.layout.hub;
const S = H.settings;

// Every word in the sheet. Plain and calm; no darkroom words.
export const COPY = {
  title: "Settings",
  gameplay: "Gameplay",
  interactives: "Show interactives",
  interactivesDetail: "Keep the marks on objects you can use visible.",
  replayStudy: "Replay The Study",
  replayStudyDetail: "The first case, from the top.",
  caseClock: "Case clock",
  caseClockDetail: "Show how long you've been on a case.",
  sound: "Sound",
  soundDetail: "Room tone and the click of locks. Follows your silent switch.",
  haptics: "Haptics",
  hapticsDetail: "A light tap when you press or find something.",
  accessibility: "Accessibility",
  reduceMotion: "Reduce motion",
  reduceMotionDetail: "Fades in place of slides and sweeps.",
  account: "Account",
  addEmail: "Add your email",
  email: "Email",
  pro: "ESCAPD Pro",
  about: "About",
  version: "Version",
  offline: "Couldn't save that while offline. It's back as it was.",
  failed: "Couldn't save that just now. It's back as it was.",
} as const;
const SW = H.sheet.switch;
const T = ref.type;
/**
 * react-native-web draws an on switch's thumb in its own teal unless it is
 * given activeThumbColor (a web-only prop the native types don't know):
 * the black thumb on every platform.
 */
const WEB_THUMB: object = Platform.OS === "web" ? { activeThumbColor: SW.thumb } : {};

/** The app's version, from the app config (expo-constants). */
const VERSION = Constants.expoConfig?.version ?? null;

type ServerSetting = "haptics_enabled" | "sound_enabled" | "reduced_motion";

/** Where a navigation row goes. */
export type SettingsRoute = "/account" | "/pro" | "/tutorial";

export interface SettingsSheetProps {
  /** Close, scrim and Android back. Focus returns to the Settings chip once the sheet has left. */
  onClose: () => void;
  /** A navigation row: closes the sheet, then opens the route. */
  onOpen: (route: SettingsRoute) => void;
  /** The Study's entry, from home's fetch: "replay" (solved) adds Replay The Study. */
  study?: StudyEntry | null;
}

export function SettingsSheet({ onClose, onOpen, study = null }: SettingsSheetProps) {
  const prefs = usePreferences();
  const feedback = useFeedback();
  // Haptics just switched on: tick once the setting has taken (feedback follows it).
  const hapticsTurnedOn = useRef(false);
  useEffect(() => {
    if (hapticsTurnedOn.current && prefs.haptics_enabled) {
      hapticsTurnedOn.current = false;
      feedback.tick();
    }
  }, [feedback, prefs.haptics_enabled]);
  // A server switch's new value while it saves (shown at once).
  const [pending, setPending] = useState<Partial<Record<ServerSetting, boolean>>>({});
  const [note, setNote] = useState<string | null>(null);
  // The signed-in email, read from the stored session (no network). Null for a guest or no session.
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    currentSession()
      .then((session) => {
        const user = session?.user;
        if (live && user && !user.is_anonymous && user.email) setEmail(user.email);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const save = async (key: ServerSetting, value: boolean) => {
    setNote(null);
    // Haptics ticks once it has turned on (above), never as it turns off.
    if (key === "haptics_enabled") hapticsTurnedOn.current = value;
    else feedback.tick();
    setPending((p) => ({ ...p, [key]: value }));
    try {
      await ensureSession();
      await prefs.update({ [key]: value });
    } catch (error) {
      if (key === "haptics_enabled") hapticsTurnedOn.current = false;
      // Flip back (the local value; a second failed save is expected offline) and say why, calmly.
      prefs.update({ [key]: !value }).catch(() => {});
      const message = isNetworkError(error) ? COPY.offline : COPY.failed;
      setNote(message);
      AccessibilityInfo.announceForAccessibility(message);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };
  const shown = (key: ServerSetting) => pending[key] ?? prefs[key];

  return (
    <DarkSheet
      title={COPY.title}
      meta={note ?? undefined}
      onClose={onClose}
      maxHeight={S.maxHeight}
      testID="hub-sheet"
      closeTestID="hub-sheet-close"
    >
      <Section title={COPY.gameplay}>
        <SwitchRow
          label={COPY.interactives}
          detail={COPY.interactivesDetail}
          value={prefs.hotspotAssist}
          onChange={(on) => {
            feedback.tick();
            prefs.setHotspotAssist(on);
          }}
          testID="hub-show-interactives"
        />
        <SwitchRow
          label={COPY.caseClock}
          detail={COPY.caseClockDetail}
          value={prefs.caseClock}
          onChange={(on) => {
            feedback.tick();
            prefs.setCaseClock(on);
          }}
          testID="hub-case-clock"
        />
        <SwitchRow
          label={COPY.sound}
          detail={COPY.soundDetail}
          value={shown("sound_enabled")}
          onChange={(on) => {
            save("sound_enabled", on);
          }}
          testID="hub-sound"
        />
        <SwitchRow
          label={COPY.haptics}
          detail={COPY.hapticsDetail}
          value={shown("haptics_enabled")}
          onChange={(on) => {
            save("haptics_enabled", on);
          }}
          testID="hub-haptics"
        />
        {study === "replay" ? (
          <LinkRow label={COPY.replayStudy} detail={COPY.replayStudyDetail} onPress={() => onOpen("/tutorial")} testID="hub-replay-study" />
        ) : null}
      </Section>
      <Section title={COPY.accessibility}>
        <SwitchRow
          label={COPY.reduceMotion}
          detail={COPY.reduceMotionDetail}
          value={shown("reduced_motion")}
          onChange={(on) => {
            save("reduced_motion", on);
          }}
          testID="hub-reduce-motion"
        />
      </Section>
      <Section title={COPY.account}>
        {email ? (
          <ValueRow label={COPY.email} value={email} testID="hub-email" />
        ) : (
          <LinkRow label={COPY.addEmail} onPress={() => onOpen("/account")} testID="hub-account" />
        )}
        <LinkRow label={COPY.pro} onPress={() => onOpen("/pro")} testID="hub-pro" />
      </Section>
      {VERSION ? (
        <Section title={COPY.about}>
          <ValueRow label={COPY.version} value={VERSION} testID="hub-version" />
        </Section>
      ) : null}
    </DarkSheet>
  );
}

/** A Bold 14 heading over a raised panel; rim lines between the rows, inset from the left. */
function Section({ title, children }: { title: string; children: ReactNode[] | ReactNode }) {
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <View style={styles.group}>
        {rows.map((row, i) => (
          <View key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {row}
          </View>
        ))}
      </View>
    </View>
  );
}

function RowText({ label, detail }: { label: string; detail?: string }) {
  return (
    <View style={styles.rowText}>
      <Text style={styles.label}>{label}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
    </View>
  );
}

/** One accessible switch: the row toggles, the native switch only shows the value. */
function SwitchRow({
  label,
  detail,
  value,
  onChange,
  testID,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (on: boolean) => void;
  testID: string;
}) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={detail}
      accessibilityState={{ checked: value }}
      onPress={() => {
        // Not awaited: the switch shows its new value at once while it saves.
        onChange(!value);
      }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <RowText label={label} detail={detail} />
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Switch
          value={value}
          focusable={false}
          trackColor={{ true: SW.on, false: SW.off }}
          thumbColor={SW.thumb}
          {...WEB_THUMB}
          ios_backgroundColor={SW.off}
          testID={`${testID}-switch`}
        />
      </View>
      <FocusRing visible={focus.focused} shape="panel" radius={S.radius} />
    </Pressable>
  );
}

/** A button row ending in a chevron. */
/** A row that opens a route: the route opens, then the sheet slides away on its own close (on top as it falls). */
function LinkRow({ label, detail, onPress, testID }: { label: string; detail?: string; onPress: () => void; testID: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const close = useSheetClose();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={detail}
      onPress={() => {
        onPress();
        close?.();
      }}
      onPressIn={() => feedback.press()}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <RowText label={label} detail={detail} />
      <CaretRightIcon size={S.caret} weight="regular" color={ref.color.textSecondary} />
      <FocusRing visible={focus.focused} shape="panel" radius={S.radius} />
    </Pressable>
  );
}

/** A label and a plain value: one text element for screen readers, not a control. */
function ValueRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.row} testID={testID}>
      <RowText label={label} />
      <Text numberOfLines={1} style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...S.heading, color: ref.color.textPrimary, marginBottom: S.headingGap },
  group: { backgroundColor: S.fill, borderRadius: S.radius, ...ref.curve },
  divider: { height: H.hairline, marginLeft: S.pad, backgroundColor: S.divider },
  row: {
    minHeight: S.rowHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: S.gap,
    paddingHorizontal: S.pad,
    paddingVertical: ref.space.sm,
  },
  pressed: { opacity: S.pressedOpacity },
  // The label column wraps at large text; the switch, chevron and value keep their size.
  rowText: { flex: 1, gap: ref.space.xs },
  label: { ...T.body, color: ref.color.textPrimary },
  detail: { ...T.meta, color: ref.color.textSecondary },
  value: { ...T.body, color: ref.color.textSecondary, flexShrink: 1 },
});
