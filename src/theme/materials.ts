// Compartment linings, chosen from a hotspot's object_label. The drawer
// changes material; the clue itself always sits on a manila slip.
export type CompartmentMaterial =
  | "walnut_baize"
  | "riveted_gunmetal"
  | "manila_dossier"
  | "woven_linen"
  | "slate_specimen";

export interface Compartment {
  id: CompartmentMaterial;
  ground: string;
  inlay: string;
  rivets: boolean;
}

const COMPARTMENTS: Record<CompartmentMaterial, Compartment> = {
  walnut_baize: { id: "walnut_baize", ground: "#241910", inlay: "#1A2822", rivets: false },
  riveted_gunmetal: { id: "riveted_gunmetal", ground: "#1A1917", inlay: "#2C2926", rivets: true },
  manila_dossier: { id: "manila_dossier", ground: "#2A241C", inlay: "#3A3124", rivets: false },
  woven_linen: { id: "woven_linen", ground: "#231F1B", inlay: "#3A342C", rivets: false },
  slate_specimen: { id: "slate_specimen", ground: "#16181C", inlay: "#22262C", rivets: false },
};

const RULES: [RegExp, CompartmentMaterial][] = [
  [/drawer|desk|shelf|bookshelf|table|cabinet/, "walnut_baize"],
  [/safe|lock|door|keypad|latch|box/, "riveted_gunmetal"],
  [/note|book|painting|frame|mirror|clock|paper/, "manila_dossier"],
  [/rug|curtain|coat|bed|cushion|chair/, "woven_linen"],
];

export function compartmentFor(label: string | undefined): Compartment {
  const haystack = (label ?? "").toLowerCase();
  for (const [pattern, id] of RULES) {
    if (pattern.test(haystack)) return COMPARTMENTS[id];
  }
  return COMPARTMENTS.slate_specimen;
}
