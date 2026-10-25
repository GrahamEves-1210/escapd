// Every word on /pro (docs/DESIGN.md, 05 · Copy, Tappable elements and States).

export const FILE_LABEL = "CASE FILE  ·  ESCAPD PRO";
export const FILE_LABEL_A11Y = "Case file. ESCAPD Pro.";

// Both spaces in "your own room." are non-breaking, so it sets as
// "Open a file on / your own room."
export const STATEMENT = "Open a file on your own room.";

/** The benefit index. Row 03 reads the monthly cap from get_my_access, never a hard-coded number. */
export function benefitRows(cap: number | null): readonly string[] {
  return ["Your room becomes the case.", "The clues hide in your things.", capRow(cap)];
}

function capRow(cap: number | null): string {
  if (cap === null) return "A monthly allowance of new cases.";
  return `Up to ${cap} new ${cap === 1 ? "case" : "cases"} a month.`;
}

export const TEST_NOTE = "TEST PURCHASE";

export const UNLOCK = "Unlock Pro";
// The TEST PURCHASE note's words, said as the button's hint.
export const UNLOCK_HINT = "Test purchase. Nothing is charged.";
export const CHECK_AGAIN = "Check again";
export const NOT_NOW = "Not now";

/** Test purchases off: information, not an error, so it has no icon. */
export const NOT_ON_SALE = "Pro isn't on sale yet. If you're testing, ask for access, then check again.";

export const OFFLINE = "You're offline. Connect and try again.";
export const SERVER_OFF = "Test purchases are off on this server.";
export const COULD_NOT_UNLOCK = "Couldn't unlock Pro. Try again.";

export const SAY_UNLOCKED = "Pro unlocked.";
export const SAY_NO_ACCESS = "No access on this account yet.";
