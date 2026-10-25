// The 0.5x lens (docs/DESIGN.md 02, Decisions 2): offered wherever the phone
// reports an ultra-wide back lens, default 1x. expo-camera 58 lists lenses on
// iOS only (getAvailableLensesAsync, onAvailableLensesChanged); the list is
// read once the camera is ready. Android, and iPhones without an ultra-wide,
// get no lens control.
//
// Open before the control ships (DESIGN.md, Needs you): check that room
// generation copes with ultra-wide barrel distortion; if it doesn't, limit
// 0.5x to plate I or hide the segment (return ultraWide null below).
import { useCallback, useState, type RefObject } from "react";
import { Platform } from "react-native";
import type { AvailableLenses, CameraView, LensInfo } from "expo-camera";

/** AVCaptureDevice.DeviceType.builtInUltraWideCamera, as expo-camera reports it. */
export const ULTRA_WIDE_LENS = "AVCaptureDeviceTypeBuiltInUltraWideCamera";

export type LensChoice = "wide" | "main";

export interface Lenses {
  /** The ultra-wide's deviceType, or null when the phone reports none (or hasn't yet). */
  ultraWide: string | null;
  /** The lens in use. Always "main" without an ultra-wide. */
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
  const [choice, setChoice] = useState<LensChoice>("main");

  const read = useCallback(() => {
    if (Platform.OS !== "ios") return;
    const view = camera.current;
    if (!view) return;
    view.getAvailableLensesAsync().then(setLenses, () => {});
  }, [camera]);

  const onChanged = useCallback((event: AvailableLenses) => setLenses(event.lenses), []);

  const ultraWide = lenses.find((lens) => lens.deviceType === ULTRA_WIDE_LENS)?.deviceType ?? null;
  const current: LensChoice = ultraWide ? choice : "main";

  return {
    ultraWide,
    choice: current,
    choose: setChoice,
    selectedLens: current === "wide" && ultraWide ? ultraWide : undefined,
    read,
    onChanged,
  };
}
