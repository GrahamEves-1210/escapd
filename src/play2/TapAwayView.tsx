// The screen's root view, watching for taps anywhere (useTapAway) without taking them.
import type { ComponentProps } from "react";
import { View } from "react-native";
import { useTapAway, type TapPlace } from "./useTapAway";

export function TapAwayView({ onTap, ...props }: ComponentProps<typeof View> & { onTap: (x: number, y: number, place: TapPlace) => void }) {
  const handlers = useTapAway(onTap);
  return <View {...props} {...handlers} />;
}
