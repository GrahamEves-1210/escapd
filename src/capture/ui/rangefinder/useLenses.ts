// The 0.5x lens (docs/DESIGN.md 02): the default wherever the phone reports
// an ultra-wide back lens, because the 360 (src/capture/turn.ts) goes round
// in 6 photos with a third of overlap only on the ultra-wide. Everywhere else
// the main lens (1x). The player can still switch. expo-camera 58 lists
// lenses on iOS only (getAvailableLensesAsync, onAvailableLensesChanged); the
// list is read once the camera is ready, so the feed starts on 1x and moves
// to 0.5x as soon as the ultra-wide is reported. Android (whose `zoom` can't
// go below 1x), iPhones without an ultra-wide and the web get 1x and no lens
// control.
import { useCallback, useState, type RefObject } from "react";
import { Platform } from "react-native";
import type { AvailableLenses, CameraView, LensInfo } from "expo-camera";

/** AVCaptureDevice.DeviceType.builtInUltraWideCamera, as expo-camera reports it. */
export const ULTRA_WIDE_LENS = "AVCaptureDeviceTypeBuiltInUltraWideCamera";

export type LensChoice = "wide" | "main";

/**
 * The lens in use: the player's choice once they make one, otherwise the
 * ultra-wide when there is one; always "main" without an ultra-wide.
 */
export function lensFor(ultraWide: string | null, chosen: LensChoice | null): LensChoice {
  if (!ultraWide) return "main";
  return chosen ?? "wide";
}

export interface Lenses {
  /** The ultra-wide's deviceType, or null when the phone reports none (or hasn't yet). */
  ultraWide: string | null;
  /** The lens in use: the ultra-wide unless the player picked 1x. Always "main" without an ultra-wide. */
  choice: LensChoice;
  choose: (choice: LensChoice) => void;
  /** CameraView `selectedLens`: the ultra-wide when chosen, otherwise unset (the default main lens). */
  selectedLens: string | undefined;
  /** Read the list. Call once the camera is ready. */
  read: () => void;
  /** CameraView `onAvailableLensesChanged`. */
  onChanged: (event: AvailableLenses) => void;
}

export function useLenses(camera: RefObject<CameraView | null>): Lenses {
  const [lenses, setLenses] = useState<readonly LensInfo[]>([]);
  // Null until the player picks a lens: then the default follows the hardware.
  const [choice, setChoice] = useState<LensChoice | null>(null);

  const read = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const view = camera.current;
    if (!view) return;
    view.getAvailableLensesAsync().then(setLenses, () => {});
  }, [camera]);

  const onChanged = useCallback((event: AvailableLenses) => setLenses(event.lenses), []);

  const ultraWide = lenses.find((lens) => lens.deviceType === ULTRA_WIDE_LENS)?.deviceType ?? null;
  const current = lensFor(ultraWide, choice);

  return {
    ultraWide,
    choice: current,
    choose: setChoice,
    selectedLens: current === "wide" && ultraWide ? ultraWide : undefined,
    read,
    onChanged,
  };
}
