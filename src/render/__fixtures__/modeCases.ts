// Test-only: a crime-scene and a paranormal case built on The Study's seed
// (its photos, hotspots and puzzles), so the player's per-mode screens can be
// driven with the same scripted server as the tutorial. Shapes follow the
// Part 1 templates: the accusation has no hotspot and requires evidence
// steps; paranormal hotspots carry an `effect`, one of them hidden.
import type { AccuseOption, PuzzleDefinitionV1, SessionState } from "@/lib/puzzle-types";
import { initialState, studyPublic } from "@/test-utils/seed";

export const SUSPECTS: AccuseOption[] = [
  { id: "s_ivy", name: "Ivy Marsh", role: "The housekeeper", alibi: "In the garden all evening." },
  { id: "s_tobias", name: "Tobias Reed", role: "The business partner", alibi: "On the late train home." },
  { id: "s_clara", name: "Clara Finch", role: "The niece", alibi: "Asleep upstairs by ten." },
];
export const MOTIVES: AccuseOption[] = [
  { id: "m_debt", name: "A debt he couldn't pay" },
  { id: "m_will", name: "A changed will" },
  { id: "m_secret", name: "A secret about to come out" },
];
export const METHODS: AccuseOption[] = [
  { id: "x_tea", name: "Poison in the tea" },
  { id: "x_stairs", name: "A push on the stairs" },
  { id: "x_pills", name: "Pills swapped in the bottle" },
];

/** The Study as a crime scene: its finale is an accusation that needs the key and the left note. */
export function crimeCase(): PuzzleDefinitionV1 {
  const study = studyPublic();
  return {
    ...study,
    genre: "crime_scene",
    title: "The Poisoned Toast",
    puzzles: [
      ...study.puzzles,
      {
        id: "name_the_killer",
        kind: "accuse",
        requires: ["find_key", "find_note_left"],
        title: "Name the killer",
        suspects: SUSPECTS,
        motives: MOTIVES,
        methods: METHODS,
      },
    ],
    exit: { requires: ["name_the_killer"], message: "The case is closed." },
  };
}

/** The Study haunted: five anomalies, the safe's hidden until the cabinet opens. */
export function paranormalCase(): PuzzleDefinitionV1 {
  const study = studyPublic();
  const effects: Record<string, NonNullable<PuzzleDefinitionV1["hotspots"][number]["effect"]>> = {
    desk_drawer: "flicker",
    bookshelf: "apparition",
    rug: "cold",
    cabinet: "moved",
    safe: "whisper",
  };
  return {
    ...study,
    genre: "paranormal",
    title: "The Cold Room",
    hotspots: study.hotspots.map((h) => (effects[h.id] ? { ...h, effect: effects[h.id] } : h)),
  };
}

export const crimeStart = (extra: Partial<SessionState> = {}): SessionState => ({ ...initialState(crimeCase()), contradicted: [], ...extra });

/** The evidence is in: the accusation's requires are solved. */
export const crimeReady = (extra: Partial<SessionState> = {}): SessionState => crimeStart({
  solved: ["find_key", "find_note_left"],
  inventory: ["brass_key", "torn_note_left"],
  contradicted: ["s_tobias"],
  ...extra,
});
