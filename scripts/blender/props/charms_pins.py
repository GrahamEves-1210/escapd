# The charm collection's pins and stickers (src/screens/collection): each of the
# nine designs (charms_designs.py) as
# - a hard-enamel pin, gold or silver: a metal plate, raised polished lines,
#   glossy enamel sunk between them, a slight dome, a contact shadow on the board
#   (flat-lay: seen from straight above, lit by the house studio plus a jeweller's
#   white card over the lens, see card());
# - a paper sticker: die-cut with a white border, a matte print, one corner
#   curling up off the board;
# - its place on the board before it's earned: its shape pressed into the velvet
#   (a light-and-shade overlay, so it sits on whatever the board is);
# - the turn case closed plays before it's pinned (gold and silver): the pin
#   swinging round to face you through the key light's glint, 10 frames at 12 fps.
#
# All in one fixed framing (the design's 64 box is the picture), so every file
# registers with every other.
#
#   <bpy python> scripts/blender/props/charms_pins.py                 # everything -> assets/charms/
#   <bpy python> scripts/blender/props/charms_pins.py stills key moon # only some (stills | hollows | turns | sheets, then kinds, then finishes)
#   OUT=<dir> ...        # where the raw renders go (and the contact sheet, charms-sheet.png)
#   REUSE=1 ... hollows  # grade the hollows again from the last renders;  KEEP=1 ... turns  # only the sheets not there yet
#
# Needs shapely as well as the kit's packages (pip install shapely into the bpy Python):
# the designs' outlines, rims and cells are 2D geometry (charms_designs.py).
# The whole set is about 230 small renders: 30 to 60 minutes on 4 free cores.
import math
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
from mathutils.geometry import tessellate_polygon  # noqa: E402
from PIL import Image, ImageFilter  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402
from charms_designs import BOX, KINDS, UNIT, Design, _polys, lin, world  # noqa: E402

SIZE = 64                  # points on the board (CollectionScreen's BOARD.charm); case closed pins it at 60
TURN_SIZE = SIZE           # the turn's frames, in points x3: the still's own pixels, so the last frame is the still
LINE = 2.0                 # the ink line, px at @3x (house weight up to 100 pt)
THICK = 0.074              # a pin's thickness (the top of its metal)
SUNK = 0.013               # how far the enamel sits under the metal
PAPER = 0.007              # a sticker's thickness
DOME = 0.065               # how much a pin bows: its middle this much higher than a point one unit out
FINISHES = ("gold", "silver", "sticker")
# The turn: at each frame the pin's angle about its upright axis and how far it leans back
# (toward the key, upper left), ending face on (the still).
TURN = ((-66, -5), (-54, -5), (-42, -5), (-31, -5), (-21, -5), (-12, -5), (-4, -4), (5, -3), (2, -1), (0, 0))
KEY = 1.5                  # the key light, against the house 1
WARMTH = (1.0, 0.90, 0.76) # ... and its colour (house: 1, 0.82, 0.60)
CARD = float(os.environ.get("CARD", 1.6))   # the reflector card's brightness (see card())
SS = int(os.environ.get("SS", 1))           # supersampling: 1 here (no Freestyle line to smooth: the ink line is geometry)
VELVET = "#2A1D31"         # the board (CollectionScreen's VELVET)
# A hollow's shade and light, against what the render gave: felt shades very flat under the
# studio (as the board's velvet does, charms_board.py), so the form is drawn out.
HOLLOW = tuple(float(v) for v in os.environ.get("HOLLOW", "7,6,0.16").split(","))  # shade, light, the floor's darkening
OUT = os.environ.get("OUT") or export.scratch("charms")
SAMPLES = int(os.environ.get("SAMPLES", 128))


# ---------------------------------------------------------------- meshes


def grid_cut(bm, step):
    """Cut a mesh on a grid every `step` design units in x and y (so it has vertices to bend at)."""
    lo, hi = -BOX / 2 * UNIT, BOX / 2 * UNIT
    for axis, no in ((0, (1, 0, 0)), (1, (0, 1, 0))):
        v = lo + step * UNIT
        while v < hi:
            co = [0, 0, 0]
            co[axis] = v
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, dist=1e-6)
            v += step * UNIT


def slab(geom, front, back=0.0, name="slab", dome=DOME):
    """A flat shape (design units) as a solid lying on the board: its face at z = front
    (toward the camera), its back at z = back. `dome`: the whole solid bowed like a struck
    pin (its middle that much higher than a point one unit out), so a highlight grades
    across its face instead of the face going one flat tone."""
    verts, faces = [], []
    for poly in _polys(geom):
        loops = [list(poly.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in poly.interiors]
        base = len(verts)
        flat = [p for loop in loops for p in loop]
        n = len(flat)
        verts += [world(x, y) + (front,) for x, y in flat]
        verts += [world(x, y) + (back,) for x, y in flat]
        for a, b, c in tessellate_polygon([[Vector((x, y, 0)) for x, y in loop] for loop in loops]):
            faces.append((base + a, base + b, base + c))
            faces.append((base + n + c, base + n + b, base + n + a))
        start = 0
        for loop in loops:
            m = len(loop)
            for i in range(m):
                a, b = base + start + i, base + start + (i + 1) % m
                faces.append((a, b, b + n, a + n))
            start += m
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    bm = bmesh.new()
    bm.from_mesh(me)
    if dome:
        grid_cut(bm, 2.0)
        for v in bm.verts:
            v.co.z += dome * (0.75 - v.co.x ** 2 - v.co.y ** 2)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def sheet_mesh(geom, z=0.0, step=0.8, name="sheet"):
    """A flat shape as a single dense sheet (cut on a grid every `step` design units), so it
    can be bent. UVs are the design box (0..1, v up)."""
    bm = bmesh.new()
    for poly in _polys(geom):
        loop = list(poly.exterior.coords)[:-1]
        vs = [bm.verts.new(world(x, yy) + (z,)) for x, yy in loop]
        tris = tessellate_polygon([[Vector((x, yy, 0)) for x, yy in loop]])
        for a, b, c in tris:
            try:
                bm.faces.new((vs[a], vs[b], vs[c]))
            except ValueError:
                pass
    grid_cut(bm, step)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Faces toward the camera (+Z).
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for l in f.loops:
            l[uv].uv = (l.vert.co.x / 2 + 0.5, l.vert.co.y / 2 + 0.5)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def curl(ob, toward=(0.78, -0.62), length=0.30, radius=0.30, far=None):
    """Curl one corner of a sheet up off the board: everything within `length` of its
    farthest point in the direction `toward` (x, y) rolls toward the camera on a `radius`.
    Returns that farthest distance (pass it as `far` to bend another sheet about the same fold)."""
    d = Vector((toward[0], toward[1], 0)).normalized()
    me = ob.data
    far = max(v.co.dot(d) for v in me.vertices) if far is None else far
    t0 = far - length
    for v in me.vertices:
        t = v.co.dot(d) - t0
        if t <= 0:
            continue
        phi = t / radius
        v.co = v.co - d * t + d * (radius * math.sin(phi)) + Vector((0, 0, radius * (1 - math.cos(phi))))
    me.update()
    return far


# ---------------------------------------------------------------- materials


def metal(finish):
    if finish == "gold":
        return M.brass("gold", color=(0.80, 0.55, 0.19), age=0.12, brushed=0.12, wear=0.5, rough=0.2, axis="Y")
    return M.silver("silver", color=(0.84, 0.86, 0.90), rough=0.17, tarnish=0.12)


def print_material(design, name="print"):
    """A sticker's face: its print on white paper, matte, a whisper of sheen."""
    path = os.path.join(OUT, f"print-{design.kind}.png")
    design.print_image(768).save(path)
    t = M.Tree(name)
    tex = t.node("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(path)
    tex.extension = "EXTEND"
    uv = t.node("ShaderNodeTexCoord")
    t.link(uv.outputs["UV"], tex.inputs["Vector"])
    fib = t.noise(t.coords((60, 60, 60)), scale=1.0, detail=4, rough=0.7)
    col = t.mix(t.math("MULTIPLY", fib, 0.07), tex.outputs["Color"], (0.0, 0.0, 0.0), blend="MIX")
    b = t.principled(**{"Base Color": col, "Roughness": 0.62, "Specular IOR Level": 0.3, "Coat Weight": 0.12, "Coat Roughness": 0.4,
                        "Normal": t.bump(fib, strength=0.08, distance=0.002)})
    return t.surface(b)


# ---------------------------------------------------------------- the objects


def ink_line(geom, weight, name="ink"):
    """The kit's ink line, as a shape: `geom` grown by the line's weight (px at @3x), flat
    ink, to lie under the charm. (Freestyle's outer line is the outline against the empty
    background; a flat lay on the kit's shadow ground has none, so the line is modelled.
    Seen from straight above it is the same line: the same ink, the same weight.)"""
    return geom.buffer(weight * BOX / (SIZE * 3), 16)


def build_pin(design, finish):
    met = metal(finish)
    line = slab(ink_line(design.plate, LINE), 0.012, name="ink")
    kit.assign(line, M.ink())
    walls = slab(design.walls, THICK, name="metal")
    kit.bevel(walls, 0.0075, segments=2, angle=40)
    kit.shade(walls, 42)
    kit.assign(walls, met)
    parts = [line, walls]
    for i, (cell, fill) in enumerate(design.cells):
        # A hair wider than its hole, so no crack shows at the wall.
        ob = slab(cell.buffer(0.05), THICK - SUNK, name=f"enamel{i}")
        kit.shade(ob, 42)
        kit.assign(ob, M.enamel(f"enamel{i}", color=lin(fill), gloss=0.85))
        parts.append(ob)
    return parts


def build_sticker(design):
    ob = sheet_mesh(design.diecut, z=PAPER)
    far = curl(ob)
    m = ob.modifiers.new("solidify", "SOLIDIFY")
    m.thickness, m.offset = PAPER, -1.0
    kit.shade(ob, 50)
    kit.assign(ob, print_material(design))
    # Its ink line curls with it.
    line = sheet_mesh(ink_line(design.diecut, LINE * 0.8), z=PAPER * 0.4, name="ink")
    curl(line, far=far)
    kit.assign(line, M.ink())
    return [line, ob]


def stage(size, samples=SAMPLES, ss=SS):
    """The flat lay: the board is the ground, the camera straight above it, the studio
    turned so its key still comes from the picture's upper left."""
    kit.reset()
    kit.setup(size=(size, size), samples=samples, ss=ss)
    return kit.camera("top", span=BOX * UNIT, azim=-90)


def card(metal=(), strength=CARD):
    """A white card over the lens, as a jeweller shoots a flat pin: polished metal facing
    the camera mirrors whatever is behind the camera, and in the house studio that is the
    dark, so a pin's lines came out black. The card is only seen in reflections (it lights
    nothing, casts nothing, isn't in the picture), and only by the objects in `metal`
    (light linking: on enamel its reflection is a grey veil over the colour), and grades
    from bright by the key to dim at the far corner, so the domed face carries a soft
    highlight across its metal."""
    bpy.ops.mesh.primitive_plane_add(size=9.0, location=(0, 0, 5.0))
    p = bpy.context.object
    p.name = "card"
    p["kit_rig"] = True
    for ray in ("camera", "diffuse", "shadow", "transmission", "volume_scatter"):
        setattr(p, "visible_" + ray, False)
    t = M.Tree("card")
    tc = t.node("ShaderNodeTexCoord")
    dot = t.node("ShaderNodeVectorMath", operation="DOT_PRODUCT")
    t.link(tc.outputs["Object"], dot.inputs[0])
    dot.inputs[1].default_value = (-0.16, 0.16, 0.0)          # toward the key: the picture's upper left
    grade = t.ramp(t.math("ADD", dot.outputs["Value"], 0.5), [(0.0, 0.10), (0.42, 0.34), (0.72, 1.0), (1.0, 1.25)])
    e = t.node("ShaderNodeEmission")
    t.set(e.inputs["Color"], (1.0, 0.93, 0.84))
    t.link(t.math("MULTIPLY", grade, strength), e.inputs["Strength"])
    p.data.materials.append(t.surface(e))
    seen = bpy.data.collections.new("card_lights")
    for ob in metal:
        seen.objects.link(ob)
    p.light_linking.receiver_collection = seen
    return p


def light(cam, metal=(), shadow=True, strength=0.6, reach=0.07):
    # The house studio, a little brighter and a little less amber than for brass and walnut props:
    # flat enamel facing the camera takes the key at a slant, and its colours are the charm.
    kit.studio(cam, span=2.0, target=(0, 0, 0), key=KEY, warm=WARMTH, shadow=0.0 if shadow else None, shadow_strength=strength, shadow_reach=reach)
    card(metal)


def shoot(kind, finish, path, turn=None, size=SIZE * 3, samples=None, ss=None):
    """One charm in one finish, at rest on the board. With `turn` (a list of (angle about
    its upright axis, lean back) in degrees): in the air instead (no board, no shadow), one
    render per pose, `path` taking the frame's number; returns the paths."""
    cam = stage(size, samples or SAMPLES, ss or SS)
    design = Design(kind)
    parts = build_sticker(design) if finish == "sticker" else build_pin(design, finish)
    root = kit.group(parts, "charm")
    light(cam, [p for p in parts if p.name.startswith("metal")], shadow=turn is None, reach=0.10 if finish == "sticker" else 0.07)
    kit.no_outline()  # see ink_line()
    if turn is None:
        return kit.render(path)
    bpy.context.scene.render.use_persistent_data = True  # ten renders of one scene: keep it loaded between them
    out = []
    for i, (angle, lean) in enumerate(turn):
        root.rotation_euler = (math.radians(lean), math.radians(angle), 0)
        out.append(kit.render(path.format(i)))
    return out


# ---------------------------------------------------------------- not earned yet


def hollow(kind, path, px=SIZE * 3):
    """The charm's shape pressed into the board's velvet, as an overlay of light and shade
    (dark where the hollow's wall is in shadow, pale where it catches the key), from
    two renders of a velvet sheet: one with the hollow, one flat."""
    design = Design(kind)
    n = 220
    depth = 0.06
    mask = design.mask_image(design.plate.buffer(-0.5), n).filter(ImageFilter.GaussianBlur(n * 0.011))
    h = np.asarray(mask, dtype=np.float32) / 255.0

    def velvet(name, pressed):
        if os.environ.get("REUSE") and os.path.exists(os.path.join(OUT, name)):  # REUSE=1: grade the last renders again
            return os.path.join(OUT, name)
        cam = stage(px, samples=48, ss=1)
        bpy.ops.mesh.primitive_grid_add(x_subdivisions=n - 1, y_subdivisions=n - 1, size=2.0 * 1.3)
        ob = bpy.context.object
        if pressed:
            for v in ob.data.vertices:
                u = (v.co.x / UNIT + BOX / 2) / BOX * (n - 1)
                w = (BOX / 2 - v.co.y / UNIT) / BOX * (n - 1)
                if 0 <= u <= n - 1 and 0 <= w <= n - 1:
                    v.co.z = -depth * float(h[int(round(w)), int(round(u))])
        kit.shade(ob, 180)
        kit.assign(ob, M.felt("velvet", color=lin(VELVET), nap=0.9))
        kit.studio(cam, span=2.0, target=(0, 0, 0), key=KEY, warm=WARMTH)
        kit.no_outline()
        return kit.render(os.path.join(OUT, name))

    flat_path = os.path.join(OUT, "hollow-flat.png")
    if not os.path.exists(flat_path):
        velvet("hollow-flat.png", False)
    grey = lambda p: np.asarray(export.load(p), dtype=np.float32)[..., :3].mean(-1) / 255.0
    # Smooth the velvet's own fibre out of the difference: keep the form only.
    def blur(a, sigma=2.0):
        k = np.exp(-0.5 * (np.arange(-5, 6) / sigma) ** 2)
        k /= k.sum()
        a = np.apply_along_axis(lambda r: np.convolve(np.pad(r, 5, mode="edge"), k, mode="valid"), 0, a)
        return np.apply_along_axis(lambda r: np.convolve(np.pad(r, 5, mode="edge"), k, mode="valid"), 1, a)

    pressed, flat = blur(grey(velvet(f"{kind}-pressed.png", True))), blur(grey(flat_path))
    # (Less a little: what's left of the fibre in the difference is not form.)
    shade = np.clip(1 - pressed / np.maximum(flat, 1e-4) - 0.012, 0, 1)           # ink over the board
    lift = np.clip((pressed - flat) / np.maximum(1 - flat, 1e-4) - 0.004, 0, 1)   # light over the board
    out = np.zeros(pressed.shape + (4,), dtype=np.float32)
    dark = shade >= lift
    out[..., :3] = np.where(dark[..., None], np.array((0.07, 0.04, 0.09)), np.array((0.93, 0.80, 0.92)))
    out[..., 3] = np.where(dark, shade * HOLLOW[0], lift * HOLLOW[1])
    # The hollow's floor a shade darker than the board (crushed nap), so the shape reads as a place waiting.
    floor = np.asarray(mask.resize((px, px), Image.LANCZOS), dtype=np.float32) / 255.0 * HOLLOW[2]
    lit = ~dark
    out[..., 3] = np.where(lit, np.clip(out[..., 3] - floor, 0, 1), np.clip(out[..., 3] + floor * (1 - out[..., 3]), 0, 1))
    # Nothing out at the picture's edge (the overlay must fade into the board).
    yy, xx = np.mgrid[0:px, 0:px]
    edge = np.clip(np.minimum(np.minimum(xx, px - 1 - xx), np.minimum(yy, px - 1 - yy)) / (px * 0.05), 0, 1)
    out[..., 3] *= edge
    Image.fromarray((np.clip(out, 0, 1) * 255 + 0.5).astype(np.uint8), "RGBA").save(path)
    return path


# ---------------------------------------------------------------- run


def main(argv):
    what = [a for a in argv if a in ("stills", "hollows", "turns", "sheets")] or ["stills", "hollows", "turns", "sheets"]
    kinds = [a for a in argv if a in KINDS] or KINDS
    finishes = [a for a in argv if a in FINISHES] or FINISHES
    total, files = 0, 0
    if "stills" in what:
        for kind in kinds:
            for finish in finishes:
                src = shoot(kind, finish, os.path.join(OUT, f"{kind}-{finish}.png"))
                total += export.export(src, f"assets/charms/{kind}-{finish}.png", sizes=(SIZE, SIZE), canvas=True)
                files += 3
    if "hollows" in what:
        for kind in kinds:
            src = hollow(kind, os.path.join(OUT, f"{kind}-hollow.png"))
            total += export.export(src, f"assets/charms/{kind}-hollow.png", sizes=(SIZE, SIZE), canvas=True)
            files += 3
    if "turns" in what:
        for kind in kinds:
            for finish in [f for f in finishes if f != "sticker"]:
                dest = os.path.join(export.REPO, f"assets/charms/{kind}-{finish}-turn.png")
                if os.environ.get("KEEP") and os.path.exists(dest) and Image.open(dest).size == (TURN_SIZE * 3 * 5, TURN_SIZE * 3 * 2):
                    continue  # KEEP=1: only the sheets not rendered yet
                frames = shoot(kind, finish, os.path.join(OUT, f"{kind}-{finish}-turn{{:02d}}.png"), turn=TURN, size=TURN_SIZE * 3, ss=1, samples=int(os.environ.get("TURN_SAMPLES", 64)))
                total += turn_sheet(kind, finish, frames)
                files += 1
    if "sheets" in what:
        contact(kinds)
    print(f"total {files} files, {total / 1024:.1f} KB")


def turn_sheet(kind, finish, frames):
    """The turn as one sheet, 5 across, every frame the whole (fixed) picture. The kit's
    encoder turns a palette down when it bands on a still; ten frames that are each on
    screen for a twelfth of a second can take one (a sheet is 3 to 4 times the size
    without), so pngquant is asked again here, dithered."""
    import io
    import subprocess
    ims = [export.load(f) for f in frames]
    w = TURN_SIZE * 3
    cols = 5
    rows = math.ceil(len(ims) / cols)
    out = Image.new("RGBA", (w * cols, w * rows), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        out.paste(export.resize(im, (w, w)), ((i % cols) * w, (i // cols) * w))
    dest = os.path.join(export.REPO, f"assets/charms/{kind}-{finish}-turn.png")
    data, how = export.encode(out)
    exe = export._pngquant()
    if how.startswith("rgba") and exe:
        buf = io.BytesIO()
        out.save(buf, "PNG")
        p = subprocess.run([exe, "--quality", "55-98", "--speed", "1", "--strip", "-"], input=buf.getvalue(), capture_output=True)
        if p.returncode == 0 and p.stdout and len(p.stdout) < len(data):
            data, how = p.stdout, "pngquant (sheet)"
            try:
                import oxipng
                small = oxipng.optimize_from_memory(data, level=6)
                data = small if len(small) < len(data) else data
            except Exception:
                pass
    with open(dest, "wb") as f:
        f.write(data)
    print(f"  assets/charms/{kind}-{finish}-turn.png  {out.width}x{out.height}  {len(data) / 1024:.1f} KB  ({how}){'  ** over budget **' if len(data) > 600 * 1024 else ''}")
    return len(data)


def contact(kinds=KINDS):
    """All nine in the three finishes (and their hollows) at board size x3 on the board's velvet."""
    cell, pad = SIZE * 3, 18
    velvet = tuple(int(VELVET[i:i + 2], 16) for i in (1, 3, 5))
    rows = FINISHES + ("hollow",)
    out = Image.new("RGBA", (pad + (cell + pad) * len(kinds), pad + (cell + pad) * len(rows)), velvet + (255,))
    for c, kind in enumerate(kinds):
        for r, finish in enumerate(rows):
            p = os.path.join(export.REPO, f"assets/charms/{kind}-{finish}@3x.png")
            if os.path.exists(p):
                out.alpha_composite(export.load(p), (pad + c * (cell + pad), pad + r * (cell + pad)))
    path = os.path.join(OUT, "charms-sheet.png")
    out.convert("RGB").save(path)
    print("sheet", path)
    return path


if __name__ == "__main__":
    main(sys.argv[1:])
