// The door: the finale, by its kind. "combination": the door's wheels and a
// submit. "accusation": a suspect, a motive and a method, then Accuse.
// "ritual": choose the objects in order (tap to add, tap a chosen one to take
// it back), then Begin. Held while busy or cooling down. Open once it is.
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { AccuseOption } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { RingPressable } from "@/render/parts";
import { ref } from "@/theme/tokens";
import { Line, MechButton, Stage, cooldownText } from "./kit";
import { WheelBank } from "./Wheels";
import { SYMBOLS } from "@/engine/v2";
import type { MechanismProps } from "./types";

export function Door(props: MechanismProps) {
  const { finale, target, state, width } = props;
  if (state.open === true) return <DoorOpen width={width} />;
  const kind = finale?.kind ?? target.variant;
  if (kind === "accusation" && finale?.kind === "accusation") return <Accusation {...props} finale={finale} />;
  if (kind === "ritual") return <Ritual {...props} length={finale?.kind === "ritual" ? finale.length : target.submit?.kind === "sequence" ? target.submit.length : 3} />;
  const count = finale?.kind === "combination" ? finale.wheels : target.submit?.kind === "wheels" ? target.submit.count : 4;
  return (
    <Stage width={width}>
      <WheelBank
        alphabet="digits"
        count={count}
        width={width}
        busy={props.busy}
        cooldown={props.cooldown}
        done={false}
        submitLabel="Try the door"
        marks={SYMBOLS.slice(0, count)}
        onSubmit={props.onSubmit}
      />
    </Stage>
  );
}

function DoorOpen({ width }: { width: number }) {
  const theme = useModeTheme();
  return (
    <Stage width={width}>
      <View style={[styles.doorway, { backgroundColor: theme.accent, borderColor: theme.raised }]} testID="mech-door-open">
        <View style={[styles.leaf, { backgroundColor: theme.raised, borderColor: theme.rim }]} />
      </View>
      <Line text="The door is open" tone="stamp" />
    </Stage>
  );
}

function Chip({ label, selected, badge, onPress, disabled }: {
  label: string; selected: boolean; badge?: number; onPress: () => void; disabled: boolean;
}) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  return (
    <RingPressable
      ring="pill"
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${ordinal(badge)}` : label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        feedback.tick();
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.raised,
          borderColor: selected ? theme.accent : theme.rim,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      {badge ? <Text style={[styles.badge, { color: selected ? theme.accentInk : theme.inkMuted }]}>{badge}</Text> : null}
      <Text style={[styles.chipLabel, { color: selected ? theme.accentInk : theme.ink }]} numberOfLines={1}>{label}</Text>
    </RingPressable>
  );
}

const ordinal = (n: number) => ["first", "second", "third", "fourth", "fifth", "sixth"][n - 1] ?? `number ${n}`;

function Accusation({ finale, onSubmit, busy, cooldown, width }: MechanismProps & { finale: Extract<NonNullable<MechanismProps["finale"]>, { kind: "accusation" }> }) {
  const theme = useModeTheme();
  const [pick, setPick] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const rows: [string, AccuseOption[]][] = [["Who", finale.suspects], ["Why", finale.motives], ["How", finale.methods]];
  const waiting = cooldownText(cooldown);
  const ready = pick.every((p) => p !== null);
  return (
    <Stage width={width}>
      {rows.map(([title, options], r) => (
        <View key={title} style={styles.pickRow}>
          <Text style={[styles.rowTitle, { color: theme.inkMuted }]}>{title}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={title}>
            {options.map((o) => (
              <Chip
                key={o.id}
                label={o.name}
                selected={pick[r] === o.id}
                disabled={busy}
                onPress={() => setPick((p) => p.map((x, k) => (k === r ? (x === o.id ? null : o.id) : x)) as typeof p)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
      <MechButton
        label="Accuse"
        disabled={!ready || busy || cooldown > 0}
        onPress={() => ready && onSubmit(pick as string[])}
        testID="mech-submit"
      />
      <Line text={waiting ?? " "} tone={waiting ? "stamp" : "muted"} testID="mech-status" />
    </Stage>
  );
}

function Ritual({ length, ritualChoices = [], onSubmit, busy, cooldown, width }: MechanismProps & { length: number }) {
  const theme = useModeTheme();
  const [order, setOrder] = useState<string[]>([]);
  const waiting = cooldownText(cooldown);
  const labelOf = (id: string) => ritualChoices.find((c) => c.id === id)?.label ?? id;
  const toggle = (id: string) =>
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : o.length < length ? [...o, id] : o));
  return (
    <Stage width={width}>
      <View style={styles.slots} accessibilityLabel={`Order: ${order.map(labelOf).join(", ") || "nothing chosen"}`} accessible>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.slot, { borderColor: order[i] ? theme.accent : theme.rim, backgroundColor: theme.surface }]}>
            <Text style={[styles.slotNum, { color: theme.inkMuted }]}>{i + 1}</Text>
            <Text style={[styles.slotLabel, { color: theme.ink }]} numberOfLines={2}>{order[i] ? labelOf(order[i]) : ""}</Text>
          </View>
        ))}
      </View>
      <ScrollView style={styles.choices} contentContainerStyle={styles.choiceWrap}>
        {ritualChoices.map((c) => {
          const at = order.indexOf(c.id);
          return (
            <Chip
              key={c.id}
              label={c.label}
              selected={at >= 0}
              badge={at >= 0 ? at + 1 : undefined}
              disabled={busy || (at < 0 && order.length >= length)}
              onPress={() => toggle(c.id)}
            />
          );
        })}
      </ScrollView>
      <MechButton
        label="Begin"
        disabled={order.length !== length || busy || cooldown > 0}
        onPress={() => onSubmit(order)}
        testID="mech-submit"
      />
      <Line text={waiting ?? " "} tone={waiting ? "stamp" : "muted"} testID="mech-status" />
    </Stage>
  );
}

const styles = StyleSheet.create({
  doorway: { width: 120, height: 180, borderWidth: 8, borderRadius: 3, opacity: 0.9, overflow: "hidden" },
  leaf: {
    position: "absolute", left: 0, top: 0, bottom: 0, width: 34, borderRightWidth: StyleSheet.hairlineWidth,
  },
  pickRow: { alignSelf: "stretch", gap: ref.space.xs },
  rowTitle: { ...ref.type.tag, paddingHorizontal: ref.space.xs },
  chips: { gap: ref.space.sm, paddingHorizontal: ref.space.xs },
  chip: {
    minHeight: ref.hit.min,
    paddingHorizontal: ref.space.lg,
    borderRadius: ref.radius.round,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: ref.space.sm,
    ...ref.curve,
  },
  chipLabel: { ...ref.type.label, maxWidth: 180 },
  badge: { ...ref.type.label, fontVariant: ["tabular-nums"] },
  slots: { flexDirection: "row", gap: ref.space.sm, alignSelf: "stretch", justifyContent: "center" },
  slot: { flex: 1, maxWidth: 110, minHeight: 64, borderWidth: 1, borderRadius: ref.radius.tag, padding: ref.space.sm, gap: ref.space.xs, ...ref.curve },
  slotNum: { ...ref.type.tag },
  slotLabel: { ...ref.type.meta },
  choices: { maxHeight: 112, alignSelf: "stretch" },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: ref.space.sm, justifyContent: "center" },
});
