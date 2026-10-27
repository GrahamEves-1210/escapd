// Photos from the library, for 02's library button and 03's "Choose photos
// instead". The picker offers the room left on the roll (1 in retake mode):
// up to its plan's count (src/capture/roll.ts; 5 on 0.5x, 6 on 1x or before
// any camera has said which lens).
// Each pick is re-encoded on the phone (processPhoto: EXIF and location
// dropped), one at a time and each in its own try/catch, so a photo that
// fails never drops the picks after it (docs/DESIGN.md 02, Library). It then
// joins the roll (addPlate) or, in retake mode, replaces the retaken plate
// (replacePlate) and returns to the light table (router.back()). The screens
// own the copy: notices, thinking lines and where to go next.
import { useCallback, useEffect, useRef, useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { processPhoto } from "./process-photo";
import { addPlate, getPlates, getRollPlan, replacePlate } from "./roll";

export interface LibraryImportProgress {
  /** Photos finished so far, used or not. The photo being worked on is the (done + 1)th. */
  done: number;
  /** Photos picked: at most the room left on the roll, and 1 in retake mode. */
  total: number;
}

export interface LibraryImportResult {
  /** Photos picked and worked on. */
  total: number;
  /** Photos that joined the roll, or replaced the retaken plate. */
  added: number;
  /** Photos that couldn't be used: processPhoto failed, or the roll had no room for them. */
  failed: number;
  /** True when a retake replaced its plate. router.back() to the light table has already run. */
  retaken: boolean;
}

export interface LibraryImport {
  /**
   * Opens the picker, then re-encodes and keeps each pick in order. Resolves
   * with what happened, or null when nothing was imported: no room on the
   * roll, an import already running, the picker cancelled or unable to open,
   * or the screen closed before the import finished. Never rejects.
   *
   * If the screen closes mid-import, the remaining picks still join the roll
   * (it lives in memory), but a retake's photo is dropped, so a cancelled
   * retake leaves its plate unchanged and never calls router.back() twice.
   */
  pick: () => Promise<LibraryImportResult | null>;
  /** True from the moment the picker closes with photos until the last one is done. False while the picker is open. */
  busy: boolean;
  /** Counts for "photo n of N" lines while busy; null otherwise. */
  progress: LibraryImportProgress | null;
}

export interface LibraryImportOptions {
  /** The plate being retaken (zero-based), or null outside retake mode. */
  retakeIndex: number | null;
}

export function useLibraryImport({ retakeIndex }: LibraryImportOptions): LibraryImport {
  const [progress, setProgress] = useState<LibraryImportProgress | null>(null);
  const running = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pick = useCallback(async (): Promise<LibraryImportResult | null> => {
    const room = retakeIndex !== null ? 1 : getRollPlan().shots - getPlates().length;
    if (running.current || room <= 0) return null;
    running.current = true;
    try {
      let chosen: ImagePicker.ImagePickerResult;
      try {
        chosen = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsMultipleSelection: room > 1,
          selectionLimit: room,
          quality: 1,
          exif: false,
        });
      } catch {
        return null;
      }
      if (chosen.canceled) return null;
      const assets = chosen.assets.slice(0, room);
      if (assets.length === 0) return null;

      const total = assets.length;
      const result: LibraryImportResult = { total, added: 0, failed: 0, retaken: false };
      setProgress({ done: 0, total });
      for (const [i, asset] of assets.entries()) {
        try {
          const plate = await processPhoto(asset);
          if (retakeIndex === null) {
            if (addPlate(plate)) result.added += 1;
            else result.failed += 1;
          } else if (mounted.current) {
            if (replacePlate(retakeIndex, plate)) {
              result.added += 1;
              result.retaken = true;
              router.back();
            } else {
              result.failed += 1;
            }
          }
        } catch {
          result.failed += 1;
        }
        setProgress({ done: i + 1, total });
      }
      return mounted.current ? result : null;
    } finally {
      running.current = false;
      setProgress(null);
    }
  }, [retakeIndex]);

  return { pick, busy: progress !== null, progress };
}
