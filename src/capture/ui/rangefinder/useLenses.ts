// The 0.5x lens (docs/DESIGN.md 02): the default wherever the phone reports
// an ultra-wide back lens, because the 360 (src/capture/turn.ts) goes round
// in 5 photos that overlap only on the ultra-wide (1x needs 6 that only just
// meet). Everywhere else the main lens (1x). The player can still switch, and
// the camera starts on the lens the roll was being taken on (`initial`), so
// reopening it mid-roll doesn't switch lens. expo-camera 58 lists lenses on
// iOS only (getAvailableLensesAsync, onAvailableLensesChanged); the list is
// read once the camera is ready, so the feed starts on 1x and moves to 0.5x
// as soon as the ultra-wide is reported. Until then the lens isn't `settled`
// and the camera keeps the roll's plan as it was. Android (whose `zoom` can't
// go below 1x), iPhones without an ultra-wide and the web get 1x and no lens
// control, settled at once.
import { useCallback, useState, type RefObject } from "react";
import { Platform } from "react-native";
import type { AvailableLenses, CameraView, LensInfo } from "expo-camera";

/** AVCaptureDevice.DeviceType.builtInUltraWideCamera, as expo-camera reports it. */
export const ULTRA_WIDE_LENS = "AVCaptureDeviceTypeBuiltInUltraWideCamera";
/** The main (1x) back lens. Named explicitly on 1x: unsetting `selectedLens` on a running camera is fragile. */
export const MAIN_LENS = "AVCaptureDeviceTypeBuiltInWideAngleCamera";

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
  /** CameraView `selectedLens`: the ultra-wide when chosen; the main lens by name on a phone that has both; otherwise unset. */
  selectedLens: string | undefined;
  /** Read the list. Call once the camera is ready. */
  read: () => void;
  /** CameraView `onAvailableLensesChanged`. */
  onChanged: (event: AvailableLenses) => void;
  /** The phone's lenses are known (iOS: the list has been read, or failed to), so `choice` is the lens in use. */
  settled: boolean;
}

export function useLenses(camera: RefObject<CameraView | null>, initial: LensChoice | null = null): Lenses {
  const [lenses, setLenses] = useState<readonly LensInfo[]>([]);
  const [listed, setListed] = useState(Platform.OS !== "ios");
  // Null until the player picks a lens (or the roll was on one): then the default follows the hardware.
  const [choice, setChoice] = useState<LensChoice | null>(initial);

  const read = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const view = camera.current;
    if (!view) return;
    view.getAvailableLensesAsync().then(
      (list) => {
        setLenses(list);
        setListed(true);
      },
      () => setListed(true),
    );
  }, [camera]);

  const onChanged = useCallback((event: AvailableLenses) => {
    setLenses(event.lenses);
    setListed(true);
  }, []);

  const ultraWide = lenses.find((lens) => lens.deviceType === ULTRA_WIDE_LENS)?.deviceType ?? null;
  const main = lenses.find((lens) => lens.deviceType === MAIN_LENS)?.deviceType ?? null;
  const current = lensFor(ultraWide, choice);

  return {
    ultraWide,
    choice: current,
    choose: setChoice,
    // 1x after 0.5: the main lens by name (when listed), never back to unset.
    selectedLens: current === "wide" && ultraWide ? ultraWide : ultraWide && main ? main : undefined,
    read,
    onChanged,
    settled: listed,
  };
}
