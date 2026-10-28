// Settings (docs/DESIGN.md, 01 · Layout: Settings sheet; Tappable elements;
// States), opened from the hub's sliders chip. The kit's DarkSheet (it slides
// up on ref.motion.sheetRise with no spring, 40 pt top corners, Close
// concentric with the corner, focus to the title, VoiceOver trapped), holding
// grouped rows in the review screen's list style: a Bold 14 section heading
// over a raised panel with 8 pt corners, rows at least 48 tall split by rim
// lines, each detail one short line. It may grow to just under the safe top,
// so every row fits with no scroll on an iPhone SE at the default text size
// (large text scrolls). Only settings that work today:
// - Gameplay: Show interactives and Case clock (local, AsyncStorage), Sound
//   and Music side by side in one row (the server's sound_enabled, which the
//   effects and room tone honour, and music_enabled, which useMusic honours;
//   two short labels with no detail line, so the sheet still fits an iPhone
//   SE; each half is its own 48 pt switch, its detail read as a hint) and
//   Haptics (the server's haptics_enabled, which useFeedback honours).
// - Accessibility: Reduce motion (the server's reduced_motion, which drives
//   the app's reduced motion).
// - Account: "Add your email" for a guest (to /account), or the signed-in
//   email as a plain value; ESCAPD Pro (to /pro).
// - The app's version: the sheet's grey meta line under its title (a failed
//   save's note takes its place while it shows).
// A server-backed switch shows its new value at once and saves in the
// background (signing a new player in as a guest first, since settings live
// on the account); if saving fails it flips back and a quiet grey line under
// the title says why. Each switch row is one accessible switch; each
// navigation row a button ending in a chevron.
// Haptics: a switch ticks when its value changes (Haptics itself ticks once
// just after it turns on, so the player feels it start, and not when it
// turns off); a navigation row gives the `press` on press-in; Close is the
// kit's, which presses too.
// Render it conditionally: it animates in on mount and out on unmount.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CaretRightIcon } from "phosphor-react-native/src/icons/CaretRight";
import { DarkSheet, FocusRing, useFocusRing, useSheetClose } from "@/components/noir";
import { useFeedback } from "@/game/feedback";
import { usePreferences } from "@/game/preferences";
import { currentSession, ensureSession, isNetworkError } from "@/lib/escapd-api";
import { ref } from "@/theme/tokens";
import { announce } from "@/lib/a11y";

const H = ref.layout.hub;
const S = H.settings;

// Every word in the sheet. Plain and calm; no darkroom words. Each detail is
// one line beside a switch on an iPhone SE (settings.detailMax characters at most).
export const COPY = {
  title: "Settings",
  gameplay: "Gameplay",
  interactives: "Show interactives",
  interactivesDetail: "Keep marks on things you can use.",
  caseClock: "Case clock",
  caseClockDetail: "Your time on a case, as you play.",
  sound: "Sound",
  // Sound and Music share a row: no detail line, so these are read as hints only.
  soundHint: "Room tone and the click of locks.",
  music: "Music",
  musicHint: "A theme for each mode.",
  haptics: "Haptics",
  hapticsDetail: "A light tap as you press or find.",
  accessibility: "Accessibility",
  reduceMotion: "Reduce motion",
  reduceMotionDetail: "Fades in place of slides.",
  account: "Account",
  addEmail: "Add your email",
  email: "Email",
  pro: "ESCAPD Pro",
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

type ServerSetting = "haptics_enabled" | "sound_enabled" | "music_enabled" | "reduced_motion";

/** Where a navigation row goes. */
export type SettingsRoute = "/account" | "/pro";

export interface SettingsSheetProps {
  /** Close, scrim and Android back. Focus returns to the Settings chip once the sheet has left. */
  onClose: () => void;
  /** A navigation row: closes the sheet, then opens the route. */
  onOpen: (route: SettingsRoute) => void;
}

export function SettingsSheet({ onClose, onOpen }: SettingsSheetProps) {
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
      announce(message);
    } finally {
      setPending((p) => {
        const next = { ...p };
        delete next[key];
        return next;
      });
    }
  };
  const shown = (key: ServerSetting) => pending[key] ?? prefs[key];
  // Up to S.top under the safe top: room for every row on an iPhone SE.
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxHeight = height - insets.top - S.top;

  return (
    <DarkSheet
      title={COPY.title}
      meta={note ?? (VERSION ? `${COPY.version} ${VERSION}` : undefined)}
      onClose={onClose}
      maxHeight={maxHeight}
      testID="hub-sheet"
      closeTestID="hub-sheet-close"
    >
      <View style={styles.sections}>
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
          <View style={styles.pair} testID="hub-sound-music">
            <SwitchRow
              label={COPY.sound}
              hint={COPY.soundHint}
              value={shown("sound_enabled")}
              onChange={(on) => {
                save("sound_enabled", on);
              }}
              half
              testID="hub-sound"
            />
            <View style={styles.pairDivider} />
            <SwitchRow
              label={COPY.music}
              hint={COPY.musicHint}
              value={shown("music_enabled")}
              onChange={(on) => {
                save("music_enabled", on);
              }}
              half
              testID="hub-music"
            />
          </View>
          <SwitchRow
            label={COPY.haptics}
            detail={COPY.hapticsDetail}
            value={shown("haptics_enabled")}
            onChange={(on) => {
              save("haptics_enabled", on);
            }}
            testID="hub-haptics"
          />
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
      </View>
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

/**
 * One accessible switch: the row toggles, the native switch only shows the value.
 * `half` is one of two switches sharing a row (Sound and Music), with a hint in place of a detail line.
 */
function SwitchRow({
  label,
  detail,
  hint,
  value,
  onChange,
  half = false,
  testID,
}: {
  label: string;
  detail?: string;
  hint?: string;
  value: boolean;
  onChange: (on: boolean) => void;
  half?: boolean;
  testID: string;
}) {
  const focus = useFocusRing();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={hint ?? detail}
      accessibilityState={{ checked: !!value }}
      // The web reads aria-checked, not accessibilityState; always a boolean, even before a value has loaded.
      aria-checked={!!value}
      onPress={() => {
        // Not awaited: the switch shows its new value at once while it saves.
        onChange(!value);
      }}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      testID={testID}
      style={({ pressed }) => [styles.row, half && styles.half, pressed && styles.pressed]}
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
function LinkRow({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const focus = useFocusRing();
  const feedback = useFeedback();
  const close = useSheetClose();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
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
      <RowText label={label} />
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
  // The sheet's content spaces its children ref.space.xl apart; these sections sit closer.
  sections: { gap: S.section },
  heading: { ...S.heading, color: ref.color.textPrimary, marginBottom: S.headingGap },
  group: { backgroundColor: S.fill, borderRadius: S.radius, ...ref.curve },
  divider: { height: H.hairline, marginLeft: S.pad, backgroundColor: S.divider },
  row: {
    minHeight: S.rowHeight,
    flexDirection: "row",
    alignItems: "center",
    gap: S.gap,
    paddingHorizontal: S.pad,
    paddingVertical: S.padY,
  },
  pressed: { opacity: S.pressedOpacity },
  // Sound and Music: two halves of one row, a rim line between them.
  pair: { flexDirection: "row", alignItems: "stretch" },
  half: { flex: 1 },
  pairDivider: { width: H.hairline, marginVertical: S.padY, backgroundColor: S.divider },
  // The label column wraps at large text; the switch, chevron and value keep their size.
  rowText: { flex: 1, gap: S.detailGap },
  label: { ...T.body, color: ref.color.textPrimary },
  detail: { ...T.meta, color: ref.color.textSecondary },
  value: { ...T.body, color: ref.color.textSecondary, flexShrink: 1 },
});
