import { useCallback, useMemo, useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { Puzzle } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { codeKind, codeLength, type InventoryItem } from "@/game/selectors";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref } from "@/theme/tokens";
import { BackspaceIcon, ICON_WEIGHT, WarningIcon } from "@/components/icons";
import { CodeWheel } from "./CodeWheel";
import { Card, NoticeLine, QuietToggle, RingPressable, WhiteBar } from "./parts";

const P = ref.layout.play;
const K = P.code;
const SQ = ref.button.square;

export type CodeOutcome =
  | { kind: "solved" }
  | { kind: "wrong"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;
const MAX_FREE_LENGTH = 12;

/**
 * Code entry for `kind: "code"`. A fixed run of digits is a tumbler: every
 * wheel is a vertical picker (CodeWheel) that always shows a numeral in 02's
 * italic, so a leading zero is sent as "0". Other codes use void slots or a
 * void field, and digits a keypad of 02's square buttons. Wrong answers keep
 * the lock open, reset the wheels, shake them, and show 02's error line
 * (white glyph and words).
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
  const displayRef = useRef<ComponentRef<typeof View>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

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
    setBusy(false);
    if (outcome.kind === "solved") return;
    if (outcome.kind === "wrong") {
      const d = motion.wrongShake.distance;
      const step = motion.wrongShake.duration / 4;
      if (!reducedMotion) {
        shake.set(withSequence(
          withTiming(d, { duration: step }), withTiming(-d, { duration: step }),
          withTiming(d, { duration: step }), withTiming(0, { duration: step }),
        ));
      }
      if (tumbler) setDigits(Array.from({ length: length ?? 0 }, () => 0));
      else setValue("");
    }
    setMessage({ tone: outcome.kind === "failed" ? "error" : "warning", text: outcome.message });
    AccessibilityInfo.announceForAccessibility(outcome.message);
    if (tumbler || kind === "digits") {
      if (displayRef.current) AccessibilityInfo.sendAccessibilityEvent(displayRef.current, "focus");
    } else {
      inputRef.current?.focus();
    }
  };

  const wheels = (
    <Animated.View
      ref={displayRef}
      style={[styles.wheels, shakeStyle]}
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
      style={[styles.slots, shakeStyle]}
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
    <Animated.View style={shakeStyle}>
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
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {puzzle.prompt ? <Text style={[styles.prompt, { color: theme.inkMuted }]}>{puzzle.prompt}</Text> : null}
      {tumbler ? wheels : keypad}
      <View style={styles.messageRow} accessibilityLiveRegion="polite" testID="code-message">
        {message ? <NoticeLine icon={WarningIcon} text={message.text} /> : null}
      </View>

      {!tumbler && kind === "digits" ? (
        <View style={styles.pad}>
          {KEYS.map((key) => (
            <RingPressable
              key={key}
              ring="panel"
              radius={SQ.radius}
              edge={SQ.borderWidth}
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
            </RingPressable>
          ))}
        </View>
      ) : null}

      <WhiteBar
        label={tumbler ? "Test combination" : "Try code"}
        onPress={submit}
        disabled={!complete}
        busy={busy}
        // The outcome (the lock opening, or a wrong code) gives the haptic.
        haptic={false}
        testID="code-submit"
      />

      {items.length > 0 ? (
        <View style={styles.items}>
          <QuietToggle
            label={showItems ? "Hide your items" : "Check your items"}
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

const styles = StyleSheet.create({
  root: { gap: ref.space.lg },
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
