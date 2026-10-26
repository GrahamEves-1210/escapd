import { useId } from "react";
import Svg, { Defs, LinearGradient, Path } from "react-native-svg";
import { gradientStops } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { drawList } from "./draw";
import { SCENES } from "./scenes";

const ART = ref.layout.guide.art;

/**
 * One step's line art (docs/DESIGN.md 04, Illustration), drawn at `width` x
 * `height`: the 240 x 266 art box scaled evenly. Every gradient is in the art
 * box's own units, with stop colours and opacities kept apart
 * (react-native-svg ignores a stop colour's alpha). Decorative: the parent
 * hides it from accessibility.
 */
export function StepArt({ step, width, height }: { step: number; width: number; height: number }) {
  // Two steps are on screen during a crossfade, so gradient ids are per instance.
  const id = `art${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const list = drawList(SCENES[step], id);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Defs>
        {list.gradients.map((g) => (
          <LinearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            {gradientStops(g.stops)}
          </LinearGradient>
        ))}
      </Defs>
      {list.ops.map((op) => (
        <Path
          key={op.key}
          d={op.d}
          stroke={op.stroke}
          strokeWidth={op.strokeWidth}
          fill={op.fill}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}
