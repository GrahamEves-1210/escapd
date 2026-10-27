// Props contracts for the two states of /capture. The route shell
// (app/capture/index.tsx) reads the ?retake param, the roll and camera
// permission, then renders exactly one of them:
// - CameraPermission (docs/DESIGN.md 03): everything before camera access is
//   granted, including the Checking state;
// - Rangefinder (docs/DESIGN.md 02): the camera, mounted only after a grant.
import type { PermissionResponse } from "expo-camera";

/** Props for src/capture/ui/Rangefinder.tsx, 02 · Camera. */
export interface RangefinderProps {
  /**
   * The plate being retaken (zero-based) for /capture?retake=<i>, already
   * checked against the roll, or null outside retake mode. In retake mode a
   * new photo, from the shutter or the library, replaces that plate
   * (replacePlate) and the screen calls router.back() to the light table.
   *
   * The rangefinder is otherwise self-contained: it owns the camera ref, the
   * shutter, flash, lens and grid, the plate counter and last-plate thumbnail,
   * the roll (usePlates), library import (useLibraryImport) and the push to
   * the light table (/capture/review).
   */
  retakeIndex: number | null;
  /**
   * Leaves the camera: router.back(), or router.replace("/") (the hub) when
   * there is no history. In retake mode that is "Cancel retake", back to
   * /capture/review with the plate unchanged. The roll stays in memory, so
   * nothing is confirmed. For the back button, the retake thumbnail and
   * Android hardware back; the rangefinder applies its own busy rule (back is
   * ignored while a retake is being processed) before calling it.
   */
  onClose: () => void;
}

/** Props for src/capture/ui/CameraPermission.tsx, 03 · Camera permission. */
export interface CameraPermissionProps {
  /**
   * The camera permission from the shell's useCameraPermissions(): null until
   * the first read resolves. When `checking` is false it is set and not
   * granted; a grant switches the shell to the rangefinder.
   */
  permission: PermissionResponse | null;
  /**
   * True while /capture is still checking: until the permission read
   * resolves and, outside retake mode, the photo guide's seen-flag backstop
   * (src/capture/guideSeen.ts) resolves. Checking shows flat ground and the
   * back arrow only.
   */
  checking: boolean;
  /**
   * Shows the OS camera prompt and resolves with the new permission. It comes
   * from the shell's useCameraPermissions(), so a grant reaches the shell and
   * swaps in the rangefinder.
   */
  requestPermission: () => Promise<PermissionResponse>;
  /**
   * Same as RangefinderProps.retakeIndex. In retake mode the library picks 1
   * photo, which replaces the plate before router.back() to the light table.
   */
  retakeIndex: number | null;
  /** Plates on the roll now (usePlates().length): the light-table buttons depend on it (3 up to the plan's count, or a full roll at it). */
  plateCount: number;
  /** Same as RangefinderProps.onClose. The back arrow is live in every state, Checking included. */
  onClose: () => void;
}
