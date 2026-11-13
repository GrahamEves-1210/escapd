# Crime scene's way out (src/play2/Ending.tsx, the moment before the reply
# letter): the case's file lies shut on the desk, a rubber stamp comes down on
# it with a thump and lifts off an imperfect CASE CLOSED.
# - end-crime-file.png: the kraft folder, its tab, its label, sheets showing at its edge;
# - end-crime-stamp.png: the stamp in the hand's place: a turned walnut handle on a black mount, its red rubber under it;
# - end-crime-impression.png: what it leaves, in the stamp's red: heavier on one side, flecked where the rubber didn't touch.
#
#   <bpy python> scripts/blender/props/moment_crime.py [file] [stamp] [impression]
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import moment_common as C  # noqa: E402
from moment_common import I, M, Matrix, Vector, bpy, export, kit  # noqa: E402
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont  # noqa: E402

FILE = (300, 372)        # points
STAMP = (150, 176)
IMPRESSION = (204, 66)
INK = "#B0263A"          # LETTER.crime_scene.stamp


def file(path):
    C.setup((FILE[0] * 2, FILE[1] * 2), samples=int(os.environ.get("SAMPLES", 14)))
    kraft = M.paper("kraft", color=C.srgb("#C29561", 0.92), fibre=0.6, age=0.3, scale=1.8)
    deep = M.paper("kraft_back", color=C.srgb("#9E7443", 0.92), fibre=0.6, age=0.3, scale=1.8)
    white = M.paper("sheet", color=C.srgb("#F8F4EA", 0.95), fibre=0.4, age=0.1, scale=1.8)
    W, H = 2.5, 3.3
    made, no_line = [], []
    # The back leaf with its tab, the sheets in it, the front leaf a little short of them.
    tab = [(-W / 2, -H / 2), (W / 2, -H / 2), (W / 2, H / 2), (W / 2 - 0.08, H / 2 + 0.2), (0.25, H / 2 + 0.2), (0.17, H / 2), (-W / 2, H / 2)]
    made.append(I.paint(I.plate(I.fillet(tab, 0.05), 0.016, z=0.0, round_=0.006, name="back"), deep))
    for i, (dx, dy, turn) in enumerate(((0.05, 0.03, 1.2), (0.02, 0.0, -0.8))):
        sheet = I.paint(I.plate(I.rounded(W - 0.16, H - 0.14, 0.01), 0.008, z=0.018 + 0.01 * i, round_=0.003, name="sheet"), white)
        sheet.matrix_world = Matrix.Translation((dx, dy, 0)) @ Matrix.Rotation(math.radians(turn), 4, "Z") @ sheet.matrix_world
        made.append(sheet)
    cover = [(-W / 2, -H / 2), (W / 2 - 0.07, -H / 2), (W / 2 - 0.07, H / 2 - 0.02), (-W / 2, H / 2 - 0.02)]
    made.append(I.paint(I.plate(I.fillet(cover, 0.05), 0.016, z=0.04, round_=0.006, name="cover"), kraft))
    zc = 0.058
    # The label: a white slip, typed lines too small to read, the form's oxblood rule round it.
    label = I.paint(I.plate(I.rounded(1.3, 0.56, 0.02, -0.42, 1.08), 0.006, z=0.056, round_=0.002, name="label"), white)
    made.append(label)
    rule = M.ink("form", C.srgb("#7A2433"))
    for pts in ([(-0.99, 0.88, zc + 0.006), (0.15, 0.88, zc + 0.006), (0.15, 1.28, zc + 0.006), (-0.99, 1.28, zc + 0.006), (-0.99, 0.88, zc + 0.006)],):
        r = I.paint(I.tube(pts, 0.007, "rule", flat=0.3, smooth=False), rule)
        made.append(r)
        no_line.append(r)
    typed = I.writing([(1.17, -0.9, 0.05), (1.03, -0.9, -0.2)], z=zc + 0.004, radius=0.011, color=(0.03, 0.02, 0.03), seed=5, wobble=0.003)
    made += typed
    no_line += typed
    # A paper clip over the top edge, holding the sheets.
    steel = M.silver("clip", color=(0.62, 0.60, 0.58), rough=0.25)
    cx, cy = 0.78, H / 2 - 0.12
    loop = [(cx - 0.05, cy + 0.14, zc + 0.012), (cx - 0.05, cy - 0.22, zc + 0.012), (cx, cy - 0.27, zc + 0.012), (cx + 0.05, cy - 0.22, zc + 0.012), (cx + 0.05, cy + 0.16, zc + 0.012),
            (cx, cy + 0.215, zc + 0.012), (cx - 0.085, cy + 0.16, zc + 0.012), (cx - 0.085, cy - 0.30, zc + 0.012), (cx, cy - 0.36, zc + 0.012), (cx + 0.085, cy - 0.30, zc + 0.012), (cx + 0.085, cy + 0.05, zc + 0.012)]
    clip = I.paint(I.tube(loop, 0.012, "clip"), steel)
    made.append(clip)
    C.move(made, Matrix.Rotation(math.radians(-3.0), 4, "Z"))
    cam = kit.camera("held", elev=C.ELEV)
    kit.fit(cam, made, margin=1.12)
    kit.studio(cam, span=3.0, target=(0, 0, 0), shadow=0.0, shadow_strength=0.9, shadow_reach=0.08)
    C.line(2.4, exclude=no_line, plain=[clip])
    kit.render(path)
    # Where the stamp lands: the middle of the cover's lower half.
    return kit.project(cam, tuple(Matrix.Rotation(math.radians(-3.0), 4, "Z") @ Vector((0.05, -0.55, zc))))


def stamp(path):
    C.setup((STAMP[0] * 3, STAMP[1] * 3), samples=int(os.environ.get("SAMPLES", 28)))
    wood = M.walnut("handle", axis="Z", figure=0.6, gloss=0.6, wear=0.5)
    black = M.ebony("mount", gloss=0.5)
    red = M.rubber("die", color=C.srgb(INK, 0.8), rough=0.6, dust=0.2)
    brass = M.brass("ferrule", age=0.4, wear=0.6)
    made = []
    die = kit.box((1.62, 0.56, 0.10), (0, 0, 0.05), "die", bevel_width=0.015)
    kit.assign(die, red)
    mount = kit.box((1.74, 0.66, 0.30), (0, 0, 0.25), "mount", bevel_width=0.04)
    kit.assign(mount, black)
    neck = kit.lathe([(0, 0.40), (0.20, 0.40), (0.21, 0.44), (0.17, 0.50), (0.15, 0.56), (0, 0.56)], name="ferrule", segments=48)
    kit.assign(neck, brass)
    handle = kit.lathe([(0, 0.55), (0.14, 0.55), (0.12, 0.70), (0.115, 0.86), (0.15, 1.0), (0.25, 1.14), (0.30, 1.30), (0.29, 1.44), (0.22, 1.56), (0.10, 1.62), (0, 1.63)], name="handle", segments=64)
    kit.bevel(handle, 0.006)
    kit.assign(handle, wood)
    made = [die, mount, neck, handle]
    # Held: tipped a little toward us and turned as a hand holds it.
    C.move(made, Matrix.Rotation(math.radians(7), 4, "Z") @ Matrix.Rotation(math.radians(-6), 4, "X"))
    cam = kit.camera("held", elev=46)
    kit.fit(cam, made, margin=1.08)
    kit.studio(cam, span=2.0, target=(0, 0, 0.8))
    C.line(3.0)
    kit.render(path)
    foot = kit.project(cam, (0, 0, 0))
    return foot


def impression():
    """CASE CLOSED as the rubber left it, at x3: a ruled box, the word; the ink thinner toward the corner
    that lifted first, mottled as a pad's ink is, flecked where the rubber didn't touch."""
    import numpy as np
    k = 3
    w, h = IMPRESSION[0] * k, IMPRESSION[1] * k
    face = os.path.join(export.REPO, "node_modules/@expo-google-fonts/archivo/800ExtraBold/Archivo_800ExtraBold.ttf")
    mask = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(mask)
    m = int(h * 0.06)
    d.rounded_rectangle((m, m, w - m, h - m), radius=int(h * 0.13), outline=255, width=int(h * 0.07))
    g = m + int(h * 0.115)
    d.rounded_rectangle((g, g, w - g, h - g), radius=int(h * 0.065), outline=255, width=max(2, int(h * 0.022)))
    text = "CASE CLOSED"
    room = w - 2 * g - int(h * 0.3)
    size = int(h * 0.5)
    while True:                                  # the biggest the word goes in the box, its letters a little apart
        font = ImageFont.truetype(face, size)
        widths = [d.textlength(ch, font=font) for ch in text]
        track = (room - sum(widths)) / (len(text) - 1)
        if track >= size * 0.06:
            break
        size -= 2
    box = d.textbbox((0, 0), text, font=font)
    x = (w - room) / 2
    for ch, cw in zip(text, widths):
        d.text((x, h / 2 - (box[1] + box[3]) / 2), ch, font=font, fill=255)
        x += cw + track
    mask = mask.filter(ImageFilter.GaussianBlur(k * 0.3))
    rng = np.random.default_rng(11)

    def cloud(cell):
        small = Image.fromarray((rng.random((h // cell + 2, w // cell + 2)) * 255).astype("uint8"))
        return np.asarray(small.resize((w, h), Image.BICUBIC), dtype="float32") / 255

    a = np.asarray(mask, dtype="float32") / 255
    yy, xx = np.mgrid[0:h, 0:w]
    lift = np.clip(1.0 - 0.55 * np.clip((xx / w - 0.62) / 0.38, 0, 1) * np.clip((0.55 - yy / h) / 0.55 + 0.35, 0, 1), 0, 1)   # the upper right went down last and lightest
    mottle = 0.80 + 0.20 * cloud(9)
    patch = np.clip((cloud(46) - 0.24) / 0.16, 0, 1) * 0.5 + 0.5       # a few places it hardly took
    fleck = np.where(cloud(2) > 0.90, 0.25, 1.0)
    a = np.clip(a * 1.25, 0, 1) * lift * mottle * patch * fleck
    n = int(INK[1:], 16)
    out = Image.new("RGBA", (w, h), ((n >> 16) & 255, (n >> 8) & 255, n & 255, 0))
    out.putalpha(Image.fromarray((a * 240).astype("uint8")).filter(ImageFilter.GaussianBlur(0.5)))
    return out


if __name__ == "__main__":
    what = sys.argv[1:] or ["file", "stamp", "impression"]
    total = 0
    if "file" in what:
        src = C.scratch("crime_file.png")
        at = file(src)
        print("the stamp lands at (shares of the file's picture, before trimming):", [round(v, 4) for v in at])
        if not C.PREVIEW:
            total += C.export_fit(src, f"{C.OUT}/end-crime-file.png", FILE, scales=(1, 2), canvas=True)
    if "stamp" in what:
        src = C.scratch("crime_stamp.png")
        foot = stamp(src)
        print("the stamp's foot (shares of its picture):", [round(v, 4) for v in foot])
        if not C.PREVIEW:
            total += C.export_fit(src, f"{C.OUT}/end-crime-stamp.png", STAMP, canvas=True)
    if "impression" in what:
        im = impression()
        if C.PREVIEW:
            im.save(C.scratch("crime_impression.png"))
        else:
            total += export.export(im, f"{C.OUT}/end-crime-impression.png", sizes=IMPRESSION, canvas=True, quantise=False)
    print(f"total {total / 1024:.1f} KB")
