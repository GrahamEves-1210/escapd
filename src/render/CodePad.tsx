import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { AccessibilityInfo, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming, type SharedValue,
} from "react-native-reanimated";
import type { Puzzle } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { codeKind, codeLength, type InventoryItem } from "@/game/selectors";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { BackspaceIcon, ICON_WEIGHT, WarningIcon } from "@/components/icons";
import { CodeWheel } from "./CodeWheel";
import { ModePill } from "@/capture/ui/ModePill";
import { FocusRing, SquashPressable, useFocusRing, type SquashPressableProps } from "@/components/noir";
import { Card, NoticeLine, QuietToggle } from "./parts";
import { PLAY_COPY } from "./voice";

const P = ref.layout.play;
const K = P.code;
const LK = P.codePad.lock;
const SQ = ref.button.square;
const J = ref.motion.juice;

// Our own reduced-motion check decides every movement here; Reanimated's system one never does.
const NEVER = ReduceMotion.Never;
const FADE = { duration: motion.reducedFade, reduceMotion: NEVER } as const;
const SWING_EASING = Easing.inOut(Easing.quad);
const OUT = Easing.out(Easing.cubic);

export type CodeOutcome =
  /**
   * `proceed` is what follows a correct code (the result sheet, the scene
   * change, case closed). The pad plays its latch first and calls it once the
   * lock is open (ref.motion.juice.latch.hold; motion.reducedFade under
   * reduced motion), or at once if the pad goes away first. Without it the
   * caller moves on by itself.
   */
  | { kind: "solved"; proceed?: () => void }
  | { kind: "wrong"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;
const MAX_FREE_LENGTH = 12;

/**
 * Code entry for `kind: "code"`. A fixed run of digits is a tumbler: every
 * wheel is a vertical picker (CodeWheel) that always shows a numeral in 02's
 * italic, so a leading zero is sent as "0". Other codes use void slots or a
 * void field, and digits a keypad of 02's square buttons. A padlock in the
 * mode's accent sits over the code (GAME_FEEL_PROMPT.md 1: the pad feels
 * mechanical). A wrong answer gives `wrongCode`, rattles the pad (the lock
 * tugs and holds), resets the wheels and shows 02's error line (white glyph
 * and words); the pad stays open for another try. A correct one gives
 * `unlock`: the shackle springs up and swings open, a ring in the accent
 * lights round the code, and only then does the outcome's `proceed` run.
 * Reduced motion: no rattle or slide; the pad dims and returns on a wrong
 * code, the lock cross-fades open, and `proceed` runs after motion.reducedFade.
 * Every haptic stays.
 */
export function CodePad({ puzzle, items, onSubmit, onWheelDrag }: {
  puzzle: Puzzle;
  /** The player's current items, so a clue never has to be memorised. */
  items: InventoryItem[];
  onSubmit: (answer: string) => Promise<CodeOutcome>;
  /** A finger is on a wheel (the sheet holds its scroll meanwhile). */
  onWheelDrag?: (dragging: boolean) => void;
}) {
  const { reducedMotion } = useTheme();
  const theme = useModeTheme();
  const feedback = useFeedback();
  const kind = codeKind(puzzle);
  const length = codeLength(puzzle);
  const tumbler = kind === "digits" && !!length;
  const [digits, setDigits] = useState<number[]>(() => Array.from({ length: length ?? 0 }, () => 0));
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ tone: "warning" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [showItems, setShowItems] = useState(false);
  // The latch is playing: the pad is spent, and waits for `proceed`.
  const [unlocking, setUnlocking] = useState(false);
  const displayRef = useRef<ComponentRef<typeof View>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const lock = useLockMotion();
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; proceed: () => void } | null>(null);

  // Gone before the latch finished (the sheet closed): the flow still goes on.
  useEffect(() => () => {
    const held = pending.current;
    if (!held) return;
    pending.current = null;
    clearTimeout(held.timer);
    held.proceed();
  }, []);

  const max = length ?? MAX_FREE_LENGTH;
  const answer = tumbler ? digits.join("") : value;
  const complete = tumbler ? true : length ? value.length === length : value.length > 0;

  // The wheel gives its own tick per digit.
  const setDigit = useCallback((index: number, digit: number) => {
    setMessage(null);
    setDigits((current) => current.map((d, i) => (i === index ? digit : d)));
  }, []);
  const onDigit = useMemo(
    () => Array.from({ length: length ?? 0 }, (_, i) => (digit: number) => setDigit(i, digit)),
    [length, setDigit],
  );

  const press = (key: (typeof KEYS)[number]) => {
    setMessage(null);
    if (key === "clear") setValue("");
    else if (key === "back") setValue((v) => v.slice(0, -1));
    else setValue((v) => (v.length < max ? v + key : v));
  };

  const submit = async () => {
    if (!complete || busy) return;
    setBusy(true);
    const outcome = await onSubmit(answer);
    if (outcome.kind === "solved") {
      // Stays busy: the lock is open, there is nothing more to try.
      setUnlocking(true);
      feedback.unlock();
      lock.open(reducedMotion);
      const { proceed } = outcome;
      if (proceed) {
        const timer = setTimeout(() => {
          pending.current = null;
          proceed();
        }, reducedMotion ? motion.reducedFade : J.latch.hold);
        pending.current = { timer, proceed };
      }
      return;
    }
    setBusy(false);
    if (outcome.kind === "wrong") {
      feedback.wrongCode();
      lock.rattle(reducedMotion);
      if (tumbler) setDigits(Array.from({ length: length ?? 0 }, () => 0));
      else setValue("");
    }
    setMessage({ tone: outcome.kind === "failed" ? "error" : "warning", text: outcome.message });
    AccessibilityInfo.announceForAccessibility(outcome.message);
    if (tumbler || kind === "digits") {
      // The web has no sendAccessibilityEvent: its live region reads the line.
      if (displayRef.current && Platform.OS !== "web") AccessibilityInfo.sendAccessibilityEvent(displayRef.current, "focus");
    } else {
      inputRef.current?.focus();
    }
  };

  const wheels = (
    <Animated.View
      ref={displayRef}
      style={styles.wheels}
      accessibilityLabel={answer.length ? `Code: ${answer.split("").join(" ")}` : "Code: empty"}
    >
      {digits.map((digit, index) => (
        <CodeWheel key={index} index={index} value={digit} onChange={onDigit[index]} onDragChange={onWheelDrag} />
      ))}
    </Animated.View>
  );

  const keypad = kind === "digits" ? (
    <Animated.View
      ref={displayRef}
      style={styles.slots}
      accessible
      accessibilityLabel={value.length ? `Code: ${value.split("").join(" ")}` : "Code: empty"}
      accessibilityHint={length ? `${length} digits` : undefined}
    >
      {length
        ? Array.from({ length }, (_, i) => (
          <View key={i} style={styles.slot}>
            <Text style={[styles.digit, { color: theme.ink }]}>{value[i] ?? ""}</Text>
            {i === value.length ? <View pointerEvents="none" style={[styles.slotActive, { borderColor: theme.ink }]} /> : null}
          </View>
        ))
        : <Text style={[styles.digit, { color: value ? theme.ink : theme.inkMuted }]}>{value || "—"}</Text>}
    </Animated.View>
  ) : (
    <View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => { setMessage(null); setValue(t.slice(0, max)); }}
        autoCapitalize={kind === "letters" ? "characters" : "none"}
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        maxLength={max}
        returnKeyType="done"
        onSubmitEditing={submit}
        accessibilityLabel="Code"
        placeholder="Enter the code"
        placeholderTextColor={theme.inkMuted}
        style={[styles.input, { color: theme.ink }]}
      />
    </View>
  );

  return (
    <View style={styles.root}>
      {puzzle.prompt ? <Text style={[styles.prompt, { color: theme.inkMuted }]}>{puzzle.prompt}</Text> : null}
      <Animated.View style={[styles.lockGroup, lock.groupStyle]} pointerEvents={unlocking ? "none" : "auto"} testID="code-pad">
        <Padlock lock={lock} color={theme.accent} keyhole={theme.accentInk} />
        <View style={tumbler || (kind === "digits" && length) ? styles.frameHug : styles.frameFill}>
          {tumbler ? wheels : keypad}
          <Animated.View pointerEvents="none" style={[styles.ring, { borderColor: theme.accent }, lock.ringStyle]} testID="code-ring" />
        </View>
      </Animated.View>
      <View style={styles.messageRow} accessibilityLiveRegion="polite" testID="code-message">
        {message ? <NoticeLine icon={WarningIcon} text={message.text} /> : null}
      </View>

      {!tumbler && kind === "digits" ? (
        <View style={styles.pad}>
          {KEYS.map((key) => (
            <KeyButton
              key={key}
              onPressIn={feedback.press}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={key === "back" ? "Delete" : key === "clear" ? "Clear" : key}
              testID={`key-${key}`}
              style={({ pressed }) => [styles.key, { backgroundColor: theme.raised }, pressed && styles.keyPressed]}
            >
              {key === "back"
                ? <BackspaceIcon size={P.tray.icon} weight={ICON_WEIGHT} color={theme.ink} />
                : <Text style={key === "clear" ? [styles.clear, { color: theme.inkMuted }] : [styles.keyLabel, { color: theme.ink }]}>
                  {key === "clear" ? "Clear" : key}
                </Text>}
            </KeyButton>
          ))}
        </View>
      ) : null}

      <ModePill
        variant="ghost"
        label={tumbler ? "Test combination" : "Try code"}
        onPress={submit}
        disabled={!complete}
        busy={busy}
        // The latch is the answer while it plays: no indicator.
        spinner={!unlocking}
        // The outcome (the lock opening, or a wrong code) gives the haptic.
        haptic={false}
        testID="code-submit"
      />

      {items.length > 0 ? (
        <View style={styles.items}>
          <QuietToggle
            label={showItems ? PLAY_COPY.evidenceHide : PLAY_COPY.evidenceShow}
            onPress={() => setShowItems((s) => !s)}
            expanded={showItems}
            testID="code-items"
          />
          {showItems ? items.map((item) => (
            <Card key={item.id} style={styles.item}>
              <Text style={[styles.itemName, { color: theme.ink }]}>{item.name}</Text>
              {item.description ? <Text style={[styles.itemDetail, { color: theme.inkMuted }]}>{item.description}</Text> : null}
            </Card>
          )) : null}
        </View>
      ) : null}
    </View>
  );
}

/** A keypad key: 02's square stretched, with the kit's press-in squash and the brass focus ring. */
function KeyButton({ children, ...props }: Omit<SquashPressableProps, "children" | "onFocus" | "onBlur"> & { children: ReactNode }) {
  const focus = useFocusRing();
  return (
    <SquashPressable {...props} onFocus={focus.onFocus} onBlur={focus.onBlur}>
      {children}
      <FocusRing visible={focus.focused} shape="panel" radius={SQ.radius} edge={SQ.borderWidth} />
    </SquashPressable>
  );
}

/**
 * The pad's moving parts, all shared values on the UI thread: the group's
 * rattle and dim, the shackle's lift and swing, the closed-to-open fade
 * (reduced motion), and the ring's glow.
 */
function useLockMotion() {
  const rattleX = useSharedValue(0);
  const dim = useSharedValue(1);
  const lift = useSharedValue(0);
  const swing = useSharedValue(0);
  const opened = useSharedValue(0);
  const glow = useSharedValue(0);
  const groupStyle = useAnimatedStyle(() => ({ opacity: dim.get(), transform: [{ translateX: rattleX.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  const rattle = (reduced: boolean) => {
    const R = J.rattle;
    if (reduced) {
      dim.set(withSequence(withTiming(R.dim, { duration: motion.reducedFade / 2, reduceMotion: NEVER }), withTiming(1, FADE)));
      return;
    }
    const step = { duration: R.duration / R.swings.length, easing: SWING_EASING, reduceMotion: NEVER };
    rattleX.set(withSequence(...R.swings.map((share) => withTiming(share * R.distance, step))));
    // The shackle is tugged, and holds.
    lift.set(withSequence(
      withTiming(-J.latch.kick, { duration: J.latch.settle / 2, easing: OUT, reduceMotion: NEVER }),
      withTiming(0, { duration: J.latch.settle, easing: SWING_EASING, reduceMotion: NEVER }),
    ));
  };

  const open = (reduced: boolean) => {
    const L = J.latch;
    if (reduced) {
      opened.set(withTiming(1, FADE));
      glow.set(withTiming(1, FADE));
      return;
    }
    lift.set(withSequence(
      withTiming(-(LK.room + L.kick), { duration: L.lift, easing: OUT, reduceMotion: NEVER }),
      withTiming(-LK.room, { duration: L.settle, easing: SWING_EASING, reduceMotion: NEVER }),
    ));
    swing.set(withDelay(L.lift + L.settle, withTiming(L.swing, { duration: L.swingTime, easing: OUT, reduceMotion: NEVER }), NEVER));
    glow.set(withDelay(L.glowDelay, withTiming(1, { duration: L.glow, easing: OUT, reduceMotion: NEVER }), NEVER));
  };

  return { lift, swing, opened, groupStyle, ringStyle, rattle, open };
}

/**
 * The padlock over the code, drawn in the mode's accent: a body with a
 * keyhole, and a U shackle whose legs sit in it. The closed shackle moves
 * (lift, then the swing about its left leg); under reduced motion it fades
 * out as an open one, drawn where the swing ends, fades in. Decorative: the
 * screen says what happened.
 */
function Padlock({ lock, color, keyhole }: {
  lock: { lift: SharedValue<number>; swing: SharedValue<number>; opened: SharedValue<number> };
  color: string;
  keyhole: string;
}) {
  const { lift, swing, opened } = lock;
  const closedStyle = useAnimatedStyle(() => ({
    opacity: 1 - opened.get(),
    transform: [{ translateY: lift.get() }, { rotate: `${swing.get()}deg` }],
  }));
  const openStyle = useAnimatedStyle(() => ({ opacity: opened.get() }));
  return (
    <View style={styles.lock} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="code-lock">
      <Animated.View style={[styles.shackle, { borderColor: color }, closedStyle]} testID="code-lock-shackle" />
      <Animated.View style={[styles.shackle, styles.shackleOpen, { borderColor: color }, openStyle]} testID="code-lock-open" />
      <View style={[styles.lockBody, { backgroundColor: color }]}>
        <View style={[styles.keyhole, { backgroundColor: keyhole }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: ref.space.lg },
  lockGroup: { gap: ref.space.lg },
  lock: {
    alignSelf: "center",
    width: LK.body.width,
    height: LK.room + LK.shackle.height + LK.body.height - LK.shackle.seat,
  },
  shackle: {
    position: "absolute",
    top: LK.room,
    left: (LK.body.width - LK.shackle.width) / 2,
    width: LK.shackle.width,
    height: LK.shackle.height,
    borderWidth: LK.shackle.bar,
    borderBottomWidth: 0,
    borderTopLeftRadius: LK.shackle.width / 2,
    borderTopRightRadius: LK.shackle.width / 2,
    // The swing turns about the left leg's foot.
    transformOrigin: "left bottom",
  },
  // Where the closed shackle's lift and swing end.
  shackleOpen: { opacity: 0, transform: [{ translateY: -LK.room }, { rotate: `${J.latch.swing}deg` }] },
  lockBody: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: LK.body.width,
    height: LK.body.height,
    borderRadius: LK.body.radius,
    ...ref.curve,
    alignItems: "center",
    justifyContent: "center",
  },
  keyhole: { width: LK.keyhole.width, height: LK.keyhole.height, borderRadius: LK.keyhole.radius },
  // The ring hugs fixed wheels and slots, and the free field's full width.
  frameHug: { alignSelf: "center" },
  frameFill: { alignSelf: "stretch" },
  ring: {
    position: "absolute",
    top: -P.codePad.ringPad,
    bottom: -P.codePad.ringPad,
    left: -P.codePad.ringPad,
    right: -P.codePad.ringPad,
    borderWidth: P.codePad.ring,
    borderRadius: SQ.radius + P.codePad.ringPad,
    ...ref.curve,
    opacity: 0,
  },
  prompt: { ...P.type.hint, color: ref.color.textSecondary },
  digit: { ...P.type.digit, color: ref.color.textPrimary, textAlign: "center" },
  wheels: { flexDirection: "row", justifyContent: "center", gap: ref.space.sm },
  slots: { flexDirection: "row", justifyContent: "center", gap: ref.space.sm },
  slot: {
    width: K.slot.width,
    height: K.slot.height,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: ref.color.void,
    alignItems: "center",
    justifyContent: "center",
  },
  // The next slot to fill: 02's cue ring, in white.
  slotActive: {
    ...StyleSheet.absoluteFill,
    borderRadius: SQ.radius,
    ...ref.curve,
    borderWidth: P.cueRing,
    borderColor: ref.color.textPrimary,
  },
  messageRow: { minHeight: K.messageMin, alignItems: "center" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: ref.space.sm },
  // A key: 02's square button, stretched to a third of the row.
  key: {
    width: K.keyWidth,
    minHeight: K.key,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: SQ.fill,
    borderWidth: SQ.borderWidth,
    borderColor: P.squareRim,
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: { opacity: P.pressedOpacity },
  keyLabel: { ...P.type.key, color: ref.color.textPrimary },
  clear: { ...P.type.action, color: ref.color.textSecondary },
  input: {
    ...P.type.digit,
    color: ref.color.textPrimary,
    textAlign: "center",
    minHeight: K.input,
    borderRadius: SQ.radius,
    ...ref.curve,
    backgroundColor: ref.color.void,
  },
  items: { gap: ref.space.sm },
  item: { gap: ref.space.xs, paddingVertical: P.card.padY },
  itemName: { ...P.type.card, color: ref.color.textPrimary },
  itemDetail: { ...P.type.hint, color: ref.color.textSecondary },
});
