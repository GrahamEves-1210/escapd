// Crypto minting helpers and id slugs. Pure (no Deno or Node APIs beyond the
// global WebCrypto), so the v2 engine/planner and the app can import them.
// templates.ts re-exports everything here.

export type RandomInt = (maxExclusive: number) => number;

/** Uniform integer in [0, max) from crypto.getRandomValues (rejection sampling, no modulo bias). */
export const cryptoInt: RandomInt = (max) => {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf); while (buf[0] >= limit);
  return buf[0] % max;
};

/** Codes a player could guess without the clue. */
export function isWeakCode(code: string): boolean {
  const d = [...code].map(Number);
  const steps = d.slice(1).map((v, i) => v - d[i]);
  return steps.every((s) => s === 0) || steps.every((s) => s === 1) || steps.every((s) => s === -1);
}

export function mintCode(randomInt: RandomInt = cryptoInt): string {
  for (;;) {
    const code = String(randomInt(10_000)).padStart(4, "0");
    if (!isWeakCode(code)) return code;
  }
}

const SUFFIX_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export function mintSuffix(randomInt: RandomInt = cryptoInt, length = 4): string {
  let out = "";
  for (let i = 0; i < length; i++) out += SUFFIX_ALPHABET[randomInt(SUFFIX_ALPHABET.length)];
  return out;
}

/** ^[a-z0-9][a-z0-9_-]{0,63}$ slug of a label, unique within `taken`. */
export function slugId(label: string, taken: Set<string>, fallback = "object"): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40).replace(/_+$/, "");
  if (!/^[a-z0-9]/.test(base)) base = fallback;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`;
  taken.add(id);
  return id;
}
