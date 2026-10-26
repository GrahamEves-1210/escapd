// The play screen's physical materials (GAME_FEEL_PROMPT.md, 4: a diegetic
// play screen): the evidence tray's leather, felt and stitching, and the
// paper a clue is written on. Each mode has its own (ref.layout.play.evidence
// and .clue); outside a mode (the shell) noir's stand in.
import type { Genre } from "@/lib/puzzle-types";
import { ref } from "@/theme/tokens";

const P = ref.layout.play;

export type EvidenceMaterial = (typeof P.evidence.materials)[Genre];
export type CluePaper = (typeof P.clue.papers)[Genre];

export function evidenceMaterial(genre: Genre | null | undefined): EvidenceMaterial {
  return P.evidence.materials[genre ?? "noir"];
}

export function cluePaper(genre: Genre | null | undefined): CluePaper {
  return P.clue.papers[genre ?? "noir"];
}

/**
 * A torn paper edge as an SVG path in a 100 × `depth` box (drawn stretched to
 * the note's width), the paper below the tear. Deterministic per `seed`, so a
 * note keeps its tear across renders.
 */
export function tornEdge(seed: string, depth: number, teeth = 26): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const step = 100 / teeth;
  const points: string[] = [`M0 ${depth}`, `L0 ${(depth * 0.5).toFixed(2)}`];
  for (let i = 1; i < teeth; i++) {
    const x = i * step + (rand() - 0.5) * step * 0.6;
    const y = depth * (0.1 + rand() * 0.8);
    points.push(`L${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  points.push(`L100 ${(depth * 0.5).toFixed(2)}`, `L100 ${depth}`, "Z");
  return points.join(" ");
}
