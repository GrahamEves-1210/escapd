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
//   - Show, never tell: a card's text is only what is literally written,
//     printed, stamped or engraved on the thing ("THE BLUE LANTERN" printed on
//     a matchbook, the code pencilled inside it). What the thing is and what it
//     looks like (lipstick on a napkin, a photograph face down, a weight the
//     size of a thimble) the app shows: the title names it, the look (types.ts
//     CardDef.look) says how it is drawn, and nothing narrates it. A printed
//     line is in capitals, on a line of its own.
//   - Names are plain and concrete ("Train ticket", "Wedding ring"), never
//     jargon ("Personal effect").
//   - No card names the object a value is for, or says what it is for: which
//     lock a code opens, which book a page is in, is the player's to work out.
//   - No digits outside {{slots}}: a stray number would read as a clue.
//   - Choices are deterministic from the caller's `pick` (a seeded stream).
import type { ObjectType } from "./taxonomy.ts";
import type { CardLook, Mode, OrderRule, SlotKind, TraceHand, TraceKind, TracePattern, TraceSize, TraceTread } from "./types.ts";

export type Pick = <T>(xs: readonly T[]) => T;

/** Where a card's writing was found, which decides how it reads. */
export type Medium = "found" | "read" | "pages" | "lamp" | "uv" | "radio" | "assembled" | "decoded" | "heat" | "mirror" | "rub" | "lens" | "fold" | "tune" | "ribbon" | "phone";

/** A card's title and text ("{v}": the value), and how the app draws it when it's a thing, not paper. */
export interface Frame { title: string; lead: string; look?: CardLook }
const f = (title: string, lead: string, look?: CardLook): Frame => ({ title, lead, ...(look ? { look } : {}) });

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
      f("Matchbook", "THE BLUE LANTERN\n{v}"),
      f("Pawn ticket", "UNCLAIMED PLEDGE · ONE SILVER CIGARETTE CASE\n{v}"),
      f("Cocktail napkin", "THE GILDED CAGE · COCKTAILS\n{v}"),
      f("Envelope", "{v}"),
      f("Betting slip", "LOWRY'S TURF ACCOUNTANTS\n{v}"),
    ],
    read: [
      f("Pencil note", "{v}"),
      f("Margin note", "{v}"),
    ],
    pages: [
      // A snapshot of something in this room, marking the place: what's on its back is the writing.
      f("Photograph", "{v}", "photo"),
      f("Bar bill", "THE BLUE LANTERN · SETTLE AT THE BAR\n{v}"),
    ],
    lamp: [f("Writing in the light", "{v}")],
    uv: [f("Invisible ink", "{v}")],
    radio: [f("Radio", "{v}")],
    assembled: [f("Taped note", "{v}")],
    decoded: [f("Decoded note", "{v}")],
    heat: [f("Lemon-juice letter", "{v}")],
    mirror: [f("Mirror writing", "{v}")],
    rub: [f("Pencil rubbing", "{v}")],
    lens: [f("Through the red lens", "{v}")],
    fold: [f("Folded page", "{v}")],
    tune: [f("Music box", "{v}")],
    ribbon: [f("Typewriter ribbon", "{v}")],
    phone: [f("Telephone", "{v}")],
  },
  crime_scene: {
    found: [
      f("Evidence bag", "EVIDENCE · LOOSE PAPER\n{v}"),
      f("Receipt", "{v}"),
      f("Sticky note", "{v}"),
      f("Index card", "{v}"),
    ],
    read: [
      f("Margin note", "{v}"),
      f("Pencil note", "{v}"),
    ],
    pages: [
      f("Photograph", "{v}", "photo"),
      f("Dry-cleaning tag", "SWIFT CLEANERS · CALL FOR\n{v}"),
    ],
    lamp: [f("Indented writing", "{v}")],
    uv: [f("Invisible ink", "{v}")],
    radio: [f("Police radio", "{v}")],
    assembled: [f("Taped statement", "{v}")],
    decoded: [f("Decoded note", "{v}")],
    heat: [f("Lemon-juice note", "{v}")],
    mirror: [f("Mirror writing", "{v}")],
    rub: [f("Pencil rubbing", "{v}")],
    lens: [f("Through the red lens", "{v}")],
    fold: [f("Folded page", "{v}")],
    tune: [f("Music box", "{v}")],
    ribbon: [f("Typewriter ribbon", "{v}")],
    phone: [f("Telephone", "{v}")],
  },
  paranormal: {
    found: [
      f("Yellowed scrap", "{v}"),
      f("Child's drawing", "{v}"),
      f("Prayer card", "{v}"),
      f("Burnt letter", "{v}"),
    ],
    read: [
      f("Faded writing", "{v}"),
      f("Pencilled line", "{v}"),
    ],
    pages: [
      f("Photograph", "{v}", "photo"),
      f("Pressed lily", "{v}"),
    ],
    lamp: [f("Writing in the light", "{v}")],
    uv: [f("Finger-writing", "{v}")],
    radio: [f("Radio", "{v}")],
    assembled: [f("Mended page", "{v}")],
    decoded: [f("Decoded note", "{v}")],
    heat: [f("Lemon-juice page", "{v}")],
    mirror: [f("Mirror writing", "{v}")],
    rub: [f("Pencil rubbing", "{v}")],
    lens: [f("Through the red lens", "{v}")],
    fold: [f("Folded page", "{v}")],
    tune: [f("Music box", "{v}")],
    ribbon: [f("Typewriter ribbon", "{v}")],
    phone: [f("Telephone", "{v}")],
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
      f("Matchbook", "THE BLUE LANTERN\nTune in, {v}, after midnight"),
      f("Taxi log", "YELLOW CAB CO. · NIGHT DISPATCH\nNight car, call in on {v}"),
    ],
    page: [
      f("Library slip", "CITY LIBRARY · DATE DUE\n{v}"),
      f("Pawn ticket", "UNCLAIMED PLEDGE · ONE LEATHER-BOUND VOLUME\nsee {v}"),
      f("Bookmark", "{v}"),
    ],
    digits: [
      f("Luggage tag", "ROOM NO. {v}"),
      f("Hotel bill", "HOTEL MARINER, BY THE DOCKS\n{v}"),
      f("Cloakroom ticket", "THE BLUE LANTERN · CLOAKROOM\n{v}"),
      f("Pawn ticket", "UNCLAIMED PLEDGE\nNo. {v}"),
    ],
    code: [
      f("Hardware receipt", "KELLER HARDWARE · ONE PADLOCK · CASH\n{v}"),
      f("Shoeshine stub", "SHINE · TEN CENTS\n{v}"),
      f("Matchbook", "THE BLUE LANTERN\n{v}"),
    ],
    offset: [f("Pocket diary", "{v}")],
    cipher: [f("Telegram", "{v}")],
    phone: [
      f("Matchbook", "THE BLUE LANTERN\n{v}"),
      f("Calling card", "Night line {v}"),
    ],
  },
  crime_scene: {
    freq: [
      f("Dispatch slip", "NIGHT CHANNEL, {v}"),
      f("Scanner log", "{v}"),
    ],
    page: [
      f("Library slip", "CITY LIBRARY · DATE DUE\n{v}"),
      f("Index card", "see {v}"),
    ],
    digits: [f("Luggage tag", "ROOM NO. {v}")],
    code: [
      f("Receipt", "BRANNOCK LOCKSMITHS · ONE PADLOCK\n{v}"),
      f("Phone bill", "{v}"),
      f("Sticky note", "{v}"),
    ],
    offset: [f("Diary page", "{v}")],
    cipher: [f("Postcard", "{v}")],
    phone: [
      f("Message pad", "WHILE YOU WERE OUT\nPlease ring back, {v}"),
      f("Address book", "{v}"),
    ],
  },
  paranormal: {
    freq: [
      f("Wireless log", "{v}"),
      f("Séance notes", "the voice comes on {v}"),
    ],
    page: [
      f("Hymn sheet", "{v}"),
      f("Bookmark", "{v}"),
    ],
    digits: [f("Christening card", "{v}")],
    code: [
      f("Sampler", "{v}"),
      f("Slate", "{v}"),
    ],
    offset: [f("Diary page", "{v}")],
    cipher: [f("Burnt letter", "{v}")],
    phone: [
      f("Visiting card", "{v}"),
      f("Wall calendar leaf", "ring {v}"),
    ],
  },
};

/** Where a safe's three numbers are written down: by whoever couldn't trust their memory with them. */
export const DIAL_DOCS: Record<Mode, Frame[]> = {
  noir: [
    f("Matchbook", "THE BLUE LANTERN\n{v}"),
    f("Betting slip", "LOWRY'S TURF ACCOUNTANTS\n{v}"),
  ],
  crime_scene: [
    f("Diary page", "{v}"),
    f("Locksmith's card", "BRANNOCK LOCKSMITHS · SAFES FITTED\n{v}"),
  ],
  paranormal: [
    f("Flyleaf", "{v}"),
    f("Sampler", "{v}"),
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
    td("Train ticket", "THIRD CLASS · SINGLE · LAST TRAIN OUT\nDeparts {v}", "the last train, {v}",
      "The last train never leaves on time. It pulls out {d} after the time on the ticket."),
    td("Theatre ticket", "STALLS · CURTAIN UP {v}", "curtain up at {v}",
      "The curtain went up {d} late that night. Somebody kept the whole house waiting."),
    td("Telegram", "ARRIVING ON THE LATE TRAIN STOP MEET ME AT {v} STOP COME ALONE STOP", "meet at {v}",
      "He turned up to the meeting {d} late. He always does."),
  ],
  crime_scene: [
    td("Parking ticket", "PARKING OFFENCE · TIME OBSERVED {v}", "the warden's ticket, {v}",
      "From the traffic office: that warden's watch was found to run {d} fast.", -1),
    td("Platform ticket", "PLATFORM TICKET · NOT VALID ON TRAINS\n{v}", "platform ticket stamped {v}",
      "The stationmaster's note: the platform clock ran {d} slow all that week."),
  ],
  paranormal: [
    td("Mourning card", "IN LOVING MEMORY\nfell asleep at {v}", "she passed at {v}",
      "They rang the bell {d} after she passed, and stopped every clock in the house on its last stroke."),
    td("Parish register", "BURIALS\nbegun at {v}", "the burial began at {v}",
      "The bell was tolled only when the last earth was in, {d} after the burial began."),
  ],
};

/** How the second fact about a time is written: on the same document, or on another card ("carrier"). */
export const TIME_REL_LEAD: Record<Mode, { same: string; carrier: string }> = {
  noir: { same: "P.S. {r}", carrier: "N.B. {r}" },
  crime_scene: { same: "Memo: {r}", carrier: "Further memo: {r}" },
  paranormal: { same: "Remember: {r}", carrier: "Do not forget: {r}" },
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
    found: [f("Notes", "")],
    read: [f("Margin notes", "")],
    pages: [f("Folded sheet", "")],
    lamp: [f("Writing in the light", "")],
    uv: [f("Invisible ink", "")],
    radio: [f("Radio", "")],
    assembled: [f("Taped note", "")],
    decoded: [f("Decoded note", "")],
    heat: [f("Lemon-juice letter", "")],
    mirror: [f("Mirror writing", "")],
    rub: [f("Pencil rubbing", "")],
    lens: [f("Through the red lens", "")],
    fold: [f("Folded page", "")],
    tune: [f("Music box", "")],
    ribbon: [f("Typewriter ribbon", "")],
    phone: [f("Telephone", "")],
  },
  crime_scene: {
    found: [
      f("Evidence envelope", "EVIDENCE · SEALED AT THE SCENE"),
      f("Case file", ""),
      f("Lab envelope", "PRELIMINARY"),
    ],
    read: [f("Inspector's notebook", "")],
    pages: [f("Case papers", "")],
    lamp: [f("Inspector's notes, pressed through", "")],
    uv: [f("Inspector's notes, pressed through", "")],
    radio: [f("Police radio", "")],
    assembled: [f("Taped statement", "")],
    decoded: [f("Decoded note", "")],
    heat: [f("Lemon-juice note", "")],
    mirror: [f("Mirror writing", "")],
    rub: [f("Pencil rubbing", "")],
    lens: [f("Through the red lens", "")],
    fold: [f("Folded page", "")],
    tune: [f("Music box", "")],
    ribbon: [f("Typewriter ribbon", "")],
    phone: [f("Telephone", "")],
  },
  paranormal: {
    found: [
      f("Yellowed scrap", ""),
      f("Scratched card", ""),
      f("Child's drawing", ""),
      f("Diary page", "Mama says we must do it in the right order, or it won't rest. This is what she knew:"),
      f("Séance notes", ""),
    ],
    read: [f("Faded writing", "")],
    pages: [f("Pressed lily", "")],
    lamp: [f("Writing in the light", "")],
    uv: [f("Finger-writing", "")],
    radio: [f("Radio", "")],
    assembled: [f("Mended page", "")],
    decoded: [f("Decoded note", "")],
    heat: [f("Lemon-juice page", "")],
    mirror: [f("Mirror writing", "")],
    rub: [f("Pencil rubbing", "")],
    lens: [f("Through the red lens", "")],
    fold: [f("Folded page", "")],
    tune: [f("Music box", "")],
    ribbon: [f("Typewriter ribbon", "")],
    phone: [f("Telephone", "")],
  },
};

/**
 * A card's title and text: `values` are the value phrases (each with its {{slot}}); `kind`: a lone
 * value's kind; `doc`: the document a lone value is written on (a time's ticket). A lone value of a kind
 * with documents, found or read, is on one of them. Writing that came to light (under a lamp, in a
 * mirror, taped together) is only the writing: the player watched it appear.
 */
export function writeCard(mode: Mode, medium: Medium, values: string[], list: boolean, pick: Pick, kind?: SlotKind, doc?: Frame): { title: string; text: string; look?: CardLook } {
  const docs = !list && (medium === "found" || medium === "read") ? (doc ? [doc] : kind ? DOCS[mode][kind as DocKind] ?? [] : []) : [];
  const frame = pick(docs.length ? docs : (list ? LIST : INLINE)[mode][medium]);
  const look = frame.look ? { look: frame.look } : {};
  if (list) return { title: frame.title, text: [...(frame.lead ? [frame.lead] : []), ...values].join("\n"), ...look };
  const v = values.join(", ");
  // A full stop after the value only when the value ends a sentence: never after a bare value or a printed
  // line ("ROOM NO. {v}"), and never when it ends one already ("MEET ME AT {v} STOP" needs none).
  const line = frame.lead.split("\n").pop() ?? "";
  const sentence = /[a-z]/.test(line.replace("{v}", "")) && line.endsWith("{v}");
  const end = sentence && !/[.!?"]$/.test(v) ? "." : "";
  return { title: frame.title, text: frame.lead.replace("{v}", `${v}${end}`), ...look };
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
export const ITEM_NAMES: Record<Mode, { key: string; halves: [string, string]; joined: string; torch: string; wheel: string; letter: Frame; backwards: Frame; pad: Frame; pencil: Frame; printed: Frame; lens: Frame; fold: Frame;
  musicBox: Frame; ribbon: Frame; soap: string; balance: Frame; weight: Frame }> = {
  // Each card is only what is written, printed or engraved on the thing; the app draws the thing (its rendered
  // art, large): a blank letter is blank (its dried lemon juice shows as faint stains), a backwards note shows its
  // reversed scrawl, a weight its stamped mark ({m}). A caption printed on a novelty card or a puzzle page, and an
  // engraving inside a lid, are written there, so they stay.
  noir: {
    key: "Brass key", halves: ["Torn note (left)", "Torn note (right)"], joined: "Taped note", torch: "UV flashlight", wheel: "Cipher wheel",
    letter: f("Blank letter", ""),
    backwards: f("Backwards note", "", "mirrored"),
    pad: f("Notepad", "HOTEL MARINER"),
    pencil: f("Soft pencil", ""),
    printed: f("Printed card", "SEE IT THROUGH RED"),
    lens: f("Red lens", ""),
    fold: f("Fold-in page", "FOLD SO A MEETS B"),
    musicBox: f("Music box", ""),
    ribbon: f("Typewriter ribbon", ""),
    soap: "Bar of soap",
    balance: f("Pocket balance", "The heaviest leads.", "inscribed"),
    weight: f("Brass weight", "{m}", "inscribed"),
  },
  crime_scene: {
    key: "Small key", halves: ["Torn statement (left)", "Torn statement (right)"], joined: "Taped statement", torch: "UV flashlight", wheel: "Cipher wheel",
    letter: f("Blank letter", ""),
    backwards: f("Backwards note", "", "mirrored"),
    pad: f("Notepad", "TELEPHONE MESSAGES"),
    pencil: f("Soft pencil", ""),
    printed: f("Printed card", "VIEW THROUGH RED FILTER"),
    lens: f("Red lens", ""),
    fold: f("Fold-in page", "FOLD A TO B"),
    musicBox: f("Music box", ""),
    ribbon: f("Typewriter ribbon", ""),
    soap: "Bar of soap",
    balance: f("Pocket balance", "The heaviest leads.", "inscribed"),
    weight: f("Brass weight", "{m}", "inscribed"),
  },
  paranormal: {
    key: "Iron key", halves: ["Torn page (left)", "Torn page (right)"], joined: "Mended page", torch: "UV flashlight", wheel: "Cipher wheel",
    letter: f("Blank page", ""),
    backwards: f("Backwards note", "", "mirrored"),
    pad: f("Notepad", ""),
    pencil: f("Soft pencil", ""),
    printed: f("Printed card", "LOOK THROUGH THE RED GLASS"),
    lens: f("Red lens", ""),
    fold: f("Fold-in page", "FOLD A TO B"),
    musicBox: f("Music box", ""),
    ribbon: f("Typewriter ribbon", ""),
    soap: "Lump of candle wax",
    balance: f("Pocket balance", "The heaviest leads.", "inscribed"),
    weight: f("Brass weight", "{m}", "inscribed"),
  },
};

/** "wall clock" -> "Wall clock": an item's display name from an object label. */
export const capitalise = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** Optional story fragments: a card found somewhere, never needed. Each is named for what it is. */
export const KEEPSAKES: Record<Mode, Frame[]> = {
  noir: [
    // A snapshot of the place it was hidden (shown.ts), and on its back:
    f("Photograph", "Don't wait up.", "photo"),
    f("Telegram", "COME BACK STOP ALL IS FORGIVEN STOP"),
  ],
  crime_scene: [
    f("Wedding ring", "For ever. R.", "inscribed"),
    f("Theatre stub", "ADMIT TWO · STALLS · FINAL WEEK"),
  ],
  paranormal: [
    f("Locket", "Always near.", "inscribed"),
    f("Christening medal", "Blessed in this house.", "inscribed"),
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

/** A motive's or method's evidence: what it concerns at its head, as a memo has it ("Re: Poison"), the finding beneath. */
export function optionEvidence(o: OptionEvidence): Evidence {
  const lower = o.finding[0].toLowerCase() + o.finding.slice(1);
  return {
    title: o.title,
    text: `Re: {{s}}\n${o.finding}`,
    line: `${o.title}, re {{s}}: ${lower}`,
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
