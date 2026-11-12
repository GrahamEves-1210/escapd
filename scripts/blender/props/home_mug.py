# The cat's mug on home's sill (src/play2/cat/Mug.tsx): chunky sea-green
# stoneware, the glaze stopping short of a bare clay foot, black coffee to just
# under the rim, its handle away from the cat (to the left).
#
# The cat knocks it off the sill once a visit, so it is rendered as a short
# tumble: frame 0 is the mug at rest (also written on its own, for the wobble
# when it's patted and for reduced motion), then it is shoved, tips over its
# near left foot toward us, lets go of the sill and turns over as it drops, the
# coffee leaving it. The app plays the frames (12 fps, the cat's stop-motion)
# and moves the picture across and down; every frame has the same framing, and
# the anchors printed at the end (the mug's body and foot at rest, as shares of
# a frame) go into Mug.tsx.
#
#   <bpy python> scripts/blender/props/home_mug.py [outdir]   # writes assets/home/mug*.png
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import home_parts as P  # noqa: E402  (puts scripts/blender on the path)
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import export  # noqa: E402
import kit  # noqa: E402
import materials as M  # noqa: E402

BODY = 28            # points across the mug's body in the app (SittingCat: its width x MUG.size)
R = 0.625            # the body's radius at its widest, units
HEIGHT = 1.5
FRAME = 3.3          # units across a frame: room for the mug to turn over in
SIZE = round(FRAME * BODY / (2 * R))   # a frame's side in points
TIP_TOWARD = 28.0    # it tips to the left and this far (degrees) round toward us
LET_GO = 44.0        # past this lean it has left the sill and turns about its own middle
# Each frame: how far it has turned over (degrees). 12 fps.
TURN = [0, 4, 11, 24, 44, 70, 100, 134, 170, 208]
SPIN = 11.0          # once in the air it also spins about its own axis, degrees a frame
DRIFT = 0.06         # and keeps a little of the shove, units a frame
GLAZE = (0.060, 0.235, 0.215)   # sea green


def build():
    """The mug standing on z = 0, its handle to -X. Returns (root, parts, coffee parts)."""
    glaze = M.ceramic("glaze", color=GLAZE, glaze=1.0, speckle=0.35, scale=0.8)
    clay = M.ceramic("clay", color=(0.36, 0.24, 0.15), glaze=0.0, speckle=0.5, scale=0.8)
    lip = M.ceramic("lip", color=(0.16, 0.40, 0.35), glaze=1.0, speckle=0.2, scale=0.8)
    parts = []
    # The foot: bare clay, a turned ring.
    foot = kit.lathe([(0, 0.04), (0.40, 0.04), (0.44, 0.0), (0.50, 0.0), (0.535, 0.03), (0.56, 0.15), (0.50, 0.18), (0, 0.18)], name="foot", segments=72)
    kit.assign(foot, clay)
    # The body: a thick wall, a belly, a rolled lip; the inside goes down to its floor.
    outer = P.smooth_path([(0.555, 0.14, 0), (0.60, 0.34, 0), (R, 0.62, 0), (R, 1.0, 0), (0.612, 1.28, 0), (0.60, 1.40, 0)], steps=5)
    profile = [(p.x, p.y) for p in outer] + [(0.612, 1.455), (0.60, 1.49), (0.57, HEIGHT), (0.545, 1.49), (0.53, 1.45), (0.528, 1.36),
                                             (0.525, 0.30), (0.49, 0.22), (0.0, 0.20)]
    body = kit.lathe(profile, name="body", segments=96)
    kit.bevel(body, 0.008)
    kit.assign(body, glaze)
    # Where the glaze runs thin over the lip it breaks paler.
    rim = kit.lathe([(0.607, 1.462), (0.598, 1.495), (0.57, 1.507), (0.543, 1.495), (0.534, 1.462), (0.57, 1.47), (0.607, 1.462)], name="rim", segments=96)
    kit.assign(rim, lip)
    # The handle: a fat strap, ear-shaped.
    path = P.smooth_path([(-0.56, 0, 1.20), (-0.80, 0, 1.27), (-1.03, 0, 1.10), (-1.08, 0, 0.80), (-0.97, 0, 0.50), (-0.76, 0, 0.37), (-0.55, 0, 0.36)], steps=7)
    handle = P.tube(path, 0.105, "handle", segments=16, flat=0.8)
    kit.assign(handle, glaze)
    parts += [foot, body, rim, handle]
    root = kit.group(parts, "mug")
    return root, parts


def pose(k):
    """Where the mug is in frame k: a matrix for its root."""
    a = math.radians(TIP_TOWARD)
    d = Vector((-math.cos(a), -math.sin(a), 0))       # the way it tips
    axis = Vector((0, 0, 1)).cross(d)
    foot = d * 0.5                                    # the point of its foot it tips over
    lean = min(TURN[k], LET_GO)
    m = P.about(foot, axis, lean)
    if TURN[k] > LET_GO:
        air = k - TURN.index(LET_GO)
        middle = m @ Vector((0, 0, HEIGHT * 0.48))
        m = Matrix.Translation(d * DRIFT * air) @ P.about(middle, axis, TURN[k] - LET_GO) @ m @ Matrix.Rotation(math.radians(SPIN * air), 4, "Z")
    return m


# The coffee once it leaves (from the frame it lets go): how long the tongue of it is (units), how thick at the
# mouth, how far it has been left behind above the dropping mug, and how many loose drops lead it.
SPLASH = [(0.55, 0.24, 0.0, 0), (0.90, 0.22, 0.0, 2), (1.10, 0.17, 0.06, 3), (1.05, 0.13, 0.30, 3), (0.85, 0.10, 0.58, 3), (0.60, 0.08, 0.90, 3)]
FLUNG = 2            # frames after letting go by which the coffee is out: from then it keeps the way it left


def spill(k, mat):
    """The coffee in frame k: level in the mug while it only leans, brimming at the low
    side of the lip as it tips, then a tongue of it flung out of the mouth, thinning
    and breaking into drops, left behind above the mug as it drops away."""
    m = pose(k)
    made = []
    a = math.radians(TIP_TOWARD)
    d = Vector((-math.cos(a), -math.sin(a), 0))
    up = Vector((0, 0, 1))
    start = TURN.index(LET_GO)
    if k < start:
        # Still inside: the surface stays nearly level (it leans less than the mug) and slides to the low side.
        surface = P.disc(0.527, 0, "coffee")
        axis = up.cross(d)
        lean = TURN[k] / LET_GO
        centre = m @ (Vector((0, 0, 1.33 + 0.07 * lean)) + d * 0.05 * lean)
        surface.matrix_world = Matrix.Translation(centre) @ Matrix.Rotation(math.radians(TURN[k] * 0.55), 4, axis)
        made.append(surface)
        if k == start - 1:
            # Brimming: a bulge over the low side of the lip, about to go.
            low = m @ (d * 0.55 + Vector((0, 0, HEIGHT - 0.03)))
            made.append(P.blobs([(low, 0.24), (low + d * 0.06 + Vector((0, 0, -0.09)), 0.17)], "spill", resolution=0.025))
    else:
        length, thick, behind, drops = SPLASH[k - start]
        m = pose(min(k, start + FLUNG))
        out = (m.to_3x3() @ up).normalized()
        rim = [m @ Vector((0.5 * math.cos(t * math.pi / 12), 0.5 * math.sin(t * math.pi / 12), HEIGHT - 0.04)) for t in range(24)]
        low = min(rim, key=lambda p: p.z)
        origin = low.lerp(m @ Vector((0, 0, HEIGHT - 0.05)), 0.45) - out * 0.12 + up * behind
        # It leaves the way the mouth points and curls up and back as the mug falls from under it.
        way = (out * 0.8 + up * 0.25 - d * 0.15).normalized()
        gone = max(0, k - start - FLUNG)
        origin += way * (0.14 * gone) + Vector((0, -0.25, 0)) * min(1, gone)   # still travelling, clear of the mug as it comes round
        at = lambda t: origin + way * (t * length) + up * (0.42 * t * t * length) - d * (0.18 * t * t * length)   # noqa: E731
        n = 9
        elements = [(at(i / (n - 1)), 2.0 * max(0.05, thick * (1 - 0.72 * (i / (n - 1)) ** 0.9))) for i in range(n)]
        made.append(P.blobs(elements, "spill", resolution=0.022))
        side = Vector((0, 1, 0)).cross((at(1.0) - at(0.8)).normalized())
        for i, (t, off, r) in enumerate(((1.22, 0.05, 0.10), (1.46, -0.08, 0.08), (1.72, 0.04, 0.06))[:drops]):
            made.append(P.ball(r, at(t) + side * off, "spill_drop", scale=(0.85, 0.85, 1.3), segments=16))
    for ob in made:
        kit.assign(ob, mat)
    return made


def frame_points(parts, cam):
    """The mug's corners in the camera's plane, for framing."""
    inv = cam.matrix_world.inverted()
    bpy.context.view_layer.update()
    return [inv @ (o.matrix_world @ Vector(c)) for o in parts for c in o.bound_box]


def shoot(out, samples=int(os.environ.get("SAMPLES", 96)), only=None):
    kit.reset()
    kit.setup(size=(SIZE * 3, SIZE * 3), samples=samples)
    root, parts = build()
    brew = P.coffee()
    cam = kit.camera("front", elev=P.ELEV, span=FRAME)
    # One framing for every frame: the box that holds the whole tumble, centred.
    pts = []
    for k in range(len(TURN)):
        root.matrix_world = pose(k)
        pts += frame_points(parts, cam)
    xs, ys = [p.x for p in pts], [p.y for p in pts]
    # (a little up and to the left of the mug's own box: the coffee leaves that way)
    cam.location += cam.matrix_world.to_3x3() @ Vector(((min(xs) + max(xs)) / 2 - 0.3, (min(ys) + max(ys)) / 2 + 0.25, 0))
    assert max(xs) - min(xs) + 0.6 < FRAME and max(ys) - min(ys) + 0.5 < FRAME, (max(xs) - min(xs), max(ys) - min(ys))
    kit.studio(cam, span=1.7, target=(0, 0, HEIGHT / 2))
    frames = []
    for k in range(len(TURN)):
        if only is not None and k not in only:
            continue
        root.matrix_world = pose(k)
        wet = spill(k, brew)
        kit.outline(2.0, exclude=[o for o in wet if o.name.startswith("coffee")])
        path = os.path.join(out, f"mug_{k:02d}.png")
        kit.render(path)
        frames.append(path)
        for ob in wet:
            bpy.data.objects.remove(ob)
        fs = bpy.context.view_layer.freestyle_settings   # the outline's line sets and collections are made per call
        for ls in list(fs.linesets):
            ls.collection = None
            fs.linesets.remove(ls)
        for col in list(bpy.data.collections):
            bpy.data.collections.remove(col)
    anchors = {
        "left": kit.project(cam, (-R, 0, 0.6))[0], "right": kit.project(cam, (R, 0, 0.6))[0],
        "foot": kit.project(cam, (0, -0.5, 0))[1], "mouth": kit.project(cam, (0, 0, HEIGHT))[1],
        "pivot": kit.project(cam, tuple(Vector((-math.cos(math.radians(TIP_TOWARD)), -math.sin(math.radians(TIP_TOWARD)), 0)) * 0.5)),
    }
    return frames, anchors


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else export.scratch("home_mug")
    os.makedirs(out, exist_ok=True)
    only = [int(v) for v in os.environ["FRAMES"].split(",")] if os.environ.get("FRAMES") else None
    paths, anchors = shoot(out, only=only)
    if only is None:
        ims = [export.load(p) for p in paths]
        boxes = [export.bounds(im) for im in ims]
        box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
        w, h = ims[0].size
        pts = ((box[2] - box[0]) / (w / SIZE), (box[3] - box[1]) / (h / SIZE))   # the frame's size in points
        fx = lambda v: round((v * w - box[0]) / (box[2] - box[0]), 4)             # noqa: E731
        fy = lambda v: round((v * h - box[1]) / (box[3] - box[1]), 4)             # noqa: E731
        sheet = export.sprite_sheet(ims, "assets/home/mug-tumble.png", size=pts, columns=5)
        total = sheet["bytes"]
        total += export.export(ims[0].crop(box), "assets/home/mug.png", sizes=(round(pts[0]), round(pts[1])), canvas=True)
        print("frame (points)", tuple(round(v, 2) for v in pts), "sheet", sheet)
        print("anchors (shares of a frame)", {"left": fx(anchors["left"]), "right": fx(anchors["right"]), "foot": fy(anchors["foot"]),
                                              "mouth": fy(anchors["mouth"]), "pivot": (fx(anchors["pivot"][0]), fy(anchors["pivot"][1]))})
        print(f"total {total / 1024:.1f} KB")
