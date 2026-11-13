// The camera's round push button (02's control row: flash, framing grid): a
// rendered black cap in a brass rim (ART.buttonRound, filling the 48 hit box,
// ref.button.bare) carrying a Phosphor glyph at ref.layout.camera.controlIcon
// 22 in the palette's ink. It is a switch: the glyph itself shows the state
// (the caller swaps the icon or its weight), so colour never carries it.
// - Pressed: ref.button.bare.pressedOpacity 0.75.
// - Disabled: 0.4, eased over ref.motion.control (Dimmable).
// - Focus: the kit's brass ring, a circle around the 48 box.
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import type { IconWeight } from "phosphor-react-native";
import { FocusRing, useFocusRing, type NoirIcon } from "@/components/noir";
import { ref } from "@/theme/tokens";
import { ART } from "../art";
import { CHROME } from "../look";
import { useCapturePalette } from "../palette";
import { Dimmable } from "./Dimmable";

const B = ref.button.bare;

export interface BareToggleProps {
  icon: NoirIcon;
  weight: IconWeight;
  accessibilityLabel: string;
  on: boolean;
  disabled: boolean;
  onPress: () => void;
  testID?: string;
}

export function BareToggle({ icon: Icon, weight, accessibilityLabel, on, disabled, onPress, testID }: BareToggleProps) {
  const focus = useFocusRing();
  const palette = useCapturePalette();
  return (
    <Dimmable dimmed={disabled}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: on, disabled }}
        disabled={disabled}
        onPress={onPress}
        onFocus={focus.onFocus}
        onBlur={focus.onBlur}
        testID={testID}
        style={({ pressed }) => [styles.box, pressed ? styles.pressed : null]}
      >
        <Image source={ART.buttonRound} pointerEvents="none" accessible={false} style={styles.art} testID={testID ? `${testID}-art` : undefined} />
        {/* In a View, so it stacks above the picture on the web too. */}
        <View>
          <Icon size={ref.layout.camera.controlIcon} color={palette.ink} weight={weight} />
        </View>
        <FocusRing visible={focus.focused} shape="pill" />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  box: { width: B.hit, height: B.hit, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: B.pressedOpacity },
  // The button's picture, centred in the hit box.
  art: {
    position: "absolute",
    left: (B.hit - CHROME.round) / 2,
    top: (B.hit - CHROME.round) / 2,
    width: CHROME.round,
    height: CHROME.round,
  },
});
