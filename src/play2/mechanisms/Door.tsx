// The door: the finale, by its kind. "combination": the door's wheels and a
// submit. "accusation": a suspect, a motive and a method, then Accuse.
// "ritual": choose the objects in order (tap to add, tap a chosen one to take
// it back), then Begin. Held while busy or cooling down. Open once it is.
// What was picked or dialled stays after a wrong try, to change one thing.
//
// The door: its lock set in the door's own wood (a rendered stretch of it: a
// routed panel, the grain running up it, a brass knob and keyhole plate), the
// wheels' symbols cut into the iron above them. An
// accusation is made with evidence tags (paper, a punched hole, the choice
// ringed in the stamp's ink); a ritual with chalk rings on the floor, numbered
// in order. Open, it stands ajar with the light of the way out behind it.
import { memo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import type { AccuseOption } from "@/engine/v2";
import { useFeedback } from "@/game/feedback";
import { useModeTheme } from "@/game/mode";
import { RingPressable } from "@/render/parts";
import { mix } from "@/theme/payoff";
import { ref } from "@/theme/tokens";
import { Line, MechButton, Stage, cooldownText, useKept } from "./kit";
import { ENAMEL, INK, inkRect, useGradId } from "./materials";
import { ART, Sprite } from "./sprites";
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
  return <Combination {...props} count={count} />;
}

/** The door's own lock: the wheels set in its wood. */
function Combination({ target, busy, cooldown, onSubmit, onChange, width, count }: MechanismProps & { count: number }) {
  const w = Math.min(width, 336);
  return (
    <Stage width={width} style={styles.flush}>
      <View style={[styles.doorPanel, { width: w, height: PANEL_H }]}>
        {/* The door itself: walnut, a routed panel, its brass lock set by the plaque. */}
        <Sprite source={ART.doorPanel} w={w} h={PANEL_H} style={styles.fill} />
        <WheelBank
          alphabet="digits"
          count={count}
          width={w - ref.space.lg}
          busy={busy}
          cooldown={cooldown}
          done={false}
          submitLabel="Try the door"
          marks={SYMBOLS.slice(0, count)}
          onSubmit={onSubmit}
          onChange={onChange}
          keep={target}
        />
      </View>
    </Stage>
  );
}
const PANEL_H = 282;

function DoorOpen({ width }: { width: number }) {
  const theme = useModeTheme();
  return (
    <Stage width={width}>
      <View testID="mech-door-open">
        <Ajar glow={theme.glow} dark={theme.surface} />
      </View>
    </Stage>
  );
}

/**
 * The door standing ajar: the light of the way out (the mode's, drawn live: in the opening, spilling over
 * the sill, wider as it comes toward you), and over it the rendered casing and the leaf swung in on its
 * hinges (sprites.tsx; the opening is clear).
 */
const Ajar = memo(function Ajar({ glow, dark }: { glow: string; dark: string }) {
  const g = useGradId();
  const [light, spill] = [g("l"), g("s")];
  const W = 250, H = 214;
  const o = { x: 78, y: 16, w: 96, h: 160 };
  const rays = [-34, -14, 8, 30].map((a) => `M${o.x + o.w / 2 + a * 0.5} ${o.y + o.h - 6}L${o.x + o.w / 2 + a * 2.6} ${H - 4}`).join("");
  return (
    <View style={{ width: W, height: H }}>
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={light.id} cx="55%" cy="62%" rx="75%" ry="70%">
            <Stop offset="0" stopColor="#FFFDF2" />
            <Stop offset="0.35" stopColor={mix(glow, "#FFFFFF", 0.35)} />
            <Stop offset="1" stopColor={mix(glow, dark, 0.45)} />
          </RadialGradient>
          <LinearGradient id={spill.id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={glow} stopOpacity={0.55} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={`M${o.x + 4} ${o.y + o.h}L${W * 0.06} ${H}H${W * 0.94}L${o.x + o.w - 4} ${o.y + o.h}Z`} fill={spill.url} />
        <Rect x={o.x - 1} y={o.y - 1} width={o.w + 2} height={o.h + 1} fill={light.url} />
        <Path d={rays} stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" />
      </Svg>
      <Sprite source={ART.doorAjar} w={W} h={H} style={styles.fill} />
    </View>
  );
});

/**
 * A choice. `numbered` (the ritual's) keeps a place for its order at the
 * front, an empty ring until it's chosen, so a chip never changes size (and
 * the ones after it never move under the finger).
 */
function Chip({ label, selected, badge, numbered = false, onPress, disabled }: {
  label: string; selected: boolean; badge?: number; numbered?: boolean; onPress: () => void; disabled: boolean;
}) {
  const theme = useModeTheme();
  const feedback = useFeedback();
  const hand = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  // A paper tag: a punched hole at its end, its words by hand; chosen, ringed in the stamp's ink and gilded a little.
  return (
    <RingPressable
      ring="pill"
      radius={6}
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
          backgroundColor: selected ? mix(ENAMEL.light, theme.foil, 0.38) : ENAMEL.mid,
          borderColor: selected ? theme.stamp : INK,
          borderWidth: 2,
          opacity: pressed ? 0.85 : disabled && !selected ? 0.6 : 1,
          transform: [{ rotate: selected ? "-1.5deg" : "0deg" }],
        },
      ]}
    >
      {numbered ? (
        <View style={[styles.badge, { borderColor: selected ? theme.stamp : ENAMEL.shade, backgroundColor: selected ? ENAMEL.light : "transparent" }]}>
          <Text style={[styles.badgeText, { color: ENAMEL.ink }]}>{badge ?? ""}</Text>
        </View>
      ) : (
        <View style={[styles.hole, { backgroundColor: theme.surface }]} />
      )}
      <Text style={[styles.chipLabel, { color: ENAMEL.ink, fontFamily: hand }]} numberOfLines={1}>{label}</Text>
    </RingPressable>
  );
}

const ordinal = (n: number) => ["first", "second", "third", "fourth", "fifth", "sixth"][n - 1] ?? `number ${n}`;

function Accusation({ target, finale, onSubmit, onChange, busy, cooldown, width }: MechanismProps & { finale: Extract<NonNullable<MechanismProps["finale"]>, { kind: "accusation" }> }) {
  const theme = useModeTheme();
  const [pick, setPick] = useKept<[string | null, string | null, string | null]>(target, "accusation", () => [null, null, null]);
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
                onPress={() => {
                  setPick((p) => p.map((x, k) => (k === r ? (x === o.id ? null : o.id) : x)) as typeof p);
                  onChange?.();
                }}
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

function Ritual({ target, length, ritualChoices = [], onSubmit, onChange, busy, cooldown, width }: MechanismProps & { length: number }) {
  const theme = useModeTheme();
  const hand = typeof theme.hand.fontFamily === "string" ? theme.hand.fontFamily : ref.font.hand;
  const [kept, setOrder] = useKept<string[]>(target, "ritual", () => []);
  // Only what can still be chosen.
  const order = kept.filter((id) => ritualChoices.some((c) => c.id === id)).slice(0, length);
  const waiting = cooldownText(cooldown);
  const labelOf = (id: string) => ritualChoices.find((c) => c.id === id)?.label ?? id;
  const toggle = (id: string) => {
    setOrder(order.includes(id) ? order.filter((x) => x !== id) : order.length < length ? [...order, id] : order);
    onChange?.();
  };
  return (
    <Stage width={width}>
      <View style={styles.slots} accessibilityLabel={`Order: ${order.map(labelOf).join(", ") || "nothing chosen"}`} accessible>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={styles.slot}>
            <ChalkRing n={i + 1} lit={!!order[i]} chalk={theme.inkMuted} glow={theme.glow} />
            <Text style={[styles.slotLabel, { color: theme.ink, fontFamily: hand }]} numberOfLines={1}>{order[i] ? labelOf(order[i]) : ""}</Text>
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
              numbered
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

/** A place in the ritual: a ring chalked on the floor with its number in it; filled, it burns in the mode's light. */
const ChalkRing = memo(function ChalkRing({ n, lit, chalk, glow }: { n: number; lit: boolean; chalk: string; glow: string }) {
  const g = useGradId()("cr");
  const ring = inkRect(4, 4, 40, 40, 20, 500 + n, 1);
  const numeral = ["I", "II", "III", "IV", "V", "VI"][n - 1] ?? String(n);
  return (
    <View style={styles.ring}>
      <Svg width={48} height={48} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={g.id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={glow} stopOpacity={0.5} />
            <Stop offset="1" stopColor={glow} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {lit ? <Circle cx={24} cy={24} r={24} fill={g.url} /> : null}
        <Path d={ring} fill="none" stroke={lit ? glow : chalk} strokeWidth={lit ? 2.2 : 1.6} strokeDasharray={lit ? undefined : "5 3.5"} strokeLinecap="round" />
        <Path d={ring} fill="none" stroke={lit ? glow : chalk} strokeOpacity={0.35} strokeWidth={1} transform="translate(1 0.8)" />
      </Svg>
      <Text style={[styles.slotNum, { color: lit ? glow : chalk }]}>{numeral}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  flush: { paddingVertical: 0 },
  fill: { position: "absolute", left: 0, top: 0 },
  doorPanel: { alignItems: "center", justifyContent: "center" },
  pickRow: { alignSelf: "stretch", gap: ref.space.xs },
  rowTitle: { ...ref.type.tag, paddingHorizontal: ref.space.xs },
  chips: { gap: ref.space.sm, paddingHorizontal: ref.space.xs },
  // A tag's size never changes with its border (chosen or not): the ring is drawn inside its box.
  chip: {
    minHeight: ref.hit.min,
    paddingHorizontal: ref.space.plate,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: ref.space.sm,
  },
  chipLabel: { fontSize: 18, lineHeight: 24, maxWidth: 180 },
  hole: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.2, borderColor: INK },
  badge: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.4, alignItems: "center", justifyContent: "center" },
  badgeText: { ...ref.type.tag, fontVariant: ["tabular-nums"], textAlign: "center" },
  slots: { flexDirection: "row", gap: ref.space.sm, alignSelf: "stretch", justifyContent: "center" },
  slot: { flex: 1, maxWidth: 110, alignItems: "center", gap: 2 },
  ring: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  slotNum: { fontSize: 16, lineHeight: 20, fontWeight: "700", letterSpacing: 1 },
  slotLabel: { fontSize: 16, lineHeight: 20, minHeight: 20, textAlign: "center" },
  choices: { maxHeight: 112, alignSelf: "stretch" },
  choiceWrap: { flexDirection: "row", flexWrap: "wrap", gap: ref.space.sm, justifyContent: "center" },
});
