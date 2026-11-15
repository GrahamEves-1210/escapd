// What cases feature, over many rooms: a varied mix, not the same UV light and cipher wheel every time.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { type Featured, featuredKinds, planRoom, recentWeights } from "./planner.ts";
import { BEDROOM_WITH_DOOR, FULL_15, seededRandomInt, syntheticInventory } from "./test_fixtures.ts";
import { MODES, type MotifId } from "./types.ts";

const ROOMS = 90;
/** Writing that comes up in light or heat. */
const GLOWS: MotifId[] = ["tool_reveal", "room_change", "warm_reveal"];
const GADGETS: Featured[] = ["dial", "keys", "telephone", "balance", "tune", "ribbon"];
const HANDS_ON: Featured[] = ["heat", "mirror", "rub", "lens", "fold", "tune", "ribbon", "balance"];

Deno.test("distribution: at most one glowing reveal a case, UV and the cipher wheel rare, gadgets and hands-on reveals common", () => {
  const share: Record<string, Record<string, number>> = {};
  for (const mode of MODES) {
    const n: Record<string, number> = {};
    let planned = 0;
    for (let i = 0; i < ROOMS; i++) {
      const r = planRoom(syntheticInventory(7000 + i, 8 + (i % 8)), { mode, seed: `dist-${mode}-${i}`, randomInt: seededRandomInt(i) });
      if (!r.ok) continue;
      planned++;
      const k = featuredKinds(r.definition);
      const motifs = new Set(r.secret.steps.map((s) => s.motif));
      const glows = GLOWS.filter((m) => motifs.has(m)).length + (r.definition.objects.some((o) => o.trace) && !motifs.has("tool_reveal") ? 1 : 0);
      // One light-or-heat reveal at most (two only in the last round of candidates, for a room that plans no other way).
      if (r.summary.candidatesTried < 24) assert(glows <= 1, `${mode} ${i}: ${[...motifs].join(", ")}`);
      const count = (key: string, yes: boolean) => { if (yes) n[key] = (n[key] ?? 0) + 1; };
      count("uv", k.includes("uv"));
      count("glow", glows > 0);
      count("cipher", k.includes("cipher"));
      count("gadget", k.some((x) => GADGETS.includes(x)));
      count("hands", k.some((x) => HANDS_ON.includes(x)));
    }
    assert(planned >= ROOMS * 0.8, `${mode}: ${planned} planned`);
    share[mode] = Object.fromEntries(["uv", "glow", "cipher", "gadget", "hands"].map((key) => [key, (n[key] ?? 0) / planned]));
  }
  const report = JSON.stringify(share);
  for (const mode of MODES) {
    const s = share[mode];
    // UV is a crime scene's forensic tool now and then, and rare elsewhere; never most cases.
    assert(s.uv <= (mode === "crime_scene" ? 0.3 : 0.12), `${mode} UV: ${report}`);
    // Writing that glows or browns (UV, a lamp, a warmed letter) is in well under half of cases.
    assert(s.glow <= 0.45, `${mode} glow: ${report}`);
    assert(s.cipher <= 0.1, `${mode} cipher: ${report}`);
    assert(s.gadget >= (mode === "crime_scene" ? 0.3 : 0.4), `${mode} gadgets: ${report}`);
    assert(s.hands >= 0.55, `${mode} hands-on: ${report}`);
  }
});

Deno.test("distribution: the next case leans away from what the player's last cases featured", () => {
  const AHA: Featured[] = ["uv", "glow", "heat", "cipher", "mirror", "rub", "lens", "fold", "tune", "ribbon", "balance", "dial", "keys", "telephone"];
  const repeats = (withRecent: boolean) => {
    let pairs = 0, same = 0;
    for (let p = 0; p < 24; p++) {
      const inv = syntheticInventory(3000 + p, 9 + (p % 6));
      const history: Featured[][] = [];
      for (let c = 0; c < 4; c++) {
        const r = planRoom(inv, { mode: MODES[p % 3], seed: `seq${p}-${c}`, randomInt: seededRandomInt(p * 7 + c), recent: withRecent ? history : undefined });
        if (!r.ok) continue;
        const k = featuredKinds(r.definition).filter((x) => AHA.includes(x));
        if (history.length) {
          pairs++;
          if (k.some((x) => history[0].includes(x))) same++;
        }
        history.unshift(k);
      }
    }
    return same / pairs;
  };
  const without = repeats(false), withRecent = repeats(true);
  assert(withRecent < without * 0.8, `repeat rate ${withRecent.toFixed(2)} with the player's history, ${without.toFixed(2)} without`);
});

Deno.test("distribution: featuredKinds reads a case from its public definition; recentWeights weighs the last case most", () => {
  for (const [i, inv] of [FULL_15, BEDROOM_WITH_DOOR].entries()) {
    for (const mode of MODES) {
      const r = planRoom(inv, { mode, seed: `fk-${i}-${mode}`, randomInt: seededRandomInt(i) });
      assert(r.ok);
      const k = featuredKinds(r.definition);
      assertEquals(k.includes("cipher"), r.definition.items.some((x) => x.archetype === "Decoder"));
      assertEquals(k.includes("uv"), r.definition.items.some((x) => x.variant === "torch") || r.definition.objects.some((o) => o.trace || (o.archetype === "Light" && o.variant === "uv")));
      for (const c of r.definition.cards) if (c.reveal) assert(k.includes(c.reveal as Featured), c.reveal);
      // Junk from a stored row never throws.
      assertEquals(featuredKinds({ objects: undefined, items: [null as never], cards: [{} as never] }), []);
    }
  }
  const w = recentWeights([["uv", "cipher"], ["cipher", "tune"], ["lens"], ["fold"]]);
  assertEquals([w.get("uv"), w.get("cipher"), w.get("tune"), w.get("lens"), w.get("fold"), w.get("rub")], [0.25, 0.25, 0.5, 0.5, undefined, undefined]);
});
