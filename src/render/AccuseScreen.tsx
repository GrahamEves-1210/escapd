// Crime scene's Accuse screen (docs/DESIGN.md, Modes · Crime scene): full
// screen over the room, in the mode's ground. Pick who, why and how, one
// from each list as radio cards (a stamp-coloured ring and a filled dot when
// picked; suspects keep their CONTRADICTED stamps), then "Make the
// accusation", which sends { type: "accuse" } through the player.
// - Wrong: "That doesn't add up.", a shake (none under reduced motion) and
//   the error haptic from the player. The picks stay, so one can be changed.
//   The server never says which part was wrong.
// - Cooldown: retry_after as plain text, the button off until it passes.
// - Right: the reveal. The form dims, the accused card comes forward and the
//   GUILTY stamp slams down on it (a fade under reduced motion), then the
//   player closes the case.
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { AccuseOption, Id, Puzzle } from "@/lib/puzzle-types";
import type { InventoryItem, SuspectCard } from "@/game/selectors";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { useTheme } from "@/theme/ThemeProvider";
import { motion, ref, z } from "@/theme/tokens";
import { sheetEntering, sheetExiting } from "@/components/noir";
import { WarningIcon, XIcon } from "@/components/icons";
import { cooldownText, secondsUntil } from "./accuse";
import { ModePill } from "@/capture/ui/ModePill";
import { Card, NoticeLine, QuietToggle, RingPressable, SquareButton } from "./parts";
import { Stamp } from "./Stamp";
import { SuspectFile, SuspectText, suspectA11yLabel } from "./SuspectFile";

const P = ref.layout.play;
const A = P.accuse;
const R = P.reveal;
const SQ = ref.button.square;
const SLOP = (SQ.hit - SQ.size) / 2;
const COOLDOWN_FALLBACK = "Wait a moment before you accuse again.";

export interface Accusation {
  suspect: Id;
  motive: Id;
  method: Id;
}

export type AccuseOutcome =
  | { kind: "solved" }
  | { kind: "wrong"; message: string; retryAfter?: string }
  | { kind: "cooldown"; retryAfter?: string }
  | { kind: "invalid"; message: string }
  | { kind: "failed"; message: string };

export interface AccuseScreenProps {
  puzzle: Puzzle;
  suspects: SuspectCard[];
  /** The player's items, so a clue never has to be memorised. */
  items: InventoryItem[];
  onSubmit: (accusation: Accusation) => Promise<AccuseOutcome>;
  onClose: () => void;
  /** The accusation held: the accused card comes forward under GUILTY. */
  revealed?: SuspectCard | null;
}

type Slot = keyof Accusation;

export function AccuseScreen({ puzzle, suspects, items, onSubmit, onClose, revealed }: AccuseScreenProps) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [picks, setPicks] = useState<Partial<Accusation>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState<string | undefined>();
  const [now, setNow] = useState(() => Date.now());
  const [showItems, setShowItems] = useState(false);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

  const wait = secondsUntil(retryAt, now);
  const waitLine = cooldownText(wait);
  // A plain-text countdown: it ticks once a second while a wait is on.
  useEffect(() => {
    if (wait <= 0) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [wait]);

  const complete = !!(picks.suspect && picks.motive && picks.method);
  const pick = (slot: Slot, id: Id) => setPicks((p) => ({ ...p, [slot]: id }));

  const submit = async () => {
    if (!complete || busy || wait > 0) return;
    setBusy(true);
    setMessage(null);
    const outcome = await onSubmit(picks as Accusation);
    setBusy(false);
    if (outcome.kind === "solved") return;
    setNow(Date.now());
    if (outcome.kind === "wrong") {
      const d = motion.wrongShake.distance;
      const step = motion.wrongShake.duration / 4;
      if (!reducedMotion) {
        shake.set(withSequence(
          withTiming(d, { duration: step }), withTiming(-d, { duration: step }),
          withTiming(d, { duration: step }), withTiming(0, { duration: step }),
        ));
      }
      setRetryAt(outcome.retryAfter);
      setMessage(outcome.message);
      AccessibilityInfo.announceForAccessibility(
        [outcome.message, cooldownText(secondsUntil(outcome.retryAfter, Date.now()))].filter(Boolean).join(" "),
      );
      return;
    }
    if (outcome.kind === "cooldown") {
      setRetryAt(outcome.retryAfter);
      // The countdown line says it while there is a wait to count. With none
      // (no retry_after, or one already past: a clock ahead of the server's,
      // or the lock ending in flight) the refusal still needs words.
      const countdown = cooldownText(secondsUntil(outcome.retryAfter, Date.now()));
      const line = countdown ?? COOLDOWN_FALLBACK;
      if (!countdown) setMessage(line);
      AccessibilityInfo.announceForAccessibility(line);
      return;
    }
    setMessage(outcome.message);
    AccessibilityInfo.announceForAccessibility(outcome.message);
  };

  return (
    <Animated.View
      entering={sheetEntering(reducedMotion)}
      exiting={sheetExiting(reducedMotion)}
      style={[styles.layer, { backgroundColor: theme.ground, paddingTop: insets.top + P.top }]}
      accessibilityViewIsModal
      testID="accuse-screen"
    >
      <View style={styles.header} importantForAccessibility={revealed ? "no-hide-descendants" : "auto"}>
        <SquareButton icon={XIcon} accessibilityLabel="Close" onPress={onClose} testID="accuse-close" />
        <View style={styles.prompt}>
          <Text numberOfLines={1} accessibilityRole="header" style={[ref.type.serifTitle, styles.centre, { color: theme.ink }]}>
            Make your accusation
          </Text>
          <Text numberOfLines={1} style={[ref.type.meta, styles.centre, { color: theme.inkMuted }]}>Who, why and how</Text>
        </View>
        <View style={styles.balance} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        importantForAccessibility={revealed ? "no-hide-descendants" : "auto"}
      >
        <Animated.View style={[styles.sections, shakeStyle]}>
          <Choices
            title="Who did it"
            slot="suspect"
            options={suspects}
            picked={picks.suspect}
            onPick={pick}
            render={(s) => <SuspectText suspect={s} stamped testID={`accuse-suspect-${s.id}`} />}
            label={(s) => suspectA11yLabel(s)}
          />
          <Choices title="Why" slot="motive" options={puzzle.motives ?? []} picked={picks.motive} onPick={pick} />
          <Choices title="How" slot="method" options={puzzle.methods ?? []} picked={picks.method} onPick={pick} />
        </Animated.View>

        {items.length > 0 ? (
          <View style={styles.items}>
            <QuietToggle
              label={showItems ? "Hide your evidence" : "Check your evidence"}
              onPress={() => setShowItems((s) => !s)}
              expanded={showItems}
              testID="accuse-items"
            />
            {showItems ? items.map((item) => (
              <Card key={item.id} style={styles.item}>
                <Text style={[P.type.card, { color: theme.ink }]}>{item.name}</Text>
                {item.description ? <Text style={[P.type.hint, { color: theme.inkMuted }]}>{item.description}</Text> : null}
              </Card>
            )) : null}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[styles.footer, { paddingBottom: insets.bottom + ref.space.ctaBottom, borderTopColor: theme.rim }]}
        importantForAccessibility={revealed ? "no-hide-descendants" : "auto"}
      >
        <View style={styles.message} accessibilityLiveRegion="polite" testID="accuse-message">
          {message ? <NoticeLine icon={WarningIcon} text={message} /> : null}
          {waitLine ? <Text style={[P.type.hint, { color: theme.inkMuted }]} testID="accuse-cooldown">{waitLine}</Text> : null}
        </View>
        <ModePill
          variant="ghost"
          label="Make the accusation"
          onPress={submit}
          disabled={!complete || wait > 0}
          busy={busy}
          spinner
          // The outcome (the reveal, or a wrong accusation) gives the haptic.
          haptic={false}
          accessibilityHint={complete ? undefined : "Pick one from each list first."}
          testID="accuse-submit"
        />
      </View>

      {revealed ? <Reveal suspect={revealed} /> : null}
    </Animated.View>
  );
}

function Choices<T extends AccuseOption>({ title, slot, options, picked, onPick, render, label }: {
  title: string;
  slot: Slot;
  options: T[];
  picked?: Id;
  onPick: (slot: Slot, id: Id) => void;
  render?: (option: T) => ReactNode;
  label?: (option: T) => string;
}) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  return (
    <View style={styles.section}>
      <Text style={[P.type.section, { color: theme.ink }]} accessibilityRole="header">{title}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={title} style={styles.options}>
        {options.map((o) => {
          const checked = o.id === picked;
          return (
            <RingPressable
              key={o.id}
              ring="panel"
              radius={P.card.radius}
              accessibilityRole="radio"
              accessibilityState={{ checked }}
              accessibilityLabel={label ? label(o) : o.name}
              onPressIn={feedback.tick}
              onPress={() => onPick(slot, o.id)}
              testID={`accuse-${slot}-${o.id}${checked ? "-picked" : ""}`}
              style={({ pressed }) => [
                styles.option,
                { backgroundColor: theme.raised, borderColor: checked ? theme.stamp : theme.raised },
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.radio, { borderColor: checked ? theme.stamp : theme.inkMuted }]}>
                {checked ? <View style={[styles.dot, { backgroundColor: theme.stamp }]} /> : null}
              </View>
              <View style={styles.optionText}>
                {render ? render(o) : <Text style={[P.type.card, { color: theme.ink }]}>{o.name}</Text>}
              </View>
            </RingPressable>
          );
        })}
      </View>
    </View>
  );
}

/** The accusation held: the accused card comes forward and GUILTY slams onto it. */
function Reveal({ suspect }: { suspect: SuspectCard }) {
  const theme = useModeTheme();
  const { reducedMotion } = useTheme();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : R.cardFrom);
  const rise = useSharedValue(reducedMotion ? 0 : R.rise);
  const jolt = useSharedValue(0);

  useEffect(() => {
    const d = reducedMotion ? motion.reducedFade : R.enter;
    opacity.set(withTiming(1, { duration: d }));
    if (!reducedMotion) {
      scale.set(withTiming(1, { duration: R.enter }));
      rise.set(withTiming(0, { duration: R.enter }));
    }
    AccessibilityInfo.announceForAccessibility(`${suspect.name}. Guilty.`);
    // Once: the reveal plays once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const landed = () => {
    if (reducedMotion) return;
    const { jolt: j, joltTime: t } = P.stamp;
    jolt.set(withSequence(withTiming(j, { duration: t }), withTiming(-j / 2, { duration: t }), withTiming(0, { duration: t })));
  };

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.get(),
    transform: [{ translateY: rise.get() + jolt.get() }, { scale: scale.get() }],
  }));

  return (
    <View style={styles.reveal} testID="accuse-reveal">
      <Animated.View
        entering={FadeIn.duration(reducedMotion ? motion.reducedFade : R.enter)}
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.ground, opacity: R.scrim }]}
      />
      <Animated.View style={[styles.revealCard, cardStyle]}>
        <SuspectFile
          suspect={suspect}
          size="large"
          testID="accused-card"
          stamp={<Stamp text="Guilty" size="large" slam delay={reducedMotion ? 0 : R.enter} onLanded={landed} testID="guilty-stamp" />}
          stampLabel="Guilty"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, zIndex: z.sheet },
  header: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: P.edge, paddingBottom: SLOP },
  prompt: { flex: 1, marginHorizontal: ref.space.sm, paddingTop: P.promptTop, alignItems: "center", gap: P.metaGap },
  centre: { textAlign: "center" },
  balance: { width: SQ.size },
  scroll: { flex: 1 },
  content: { paddingHorizontal: ref.space.edge, paddingTop: P.band.photo + ref.space.sm, paddingBottom: ref.space.xl, gap: A.section },
  sections: { gap: A.section },
  section: { gap: P.card.gap },
  options: { gap: A.rowGap },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: P.card.gap,
    padding: P.card.pad,
    borderRadius: P.card.radius,
    borderWidth: A.ring,
    ...ref.curve,
  },
  pressed: { opacity: P.pressedOpacity },
  radio: {
    width: A.radio,
    height: A.radio,
    borderRadius: ref.radius.round,
    borderWidth: A.radioRing,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: A.dot, height: A.dot, borderRadius: ref.radius.round },
  optionText: { flex: 1 },
  items: { gap: ref.space.sm },
  item: { gap: ref.space.xs, paddingVertical: P.card.padY },
  // The photo guide's foot: the pill in its reading column, ref.space.ctaBottom over the safe area.
  footer: { paddingHorizontal: ref.space.reading, paddingTop: P.band.tray, gap: ref.space.sm, borderTopWidth: P.hairline },
  message: { minHeight: P.code.messageMin, gap: ref.space.xs, alignItems: "center" },
  reveal: { ...StyleSheet.absoluteFill, justifyContent: "center", paddingHorizontal: ref.space.edge },
  revealCard: { alignSelf: "stretch" },
});
