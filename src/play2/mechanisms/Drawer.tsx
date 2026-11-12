// Drawer and compartment, as the furniture they are: a walnut carcass, a front
// with its grain and a routed panel, a brass bail pull (a turned knob and
// hinges for a door), a keyhole plate when it locks: rendered parts (sprites.tsx)
// that the same transforms slide and swing. The velvet-lined inside, dark under
// its walls, is drawn live (it takes the mode's colour). The front casts its
// shadow on what is below it as it comes out.
//
// Pull the front out (a drawer slides toward you, a
// compartment door swings on its left hinge). The moment it gives (GIVE_AT) it
// opens: onSet("open", true), the finger still on it, so what's inside lies
// there under the front and is uncovered as it comes, never popping in at the
// end. Locked, it gives a few points and rattles.
import { memo, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { interpolate, useAnimatedStyle } from "react-native-reanimated";
import { useFeedback } from "@/game/feedback";
import { ref } from "@/theme/tokens";
import { GIVE_AT, Glint, LANDING, Line, STAGE, Stage, activatable, tryKey, useLockedLine, usePull, useRattle } from "./kit";
import { CastShadow, Felt, INK, Ink, useMaterials } from "./materials";
import { ART, Sprite } from "./sprites";
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
            {/* The carcass (a drawer's has the drawer under this one in it, shut: the front slides out over it). */}
            <Sprite source={swing ? ART.cabinetCarcass : ART.drawerCarcass} w={w} h={carcassH} style={styles.fill} />
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
                  <Animated.View pointerEvents="none" style={[styles.lip, { width: frontW - 6, backgroundColor: EDGE, borderColor: INK }, lipStyle]} />
                </>
              )}
              {/* The front itself (a door's has its knob on it). */}
              <Sprite source={swing ? ART.cabinetDoor : ART.drawerFront} w={frontW} h={frontH} style={styles.fill} />
              {swing ? (
                // The door's free edge: its thickness, catching the light as it swings toward you.
                <Animated.View pointerEvents="none" style={[styles.edge, { height: frontH - 4, backgroundColor: EDGE, borderColor: INK }, lipStyle]} />
              ) : (
                <View style={[styles.centre, locked ? styles.pullLow : null]} pointerEvents="none"><Sprite source={ART.pull} w={PULL.w} h={PULL.h} /></View>
              )}
              {locked ? <View style={swing ? styles.plateDoor : styles.plateDrawer} pointerEvents="none"><Sprite source={ART.keyhole} w={KEYHOLE.w} h={KEYHOLE.h} /></View> : null}
              {/* Just pulled open: the light catches its front as it lands at the stop. */}
              {landed ? <Glint key={landed} delay={LANDING.delayMs + LANDING.inMs} radius={5} /> : null}
            </Animated.View>
            {/* A door's hinges, on the carcass over its hung edge. */}
            {swing ? (
              <View style={[styles.hinges, { height: carcassH }]} pointerEvents="none">
                <Sprite source={ART.hinge} w={HINGE.w} h={HINGE.h} />
                <Sprite source={ART.hinge} w={HINGE.w} h={HINGE.h} />
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

/** The rendered brass, at the boxes it was rendered in (mech_drawer.py): each has room round it for its shadow on the wood. */
const PULL = { w: 96, h: 44 };
const KEYHOLE = { w: 24, h: 32 };
const HINGE = { w: 22, h: 36 };
/** The sawn top of a drawer's front and a door's free edge: the rendered walnut's own light. */
const EDGE = "#B98A62";

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
  fill: { position: "absolute", left: 0, top: 0 },
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
  // A locking drawer: its keyhole above, the pull a little lower.
  plateDrawer: { position: "absolute", top: 9 },
  pullLow: { paddingTop: 30 },
  plateDoor: { position: "absolute", right: ref.space.lg - 1, bottom: 23 },
  hinges: { position: "absolute", left: -2, top: 0, width: 22, justifyContent: "space-around", paddingVertical: 11 },
});
