// Once's bare control-row glyph (02's flash and flip slots): no container, a
// Phosphor glyph at ref.layout.camera.controlIcon 22 (the measured bolt) in
// textPrimary, centred in a 48 hit box (ref.button.bare). ESCAPD uses it as a switch (flash, framing grid): the
// glyph itself shows the state (the caller swaps the icon or its weight), so
// colour never carries it and every state stays the reference's white.
// - Pressed: ref.button.bare.pressedOpacity 0.75.
// - Disabled: 0.4, eased over ref.motion.control (Dimmable).
// - Focus: the kit's brass ring, a circle around the 48 box.
import { Pressable, StyleSheet } from "react-native";
import type { IconWeight } from "phosphor-react-native";
import { FocusRing, useFocusRing, type NoirIcon } from "@/components/noir";
import { ref } from "@/theme/tokens";
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
        <Icon size={ref.layout.camera.controlIcon} color={B.glyph} weight={weight} />
        <FocusRing visible={focus.focused} shape="pill" />
      </Pressable>
    </Dimmable>
  );
}

const styles = StyleSheet.create({
  box: { width: B.hit, height: B.hit, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: B.pressedOpacity },
});
