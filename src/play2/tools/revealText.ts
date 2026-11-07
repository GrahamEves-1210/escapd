// The reveal tools' text and gesture arithmetic (pure: tested without a renderer).
export type RevealKind = "heat" | "mirror";

/** How far (points) the page travels to reach the warmth or the glass. */
export const REACH = 150;
/** Past this much of the way it holds: the writing stays. */
export const HOLD_AT = 0.85;

/** What a drag of `dy` points (down positive) does to the reveal (0..1), for a tool: heat goes up to the bulb, mirror down to the glass. */
export function progressFor(kind: RevealKind, dy: number): number {
  "worklet";
  const toward = kind === "heat" ? -dy : dy;
  return Math.min(1, Math.max(0, toward / REACH));
}

/**
 * A card's text as the narration ("Held to the warm bulb, brown letters creep up:") and what is written
 * (the values): the page shows only the writing, the narration is the caption once it's read.
 */
export function splitCard(text: string): { lead: string; writing: string } {
  const m = /:(\s)/.exec(text);
  if (!m) return { lead: "", writing: text };
  return { lead: text.slice(0, m.index + 1).trim(), writing: text.slice(m.index + 1).trim() };
}

/** The card a result showed that reads with a tool (warmed, in a mirror), as the sheet opens it; else null. */
export function revealOf(
  def: { cards: { id: string; reveal?: RevealKind }[] } | null | undefined,
  result: { effects: { do: string; card?: string; title?: string; text?: string }[] } | null,
): { kind: RevealKind; title: string; text: string } | null {
  for (const e of result?.effects ?? []) {
    if (e.do !== "show_card" || !e.card) continue;
    const kind = def?.cards.find((c) => c.id === e.card)?.reveal;
    if (kind) return { kind, title: e.title ?? "", text: e.text ?? "" };
  }
  return null;
}
