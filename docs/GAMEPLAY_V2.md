# Escapd gameplay v2: from a labelled photo to an escape room

Status: design proposal, for discussion before any code. It builds on the current
pipeline (`supabase/functions/_shared/*`), schema v1 (`src/lib/puzzle-types.ts`) and
the play screen (`src/render/*`); file references are to today's code.

One correction to the brief first: **Escapd doesn't generate room images.** A room
is the player's own five or six 360° photos; Gemini only *looks* at them. That is the
product's best idea (it's your room) and it decides most of this design: we can never
repaint a photo to show a drawer opening, and we shouldn't try. The photo is the
place; everything you *do* in it has to be drawn by the app.

---

## 1. Why today's gameplay feels shallow

Not "the AI isn't clever enough". The structure makes depth impossible.

1. **One verb.** Every interaction is "tap a rectangle", plus "pick an item, tap a
   rectangle" and "type a code". The five step kinds (`inspect`, `use_item`, `combine`,
   `code`, `accuse`) are *outcomes*, not things your hands do. Nothing is turned, slid,
   lifted, tuned, aligned or set.
2. **Information is handed over, not discovered.** A code puzzle `requires` the step
   that grants its clue, and the clue item's description *contains the code*
   (`templates.ts` header, "clue coverage"). The player copies four digits from one
   sheet to another. There is nothing to work out.
3. **Objects are slots, not things.** Perception reduces each object to one of 9
   affordances (`schemas.ts AFFORDANCES`). A template role like `keypad` accepts
   `container_candidate | instrument | electronic | wall_hanging | other | surface`. That is how a
   keypad ends up on a cushion or a speaker: the system knows the speaker is "electronic",
   not that it has a dial, plays sound, or could be tuned.
4. **The world never changes.** Solving a step returns a text sheet. The photo looks
   the same at minute 8 as at minute 0: no light comes on, nothing opens, nothing new
   appears where you'd expect it.
5. **Linear graphs with obvious brute force.** Seven noir templates, each 4–6 steps
   in one chain. Herrings grant nothing, so tapping everything once is a winning
   strategy, and that's exactly what the visible rectangles invite.
6. **Modes are skins.** Crime scene adds `accuse` at the end; paranormal chains three
   inspects. The minute-to-minute play is the same in all three.
7. **The ending is a flag.** `exit.requires` is met and the screen changes. Nothing in
   the room pays off the threads you followed.

The generation *pipeline* is good: per-photo perception, verification, reconciliation,
deterministic templates, minted secrets, prose with code-inserted literals, a
preflight plus server validator, a spend ledger and a single repair. The weakness is the
**game model** that pipeline fills in. Keep the factory, change what it builds.

---

## 2. The redesigned loop, from the player's side

> You arrive in your own room, recast as a scene. It's dark. A one-line objective
> sits at the top ("Find Leo's second ledger before midnight"). You sweep a torch
> across the photo; objects you could look at catch the light. You open the desk
> drawer and *slide* it out. Inside is half a train ticket. Elsewhere, a book sits proud of
> its shelf; between its pages is the other half. You drag the halves together:
> **DEP 11:40, PLATFORM 3.** The wall clock has stopped. You drag its hands to
> 11:40 and the face clicks open. Behind it is a brass cipher wheel. Now the poster you
> looked at five minutes ago means something…

The loop, per object: **notice → inspect → manipulate → learn something → that changes
what something else means.** Per room: **three short threads that braid into one
finale that needs all of them**, then a payoff you can see.

### The five pieces

1. **Discover (no permanent rectangles).** The room starts in shadow (a vignette over
   the photo). Dragging your finger sweeps a torch beam; objects worth a look *glint*
   as the light passes. After a while, unseen objects pulse faintly (the idle glint we
   already built). Show interactives stays as an accessibility setting.
2. **Inspect (the close-up).** Tapping an object opens an **inspection view**: a
   zoomed, slightly vignetted crop of the real photo around that object (a free crop
   from the bounding box, Ken-Burns settle), with an **interactive mechanism drawn on
   top**: a drawer that slides, clock hands you can drag, a tuning dial, a frame you can
   tilt, a cushion you lift. These are *reusable components* (archetypes, §3).
3. **Manipulate (physical verbs).** Each archetype has one or two gestures: drag,
   rotate, slide, lift, tap-sequence, rub, hold. Haptic detents and the sound kit we
   already have make them feel mechanical.
4. **Learn (information, not just items).** What you get is usually *information*:
   a time, a frequency, a symbol order, a name or a direction. It goes into a **casebook**
   (journal) automatically, with physical items in the tray. The casebook is where the
   noir voice lives, and where a crime scene builds its evidence board.
5. **Change the room.** Solving a mechanism changes the scene: the lamp lights its
   part of the photo, the clock face hangs open (an overlay sprite), a revealed note is
   pinned where it was found, UV light makes marks glow, paranormal objects shift. The
   photo stays; **state overlays** anchored to the object's box tell you the world moved.

   *Shipped, a first version, app only:* one small portable object per room (an
   inspect-only hotspot on a plain background) disappears from the photo once it is
   taken: an on-device push-pull fill of its box, with matched grain, fades in over it.
   No model call, no server change, and it works on existing rooms. See DESIGN.md,
   Game feel · 4a "Taken objects leave the room".

### Pacing target: 6–10 minutes

| Beat | Time | What happens |
|---|---|---|
| Arrival | 0:00–0:45 | Objective, darkness, first sweep, an easy first find that teaches inspect and manipulate |
| Threads | 0:45–6:30 | 2–3 parallel threads of 2–3 steps each; at least one **revisit** (an old object means something new) and one **room change** |
| Breakthrough | ~5:00 | A combine or decode that turns two scraps into a real answer, the "oh!" moment |
| Finale | 6:30–8:30 | One mechanism that needs an output from **every** thread |
| Payoff | 8:30–9:00 | The room responds (exit opens, reveal, banishing), then case closed |

---

## 3. How imagery, detection, puzzles and mechanics fit together

```
photos ──► perception (AI: what is where, what is it, what could it physically do)
                │
                ▼
   object inventory: [{type: "wall_clock", features: [has_hands, wall_mounted], box, photo, salience}]
                │
                ▼
   ARCHETYPE MATCHER (code): which interactive kits each object can host
   wall_clock → ClockHands, Compartment(back)   cushion → LiftUnder only
                │
                ▼
   PLANNER (code, seeded): pick a mode skeleton + puzzle motifs, bind them to
   archetype instances, mint every secret value, simulate to prove solvable
                │
                ▼
   AUTHOR (one AI call): story, characters, every clue card's words around
   {{slots}}, object descriptions, hints, beats, ending, in the mode's voice
                │
                ▼
   VALIDATE (code + SQL): solvable, no leaks, every slot filled exactly, every
   fact visible somewhere a player can reach before it's needed
                │
                ▼
   schema v2 room ──► deterministic engine (server) + archetype components (client)
```

**The rule that keeps it coherent:** *AI describes the world and writes the words;
code decides what can happen.* Perception says "this is a wall clock with hands". Only
the archetype table can make it a `ClockHands` mechanism. Only the planner can decide
that its answer is 11:40. Only the engine decides what happens when you set it.

### 3a. Perception v2: describe objects physically, not as affordance buckets

Same two stages (per-photo detection plus one verification call), same models, a richer
closed schema per object:

- `type`: a closed taxonomy of ~60 household object types (wall_clock, desk,
  dresser, wardrobe, bookshelf, book_stack, framed_picture, poster, mirror, desk_lamp,
  floor_lamp, radio, speaker, guitar, keyboard_instrument, plant_pot, rug, bed,
  pillow, cushion, chair, chest, box, jar, vase, candle, trophy, globe, typewriter,
  record_player, curtain, …), plus `other` with a free label.
- `features`: closed flags: `has_drawers`, `has_doors`, `has_hands`, `has_dial`,
  `has_strings`, `has_keys`, `can_open`, `can_lift`, `wall_mounted`, `light_source`,
  `reflective`, `has_pages`, `holds_items` and so on.
- `salience` (how prominent it is), and `fully_visible` (vs. cut off at the frame edge).

This is *more* grounding for about 30% more output tokens. The model is never asked
to invent mechanics, only to describe what it sees.

### 3b. Archetypes: the reusable interactive kit

An **archetype** is one client component plus one engine contract. Each declares:

- **Hosts:** which object types or features may carry it. `ClockHands` needs
  `has_hands`; `TuningDial` needs `radio | speaker | record_player`; `CombinationLock`
  needs `has_doors | can_open` on furniture or boxes (never textiles).
- **State and controls:** e.g. `ClockHands {hour: 0–11, minute: 0–59 in 5s}`,
  `TuningDial {freq: 88.0–108.0 in 0.1 steps}`, `Drawer {open, locked_by?}`.
- **Can emit** (what it can *teach*): a time, a number, a symbol order, a hidden item.
- **Can accept** (what it can *ask for*): a value to be set, an item to be used.
- **Render:** a photo crop plus a vector mechanism layer, with states drawn as overlays.

A starting kit of about 14, roughly in build order:

| Archetype | Hosts (examples) | Gesture | Typical role |
|---|---|---|---|
| Drawer / Compartment | desk, dresser, nightstand, chest | slide or pull | contains items or cards; can be locked |
| LiftUnder | pillow, cushion, rug corner, plant pot, books | lift or drag aside | hides a small thing |
| Readable (book, letter) | book, bookshelf, notebook | page flip | carries a clue card (text the app renders) |
| FrameTilt | framed picture, poster, mirror | tilt or slide | reveals the back (note, hook, safe) |
| ClockHands | wall clock, alarm clock | drag hands | accepts a time; opens a back panel |
| TuningDial | radio, speaker, record player | rotate | accepts a frequency; plays an audio clue |
| CombinationLock | wardrobe, cabinet, box, chest, safe | roll wheels | accepts digits, letters or symbols (exit lock) |
| Light | desk or floor lamp | toggle | changes room light; UV variant reveals ink |
| MirrorFog | mirror, glass door | rub or breathe | reveals writing |
| Sequence | guitar, keyboard, music box | tap in order | accepts a note or colour order |
| Arrange | shelf items, books, frames | drag to reorder | accepts an order |
| Dig / Search | plant pot, laundry, bag | rub or scratch | finds a buried item |
| Assemble (inventory) | (portable) | drag pieces together | combines halves or parts into one thing |
| Decoder (inventory) | cipher wheel, key card | rotate or overlay | turns an encoded message into a value |

**Precise clues never depend on pixels.** Every number, symbol, time and word the
player must read is **rendered by the app**: a typed card, an engraved plate, a dial
face, LED symbols over the speaker crop, ink glowing under UV. The real photo
supplies place and atmosphere; the app supplies legible facts. That sidesteps
image-generation text errors entirely, and also the real text in players' rooms,
which we deliberately never read.

### 3c. Story props: things the photos don't contain

Planners need small portable things the camera can't see: half a ticket, a cipher
wheel, a key, a pressed note. These **props** are fine as long as they're always
*found inside* a real object's archetype (in the drawer, behind the frame, under the
cushion). Rule: a prop never appears from nowhere and never sits loose on the photo.

### 3d. The planner: motifs, not templates

Today a template is a whole fixed graph. v2 composes rooms from **motifs**, small
reusable dependency patterns with typed inputs and outputs:

| Motif | Shape | Example |
|---|---|---|
| Split | two halves of one value found apart → Assemble | torn ticket |
| Set-state | a value learned elsewhere → set a mechanism | clock to 11:40 |
| Cross-reference | object A says *where* in object B to look | "page 47" → book |
| Decode | encoded message + decoder → value | symbols + cipher wheel |
| Tool-reveal (revisit) | a found tool used on something already seen | UV torch on the poster |
| Room-change trigger | solving changes the room and reveals something | lamp on, mark appears |
| Ordering | an order learned (story, audio) → Sequence or Arrange | radio tones → notes |
| Contain-lock (≤ 1 per room) | key or code opens a container | the one honest lock |
| Story fragment | optional discovery, rewards observation | a pick engraved "L.M." |

**Planning** (deterministic, seeded from the room id):

1. The **mode skeleton** fixes the arc: objective type, 2–3 threads, finale kind (noir:
   combination exit; crime: accusation from proofs; paranormal: ordered ritual).
2. The **finale** is chosen first, on the most suitable salient object (e.g. a
   wardrobe as the exit). Its required inputs become each thread's goal.
3. Each thread is grown **backwards** from its goal with motifs whose archetypes have
   hosts in the room, preferring objects spread across different photos (the 360
   makes you turn round).
4. **Constraints**: at most one contain-lock, at least one revisit, at least one room
   change, no object used for more than two roles, every value has exactly one source,
   threads interleave (nothing fully linear), 6–9 required steps in total.
5. **Mint** every secret (time, frequency, digits, symbol order) with the existing
   crypto helpers, avoiding guessable values.
6. **Score** a handful of candidate plans (fit quality, variety, spread, a difficulty
   target) and keep the best.
7. **Simulate**: breadth-first search over the engine's state space to prove the room is
   solvable, has no softlocks (nothing consumed twice), and that the finale is
   unreachable without every thread (no shortcut).

This is all code, no AI and no cost, and it can be **property-tested** on thousands of
synthetic object inventories in CI.

### 3e. The author call: one call, writes everything, decides nothing

Input: the planned room (objects with their archetypes, motifs, slot names, mode, voice,
story family) plus downscaled photos for atmosphere. Output (closed JSON): title,
objective, premise, characters, each object's look line, every clue card's text with
`{{slots}}` (for example `"DEP {{dep_time}}, PLATFORM {{platform}}"`), the story beat
for each solve, three hint rungs per step, finale text, ending. Code fills the slots
(as `prose.ts` already inserts code literals), checks every slot appears exactly where
it must and nowhere else, and runs the one text-only repair if not.

### 3f. The engine: deterministic, server-authoritative, generic

Schema v2 is **data the engine interprets**: objects (hotspot plus archetype plus initial
state), controls, items, cards, and **rules** (`when control clock.time == {{dep_time}}
→ set clock.panel=open; grant cipher_wheel; beat "…"`). The server evaluates rules; the
answers stay in `private.puzzle_solutions` as today. Continuous controls (hands, dial)
give local mechanical feedback immediately and send their value **on release**; the
server confirms (about 200 ms) and returns effects. A wrong value is just "nothing
happens", plus mode-flavoured feedback (and the existing cooldown for code locks).

Hints become per-step ladders in the casebook (already shaped like `hints[3]`).

---

## 4. A complete example room (noir)

**Input:** five 0.5× photos of a bedroom. Perception finds a wall clock (above the desk),
a desk with a three-drawer pedestal, a desk lamp, a bookshelf, a framed film poster, a
bed with pillows, a wardrobe with a mirrored door, an acoustic guitar, a snake plant and
a Bluetooth speaker. A rug is detected but only partly visible.

**Plan:** mode noir; finale `CombinationLock` (4 symbols → digits) on the wardrobe.
Threads: **Time** (Split → Set-state), **Signal** (Tool-reveal → Set-state → Ordering
out), **Decoder** (from Time) plus one Room-change. Two story fragments. Minted values:
departure 11:40, platform 3, frequency 96.3, symbol order ▲ ● ◆ ■, digits 7 2 9 4.

**Author output (abridged):** *"The Bookkeeper's Second Ledger."* Objective: *"Leo
Marsh kept two ledgers. The client arrives at midnight. Find the one he hid."*

### Walkthrough, about 8 minutes

| # | Player does | Room or casebook response | Motif or archetype |
|---|---|---|---|
| 1 | Sweeps the dark room; the desk lamp glints. Toggles it | Desk corner warms (light overlay). Beat: *"Leo worked late. Everyone said so."* | Light, room change, teaches the gestures |
| 2 | Slides the top desk drawer | Half a train ticket: **DEP 11:__ PLATFORM 3** (rendered card) | Drawer → Split (A) |
| 3 | Bottom drawer is stuck; the middle drawer has a 3-letter word lock | Locked, noted in the casebook ("needs a word") | Contain-lock (seeded, solved later) |
| 4 | Notices a book standing proud on the shelf, opens it | Pressed between pages: the other half, **__:40** | Readable → Split (B) |
| 5 | Drags the halves together in the tray | Card becomes **DEP 11:40, PLATFORM 3**. Beat: *"He bought a ticket. He never used it."* | Assemble, **breakthrough 1** |
| 6 | Opens the wall clock (stopped at 2:50) and drags its hands to 11:40 | Click; the face swings open (overlay). Inside: a **brass cipher wheel** | ClockHands, Set-state |
| 7 | Lifts a pillow (any order, earlier) | A matchbook, *Hotel Meridian*, with **"LEO" pencilled inside** | LiftUnder, story fragment plus the word |
| 8 | Back at the desk: the word lock takes L-E-O | Middle drawer opens: a **UV torch** | Contain-lock, **revisit** |
| 9 | Torch on the poster | Invisible ink glows: **"96.3. Count the lights."** | Tool-reveal, **revisit** |
| 10 | Turns the speaker's dial; static thins near 96.3 and locks with a haptic thunk | Four LEDs blink an order, ▲ ● ◆ ■, with matching tones (audio plus visual) | TuningDial → Ordering out |
| 11 | Rotates the cipher wheel's inner ring to **3** (from the platform) | The wheel now reads ▲=7 ●=2 ◆=9 ■=4 | Decoder, **breakthrough 2** |
| 12 | Wardrobe: rolls the four wheels to 7 2 9 4 | Mirror door swings; room lights flicker; the **second ledger** slides out. Ending text names the client | CombinationLock finale needs Time, Signal and Decoder |

Optional: the guitar's sound hole holds a pick engraved "L.M." (a fragment that
raises the observation rating). The plant soil has nothing, but the dig is fun and
quick. Herrings are now **cheap to check but not free**: they cost a gesture, not a
blind tap.

**Why it works:** nothing is copied. Each value is *assembled* (ticket), *revealed*
(UV), *heard* (radio) or *decoded* (wheel). Four objects are revisited. The finale
uses every thread. And every mechanic matches its object: you set a clock's hands, tune
a speaker, look behind a poster.

### Same photos, other modes

- **Crime scene, "Dinner for Three":** the clock's stopped time becomes **time of
  death**; the torn ticket proves suspect A was on the 11:40 train (alibi); the speaker
  replays a voicemail timestamp that **contradicts** suspect B. The finale is an
  evidence board: drag three proofs onto suspect, motive and method, then accuse.
  Fewer locks, more timeline and contradiction.
- **Paranormal, "The Tenant":** the room **changes between visits**. Leave the clock
  and come back and the hands have moved; the mirror fogs with a new word only after the
  radio is tuned. The finale is a ritual: perform the four learned rules in order
  (stop the clock, cover the mirror, silence the radio, speak the name), and the photo
  snaps from tinted to true colour.

---

## 5. Variety without losing coherence

Variety is **combinatorial over small, verified parts**, not new code per room:

- ~14 archetypes × ~9 motifs × 3 mode skeletons × story families × the player's own
  object layout. Two rooms rarely share a thread, because the objects differ.
- **Adding an archetype** (say a Typewriter that types a word) is one component, one
  engine contract and host rules. Every existing motif can use it at once.
- **Adding a motif** is data plus planner rules, property-tested on synthetic rooms.
- **Mode systems** give the biggest felt difference for the least code: the evidence
  board (crime), presence and room drift (paranormal), mechanisms and exit (noir).
- **Guards against sameness:** a per-player history of recently used motifs and
  archetypes biases the planner away from repeats; every room has to include at least
  one motif the player hasn't seen in their last three rooms when the objects allow it.

---

## 6. Cost: today vs. proposed

Prices from `cost.ts` (per 1M tokens: 2.5 Flash $0.30 / $2.50; 3 Flash $0.50 / $3.00;
3.1 Pro $2 / $12; 2.5 Flash-Lite $0.10 / $0.40). Photos ≈ 1.5–2.5k tokens each.
Today's 5–6 photos; v2 uses 5 (0.5×) or 6 (1×).

| Stage | Today | v2 proposed |
|---|---|---|
| Perception (per photo, Flash) | ≈ $0.015–0.02 | ≈ $0.02–0.025 (richer schema, +30% output) |
| Verification (Flash) | ≈ $0.008 | ≈ $0.003 (move to Flash-Lite; it's a yes/no pass) |
| Template / planner / simulate | $0 | $0 (code) |
| Prose / author | ≈ $0.04–0.05 (3.1 Pro, photos + ~3–4k out) | **A:** 3 Flash, ~10k out ≈ **$0.04**; **B:** 3.1 Pro spine (~1.5k out) + 3 Flash cards ≈ **$0.07**; **C:** 3.1 Pro for everything ≈ $0.13 ✗ |
| Repair (~15% of rooms, text only) | ≈ $0.005 avg | ≈ $0.003 avg (Flash) |
| **Total** | **≈ $0.07** | **A ≈ $0.065, B ≈ $0.095** |

- **Recommendation:** B. Pro writes the premise, characters, finale and ending (where
  voice matters), and Flash writes the many cards and hints (where structure matters).
  A/B test against A; if players can't tell, ship A.
- **No extra images.** Inspection views are crops of photos we already have, and
  every mechanism and state change is vector art drawn by the app. Generated images
  would cost $0.03–0.04 each, wouldn't match the player's real room, and add nothing
  the overlays can't.
- **Zero AI at play time.** Every outcome, hint and beat is generated up front;
  the engine is deterministic.
- **Retries:** keep today's ledger, spend cap and single repair. Perception results
  are cached per photo hash, so a retry after a later stage fails doesn't re-pay
  perception.

---

## 7. The hard problems, and answers

1. **Overlays on real photos can look cheap.** Don't fake photorealism. Use one art
   direction: inspection views as an illustrated case-file layer (ink lines, brass
   mechanisms, paper cards, mode-tinted light) over a softened crop. That's the same
   language as the covers and clue notes. Room-change overlays stay subtle: light
   pools, glows, pinned cards, an outline "ajar" sprite.
2. **Perception mistakes** (a round mirror called a clock). Hosts need
   *features* (`has_hands`), not just types; confidence and visibility thresholds
   apply; verification gets a feature question. If an object is uncertain the planner
   simply doesn't give it a demanding archetype.
3. **Sparse rooms** (a dorm with four objects). Skeletons scale down to 2 threads
   (about 5 minutes) and lean on props inside the few containers. Below a floor, the
   build fails kindly with "add a close photo of a desk or shelf", as `too_few_objects`
   does today.
4. **Difficulty and pacing.** The simulator outputs metrics (steps, branching,
   revisits, longest chain); the planner targets a band per mode. Telemetry (time per
   step, hints per step, abandon points) tunes motif weights after launch. Hints stay
   three rungs.
5. **The LLM writing a clue that contradicts the logic.** It can't: it writes words
   *around* slots it doesn't control; code fills, checks no-leak and repairs once.
   The simulator never reads prose.
6. **Engine complexity in PL/pgSQL.** A generic rule interpreter is painful in SQL.
   Move the engine to TypeScript, shared by the server action function, the
   validator, the simulator and offline tests, with Postgres keeping state and
   secrets. (The `scripts/trial/engine.js` mirror already points this way.)
7. **Accessibility of gestures.** Every control has a non-gesture path (steppers,
   VoiceOver adjustable values, "tap to set" pads). Audio clues always have a visual
   twin, and haptics are never required.
8. **Scope.** 14 archetypes is a lot of UI. Ship 6–8 first; the motif system is useful
   with a small kit and grows without rework.
9. **Migration.** v1 rooms keep playing on the v1 engine; v2 is a new
   `schema_version`. The Study is re-authored by hand in v2 as the showcase and test
   fixture.

---

## 8. Implementation strategy

**Keep:** the 360 capture, the generation worker and job lifecycle, the cost ledger and
cap, perception and verification (extended), reconciliation, crypto minting, the
code-inserts-literals discipline, preflight plus SQL validation, hint ladders, sessions
and cooldowns, mode themes, sound and haptics, case closed.

**Replace:** templates → motifs plus planner; the bounding-box `HotspotLayer` → torch
discovery plus inspection views; `ResultSheet` as the main interaction → archetype
inspection views plus the casebook; schema v1 → v2 for new rooms.

| Phase | Goal | Done when |
|---|---|---|
| **0. Prove the fun (handmade)** | Schema v2 draft, TS engine, 5 archetypes (Drawer, Readable, ClockHands, CombinationLock, Light), torch discovery, inspection view, casebook. Hand-author **The Study v2** on its bundled photos | It's fun to play in about 8 minutes; go/no-go on the whole direction |
| **1. Engine and kit** | Server action function on the TS engine; +5 archetypes (FrameTilt, TuningDial, LiftUnder, Assemble, Decoder); room-change overlays; hints in the casebook | The Study v2 plays fully server-side |
| **2. Generation v2** | Perception v2 schema, archetype matcher, motif planner, simulator, author call (option B), slot filling and validation; property tests on synthetic inventories; a cost report per room | Generated rooms from saved test photos pass the simulator and the bar in §2, at ≤ $0.10 |
| **3. Modes** | Evidence board and contradiction (crime); presence, drift and ritual (paranormal) | Each mode plays differently minute to minute |
| **4. Breadth and tuning** | More archetypes and motifs, sameness guard, telemetry-driven pacing | Back-to-back rooms feel different |

Phase 0 is deliberately small and cheap: it tests the **feel**, the thing generation
can't fix, before we build the factory for it.

---

## Chunk 1: what exists

The pure-logic core: no UI, no AI calls, no I/O. It lives in
`supabase/functions/_shared/v2/` (Deno-style `.ts` imports) and the app imports the same
files through `src/engine/v2.ts` (`import { applyAction } from "@/engine/v2"`); tsconfig has
`allowImportingTsExtensions` and Metro resolves exact paths, so there is one source of truth.
The crypto minting helpers moved from `templates.ts` to `_shared/mint.ts` (re-exported, no
behaviour change) so the core doesn't pull in the v1 pipeline.

| Module | What it holds |
|---|---|
| `taxonomy.ts` | Perception v2 input: `ObjectType` (closed list of ~70 household types with a category and a portable flag), `Feature` flags, `InventoryObject {id, label, type, features, box, photo_index, salience, fully_visible}` |
| `archetypes.ts` | The kit: `ARCHETYPES` (Drawer, LiftUnder, Readable, FrameTilt, ClockHands, TuningDial, CombinationLock, Light, Assemble, Decoder, Door), each with variants, host rules (type whitelist + required features), controls and their `ControlDomain`, submit domain, emits/accepts, overlays, `holdsItems`. `hostableArchetypes(obj)`, `normalize(domain, value)` |
| `types.ts` | Schema v2. Public `RoomDefinitionV2 {schema_version: 2, mode, title, objective, objects, items, cards, finale}`; server-only `RoomSecretV2 {slots, rules, steps (with 3-rung hints), ending}`; `PlayState`, `Action`, `ActionResult`, `PublicEffect` |
| `engine.ts` | `initialState(def)`, `applyAction(def, secret, state, action, {cooldownActive?}) → {state, result}`, `renderCard(card, secret)` |
| `validate.ts` | `validateDefinition(def, secret?) → string[]` (static: shape, ids, references, host rules, one exit, at most one removable, props only inside objects that hold them, answers only as slots) |
| `simulate.ts` | `simulate(def, secret) → {ok, errors, metrics, path}`: BFS over actions a player could make with what they've seen; proves solvable, no softlock, no shortcut past a thread, every slot on exactly one reachable card before it's needed; metrics `requiredSteps, maxChain, revisits, roomChanges, branching` |
| `motifs.ts` | `MOTIFS`: the motif library as data (cost, archetypes, per-room cap, per-mode weight) |
| `planner.ts` | `planRoom(inventory, {mode, seed, randomInt?, candidates?}) → {ok, definition, secret, report, summary} \| {ok: false, reason, detail}`; `analyzeInventory` |

**Rules model.** A rule is `trigger` (inspect, control, use, combine, submit, auto) +
`when` (control value, object state, submitted value, held item, solved step) → `effects`
(open, close, reveal, grant, consume, set_state, show_card, beat, overlay `light_on |
panel_open | glow_mark | pinned_card | object_removed`, complete). Each rule fires once and
may solve a step. Minted values are `{slot}` references; cards carry `{{slot}}` and are
rendered by the engine only when shown. Lock and accusation submits are `string[]`
(wheels, `[suspect, motive, method]`, or ritual object ids in order).

**For the UI (chunk 2):** render `definition.objects` (box, archetype, variant, controls,
`initial`); send `set_control` on release, `submit` for locks and the door; apply the
`result.effects` (cards arrive rendered; overlays are typed). For a local preview, keep a
`PlayState` and call `applyAction` with the secret. Wrong submits return
`{outcome: "wrong", start_cooldown: true}`; the server owns the timing and passes
`cooldownActive`.

**For generation (chunk 3):** perception v2 produces `InventoryObject[]`; call
`planRoom(inventory, {mode: genre, seed: roomId})`. On `{ok: false}` map `too_few_objects`
and `no_exit` to `ErrorCode.tooFewObjects` (the detail says what to add). The author call
rewrites `title`, `objective`, `ending`, card titles and texts (keeping each `{{slot}}`
exactly once), item names, accusation option names, `beat` texts and step hints; then
re-run `validateDefinition` and `simulate` before publishing.

**Tests:** `cd supabase/functions && deno test --allow-read _shared/v2/` (archetype host
rules, engine actions, validator, simulator, the planner on hand-written rooms, and a
property test over 300 synthetic inventories × 3 modes); `npx jest src/engine` checks that
the app runtime can import and run it.

**Simplified in chunk 1:** the crime finale is a three-dimension, three-option lock whose
answers are evidence cards, and the paranormal ritual is one ordered submit of object ids
at the door (no evidence board or room drift yet). MirrorFog, Sequence, Arrange and Dig
aren't in the kit yet. The removable object is an optional keepsake (take it, it leaves
the photo). Herrings are empty containers. All words are placeholders for the author call.

---

## Chunk 2: the v2 player (app only)

Every room now opens on the v2 player (`app/play/[roomId].tsx` → `src/play2/PlayerV2.tsx`).
Generation v2 isn't wired yet, so the room is **planned on the device from its v1 objects**:
`adapter.ts` reads each v1 hotspot's label as a taxonomy type (`typeForLabel`: type names, then
synonyms such as closet → wardrobe, painting → framed picture), gives it that type's typical
features and turns its box into an `InventoryObject`; `planFromV1` runs `planRoom` seeded by the
room id (minted values too), so a room always plans the same way. No model call, no server
change. A room the planner can't build (no door or door-like exit, too few objects) falls back to
the v1 player, as does `?v=1`. Words are the planner's placeholders until the author call
(chunk 3) writes them.

| Piece | File | What it does |
|---|---|---|
| State | `useRoomV2.ts` | Loads the room (`startOrResume` → v1 definition → plan), runs actions through `applyAction` locally, saves progress per room in AsyncStorage and resumes it, a 5 s cooldown after a wrong submit, the hint ladder (`nextStep`: the first open required step whose prerequisites are solved; rungs 1–3), restart |
| Discover | `Stage.tsx` | The photo in the dark (per-mode darkness); one finger sweeps a torch beam (Skia, punched out of the dark); objects glint (a blurred outline) as the beam passes, weaker once seen; a lit lamp throws its own pool of light; UV marks glow, opened panels and pinned cards show. A tap looks at the smallest object under the finger; a fast horizontal fling turns the view. Screen readers get a button per object (`onAccessibilityTap`) |
| Inspect | `InspectView.tsx` | The close-up: a vignetted crop of the real photo around the object (`cropAround`), settling in; the archetype's mechanism under it; cards it turned up on paper; "Use something you're holding"; "Take it" for the removable object |
| Manipulate | `mechanisms/` | One component per archetype (Drawer, LiftUnder, Readable, FrameTilt, ClockHands, TuningDial, CombinationLock, Light, Door, Decoder), contract in `mechanisms/types.ts`: local feel and detents, value committed on release |
| Learn | `Casebook.tsx` | Objective, every card found, what's held (examine an item: its card, or the decoder's ring), hints, Glints on/off (off is the hard way), restart |
| Tray | `PlayerV2.tsx` | Held items as chips: one selected, tap something in the room to use it; two selected, Fit together (combine); hold to examine |
| Payoff | `Ending.tsx` | The door's close-up fills the screen, light floods out of it, the ending's lines, then Close the case → case closed |

Settings: Show interactives keeps a faint outline on every object (accessibility); Glints in the
casebook. Tests: `src/play2/__tests__/` (adapter, a whole planned room played through the hook with
save and resume, cooldown and the hint ladder, the fallback; the mechanisms).

**Since chunk 3:** v2 rooms play on the server (below); the removable object's on-device fill is
drawn on the stage once it's taken (`useBoxPatch` in `src/render/removalPatch.ts`, the v1 fill on a
known box); crime scene's casebook has an evidence board (Who / Why / How from the door's lists,
tap to cross off, kept per room); paranormal's header has the presence meter, fading as required
steps are solved and gone at the end.

---

## Chunk 3: generation v2 and server-side play

New rooms are generated as schema 2 and played on the server. Rooms made before keep schema 1
and are planned and played on the device as in chunk 2.

| Piece | File | What it does |
|---|---|---|
| Perception v2 | `_shared/v2/perceive.ts` | One Flash call per photo, as v1, but each object comes back as a taxonomy `type` and `features` (doors included: every room leaves by one); v1's deny list minus doors; v1's verification and reconciliation; `toInventory` (salience from clarity, size and confidence; intrinsic features per type) |
| Generation | `_shared/v2/generate.ts` | For a job with `output_schema_version = 2` (the default now): perception v2 → privacy gate → inventory → `planRoom` seeded by the room id → the author call → `applyAuthor` → `validateDefinition` + `simulate` again (a failure keeps the planner's words) → stored with `photos` and `mode`. No door: `too_few_objects`, "Add a photo that shows the room's door." |
| Author call | `_shared/v2/author.ts` | One Pro call with the photos writes the title, objective, intro, ending, object and item names, cards, step titles and hint ladders, beats and (crime) the suspects, motives and methods. It sees answers only as `{{slot}}` and their kind. Per field, code keeps the planner's words when the model's break a rule: the same placeholders, each once; no digits outside them; length caps; distinct option names (renamed options rename their slots' text). A sentence that happens to contain an answer is dropped |
| Play | `_shared/v2/play.ts`, `play-action/` | `play(def, secret, stored, {action?, hint?}, now, lockedUntil)` is the whole request: the engine, the 5 s cooldown after a wrong submit, the hint ladder, the rendered casebook (`cards`, `hints`), `progress`, the ending once done. The edge function verifies the JWT, loads the caller's own session (`worker_v2_play_load`), runs `play()` and saves (`worker_v2_play_save`, refused with 409 `conflict` if another request saved first). The secret never leaves it |
| Storage | `migrations/20261027000100_gameplay_v2.sql` | Schema 1 and 2 side by side in `puzzle_versions` and `puzzle_solutions`; `private.validate_puzzle_definition_v2` (structure, one exit, photos, no answer in the public room); `worker_complete_generation_job` publishes either; new jobs ask for schema 2; the two service-only play calls. A v2 session starts with v1's empty state; `play()` turns it into the engine's on its first request |
| App | `src/play2/useRoomV2.ts`, `src/lib/escapd-api.ts` | One API for both: v1 rooms run `play()` on the device (secret planned locally, saved per room); v2 rooms call `play-action` (`playActionV2`), one request at a time, a conflict retried once after a load, restart abandons and starts again. Case closed reads a v2 session's stats as v1's |

Cost per room is v1's: three to six Flash perception calls, one Flash verification call, one Pro
call (the author call replaces the prose call and is about the same size).

Tests: `deno test --allow-read --allow-env` in `supabase/functions` (generation per mode with a fake
provider, the door and face failures, the author's fallbacks and option renames, `play()` from v1's
empty state to the end); `scripts/test-db.sh` (`supabase/tests/04_gameplay_v2.sql`: the v2 check,
publishing, the session, load and save, the stale-save guard, completion); `npx jest src/play2`.

**To ship it:** `supabase db push` (the migration), then `supabase functions deploy generation-worker`
and `supabase functions deploy play-action`. Until the migration is in, new jobs still ask for
schema 1 and everything plays as in chunk 2.

**Not yet:** a crime contradiction mechanic beyond the board, paranormal room drift (objects that
move between visits), MirrorFog, Sequence, Arrange and Dig, and telemetry-driven pacing (phase 4).
