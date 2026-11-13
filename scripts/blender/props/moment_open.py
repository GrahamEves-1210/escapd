# A case opening (src/play2/Brief.tsx, Arrival): before the letter can be read
# it arrives, in its envelope, lying on the desk flap side up.
# - noir: a hotel's cream envelope lined in plum tissue, a lipstick blot on its flap;
# - crime scene: a kraft evidence envelope, its straight flap held by a string
#   wound between two card buttons;
# - paranormal: an old foxed envelope lined in indigo, sealed with plum wax, a
#   crescent moon pressed in it.
# Each is a short run of frames (12 fps): the string unwinds or the wax cracks
# in two, then the flap lifts and goes over. One framing for every frame; the
# app shows a frame at CANVAS points and slides the letter out of the mouth
# from under `-back` (the back panel alone, cut from the last frame), so the
# letter comes out of the envelope and not from behind it.
#
#   <bpy python> scripts/blender/props/moment_open.py [noir|crime|moon ...]   # writes assets/moments/open-<mode>*.png
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moment_common as C  # noqa: E402
from moment_common import I, M, Matrix, Vector, bpy, export, kit  # noqa: E402
from shapely.geometry import LineString, Point, Polygon  # noqa: E402
from shapely.ops import split  # noqa: E402

W, H = 3.0, 2.05                 # the envelope, units
PT = 96.0                        # points a unit: the envelope is 288 pt across in the app
VIEW = (3.5, 3.39)               # the canvas, units: room for the flap to go over and for the shadow
CANVAS = (336, 325)              # the canvas, points; frames are exported at x2
PX = (CANVAS[0] * 2, CANVAS[1] * 2)
CENTRE = 0.528                   # the canvas's middle, units up the desk from the envelope's
Z = {"front": 0.0, "liner": 0.02, "letter": 0.026, "back": 0.038, "top": 0.052}

MODES = {
    "noir": dict(
        paper=C.srgb("#F6EFE9", 0.86), age=0.12, liner=C.srgb("#5B2A4A"), letter=C.srgb("#F6EFE9", 0.95), seam=(0.42, 0.33, 0.30),
        flap=1.23, throat=0.88, ground=(0x18, 0x12, 0x1D),
        # (closed) the flap just lifting, then over
        frames=[dict(a=0), dict(a=16), dict(a=58), dict(a=112), dict(a=172)],
    ),
    "crime": dict(
        paper=C.srgb("#C29561", 0.92), age=0.3, liner=C.srgb("#9E7443", 0.9), letter=C.srgb("#F8F4EA", 0.95), seam=(0.22, 0.12, 0.05),
        flap=0.66, throat=0.30, straight=True, ground=(0x1C, 0x0F, 0x12),
        frames=[dict(a=0, wound=2), dict(a=0, wound=1), dict(a=38, wound=0), dict(a=108, wound=0), dict(a=172, wound=0)],
    ),
    "moon": dict(
        paper=(0.66, 0.59, 0.47), age=0.6, liner=C.srgb("#2A2347"), letter=C.srgb("#EEE4D0", 0.95), seam=(0.30, 0.22, 0.12),
        flap=1.23, throat=0.88, ground=(0x10, 0x12, 0x2A),
        frames=[dict(a=0, seal=0), dict(a=0, seal=1), dict(a=30, seal=2), dict(a=104, seal=2), dict(a=172, seal=2)],
    ),
}


def flap_outline(mode):
    L = mode["flap"]
    if mode.get("straight"):
        return I.fillet([(-W / 2 + 0.02, 0), (W / 2 - 0.02, 0), (W / 2 - 0.2, -L), (-W / 2 + 0.2, -L)], 0.09)
    return I.fillet([(-W / 2 + 0.02, 0), (W / 2 - 0.02, 0), (0.16, -L + 0.07), (0, -L), (-0.16, -L + 0.07)], 0.1)


def inset(outline, d):
    return list(Polygon(outline).buffer(-d, join_style=1).exterior.coords)[:-1]


def plates(geom, thick, z, round_, name):
    """Plates from a shapely polygon or several."""
    polys = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
    return [I.plate(list(p.exterior.coords)[:-1], thick, z=z, round_=round_, name=name) for p in polys if p.area > 1e-4]


def envelope(name, frame):
    """Build the envelope of a mode at a frame. Returns {"all", "back" (what the letter slides out from under), "no_line", "plain"}."""
    mode = MODES[name]
    a = frame["a"]
    L, T = mode["flap"], mode["throat"]
    paper = M.paper("envelope", color=mode["paper"], fibre=0.6, age=mode["age"], scale=1.6)
    inside = M.paper("liner", color=mode["liner"], fibre=0.5, age=0.1, scale=1.6)
    made, back, no_line, plain = [], [], [], []

    front = I.paint(I.plate(I.rounded(W, H, 0.04), 0.02, z=Z["front"], round_=0.008, name="front"), paper)
    liner = I.paint(I.plate(I.rounded(W - 0.05, H - 0.05, 0.03), 0.008, z=Z["liner"], round_=0.002, name="liner"), inside)
    letter = I.paint(I.plate(I.rounded(W - 0.3, H - 0.3, 0.02, 0, 0.02), 0.012, z=Z["letter"], round_=0.004, name="letter"),
                     M.paper("letter", color=mode["letter"], fibre=0.4, age=0.1, scale=1.6))
    made += [front, liner, letter]
    # The back: its top edge the throat the letter comes out of (a V, or straight across under a straight flap).
    top = H / 2 - 0.015
    if mode.get("straight"):
        ring = [(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, top - T), (-W / 2, top - T)]
    else:
        ring = [(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, top), (0.0, top - T), (-W / 2, top)]
    panel = I.paint(I.plate(I.fillet(ring, 0.04), Z["top"] - Z["back"], z=Z["back"], round_=0.005, name="back"), paper)
    back.append(panel)
    seam = M.ink("seam", mode["seam"])
    if not mode.get("straight"):
        for sx in (-1, 1):
            s = I.paint(I.tube([(sx * (W / 2 - 0.03), -H / 2 + 0.03, Z["top"] + 0.002), (sx * 0.12, -0.33, Z["top"] + 0.002), (0, -0.2, Z["top"] + 0.002)], 0.007, "seam", flat=0.4, smooth=False), seam)
            back.append(s)
            no_line.append(s)
    else:
        s = I.paint(I.tube([(0.0, -H / 2 + 0.03, Z["top"] + 0.002), (0.0, top - T - 0.03, Z["top"] + 0.002)], 0.007, "seam", flat=0.4, smooth=False), seam)
        back.append(s)
        no_line.append(s)

    # The flap, built hanging from its fold (y = 0 at the fold, down its length), its inside lined.
    outline = flap_outline(mode)
    flap = [I.paint(I.plate(outline, 0.014, z=0.008, round_=0.005, name="flap"), paper),
            I.paint(I.plate(inset(outline, 0.07), 0.008, z=0.0, round_=0.002, name="flap_liner"), inside)]
    hinge = Matrix.Translation((0, H / 2 - 0.01, Z["top"] + 0.004)) @ Matrix.Rotation(math.radians(-a), 4, "X")
    on_flap, on_back = [], []

    if name == "noir":
        # The blot: lips in lipstick, pressed on the flap where it closes (the letter's own, letters/Marks.tsx Kiss).
        k = 0.66 / 64
        lips = [C.path((2, 20), [((10, 11), (19, 5), (26, 10)), ((29, 7), (35, 7), (38, 10)), ((45, 5), (54, 11), (62, 20)), ((51, 21), (41, 18.5), (32, 20.5)), ((23, 18.5), (13, 21), (2, 20))]),
                C.path((4, 21.5), [((14, 23.5), (24, 22.5), (32, 23.5)), ((40, 22.5), (50, 23.5), (60, 21.5)), ((54, 33), (43, 38), (32, 38)), ((21, 38), (10, 33), (4, 21.5))])]
        rouge = M.enamel("lipstick", color=C.srgb("#B53A5F", 0.8), gloss=0.25)
        for ring_ in lips:
            pts = [((x - 32) * k, -(y - 21) * k) for x, y in ring_]
            lip = I.paint(I.plate(pts, 0.006, z=0.022, round_=0.002, name="lip"), rouge)
            lip.matrix_world = Matrix.Translation((0.02, -L + 0.42, 0)) @ Matrix.Rotation(math.radians(-9), 4, "Z") @ lip.matrix_world
            on_flap.append(lip)
            no_line.append(lip)

    if name == "crime":
        # The envelope's printed box, in the form's oxblood: ruled, nothing written in it.
        rule = M.ink("form", C.srgb("#7A2433"))
        zr = Z["top"] + 0.002
        x0, x1, y0, y1 = -1.30, -0.42, -0.84, -0.36
        for pts in ([(x0, y0, zr), (x1, y0, zr), (x1, y1, zr), (x0, y1, zr), (x0, y0, zr)], [(x0 + 0.08, y0 + 0.16, zr), (x1 - 0.08, y0 + 0.16, zr)], [(x0 + 0.08, y0 + 0.32, zr), (x1 - 0.08, y0 + 0.32, zr)]):
            r_ = I.paint(I.tube(pts, 0.008, "rule", flat=0.3, smooth=False), rule)
            on_back.append(r_)
            no_line.append(r_)
        # Two card buttons, riveted: one on the flap, one on the back; the string wound between them in an eight.
        card = M.paper("button", color=C.srgb("#8E2B33", 0.9), fibre=0.3, age=0.2)
        brass = M.brass("rivet", age=0.5, wear=0.6)
        ay, by = -L + 0.22, (H / 2 - L) - 0.34            # the flap's button (flap space), the back's (desk space)
        for where, y, z in ((on_flap, ay, 0.022), (on_back, by, Z["top"])):
            where.append(I.paint(I.plate(I.circle(0.135, 40, 0, y), 0.022, z=z, round_=0.008, name="button"), card))
            rivet = I.paint(I.plate(I.circle(0.04, 20, 0, y), 0.02, z=z + 0.02, round_=0.009, name="rivet"), brass)
            where.append(rivet)
            plain.append(rivet)
        twine = M.paper("twine", color=C.srgb("#E9DCC3", 0.9), fibre=0.8, age=0.3, scale=0.3)
        A = Vector((0, H / 2 - 0.01 + ay, Z["top"] + 0.03))   # the flap's button, closed, in desk space
        B = Vector((0, by, Z["top"] + 0.012))
        wound = frame.get("wound", 0)
        r = 0.022
        if a == 0:
            pts = []
            turns = wound
            for t in range(turns):                           # an eight round both buttons, each turn a little wider
                rr = 0.085 + 0.022 * t
                n = 14
                for i in range(n):
                    ang = math.pi / 2 + 2 * math.pi * i / n
                    pts.append((A.x + rr * math.cos(ang), A.y + rr * math.sin(ang) * 0.9, A.z + 0.004 * t))
                for i in range(n):
                    ang = -math.pi / 2 - 2 * math.pi * i / n
                    pts.append((B.x + rr * math.cos(ang), B.y + rr * math.sin(ang) * 0.9, B.z + 0.004 * t))
            if wound == 2:
                pts += [(B.x + 0.12, B.y + 0.06, B.z + 0.01), (0.34, B.y - 0.02, B.z), (0.62, B.y - 0.16, B.z), (0.78, B.y - 0.34, B.z)]
            elif wound == 1:
                # Half undone: the free end lifted off in a loop, in the hand.
                pts += [(B.x + 0.14, B.y + 0.02, B.z + 0.05), (0.42, B.y + 0.05, 0.26), (0.80, B.y - 0.10, 0.34), (1.06, B.y - 0.36, 0.22), (1.10, B.y - 0.62, 0.08)]
            else:
                # Off: it lies where it dropped, still fixed under the flap's button.
                pts = [(A.x, A.y - 0.06, A.z), (0.10, A.y - 0.20, A.z - 0.01), (0.34, A.y - 0.36, B.z), (0.72, A.y - 0.34, B.z), (1.02, A.y - 0.52, B.z), (1.0, A.y - 0.80, B.z), (0.80, A.y - 0.92, B.z)]
            if wound:
                pts = [(A.x - 0.02, A.y - 0.05, A.z - 0.01)] + pts
            made.append(I.paint(I.tube(pts, r, "string", flat=0.8), twine))
        else:
            # Lifted with the flap: it hangs from the flap's button down to the envelope and trails off it.
            at = hinge @ Vector((0, ay - 0.06, 0.05))
            drop = max(Z["top"] + r, 0.0)
            pts = [tuple(at), (at.x + 0.05, at.y - 0.04, at.z * 0.6 + 0.02), (at.x + 0.16, min(at.y, 0.72) - 0.16, drop + 0.02), (0.42, min(at.y, 0.6) - 0.34, drop),
                   (0.78, 0.06, drop), (1.04, -0.22, drop), (0.98, -0.50, drop), (0.80, -0.62, drop)]
            made.append(I.paint(I.tube(pts, r, "string", flat=0.9), twine))

    if name == "moon":
        # The seal: a pressed drop of plum wax over the flap's point, a ring and a crescent moon in it. It breaks
        # across where the flap ends: the upper piece goes with the flap, the lower stays on the back.
        wax = M.wax("seal", color=C.srgb("#6C3478", 0.9), translucency=0.25, gloss=0.75)
        cy = (H / 2 - 0.01 - L) + 0.10
        state = frame.get("seal", 0)
        blob = Polygon([(0.33 * (1 + 0.09 * math.sin(3 * t + 1.0) + 0.05 * math.sin(5 * t + 0.3)) * math.cos(t),
                         cy + 0.33 * (1 + 0.09 * math.sin(3 * t + 1.0) + 0.05 * math.sin(5 * t + 0.3)) * math.sin(t)) for t in [2 * math.pi * i / 72 for i in range(72)]])
        ring = Point(0, cy).buffer(0.245, 24).difference(Point(0, cy).buffer(0.222, 24))
        moon = Point(-0.02, cy).buffer(0.15, 24).difference(Point(0.065, cy + 0.035).buffer(0.125, 24))
        crack = LineString([(-0.6, cy - 0.05), (-0.24, cy - 0.01), (-0.13, cy - 0.065), (-0.03, cy - 0.02), (0.07, cy - 0.07), (0.17, cy - 0.015), (0.26, cy - 0.06), (0.6, cy - 0.02)])

        def pieces(geom, upper):
            if state == 0:
                return [geom] if upper else []
            return [g for g in split(geom, crack).geoms if (g.representative_point().y > cy - 0.04) == upper]

        for upper in (True, False):
            group = []
            for geom, thick, z, rnd, nm in ((blob, 0.075, 0.0, 0.03, "seal"), (ring, 0.014, 0.07, 0.006, "seal_ring"), (moon, 0.034, 0.07, 0.012, "seal_moon")):
                for g in pieces(geom, upper):
                    for ob in plates(g, thick, z, rnd, nm):
                        I.paint(ob, wax)
                        group.append(ob)
                        if nm != "seal":
                            plain.append(ob)
            if upper:
                # In the flap's space (it rides the flap); once cracked it has jumped a little off the lower piece.
                jump = Matrix.Translation((0.012, 0.022, 0)) @ Matrix.Rotation(math.radians(2.5), 4, "Z") if state >= 1 else Matrix.Identity(4)
                C.move(group, jump @ Matrix.Translation((0, -(H / 2 - 0.01), 0.022)))
                on_flap += group
            else:
                C.move(group, Matrix.Translation((0, 0, Z["top"])))
                on_back += group
        if state >= 1:
            for x, y, s in ((-0.36, cy - 0.10, 0.022), (0.33, cy - 0.11, 0.017), (0.40, cy - 0.02, 0.012), (-0.30, cy + 0.02, 0.011)):
                on_back.append(I.paint(I.sphere(s, (x, y, Z["top"] + s * 0.6), (1, 1, 0.6), "crumb"), wax))

    C.move(flap + on_flap, hinge)
    made += flap + on_flap
    back += on_back
    return {"all": made + back, "back": back, "no_line": no_line, "plain": plain}


def back_outline(mode):
    top = H / 2 - 0.015
    T = mode["throat"]
    if mode.get("straight"):
        return [(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, top - T), (-W / 2, top - T)]
    return [(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, top), (0.0, top - T), (-W / 2, top)]


def shoot(name, frame, path):
    """Render a frame. Returns its anchors, as shares of the canvas, and the back panel's outline in the picture."""
    mode = MODES[name]
    if os.environ.get("RESUME") and os.path.exists(path):
        C.setup(PX, samples=1)
    else:
        C.setup(PX, samples=int(os.environ.get("SAMPLES", 14)))
    cam = kit.camera("held", target=(0, CENTRE, 0), span=VIEW[0], elev=C.ELEV)
    if not (os.environ.get("RESUME") and os.path.exists(path)):
        parts = envelope(name, frame)
        kit.studio(cam, span=3.0, target=(0, 0, 0), shadow=0.0, shadow_strength=0.9, shadow_reach=0.1)
        C.line(2.4, exclude=parts["no_line"], plain=[o for o in parts["plain"] if o not in parts["no_line"]])
        kit.render(path)
    mouth, low = kit.project(cam, (0, H / 2, Z["top"])), kit.project(cam, (0, -H / 2, 0))
    at = {"mouth": round(mouth[1], 4), "foot": round(low[1], 4), "left": round(kit.project(cam, (-W / 2, 0, 0))[0], 4), "right": round(kit.project(cam, (W / 2, 0, 0))[0], 4)}
    return at, [kit.project(cam, (x, y, Z["top"])) for x, y in back_outline(mode)]


def back_layer(src, ring):
    """The back panel alone (and what lies on it), cut from the open envelope: the letter slides out from under it."""
    from PIL import ImageDraw, ImageFilter
    im = export.load(src)
    mask = export.Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).polygon([(x * im.width, y * im.height) for x, y in ring], fill=255)
    mask = mask.filter(ImageFilter.MaxFilter(5))
    out = im.copy()
    out.putalpha(export.Image.composite(im.getchannel("A"), export.Image.new("L", im.size, 0), mask))
    return out


if __name__ == "__main__":
    names = [n for n in sys.argv[1:] if n in MODES] or list(MODES)
    total = 0
    for name in names:
        mode = MODES[name]
        only = [int(v) for v in os.environ["FRAMES"].split(",")] if os.environ.get("FRAMES") else range(len(mode["frames"]))
        paths = []
        for i in only:
            paths.append(C.scratch(f"open_{name}_{i}.png"))
            at, ring = shoot(name, mode["frames"][i], paths[-1])
        back = back_layer(paths[-1], ring)
        print(f"{name}: canvas {CANVAS} pt, {len(mode['frames'])} frames; as shares of the canvas, the mouth (the fold), the foot and the sides: {at}")
        if C.PREVIEW or os.environ.get("FRAMES"):
            C.contact(paths + [back], f"open_{name}_preview.png", mode["ground"])
            continue
        total += C.strip(paths, f"{C.OUT}/open-{name}.png", columns=3)
        total += C.small(back, f"{C.OUT}/open-{name}-back.png", max_kb=150)
    print(f"total {total / 1024:.1f} KB")
