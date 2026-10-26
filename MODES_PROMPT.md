# Escapd: three modes, new home screen

This supersedes GAME_FEEL_PROMPT.md sections 3 (hub as desk) and 7 (cold open). Everything else in that file still applies: haptics, sound, diegetic play screen, case-closed stamp, noir voice. If you're mid-way through it, finish the current step, commit, then start here. Branch `redesign-noir`. Commit after each part.

## The concept
Escapd has three modes. The same bedroom photos produce a completely different case in each one, because **the mode changes what the AI decides each object means**, not just the colors.

| | DETECTIVE NOIR | CRIME SCENE | PARANORMAL |
|---|---|---|---|
| Tagline | Solve the case | Find the killer | Face the unknown |
| Story | Disappearance, theft, conspiracy, forgery | A fictional murder happened here | The room is haunted |
| Room look | Black & white, high contrast, grain, brass accents (builds on the current look) | Desaturated, deep blood-red shadows and accents, harsh flash light | Pale, cold blue-green (ectoplasm), lifted blacks, soft glow |
| Mirror means | Hides a coded message | Reveals a timeline contradiction | Shows a reflection that shouldn't exist |
| Desk means | Encrypted documents | Evidence breaking an alibi | Drawers that moved on their own |
| Dresser means | A stolen item | The weapon | Symbols carved into it |
| Finale | Enter the code that cracks the case | **Accuse:** who, why, how | **Banish:** perform the right actions in the right order |

## Part 1: Engine (supabase + generation). Plan first, show me the plan before coding.
1. **Genre on rooms.** Migration: add `genre text not null default 'noir' check (genre in ('noir','crime_scene','paranormal'))` to `rooms`. Pass it through `create_room` / `request_room_generation` (new optional param, default `'noir'`) and `worker_claim_generation_job`. Existing rooms and the tutorial become `noir`. Update `database.types.ts`, `escapd-api.ts`, and the SQL tests.
2. **Per-genre story families** in `schemas.ts`, replacing the single list. Noir: missing heiress, forged painting, double agent, stolen ledger. Crime scene: dinner-party poisoning, locked-room death, inheritance dispute, a business partner. Paranormal: a former tenant, a cursed heirloom, a séance gone wrong, a time loop.
3. **Per-genre object reinterpretation** in the prose brief (`buildBrief`). Give the model the genre's voice and the "what objects mean" rules from the table above, applied to the actual hotspot objects.
4. **Per-genre templates** in `templates.ts`. Keep the "templates own causality, the model only writes prose" rule and all existing template invariants and tests.
   - **Noir:** the existing templates.
   - **Crime scene:** new step kind `accuse`. Generate 3 fictional suspects (name, role, one-line alibi), 3 motives, 3 methods. Clues found in the room must break exactly one alibi and point to one motive and one method.
     - The answer lives in `private.puzzle_solutions` only. Add an `accuse` action to `submit_action`: it checks the triple server-side, a wrong accusation counts like a wrong code (same cooldown), and it returns no partial-correct leaks.
     - Extend `validate_puzzle_definition` and the solvability simulation so every accusation is provably deducible from clues.
   - **Paranormal:** a finale of 3 ordered actions (e.g. light the candle → cover the mirror → read the name aloud), built from the existing `use_item` / `inspect` kinds chained with `requires`.
     - Add optional `effect` to hotspots: `flicker | apparition | moved | cold | whisper`. The client renders it as an overlay; no AI image editing.
5. **Content rules in every genre prompt:**
   - Suspects, victims and ghosts are fictional. Never cast a real person seen in a photo as a character.
   - No gore and no graphic injury; target a 12+ rating.
   - Paranormal is eerie, not demonic or self-harm.
6. Cost must stay about the same per room (~$0.07): no extra model calls unless you show me the cost first.
7. Tests: template invariant tests for the new templates; SQL tests for `accuse`; a generation fixture per genre.
8. **Stop and ask me before `supabase db push` or deploying functions.**

## Part 2: Home screen and mode looks
1. **Home (/) = three solid, artful mode cards:** DETECTIVE NOIR, CRIME SCENE, PARANORMAL. Remove the THE STUDY / YOUR ROOM / YOUR CASE cards.
   - Each card is a full-bleed illustrated panel in its mode's palette, with the mode name in the display face, the tagline, and a small count of the player's cases in that mode.
   - Solid and physical, not glass.
   - Signature touch: if the player has photographed a room, each card shows **their own room in that mode's treatment** (B&W / red / ghost blue-green). That's the whole pitch in one glance. Otherwise use default art.
2. **Tapping a mode** opens that mode's screen: a "New case" button (photograph a room → capture → light table → darkroom, all tinted to the mode) plus the player's cases in that mode, shown as case files with OPEN / IN PROGRESS / CLOSED stamps. Non-Pro players see the Pro lock on "New case".
3. **Tutorial:** the first tap on Detective Noir runs The Study tutorial. After that, The Study can be replayed from inside the Noir mode screen. Crime Scene and Paranormal show a one-screen "how this mode works" the first time.
4. **Mode themes.** Add `modeThemes` to `tokens.ts`. The app shell (home, Pro, account) stays the brand: ink + brass. Inside a mode, the screens use that mode's palette.
   - **Noir:** monochrome, warm brass.
   - **Crime scene:** near-black, blood red (pick a rich red, not neon), bone white, police-tape yellow only as a tiny accent.
   - **Paranormal:** pale desaturated blue-green, cold white, soft glow.
5. **Photo treatment:** use `@shopify/react-native-skia` (it works in Expo Go) ColorMatrix plus grain/vignette on the scene photos in /play, on the light table, and on the hub cards.
   - Noir: grayscale with high contrast.
   - Crime scene: desaturated with red-pushed shadows.
   - Paranormal: cool blue-green tint with lifted blacks.
   - Must stay smooth while panning and zooming.
6. **Mode-specific play UI:**
   - Crime scene adds a **Suspects** tab (cards with alibis that get stamped CONTRADICTED when a clue breaks them) and an **Accuse** screen (pick who / why / how, then a dramatic reveal).
   - Paranormal adds the hotspot `effect` overlays and a "the presence" meter that rises as you find anomalies.
7. **Case closed per mode:**
   - Noir: CASE CLOSED stamp.
   - Crime scene: GUILTY stamp over the suspect card.
   - Paranormal: the room snaps from tinted to full normal color, "The presence is gone."
8. Use the screenshot harness: home, each mode screen, /play in each mode, the accuse screen, and each case-closed screen. Compare against this brief.

## Rules
- Never green/mint, Outfit or Inter (that's build-a-player).
- Fonts: Google Fonts only. Audio: CC0 or self-made.
- Respect Reduce Motion. Keep 60fps.
- Don't break existing tests.
- Finish with a short summary per part, anything you skipped, and the commands to run (including anything I must approve).
