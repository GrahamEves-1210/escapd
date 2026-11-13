# Escapd's Blender kit

Rendered props for the game: models built in Python, lit in one studio, drawn
with one ink line, exported at the sizes the app shows them. Nothing is
downloaded; everything regenerates from these scripts.

## The look

**Stylized realism with an ink line.** Real materials (aged brass, blued steel,
walnut, glass, felt, enamel, paper) on chunky, slightly exaggerated shapes; a
warm key light from the upper left like a candle or a desk lamp, a cool
moonlit rim on the far edge, shadows that stay plum rather than grey; and a
thin plum-black ink outline with lighter ink on inner edges, the way the cat is
drawn. No plastic gloss, no photoreal clutter, transparent backgrounds.

Why this one: the flashlight was rendered three ways and dropped into three real
screens, beside the cat on the shelf, on the paper letter, and by the walnut
drawer (`docs/look-trial.jpg`):

- **A. Toon + heavy line**: flat bands of colour. Reads at once, but it looks
  like clip-art next to the cat (which is painted, with soft shading inside its
  line) and next to the drawer's grain; the brass stops being brass.
- **B. Stylized-real + ink line** (chosen): the materials match the walnut and
  brass of the close-ups, and the line does what the cat's line does: it holds
  the shape on cream paper, where C's lit edge melts into the page, and it
  disappears into the dark of the room, where the rim light takes over.
- **C. Stylized-real, no line**: fine on dark, but on paper and on walnut it
  looks pasted in: a render sitting on a drawing.

Colour: **Standard view + Medium High Contrast**. AgX and Khronos Neutral were
tried on the same brass: both grey its highlights and crush its warm shadows to
black (the torch looked like bronze with a fat outline); Standard keeps brass
gold from its shadows to its glints, and a lit lens blooms warm instead of pale.
The cost is that very bright things clip, so glows are kept modest (`M.glow`
strengths of 2 to 30, not hundreds).

## Run

```sh
PY=<scratchpad>/bpyenv/bin/python     # Python 3.13 with bpy 5.3, Pillow, pngquant-cli, pyoxipng
$PY scripts/blender/props/flashlight.py   # renders, exports into assets/, prints anchors and sizes
$PY scripts/blender/props/magnifier.py
$PY scripts/blender/swatches.py out.png   # every material on one finial (docs/swatches_*.jpg)
```

To make the environment elsewhere: `python3.13 -m venv env && env/bin/pip install
bpy pillow pngquant-cli pyoxipng`. Headless, Cycles on the CPU (no GPU, no EEVEE
here). A 264 px tool rendered at 2x with 96 samples takes about 15 s on 4 cores.
Raw renders go to `$ESCAPD_RENDER_DIR` (default: the system temp dir), never the repo.

## Files

| file | what it is |
|---|---|
| `kit.py` | scene reset, render settings, cameras (`camera`, `fit`, `project`), the studio, `window` (the highlight on flat glass), the contact shadow, the ink line, modelling helpers (`lathe`, `knurl`, `flutes`, `box`, `bevel`, `group`), `render` |
| `materials.py` | the material shelf: `brass steel silver walnut ebony glass gel enamel felt paper leather wax ceramic rubber glow flame lit ink toon` |
| `export.py` | trim, scale (premultiplied), quantise/optimise, write `name.png / @2x / @3x`; `sprite_sheet`; `lift_glass`; `bloom` (the halo round something lit); contact sheets (`sheet`, `side_by_side`) |
| `props/*.py` | one script per asset or family; each ends by exporting into `assets/` |
| `swatches.py`, `docs/` | the material sheet, the look trial |

A prop script in full:

```python
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import bpy, export, kit, materials as M

kit.reset()
kit.setup(size=(264, 264))                       # the app's size x3; rendered at 2x and scaled down
body = kit.lathe([(0, 0), (0.5, 0), (0.5, 1.2), (0, 1.2)], max_len=0.02, displace=kit.knurl(40, 0.012))
kit.bevel(body, 0.01); kit.assign(body, M.brass(age=0.6))
cam = kit.camera("product")                      # or "front", "held", "top"
kit.fit(cam, [body], margin=1.1)                 # or set span yourself for fixed framing
kit.studio(cam, span=1.2, target=(0, 0, 0.6), shadow=0.0)
kit.outline(2.0)
src = kit.render(export.scratch("thing.png"))
export.export(src, "assets/props/thing.png", sizes=(88, 88))
```

## Conventions

- **Units and axes.** Blender units; a prop is about 2 units on its long side
  (materials' grain and brushing are tuned for that; pass `scale=` to a material
  for a prop much bigger or smaller). Z is up, the prop stands on z = 0, the
  camera is on -Y, so +X is the picture's right.
- **Camera.** Orthographic always (props keep their proportions at any size and
  sit with the game's flat paper). Views: `product` (28 degrees up, 28 degrees
  round to the right: boxes, objects on a desk), `front` (straight on: plates,
  dials, close-up panels), `held` (straight on from 26 to 30 degrees above:
  things held upright that you look down into), `top` (flat lay: paper, cards).
  `kit.fit` frames to the objects; when the app positions by fractions of the
  picture (a pivot, a lens), keep the framing fixed across variants and print
  the anchors with `kit.project(cam, point)`.
- **Light.** `kit.studio(cam, span=<prop size>, target=<its middle>)`, nothing
  else. It turns with the camera, so the warm key is always upper left in the
  picture and the cool rim lower right/behind. Don't move it per asset: the
  set reads as one desk because the light never changes. `key= fill= rim=
  ambient=` scale the parts if a prop needs it (1 = house). Reflections see the
  lights 2.4x brighter than matte surfaces do (`gloss`), which is why brass is
  rich while paper and enamel keep their colour: leave it.
- **Shadow.** `studio(shadow=z)` draws a soft plum contact shadow on the ground
  at height z, in the alpha, fading out before the frame (give `fit` a margin of
  1.3 or more). Use it for things that sit on a surface in a fixed place. Leave
  it out for things the app moves, turns or shadows itself (the tools).
- **Ink line.** `kit.outline(weight)`: weight is in pixels at the exported @3x
  size; inner edges get 60% of it. House weights by the size the asset is shown
  at: **up to 100 pt: 2 px; 100 to 200 pt: 3 px; bigger (close-ups): 4 px**
  (so the line is 0.65 to 1.3 pt on screen, the cat's line). Pass glass, flames
  and glows in `exclude=` (no line on light) and knurled or very busy parts in
  `plain=` (outer line only). Colour is `kit.INK`, plum-black, never pure black.
- **Glass.** See-through glass on transparent film takes four things
  (`props/magnifier.py` is the worked example): `kit.setup(transparent_glass=True)`;
  `M.glass()` (keep `density=0`: tinted glass counts as part-opaque and greys what
  shows through; `ior` about 1.28 for a pane that must look clear); `kit.window(cam,
  at, normal, only=[glass])` for the highlight (the softboxes sit too far round to
  show in glass that faces you); and `kit.render(path, exr=True)` followed by
  `export.lift_glass(path)`, which puts back the highlight a PNG's straight alpha
  would lose. Glass in front of something solid (the torch's lens) needs none of it.
- **Light sources.** `M.glow` for the thing itself, `M.lit(material, ...)` for what
  it shines on from inside (a reflector), then `export.bloom(image, within=...)` on
  the full-size render for the halo that spills past its edge.
- **Colour.** Linear RGB in the scripts. Per-mode accents come from
  `src/theme/tokens.ts`; brass, walnut and ink are the same in every mode.
- **Sizes and files.** `export.export(src, "assets/<area>/<name>.png",
  sizes=(w, h))` with w, h the size in points the app shows it at: writes
  `name.png`, `name@2x.png`, `name@3x.png` (never bigger than x3), trimmed
  (or `canvas=True` to keep the render's framing). Names are lower-case,
  hyphenated, variants as suffixes (`flashlight-uv`). Budget: 150 KB a still
  (the exporter flags anything over), 600 KB an animation (`export.sprite_sheet`,
  12 fps to match the cat's stop-motion). Palette quantising is used only where
  it doesn't band (checked automatically), oxipng always.
- **Samples.** 96 with denoising is the default and enough for metal and wood;
  glass and glows may want 128 to 192. Fireflies: lower a glow before raising
  samples.
- **Gotchas here.** `import bpy` before `bmesh` / `mathutils` (the module provides
  them). "Error: strokes set empty" from Freestyle is harmless (a line set found
  nothing to draw). Worn edges (`wear=`) come from the mesh's pointiness: they need
  a reasonably dense mesh and a bevel, and on small boxes everything counts as an
  edge, so turn `wear` down there. A lathe profile that ends where it began closes
  into a ring. If the outline shows small gaps on a ring, `outline(run_on=0.5)`.

## Checklist for a new asset

1. Find where the app shows it and at what size in points; that fixes `sizes`,
   the view and the outline weight.
2. Model it in `props/<name>.py` from `lathe`, `box` and primitives, about 2
   units big, standing on z = 0. Exaggerate: thicker rims, bigger knobs, fewer
   and larger details than the real thing. Bevel every hard edge.
3. Materials from the shelf, with parameters; add a new one to `materials.py`
   (and to `swatches.py`) only if nothing there will do.
4. `kit.camera`, `kit.fit`, `kit.studio`, `kit.outline` with the house weight.
5. Render, then **look at it** with `export.sheet` on a dark and a light ground
   and at its real size (the bottom row): does the silhouette read at 1x? Is
   anything a muddy blob at that size? Remove detail until it reads.
6. `export.export` into `assets/`; check the sizes it prints against the budget.
7. Wire it into the app (keep layout, testIDs, accessibility, gestures), and
   screenshot it in the real screen next to the cat or the paper it lives with.
8. Leave the script runnable: one command regenerates the files.

## Prop scripts added since (each regenerates its own assets)

| scripts in `props/` | renders | to |
|---|---|---|
| `flashlight.py`, `magnifier.py` | the torch, its UV twin, the magnifier | `assets/brand/` |
| `items_all.py` (+ `items_common/paper/metal/things.py`) | the 26 held-item icons | `assets/items/` |
| `charms_pins.py`, `charms_wardrobe.py`, `charms_board.py` (+ `charms_designs.py`) | charm pins, stickers, turns, wardrobe, velvet | `assets/charms/` |
| `mech_*.py` (+ `mech_common.py`) | close-up mechanism parts, in layers | `assets/mech/` |
| `reveal_*.py` (+ `reveal_common.py`) | lamp, mirror, lens, pencil, notepad binding, paperweight | `assets/reveal/` |
| `home_set.py`, `home_mug.py`, `home_parts.py` | home's set in depth layers, the mug and its tumble, the flame | `assets/home/` |
| `gadget_safe.py`, `gadget_keys.py`, `gadget_phone.py`, `gadget_balance.py` (+ `gadget_common.py`) | the object puzzles' parts, in layers: the safe's door, dial, lever and tell-tale; the key (four renders, one per cut depth: any bitting is put together from slices of them) and the soap it is pressed into; the telephone's body, finger wheel, stop and handset; the balance's stand, beam, pan and weight. A part the app turns is lit square on, with the studio's light as a still layer over it (`gadget_common.light_layer`) | `assets/gadgets/` |
| `items_gadgets.py` (rendered by `items_all.py`) | the gadgets' held things: soap, wax, balance, weight, music box, ribbon | `assets/items/` |
| `darkroom_set.py`, `darkroom_parts.py` (+ `darkroom_common.py`) | the build wait's darkroom: the bench under a red safelight (one camera, no turn, so a photo lies flat in the tray with one transform), the tray on its own to rock, twelve computed frames of light on the liquid; the drying line, pegs (one per mode, handles dipped in its accent) and the sheets of paper with a window for the player's photo. `PX=1 SS=1 SAMPLES=32` for a quick look | `assets/develop/` |

The charms scripts also need `shapely` in the bpy env (`pip install shapely`).
| `reveal_musicbox.py`, `reveal_ribbon.py` | the music box and the typewriter ribbon spool | `assets/reveal/` |
| `moment_*.py` (+ `moment_common.py`) | envelopes opening, the door onto the street, the stamp, the candle going out | `assets/moments/` |
| `camera_*.py` (+ `camera_common.py`) | the vintage camera's chrome for the capture screen | `assets/capture/` |
