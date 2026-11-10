// Drawer and compartment, drawn as the furniture they are: a walnut carcass,
// a front with its grain and a routed panel, a brass bail pull (a turned knob
// and hinges for a door), a keyhole plate when it locks, and a velvet-lined
// inside that is dark under its walls. The front casts its shadow on what is
// below it as it comes out.
//
// Pull the front out (a drawer slides toward you, a
// compartment door swings on its left hinge). The moment it gives (GIVE_AT) it
// opens: onSet("open", true), the finger still on it, so what's inside lies
// there under the front and is uncovered as it comes, never popping in at the
// end. Locked, it gives a few points and rattles.
import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { GIVE_AT, Glint, LANDING, Line, STAGE, Stage, activatable, tryKey, useLockedLine, usePull, useRattle } from "./kit";
import { BRASS, BrassGradient, CastShadow, Felt, INK, Ink, Wood, useGradId, useMaterials } from "./materials";
import type { MechanismProps } from "./types";

const TRAVEL = 72;
/** How far a compartment's door swings open (degrees). */
const SWING = 78;

export function Drawer({ target, state, onSet, busy, width, inside }: MechanismProps) {
  const mat = useMaterials();
  const feedback = useFeedback();
  const swing = target.variant === "compartment";
  const open = state.open === true;
  const locked = state.locked === true;
  const { rattle, style: rattleStyle } = useRattle();
  const { showLocked, markTried } = useLockedLine(locked);

  const onCommit = useCallback(() => {
    feedback.drawer();
    onSet("open", true);
  }, [feedback, onSet]);
  // Put back: shut, laid down, straightened. The room keeps what was found.
  const onUncommit = useCallback(() => {
    feedback.tick();
    onSet("open", false);
  }, [feedback, onSet]);
  const onLocked = useCallback(() => {
    feedback.warning();
    rattle();
    markTried();
  }, [feedback, rattle, markTried]);

  const { progress, gesture, commitNow, landed, reach } = usePull({
    axis: swing ? "x" : "down", range: swing ? 140 : TRAVEL, done: open, locked, busy, onCommit, onLocked, onUncommit, land: tryKey(target), giveAt: GIVE_AT,
  });

  const w = Math.min(width - 2 * ref.space.lg, 280);
  const h = swing ? STAGE - ref.space.lg : 96;
  // A compartment's door fills the carcass inside its lip and swings on its left edge.
  const door = { w: w - 2 * ref.space.sm, h: h - 2 * ref.space.sm };
  // Swung toward you its free edge comes nearer and draws taller; the
  // perspective is far enough that, fully open, it stays inside the carcass.
  const depth = door.w * Math.sin((SWING * Math.PI) / 180) * (h / (h - door.h));

  // The drawer: slides down and grows a little as it comes toward you.
  const frontStyle = useAnimatedStyle(() => {
    const p = Math.abs(progress.get());
    if (swing) {
      return {
        transform: [
          { perspective: depth },
          { translateX: -door.w / 2 },
          { rotateY: `${-p * SWING}deg` },
          { translateX: door.w / 2 },
        ],
      };
    }
    return { transform: [{ translateY: p * TRAVEL }, { scale: 1 + p * 0.06 }] };
  });
  // The front's shadow over the inside lifts as it opens (what's in it is never dimmed out of sight).
  const shadeStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 0.45], [0.42, 0], "clamp") }));
  // Out of the carcass, the front throws a shadow on what's under it, and its top edge (its thickness) shows.
  const castStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 0.5, 1], [0, 0.75, 1], "clamp") }));
  const lipStyle = useAnimatedStyle(() => ({ opacity: interpolate(Math.abs(progress.get()), [0, 0.2], [0, 1], "clamp") }));
  const carcassH = swing ? h : h + TRAVEL + ref.space.lg;
  const frontW = swing ? door.w : w - 2 * ref.space.sm;
  const frontH = swing ? door.h : h;

  // What the front is called, and the verbs, the same for the screen reader as on the line under it.
  const say = swing
    ? { open: "Swing the door open", shut: "Swing the door shut", opens: "Opens the compartment", closes: "Closes the compartment" }
    : { open: "Pull the drawer open", shut: "Push the drawer shut", opens: "Opens the drawer", closes: "Closes the drawer" };
  return (
    <Stage width={width}>
      <View style={[styles.room, { height: STAGE }]}>
        <GestureDetector gesture={gesture}>
          <Animated.View testID="mech-drawer" style={[styles.carcass, { width: w, height: carcassH }, rattleStyle]}>
            <Wood w={w} h={carcassH} seed={swing ? 41 : 17} tone={mat.carcass} r={7} style={StyleSheet.absoluteFill} />
            {/* The drawer under this one, shut: the front slides out over it. */}
            {swing ? null : (
              <View style={[styles.below, { top: ref.space.sm + h + 5, height: carcassH - h - 2 * ref.space.sm - 5 }]} pointerEvents="none">
                <Wood w={frontW} h={carcassH - h - 2 * ref.space.sm - 5} seed={29} tone={mat.carcass} r={4} panel={7} />
                <View style={styles.centre}><Pull width={64} /></View>
              </View>
            )}
            {/* The lined inside the front leaves behind. */}
            <View style={[styles.inside, { height: frontH }]}>
              <Felt w={frontW} h={frontH} seed={5} tone={mat.felt} style={StyleSheet.absoluteFill} />
              {swing ? <CabinetWalls w={frontW} h={frontH} wood={mat.carcass.mid} /> : <BoxWalls w={frontW} h={frontH} wood={mat.wood.light} deep={mat.wood.deep} />}
              {/* What's in it, there all along: lying in the part the front slides off (by the free edge, for a
                  door), uncovered as it opens; it can be picked up once most of it shows. */}
              {inside ? (
                <View
                  style={[styles.lying, swing ? styles.byEdge : null, { height: swing ? door.h : TRAVEL - ref.space.sm }]}
                  pointerEvents={reach ? "box-none" : "none"}
                  testID="mech-inside"
                >
                  {inside}
                </View>
              ) : null}
              <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.shade, shadeStyle]} />
            </View>
            {/* The front is the control for assistive tech (what's inside stays reachable on its own). */}
            <Animated.View
              {...activatable(
                open ? say.shut : say.open,
                locked ? "It is locked" : open ? say.closes : say.opens,
                open ? onUncommit : commitNow,
                busy,
              )}
              style={[styles.front, { width: frontW, height: frontH }, frontStyle]}
            >
              {swing ? null : (
                <>
                  {/* Its shadow on what's below, and its top edge once it's out. */}
                  <Animated.View pointerEvents="none" style={[styles.cast, { top: frontH - 4, width: frontW }, castStyle]}>
                    <CastShadow w={frontW} h={30} color={mat.shadow} strength={0.85} />
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[styles.lip, { width: frontW - 6, backgroundColor: mat.wood.sheen, borderColor: INK }, lipStyle]} />
                </>
              )}
              <Wood w={frontW} h={frontH} seed={swing ? 53 : 23} tone={mat.wood} r={5} panel={swing ? 14 : 10} style={StyleSheet.absoluteFill} />
              {swing ? (
                <>
                  {/* The door's free edge: its thickness, catching the light as it swings toward you. */}
                  <Animated.View pointerEvents="none" style={[styles.edge, { height: frontH - 4, backgroundColor: mat.wood.sheen, borderColor: INK }, lipStyle]} />
                  <View style={styles.knobAt}><Knob size={30} /></View>
                </>
              ) : (
                <View style={[styles.centre, locked ? styles.pullLow : null]} pointerEvents="none"><Pull width={86} /></View>
              )}
              {locked ? <View style={swing ? styles.plateDoor : styles.plateDrawer}><Keyhole /></View> : null}
              {/* Just pulled open: the light catches its front as it lands at the stop. */}
              {landed ? <Glint key={landed} delay={LANDING.delayMs + LANDING.inMs} radius={5} /> : null}
            </Animated.View>
            {/* A door's hinges, on the carcass over its hung edge. */}
            {swing ? (
              <View style={[styles.hinges, { height: carcassH }]} pointerEvents="none">
                <Hinge />
                <Hinge />
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>
      {showLocked ? <Line text="Locked" tone="stamp" testID="mech-locked" /> : (
        <Line text={open ? "Open" : swing ? say.open : "Pull it toward you"} />
      )}
    </Stage>
  );
}

/** A brass bail pull: two turned rosettes and the bail hanging between them, a line of light along it. */
const Pull = memo(function Pull({ width }: { width: number }) {
  const g = useGradId();
  const [brass, dome] = [g("b"), g("d")];
  const h = width * 0.4;
  const a = width * 0.14, b = width - a, y = h * 0.3;
  const bail = `M${a} ${y}C${a} ${h * 1.12} ${b} ${h * 1.12} ${b} ${y}`;
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
      <Defs>
        <BrassGradient id={brass.id} />
        <RadialGradient id={dome.id} cx="35%" cy="30%" rx="75%" ry="75%">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.45" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </RadialGradient>
      </Defs>
      {/* Its shadow on the wood. */}
      <Path d={bail} stroke="#000000" strokeOpacity={0.35} strokeWidth={width * 0.075} fill="none" strokeLinecap="round" transform="translate(1.5 3)" />
      <Path d={bail} stroke={INK} strokeWidth={width * 0.085} fill="none" strokeLinecap="round" />
      <Path d={bail} stroke={brass.url} strokeWidth={width * 0.055} fill="none" strokeLinecap="round" />
      <Path d={bail} stroke={BRASS.sheen} strokeOpacity={0.75} strokeWidth={1.2} fill="none" strokeLinecap="round" transform="translate(0 -1.2)" />
      {[a, b].map((x) => (
        <Circle key={x} cx={x} cy={y} r={width * 0.085} fill={dome.url} stroke={INK} strokeWidth={1.6} />
      ))}
      {[a, b].map((x) => (
        <Circle key={x} cx={x} cy={y} r={width * 0.03} fill={BRASS.deep} fillOpacity={0.8} />
      ))}
    </Svg>
  );
});

/** A turned brass knob on its rose, lit from the upper left. */
const Knob = memo(function Knob({ size }: { size: number }) {
  const g = useGradId()("k");
  const c = size / 2;
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={g.id} cx="36%" cy="32%" rx="70%" ry="70%">
          <Stop offset="0" stopColor={BRASS.sheen} />
          <Stop offset="0.4" stopColor={BRASS.light} />
          <Stop offset="0.75" stopColor={BRASS.mid} />
          <Stop offset="1" stopColor={BRASS.deep} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={c + 1.5} cy={c + 3} rx={c * 0.72} ry={c * 0.62} fill="#000000" fillOpacity={0.35} />
      <Circle cx={c} cy={c} r={c * 0.86} fill={BRASS.shade} stroke={INK} strokeWidth={1.4} />
      <Circle cx={c} cy={c} r={c * 0.58} fill={g.url} stroke={INK} strokeWidth={1.6} />
      <Path d={`M${c - c * 0.3} ${c - c * 0.36}A${c * 0.4} ${c * 0.4} 0 0 1 ${c + c * 0.1} ${c - c * 0.42}`} stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </Svg>
  );
});

/** A keyhole in its brass plate, two pins holding it. */
const Keyhole = memo(function Keyhole() {
  const g = useGradId()("e");
  return (
    <Svg width={18} height={26} viewBox="0 0 18 26">
      <Defs><BrassGradient id={g.id} /></Defs>
      <Path d="M9 1.5C13.5 1.5 16.5 5 16.5 9.5C16.5 14 14 16 14 19L15 24.5H3L4 19C4 16 1.5 14 1.5 9.5C1.5 5 4.5 1.5 9 1.5Z" fill={g.url} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M9 7.2A2.6 2.6 0 0 1 10.5 12L11.6 19H6.4L7.5 12A2.6 2.6 0 0 1 9 7.2Z" fill={INK} />
      <Circle cx={9} cy={4} r={0.9} fill={BRASS.deep} />
      <Circle cx={9} cy={22.3} r={0.9} fill={BRASS.deep} />
    </Svg>
  );
});

/** A butt hinge: two brass leaves and the knuckle between them. */
const Hinge = memo(function Hinge() {
  const g = useGradId()("h");
  return (
    <Svg width={16} height={30} viewBox="0 0 16 30">
      <Defs><BrassGradient id={g.id} /></Defs>
      <Rect x={1.2} y={2} width={13.6} height={26} rx={2} fill={g.url} stroke={INK} strokeWidth={1.4} />
      <Rect x={6.2} y={0.8} width={3.6} height={28.4} rx={1.8} fill={BRASS.light} stroke={INK} strokeWidth={1.1} />
      <Path d="M6.4 10.5H9.6M6.4 19.5H9.6" stroke={INK} strokeWidth={1} />
      {[7, 15, 23].map((y) => <Circle key={y} cx={3.6} cy={y} r={1} fill={BRASS.deep} />)}
      {[7, 15, 23].map((y) => <Circle key={`r${y}`} cx={12.4} cy={y} r={1} fill={BRASS.deep} />)}
    </Svg>
  );
});

/** A drawer's box from above: the tops of its sides and its back, pale where they're sawn. */
const BoxWalls = memo(function BoxWalls({ w, h, wood, deep }: { w: number; h: number; wood: string; deep: string }) {
  const t = 5;
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={w} height={t} fill={wood} />
      <Rect x={0} y={0} width={t} height={h} fill={wood} />
      <Rect x={w - t} y={0} width={t} height={h} fill={wood} />
      {/* Dovetails at the back corners, and the pen along the inner edges. */}
      <Path d={`M0 ${t + 5}H${t}M0 ${t + 12}H${t}M${w - t} ${t + 5}H${w}M${w - t} ${t + 12}H${w}`} stroke={deep} strokeOpacity={0.7} strokeWidth={1} />
      <Ink d={`M${t} ${h}V${t}H${w - t}V${h}`} w={1.4} opacity={0.85} />
    </Svg>
  );
});

/** A cupboard's inside: its back boards and a shelf across it. */
const CabinetWalls = memo(function CabinetWalls({ w, h, wood }: { w: number; h: number; wood: string }) {
  const y = Math.round(h * 0.7);
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Path d={`M${w * 0.33} 0V${y}M${w * 0.66} 0V${y}`} stroke="#000000" strokeOpacity={0.35} strokeWidth={1.2} />
      {/* The shelf: its top catching a little light, its front edge, the dark under it. */}
      <Rect x={0} y={y} width={w} height={7} fill={wood} />
      <Path d={`M0 ${y + 0.8}H${w}`} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1.2} />
      <Rect x={0} y={y + 7} width={w} height={10} fill="#000000" fillOpacity={0.4} />
      <Ink d={`M0 ${y}H${w}M0 ${y + 7}H${w}`} w={1.2} opacity={0.8} />
    </Svg>
  );
});

const styles = StyleSheet.create({
  room: { justifyContent: "center", alignItems: "center" },
  carcass: { padding: ref.space.sm },
  below: { position: "absolute", left: ref.space.sm, right: ref.space.sm, opacity: 0.92 },
  centre: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  inside: {
    position: "absolute",
    left: ref.space.sm,
    right: ref.space.sm,
    top: ref.space.sm,
    borderRadius: 4,
    overflow: "hidden",
  },
  lying: { position: "absolute", left: 0, right: 0, top: 0, alignItems: "center", justifyContent: "center" },
  // Behind a door: by its free edge, the side that opens first.
  byEdge: { alignItems: "flex-end", paddingRight: ref.space.sm },
  shade: { backgroundColor: "#000000" },
  front: { alignItems: "center", justifyContent: "center" },
  cast: { position: "absolute", left: 0, height: 30 },
  lip: { position: "absolute", left: 3, top: -4, height: 6, borderRadius: 2, borderWidth: 1 },
  edge: { position: "absolute", right: -5, top: 2, width: 6, borderRadius: 2, borderWidth: 1 },
  knobAt: { position: "absolute", right: ref.space.lg - 4 },
  // A locking drawer: its keyhole above, the pull a little lower.
  plateDrawer: { position: "absolute", top: 12 },
  pullLow: { paddingTop: 30 },
  plateDoor: { position: "absolute", right: ref.space.lg + 2, bottom: 26 },
  hinges: { position: "absolute", left: 1, top: 0, width: 16, justifyContent: "space-around", paddingVertical: 14 },
});
