# Cuts the sitting cat's tail out of its art (assets/characters/cat_sit.png,
# left as it is) so the app can bend it (src/play2/SittingCat.tsx draws it as
# a textured Skia mesh along a moving centre line):
#
# - cat_sit_body.png: the cat without its tail, the same size (444 x 640). The
#   tail runs out from behind the right haunch, so the body is simply the art
#   with the tail's pixels erased; the haunch's own outline stays.
# - cat_sit_tail.png: the tail alone, the same size and place as in the art,
#   running on a little way under the haunch (the tail's black over the body
#   side of the cut, which the body covers), so bending it never opens a gap at
#   its base.
# - cat_sit_tail.json: the tail's centre line, base (under the haunch) to just
#   past the tip, as SEGMENTS + 1 points an equal arc apart (so every segment of
#   the mesh is the same length: the fur never stretches), and at each point
#   the tail's reach to its left and right (art pixels, across the line: every
#   pixel of the tail lies inside the strip they make, with a margin), plus the
#   size of the art. The app lays a triangle strip over these, the tail image
#   mapped onto it as it lies, and turns each segment a little more than the
#   last to bend it.
#
# Stacked (the tail, the body over it) at rest they give back the art.
# Usage: python3 scripts/brand/cat_tail.py [assets/characters]
import json, sys
import numpy as np
from matplotlib.path import Path as MPath
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

DIR = sys.argv[1] if len(sys.argv) > 1 else "assets/characters"
SEGMENTS = 32
a = np.asarray(Image.open(f"{DIR}/cat_sit.png").convert("RGBA")).astype(np.float32)
H, W = a.shape[:2]
alpha = a[..., 3]
yy, xx = np.mgrid[0:H, 0:W]

# Where the tail goes behind the right haunch: the haunch's outer edge (its
# outline, just outside the purple rim), as (y, x), top to bottom. Pixels left
# of it in this band are the body's.
CUT = np.array([(574, 323), (578, 321), (588, 319), (596, 315), (602, 312), (606, 309), (614, 306)], float)
behind = (yy >= CUT[0, 0]) & (yy <= CUT[-1, 0]) & (xx < np.interp(yy, CUT[:, 0], CUT[:, 1]))
# The tail: the shape connected to a point on it, once the body side of the cut is set aside
# (the art has a faint haze of near-clear pixels everywhere; ignore it).
lab, _ = ndimage.label((alpha > 5) & ~behind, structure=np.ones((3, 3)))
core = lab == lab[450, 420]
# Its soft edge too (the antialiased fringe), never into the body.
tail = ndimage.binary_dilation(core, iterations=2) & ~behind & (alpha > 0)

# Its centre line, base (behind the haunch) to tip: points by hand, each pulled
# onto the ridge of the tail's distance field across the line, then smoothed.
GUIDE = [(312, 599), (340, 598), (365, 592), (392, 572), (410, 548), (420, 515), (421, 490), (414, 460), (400, 432),
         (380, 405), (362, 380), (352, 352), (352, 325), (362, 302), (382, 288), (405, 288), (424, 302), (434, 322), (438, 342)]
depth = ndimage.distance_transform_edt(core & (alpha > 100))
line = np.array(GUIDE, float)
for _ in range(3):
    moved = line.copy()
    for i in range(1, len(line) - 1):
        t = line[i + 1] - line[i - 1]
        t /= np.linalg.norm(t)
        n = np.array([-t[1], t[0]])
        tries = line[i] + n * np.arange(-14, 14.5, 0.5)[:, None]
        v = ndimage.map_coordinates(depth, [tries[:, 1], tries[:, 0]], order=1)
        moved[i] = tries[np.argmax(v)]
    line = moved
# On under the haunch at the base, and a little past the tip, along the line.
UNDER, PAST = 12, 6
head = line[0] - UNDER * (line[1] - line[0]) / np.linalg.norm(line[1] - line[0])
foot = line[-1] + PAST * (line[-1] - line[-2]) / np.linalg.norm(line[-1] - line[-2])
line = np.vstack([head, line, foot])


def catmull(p, per=24):
    """A Catmull-Rom curve through the points, `per` samples a span."""
    q = np.vstack([p[0], p, p[-1]])
    out = []
    for i in range(1, len(q) - 2):
        p0, p1, p2, p3 = q[i - 1], q[i], q[i + 1], q[i + 2]
        for t in np.linspace(0, 1, per, endpoint=False):
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(q[-2])
    return np.array(out)


curve = catmull(line)
arc = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(curve, axis=0), axis=1))])
length = arc[-1]
# Fine samples along it (every half pixel), and the points an equal arc apart.
fine_s = np.arange(0, length, 0.5)
fine = np.stack([np.interp(fine_s, arc, curve[:, 0]), np.interp(fine_s, arc, curve[:, 1])], 1)
step = length / SEGMENTS
points = np.stack([np.interp(np.arange(SEGMENTS + 1) * step, arc, curve[:, k]) for k in (0, 1)], 1)
# The exact step between the points (the chords, a touch under the arc).
chord = float(np.mean(np.linalg.norm(np.diff(points, axis=0), axis=1)))

# The tail image: the tail's own pixels, and its black on under the haunch near the base.
inside = core & (depth > 4)
black = np.median(a[inside][:, :3], axis=0)
img = np.zeros_like(a)
img[tail] = a[tail]
# As wide as the tail where it first shows (a little way out from the cut), and a bit.
wx, wy = curve[np.searchsorted(arc, UNDER + 20)]
reach = float(ndimage.map_coordinates(depth, [[wy], [wx]], order=1)[0]) + 2
sx, sy = points[0]
ex, ey = line[1]
# Within `reach` of the line from the strip's start to where the tail shows (never behind the start).
d = np.array([ex - sx, ey - sy]); d /= np.linalg.norm(d)
u = (xx - sx) * d[0] + (yy - sy) * d[1]
near = (u >= 1) & (np.abs((xx - sx) * d[1] - (yy - sy) * d[0]) < reach) & (u <= np.hypot(ex - sx, ey - sy) + reach)
under = behind & (alpha > 200) & near
img[under, :3] = black
img[under, 3] = 255

# Every visible pixel to the nearest fine sample: its place along the line (which
# point's span) and how far it lies to the left (+) or right (-) of the line there.
vy, vx = np.nonzero(img[..., 3] > 0)
_, k = cKDTree(fine).query(np.stack([vx, vy], 1))
tang = np.gradient(fine, axis=0)
tang /= np.linalg.norm(tang, axis=1)[:, None]
normal = np.stack([-tang[:, 1], tang[:, 0]], 1)
side = (vx - fine[k, 0]) * normal[k, 0] + (vy - fine[k, 1]) * normal[k, 1]
at = np.clip(np.round(fine_s[k] / step).astype(int), 0, SEGMENTS)
left = np.zeros(SEGMENTS + 1)
right = np.zeros(SEGMENTS + 1)
np.maximum.at(left, at, np.maximum(side, 0))
np.maximum.at(right, at, np.maximum(-side, 0))
# Wide enough for the pixels between points too (a bend's outside bulges past the chord): the
# most of each point and its neighbours, and a margin.
MARGIN = 2.5
def grow(w):
    p = np.pad(w, 1, mode="edge")
    return np.maximum.reduce([p[:-2], p[1:-1], p[2:]]) + MARGIN
left, right = grow(left), grow(right)

# The normal at each point (across the line): the mean of its segments' directions turned a quarter.
seg = np.diff(points, axis=0)
seg /= np.linalg.norm(seg, axis=1)[:, None]
dirs = np.vstack([seg[0], (seg[:-1] + seg[1:]) / 2, seg[-1]])
dirs /= np.linalg.norm(dirs, axis=1)[:, None]
normals = np.stack([-dirs[:, 1], dirs[:, 0]], 1)
L = points + normals * left[:, None]
R = points - normals * right[:, None]
# No triangle of the strip folds over at rest (all turn the same way).
def turn(p, q, r):
    return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])


turns = [turn(L[i], L[i + 1], R[i]) for i in range(SEGMENTS)] + [turn(L[i + 1], R[i + 1], R[i]) for i in range(SEGMENTS)]
assert all(t > 0 for t in turns) or all(t < 0 for t in turns), f"the strip folds: {np.round(turns, 1)}"
# Every tail pixel inside the strip.
strip = MPath(np.vstack([L, R[::-1]]))
lost = ~strip.contains_points(np.stack([vx + 0.5, vy + 0.5], 1) - 0.5, radius=-0.5)
heavy = lost & (img[vy, vx, 3] > 40)
print(f"pixels outside the strip: {lost.sum()} ({heavy.sum()} more than faint)", file=sys.stderr)

Image.fromarray(img.round().astype(np.uint8), "RGBA").save(f"{DIR}/cat_sit_tail.png")
body = a.copy()
body[tail] = 0
Image.fromarray(body.round().astype(np.uint8), "RGBA").save(f"{DIR}/cat_sit_body.png")
data = {
    "size": [W, H],
    "step": round(chord, 3),
    "points": [[round(float(x), 2), round(float(y), 2)] for x, y in points],
    "left": [round(float(v), 2) for v in left],
    "right": [round(float(v), 2) for v in right],
}
with open(f"{DIR}/cat_sit_tail.json", "w") as f:
    json.dump(data, f, separators=(",", ":"))
    f.write("\n")
print(json.dumps({"segments": SEGMENTS, "length": round(float(length), 1), "step": round(chord, 2), "left": data["left"], "right": data["right"]}))
