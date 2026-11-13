// A leaf of the casebook turning (journal/Book.tsx is the book). The page is
// taken by its fore edge and carried over the gutter: what is still flat of
// it stays where it lies, the rest is folded back over it showing the back of
// the sheet, standing up off the page (so it rides a little up the screen,
// as the book's camera sees a raised thing), with the dark of the roll at the
// fold, a shadow thrown ahead of it on the page it uncovers and another under
// its free edge. Drawn live in Skia from one number, `fold`: where the fold
// is, 1 at the fore edge (nothing turned) to 0 at the gutter (turned over).
//
// The caller lays the two pages out itself, each in a <Windowed>: the page
// being turned shows only what is still flat of it (left of the fold), the
// page being uncovered only what the fold has passed; and this on top.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, type SharedValue } from "react-native-reanimated";
import { Canvas, Group, LinearGradient, Path, Rect, vec } from "@shopify/react-native-skia";
import { skiaAvailable } from "@/lib/skiaReady";

/** How far the free edge stands off the page at the middle of the turn, as it shows on screen (points up it). */
const LIFT = 26;
/** The roll at the fold, and the shadows' reach. */
const ROLL = 13, AHEAD = 44, UNDER = 16;
/** Room round the page for the leaf standing proud of it and reaching over the gutter. */
export const TURN_MARGIN = { left: 34, top: LIFT + 6, right: 0, bottom: 8 };

/**
 * A leaf seen through a window that slides across the page: `shift` is how far the window has moved, as a share of
 * the page's width (0: the whole leaf). The leaf being turned shows from the gutter to the fold (shift = fold - 1);
 * the one it uncovers, from the fold to the fore edge (shift = fold). The leaf itself never moves. Transforms only.
 */
export function Windowed({ shift, width, height, children }: { shift: SharedValue<number>; width: number; height: number; children: ReactNode }) {
  const outer = useAnimatedStyle(() => ({ transform: [{ translateX: shift.get() * width }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateX: -shift.get() * width }] }));
  return (
    <Animated.View style={[styles.clip, { width, height }, outer]}>
      <Animated.View style={[{ width, height }, inner]}>{children}</Animated.View>
    </Animated.View>
  );
}

export function PageTurn({ fold, width, height, paper, back, ink, shade }: {
  fold: SharedValue<number>;
  /** The page's size. */
  width: number;
  height: number;
  /** The paper, the back of a sheet (a touch duller), the pen's ink and the shadow's colour. */
  paper: string;
  back: string;
  ink: string;
  shade: string;
}) {
  const M = TURN_MARGIN;
  const x0 = M.left, y0 = M.top, y1 = M.top + height;
  // The fold, and the turned part's free edge (it lies as far left of the fold as it was right of it).
  const f = useDerivedValue(() => x0 + fold.get() * width);
  const lift = useDerivedValue(() => Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - fold.get()))) ** 0.8 * LIFT);
  const leaf = useDerivedValue(() => {
    const fx = f.get(), ex = 2 * fx - (x0 + width), up = lift.get(), mid = (fx + ex) / 2;
    // From the fold's head along the top to the free edge, down it, and back along the foot: the edges bow as the sheet does.
    return `M ${fx} ${y0} Q ${mid} ${y0 - up * 1.25} ${ex} ${y0 - up} L ${ex} ${y1 - up} Q ${mid} ${y1 - up * 0.2} ${fx} ${y1} Z`;
  });
  const edge = useDerivedValue(() => {
    const fx = f.get(), ex = 2 * fx - (x0 + width), up = lift.get();
    return `M ${ex} ${y0 - up} L ${ex} ${y1 - up}`;
  });
  const shown = useDerivedValue(() => (fold.get() >= 0.999 || fold.get() <= 0.001 ? 0 : 1));
  const depth = useDerivedValue(() => Math.sin(Math.PI * Math.min(1, Math.max(0, 1 - fold.get()))));
  const aheadX = useDerivedValue(() => f.get());
  const aheadA = useDerivedValue(() => vec(f.get(), 0));
  const aheadB = useDerivedValue(() => vec(f.get() + AHEAD, 0));
  const aheadO = useDerivedValue(() => 0.2 + 0.5 * depth.get());
  const rollX = useDerivedValue(() => f.get() - ROLL);
  const rollA = useDerivedValue(() => vec(f.get() - ROLL, 0));
  const rollB = useDerivedValue(() => vec(f.get(), 0));
  const underX = useDerivedValue(() => 2 * f.get() - (x0 + width) - UNDER);
  const underA = useDerivedValue(() => vec(2 * f.get() - (x0 + width) - UNDER, 0));
  const underB = useDerivedValue(() => vec(2 * f.get() - (x0 + width), 0));
  const underY = useDerivedValue(() => y0 - lift.get());
  const sheen = useDerivedValue(() => {
    const fx = f.get(), ex = 2 * fx - (x0 + width);
    return [vec(ex, 0), vec(fx, 0)];
  });
  const sheenA = useDerivedValue(() => sheen.get()[0]);
  const sheenB = useDerivedValue(() => sheen.get()[1]);

  if (!skiaAvailable()) return null;
  return (
    <View style={[styles.box, { left: -M.left, top: -M.top, width: width + M.left + M.right, height: height + M.top + M.bottom }]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="v2-casebook-turn">
      <Canvas style={StyleSheet.absoluteFill}>
        <Group opacity={shown}>
          {/* Thrown ahead of the fold, on the page being uncovered. */}
          <Rect x={aheadX} y={y0} width={AHEAD} height={height} opacity={aheadO}>
            <LinearGradient start={aheadA} end={aheadB} colors={[shade, "transparent"]} />
          </Rect>
          {/* Under the free edge, on what is still flat. */}
          <Rect x={underX} y={underY} width={UNDER} height={height} opacity={depth}>
            <LinearGradient start={underA} end={underB} colors={["transparent", shade]} positions={[0, 1]} />
          </Rect>
          {/* The back of the sheet. */}
          <Path path={leaf} color={back} />
          <Path path={leaf}>
            <LinearGradient start={sheenA} end={sheenB} colors={[paper, "transparent"]} positions={[0, 0.7]} />
          </Path>
          {/* The roll: dark where it turns under, at the fold. */}
          <Group clip={leaf}>
            <Rect x={rollX} y={y0 - LIFT} width={ROLL} height={height + LIFT} opacity={0.6}>
              <LinearGradient start={rollA} end={rollB} colors={["transparent", shade]} positions={[0.15, 1]} />
            </Rect>
          </Group>
          <Path path={leaf} style="stroke" strokeWidth={1} color={ink} opacity={0.55} strokeJoin="round" />
          <Path path={edge} style="stroke" strokeWidth={1.2} color={ink} opacity={0.5} />
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  box: { position: "absolute", zIndex: 4 },
});
