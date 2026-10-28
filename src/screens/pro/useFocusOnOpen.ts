import { useEffect, useRef, useState, type RefObject } from "react";
import type { HostInstance } from "react-native";
import { useNavigation, type NativeStackNavigationProp } from "expo-router";
import { focusForAccessibility } from "@/lib/a11y";

/**
 * Moves screen-reader focus to `target` once, when `ready` is true and the
 * route has finished opening. Waiting for the native transition to end keeps
 * VoiceOver's own first-element focus from overriding it. A root route (a
 * deep link at launch) has no opening transition.
 */
export function useFocusOnOpen(target: RefObject<HostInstance | null>, ready: boolean) {
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const [opened, setOpened] = useState(() => !navigation.canGoBack());
  const done = useRef(false);

  useEffect(
    () =>
      navigation.addListener("transitionEnd", (event) => {
        if (!event.data.closing) setOpened(true);
      }),
    [navigation],
  );

  useEffect(() => {
    if (!ready || !opened || done.current || !target.current) return;
    done.current = true;
    focusForAccessibility(target.current);
  }, [ready, opened, target]);
}
