import { useRef, useState, type ComponentRef } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import type { Puzzle } from "@/lib/puzzle-types";
import { useFeedback } from "@/game/feedback";
import { codeKind, codeLength, type InventoryItem } from "@/game/selectors";
import { useTheme } from "@/theme/ThemeProvider";
import { color, font, motion, radius, space, type as typeScale } from "@/theme/tokens";
import { Button } from "@/components/Button";
import { Text } from "@/components/Text";
import { BackspaceIcon, ICON_WEIGHT } from "@/components/icons";

export type CodeOutcome =
  | { kind: "solved" }
  | { kind: "wrong"; message: string }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string };

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;
const MAX_FREE_LENGTH = 12;

/**
 * Code entry for `kind: "code"`. A fixed run of digits is a brass tumbler:
 * every wheel always shows a numeral, so a leading zero is sent as "0".
 * Wrong answers keep the lock open, reset the wheels, and stay on screen.
 */
export function CodePad({ puzzle, items, onSubmit }: {
  puzzle: Puzzle;
  /** The player's current items, so a clue never has to be memorised. */
  items: InventoryItem[];
  onSubmit: (answer: string) => Promise<CodeOutcome>;
}) {
  const { reducedMotion } = useTheme();
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

  const stepWheel = (index: number, delta: number) => {
    setMessage(null);
    feedback.tap();
    setDigits((current) => current.map((digit, i) => (i === index ? (digit + delta + 10) % 10 : digit)));
  };

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
      style={[styles.wheels, shakeStyle, message?.tone === "warning" && styles.wheelsWrong]}
      accessibilityLabel={answer.length ? `Code: ${answer.split("").join(" ")}` : "Code: empty"}
    >
      {digits.map((digit, index) => (
        <View key={index} style={styles.wheel}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Increase digit ${index + 1}, currently ${digit}`}
            onPress={() => stepWheel(index, 1)}
            testID={`tumbler-${index}-up`}
            style={styles.wheelStep}
          >
            <Text variant="caption" tone="accent">+</Text>
          </Pressable>
          <Text variant="code">{digit}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Decrease digit ${index + 1}, currently ${digit}`}
            onPress={() => stepWheel(index, -1)}
            testID={`tumbler-${index}-down`}
            style={styles.wheelStep}
          >
            <Text variant="caption" tone="secondary">−</Text>
          </Pressable>
        </View>
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
          <View key={i} style={[styles.slot, i === value.length && styles.slotActive]}>
            <Text variant="code">{value[i] ?? ""}</Text>
          </View>
        ))
        : <Text variant="code" tone={value ? "primary" : "secondary"}>{value || "—"}</Text>}
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
        placeholderTextColor={color.textSecondary}
        style={styles.input}
      />
    </Animated.View>
  );

  return (
    <View style={styles.root}>
      {puzzle.prompt ? <Text tone="secondary">{puzzle.prompt}</Text> : null}
      <View style={styles.guide} />
      {tumbler ? wheels : keypad}
      <View style={styles.messageRow} accessibilityLiveRegion="polite">
        {message ? <Text variant="control" tone={message.tone}>{message.text}</Text> : null}
      </View>

      {!tumbler && kind === "digits" ? (
        <View style={styles.pad}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={key === "back" ? "Delete" : key === "clear" ? "Clear" : key}
              testID={`key-${key}`}
              style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
            >
              {key === "back"
                ? <BackspaceIcon size={24} weight={ICON_WEIGHT} color={color.text} />
                : <Text variant={key === "clear" ? "control" : "code"} tone={key === "clear" ? "secondary" : "primary"}>
                  {key === "clear" ? "Clear" : key}
                </Text>}
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button
        label={tumbler ? "Test combination" : "Try code"}
        onPress={submit}
        disabled={!complete}
        loading={busy}
        testID="code-submit"
      />

      {items.length > 0 ? (
        <View style={styles.items}>
          <Button
            label={showItems ? "Hide your items" : "Check your items"}
            variant="quiet"
            onPress={() => setShowItems((s) => !s)}
            accessibilityState={{ expanded: showItems }}
          />
          {showItems ? items.map((item) => (
            <View key={item.id} style={styles.item}>
              <Text variant="control" tone="ink">{item.name}</Text>
              {item.description ? <Text variant="slip" tone="ink">{item.description}</Text> : null}
            </View>
          )) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  guide: { alignSelf: "center", width: 72, height: 3, borderRadius: 2, backgroundColor: color.accent },
  wheels: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  wheelsWrong: { borderWidth: 1, borderColor: color.wax, borderRadius: radius.control, padding: 4 },
  wheel: {
    width: 56,
    borderRadius: radius.control,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairline,
    alignItems: "center",
    overflow: "hidden",
  },
  wheelStep: { width: "100%", minHeight: 36, alignItems: "center", justifyContent: "center" },
  slots: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  slot: {
    width: 52,
    height: 64,
    borderRadius: radius.control,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  slotActive: { borderColor: color.accent },
  messageRow: { minHeight: 20, alignItems: "center" },
  pad: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: space.sm },
  key: {
    width: "31.5%",
    minHeight: 56,
    borderRadius: radius.control,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairline,
    alignItems: "center",
    justifyContent: "center",
  },
  keyPressed: { backgroundColor: color.accentMuted },
  input: {
    ...typeScale.code,
    fontFamily: font.monoBold,
    color: color.text,
    textAlign: "center",
    letterSpacing: 4,
    minHeight: 64,
    borderRadius: radius.control,
    backgroundColor: color.raised,
    borderWidth: 1,
    borderColor: color.hairline,
  },
  items: { gap: space.sm },
  item: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.slip,
    backgroundColor: color.manila,
  },
});
