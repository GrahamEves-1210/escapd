// The cat's outfit: a tiny accessory both cats wear (cat/Accessory.tsx draws
// it), chosen where the player unlocks them and kept on the device under
// "escapd.cat.accessory": exactly "none" | "collar" | "scarf" | "specs" |
// "deerstalker". An older build's "bell" (the bell collar) reads as "collar";
// its "bow", "beret" and "flowers" are gone and read as none, as does
// anything else.
//
// Each cat reads it as it mounts and again when the app comes back to the
// front; a screen that picks one calls setCatAccessory (it writes the key and
// every cat on screen changes at once), and in case the key was written some
// other way, a mounted cat looks again every few seconds while the app is in
// front (so the cat on home's sill has its new outfit on by the time the
// player is back there).
import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const CAT_ACCESSORY_KEY = "escapd.cat.accessory";
export const CAT_ACCESSORIES = ["none", "collar", "scarf", "specs", "deerstalker"] as const;
export type CatAccessory = (typeof CAT_ACCESSORIES)[number];
/** How often (ms) a mounted cat looks at the key again while the app is in front. */
export const ACCESSORY_RECHECK = 3000;

/** An older build's outfits that live on under another name (the rest of them read as none). */
const RENAMED = new Map<string, CatAccessory>([["bell", "collar"]]);

export function parseCatAccessory(raw: string | null | undefined): CatAccessory {
  const renamed = raw ? RENAMED.get(raw) : undefined;
  if (renamed) return renamed;
  return (CAT_ACCESSORIES as readonly string[]).includes(raw ?? "") ? (raw as CatAccessory) : "none";
}

const listeners = new Set<(a: CatAccessory) => void>();
let known: CatAccessory | null = null;

/** Reads the key (never throws: unreadable is none), and tells every cat. */
export async function readCatAccessory(): Promise<CatAccessory> {
  let value: CatAccessory = "none";
  try {
    value = parseCatAccessory(await AsyncStorage.getItem(CAT_ACCESSORY_KEY));
  } catch {
    value = known ?? "none";
  }
  if (value !== known) {
    known = value;
    listeners.forEach((l) => l(value));
  }
  return value;
}

/** Puts an accessory on the cat: kept under the key, and on every cat on screen now. */
export async function setCatAccessory(value: CatAccessory): Promise<void> {
  known = value;
  listeners.forEach((l) => l(value));
  try {
    await AsyncStorage.setItem(CAT_ACCESSORY_KEY, value);
  } catch {
    // Kept for this run of the app at least.
  }
}

/** The accessory the cat wears now ("none" until read). */
export function useCatAccessory(): CatAccessory {
  const [value, setValue] = useState<CatAccessory>(known ?? "none");
  const shown = useRef(value);
  useEffect(() => {
    let alive = true;
    // Only a change re-renders the cat.
    const hear = (a: CatAccessory) => {
      if (!alive || a === shown.current) return;
      shown.current = a;
      setValue(a);
    };
    listeners.add(hear);
    readCatAccessory().then(hear);
    let timer: ReturnType<typeof setInterval> | undefined;
    const watch = (active: boolean) => {
      clearInterval(timer);
      timer = active ? setInterval(() => void readCatAccessory(), ACCESSORY_RECHECK) : undefined;
    };
    watch(AppState.currentState !== "background");
    const sub = AppState.addEventListener("change", (s) => {
      watch(s === "active");
      if (s === "active") void readCatAccessory();
    });
    return () => {
      alive = false;
      listeners.delete(hear);
      clearInterval(timer);
      sub.remove();
    };
  }, []);
  return value;
}
