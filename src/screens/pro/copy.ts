// Every word on /pro (05 · Pro: Layout, Tappable elements and States), in
// sentence case, as shown and heard.

/** The small line over the title: the product's name. */
export const KICKER = "ESCAPD Pro";

// The title, with no full stop (the reference's title style). Both spaces in
// "your own room" are non-breaking, so it never strands "room".
export const TITLE = "Open a file on your own room";

/** The three benefit lines. The third reads the monthly cap from get_my_access, never a hard-coded number. */
export function benefitRows(cap: number | null): readonly string[] {
  return ["Your room becomes the case.", "The clues hide in your things.", capRow(cap)];
}

function capRow(cap: number | null): string {
  if (cap === null) return "A monthly allowance of new cases.";
  return `Up to ${cap} new ${cap === 1 ? "case" : "cases"} a month.`;
}

// The small grey note under the benefits (test builds). Hidden from screen
// readers: its words are the pill's hint.
export const TEST_NOTE = "Test purchase";

export const UNLOCK = "Unlock Pro";
export const UNLOCK_HINT = "Test purchase. Nothing is charged.";
export const CHECK_AGAIN = "Check again";
export const NOT_NOW = "Not now";

/** Loading's indicator, for screen readers. */
export const LOADING = "Loading";

/** Test purchases off: information, not an error, so it has no glyph. */
export const NOT_ON_SALE = "ESCAPD Pro isn't on sale yet. If you're testing, ask for access, then check again.";

export const OFFLINE = "You're offline. Connect and try again.";
export const SERVER_OFF = "Test purchases are off on this server.";
export const COULD_NOT_UNLOCK = "Couldn't unlock Pro. Try again.";

export const SAY_UNLOCKED = "Pro unlocked.";
export const SAY_NO_ACCESS = "No access on this account yet.";

