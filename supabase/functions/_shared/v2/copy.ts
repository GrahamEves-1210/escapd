// The planner's own words, in each mode's voice: what a player reads when no
// author call rewrites the room (rooms planned on the device from v1 rooms),
// and the originals the author call works from on the server. Every line is
// pre-written here, with fill-in slots; the planner picks and fills them
// deterministically, so a room reads well whether or not a model touches it.
//
// Rules every line here keeps:
//   - Cards are in-world things (a train ticket, a hotel register, a lab
//     report, a coroner's note), never a label ("Code: 374", "Page in the
//     bookshelf: 267") and never a conclusion ("ruled out"): the player reads
//     the evidence and draws the inference.
//   - Names are plain and concrete ("Train ticket", "Wedding ring"), never
//     jargon ("Personal effect").
//   - No card names the object a value is for, or says what it is for: which
//     lock a code opens, which book a page is in, is the player's to work out.
//   - No digits outside {{slots}}: a stray number would read as a clue.
//   - Choices are deterministic from the caller's `pick` (a seeded stream).
import type { ObjectType } from "./taxonomy.ts";
import type { Mode, OrderRule, SlotKind, TraceHand, TraceKind, TracePattern, TraceSize, TraceTread } from "./types.ts";

export type Pick = <T>(xs: readonly T[]) => T;

/** Where a card's writing was found, which decides how it reads. */
export type Medium = "found" | "read" | "pages" | "lamp" | "uv" | "radio" | "assembled" | "decoded" | "heat" | "mirror" | "rub" | "lens" | "fold" | "tune" | "ribbon" | "phone";

export interface Frame { title: string; lead: string }
const f = (title: string, lead: string): Frame => ({ title, lead });

// ---------------------------------------------------------------------------
// The case: its label, objective, brief and ending
// ---------------------------------------------------------------------------
/** Crime scene: when it happened. Stated in the objective and the brief; the alibis are read against it. */
export const TIME_OF_DEATH = "close to midnight";

/** The dead, in a crime-scene case (never one of the suspects). */
export const VICTIMS = ["Harold Vane", "Lionel Ashby", "Cora Whitcombe", "Ida Fenwick", "Conrad Mayhew", "Beatrice Lowell"];

export interface BriefFacts { exit: string; victim?: string }

export const MODE_COPY: Record<Mode, {
  /** The mode's series line (the journal's cover says the same). */
  series: string;
  objective: (exit: string) => string;
  briefs: ((f: BriefFacts) => string)[];
  endings: string[];
}> = {
  noir: {
    series: "A Detective Noir Mystery",
    objective: (e) => `Somebody locked you in and left the combination scattered in pieces. Find every piece and walk out through the ${e}.`,
    briefs: [
      (b) => `You came up here to meet a client who never showed. Somebody shut the ${b.exit} behind you and left the combination in this room, in pieces. You're a private eye with a flashlight and a bad feeling: find every piece and walk out.`,
      (b) => `The note said come alone, after dark. You did both, and now the ${b.exit} is locked from the outside. Whoever wrote it hid the combination here, a piece at a time, so you'd have to work for it. Find them all before they come back.`,
    ],
    endings: [
      "The last tumbler drops. Cold air, wet streets, a streetlight humming. Whoever locked you in is going to need a better lock.",
      "The lock gives with a tired click. You step out into the night and don't look back. Somebody owes you an explanation.",
    ],
  },
  crime_scene: {
    series: "A True Crime Club Mystery",
    objective: (e) => `Someone died here ${TIME_OF_DEATH}. Rule out what the evidence won't support, then name who, why and how at the ${e}.`,
    briefs: [
      (b) => `${b.victim} was found dead in this room this morning. The coroner puts the death ${TIME_OF_DEATH}. You're the detective on the case, and three names are on the board. Work through what's here, cross off what the evidence won't support, and make your accusation at the ${b.exit}.`,
      (b) => `The call came in at dawn: ${b.victim}, dead in this room, and nobody saw a thing. The coroner puts it ${TIME_OF_DEATH}. Every document and trace in here tells you something about the three people who had reason to be here. Read them closely, then name who did it, why and how at the ${b.exit}.`,
    ],
    endings: [
      "The accusation holds. Every piece of evidence lines up behind it. Bag it, tag it, close the file.",
      "Motive, method, opportunity: it all fits, and only one way. The case is closed.",
    ],
  },
  paranormal: {
    series: "A Moonlit Mystery",
    objective: (e) => `Something in this room wants a ritual finished. Learn its order from what the room gives up, then complete it at the ${e}.`,
    briefs: [
      (b) => `The family moved out after the third night and won't say why. You're the one they call when a house won't settle. Something in this room wants a ritual finished, in the right order, and the room will tell you how, a piece at a time. Finish it at the ${b.exit} and it will let you go.`,
      (b) => `Nobody has slept in this room for years, and still the bed is warm in the mornings. You've come to put whatever stays here to rest. It wants its offerings made in a certain order: learn the order from what the room gives up, and complete it at the ${b.exit}.`,
    ],
    endings: [
      "The last offering settles. The air warms, the whispering stops, and the way out opens as if it was never shut.",
      "Something sighs, very close, and then nothing. The room is only a room again. You're free to go.",
    ],
  },
};

/** The case's neutral label, from its seed: "Case no. 04127" (five digits: never a lock's length). */
export function caseLabel(seed: string | number): string {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `Case no. ${String((h >>> 0) % 100000).padStart(5, "0")}`;
}

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
      f("Pencil note", "Underlined twice, in soft pencil: {v}"),
      f("Margin note", "Between the printed lines, in a different hand: {v}"),
    ],
    pages: [
      f("Photograph", "Marking the place, a photograph, face down. On the back: {v}"),
      f("Bar bill", "Folded in at that page, a bar bill. Across the total, in pencil: {v}"),
    ],
    lamp: [f("Writing in the light", "{v}")],
    uv: [f("Invisible ink", "{v}")],
    radio: [f("Radio", "A man's voice through the static, flat and tired: {v}")],
    assembled: [f("Taped note", "{v}")],
    decoded: [f("Decoded note", "{v}")],
    heat: [f("Lemon-juice letter", "{v}")],
    mirror: [f("Mirror writing", "{v}")],
    rub: [f("Pencil rubbing", "{v}")],
    lens: [f("Through the red lens", "{v}")],
    fold: [f("Folded page", "{v}")],
    tune: [f("Music box", "{v}")],
    ribbon: [f("Typewriter ribbon", "{v}")],
    phone: [f("Telephone", "A woman's voice on the line, low and quick: {v}")],
  },
  crime_scene: {
    found: [
      f("Evidence bag", "Bagged at the scene, logged as loose paper. Written on it: {v}"),
      f("Receipt", "Crumpled, the print faded to nothing. Biro on the back: {v}"),
      f("Sticky note", "Half a fingerprint on the adhesive. In blue ink: {v}"),
      f("Index card", "Filed out of order. In the middle, in capitals: {v}"),
    ],
    read: [
      f("Margin note", "Circled in red: {v}"),
      f("Margin note", "Pencilled in the margin and circled twice: {v}"),
    ],
    pages: [f("Dry-cleaning tag", "Pressed flat at that page, a dry-cleaning tag. Inked on it: {v}")],
    lamp: [f("Indented writing", "{v}")],
    uv: [f("Invisible ink", "{v}")],
    radio: [f("Police radio", "The police band, between stations. The dispatcher: {v}")],
    assembled: [f("Taped statement", "{v}")],
    decoded: [f("Decoded note", "{v}")],
    heat: [f("Lemon-juice note", "{v}")],
    mirror: [f("Mirror writing", "{v}")],
    rub: [f("Pencil rubbing", "{v}")],
    lens: [f("Through the red lens", "{v}")],
    fold: [f("Folded page", "{v}")],
    tune: [f("Music box", "{v}")],
    ribbon: [f("Typewriter ribbon", "{v}")],
    phone: [f("Telephone", "The exchange operator, reading back a message left for this number: {v}")],
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
      f("Faded writing", "In a small, careful hand, pressed hard: {v}"),
    ],
    pages: [f("Pressed lily", "Beside a pressed lily, in the gutter of the page: {v}")],
    lamp: [f("Writing in the light", "{v}")],
    uv: [f("Finger-writing", "{v}")],
    radio: [f("Radio", "A child's voice under the hiss, counting slowly: {v}")],
    assembled: [f("Mended page", "{v}")],
    decoded: [f("Decoded note", "{v}")],
    heat: [f("Lemon-juice page", "{v}")],
    mirror: [f("Mirror writing", "{v}")],
    rub: [f("Pencil rubbing", "{v}")],
    lens: [f("Through the red lens", "{v}")],
    fold: [f("Folded page", "{v}")],
    tune: [f("Music box", "{v}")],
    ribbon: [f("Typewriter ribbon", "{v}")],
    phone: [f("Telephone", "A child's voice down the line, very far away: {v}")],
  },
};

/**
 * Documents that carry one value of a kind (a page on a library slip, a code on a padlock receipt), for
 * writing found or read: a value of a kind with documents is always on one of them, so a number has a
 * reason to be written down. Never a word about what it's for. (Times: TIME_DOCS.)
 */
type DocKind = Exclude<SlotKind, "option" | "object" | "time">;
const DOCS: Record<Mode, Partial<Record<DocKind, Frame[]>>> = {
  noir: {
    freq: [
      f("Matchbook", "From the Blue Lantern. Inside the flap, in lipstick: Tune in, {v}, after midnight"),
      f("Taxi log", "A page from a cab dispatcher's log. One line circled twice: Night car, call in on {v}"),
    ],
    page: [
      f("Library slip", "A city library slip, long overdue. Pencilled under the date stamp: {v}"),
      f("Pawn ticket", "For one leather-bound volume, never collected. On the back, in a neat hand: see {v}"),
      f("Bookmark", "A cheap leather bookmark, the tassel chewed. Inked on the end: {v}"),
    ],
    digits: [
      f("Luggage tag", "A brass-eyed tag from a suitcase that never arrived. Inked where the room number goes: {v}"),
      f("Hotel bill", "From a cheap hotel down by the docks. Torn off the bottom, in the clerk's hand: {v}"),
      f("Cloakroom ticket", "From the Blue Lantern's coat check, never redeemed. Punched through the middle: {v}"),
      f("Pawn ticket", "One silver cigarette case, pawned and never collected. Stamped in red where the number goes: {v}"),
    ],
    code: [
      f("Hardware receipt", "For one padlock, paid in cash, no name given. Scrawled across the back: {v}"),
      f("Shoeshine stub", "A shoeshine stand's ticket. On the back, in pencil, pressed hard: {v}"),
      f("Matchbook", "From a bar called the Blue Lantern. Inside the flap, in hurried pencil: {v}"),
    ],
    offset: [f("Pocket diary", "Every page blank but one, and on it, circled: {v}")],
    cipher: [f("Telegram", "Delivered, never opened until now. The whole message: {v}")],
    phone: [
      f("Matchbook", "From the Blue Lantern, two matches left. Inside the flap, in lipstick, a telephone number: {v}"),
      f("Calling card", "No name on it, only a line of print: Night line {v}"),
    ],
  },
  crime_scene: {
    freq: [
      f("Dispatch slip", "Torn from the dispatcher's pad, in the night sergeant's capitals: Night channel, {v}"),
      f("Scanner log", "The victim's scanner log. One channel, ringed twice: {v}"),
    ],
    page: [
      f("Library slip", "A library slip the inspector clipped to the evidence list. Pencilled under the date stamp, in the inspector's hand: {v}"),
      f("Index card", "From the inspector's card index on the case. One line only: see {v}"),
    ],
    digits: [f("Luggage tag", "Torn from the victim's case. Where the room goes, in the victim's hand: {v}")],
    code: [
      f("Receipt", "From a locksmith across town, for one padlock. On the back, in biro: {v}"),
      f("Phone bill", "The victim's, unpaid. Written in the margin and boxed twice: {v}"),
      f("Sticky note", "Half a fingerprint on the adhesive. In blue ink, boxed: {v}"),
    ],
    offset: [f("Diary page", "The victim's diary, one entry only, and only this: {v}")],
    cipher: [f("Postcard", "No picture, no signature. Just one line in capitals: {v}")],
    phone: [
      f("Message pad", "The pad kept by the telephone. The last message taken down: Please ring back, {v}"),
      f("Address book", "The victim's, open at a page with one entry and no name: {v}"),
    ],
  },
  paranormal: {
    freq: [
      f("Wireless log", "A page from an old wireless log, the ink gone brown. One line, underlined: {v}"),
      f("Séance notes", "Pencil notes from a séance in this room. One line, underlined twice: the voice comes on {v}"),
    ],
    page: [
      f("Hymn sheet", "Torn from a pew. Ringed in pencil at the foot: {v}"),
      f("Bookmark", "A black ribbon bookmark, frayed at the end. Stitched into it in white thread: {v}"),
    ],
    digits: [f("Christening card", "Lace edges gone grey. Inside, where the name should be: {v}")],
    code: [
      f("Sampler", "A child's cross-stitch, unfinished. The last row, in black thread: {v}"),
      f("Slate", "A child's school slate. Chalked on it, and never rubbed out: {v}"),
    ],
    offset: [f("Diary page", "A girl's diary, one line on an empty page: {v}")],
    cipher: [f("Burnt letter", "Only one line survived the fire: {v}")],
    phone: [
      f("Visiting card", "Black-edged, the name rubbed away. Under it, in a child's pencil: {v}"),
      f("Wall calendar leaf", "A torn-off day. On the back, in a round hand: ring {v}"),
    ],
  },
};

/** Where a safe's three numbers are written down: by whoever couldn't trust their memory with them. */
export const DIAL_DOCS: Record<Mode, Frame[]> = {
  noir: [
    f("Matchbook", "From the Blue Lantern. Inside the flap, three numbers in a careful hand: {v}"),
    f("Betting slip", "A losing horse at long odds. Along the bottom edge, small and neat: {v}"),
  ],
  crime_scene: [
    f("Diary page", "The victim's pocket diary, the last page. No words, only: {v}"),
    f("Locksmith's card", "From the firm that fitted the safe. Pencilled on the back by the fitter: {v}"),
  ],
  paranormal: [
    f("Flyleaf", "Torn from a prayer book. Inside the cover, in faded ink: {v}"),
    f("Sampler", "A child's cross-stitch, unfinished. The last row, in black thread: {v}"),
  ],
};

/**
 * A time that sets a clock is never the bare value: a document gives a time (`lead`, `{v}`), and a
 * second fact (`rel`, `{d}` an amount of time in words) says how far the moment that matters was from
 * it. The clock wants that moment, so the player combines the two. `brief`: the time when it is
 * written somewhere other than on the document itself (a radio voice, a glow, a trace). `sign`: the
 * moment is after (+1) or before (-1) the written time.
 */
export interface TimeDoc { title: string; lead: string; brief: string; rel: string; sign: 1 | -1 }
const td = (title: string, lead: string, brief: string, rel: string, sign: 1 | -1 = 1): TimeDoc => ({ title, lead, brief, rel, sign });
export const TIME_DOCS: Record<Mode, TimeDoc[]> = {
  noir: [
    td("Train ticket", "A third-class single for the last train out, punched once by the guard. Departure, printed in the corner: {v}", "the last train, {v}",
      "The last train never leaves on time. It pulls out {d} after the time on the ticket."),
    td("Theatre ticket", "Stalls, the seat number torn away. Curtain up, stamped across it in purple: {v}", "curtain up at {v}",
      "The curtain went up {d} late that night. Somebody kept the whole house waiting."),
    td("Telegram", "ARRIVING ON THE LATE TRAIN STOP MEET ME AT {v} STOP COME ALONE STOP", "meet at {v}",
      "He turned up to the meeting {d} late. He always does."),
  ],
  crime_scene: [
    td("Parking ticket", "Issued on the street outside. The warden's time, written in the box: {v}", "the warden's ticket, {v}",
      "From the traffic office: that warden's watch was found to run {d} fast.", -1),
    td("Platform ticket", "A platform ticket, clipped by the inspector. Stamped in purple: {v}", "platform ticket stamped {v}",
      "The stationmaster's note: the platform clock ran {d} slow all that week."),
  ],
  paranormal: [
    td("Mourning card", "Black-edged, for a child. The hour of passing, in copperplate: {v}", "she passed at {v}",
      "They rang the bell {d} after she passed, and stopped every clock in the house on its last stroke."),
    td("Parish register", "A page torn from the parish register. Beside a burial, the hour it began, underlined: {v}", "the burial began at {v}",
      "The bell was tolled only when the last earth was in, {d} after the burial began."),
  ],
};

/** How the second fact about a time is written: on the same document, or on another card ("carrier"). */
export const TIME_REL_LEAD: Record<Mode, { same: string; carrier: string }> = {
  noir: { same: "Pencilled underneath: \"{r}\"", carrier: "On the back, in another hand: \"{r}\"" },
  crime_scene: { same: "Paper-clipped to it: {r}", carrier: "Paper-clipped to it, a second note: {r}" },
  paranormal: { same: "Beneath, fainter: {r}", carrier: "And at the very bottom, fainter, as if added later: {r}" },
};

/** Amounts of time in words (minutes): never digits on a card. */
export const DURATIONS: [number, string][] = [
  [15, "a quarter of an hour"], [20, "twenty minutes"], [25, "twenty-five minutes"], [30, "half an hour"], [40, "forty minutes"],
  [45, "three quarters of an hour"], [50, "fifty minutes"], [60, "an hour"], [75, "an hour and a quarter"], [90, "an hour and a half"],
];

// ---------------------------------------------------------------------------
// Cards: several lines (crime-scene evidence, ritual fragments)
// ---------------------------------------------------------------------------
const LIST: Record<Mode, Record<Medium, Frame[]>> = {
  noir: {
    found: [f("Notes", "Somebody's notes, in a cramped hand:")],
    read: [f("Notes", "Between the printed lines, in a different hand:")],
    pages: [f("Folded sheet", "A folded sheet marks the place:")],
    lamp: [f("Writing in the light", "")],
    uv: [f("Invisible ink", "")],
    radio: [f("Radio", "A man's voice through the static:")],
    assembled: [f("Taped note", "")],
    decoded: [f("Decoded note", "")],
    heat: [f("Lemon-juice letter", "")],
    mirror: [f("Mirror writing", "")],
    rub: [f("Pencil rubbing", "")],
    lens: [f("Through the red lens", "")],
    fold: [f("Folded page", "")],
    tune: [f("Music box", "")],
    ribbon: [f("Typewriter ribbon", "")],
    phone: [f("Telephone", "A woman's voice on the line, low and quick:")],
  },
  crime_scene: {
    found: [
      f("Evidence envelope", "Sealed at the scene and signed across the flap. Clipped together inside:"),
      f("Case file", "The inspector's file, still thin. The pages so far:"),
      f("Lab envelope", "From the lab, marked preliminary. Inside:"),
    ],
    read: [f("Inspector's notebook", "Notes from the first night's enquiries, in pencil:")],
    pages: [f("Case papers", "Folded in at that page, a few sheets from the case file:")],
    lamp: [f("Inspector's notes, pressed through", "")],
    uv: [f("Inspector's notes, pressed through", "")],
    radio: [f("Police radio", "The police band, between stations. The dispatcher reads out the night's checks:")],
    assembled: [f("Taped statement", "")],
    decoded: [f("Decoded note", "")],
    heat: [f("Lemon-juice note", "")],
    mirror: [f("Mirror writing", "")],
    rub: [f("Pencil rubbing", "")],
    lens: [f("Through the red lens", "")],
    fold: [f("Folded page", "")],
    tune: [f("Music box", "")],
    ribbon: [f("Typewriter ribbon", "")],
    phone: [f("Telephone", "The exchange operator, reading back messages left for this number:")],
  },
  paranormal: {
    found: [
      f("Yellowed scrap", "In a cramped, old hand, the ink gone brown:"),
      f("Scratched card", "Scratched with a pin, the letters shaking:"),
      f("Child's drawing", "Crayon pressed through the paper, in a careful list:"),
      f("Diary page", "From a girl's diary: Mama says we must do it in the right order, or it won't rest. She wrote down what she knew:"),
      f("Séance notes", "Notes from a séance held in this room, the pencil shaking:"),
    ],
    read: [f("Faded writing", "In a small, careful hand, pressed hard:")],
    pages: [f("Pressed lily", "Beside a pressed lily, in the gutter of the page:")],
    lamp: [f("Writing in the light", "")],
    uv: [f("Finger-writing", "")],
    radio: [f("Radio", "A child's voice under the hiss, reciting:")],
    assembled: [f("Mended page", "")],
    decoded: [f("Decoded note", "")],
    heat: [f("Lemon-juice page", "")],
    mirror: [f("Mirror writing", "")],
    rub: [f("Pencil rubbing", "")],
    lens: [f("Through the red lens", "")],
    fold: [f("Folded page", "")],
    tune: [f("Music box", "")],
    ribbon: [f("Typewriter ribbon", "")],
    phone: [f("Telephone", "A child's voice down the line, very far away:")],
  },
};

/**
 * A card's title and text: `values` are the value phrases (each with its {{slot}}); `kind`: a lone
 * value's kind; `doc`: the document a lone value is written on (a time's ticket). A lone value of a kind
 * with documents, found or read, is on one of them. Writing that came to light (under a lamp, in a
 * mirror, taped together) is only the writing: the player watched it appear.
 */
export function writeCard(mode: Mode, medium: Medium, values: string[], list: boolean, pick: Pick, kind?: SlotKind, doc?: Frame): { title: string; text: string } {
  const docs = !list && (medium === "found" || medium === "read") ? (doc ? [doc] : kind ? DOCS[mode][kind as DocKind] ?? [] : []) : [];
  const frame = pick(docs.length ? docs : (list ? LIST : INLINE)[mode][medium]);
  if (list) return { title: frame.title, text: [...(frame.lead ? [frame.lead] : []), ...values].join("\n") };
  const v = values.join(", ");
  // A full stop after the value only when the value ends the sentence ("MEET ME AT {v} STOP" needs none).
  const end = frame.lead.endsWith("{v}") && !/[.!?"]$/.test(v) ? "." : "";
  return { title: frame.title, text: frame.lead.replace("{v}", `${v}${end}`) };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export const ITEM_NAMES: Record<Mode, { key: string; halves: [string, string]; joined: string; torch: string; wheel: string; letter: Frame; backwards: Frame; pad: Frame; pencil: Frame; printed: Frame; lens: Frame; fold: Frame;
  musicBox: Frame; ribbon: Frame; soap: string; balance: Frame; weight: Frame }> = {
  noir: {
    key: "Brass key", halves: ["Torn note (left)", "Torn note (right)"], joined: "Taped note", torch: "UV flashlight", wheel: "Cipher wheel",
    // What each says when found is the clue to how it reads (no value on it yet).
    letter: f("Blank letter", "Good notepaper, folded twice, with nothing written on it. It smells faintly of lemons."),
    backwards: f("Backwards note", "One line in a looping hand, every letter written back to front."),
    pad: f("Notepad", "A hotel notepad, the top sheet torn clean off. The page beneath looks blank, but tilt it and the dents of somebody's hard pen catch the light."),
    pencil: f("Soft pencil", "A soft pencil, chewed at one end and worn to a stub."),
    printed: f("Printed card", "A novelty card from a spy kit, printed in a jumble of red and blue letters that spell nothing. The small print says: see it through red."),
    lens: f("Red lens", "A square of red gel in a cardboard frame, the kind that comes in a spy kit."),
    fold: f("Fold-in page", "A page torn from a magazine, with half a line of writing down each edge and two small marks, A and B. The caption says: fold so A meets B."),
    // What each is; nothing about what to do with it.
    musicBox: f("Music box", "A small music box with its lid gone, a brass cylinder under a comb of six teeth. Each tooth is stamped with a mark."),
    ribbon: f("Typewriter ribbon", "A spool of black typewriter ribbon, run through once and wound back."),
    soap: "Bar of soap",
    balance: f("Pocket balance", "A jeweller's pocket balance in a worn case, two pans on a brass beam. Engraved inside the lid: the heaviest leads."),
    weight: f("Brass weight", "A brass weight the size of a thimble, stamped {m}."),
  },
  crime_scene: {
    key: "Small key", halves: ["Torn statement (left)", "Torn statement (right)"], joined: "Taped statement", torch: "UV flashlight", wheel: "Cipher wheel",
    letter: f("Blank letter", "A sheet of good paper, blank, but stiff in places, as if something clear dried on it. It smells of lemons."),
    backwards: f("Backwards note", "A line of capitals, every letter set down back to front, right to left."),
    pad: f("Notepad", "The telephone pad, its top sheet torn off. The next page looks blank, but it is dented where a pen pressed through."),
    pencil: f("Soft pencil", "A soft pencil stub from a desk tidy, the lead worn flat on one side."),
    printed: f("Printed card", "An index card overprinted in red and blue type, one line on top of another."),
    lens: f("Red lens", "A red filter from a photographer's kit, in its brass ring."),
    fold: f("Fold-in page", "A sheet of typing paper with half-words down both edges, one edge pencilled A and the other B."),
    musicBox: f("Music box", "A small music box from the mantel, a brass cylinder under a comb of six teeth. Each tooth is stamped with a mark."),
    ribbon: f("Typewriter ribbon", "The ribbon from a portable typewriter, run through once and wound back to its start."),
    soap: "Bar of soap",
    balance: f("Pocket balance", "A chemist's pocket balance in its case, two pans on a brass beam. Engraved inside the lid: the heaviest leads."),
    weight: f("Brass weight", "A brass weight the size of a thimble, stamped {m}."),
  },
  paranormal: {
    key: "Iron key", halves: ["Torn page (left)", "Torn page (right)"], joined: "Mended page", torch: "UV flashlight", wheel: "Cipher wheel",
    letter: f("Blank page", "A page from a child's exercise book, empty, the paper stiff where something was painted on and dried. It smells of lemons."),
    backwards: f("Backwards note", "Small letters, every one back to front, the way a child writes when she's playing at secrets."),
    pad: f("Notepad", "A child's drawing pad, the top sheet torn away. The page left behind looks blank, but it was pressed hard: there are letters under a fingertip."),
    pencil: f("Soft pencil", "A stub of soft drawing pencil, the kind for shading."),
    printed: f("Printed card", "A magic-lantern card printed in red and blue, the letters tangled together so nothing can be read. Along its edge: look through the red glass."),
    lens: f("Red lens", "A round of red glass from a magic lantern, chipped at the rim."),
    fold: f("Fold-in page", "A page from a child's puzzle book, with broken letters down each side, one edge marked A and the other B. Printed underneath: fold A to B."),
    musicBox: f("Music box", "A child's music box, the dancer snapped off its lid. Under the comb of six teeth, each stamped with a mark, the cylinder is still wound."),
    ribbon: f("Typewriter ribbon", "A typewriter ribbon on its spool, dry as a leaf, run through once."),
    soap: "Lump of candle wax",
    balance: f("Pocket balance", "An apothecary's pocket balance in a cracked case, two pans on a brass beam. Scratched inside the lid: the heaviest leads."),
    weight: f("Brass weight", "A brass weight the size of a thimble, stamped {m}."),
  },
};

/** "wall clock" -> "Wall clock": an item's display name from an object label. */
export const capitalise = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Optional story fragments: a card found somewhere, never needed. Each is named for what it is. */
export const KEEPSAKES: Record<Mode, Frame[]> = {
  noir: [
    f("Photograph", "A woman in a fur collar, laughing at someone outside the frame. On the back, only a lipstick kiss."),
    f("Telegram", "COME BACK STOP ALL IS FORGIVEN STOP. Never sent. Folded small enough to hide in a fist."),
  ],
  crime_scene: [
    f("Wedding ring", "A plain gold band. Whatever was engraved inside has been filed away."),
    f("Theatre stub", "A ticket for two, for a play that closed last week. Only one half was ever torn off at the entrance."),
  ],
  paranormal: [
    f("Locket", "Inside, a curl of fair hair tied with thread. It's warm, as if someone just let go of it."),
    f("Christening spoon", "Tarnished black, except where a small thumb has polished it bright."),
  ],
};

// ---------------------------------------------------------------------------
// Crime scene: the evidence library
// ---------------------------------------------------------------------------
// Each wrong suspect, motive and method is ruled out by one in-world document
// (or, found under UV, a forensics report) that the player reads and reasons
// from: an alibi read against the time of death, a will that leaves nothing to
// inherit, a coroner's note in professional language. No line ever says
// "ruled out": the conclusion is the player's. Each finding is written so it
// excludes only its own option, never another one of the same question.
export const SUSPECTS = [
  "Vera Lake", "Arthur Penrose", "Delia Marsh", "Felix Crane", "Ruth Calloway", "Silas Whitlock",
  "June Harrow", "Otto Brandt", "Mabel Quill", "Edmund Fairley",
];

/** What rules one option out: an in-world document that states facts and never a conclusion. */
export interface Evidence {
  /** Alone on a card. */
  title: string;
  text: string;
  /** One line of a bundle (an evidence envelope, the inspector's notebook). */
  line: string;
}

/** Alibis, read against the time of death ({{s}}: the suspect). */
export const ALIBIS: Frame[] = [
  f("Hotel register", "At the Grand, across the river, {{s}} signed in at eight and took the key up at ten. The night porter, who never left his desk, saw nobody come down before breakfast."),
  f("Train ticket", "A sleeper ticket for the ten-fifteen north, in {{s}}'s name, punched by the guard at every stop through the night. The last punch is at the coast, at dawn."),
  f("Diner receipt", "From an all-night diner an hour's drive out on the coast road: coffee, eggs and pie, signed for by {{s}} at a quarter to midnight. The waitress remembers the tip."),
  f("Phone bill", "Itemised, in {{s}}'s name: one long-distance call from a hotel two cities away, connected at half past eleven and lasting most of an hour."),
  f("Custody record", "{{s}}, held overnight at the central station after a brawl in a bar. Booked in at ten, released after breakfast; the cell log shows it was never unlocked in between."),
  f("Ward log", "{{s}}, admitted in the evening for observation. The night nurse checked the bed every hour, and every box is ticked until morning."),
  f("Club register", "{{s}} signed in for the bridge evening at nine. The other players say nobody left the table until well past one."),
  f("Luggage tag", "Torn from {{s}}'s case, checked onto the overnight flight, boarding closed at half past ten, and the steward's list shows the seat taken all the way."),
];

/**
 * Alibis that hold only until half past eleven, a few streets away ({{s}}). Against "close to midnight"
 * alone they rule nobody out (there was time to get here); against NARROWED_DEATH, on another card,
 * they do. The one deduction in the case that needs two cards.
 */
export const PARTIAL_ALIBIS: Frame[] = [
  f("Theatre usher's note", "{{s}} had a seat at the late show at the picture house two streets away, from the overture at nine to the final curtain at half past eleven. The usher swears the seat was never empty, and saw them leave with the crowd."),
  f("Bar tab", "{{s}}'s tab at the corner bar round the block, opened at nine and settled at half past eleven. The barman says they never left the stool until then, and walked out the moment it was paid."),
  f("Church hall register", "{{s}} called the numbers at the church hall bingo round the corner, from nine until the doors closed at half past eleven, and was the last to leave, locking up."),
];

/** What narrows the time of death to before half past eleven: a fact added to another card, later. */
export const NARROWED_DEATH: string[] = [
  "Pinned on later, from the coroner: the victim's wristwatch smashed in the fall and stopped at twenty past eleven.",
  "Pinned on later, a neighbour's statement: she heard the fall through the wall at a quarter past eleven, just as the news ended, and nothing after it.",
  "Pinned on later, from the landlady: she heard the struggle and the fall at ten past eleven, as she wound the hall clock, and the house was silent after.",
];

/** A partial alibi as evidence: the document. */
export function partialEvidence(alibi: Frame): Evidence {
  return { title: alibi.title, text: alibi.lead, line: `${alibi.title}: ${alibi.lead}` };
}

export interface OptionEvidence { name: string; title: string; finding: string }

/** Motives: a document that shows there was nothing to gain that way. */
export const MOTIVES: OptionEvidence[] = [
  {
    name: "Inheritance", title: "Copy of the will", finding: "Witnessed in the spring, the whole estate goes to the Seamen's Mission. No family member or friend is named anywhere in it.",
  },
  {
    name: "Gambling debts", title: "Bank book", finding: "The victim's savings book, stamped last week: steady deposits, no loans, no large withdrawals. The bookmaker on the corner says the account was closed years ago, all square.",
  },
  {
    name: "Jealousy", title: "Love letters", finding: "The letters from the wastepaper basket. Every one is signed by the victim's sister, about her own husband, and asks for advice.",
  },
  {
    name: "Blackmail", title: "Bank's letter", finding: "The safe-deposit box, opened by the bank this morning: empty but for dust. No photographs, no ledger, no letters, and the register shows nobody has opened it in years.",
  },
  {
    name: "Revenge", title: "Court order", finding: "From years back, settling the old feud: both families signed it and the damages were paid the same week. A warm thank-you card from the other side is filed with it.",
  },
  {
    name: "Insurance money", title: "Insurer's letter", finding: "The life policy, returned: lapsed last spring for want of a premium and never renewed. It pays nothing to anyone.",
  },
];

/** Methods: the coroner's and the lab's findings, in their own language. */
export const METHODS: OptionEvidence[] = [
  {
    name: "Poison", title: "Toxicology report", finding: "Blood, stomach contents and the glass by the bed screened for the common poisons and sedatives. Nothing found above trace levels.",
  },
  {
    name: "Strangling", title: "Coroner's note", finding: "No ligature furrow and no fingertip bruising at the neck. The hyoid bone is intact and the eyes show no pinpoint bleeding.",
  },
  {
    name: "A blunt instrument", title: "Coroner's note", finding: "The skull is intact on the X-ray, with no scalp wound and no depressed fracture. The fire irons and the heavy ashtray were swabbed: no blood, hair or fibre.",
  },
  {
    name: "A blade", title: "Coroner's note", finding: "No stab or incised wound anywhere on the body. Every knife in the kitchen is accounted for and clean, and the dust in the knife block is undisturbed.",
  },
  {
    name: "A gunshot", title: "Lab report", finding: "No entry or exit wound. Swabs from the hands, the sill and the curtains are negative for firing residue, and the neighbours, up all night with a baby, heard nothing.",
  },
  {
    name: "A staged fall", title: "Coroner's note", finding: "No grazes, no broken bones, none of the bruising a fall leaves. The dust on the stair treads is unbroken from top to bottom.",
  },
];

/** A suspect's alibi as evidence. */
export function suspectEvidence(alibi: Frame): Evidence {
  return { title: alibi.title, text: alibi.lead, line: `${alibi.title}: ${alibi.lead}` };
}

/** A motive's or method's evidence: the inspector's question on top, the finding beneath. */
export function optionEvidence(o: OptionEvidence): Evidence {
  const lower = o.finding[0].toLowerCase() + o.finding.slice(1);
  return {
    title: o.title,
    text: `The inspector's query, pencilled on top: "{{s}}?" ${o.finding}`,
    line: `${o.title}, with the inspector's query pencilled on top, "{{s}}?": ${lower}`,
  };
}

// ---------------------------------------------------------------------------
// Crime scene: a trace on the photo, compared with a document about a suspect
// ---------------------------------------------------------------------------
// The trace is drawn (footprints of a size and tread, fingerprints of a pattern, a threat on the wall in
// a certain hand); the document states the same kind of fact about one suspect, and the two don't match.
// Nothing says so: the player sets one beside the other. `words`: the document's load-bearing words,
// which a rewrite must keep.
const SIZE_WORDS: Record<TraceSize, [string, string]> = {
  small: ["a narrow shoe, ladies' fours", "fours"], medium: ["men's eights", "eights"], large: ["a big boot, men's twelves", "twelves"],
};
const TREAD_WORDS: Record<Exclude<TraceTread, "bare">, [string, string]> = {
  bars: ["ridged soles, the ridges running straight across", "ridges"], zigzag: ["rubber soles cut in a zigzag", "zigzag"],
  rings: ["crepe soles stamped with rings", "rings"],
};
const PATTERN_WORDS: Record<TracePattern, [string, string]> = {
  whorl: ["whorls on every finger, each a tight spiral", "whorls"], loop: ["plain loops on every finger, all opening the same way", "loops"],
  arch: ["low arches on every finger, no loop or whorl among them", "arches"],
};
const HAND_WORDS: Record<TraceHand, [string, string]> = {
  "left-slant": ["a joined hand that leans hard to the left", "left"], "right-slant": ["a joined hand that leans to the right", "right"],
  block: ["upright capitals, each letter set down on its own", "capitals"],
};

/** What a comparison document says of a suspect: the attributes a trace of that kind shows. */
export type Shows = { size?: TraceSize; tread?: TraceTread; pattern?: TracePattern; hand?: TraceHand };

/** The document about a suspect ({{s}}) that a trace of `kind` is compared with, and the words it must keep. */
export function comparisonDoc(kind: "footprints" | "prints" | "writing", shows: Shows): { evidence: Evidence; words: string[] } {
  const doc = (title: string, text: string, words: string[]) => ({ evidence: { title, text, line: `${title}: ${text}` }, words });
  if (kind === "footprints") {
    const [size, sw] = SIZE_WORDS[shows.size ?? "medium"], [tread, tw] = TREAD_WORDS[(shows.tread === "bare" ? undefined : shows.tread) ?? "bars"];
    return doc("Cobbler's ticket", `{{s}}, one pair left for resoling and collected the same week, the only outdoor pair on the account: ${size}, ${tread}.`, [sw, tw]);
  }
  if (kind === "prints") {
    const [pattern, pw] = PATTERN_WORDS[shows.pattern ?? "arch"];
    return doc("Police ten-card", `{{s}}, fingerprinted at the station that night. Both hands: ${pattern}.`, [pw]);
  }
  const [hand, hw] = HAND_WORDS[shows.hand ?? "block"];
  return doc("Handwriting sample", `{{s}}, asked at the station to copy out a line: ${hand}, the same on every one of a dozen tries.`, [hw]);
}

/** What a threat on a crime-scene wall says (it holds no answer and names no motive): public, drawn in its hand. */
export const THREATS = ["You were warned.", "Not another word.", "This is the last time.", "I told you I would come."];

// ---------------------------------------------------------------------------
// UV traces: what they're called (they're drawn, never reported on)
// ---------------------------------------------------------------------------
/** What the player calls a trace (plain words). */
export const TRACE_LABELS: Record<Mode, Record<TraceKind, string>> = {
  noir: { prints: "Fingerprints", palm: "Handprint", writing: "Invisible writing", stain: "Bourbon stain", footprints: "Wet footprints" },
  crime_scene: { prints: "Fingerprints", palm: "Palm print", writing: "Wiped-off writing", stain: "Splash stain", footprints: "Footprints" },
  paranormal: { prints: "Fingermarks", palm: "Small handprints", writing: "Finger-writing", stain: "Wax drips", footprints: "Bare footprints" },
};

// ---------------------------------------------------------------------------
// Paranormal: the ritual's objects, described by what they are, never named
// ---------------------------------------------------------------------------
/**
 * A ritual fragment's line: where its offering goes, said so that no one fragment gives the order and
 * all of them together leave exactly one ("Never the first: what holds the light."). The rule word
 * comes first, so the description (lowercase) never has to start a sentence.
 */
export const ORDER_LINES: Record<OrderRule, string> = {
  first: "First of all: {o}.",
  last: "Last of all: {o}.",
  middle: "Neither first nor last: {o}.",
  not_first: "Never the first: {o}.",
  not_last: "Never the last: {o}.",
  not_middle: "First or last, never between: {o}.",
};
/** The same, as a glow mark drawn on an object. */
const ORDER_MARKS: Record<OrderRule, string> = {
  first: "first · {o}", last: "last · {o}", middle: "neither first nor last · {o}",
  not_first: "never first · {o}", not_last: "never last · {o}", not_middle: "first or last · {o}",
};
export const orderLine = (rule: OrderRule, ref: string): string => ORDER_LINES[rule].replace("{o}", ref);
export const orderMark = (rule: OrderRule, ref: string): string => ORDER_MARKS[rule].replace("{o}", ref);


/** Words in a label that describe the thing better than its type does. */
const BY_LABEL: [RegExp, string][] = [
  [/\bdrawers?\b/, "what slides out of the dark"],
  [/\bsafe\b/, "what guards what was precious"],
];

// One description per type where it can be, so two different things in a room never read the same.
const BY_TYPE: Partial<Record<ObjectType, string>> = {
  wall_clock: "the face on the wall that keeps the hours", alarm_clock: "the little face that wakes the sleeper",
  desk_lamp: "the light that bends low over the work", floor_lamp: "the light that stands taller than a child",
  ceiling_light: "the light that hangs overhead", string_lights: "the little lights strung in a row",
  bookshelf: "where the books stand in rows", shelf: "what holds things up off the floor",
  book: "the pages someone read too often", book_stack: "the pages piled one on another", notebook: "where someone wrote their thoughts down",
  magazine: "the glossy pages no one kept",
  desk: "where the letters were written", table: "where the family sat down to eat", coffee_table: "the low table where the cups were set",
  side_table: "the little table at someone's elbow", nightstand: "what stands beside the sleeper",
  dresser: "where the folded clothes are kept", filing_cabinet: "where the papers are filed away",
  wardrobe: "where the clothes still hang", cabinet: "what hides behind its doors", sideboard: "the long cupboard where the good plates were kept",
  bed: "where someone slept", sofa: "where the family sat together", armchair: "the deep seat with arms to rest on",
  chair: "where someone sat and waited", stool: "the seat with no back", bench: "the long bare seat",
  ottoman: "where tired feet rested", tv_stand: "where the screen goes dark",
  chest: "the heavy lid that was closed for good", trunk: "what was packed for a journey", box: "what was packed and closed",
  suitcase: "what was packed and never taken", basket: "what holds and carries", jar: "what was sealed tight",
  safe: "what guards what was precious", toolbox: "what holds the tools", bag: "what was carried out and back",
  pillow: "where a head once rested", cushion: "the soft square someone leaned on", rug: "what lies flat on the floor",
  curtain: "what keeps the window", blanket: "what kept the cold away", towel: "what dried the hands",
  framed_picture: "the face behind the glass", poster: "what's pinned to the wall", mirror: "the glass that looks back",
  noticeboard: "where notes are pinned", calendar: "where the days are counted", map: "where the roads are drawn",
  radio: "the voice in the box", speaker: "the box the music came out of", record_player: "what once played music",
  typewriter: "the keys that wrote", fan: "what stirs the air", telephone: "what rings when no one calls",
  guitar: "the strings no one plays", keyboard_instrument: "the keys no one plays", violin: "the strings played under the chin",
  drum: "what was beaten", vase: "what held the flowers", candle: "the flame that waits", trophy: "the prize someone won",
  globe: "the whole world, made small", figurine: "the little watcher", mug: "what held something warm", bottle: "what was emptied",
  plant_pot: "the pot of dark earth", potted_plant: "the living green thing",
};

/** How a ritual card names an object without naming it, or null when nothing fits. */
export function describeObject(type: ObjectType, label: string): string | null {
  const text = label.toLowerCase();
  for (const [re, phrase] of BY_LABEL) if (re.test(text)) return phrase;
  return BY_TYPE[type] ?? null;
}
