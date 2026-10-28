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

## The full build brief (for Claude via the Rive MCP, or Rive's Agent in build mode)

Work step by step and say when each step is done. Never repaint or redraw
the cat's art; only add rig, bones, shapes and animation. The names below
(artboards, state machine, inputs) must match exactly: the game calls them.

### Step 1 – set up
- Artboard 1 holds the cat SITTING (image cat_sit). Rename it "Sit". Fit the
  artboard snugly around the image with a little padding above the ears for
  floating marks. Transparent background.
- Artboard 2 holds the cat PEEKING over an edge (image cat_peek), paws at the
  bottom. Rename it "Peek". Move the image so the paws sit exactly on the
  artboard's bottom edge (the cat rises from behind that edge in the game).
  Leave ~25% extra space above the ears for floating marks. Transparent.

### Step 2 – rig
For each image, add a mesh to the image and bind it to bones so it deforms
smoothly (dense mesh around the ears, head and paws):
- Bones: root (bottom centre) → body → neck → head; from head: ear_left,
  ear_right (base to tip); from root: paw_left, paw_right; Sit only: tail
  (3–4 bones from the tail's base to its tip).
- Weight it so the head turns without stretching the body, the ears flick
  independently, and the tail bends along its chain.

### Step 3 – eyes (both artboards)
- Peek's pupils are painted out: draw two pupils as vector shapes, solid
  #0B0806 vertical slits with rounded ends, centred on each yellow eye,
  parented to the head bone, each inside a clipping group shaped like its
  yellow eye so it never leaves the eye.
- Sit's pupils are painted in the art: draw matching pupil shapes over them
  the same way so they can move too.
- Eyelids: per eye, a #0B0806 shape covering the eye, parented to the head;
  0% tall (anchored at the top edge) when open, 100% when shut.

### Step 4 – marks (vector shapes above the head, hidden by default)
"?" (question mark), "z" (two sizes), "!" (exclamation), four small 4-point
sparkle stars, a small heart. Thick rounded strokes, cream #F8EEF1 with a soft
dark outline so they read on dark and light backgrounds.

### Step 5 – animations
Style: stop motion at 12 fps (animation fps 12, HOLD interpolation on the
body, head, ears, paws and tail), pose to pose, small squash and stretch (max
~8%), cute, never exaggerated. Pupils and lids may interpolate smoothly.
Timelines on BOTH artboards unless noted:
- idle (loop, ~4 s): breathing (body scaleY 100→102.5%), a slow ear twitch,
  the odd small head tilt (±4°); Sit: slow tail sway.
- blink (one-shot, 0.25 s); blink_double (0.45 s, two quick blinks).
- think (loop): head cocked ~6°, pupils up and to the side, "?" marks rising,
  wobbling and fading one after another.
- sleepy (loop): lids shut, slower deeper breathing, a slight slump, "z" marks
  drifting up and to the side and fading.
- rise (one-shot, ~0.6 s): Peek starts hidden below the bottom edge and pops
  up (stretch going up, squash as the paws land); Sit pops in from a small
  scale with a squash and settle.
- found (one-shot, ~0.5 s): crouch (squash), stretch up, settle; "!" pops
  above the head, 4 sparkles burst out and fade.
- wrong (one-shot, ~0.7 s): quick flinch down (squash), a small shiver (head
  ±3° twice), lids half shut, then recover.
- pet (one-shot, ~0.6 s): happy wiggle (head side to side), eyes squeeze shut
  briefly, a heart floats up and fades.
- annoyed (loop): lids half shut, ears back ~15°; Sit: slow tail flick.
- point_left / point_right (loop): lean ~6° toward that side, a small "!"
  bobbing on that side.

### Step 6 – state machine "Cat" (both artboards)
Inputs (exact names):
- number `mood`: 0 = idle, 1 = think, 2 = sleepy
- numbers `lookX`, `lookY` (-100..100): pupil position in the eye (blend
  between far left/right/up/down pupil poses)
- number `light` (0..100): 0 = round wide pupils (dark), 100 = thin slits
- triggers `rise`, `found`, `wrong`, `pet`
- boolean `annoyed`
- number `point` (-100 = point_left, 0 = none, 100 = point_right)
Layers:
- Body: entry → rise, then idle; mood 1 → think, 2 → sleepy, 0 → idle;
  annoyed true → annoyed, false → back to the mood's state; point ±100 →
  point_left/point_right, 0 → back.
- Reactions: any state → found / wrong / pet on their triggers (rise too,
  for a re-peek), each returning to an empty state when done, blended over
  the body.
- Eyes: a 2D blend for lookX/lookY and a 1D blend for light (pupil width);
  blinks on their own, random every 2.5–6 s, sometimes blink_double, never
  while sleepy (lids stay shut).

### Step 7 – check and export
Play the state machine and test every input; report anything that didn't
work. Then export for runtime as `cat.riv` into `assets/characters/cat.riv`.

## In the app

Rive's React Native runtime is native code, and the app currently runs in
Expo Go, which can't load it. Two ways in, decided when the file arrives:
1. **A development build** (expo-dev-client + EAS): the official runtime,
   best performance; you'd install your own build of the app instead of
   Expo Go.
2. **Rive's web runtime in a WebView** (react-native-webview, which Expo Go
   includes): works today with no build change.

The cat component keeps its current hand-coded animation as the fallback.
