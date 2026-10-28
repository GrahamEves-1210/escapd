// The planner's own words, in each mode's voice: what a player reads when no
// author call rewrites the room (rooms planned on the device from v1 rooms),
// and the originals the author call works from on the server.
//
// Rules every line here keeps:
//   - Cards are in-world findings (a matchbook, a lab report, a scrap of
//     paper), never a label ("Code: 374", "Page in the bookshelf: 267").
//   - No card names the object a value is for, or says what it is for: which
//     lock a code opens, which book a page is in, is the player's to work out.
//   - No digits outside {{slots}}: a stray number would read as a clue.
//   - Choices are deterministic from the caller's `pick` (a seeded stream).
import type { ObjectType } from "./taxonomy.ts";
import type { Mode } from "./types.ts";

export type Pick = <T>(xs: readonly T[]) => T;

/** Where a card's writing was found, which decides how it reads. */
export type Medium = "found" | "read" | "pages" | "lamp" | "uv" | "radio" | "assembled" | "decoded";

interface Frame { title: string; lead: string }
const f = (title: string, lead: string): Frame => ({ title, lead });

// ---------------------------------------------------------------------------
// Room header and ending
// ---------------------------------------------------------------------------
export const MODE_COPY: Record<Mode, { titles: string[]; objective: (exit: string) => string; endings: string[]; beat: string }> = {
  noir: {
    titles: ["The Long Night", "Last Call", "A Room With No Exit", "The Locked Room"],
    objective: (e) => `Somebody locked you in and left the combination scattered in pieces. Find every piece and walk out through the ${e}.`,
    endings: [
      "The last tumbler drops. Cold air, wet streets, a streetlight humming. Whoever locked you in is going to need a better lock.",
      "The lock gives with a tired click. You step out into the night and don't look back. Somebody owes you an explanation.",
    ],
    beat: "The tumblers fall into line.",
  },
  crime_scene: {
    titles: ["The Scene", "Cause of Death", "The Last Witness", "Chain of Custody"],
    objective: (e) => `Someone died in this room. Rule out what the evidence won't support, then name who did it, why and how at the ${e}.`,
    endings: [
      "The accusation holds. Every piece of evidence lines up behind it. Bag it, tag it, close the file.",
      "Motive, method, opportunity: it all fits, and only one way. The case is closed.",
    ],
    beat: "The accusation holds.",
  },
  paranormal: {
    titles: ["The Presence", "What Stays Behind", "The Quiet Hour", "Unfinished"],
    objective: (e) => `Something in this room wants a ritual finished. Learn its order from what the room gives up, then complete it at the ${e}.`,
    endings: [
      "The last offering settles. The air warms, the whispering stops, and the way out opens as if it was never shut.",
      "Something sighs, very close, and then nothing. The room is only a room again. You're free to go.",
    ],
    beat: "The air goes still.",
  },
};

// ---------------------------------------------------------------------------
// Cards: one value, written into a finding ("{v}" is the value)
// ---------------------------------------------------------------------------
const INLINE: Record<Mode, Record<Medium, Frame[]>> = {
  noir: {
    found: [
      f("Matchbook", "From a bar called the Blue Lantern. Inside the flap, in hurried pencil: {v}"),
      f("Pawn ticket", "One silver cigarette case, pawned and never collected. On the back, in pencil: {v}"),
      f("Cocktail napkin", "Lipstick on one corner. On the other, in blotted ink: {v}"),
      f("Envelope", "No stamp, no address, nothing inside. Pressed hard enough to dent the paper: {v}"),
      f("Betting slip", "A losing horse at long odds. Scrawled across the back: {v}"),
    ],
    read: [
      f("Pencil note", "Somebody's been here before you. Underlined twice, in pencil: {v}"),
      f("Scrawl", "Between the printed lines, in a different hand: {v}"),
    ],
    pages: [
      f("Between the pages", "A photograph marks the place, face down. On the back: {v}"),
      f("Between the pages", "A folded bar bill is tucked in there. Across the total, in pencil: {v}"),
    ],
    lamp: [f("In the light", "Writing that wasn't there a minute ago, raised in the glare: {v}")],
    uv: [f("Under UV", "Somebody's invisible ink, glowing violet now: {v}")],
    radio: [f("On the air", "Through the static, a man's voice repeats it, flat and tired: {v}")],
    assembled: [f("Taped note", "Edge to edge, the two halves finally say something: {v}")],
    decoded: [f("Decoded", "Line up the ring and the gibberish turns plain: {v}")],
  },
  crime_scene: {
    found: [
      f("Evidence bag", "Bagged at the scene, logged as loose paper. Written on it: {v}"),
      f("Receipt", "Crumpled, the print faded to nothing. Biro on the back: {v}"),
      f("Sticky note", "Half a fingerprint on the adhesive. In blue ink: {v}"),
      f("Index card", "Filed out of order. In the middle, in capitals: {v}"),
    ],
    read: [
      f("Annotation", "Circled in red, as if someone wanted it found: {v}"),
      f("Annotation", "A note in the victim's handwriting, pressed hard: {v}"),
    ],
    pages: [f("Between the pages", "Pressed flat at that page, a dry-cleaning tag. Inked on it: {v}")],
    lamp: [f("In the light", "Raking light picks out an indentation in the surface: {v}")],
    uv: [f("Under UV", "Under UV a latent trace lights up, written in something clear: {v}")],
    radio: [f("On the air", "Between stations, the police band crackles. The dispatcher repeats: {v}")],
    assembled: [f("Taped statement", "Fitted edge to edge, the torn statement gives a clean read: {v}")],
    decoded: [f("Decoded", "With the ring set, the cipher resolves: {v}")],
  },
  paranormal: {
    found: [
      f("Yellowed scrap", "Damp, and colder than the room. In a cramped, old-fashioned hand: {v}"),
      f("Child's drawing", "Crayon pressed so hard it tore the paper. Under the scribble: {v}"),
      f("Prayer card", "The saint's face has been scratched away. On the back: {v}"),
      f("Burnt letter", "Only one line survived the fire: {v}"),
    ],
    read: [
      f("Faded writing", "The ink has gone brown, but this much is still legible: {v}"),
      f("Faded writing", "Words you're sure weren't there when you first looked: {v}"),
    ],
    pages: [f("Between the pages", "The pages fall open there by themselves. Beside a pressed lily, in the gutter: {v}")],
    lamp: [f("In the light", "When the light comes on, letters breathe up through the surface: {v}")],
    uv: [f("Under UV", "Under the violet light, something traced by a fingertip: {v}")],
    radio: [f("On the air", "Under the hiss, a child's voice, counting slowly: {v}")],
    assembled: [f("Mended page", "Pressed together, the torn edges knit. It reads: {v}")],
    decoded: [f("Decoded", "Turn the ring and the nonsense rearranges itself: {v}")],
  },
};

// ---------------------------------------------------------------------------
// Cards: several lines (crime-scene evidence, ritual fragments)
// ---------------------------------------------------------------------------
const LIST: Record<Mode, Record<Medium, Frame[]>> = {
  noir: {
    found: [f("Notes", "Somebody's notes, in a cramped hand:")],
    read: [f("Notes", "Between the printed lines, in a different hand:")],
    pages: [f("Between the pages", "A folded sheet marks the place:")],
    lamp: [f("In the light", "Raised in the glare:")],
    uv: [f("Under UV", "Glowing violet:")],
    radio: [f("On the air", "Through the static:")],
    assembled: [f("Taped note", "Edge to edge, the halves read:")],
    decoded: [f("Decoded", "Plain at last:")],
  },
  crime_scene: {
    found: [
      f("Case notes", "Clipped together, initialled by the first officer on scene."),
      f("Field report", "Typed up overnight, coffee ring on the corner."),
      f("Evidence summary", "From the lab, marked preliminary."),
    ],
    read: [f("Officer's notebook", "Notes from the first canvass.")],
    pages: [f("Between the pages", "A folded statement, filed at that page.")],
    lamp: [f("In the light", "Pressed into the surface, legible only now: notes written on a sheet that's long gone.")],
    uv: [f("Under UV", "Under UV, notes written in invisible ink light up:")],
    radio: [f("On the air", "The police band, between stations. A dispatcher reads out updates.")],
    assembled: [f("Taped statement", "Taped back together, the statement reads:")],
    decoded: [f("Decoded", "With the ring set, the coded notes read:")],
  },
  paranormal: {
    found: [
      f("Yellowed scrap", "In a cramped, old hand, the ink gone brown:"),
      f("Scratched card", "Scratched with a pin, the letters shaking:"),
      f("Child's drawing", "Crayon pressed through the paper, in a careful list:"),
    ],
    read: [f("Faded writing", "Words that weren't there when you first looked:")],
    pages: [f("Between the pages", "The pages fall open there by themselves. In the gutter:")],
    lamp: [f("In the light", "When the light comes on, words breathe up through the surface:")],
    uv: [f("Under UV", "Under the violet light, something traced by a fingertip:")],
    radio: [f("On the air", "Under the hiss, a child's voice, reciting:")],
    assembled: [f("Mended page", "Pressed together, the torn edges knit. It reads:")],
    decoded: [f("Decoded", "Turn the ring and the nonsense rearranges itself:")],
  },
};

/** A card's title and text: `values` are the value phrases (each with its {{slot}}). */
export function writeCard(mode: Mode, medium: Medium, values: string[], list: boolean, pick: Pick): { title: string; text: string } {
  const frame = pick((list ? LIST : INLINE)[mode][medium]);
  if (list) return { title: frame.title, text: `${frame.lead}\n${values.join("\n")}` };
  const v = values.join(", ");
  return { title: frame.title, text: frame.lead.replace("{v}", /[.!?]$/.test(v) ? v : `${v}.`) };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export const ITEM_NAMES: Record<Mode, { key: string; halves: [string, string]; joined: string; torch: string; wheel: string }> = {
  noir: { key: "Brass key", halves: ["Torn note (left)", "Torn note (right)"], joined: "Taped note", torch: "UV flashlight", wheel: "Cipher wheel" },
  crime_scene: { key: "Small key", halves: ["Torn statement (left)", "Torn statement (right)"], joined: "Taped statement", torch: "UV flashlight", wheel: "Cipher wheel" },
  paranormal: { key: "Iron key", halves: ["Torn page (left)", "Torn page (right)"], joined: "Mended page", torch: "UV flashlight", wheel: "Cipher wheel" },
};

/** "wall clock" -> "Wall clock": an item's display name from an object label. */
export const capitalise = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Optional story fragments: a card found somewhere, never needed. */
export const KEEPSAKES: Record<Mode, Frame[]> = {
  noir: [
    f("Photograph", "A woman in a fur collar, laughing at someone outside the frame. On the back, only a lipstick kiss."),
    f("Telegram", "COME BACK STOP ALL IS FORGIVEN STOP. Never sent. Folded small enough to hide in a fist."),
  ],
  crime_scene: [
    f("Personal effect", "A wedding ring. Whatever was engraved inside has been filed away."),
    f("Personal effect", "A theatre stub for two. Only one half was ever torn off at the door."),
  ],
  paranormal: [
    f("Locket", "Inside, a curl of fair hair tied with thread. It's warm, as if someone just let go of it."),
    f("Christening spoon", "Tarnished black, except where a small thumb has polished it bright."),
  ],
};

// ---------------------------------------------------------------------------
// Crime scene: suspects, motives and methods, and what rules each out
// ---------------------------------------------------------------------------
export const SUSPECTS = [
  "Vera Lake", "Arthur Penrose", "Delia Marsh", "Felix Crane", "Ruth Calloway", "Silas Whitlock",
  "June Harrow", "Otto Brandt", "Mabel Quill", "Edmund Fairley",
];

/** Alibis: each puts {{s}} somewhere else when it happened. */
export const ALIBIS = [
  "Hotel register: {{s}} checked in across town before dark and never came back down.",
  "Two witnesses, statements taken separately: {{s}} was at the bridge club all evening.",
  "A timed till receipt and the shop's camera put {{s}} at the other end of the city when it happened.",
  "Ward log: {{s}} was admitted overnight for observation and never left the bed.",
  "The night-train conductor remembers {{s}}: aboard the whole way, hundreds of miles from here.",
  "Custody record: {{s}} spent the night in a holding cell for an unrelated brawl.",
];

/** Motives, each with the finding that rules it out ({{s}} is its name). */
export const MOTIVES: { name: string; ruleOut: string }[] = [
  { name: "Inheritance", ruleOut: "The solicitor confirms the will left everything to charity. Nobody stood to inherit. {{s}}: ruled out." },
  { name: "Gambling debts", ruleOut: "Bank records are spotless: no loans, no markers, no one owed a thing. {{s}}: ruled out." },
  { name: "Jealousy", ruleOut: "The love letters in the bin are from the victim's sister, not a lover. {{s}}: ruled out." },
  { name: "Blackmail", ruleOut: "The deposit box was empty: no photographs, no ledger, nothing to hold over anyone. {{s}}: ruled out." },
  { name: "Revenge", ruleOut: "The old feud was settled in court years ago, a signed truce on file. {{s}}: ruled out." },
  { name: "Insurance money", ruleOut: "The policy lapsed last spring and was never renewed. {{s}}: ruled out." },
];

/** Methods, each with the finding that rules it out. */
export const METHODS: { name: string; ruleOut: string }[] = [
  { name: "Poison", ruleOut: "Toxicology came back clean: no drugs, no toxins. {{s}}: ruled out." },
  { name: "Strangling", ruleOut: "No ligature marks, no bruising at the throat. {{s}}: ruled out." },
  { name: "A blunt instrument", ruleOut: "No fractures and no blunt-force trauma anywhere on the body. {{s}}: ruled out." },
  { name: "A blade", ruleOut: "No puncture wounds, and every knife in the house is accounted for and clean. {{s}}: ruled out." },
  { name: "A gunshot", ruleOut: "No wound, no residue, and nobody nearby heard a shot. {{s}}: ruled out." },
  { name: "A staged fall", ruleOut: "The dust on the stairs is undisturbed and the body shows no fall injuries. {{s}}: ruled out." },
];

// ---------------------------------------------------------------------------
// Paranormal: the ritual's objects, described by what they are, never named
// ---------------------------------------------------------------------------
const ORDINAL = ["First", "Second", "Third", "Fourth", "Fifth"];
const ROMAN = ["I", "II", "III", "IV", "V"];
export const ordinalLine = (k: number, ref: string): string => `${ORDINAL[k] ?? `Then`}, ${ref}.`;
export const romanMark = (k: number, ref: string): string => `${ROMAN[k] ?? ""} · ${ref}`;

/** Words in a label that describe the thing better than its type does. */
const BY_LABEL: [RegExp, string][] = [
  [/\bdrawers?\b/, "what slides out of the dark"],
  [/\bsafe\b/, "what guards what was precious"],
];

const BY_TYPE: Partial<Record<ObjectType, string>> = {
  wall_clock: "the face that keeps the hours", alarm_clock: "the face that keeps the hours",
  desk_lamp: "what holds the light", floor_lamp: "what holds the light", ceiling_light: "what holds the light", string_lights: "what holds the light",
  bookshelf: "where the books stand in rows", shelf: "what holds things up off the floor",
  book: "the pages someone read too often", book_stack: "the pages someone read too often", notebook: "where someone wrote their thoughts down",
  magazine: "the pages someone read too often",
  desk: "where the letters were written", table: "where things are set down", coffee_table: "where things are set down",
  side_table: "where things are set down", nightstand: "what stands beside the sleeper",
  dresser: "where the folded clothes are kept", filing_cabinet: "where the papers are filed away",
  wardrobe: "where the clothes still hang", cabinet: "what hides behind its doors", sideboard: "what hides behind its doors",
  bed: "where someone slept", sofa: "where someone sat and waited", armchair: "where someone sat and waited",
  chair: "where someone sat and waited", stool: "where someone sat and waited", bench: "where someone sat and waited",
  ottoman: "where tired feet rested", tv_stand: "where the screen goes dark",
  chest: "what was packed and closed", trunk: "what was packed and closed", box: "what was packed and closed",
  suitcase: "what was packed and never taken", basket: "what holds and carries", jar: "what was sealed tight",
  safe: "what guards what was precious", toolbox: "what holds the tools", bag: "what was carried out and back",
  pillow: "where a head once rested", cushion: "where a head once rested", rug: "what lies flat on the floor",
  curtain: "what keeps the window", blanket: "what kept the cold away", towel: "what dried the hands",
  framed_picture: "the face behind the glass", poster: "what's pinned to the wall", mirror: "the glass that looks back",
  noticeboard: "where notes are pinned", calendar: "where the days are counted", map: "where the roads are drawn",
  radio: "the voice in the box", speaker: "the voice in the box", record_player: "what once played music",
  typewriter: "the keys that wrote", fan: "what stirs the air", telephone: "what rings when no one calls",
  guitar: "the strings no one plays", keyboard_instrument: "the keys no one plays", violin: "the strings no one plays",
  drum: "what was beaten", vase: "what held the flowers", candle: "the flame that waits", trophy: "the prize someone won",
  globe: "the whole world, made small", figurine: "the little watcher", mug: "what held something warm", bottle: "what was emptied",
  plant_pot: "the living green thing", potted_plant: "the living green thing",
};

/** How a ritual card names an object without naming it, or null when nothing fits. */
export function describeObject(type: ObjectType, label: string): string | null {
  const text = label.toLowerCase();
  for (const [re, phrase] of BY_LABEL) if (re.test(text)) return phrase;
  return BY_TYPE[type] ?? null;
}
