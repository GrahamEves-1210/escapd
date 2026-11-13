# Shared by the casebook's renders (src/play2/journal/Book.tsx): the detective's own casebook,
# cloth-bound in each mode's cloth, lying on the close-ups' table. Two pictures of the same book
# from the same camera, so the app can lay one over the other and swing the cover between them:
#
#   book_open.py   the book open at its ribbon: the right-hand page (the app writes on it), the
#                  gutter and a sliver of the left-hand page, the fore edge's fan of page edges,
#                  the cover's square with its brass corners, the ribbon down the gutter;
#   book_cover.py  the same book shut: the front board with its foil stamp, the rounded spine.
#
# The pictures are 390 points wide (a phone; the app scales them to the screen's width) and are
# cut into a head, a foot and a strip between that the app stretches to the page's height, so
# everything that runs down the book (the gutter, the fore edge, the ribbon, the cover's edge)
# is straight and the same all the way down, and the paper has no fibre of its own (the app lays
# its grain over the page).
#
# The book is built standing up, facing -Y (reveal_common's convention: the house key is then
# upper left in the picture), and shot from a little below: the reader's side, so the foot of
# the page block and the boards show their thickness. All measures are points.
import random

import numpy as np

from reveal_common import *  # noqa: F401,F403

# A picture this size is mostly flat paper: 1.5x supersampling and 64 samples draw it as well as the kit's 2x and 96
# in a third of the time (BOOK_SS=1 BOOK_SAMPLES=24 PX=1 for a quick look).
SS = float(os.environ.get("BOOK_SS", 1.5))
SAMPLES = int(os.environ.get("BOOK_SAMPLES", 64))

PT = 150.0            # points per unit: the picture is 2.6 units wide
W = 390.0             # the picture's width
GUT = 30.0            # the gutter, from the picture's left
PW = 340.0            # the right-hand page: gutter to fore edge
FAN = 8.5             # how far the lowest leaf of the right-hand block stands out past the top one
SQ = 6.5              # the cover's square: board past the page block
BOARD = 3.6           # a board's thickness
TL, TR = 30.0, 18.0   # the page blocks: left (the cases before this one) and right (the pages to come)
ELEV = -22.0          # the camera, below straight on
COS, SIN = math.cos(math.radians(ELEV)), -math.sin(math.radians(ELEV))
PX = int(os.environ.get("PX", 3))   # pixels a point

REPO = export.REPO


def srgb(hex_):
    """'#RRGGBB' as linear RGB."""
    h = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


# Each mode's book (src/play2/hud/materials.tsx BOOK, src/play2/journal/palette.ts paper).
MODES = {
    "noir": dict(cloth="#7E2F4F", ribbon="#E9B8A6", paper="#F7ECE6", title="CASEBOOK", font="playfair-display/900Black/PlayfairDisplay_900Black.ttf", track=1.08),
    "crime-scene": dict(cloth="#A12D3F", ribbon="#F6D776", paper="#EBDAB5", title="CASEBOOK", font="fraunces/900Black/Fraunces_900Black.ttf", track=1.1),
    "paranormal": dict(cloth="#4B3A9E", ribbon="#9FF2D8", paper="#E9E5F8", title="Casebook", font="fraunces/600SemiBold_Italic/Fraunces_600SemiBold_Italic.ttf", track=1.0),
}


def u(pt):
    return pt / PT


def book_scene(h_pt, samples=SAMPLES):
    kit.reset()
    kit.setup(size=(round(W * PX), round(h_pt * PX)), ss=1, samples=samples)
    kit._state["ss"] = SS   # the kit takes whole numbers; the ink line's weight follows this
    r = bpy.context.scene.render
    r.resolution_x, r.resolution_y = round(W * PX * SS), round(h_pt * PX * SS)


def book_camera(h_pt, level, level_y, at_z):
    """The camera: the picture W x h points, x = 0 at GUT; a point at world height `at_z` (points up the
    page) and `level` points above the table lands `level_y` points from the picture's top."""
    cx = W / 2 - GUT
    cz = at_z - (h_pt / 2 - level_y - level * SIN) / COS
    cam = kit.camera("front", target=(u(cx), 0.0, u(cz)), span=max(W, h_pt) / PT, elev=ELEV)
    return cam


def at(cam, h_pt, x, level, z):
    """Where a point (x from the gutter, `level` above the table, z up the page) lands: points from the picture's top left."""
    px, py = kit.project(cam, (u(x), -u(level), u(z)))
    return (round(px * W, 2), round(py * h_pt, 2))


# ---------------------------------------------------------------- materials


def cloth(name, hex_, weave=1.0):
    """Bookcloth: the mode's colour, a fine woven tooth, paler where hands have rubbed its edges."""
    color = srgb(hex_)
    t = M.Tree(name)
    co = t.coords((1, 1, 1))
    wa = t.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X")
    wb = t.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="Z")
    for w in (wa, wb):
        t.link(co, w.inputs["Vector"])
        w.inputs["Scale"].default_value = 150.0
        w.inputs["Distortion"].default_value = 0.6
        w.inputs["Detail"].default_value = 1.0
    tooth = t.math("MULTIPLY", wa.outputs["Fac"], wb.outputs["Fac"])
    mottle = t.noise(t.coords((2.4,) * 3), scale=1.0, detail=3)
    col = t.mix(t.math("MULTIPLY", mottle, 0.4), color, M._dim(color, 0.62))
    col = t.mix(t.math("MULTIPLY", tooth, 0.22 * weave), col, M._dim(color, 1.5))
    col = t.mix(t.math("MULTIPLY", t.edges(0.5, 0.66), 0.5), col, tuple(min(1.0, c * 2.2 + 0.04) for c in color))
    b = t.principled(**{"Base Color": col, "Roughness": 0.82, "Specular IOR Level": 0.25, "Sheen Weight": 0.35, "Sheen Roughness": 0.5,
                        "Normal": t.bump(tooth, strength=0.35 * weave, distance=0.002)})
    return t.surface(b)


def satin(name, hex_):
    """A ribbon: satin, ribbed across, a soft sheen down its length."""
    color = srgb(hex_)
    t = M.Tree(name)
    rib = t.node("ShaderNodeTexWave", wave_type="BANDS", bands_direction="X")
    t.link(t.coords((1, 1, 1)), rib.inputs["Vector"])
    rib.inputs["Scale"].default_value = 90.0
    col = t.mix(t.math("MULTIPLY", rib.outputs["Fac"], 0.18), color, M._dim(color, 0.7))
    b = t.principled(**{"Base Color": col, "Roughness": 0.42, "Specular IOR Level": 0.4, "Sheen Weight": 0.6, "Sheen Roughness": 0.35,
                        "Anisotropic": 0.5, "Normal": t.bump(rib.outputs["Fac"], strength=0.2, distance=0.001)})
    return t.surface(b)


def page_paper(name, target, own, k=1.0, lines=False, hemmed=True):
    """A leaf of the book: no fibre (the strip between head and foot is stretched), most of its colour its own
    (`own`, given off: the studio lights matte things low and warm) so the page comes out the app's paper
    (`target`, calibrated by book_open.py); k darkens a leaf lower in the block. What it gives off falls away
    where the paper is hemmed in (the gutter, between the leaves' edges), so the fold reads as a fold."""
    base = tuple(0.62 * c for c in target)
    mat = M.lit(M.paper(name, color=base, fibre=0.0, age=0.0), tuple(c * k for c in own), 1.0)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    ao = nt.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 5
    ao.inputs["Distance"].default_value = u(46.0)
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = 0.45, 1.0
    mr.inputs["To Min"].default_value, mr.inputs["To Max"].default_value = 0.6, 1.0
    if hemmed:
        nt.links.new(ao.outputs["AO"], mr.inputs["Value"])
    else:
        mr.inputs["Value"].default_value = 1.0   # (a block shut between its boards: even all along, and no fold)
    # And toward the fold itself (x = 0), as a page turning down into the gutter turns from the lamp.
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    absx = nt.nodes.new("ShaderNodeMath")
    absx.operation = "ABSOLUTE"
    fold = nt.nodes.new("ShaderNodeMapRange")
    fold.interpolation_type = "SMOOTHERSTEP"
    fold.inputs["From Min"].default_value, fold.inputs["From Max"].default_value = 0.0, u(58.0)
    fold.inputs["To Min"].default_value, fold.inputs["To Max"].default_value = (0.5 if hemmed else 1.0), 1.0
    both = nt.nodes.new("ShaderNodeMath")
    both.operation = "MULTIPLY"
    nt.links.new(tc.outputs["Object"], sep.inputs[0])
    nt.links.new(sep.outputs["X"], absx.inputs[0])
    nt.links.new(absx.outputs[0], fold.inputs["Value"])
    nt.links.new(mr.outputs[0], both.inputs[0])
    nt.links.new(fold.outputs[0], both.inputs[1])
    nt.links.new(both.outputs[0], bsdf.inputs["Emission Strength"])
    if lines:
        # The edges of the leaves in a slab: fine lines across its thickness (y), darker between sheets.
        wave = nt.nodes.new("ShaderNodeMath")
        wave.operation = "MULTIPLY"
        wave.inputs[1].default_value = 2 * math.pi / u(0.62)
        sine = nt.nodes.new("ShaderNodeMath")
        sine.operation = "SINE"
        dark = nt.nodes.new("ShaderNodeMapRange")
        dark.inputs["From Min"].default_value, dark.inputs["From Max"].default_value = -0.2, 1.0
        dark.inputs["To Min"].default_value, dark.inputs["To Max"].default_value = 1.0, 0.74
        lined = nt.nodes.new("ShaderNodeMath")
        lined.operation = "MULTIPLY"
        nt.links.new(sep.outputs["Y"], wave.inputs[0])
        nt.links.new(wave.outputs[0], sine.inputs[0])
        nt.links.new(sine.outputs[0], dark.inputs["Value"])
        nt.links.new(both.outputs[0], lined.inputs[0])
        nt.links.new(dark.outputs[0], lined.inputs[1])
        nt.links.new(lined.outputs[0], bsdf.inputs["Emission Strength"])
    return mat


# ---------------------------------------------------------------- the page blocks


LEFT_REACH = 28.0     # the left-hand block stands up out of the gutter sooner: its shadow falls across the fold


def rise(t, low=0.1):
    """How a leaf climbs out of the gutter: steep at the fold, flat by t = 1."""
    t = max(0.0, min(1.0, t))
    return low + (1.0 - low) * math.sin(t * math.pi / 2) ** 0.7


def h_right(x):
    return TR * rise(x / 44.0)


def h_left(x):
    return TL * rise(-x / LEFT_REACH)


def leaf(name, xs, lo, hi, z0, z1):
    """A slab of leaves between two heights above the board (functions of x), from z0 to z1."""
    n = len(xs)
    verts = []
    for z in (z0, z1):
        verts += [(u(x), -u(BOARD + hi(x)), u(z)) for x in xs]
        verts += [(u(x), -u(BOARD + lo(x)), u(z)) for x in xs]
    faces = []
    for i in range(n - 1):
        faces.append((i, i + 1, 2 * n + i + 1, 2 * n + i))
        faces.append((n + i, 3 * n + i, 3 * n + i + 1, n + i + 1))
        faces.append((i, n + i, n + i + 1, i + 1))
        faces.append((2 * n + i, 2 * n + i + 1, 3 * n + i + 1, 3 * n + i))
    faces.append((n - 1, 2 * n - 1, 4 * n - 1, 3 * n - 1))
    faces.append((0, n, 3 * n, 2 * n))
    return mesh_object(name, verts, faces, sharp=38.0)


def block(side, count, height, page_h, papers, rnd, fan=FAN):
    """One side's page block as `count` slabs, the lowest standing out furthest at the fore edge, each a hair
    off true at head and foot. Returns the slabs, the top one (the page) last."""
    sign = 1.0 if side == "right" else -1.0
    hfun = h_right if side == "right" else h_left
    reach = 44.0 if side == "right" else LEFT_REACH
    out = []
    for i in range(count):
        top = i == count - 1
        end = PW + fan * (1.0 - (i + 1) / count) + (0.0 if top else rnd.uniform(-0.5, 0.5))
        xs = [reach * (k / 18.0) ** 1.4 for k in range(19)] + [reach + (end - reach) * k / 6.0 for k in range(1, 7)]
        xs = [sign * x for x in xs]
        if sign < 0:
            xs = xs[::-1]
        a, b = i / count, (i + 1) / count
        j0, j1 = (0.0, 0.0) if top else (rnd.uniform(-0.7, 0.5), rnd.uniform(-0.5, 0.7))
        ob = leaf(f"{side}_{i}", xs, (lambda x, a=a: hfun(x) * a), (lambda x, b=b: hfun(x) * b), j0, page_h + j1)
        kit.assign(ob, papers[-1] if top else papers[i % (len(papers) - 1)])
        out.append(ob)
    return out


def boards(page_h, mat, left=True, right=True):
    """The cover lying open under the blocks: one cloth-covered board each side and the spine's cloth between."""
    reach = PW + FAN + SQ
    x0, x1 = (-reach if left else -14.0), (reach if right else 14.0)
    ob = kit.box((u(x1 - x0), u(BOARD), u(page_h + 2 * SQ)), (u((x0 + x1) / 2), -u(BOARD / 2), u(page_h / 2)), "boards", bevel_width=u(1.1), segments=3)
    kit.assign(ob, mat)
    return ob


def corner(x, z, sx, sz, level, mat, leg=30.0, lip=6.4, name="corner"):
    """A brass corner on a board whose outer corner is at (x, z), its faces at `level` above the table and
    BOARD below that: the lips folded over the board's edges, a rivet. sx, sz: which way the board lies from it."""
    parts = []
    y = -(level - BOARD / 2)
    th = BOARD + 1.4
    a = kit.box((u(leg), u(th), u(lip)), (u(x + sx * (leg / 2 - 0.7)), u(y), u(z + sz * (lip / 2 - 0.7))), name, bevel_width=u(0.5), segments=2)
    b = kit.box((u(lip), u(th), u(leg - lip + 0.6)), (u(x + sx * (lip / 2 - 0.7)), u(y), u(z + sz * ((leg + lip - 0.6) / 2 - 0.7))), name, bevel_width=u(0.5), segments=2)
    parts += [a, b]
    for ob in parts:
        kit.assign(ob, mat)
    return parts


def ribbon_strip(name, path, width, mat, vee=6.0):
    """A ribbon along `path` [(x, level, z), ...], `width` across (in x), its last end cut in a V."""
    verts, faces = [], []
    n = len(path)
    for i, (x, level, z) in enumerate(path):
        for k, off in enumerate((-0.5, 0.0, 0.5)):
            dz = vee if (i == n - 1 and k == 1) else 0.0
            verts.append((u(x + off * width), -u(level + (0.5 if k == 1 else 0.0)), u(z + dz)))
    for i in range(n - 1):
        for k in range(2):
            faces.append((i * 3 + k, i * 3 + k + 1, (i + 1) * 3 + k + 1, (i + 1) * 3 + k))
    ob = mesh_object(name, verts, faces, sharp=70.0)
    so = ob.modifiers.new("thick", "SOLIDIFY")
    so.thickness = u(0.7)
    kit.assign(ob, mat)
    return ob


# ---------------------------------------------------------------- slicing


def picture(src, h_pt):
    """A render at the picture's own size: W x h_pt points, PX pixels a point (it is rendered SS times bigger)."""
    im = export.load(src) if isinstance(src, str) else src
    return export.resize(im, (round(W * PX), round(h_pt * PX)))


def rendered(path):
    """True when the render is to be made (always, unless BOOK_RECUT=1 and it is there already: cut it again as it is)."""
    return not (os.environ.get("BOOK_RECUT") and os.path.exists(path))


def rows(im, y0, y1):
    """The picture's rows y0..y1 (points)."""
    return im.crop((0, round(y0 * PX), im.width, round(y1 * PX)))


def strip_between(im, y0, y1, h_pt=4):
    """One row, the mean of rows y0..y1 (premultiplied: the render's grain averages away), as a strip h_pt tall:
    what runs down the book, for the app to stretch."""
    a = export._premult(im)[round(y0 * PX):round(y1 * PX)]
    row = a.mean(axis=0, keepdims=True)
    return export._unpremult(np.repeat(row, h_pt * PX, axis=0))


def settle(cap, strip, at_top, over=10.0):
    """A head or a foot whose last `over` points ease into the strip's row, so no seam shows where they meet."""
    a = export._premult(cap)
    row = export._premult(strip)[0:1]
    n = round(over * PX)
    f = np.linspace(0.0, 1.0, n).reshape(n, 1, 1)
    if at_top:   # the cap is above the strip: its last rows blend
        a[-n:] = a[-n:] * (1 - f) + row * f
    else:
        a[:n] = a[:n] * f + row * (1 - f)
    return export._unpremult(a)


def ship_cut(im, dest, h_pt, budget_kb=150, quantise=True, most=3):
    """Write a cut of the picture (W x h_pt points) at x1, x2, x3 (or up to `most`). Returns bytes."""
    scales = [k for k in (1, 2, 3) if k <= min(PX, most)] or [1]
    dest = asset_path(dest)
    base, ext = os.path.splitext(dest)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    total = 0
    for k in scales:
        out = export.resize(im, (round(W * k), round(h_pt * k)))
        for err in (7.0, 10.0, 14.0, 20.0):   # a palette if it is faithful; a little more error allowed before giving one up
            data, how = export.encode(out, quantise, max_error=err)
            if "pngquant" in how:
                break
        name = dest if k == 1 else f"{base}@{k}x{ext}"
        with open(name, "wb") as f:
            f.write(data)
        kb = len(data) / 1024
        print(f"  {os.path.relpath(name, REPO)}  {out.width}x{out.height}  {kb:.1f} KB  ({how})" + ("  ** over budget **" if kb > budget_kb else ""))
        total += len(data)
    return total
