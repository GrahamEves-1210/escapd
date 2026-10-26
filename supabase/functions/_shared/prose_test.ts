// Prose stage: per-genre prompts, the brief, and the deterministic text that
// keeps an accusation deducible whatever the model writes.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { ACCUSE_DIMENSIONS, type Dimension, GENRES } from "./contract.ts";
import type { VerifiedObject } from "./perception.ts";
import {
  assembleDefinition,
  buildBrief,
  fallbackEvidenceSentence,
  FALLBACK_OPTIONS,
  finalizeText,
  pickStoryFamily,
  proseSystem,
} from "./prose.ts";
import { checkPuzzle, namesDistinct, OPTION_LISTS, provesOption } from "./puzzle-check.ts";
import { type AccusationText, type ProseText, STORY_FAMILIES } from "./schemas.ts";
import {
  assignRoles,
  compileTemplate,
  type CompiledRoom,
  CRIME_SCENE_TEMPLATES,
  PARANORMAL_TEMPLATES,
  TEMPLATES,
} from "./templates.ts";
import { FAKE_OBJECTS, fakeObject, seededRandomInt } from "./test_fixtures.ts";

const PHOTO_IDS = ["photo-a", "photo-b", "photo-c"];
type Json = Record<string, unknown>;
type Option = { id: string; name: string; role?: string; alibi?: string };

function crimeRoom(seed = 5): CompiledRoom {
  const spec = CRIME_SCENE_TEMPLATES[1];   // coded_drawer: a code step and an accusation
  const fit = assignRoles(spec, FAKE_OBJECTS)!;
  return compileTemplate(spec, fit.assignment, [], { randomInt: seededRandomInt(seed) });
}

const accuseOf = (room: CompiledRoom) => room.puzzles.find((p) => p.kind === "accuse")!;
const valid = (room: CompiledRoom, prose: ProseText | null) => {
  const { publicDefinition, solution } = assembleDefinition(room, prose, PHOTO_IDS);
  return { publicDefinition, solution, errors: checkPuzzle(publicDefinition, solution, { photoIds: PHOTO_IDS, generation: true }) };
};

/** Model text for a crime room: good names and sentences unless a test overrides them. */
function crimeProse(room: CompiledRoom, edit: (a: AccusationText) => void = () => {}): ProseText {
  const accuse = accuseOf(room);
  const names: Record<Dimension, string[]> = {
    suspect: ["Ivy Marsh", "Tobias Reed", "Clara Finch"],
    motive: ["A debt she could not pay", "A rewritten will", "A partnership about to end"],
    method: ["Poison in the evening tea", "A loosened stair rail", "A sleeping draught in the wine"],
  };
  const nameOf = (d: Dimension) => names[d][accuse.options![d].indexOf(accuse.accusation![d])];
  const accusation: AccusationText = {
    suspects: new Map(accuse.options!.suspect.map((id, i) => [id, { name: names.suspect[i], role: "A guest", alibi: "Says they were elsewhere." }])),
    motives: new Map(accuse.options!.motive.map((id, i) => [id, { name: names.motive[i] }])),
    methods: new Map(accuse.options!.method.map((id, i) => [id, { name: names.method[i] }])),
    evidence: new Map([
      ["suspect", `The ticket puts ${nameOf("suspect")} across town at nine.`],
      ["motive", `A note in the margin: ${nameOf("motive")}.`],
      ["method", `The residue says it plainly: ${nameOf("method")}.`],
    ]),
  };
  edit(accusation);
  return {
    storyFamily: "locked_room_death",
    title: "The Quiet Guest",
    intro: "Three people were here that evening.",
    exitMessage: "It holds together now.",
    hotspots: new Map(),
    items: new Map(),
    puzzles: new Map(),
    accusation,
  };
}

const optionsOf = (pub: Json, accuseId: string) => {
  const p = (pub.puzzles as Json[]).find((q) => q.id === accuseId)!;
  return Object.fromEntries(ACCUSE_DIMENSIONS.map((d) => [d, p[OPTION_LISTS[d]] as Option[]])) as Record<Dimension, Option[]>;
};

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------
Deno.test("proseSystem: one prompt per genre, same prefix, shared content rules", () => {
  for (const genre of GENRES) {
    const system = proseSystem(genre);
    assert(system.startsWith("You write the text"), genre);
    assertStringIncludes(system, "every character is fictional");
    assertStringIncludes(system, "Never cast a real person seen in a photo");
    assertStringIncludes(system, "No gore and no graphic injury; write for ages 12 and up.");
    assertStringIncludes(system, "Set story_family to exactly that value");
    assertStringIncludes(system, "Return only the JSON object described by the schema.");
  }
  // noir keeps today's voice and rules word for word
  assertStringIncludes(proseSystem("noir"), `Never use the words "trapped", "victim" or "survive"`);
  assertStringIncludes(proseSystem("noir"), "gore, body horror, horror, possession, self-harm, sexual content or realistic violence");
  // crime scene: no gore, and the method never uses the player's real objects
  assertStringIncludes(proseSystem("crime_scene"), "Never describe a body, wounds, blood or suffering");
  assertStringIncludes(proseSystem("crime_scene"), "never one of the player's real objects");
  assert(!proseSystem("crime_scene").includes(`"victim"`), "the crime-scene voice may say victim");
  // crime scene: the answer is read off the evidence only
  assertStringIncludes(proseSystem("crime_scene"), "no wrong suspect, motive or method from any list");
  assertStringIncludes(proseSystem("crime_scene"), "never name the culprit, the true motive or the true method");
  // paranormal: eerie, never demonic or self-harm; a seance story stays writable; no flame at a real object
  assertStringIncludes(proseSystem("paranormal"), "never evil");
  assertStringIncludes(proseSystem("paranormal"), "Never write about demons, possession, summoning anything evil or harmful");
  assertStringIncludes(proseSystem("paranormal"), "home invasion, stalking, kidnapping, threats to the household");
  assertStringIncludes(proseSystem("paranormal"), "self-harm");
  assertStringIncludes(proseSystem("paranormal"), "never tell the player to light anything");
  assertEquals(new Set(GENRES.map(proseSystem)).size, 3);
});

Deno.test("pickStoryFamily: code picks from the genre's list", () => {
  for (const genre of GENRES) {
    const families = STORY_FAMILIES[genre];
    assertEquals(families.length, 4);
    assertEquals(pickStoryFamily(genre, () => 0), families[0]);
    assertEquals(pickStoryFamily(genre, () => 0.999999), families[3]);
    assertEquals(pickStoryFamily(genre, () => 1), families[3]);
  }
});

// ---------------------------------------------------------------------------
// Brief
// ---------------------------------------------------------------------------
const MIRROR = fakeObject("m", "wall mirror", "wall_hanging", 0);
const DESK = fakeObject("d", "writing desk", "surface", 1);
const DRESSER = fakeObject("r", "oak dresser", "container_candidate", 2);
const SHELF = fakeObject("b", "bookshelf", "surface", 0);

Deno.test("brief: what objects mean in this genre, applied to the room's own labels", () => {
  const objects = [MIRROR, DESK, DRESSER, SHELF];
  const expected = {
    noir: ["hides a coded message", "holds encrypted documents", "hides a stolen item"],
    paranormal: ["shows a reflection that shouldn't exist", "has drawers that moved on their own", "has symbols carved into it"],
  };
  const universal = { noir: TEMPLATES[3], paranormal: PARANORMAL_TEMPLATES[0] };
  for (const genre of ["noir", "paranormal"] as const) {
    const spec = universal[genre];
    const room = compileTemplate(spec, assignRoles(spec, objects)!.assignment, [], { randomInt: seededRandomInt(2) });
    const brief = buildBrief(room, STORY_FAMILIES[genre][1]);
    const id = (label: string) => room.hotspots.find((h) => h.object.label === label)!.id;
    assertStringIncludes(brief, `Story family: ${STORY_FAMILIES[genre][1]}. It is fixed`);
    assert(!brief.includes("choose another"), "the family is not a suggestion");
    assertStringIncludes(brief, `- "${id("wall mirror")}" (wall mirror): a mirror ${expected[genre][0]}`);
    assertStringIncludes(brief, `- "${id("writing desk")}" (writing desk): a desk ${expected[genre][1]}`);
    assertStringIncludes(brief, `- "${id("oak dresser")}" (oak dresser): a dresser ${expected[genre][2]}`);
    assertStringIncludes(brief, `- Every other object ("${id("bookshelf")}"): `);
    // the code line appears only when the room has a code step
    assertEquals(brief.includes("The case code is"), room.puzzles.some((p) => p.kind === "code"), genre);
  }
});

Deno.test("brief: a crime-scene object means evidence only where its own step gives that evidence", () => {
  const spec = CRIME_SCENE_TEMPLATES[0];   // broken_alibi: timeline_spot (alibi), hiding_place (key), lock (motive), trace_spot (method)
  const briefFor = (byRole: Record<string, VerifiedObject>) =>
    buildBrief(compileTemplate(spec, new Map(Object.entries(byRole)), [], { randomInt: seededRandomInt(2) }), "locked_room_death");

  // The mirror breaks the alibi and the dresser hid the weapon; the desk only holds the motive.
  let brief = briefFor({ timeline_spot: MIRROR, hiding_place: SHELF, lock: DESK, trace_spot: DRESSER });
  assertStringIncludes(brief, `- "wall_mirror" (wall mirror): a mirror reveals a timeline contradiction`);
  assertStringIncludes(brief, `- "oak_dresser" (oak dresser): a dresser hid the weapon`);
  assertStringIncludes(brief, `- Every other object ("bookshelf", "writing_desk"): a place that keeps a trace of the evening`);

  // The desk breaks the alibi now; a dresser holding the motive and a mirror holding the method are ordinary places.
  brief = briefFor({ timeline_spot: DESK, hiding_place: SHELF, lock: DRESSER, trace_spot: MIRROR });
  assertStringIncludes(brief, `- "writing_desk" (writing desk): a desk holds evidence that breaks an alibi`);
  assertStringIncludes(brief, `- Every other object ("bookshelf", "oak_dresser", "wall_mirror"): `);
  assert(!/alibi|contradict/.test(brief.split("Every other object")[1].split("\n")[0]), "the general rule proves nothing");
});

Deno.test("brief: an object's type is its head noun, and red herrings get atmosphere only", () => {
  const spec = TEMPLATES[3];   // code_box_key, universal: note_spot, coded_lock, lock, final_spot
  const objects = [
    fakeObject("l", "desk lamp", "electronic", 0),
    fakeObject("c", "desk chair", "other", 1),
    fakeObject("v", "vanity mirror", "wall_hanging", 2),
    fakeObject("w", "chest of drawers", "container_candidate", 0),
  ];
  const herring = fakeObject("h", "standing mirror", "wall_hanging", 1);
  const room = compileTemplate(spec, new Map(spec.roles.map((r, i) => [r.key, objects[i]])), [herring], { randomInt: seededRandomInt(4) });
  const brief = buildBrief(room, "stolen_ledger");
  assertStringIncludes(brief, `- Every other object ("desk_lamp", "desk_chair"): `);
  assertStringIncludes(brief, `- "vanity_mirror" (vanity mirror): a mirror hides a coded message.`);
  assertStringIncludes(brief, `- "chest_of_drawers" (chest of drawers): a dresser hides a stolen item.`);
  assertStringIncludes(brief, `- Red herrings ("standing_mirror"): atmosphere only; nothing there matters to the case.`);
  assert(!brief.includes(`"standing_mirror" (standing mirror): a mirror`));
});

Deno.test("brief: crime scene names the options, the culprit and where each evidence sentence goes", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const brief = buildBrief(room, "inheritance_dispute");
  for (const d of ACCUSE_DIMENSIONS) {
    for (const id of accuse.options![d]) assertStringIncludes(brief, `"${id}"`);
    assertStringIncludes(brief, `added to "${accuse.evidence![d]}"`);
  }
  assertStringIncludes(brief, `The culprit is "${accuse.accusation!.suspect}".`);
  assertStringIncludes(brief, `The true motive is "${accuse.accusation!.motive}".`);
  assertStringIncludes(brief, `The true method is "${accuse.accusation!.method}".`);
  assertStringIncludes(brief, "The case code is");   // coded_drawer also has a code step
});

Deno.test("brief: paranormal names the effects and the banishing order", () => {
  const spec = PARANORMAL_TEMPLATES[0];
  const room = compileTemplate(spec, assignRoles(spec, FAKE_OBJECTS)!.assignment, [], { randomInt: seededRandomInt(3) });
  const brief = buildBrief(room, "former_tenant");
  assertStringIncludes(brief, `The banishing is "set_candle", then "cover_reflection", then "speak_name".`);
  assert(!/\blit\b|\blight(ed|ing)? the candle/i.test(brief), "the candle is set down, never lit at a real object");
  assertStringIncludes(brief, "Effect shown in the game: flicker");
  assertStringIncludes(brief, "Effect shown in the game: apparition");
  assert(!brief.includes("The case code is"));
});

// ---------------------------------------------------------------------------
// Accusation text: deducible whatever the model writes
// ---------------------------------------------------------------------------
Deno.test("fallback options: distinct names, and each fallback sentence names only its own option of all nine", () => {
  const all = ACCUSE_DIMENSIONS.flatMap((d) => FALLBACK_OPTIONS[d].map((o) => o.name));
  for (const d of ACCUSE_DIMENSIONS) {
    const names = FALLBACK_OPTIONS[d].map((o) => o.name);
    assert(namesDistinct(names), d);
    for (const name of names) {
      assert(provesOption(fallbackEvidenceSentence(d, name), name, all.filter((n) => n !== name)), `${d}/${name}`);
    }
  }
});

Deno.test("no model text: every answer combination is deducible from the fallback evidence", () => {
  for (let s = 0; s < 3; s++) {
    for (let m = 0; m < 3; m++) {
      for (let x = 0; x < 3; x++) {
        const room = crimeRoom();
        const accuse = accuseOf(room);
        accuse.accusation = { suspect: accuse.options!.suspect[s], motive: accuse.options!.motive[m], method: accuse.options!.method[x] };
        const { errors, publicDefinition } = valid(room, null);
        assertEquals(errors, [], `${s}${m}${x}`);
        const options = optionsOf(publicDefinition, accuse.id);
        for (const d of ACCUSE_DIMENSIONS) assertEquals(options[d].map((o) => o.name), FALLBACK_OPTIONS[d].map((o) => o.name));
      }
    }
  }
});

Deno.test("good model text is kept: names, alibis and the evidence sentence after the item's own text", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const prose = crimeProse(room);
  prose.items.set(accuse.evidence!.motive, { name: "Unsent letter", description: "Sealed twice." });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const options = optionsOf(publicDefinition, accuse.id);
  assertEquals(options.suspect.map((o) => o.name), ["Ivy Marsh", "Tobias Reed", "Clara Finch"]);
  assertEquals(options.suspect[0].alibi, "Says they were elsewhere.");
  const motive = (publicDefinition.items as Json[]).find((i) => i.id === accuse.evidence!.motive)!;
  assertEquals(motive.description, `Sealed twice. ${prose.accusation!.evidence.get("motive")}`);
  assertEquals(finalizeText(room, prose).fixes > 0, true, "the other two evidence items had no text of their own");
});

Deno.test("evidence that names a wrong option, or none, falls back to a deterministic sentence", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const wrongSuspect = accuse.options!.suspect.find((id) => id !== accuse.accusation!.suspect)!;
  const prose = crimeProse(room, (a) => {
    a.evidence.set("suspect", `Both ${a.suspects.get(wrongSuspect)!.name} and the others were seen.`);
    a.evidence.delete("method");
  });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const description = (d: Dimension) => String((publicDefinition.items as Json[]).find((i) => i.id === accuse.evidence![d])!.description);
  assertStringIncludes(description("suspect"), "The times do not fit");
  assertStringIncludes(description("method"), "It shows how it was done");
  assertEquals(optionsOf(publicDefinition, accuse.id).suspect[0].name, "Ivy Marsh", "names survive a bad sentence");
});

Deno.test("names that collide or contain one another fall back for that dimension only", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const prose = crimeProse(room, (a) => {
    const [first, second] = accuse.options!.motive;
    a.motives.set(first, { name: "Money" });
    a.motives.set(second, { name: "Money owed" });   // contains "Money"
  });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const options = optionsOf(publicDefinition, accuse.id);
  assertEquals(options.motive.map((o) => o.name), FALLBACK_OPTIONS.motive.map((o) => o.name));
  assertEquals(options.suspect.map((o) => o.name), ["Ivy Marsh", "Tobias Reed", "Clara Finch"]);
});

Deno.test("an evidence item's own text that names a wrong option is replaced, and the code stays out", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const wrongMethod = accuse.options!.method.find((id) => id !== accuse.accusation!.method)!;
  const prose = crimeProse(room, (a) => a.evidence.set("motive", `It was about money. The code is ${room.code}.`));
  prose.items.set(accuse.evidence!.method, {
    name: "Receipt",
    description: `A receipt that mentions ${prose.accusation!.methods.get(wrongMethod)!.name}.`,
  });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const description = (d: Dimension) => String((publicDefinition.items as Json[]).find((i) => i.id === accuse.evidence![d])!.description);
  assert(!description("method").includes("A receipt that mentions"), description("method"));
  assert(!description("motive").includes(room.code), description("motive"));
});

Deno.test("evidence that names a wrong option of another list falls back, and so does an evidence item's name", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const wrongSuspect = accuse.options!.suspect.find((id) => id !== accuse.accusation!.suspect)!;
  const wrongMethod = accuse.options!.method.find((id) => id !== accuse.accusation!.method)!;
  const prose = crimeProse(room, (a) => {
    // A red herring that contradicts the answer: the right motive in a wrong suspect's hand.
    a.evidence.set("motive", `A letter in ${a.suspects.get(wrongSuspect)!.name}'s hand, never sent: ${a.motives.get(accuse.accusation!.motive)!.name}.`);
  });
  const wrongMethodName = prose.accusation!.methods.get(wrongMethod)!.name;
  prose.items.set(accuse.evidence!.suspect, { name: `Receipt for ${wrongMethodName}`, description: "Creased." });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const item = (d: Dimension) => (publicDefinition.items as Json[]).find((i) => i.id === accuse.evidence![d])!;
  assertStringIncludes(String(item("motive").description), "It gives the reason plainly");
  assert(!String(item("motive").description).includes(prose.accusation!.suspects.get(wrongSuspect)!.name));
  assertEquals(item("suspect").name, "Torn timetable");
  assertStringIncludes(String(item("suspect").description), "Creased. The ticket puts");
  assertEquals(optionsOf(publicDefinition, accuse.id).suspect.map((o) => o.name), ["Ivy Marsh", "Tobias Reed", "Clara Finch"], "the names survive");
});

Deno.test("the model's evidence counts only when it names the option as written, not inside other words", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const prose = crimeProse(room, (a) => {
    a.suspects.get(accuse.accusation!.suspect)!.name = "Ed Gar";
    a.evidence.set("suspect", "Someone used garden shears on the trellis after nine.");   // "usedgarden"
    a.methods.get(accuse.accusation!.method)!.name = "Rope";
    a.evidence.set("method", "They met in Europe that night.");                           // "europe"
  });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const description = (d: Dimension) => String((publicDefinition.items as Json[]).find((i) => i.id === accuse.evidence![d])!.description);
  assertStringIncludes(description("suspect"), "The times do not fit: Ed Gar was not where the alibi says.");
  assertStringIncludes(description("method"), "It shows how it was done: Rope.");
  const options = optionsOf(publicDefinition, accuse.id);
  assert(options.suspect.some((o) => o.name === "Ed Gar") && options.method.some((o) => o.name === "Rope"), "the names are kept");
});

Deno.test("names too short to stand apart from ordinary words fall back for that list only", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const prose = crimeProse(room, (a) => accuse.options!.method.forEach((id, i) => a.methods.set(id, { name: ["Ice", "Gas", "A push"][i] })));
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const options = optionsOf(publicDefinition, accuse.id);
  assertEquals(options.method.map((o) => o.name), FALLBACK_OPTIONS.method.map((o) => o.name));
  assertEquals(options.suspect.map((o) => o.name), ["Ivy Marsh", "Tobias Reed", "Clara Finch"]);
});

Deno.test("a wrong name that the fixed sentences contain sends every list to the fallback names", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const wrongMethod = accuse.options!.method.find((id) => id !== accuse.accusation!.method)!;
  const prose = crimeProse(room, (a) => {
    a.methods.set(wrongMethod, { name: "The times" });   // inside "The times do not fit: ..."
    a.evidence.delete("suspect");
  });
  const { errors, publicDefinition } = valid(room, prose);
  assertEquals(errors, []);
  const options = optionsOf(publicDefinition, accuse.id);
  for (const d of ACCUSE_DIMENSIONS) assertEquals(options[d].map((o) => o.name), FALLBACK_OPTIONS[d].map((o) => o.name), d);
});

Deno.test("public text that names the answer falls back; a list of all three, the evidence, messages and hints may", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const prose = crimeProse(room);
  const truth = (d: Dimension) => {
    const list = { suspect: prose.accusation!.suspects, motive: prose.accusation!.motives, method: prose.accusation!.methods }[d];
    return list.get(accuse.accusation![d])!.name;
  };
  const everyone = [...prose.accusation!.suspects.values()].map((s) => s.name).join(", ");
  const [hotspot, other] = room.hotspots;
  const plain = room.items.find((i) => !i.evidence)!;
  prose.title = `The ${truth("suspect")} Affair`;
  prose.intro = `Three guests: ${everyone}.`;
  prose.exitMessage = `${truth("suspect")} did it, for ${truth("motive")}.`;
  prose.hotspots.set(hotspot.id, { name: `${truth("suspect")}'s chair`, description: `It smells of ${truth("method")}.` });
  prose.hotspots.set(other.id, { name: "Lamp", description: "Warm to the touch." });
  prose.items.set(plain.id, { name: "Card", description: `Neat writing: ${truth("motive")}. It reads ${room.code}.` });
  prose.puzzles.set(accuse.id, {
    title: `Accuse ${truth("suspect")}`, prompt: `Was it ${truth("method")}?`, message: `${truth("suspect")} is led away.`,
    hints: ["Read what you carry.", `Think about ${truth("suspect")}.`, "Name them."],
  });

  const text = finalizeText(room, prose);
  assertEquals(text.title, "A Quiet Evening");
  assertEquals(text.intro, `Three guests: ${everyone}.`);
  assertEquals(text.exitMessage, "The account finally holds together. The case is closed.");
  const label = hotspot.object.label;
  assertEquals(text.hotspots.get(hotspot.id), { name: label.charAt(0).toUpperCase() + label.slice(1), description: `A ${label}. Worth a closer look.` });
  assertEquals(text.hotspots.get(other.id), { name: "Lamp", description: "Warm to the touch." });
  assert(!text.items.get(plain.id)!.description.includes(truth("motive")), "a clue item keeps its code but not the answer");
  assertStringIncludes(text.items.get(plain.id)!.description, room.code);
  assertEquals(text.puzzles.get(accuse.id)!.title, "Make the accusation");
  assertEquals(text.puzzles.get(accuse.id)!.prompt, "Who did it, why, and how?");
  assertEquals(text.puzzles.get(accuse.id)!.message, `${truth("suspect")} is led away.`);
  assertEquals(text.puzzles.get(accuse.id)!.hints[1], `Think about ${truth("suspect")}.`);
  assertEquals(valid(room, prose).errors, []);
});

Deno.test("the accusation's third hint names the whole answer; its prompt is always set", () => {
  const room = crimeRoom();
  const accuse = accuseOf(room);
  const prose = crimeProse(room);
  prose.puzzles.set(accuse.id, { title: "Accuse", prompt: "", message: "Done.", hints: ["Look.", "Think.", "Accuse someone."] });
  const text = finalizeText(room, prose);
  const hint = text.puzzles.get(accuse.id)!.hints[2];
  for (const d of ACCUSE_DIMENSIONS) {
    const name = text.options![d].find((o) => o.id === accuse.accusation![d])!.name;
    assertStringIncludes(hint, name);
  }
  assertEquals(text.puzzles.get(accuse.id)!.prompt, "Who did it, why, and how?");
});
