// The lenses. 1x (the main lens) is the default everywhere: the 360's plan
// and its turn guide are tuned for it (src/capture/turn.ts: 8 photos in the
// sensor's own 3:4, as the phone's Camera app). Where the phone reports an ultra-wide back lens the player
// can switch to 0.5x (6 photos), and the camera starts on the lens the roll
// was being taken on (`initial`), so reopening it mid-roll doesn't switch
// lens. expo-camera 58 lists lenses on iOS only (getAvailableLensesAsync,
// onAvailableLensesChanged), read once the camera is ready; until then the
// lens isn't `settled`. Android (whose `zoom` can't go below 1x), iPhones
// without an ultra-wide and the web get 1x and no lens control, settled at
// once.
//
// Switching lens never reconfigures a running camera: `selectedLens` is the
// ultra-wide on 0.5x and unset (the phone's own default back camera, at 1x)
// on 1x, and the viewfinder mounts a fresh CameraView for each (keyed by
// cameraKey), so each capture session starts on its lens. Swapping the
// device under a running AVCaptureSession (0.5 to 1.0, naming the main lens
// or unsetting it) crashed the app.
import { useCallback, useState, type RefObject } from "react";
import { Platform } from "react-native";
import type { AvailableLenses, CameraView, LensInfo } from "expo-camera";

/** AVCaptureDevice.DeviceType.builtInUltraWideCamera, as expo-camera reports it. */
export const ULTRA_WIDE_LENS = "AVCaptureDeviceTypeBuiltInUltraWideCamera";
/** The main (1x) back lens, as expo-camera reports it. */
export const MAIN_LENS = "AVCaptureDeviceTypeBuiltInWideAngleCamera";

export type LensChoice = "wide" | "main";

/**
 * The lens in use: the player's choice once they make one, otherwise 1x;
 * always "main" without an ultra-wide.
 */
export function lensFor(ultraWide: string | null, chosen: LensChoice | null): LensChoice {
  if (!ultraWide) return "main";
  return chosen ?? "main";
}

/**
 * The CameraView for a `selectedLens`: the viewfinder keys the camera by it,
 * so a lens switch mounts a fresh camera on the new lens instead of swapping
 * the device under a running one.
 */
export function cameraKey(selectedLens: string | undefined): string {
  return selectedLens ?? "default";
}

export interface Lenses {
  /** The ultra-wide's deviceType, or null when the phone reports none (or hasn't yet). */
  ultraWide: string | null;
  /** The lens in use: 1x unless the player picked 0.5x. Always "main" without an ultra-wide. */
  choice: LensChoice;
  choose: (choice: LensChoice) => void;
  /** CameraView `selectedLens`: the ultra-wide on 0.5x; unset (the default back camera, 1x) otherwise. */
  selectedLens: string | undefined;
  /** Read the list. Call once the camera is ready. */
  read: () => void;
  /** CameraView `onAvailableLensesChanged`. */
  onChanged: (event: AvailableLenses) => void;
  /** The phone's lenses are known (iOS: the list has been read, or failed to), so `choice` is the lens in use. */
  settled: boolean;
}

export function useLenses(camera: RefObject<CameraView | null>, initial: LensChoice | null = null): Lenses {
  // The ultra-wide's deviceType, sticky once any list has reported it: a list
  // read from the ultra-wide's own camera (or one mounting) can leave it out,
  // and dropping it would flip the lens back to 1x, remount the camera, and
  // round again.
  const [ultraWide, setUltraWide] = useState<string | null>(null);
  const [listed, setListed] = useState(Platform.OS !== "ios");
  // Null until the player picks a lens (or the roll was on one): then the default follows the hardware.
  const [choice, setChoice] = useState<LensChoice | null>(initial);

  const take = useCallback((list: readonly LensInfo[]) => {
    const found = list.find((lens) => lens.deviceType === ULTRA_WIDE_LENS)?.deviceType ?? null;
    if (found) setUltraWide(found);
    setListed(true);
  }, []);

  const read = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const view = camera.current;
    if (!view) return;
    view.getAvailableLensesAsync().then(take, () => setListed(true));
  }, [camera, take]);

  const onChanged = useCallback((event: AvailableLenses) => take(event.lenses), [take]);

  const current = lensFor(ultraWide, choice);

  return {
    ultraWide,
    choice: current,
    choose: setChoice,
    // Each lens is its own camera (cameraKey), so 1x is simply the default back camera.
    selectedLens: current === "wide" && ultraWide ? ultraWide : undefined,
    read,
    onChanged,
    settled: listed,
  };
}
