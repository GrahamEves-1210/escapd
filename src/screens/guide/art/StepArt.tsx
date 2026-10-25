import { useId } from "react";
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { ref } from "@/theme/tokens";
import { drawList, type DrawOp } from "./draw";
import { SCENES } from "./scenes";

const ART = ref.layout.guide.art;

function Op({ op }: { op: DrawOp }) {
  if (op.kind === "rect") {
    return (
      <Rect
        x={op.box.x}
        y={op.box.y}
        width={op.box.width}
        height={op.box.height}
        rx={ref.radius.panel}
        stroke={op.stroke}
        strokeWidth={op.strokeWidth}
        fill={op.fill}
      />
    );
  }
  return <Path d={op.d} stroke={op.stroke} strokeWidth={op.strokeWidth} fill={op.fill} strokeLinecap="round" strokeLinejoin="round" />;
}

/**
 * One step's line art (ref.illustration), drawn at `width` x `height`: the
 * 240 x 266 art box scaled evenly. Decorative: the text carries the
 * instruction, so the parent hides it from accessibility.
 */
export function StepArt({ step, width, height }: { step: number; width: number; height: number }) {
  // Two steps are on screen during a crossfade, so gradient and clip ids are per instance.
  const id = `art${useId().replace(/[^A-Za-z0-9]/g, "")}`;
  const list = drawList(SCENES[step], id);
  const clipId = `${id}screen`;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${ART.width} ${ART.height}`}>
      <Defs>
        {list.gradients.map((g) => (
          <LinearGradient key={g.id} id={g.id} gradientUnits="userSpaceOnUse" x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2}>
            <Stop offset={0} stopColor={g.color} stopOpacity={1} />
            <Stop offset={1} stopColor={g.color} stopOpacity={0} />
          </LinearGradient>
        ))}
        {list.clip ? (
          <ClipPath id={clipId}>
            <Rect x={list.clip.x} y={list.clip.y} width={list.clip.width} height={list.clip.height} rx={ref.radius.panel} />
          </ClipPath>
        ) : null}
      </Defs>
      {list.under.map((op) => (
        <Op key={op.key} op={op} />
      ))}
      {list.clip ? (
        <G clipPath={`url(#${clipId})`}>
          {list.clipped.map((op) => (
            <Op key={op.key} op={op} />
          ))}
        </G>
      ) : null}
      {list.over.map((op) => (
        <Op key={op.key} op={op} />
      ))}
    </Svg>
  );
}
