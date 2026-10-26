// The active mode: which genre the screens on show belong to. null is the
// shell (home, Pro, account), which keeps the reference look. Who sets it:
// - a mode's intro on focus, home on focus to null (useModeOnFocus.ts);
// - the player, from its definition (genreOf: absent means noir); /tutorial is noir;
// - openCapture({ genre }), for the guide, camera, review and build wait.
// It lives in memory only, like the roll, and is read through useModeTheme().
// A part of the shell that shows one mode's look (home's continue prompt,
// over home) wraps it in <ModeScope genre>: everything inside reads that mode
// instead of the store's, and the store is left alone.
import { createContext, createElement, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Genre, PuzzleDefinitionV1 } from "@/lib/puzzle-types";
import { modeThemes, shellTheme, type ModeTheme } from "@/theme/tokens";

/** Every mode, in home's order. */
export const GENRES: readonly Genre[] = ["noir", "crime_scene", "paranormal"];

let mode: Genre | null = null;
const listeners = new Set<() => void>();

export function getMode(): Genre | null {
  return mode;
}

export function setMode(next: Genre | null) {
  if (next === mode) return;
  mode = next;
  for (const listener of listeners) listener();
}

export function subscribeMode(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** undefined outside a ModeScope: the store's mode applies. */
const Scope = createContext<Genre | null | undefined>(undefined);

/** Everything inside reads `genre` as the active mode (useMode, useModeTheme, the capture palette), without setting the store. */
export function ModeScope({ genre, children }: { genre: Genre | null; children: ReactNode }) {
  return createElement(Scope.Provider, { value: genre }, children);
}

export function useMode(): Genre | null {
  const active = useSyncExternalStore(subscribeMode, getMode, getMode);
  const scoped = useContext(Scope);
  return scoped === undefined ? active : scoped;
}

/** The active mode's theme, or the shell's neutral theme (today's reference colours) when no mode is set. */
export function useModeTheme(): ModeTheme {
  const current = useMode();
  return current ? modeThemes[current] : shellTheme;
}

/** The theme for a mode, or the shell's when null. For a screen that knows its genre before the store does. */
export function themeFor(genre: Genre | null | undefined): ModeTheme {
  return genre ? modeThemes[genre] : shellTheme;
}

/** True for one of the three genres. For route params and anything else read from outside. */
export function isGenre(value: unknown): value is Genre {
  return typeof value === "string" && (GENRES as readonly string[]).includes(value);
}

/** A route param (`/mode/intro/[genre]`) as a genre, or null when it isn't one. */
export function parseGenre(param: string | string[] | undefined): Genre | null {
  const value = Array.isArray(param) ? param[0] : param;
  return isGenre(value) ? value : null;
}

/** A case's genre: its definition's, or noir when it has none (the seeded tutorial, older rooms). */
export function genreOf(definition: Pick<PuzzleDefinitionV1, "genre"> | null | undefined): Genre {
  const genre = definition?.genre;
  return isGenre(genre) ? genre : "noir";
}
