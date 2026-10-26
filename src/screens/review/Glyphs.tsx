// ESCAPD line art drawn to the reference's own glyphs (docs/refs/07), where
// no Phosphor glyph has their shape. Both are decorative: the control or line
// beside them says what they mean.
//
// CameraGlyph: the add pill's camera. Square corners, a small bump centred on
// the top edge and a big lens, measured 19.7 x 16.7 overall with a ~1.2 line
// (ref.layout.review.camera). Drawn with the stroke inside the box, mitred.
//
// TapGlyph: the retake hint's finger pressing inside a rounded-square button,
// measured 12.3 x 18 ink with a ~1 line (ref.layout.review.tap): the paths are
// in pt, offset in the hint's 20 glyph box so the ink starts at x 23 and the
// text at x 42 on 393, as in the reference. Round caps and joins.
import Svg, { Circle, G, Path } from "react-native-svg";
import { ref } from "@/theme/tokens";

const C = ref.layout.review.camera;
const T = ref.layout.review.tap;

export function CameraGlyph({ color }: { color: string }) {
  const s = C.line / 2;
  const bumpLeft = (C.width - C.bump) / 2;
  const outline = [
    `M ${s} ${C.bodyTop + s}`,
    `H ${bumpLeft + s}`,
    `V ${s}`,
    `H ${bumpLeft + C.bump - s}`,
    `V ${C.bodyTop + s}`,
    `H ${C.width - s}`,
    `V ${C.height - s}`,
    `H ${s}`,
    "Z",
  ].join(" ");
  return (
    <Svg width={C.width} height={C.height} accessible={false} testID="camera-glyph">
      <Path d={outline} stroke={color} strokeWidth={C.line} strokeLinejoin="miter" fill="none" />
      <Circle cx={C.width / 2} cy={C.lensY} r={(C.lens - C.line) / 2} stroke={color} strokeWidth={C.line} fill="none" />
    </Svg>
  );
}

export function TapGlyph({ color }: { color: string }) {
  return (
    <Svg width={T.box} height={T.box} accessible={false} testID="tap-glyph">
      <G transform={`translate(${T.x} ${T.y})`}>
        {T.paths.map((d) => (
          <Path key={d} d={d} stroke={color} strokeWidth={T.line} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </G>
    </Svg>
  );
}
