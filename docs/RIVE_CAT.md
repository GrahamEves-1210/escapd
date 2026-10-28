# The cat in Rive: brief for the Rive editor's MCP

Make the cat in the **Rive desktop editor** (Early Access) with its built-in
MCP turned on, using Claude on your computer. Export the file and commit it as
`assets/characters/cat.riv`; the app drives it through the state machine
below, so keep these names exactly.

## Art

Start from the existing art so the cat doesn't change:
- `assets/characters/cat_peek.png`: the cat peering over an edge, paws on
  the ledge (used in the game, the casebook, the close-up sheet, case
  closed). **Its pupils are painted out:** the eyes are drawn as
  separate shapes so they can move.
- `assets/characters/cat_sit.png`: the cat sitting (home's window sill,
  the ending, case closed).

Split each into parts and rig them: ears (L/R), head, body, paws (L/R),
tail (sit only), eye whites (L/R), pupils (L/R, vertical slits that can
widen), eyelids (L/R). Keep the inky hand-drawn look; no gradients.

Two artboards: **`Peek`** (560x585, the peeking cat; its bottom edge sits
at the ledge, so nothing below the paws) and **`Sit`** (444x640).
Transparent background on both.

## Feel

Stop motion: animate on 12 fps (hold keys, no smooth tweening on the body),
pose to pose with a little squash and stretch, like the BitePal raccoon's
peeks and pops. Small, cute, never exaggerated. Eyes may move smoothly.

## State machine: `Cat` (on both artboards)

Inputs the app sets:

| input       | type    | meaning |
|-------------|---------|---------|
| `mood`      | number  | 0 idle (breathing, blinks, the odd head tilt), 1 thinking (head cocked, eyes up, "?" marks floating up), 2 sleepy (eyes shut, slow breath, "z" marks) |
| `lookX`     | number  | -100..100: where the pupils look (left to right) |
| `lookY`     | number  | -100..100: where the pupils look (up to down) |
| `light`     | number  | 0..100: how close the flashlight is (100 = right on it, pupils narrow to slits; 0 = dark, pupils round) |
| `rise`      | trigger | peek up from behind the edge (Peek) / pop in (Sit) |
| `found`     | trigger | happy pop: crouch, stretch up, settle, sparkles and a "!" |
| `wrong`     | trigger | flinch: duck down, eyes half shut, a little shiver |
| `pet`       | trigger | a happy wiggle and a heart |
| `annoyed`   | boolean | lids half shut, ears back (too much petting, a cooldown) |
| `point`     | number  | -100..100: lean toward a side when hinting (0 = none), with a small "!" |

Blinks (sometimes double) and breathing loop on their own in every mood.

## The prompt to give Claude in the Rive editor

> Using the Rive MCP, build a character file for a black cat mascot from
> `cat_peek.png` and `cat_sit.png` (attached / in the project). Follow the
> brief in docs/RIVE_CAT.md exactly: two artboards `Peek` and `Sit`, rigged
> parts, a state machine named `Cat` with the inputs mood, lookX, lookY,
> light, rise, found, wrong, pet, annoyed and point. Animate on 12 fps,
> pose to pose, small squash and stretch, inky hand-drawn style. Export
> `cat.riv`.

## In the app

Rive's React Native runtime is native code, and the app currently runs in
Expo Go, which can't load it. Two ways in, decided when the file arrives:
1. **A development build** (expo-dev-client + EAS): the official runtime,
   best performance; you'd install your own build of the app instead of
   Expo Go.
2. **Rive's web runtime in a WebView** (react-native-webview, which Expo Go
   includes): works today with no build change.

The cat component keeps its current hand-coded animation as the fallback.
