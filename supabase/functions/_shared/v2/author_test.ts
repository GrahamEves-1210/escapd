// The author call's brief, schema and guards: what the model is told (the case chain, each
// placeholder's path, never a value), what it may send back, and which rewrites code refuses.
import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { claudeSchema } from "../anthropic.ts";
import { proseSystem, voiceRules } from "../prose.ts";
import {
  applyAuthor, authorBrief, ORDER_PHRASES, tells, authorSchema, authorSystem, type AuthorText, caseChain, cardLimit, cleanText, keepsLook, keepsMarks,
  parseAuthor, placeOf, slotGuide,
} from "./author.ts";
import { planRoom } from "./planner.ts";
import { simulate } from "./simulate.ts";
import { BEDROOM_WITH_DOOR, FULL_15, seededRandomInt, syntheticInventory } from "./test_fixtures.ts";
import { ORDER_LINES } from "./copy.ts";
import { MODES, type Mode, ORDER_RULES, type OrderRule, type RoomDefinitionV2, type RoomSecretV2 } from "./types.ts";

function plan(mode: Mode, inv = mode === "crime_scene" ? FULL_15 : BEDROOM_WITH_DOOR, seed = `room-${mode}`) {
  const p = planRoom(inv, { mode, seed, randomInt: seededRandomInt(7) });
  if (!p.ok) throw new Error(`${mode}: ${p.detail}`);
  return p;
}

/** A model that follows the rules: a new lead-in on every card and hint, its placeholders and marks untouched. */
function faithful(def: RoomDefinitionV2, secret: RoomSecretV2): Record<string, unknown> {
  const options = def.finale.kind === "accusation" ? [...def.finale.suspects, ...def.finale.motives, ...def.finale.methods] : [];
  return {
    bible: { story: "Somebody set this up for you.", cast: "Vic: wrote the letter.", clues: "Each card: Vic's." },
    objective: def.objective, brief: def.brief ?? "A letter came.", intro: "The room is as you left it.", ending: "The door gives.",
    objects: def.objects.map((o) => ({ id: o.id, name: `Old ${o.label}`.slice(0, 40) })),
    items: def.items.map((i) => ({ id: i.id, name: i.name })),
    cards: def.cards.map((c) => ({ id: c.id, title: c.title, text: `Kept for a reason. ${c.text}` })),
    steps: secret.steps.map((s) => ({ id: s.id, title: s.title, hints: s.hints.map((h) => h) })),
    beats: secret.rules.filter((r) => r.effects.some((e) => e.do === "beat")).map((r) => ({ id: r.id, text: "Something shifts." })),
    options: options.map((o) => ({ id: o.id, name: o.name })),
  };
}

const words = (v: unknown): string[] => (typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v).flatMap(words) : []);

Deno.test("author: on many planned rooms, the brief lays out the chain and every placeholder's path, and never a value", () => {
  let rooms = 0;
  for (const mode of MODES) {
    for (let seed = 0; seed < 40; seed++) {
      const p = planRoom(syntheticInventory(seed, 9 + (seed % 7), 1), { mode, seed: `s${seed}`, randomInt: seededRandomInt(seed) });
      if (!p.ok) continue;
      rooms++;
      const { definition: def, secret } = p;
      const brief = authorBrief(def, secret);
      const chain = caseChain(def, secret);
      for (const s of secret.steps) assert(chain.includes(`- ${s.id}`), `${mode}/${seed}: ${s.id} in the chain`);
      for (const c of def.cards) {
        const shown = secret.rules.some((r) => r.effects.some((e) => e.do === "show_card" && e.card === c.id));
        if (shown) assert(chain.includes(`${c.id} "`), `${mode}/${seed}: ${c.id} in the chain`);
      }
      const guide = slotGuide(def, secret);
      for (const name of Object.keys(secret.slots)) assert(guide.includes(`{{${name}}}: `), `${mode}/${seed}: {{${name}}} explained`);
      for (const s of Object.values(secret.slots)) {
        if (s.kind === "option" || s.kind === "object") continue;
        if (s.value.length >= 3) assert(!brief.includes(s.value), `${mode}/${seed}: ${s.value} leaked`);
        if ((s.text ?? "").length >= 3) assert(!brief.includes(s.text!), `${mode}/${seed}: ${s.text} leaked`);
      }
      // Every step's reason, from the planner, is in the chain.
      for (const s of secret.steps) if (s.why?.trim()) assert(chain.includes(`Why: ${s.why.trim()}`), `${mode}/${seed}: ${s.id}'s why`);
      // An offering's rule is stated, never its place in the order.
      // (The planner's own ending may say "the last offering settles": that is its words, not a slot's place.)
      assert(!/\b(first|second|third|fourth|fifth|last|next) offering\b/i.test(chain + guide), `${mode}/${seed}: an offering's place`);
      for (const [name, s] of Object.entries(secret.slots)) {
        if (s.kind !== "object") continue;
        const line = guide.split("\n").find((l) => l.startsWith(`{{${name}}}: `))!;
        const rule = (s as { order?: OrderRule }).order;
        if (rule) {
          assertStringIncludes(line, `"${ORDER_LINES[rule].split("{o}")[0].trim()}"`);
          for (const other of ORDER_RULES) if (other !== rule) assert(!line.includes(`"${ORDER_LINES[other].split("{o}")[0].trim()}"`), `${name}: ${other}`);
        }
      }
      // The ritual's offerings are only ever phrases the game fills in: the brief never quotes one.
      // (Unless the planner names it plainly, "the blanket", for an object it has no description for.)
      for (const s of Object.values(secret.slots)) {
        const plainName = def.objects.some((o) => s.text === `the ${o.label}`);
        if (s.kind === "object" && s.text && !plainName) assert(!brief.includes(s.text), `${mode}/${seed}: ${s.text}`);
      }
      // A rule-abiding answer is kept whole, and the room still plays.
      const out = applyAuthor(def, secret, parseAuthor(faithful(def, secret), def, secret));
      // Only a field whose planner text already holds a word answer as a word ("blue ink" in a room whose
      // lock spells INK) may be refused: the leak check is right to refuse the copy.
      const words = Object.values(secret.slots).filter((x) => x.kind !== "option" && x.kind !== "object" && /[a-z]/i.test(x.text ?? x.value) && (x.text ?? x.value).length >= 3)
        .map((x) => new RegExp(`(?:^|[^a-z0-9])${(x.text ?? x.value).toLowerCase()}(?:$|[^a-z0-9])`));
      const leaky = (t: string) => words.some((w) => w.test(t.toLowerCase()));
      const originals = new Map<string, string>([...def.cards.map((c) => [`${c.id}.text`, c.text] as [string, string])]);
      for (const f of out.rejected) assert(leaky(originals.get(f) ?? ""), `${mode}/${seed}: ${f} refused`);
      assert(simulate(out.definition, out.secret).ok, `${mode}/${seed}`);
    }
  }
  assert(rooms > 60, `${rooms} rooms planned`);
});

Deno.test("author: the noir chain says what each find gives and where its placeholder goes next", () => {
  const { definition, secret } = plan("noir");
  const brief = authorBrief(definition, secret);
  const chain = caseChain(definition, secret);
  // Every digit placeholder is tied to the door's wheels by its symbols; the door's code is explained, never shown.
  for (const [name, s] of Object.entries(secret.slots)) {
    if (s.kind === "digits") assert(new RegExp(`\\{\\{${name}\\}\\}: (one digit|\\w+ digits) of the door's code, for the wheels? marked \\S+\\. Read: card_\\d+`).test(brief), name);
  }
  assert(/\{\{code_\d+\}\}: the door's whole code: \{\{digits_\d+\}\}( then \{\{digits_\d+\}\})+, wheel by wheel\./.test(brief), brief);
  // A found item is named in the chain (the UV flashlight, a key, a blank letter: the room's tool varies).
  assert(/→ the player gets the [A-Za-z]/.test(chain), chain);
  assert(/enter \{\{code_\d+\}\} on the door → the way out opens/.test(chain), chain);
  // Where each object is, so a card can say "by the window".
  assert(/^desk = desk \[Drawer\/drawer\] \(photo \d, [a-z ]+\)$/m.test(brief), brief);
});

Deno.test("author: placeOf names the photo and the part of it", () => {
  const o = { id: "a", photo_index: 1, box: { x: 0.05, y: 0.7, w: 0.2, h: 0.2 } } as RoomDefinitionV2["objects"][number];
  assertEquals(placeOf(o), "photo 2, bottom left");
  assertEquals(placeOf({ ...o, box: { x: 0.4, y: 0.4, w: 0.2, h: 0.2 } }), "photo 2, centre");
  assertEquals(placeOf({ ...o, box: { x: 0.8, y: 0.45, w: 0.1, h: 0.1 } }), "photo 2, right");
});

Deno.test("author: the system prompt explains the rules, asks for the bible first, and bans the clichés", () => {
  for (const mode of MODES) {
    const { definition } = plan(mode);
    const system = authorSystem(definition);
    assertStringIncludes(system, "Settle the story in `bible` before anything else");
    assertStringIncludes(system, "A stray number reads like part of a code");
    assertStringIncludes(system, "a chill runs down your spine");
    assertStringIncludes(system, "No em dashes");
    assertStringIncludes(system, voiceRules(mode));
    assert(!/—|–/.test(system), `${mode}: the prompt itself uses no dashes`);
    assert(!/[0-9]/.test(system.split("Examples")[1].split("Voice:")[0].replace(/\{\{[a-z0-9_]+\}\}/g, "")), `${mode}: the examples hold no digits`);
  }
  assertStringIncludes(authorSystem(plan("crime_scene").definition), "Do not decide who did it");
  // v1's prose call gets the same style rule.
  for (const mode of MODES) assertStringIncludes(proseSystem(mode), "little did you know");
});

Deno.test("author: the schema asks for the bible first, fits structured outputs, and a missing bible is no failure", () => {
  const { definition, secret } = plan("crime_scene");
  const schema = authorSchema(definition, secret) as { properties: Record<string, unknown> };
  assertEquals(Object.keys(schema.properties)[0], "bible");
  const claude = JSON.stringify(claudeSchema(authorSchema(definition, secret)));
  for (const k of ["minItems", "maxItems", "maxLength", "pattern"]) assert(!claude.includes(`"${k}"`), k);
  assert(claude.length < 4000, `schema is ${claude.length} characters`);
  const answer = faithful(definition, secret);
  assertEquals(parseAuthor(answer, definition, secret).bible?.cast, "Vic: wrote the letter.");
  delete answer.bible;
  assertEquals(parseAuthor(answer, definition, secret).bible, undefined);
});

Deno.test("author: wheel symbols stay on their digits, and ritual ordinals with their offering", () => {
  assert(keepsMarks("A hurried hand: ▲ {{d1}}.", "In Vic's hand, low on the wall: ▲ {{d1}}."));
  assert(keepsMarks("Torn off: ●◆ {{d2}}.", "Torn off the bottom: ●◆: {{d2}}"));
  assert(!keepsMarks("A hurried hand: ▲ {{d1}}.", "In Vic's hand: {{d1}}."), "symbol dropped");
  assert(!keepsMarks("Torn off: ●◆ {{d2}}.", "Torn off: ◆● {{d2}}."), "symbols reordered");
  assert(!keepsMarks("A hurried hand: ▲ {{d1}}.", "▲ In Vic's hand, ▲ {{d1}}."), "a symbol added");
  assert(keepsMarks("The drips spell it out:\nSecond, {{o2}}.", "Drips across the boards, a child's letters: Second, {{o2}}."));
  assert(!keepsMarks("Second, {{o2}}.", "{{o2}} comes second."), "the order words move away from the offering");
  assert(!keepsMarks("Second, {{o2}}.", "Then {{o2}}."), "ordinal dropped");
  assert(!keepsMarks("Second, {{o2}}.", "First the wax. Then {{o2}}, as she always did."), "the wrong ordinal");
  // A rule that only narrows the order keeps its negation.
  assert(keepsMarks("Traced in the dust:\nNever the first: {{o}}.", "A small fingertip, in the dust on the desk. Never the first: {{o}}."));
  assert(!keepsMarks("Never the first: {{o}}.", "First: {{o}}."), "negation dropped");
  assert(!keepsMarks("Neither first nor last: {{o}}.", "Not last: {{o}}."));
  // A clock's time is worked out from an amount and its direction.
  const ticket = "A single for the last train, punched once. Departure: {{t}}. The last train never leaves on time. It pulls out ten minutes after the time on the ticket.";
  assert(keepsMarks(ticket, "A third-class single, punched by the guard. Departure: {{t}}. That train always pulls out ten minutes after the time printed."));
  assert(!keepsMarks(ticket, "A single for the last train. Departure: {{t}}. It always leaves late."), "the amount dropped");
  assert(!keepsMarks(ticket, "A single for the last train. Departure: {{t}}. It pulls out ten minutes before the time on the ticket."), "the direction flipped");
  assert(keepsMarks("Stamped {{t}}.", "A parking ticket, stamped {{t}}."));
});

Deno.test("author: a rewrite that drops a card's wheel symbol or ordinal keeps the planner's card", () => {
  const { definition, secret } = plan("noir");
  const card = definition.cards.find((c) => /[▲●◆■★✚]/.test(c.text))!;
  const ref = /\{\{\s*[a-z0-9_]+\s*\}\}/.exec(card.text)![0];
  const text: AuthorText = { objects: new Map(), items: new Map(), cards: new Map(), steps: new Map(), beats: new Map(), options: new Map() };
  text.cards.set(card.id, { title: card.title, text: `In a careful hand: ${ref}.` });
  const out = applyAuthor(definition, secret, text);
  assertEquals(out.definition.cards.find((c) => c.id === card.id)!.text, card.text);
  assert(out.rejected.includes(`${card.id}.text`), out.rejected.join(","));
});

Deno.test("author: a long case file may be rewritten at its own length, keeping its lines", () => {
  const { definition, secret } = plan("crime_scene");
  const long = definition.cards.find((c) => c.text.length > 320 && c.text.includes("\n"));
  assert(long, "the crime scene has a multi-document card");
  assert(cardLimit(long) > long.text.length);
  const text: AuthorText = { objects: new Map(), items: new Map(), cards: new Map(), steps: new Map(), beats: new Map(), options: new Map() };
  const rewritten = long.text.split("\n").map((l, i) => (i === 0 ? `The inspector's file, a little thicker now.` : l)).join("\n");
  text.cards.set(long.id, { title: long.title, text: rewritten });
  const out = applyAuthor(definition, secret, text);
  assertEquals(out.definition.cards.find((c) => c.id === long.id)!.text, rewritten);
  assertEquals(cleanText("One.\n\n  Two  lines.\n", 40, true), "One.\nTwo lines.");
  assertEquals(cleanText("One.\nTwo.", 40), "One. Two.");
});

Deno.test("author: a card title keeps the word the casebook draws it by", () => {
  assert(keepsLook("Taped note", "Taped-up letter"));
  assert(!keepsLook("Taped note", "The two halves"));
  assert(keepsLook("Under UV", "Seen under UV"));
  assert(keepsLook("Hotel bill", "The Seaview's bill"));
  assert(!keepsLook("Found between the pages", "In the book"));
});

Deno.test("author: rejected fields are listed by id, never by their text", () => {
  const { definition, secret } = plan("noir");
  const text: AuthorText = { objects: new Map(), items: new Map(), cards: new Map(), steps: new Map(), beats: new Map(), options: new Map() };
  text.ending = "Room 12 at last.";
  const step = secret.steps[0];
  text.steps.set(step.id, { title: "A".repeat(80), hints: ["Fine.", "Also fine.", "Gone {{nope}}."] });
  const out = applyAuthor(definition, secret, text);
  assertEquals(out.rejected.filter((f) => f === "ending" || f.startsWith(`${step.id}.`)).sort(), ["ending", `${step.id}.hint3`, `${step.id}.title`]);
  assertEquals(out.kept, out.rejected.length);
  assert(words(out.rejected).every((f) => /^[a-z0-9_]+(\.[a-z0-9]+)?$/.test(f)), out.rejected.join(","));
});

Deno.test("author: a word answer blocks the word itself, not every word that contains it", () => {
  const { definition, secret } = plan("noir");
  const withWord = { ...secret, slots: { ...secret.slots, word_x: { kind: "letters" as const, value: "A|S|H", text: "ASH" } } };
  const text: AuthorText = { objects: new Map(), items: new Map(), cards: new Map(), steps: new Map(), beats: new Map(), options: new Map() };
  text.ending = "You pocket the flashlight and the cash and walk out.";
  assertEquals(applyAuthor(definition, withWord, text).secret.ending, text.ending);
  text.ending = "Ash on the sill, and the door open.";
  assertEquals(applyAuthor(definition, withWord, text).secret.ending, secret.ending);
});

Deno.test("author: every order phrase the planner writes stays word for word before its offering", () => {
  assertEquals(ORDER_PHRASES, ORDER_RULES.map((r) => ORDER_LINES[r].split("{o}")[0].trim()));
  for (const rule of ORDER_RULES) {
    const original = `Traced in the dust on the desk:\n${ORDER_LINES[rule].replace("{o}", "{{object_2}}")}`;
    const kept = `A small fingertip, in the dust on the desk. ${ORDER_LINES[rule].replace("{o}", "{{object_2}}")}`;
    assert(keepsMarks(original, kept), rule);
    for (const other of ORDER_RULES) {
      if (other === rule) continue;
      assert(!keepsMarks(original, `In the dust: ${ORDER_LINES[other].replace("{o}", "{{object_2}}")}`), `${rule} -> ${other}`);
    }
    assert(!keepsMarks(original, "In the dust, in a child's letters: {{object_2}}."), `${rule} dropped`);
  }
  // A glow mark's short form, if a card ever carries one.
  assert(keepsMarks("Under the lamp: never first · {{o}}", "In the lamplight, small letters: never first · {{o}}"));
  assert(!keepsMarks("Under the lamp: never first · {{o}}", "In the lamplight: first · {{o}}"));
});

Deno.test("author: a how-far-off line added from another thread keeps its amount and its direction", () => {
  const card = "A pawn ticket for one silver cigarette case. Stamped in red where the number goes: {{t}}. " +
    "On the back, in another hand: \"The curtain went up twenty-five minutes late that night. Somebody kept the whole house waiting.\"";
  const lead = "A pawn ticket for one silver cigarette case, never collected. Stamped in red: {{t}}.";
  assert(keepsMarks(card, `${lead} Someone else wrote on the back: the curtain went up twenty-five minutes late that night.`));
  assert(!keepsMarks(card, `${lead} Someone else wrote on the back about a late curtain.`), "the amount dropped");
  assert(!keepsMarks(card, `${lead} On the back: the curtain went up twenty minutes late that night.`), "the amount changed");
  assert(!keepsMarks(card, `${lead} On the back: the curtain went up twenty-five minutes early that night.`), "the direction changed");
  assert(!keepsMarks(card, lead), "the whole line dropped");
  // The planner's other amounts and directions.
  const burial = "The bell was tolled only when the last earth was in, an hour and a quarter after the burial began.";
  assert(keepsMarks(burial, "They tolled the bell an hour and a quarter after the burial began, once the last earth was in."));
  assert(!keepsMarks(burial, "They tolled the bell an hour after the burial began."), "an hour and a quarter is not an hour");
  const watch = "From the traffic office: that warden's watch was found to run a quarter of an hour fast.";
  assert(!keepsMarks(watch, "The warden's watch ran a quarter of an hour slow."), "fast is not slow");
  assert(keepsMarks(watch, "A note from the traffic office: the warden's watch ran a quarter of an hour fast."));
});

Deno.test("author: clock times and distances in words, the crime scene's whole deduction, stay as written", async () => {
  const { PARTIAL_ALIBIS, NARROWED_DEATH } = await import("./copy.ts");
  const { CLOCK_WORDS, DISTANCE } = await import("./author.ts");
  const found = (re: RegExp, t: string) => [...t.matchAll(re)].map((m) => m[0].toLowerCase());
  // Every time and place the planner's partial alibis and narrowing lines hold is recognised.
  for (const a of PARTIAL_ALIBIS) {
    assert(found(CLOCK_WORDS, a.lead).includes("half past eleven"), a.title);
    assert(found(CLOCK_WORDS, a.lead).some((t) => /nine/.test(t)), a.title);
    assert(found(DISTANCE, a.lead).length > 0, a.title);
  }
  for (const line of NARROWED_DEATH) assert(found(CLOCK_WORDS, line).some((t) => /past eleven/.test(t)), line);
  assertEquals(found(CLOCK_WORDS, "the fall at ten past eleven"), ["ten past eleven"]);
  assertEquals(found(CLOCK_WORDS, "a quarter to midnight, then eleven o'clock, the ten-fifteen north"), ["a quarter to midnight", "eleven o'clock", "ten-fifteen"]);

  const alibi = PARTIAL_ALIBIS[0].lead.replace("{{s}}", "{{option_2}}");
  const kept = "{{option_2}} had a seat at the late show at the picture house two streets away, from the overture at nine to the final curtain at half past eleven. The usher never saw the seat empty.";
  assert(keepsMarks(alibi, kept));
  assert(!keepsMarks(alibi, kept.replace("half past eleven", "a quarter past eleven")), "the time changed");
  assert(!keepsMarks(alibi, kept.replace("two streets away", "across town")), "the distance changed");
  assert(!keepsMarks(alibi, kept.replace(" at nine", "")), "the start dropped");

  const evidence = "Custody record: {{option_1}}, held overnight at the central station. Booked in at ten, released after breakfast.\n" + NARROWED_DEATH[0];
  const rewrite = "Custody record, central station: {{option_1}}, held overnight. Booked in at ten, released after breakfast.";
  assert(keepsMarks(evidence, `${rewrite}\n${NARROWED_DEATH[0]}`));
  assert(!keepsMarks(evidence, rewrite), "the coroner's line dropped");
  assert(!keepsMarks(evidence, `${rewrite}\n${NARROWED_DEATH[0].replace("twenty past eleven", "twenty to twelve")}`), "the watch time changed");
});

Deno.test("author: show, never tell: the prompt says why, a card that concludes or instructs is dropped, and a suspect's comparison words stay", () => {
  for (const mode of MODES) {
    const system = authorSystem(plan(mode).definition);
    assertStringIncludes(system, "Show, never tell.");
    assertStringIncludes(system, "Telling, bad:");
    assertStringIncludes(system, "Showing, good:");
    assert(!system.includes("magnifier reads"), "the magnifier reads no report any more");
  }
  for (const bad of [
    "A ladies' four, far too small for the boot prints, which rules her out.", "The ticket doesn't match the prints.", "It is the same hand as the letter.",
    "A blank page. Hold it to the lamp.", "A soft pencil. Rub it over the notepad.", "Which means the clock was stopped later.", "You will need a mirror for this.",
  ]) assert(tells(bad), bad);
  for (const good of [
    "Cobbler's ticket. One pair left for resoling: a narrow shoe, ladies' fours, ridged soles.", "Good notepaper, folded twice, with nothing on it. It smells faintly of lemons.",
    "A page torn from a magazine. The caption says: fold so A meets B.", "Held overnight at the central station; the cell was never unlocked.",
  ]) assert(!tells(good), good);
  // No card the planner writes tells; and in a room where a document is set against a trace, a rewrite keeps its words.
  let checked = false;
  for (let i = 0; i < 300 && !checked; i++) {
    const p = planRoom(FULL_15, { mode: "crime_scene", seed: `tell-${i}`, randomInt: seededRandomInt(i) });
    assert(p.ok);
    for (const c of p.definition.cards) assert(!tells(c.text), `the planner tells: ${c.text}`);
    const matched = Object.entries(p.secret.slots).find(([, s]) => s.match);
    if (!matched) continue;
    checked = true;
    const [name, slot] = matched;
    const card = p.definition.cards.find((c) => c.text.includes(`{{${name}}}`))!;
    const text: AuthorText = { objects: new Map(), items: new Map(), cards: new Map(), steps: new Map(), beats: new Map(), options: new Map() };
    // Reworded but faithful: kept. With the load-bearing word gone, or with the comparison made for the player: dropped.
    const reworded = card.text.replace(/\.$/, ", as the ledger has it.");
    text.cards.set(card.id, { title: card.title, text: reworded });
    assertEquals(applyAuthor(p.definition, p.secret, text).definition.cards.find((c) => c.id === card.id)!.text, reworded);
    text.cards.set(card.id, { title: card.title, text: card.text.split(slot.match!.words[0]).join("something") });
    assertEquals(applyAuthor(p.definition, p.secret, text).definition.cards.find((c) => c.id === card.id)!.text, card.text);
    text.cards.set(card.id, { title: card.title, text: `${card.text} That doesn't match the trace.` });
    assertEquals(applyAuthor(p.definition, p.secret, text).definition.cards.find((c) => c.id === card.id)!.text, card.text);
    // The brief tells the model what the trace shows and that it is drawn, not described.
    assertStringIncludes(authorBrief(p.definition, p.secret), "drawn by the game, never described on a card");
  }
  assert(checked, "no crime room with a document set against a trace");
});
