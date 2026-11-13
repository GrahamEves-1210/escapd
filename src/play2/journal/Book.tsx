// The casebook as a book (scripts/blender/props/book_*.py): cloth-bound in the
// mode's cloth, lying on the close-ups' table. Two rendered pictures from one
// camera: the book open at its ribbon (the right-hand page to write on, the
// gutter and a sliver of the left-hand page, the fore edge's fan of leaves,
// the cover's edge and brass corners, the ribbon down the fold) and the book
// shut (the front board with its foil stamp). Each is a head, a foot and a
// thin strip between that is stretched to the page's height, so one render
// fits every phone; the pictures are 390 points wide and scaled to the
// screen.
//
// Opening is a hinge the app turns: the shut book lies exactly over the open
// one and swings about its joint, toward the reader and away to the left,
// darkening as it turns from the lamp; past upright it is gone and the
// left-hand leaves it carried are down. Closing is the same, backwards.
// All of it static pictures: nothing here redraws while the page scrolls.
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { Genre } from "@/lib/puzzle-types";
import { hidden } from "../hud/materials";

/** The pictures' measures, in points at their own width (book_open.py, book_cover.py print them). */
export const BOOK = {
  /** The pictures' width. */
  width: 390,
  /** The gutter (the right-hand page's inner edge) and the page's fore edge, from the left. */
  gutter: 30,
  fore: 370,
  /** The open book: its head's height and where in it the page's head edge is; its foot's height and the page's foot edge in it. */
  head: 56,
  pageHead: 26,
  foot: 78,
  pageFoot: 27,
  /** The shut book: its head (with the title) and foot; the joint its front board swings about. */
  coverHead: 100,
  coverFoot: 94,
  hinge: 36,
  /** The strip's own height (stretched to whatever is left). */
  strip: 4,
} as const;

const OPEN: Record<Genre, { head: number; strip: number; foot: number }> = {
  noir: { head: require("../../../assets/book/noir-open-head.png"), strip: require("../../../assets/book/noir-open-strip.png"), foot: require("../../../assets/book/noir-open-foot.png") },
  crime_scene: { head: require("../../../assets/book/crime-scene-open-head.png"), strip: require("../../../assets/book/crime-scene-open-strip.png"), foot: require("../../../assets/book/crime-scene-open-foot.png") },
  paranormal: { head: require("../../../assets/book/paranormal-open-head.png"), strip: require("../../../assets/book/paranormal-open-strip.png"), foot: require("../../../assets/book/paranormal-open-foot.png") },
};

const COVER: Record<Genre, { head: number; strip: number; foot: number }> = {
  noir: { head: require("../../../assets/book/noir-cover-head.png"), strip: require("../../../assets/book/noir-cover-strip.png"), foot: require("../../../assets/book/noir-cover-foot.png") },
  crime_scene: { head: require("../../../assets/book/crime-scene-cover-head.png"), strip: require("../../../assets/book/crime-scene-cover-strip.png"), foot: require("../../../assets/book/crime-scene-cover-foot.png") },
  paranormal: { head: require("../../../assets/book/paranormal-cover-head.png"), strip: require("../../../assets/book/paranormal-cover-strip.png"), foot: require("../../../assets/book/paranormal-cover-foot.png") },
};

export interface BookLayout {
  /** Points on screen per point of the pictures. */
  scale: number;
  width: number;
  height: number;
  /** The right-hand page, to write on: its rectangle in the book's own box. */
  page: { x: number; y: number; width: number; height: number };
  /** The front board's joint (the cover swings about it). */
  hinge: number;
}

/** Where things are in a book drawn `width` wide and `height` tall. */
export function bookLayout(width: number, height: number): BookLayout {
  const scale = width / BOOK.width;
  const y = BOOK.pageHead * scale;
  const foot = height - (BOOK.foot - BOOK.pageFoot) * scale;
  return {
    scale,
    width,
    height,
    page: { x: BOOK.gutter * scale, y, width: (BOOK.fore - BOOK.gutter) * scale, height: Math.max(0, foot - y) },
    hinge: BOOK.hinge * scale,
  };
}

/** A picture in three: its head, its foot, and the strip between stretched to fit. */
const Stretched = memo(function Stretched({ art, width, height, head, foot }: { art: { head: number; strip: number; foot: number }; width: number; height: number; head: number; foot: number }) {
  const scale = width / BOOK.width;
  const h = head * scale, f = foot * scale;
  // A hair of overlap, so no seam opens between the cuts at a fractional scale.
  return (
    <View style={{ width, height }} {...hidden}>
      <Image source={art.strip} contentFit="fill" style={[styles.cut, { top: h - 1, width, height: Math.max(0, height - h - f) + 2 }]} />
      <Image source={art.head} contentFit="fill" style={[styles.cut, { top: 0, width, height: h }]} />
      <Image source={art.foot} contentFit="fill" style={[styles.cut, { top: height - f, width, height: f }]} />
    </View>
  );
});

/** The book lying open: fills `width` x `height`. */
export const BookSpread = memo(function BookSpread({ genre, width, height }: { genre: Genre; width: number; height: number }) {
  return <Stretched art={OPEN[genre]} width={width} height={height} head={BOOK.head} foot={BOOK.foot} />;
});

/** The book shut, over the same box as the open one. */
export const BookCover = memo(function BookCover({ genre, width, height }: { genre: Genre; width: number; height: number }) {
  return <Stretched art={COVER[genre]} width={width} height={height} head={BOOK.coverHead} foot={BOOK.coverFoot} />;
});

/** The open book under the swinging cover: until the board is upright only what lies right of its joint shows (the left-hand leaves are still up in the air with it). */
export function OpeningSpread({ genre, width, height, swing }: { genre: Genre; width: number; height: number; swing: SharedValue<number> }) {
  const { hinge } = bookLayout(width, height);
  const outer = useAnimatedStyle(() => ({ transform: [{ translateX: swing.get() < BOARD_PART ? hinge : 0 }] }));
  const inner = useAnimatedStyle(() => ({ transform: [{ translateX: swing.get() < BOARD_PART ? -hinge : 0 }] }));
  return (
    <Animated.View style={[{ width, height }, styles.clip, outer]} {...hidden}>
      <Animated.View style={inner}>
        <BookSpread genre={genre} width={width} height={height} />
      </Animated.View>
    </Animated.View>
  );
}

/** How far round the front board is when it stops being drawn (it is edge-on), and the share of the swing it takes to get there. */
const UPRIGHT = 88;
const BOARD_PART = 0.62;

/**
 * The shut book over the open one, swinging about its joint as `swing` runs 0 (shut) to 1 (open): the board
 * comes up toward the reader and turns from the lamp; once edge-on it is gone. Nothing is drawn once open.
 */
export function SwingingCover({ genre, width, height, swing, shade }: { genre: Genre; width: number; height: number; swing: SharedValue<number>; shade: string }) {
  const { hinge } = bookLayout(width, height);
  const board = useAnimatedStyle(() => {
    const p = Math.min(1, swing.get() / BOARD_PART);
    return { opacity: p >= 1 ? 0 : 1, transform: [{ perspective: 1400 }, { rotateY: `${-UPRIGHT * p}deg` }] };
  });
  const dark = useAnimatedStyle(() => ({ opacity: Math.min(1, swing.get() / BOARD_PART) * 0.5 }));
  // The spine and joint stay where they lie until the left-hand leaves come down over them.
  const spine = useAnimatedStyle(() => ({ opacity: swing.get() < BOARD_PART ? 1 : 0 }));
  return (
    <View style={[StyleSheet.absoluteFill, styles.clip]} {...hidden}>
      <Animated.View style={[styles.cut, { left: 0, top: 0, width: hinge, height }, styles.clip, spine]}>
        <BookCover genre={genre} width={width} height={height} />
      </Animated.View>
      <Animated.View style={[styles.cut, styles.board, { left: hinge, top: 0, width: width - hinge, height }, board]}>
        <View style={[styles.cut, { left: -hinge, top: 0 }]}>
          <BookCover genre={genre} width={width} height={height} />
        </View>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: shade }, dark]} />
      </Animated.View>
    </View>
  );
}

/** The left-hand leaves coming down as the book opens (the last of `swing`): their shadow over the gutter, soft at its edge, lifting. */
export function LandingShade({ width, height, swing, shade }: { width: number; height: number; swing: SharedValue<number>; shade: string }) {
  const { page } = bookLayout(width, height);
  const w = page.x + page.width * 0.2;
  const style = useAnimatedStyle(() => {
    const s = swing.get();
    return { opacity: s < BOARD_PART ? 0 : ((1 - s) / (1 - BOARD_PART)) * 0.55 };
  });
  return (
    <Animated.View style={[styles.cut, { left: 0, top: 0, width: w, height }, style]} {...hidden}>
      <Svg width={w} height={height}>
        <Defs>
          <LinearGradient id="book-landing" x1={0} y1={0} x2={1} y2={0}>
            <Stop offset={0} stopColor={shade} stopOpacity={1} />
            <Stop offset={0.45} stopColor={shade} stopOpacity={0.7} />
            <Stop offset={1} stopColor={shade} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={w} height={height} fill="url(#book-landing)" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cut: { position: "absolute", left: 0 },
  clip: { overflow: "hidden" },
  board: { transformOrigin: "0% 50%", overflow: "hidden" },
});
