// A key's bitting: five cuts along its blade, bow to tip, each one of four depths ("31021": 0 uncut, 3
// deepest). Rooms are generated, so no key is rendered whole: the brass blank is rendered four times, each
// with all five cuts at one depth (gadget_keys.py), and a key is put together from slices of those: its
// bow and its tip from any, each cut from the render with that cut's depth. Between two cuts the blade is
// always back at its full height, so the slices meet without a seam. The soap's impression is cut the same.

/** The key as rendered, in points: its box, the hole its ring goes through, where its first cut's slice starts, a slice's width. */
export const KEY = { w: 120, h: 40, hole: { x: 11, y: 20 }, first: 50, slice: 12, cuts: 5, depths: 4 } as const;
/** From the hole to the tip. */
export const KEY_REACH = KEY.w - KEY.hole.x - 1.6;

/** The cut depths of a bitting, bow to tip (anything that isn't a depth counts as uncut). */
export function cutsOf(bitting: string): number[] {
  return Array.from({ length: KEY.cuts }, (_, i) => {
    const d = Number(bitting[i]);
    return Number.isInteger(d) && d >= 0 && d < KEY.depths ? d : 0;
  });
}

export interface KeySlice {
  /** Which depth's render it is cut from. */
  depth: number;
  /** Its place along the key, in points. */
  x: number;
  w: number;
}

/** The slices a key is put together from, bow to tip: its bow, its five cuts, its tip. */
export function keySlices(bitting: string): KeySlice[] {
  const cuts = cutsOf(bitting);
  const end = KEY.first + KEY.cuts * KEY.slice;
  return [
    { depth: 0, x: 0, w: KEY.first },
    ...cuts.map((depth, i) => ({ depth, x: KEY.first + i * KEY.slice, w: KEY.slice })),
    { depth: 0, x: end, w: KEY.w - end },
  ];
}

/** Whether a card's text is a bitting and nothing else (the impression card: drawn, never written). */
export const isBitting = (text: string) => new RegExp(`^[0-${KEY.depths - 1}]{${KEY.cuts}}$`).test(text.trim());

const DEPTH_WORD = ["uncut", "shallow", "middling", "deep"];
/** A bitting, said: for a screen reader, which cannot compare the keys by eye. */
export const sayBitting = (bitting: string) => `Cuts from the bow: ${cutsOf(bitting).map((d) => DEPTH_WORD[d]).join(", ")}`;

/** The soap as rendered (gadget_keys.py): its box; the key pressed into it PRESS times its size, mirrored (bow right), centred. */
export const SOAP = { w: 200, h: 124, press: 1.3 } as const;

/** The soap's slices: as the key's, pressed in mirrored. */
export function soapSlices(bitting: string): KeySlice[] {
  const ox = (SOAP.w - KEY.w * SOAP.press) / 2;
  // The key's slices in the soap's points, flipped left to right; the bar's ends take up the rest.
  const cuts = keySlices(bitting).slice(1, -1).map((s) => ({ depth: s.depth, x: SOAP.w - (ox + (s.x + s.w) * SOAP.press), w: s.w * SOAP.press })).reverse();
  const from = cuts[0].x, to = cuts[cuts.length - 1].x + cuts[cuts.length - 1].w;
  return [{ depth: 0, x: 0, w: from }, ...cuts, { depth: 0, x: to, w: SOAP.w - to }];
}
