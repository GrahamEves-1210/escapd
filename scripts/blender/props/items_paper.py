# The paper things a player finds: a folded note, its torn halves and the two
# taped back together, a sealed letter, a photograph, a ticket stub, a folded
# map, a scroll, a spiral notepad, the overprinted card and the fold-in page.
# Paper is thick here (card-thick) so its edge catches the light and the line.
#
#   <bpy python> scripts/blender/props/items_all.py note letter ...   (items_all.py renders and exports)
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from items_common import (BUFF, CREAM, PAPER_LINE, WAXRED, WHITE, Item, M, circle, cyl, fillet, kit, paint, place, plate, rounded, sheet,  # noqa: E402
                          text, torus, tube, turned, writing)

def _item(parts, **kw):
    return Item(parts, line=PAPER_LINE, **kw)


SHADE = (0.70, 0.58, 0.40)   # the back of a folded corner, an envelope's flap
THICK = 0.04


def _paper(name, color=CREAM, age=0.3):
    return M.paper(name, color=color, age=age, fibre=0.5)


def _rows(top, n, x0, x1, step=0.26, short=()):
    return [(top - i * step, x0, x1 - (0.42 if i in short else 0.0)) for i in range(n)]


def note():
    """A slip of letter paper that was folded in four: its creases, a dog-eared corner, a few lines in a quick hand."""
    W, H, cut = 1.5, 1.95, 0.36
    # Folded down the middle and across, then opened: the two leaves lean toward each other (the lamp
    # is to the left, so the right leaf is the bright one), each rising a little from the cross-crease.
    bend = lambda x, y: 0.30 * abs(x + 0.02) + 0.10 * abs(y - 0.06) - 0.12  # noqa: E731
    sh = paint(sheet(W, H, THICK, bend=bend, bottom=lambda u: max(0.0, u * W - (W - cut))), _paper("note"))
    # The corner, folded over onto the page.
    x, y = W / 2 - cut, -H / 2
    ear = paint(plate(fillet([(x, y), (x + cut, y + cut), (x, y + cut)], 0.02), 0.03, z=bend(x + 0.12, y + 0.24) + 0.01, round_=0.01), _paper("note_back", SHADE, 0.2))
    place(ear, rotation=(4, -17, 0))
    ink = writing(_rows(0.66, 3, -0.5, 0.5, short=(2,)) + _rows(-0.2, 2, -0.5, 0.5, short=(1,)), surf=bend, seed=3)
    return _item([sh, ear] + ink, roll=5, no_line=ink)


def _jag(v):
    """The tear: big uneven teeth with a finer tremble on them (v runs 0..1 up the page)."""
    t = v * 5.2 + 0.3
    saw = abs((t % 1.0) - 0.5) * 2 - 0.5
    return 0.15 * saw + 0.035 * math.sin(v * 61) + 0.025 * math.sin(v * 137 + 1)


def _half(side, W=1.22, H=1.95, cx=0.0, z=0.0, name="half", seed=5, bend=None, rows=True, amp=1.35):
    """One torn half (side -1: the left half, torn down its right edge; +1: the right half). The
    same tear on both, so the two fit. Returns (parts, strokes)."""
    edge = cx + side * -1 * (W / 2)  # the torn side's x
    # Torn down the note's fold: each half still leans from it, and keeps the cross-crease.
    bend = bend or (lambda x, y: 0.20 * abs(x - edge) + 0.10 * abs(y - 0.06) - 0.10)
    jag = lambda v: amp * _jag(v)  # noqa: E731
    kw = {"right": jag} if side < 0 else {"left": jag}
    sh = paint(sheet(W, H, THICK, bend=bend, ny=120, z=z, cx=cx, name=name, **kw), _paper(name))
    # The torn edge's fibres: the paper's white heart, proud of the printed face by a hair.
    fray = (lambda v: jag(v) + (0.045 + 0.02 * math.sin(v * 173)) * (1 if side < 0 else -1))
    kf = {"right": fray} if side < 0 else {"left": fray}
    fib = paint(sheet(W, H, 0.02, bend=bend, ny=120, z=z - 0.012, cx=cx, name=name + "_fibres", **kf), M.paper(name + "_fibres", color=(0.95, 0.93, 0.88), age=0.0, fibre=1.0))
    ink = []
    if rows:
        for i, y in enumerate((0.66, 0.40, 0.14, -0.20, -0.46)):
            v = (y + H / 2) / H
            if side < 0:
                ink += writing([(y, cx - W / 2 + 0.2, edge + jag(v) - 0.07)], surf=bend, z=z, seed=seed + i)
            else:
                ink += writing([(y, edge + jag(v) + 0.09, cx + W / 2 - 0.2 - (0.3 if i in (2, 4) else 0.0))], surf=bend, z=z, seed=seed + i)
    return [sh, fib], ink


def torn_left():
    parts, ink = _half(-1)
    return _item(parts + ink, roll=6, no_line=ink + [parts[1]])


def torn_right():
    parts, ink = _half(+1, seed=11)
    return _item(parts + ink, roll=-6, no_line=ink + [parts[1]])


def _tape(length, width, name="tape"):
    """A strip of masking tape, its ends pinked."""
    n = 4
    L, w = length / 2, width / 2
    right = [(L - (0.035 if i % 2 else 0.0), -w + width * i / (2 * n)) for i in range(2 * n + 1)]
    left = [(-L + (0.035 if i % 2 else 0.0), w - width * i / (2 * n)) for i in range(2 * n + 1)]
    t = plate(right + left, 0.022, round_=0.008, name=name)
    return paint(t, M.paper(name, color=(0.86, 0.62, 0.24), age=0.15, fibre=0.25))


def taped():
    """The two halves, mended: the tear still showing down the middle, two strips of tape across it."""
    bend = lambda x, y: 0.09 * abs(x) + 0.10 * abs(y - 0.06) - 0.07  # noqa: E731
    W = 0.86
    a, ia = _half(-1, W=W, cx=-W / 2 - 0.012, seed=21, bend=bend, amp=0.8)
    b, ib = _half(+1, W=W, cx=W / 2 + 0.012, z=0.012, seed=31, bend=bend, amp=0.8)
    t1 = place(_tape(0.72, 0.24, "tape_a"), (0.02, 0.52, bend(0.36, 0.52) + 0.014), (0, 0, -13))
    t2 = place(_tape(0.72, 0.24, "tape_b"), (-0.02, -0.50, bend(0.36, -0.5) + 0.014), (0, 0, 10))
    ink = ia + ib
    return _item(a + b + [t1, t2] + ink, roll=-4, no_line=ink + [a[1], b[1]])


def letter():
    """An envelope, seen from the back: the flap sealed with a drop of red wax."""
    W, H = 2.0, 1.34
    body = paint(plate(rounded(W, H, 0.05), 0.085, round_=0.03, name="envelope"), _paper("envelope", BUFF, 0.25))
    flap = plate(fillet([(-W / 2 + 0.01, H / 2 - 0.01), (W / 2 - 0.01, H / 2 - 0.01), (0.0, -0.2)], 0.06), 0.035, z=0.085, round_=0.014, name="flap")
    paint(flap, _paper("flap", (0.72, 0.56, 0.34), 0.2))
    seam = M.ink("seam", (0.30, 0.20, 0.12))
    seams = [paint(tube([(sx * (W / 2 - 0.03), -H / 2 + 0.03, 0.09), (sx * 0.5, -0.36, 0.09), (sx * 0.16, -0.13, 0.09)], 0.011, "seam", flat=0.4, smooth=False), seam) for sx in (-1, 1)]
    # The seal: a pressed drop of wax, its edge uneven, a ring and a boss stamped in it.
    blob = [(0.30 * (1 + 0.10 * math.sin(3 * a + 1.0) + 0.06 * math.sin(5 * a + 0.3)) * math.cos(a), -0.2 + 0.30 * (1 + 0.10 * math.sin(3 * a + 1.0) + 0.06 * math.sin(5 * a + 0.3)) * math.sin(a))
            for a in [2 * math.pi * i / 64 for i in range(64)]]
    wax = M.wax("seal", color=WAXRED, translucency=0.25, gloss=0.8)
    seal = paint(plate(blob, 0.10, z=0.115, round_=0.045, name="seal", resolution=5), wax)
    ring = paint(torus(0.165, 0.028, (0, -0.2, 0.215), "seal_ring", scale=(1, 1, 0.7)), wax)
    boss = paint(plate(circle(0.075, 24, 0, -0.2), 0.05, z=0.2, round_=0.02, name="seal_boss"), wax)
    return _item([body, flap, seal, ring, boss] + seams, roll=5, no_line=seams, plain=[ring, boss])


def photo():
    """A photograph in its white border: a moonlit hill."""
    W, H = 1.6, 1.94
    card = paint(plate(rounded(W, H, 0.05), 0.06, round_=0.022, name="photo"), M.paper("photo_card", color=WHITE, age=0.1, fibre=0.2))
    pw, ph, py = 1.34, 1.30, 0.20
    sky = paint(plate(rounded(pw, ph, 0.02, 0, py), 0.014, z=0.058, round_=0.005, name="sky"), M.enamel("sky", color=(0.03, 0.045, 0.24), gloss=0.25))
    hill = []
    for i in range(41):
        x = -pw / 2 + 0.01 + (pw - 0.02) * i / 40
        hill.append((x, py - 0.36 + 0.22 * math.exp(-((x + 0.22) / 0.34) ** 2) + 0.13 * math.exp(-((x - 0.42) / 0.26) ** 2)))
    ground = paint(plate([(pw / 2 - 0.01, py - ph / 2 + 0.01), (-pw / 2 + 0.01, py - ph / 2 + 0.01)] + hill, 0.01, z=0.07, round_=0.003, name="hill"), M.enamel("hill", color=(0.012, 0.012, 0.05), gloss=0.25))
    moon = paint(plate(circle(0.19, 32, 0.30, py + 0.26), 0.01, z=0.07, round_=0.003, name="moon"), M.glow("moon", (1.0, 0.82, 0.50), 1.6))
    return _item([card, sky, ground, moon], roll=-6, no_line=[moon], plain=[ground])


def ticket():
    """A ticket stub: card with a bite out of each end, a row of perforations, ADMIT ONE."""
    W, H, r = 2.1, 1.06, 0.17
    corners = rounded(W, H, 0.06)
    n = 7  # points per corner arc (rounded()'s n + 1)
    # Right side, bottom to top: corner, notch, corner; then the left side the same way.
    def notch(x, up):
        pts = [(x + (r * math.cos(a) if x < 0 else -r * math.cos(a)), r * math.sin(a) * (1 if up else -1)) for a in [-math.pi / 2 + math.pi * i / 12 for i in range(13)]]
        return pts
    q1, q2, q3, q4 = corners[0:n], corners[n:2 * n], corners[2 * n:3 * n], corners[3 * n:4 * n]
    out = q4 + notch(W / 2, True) + q1 + q2 + notch(-W / 2, False) + q3
    card = (0.16, 0.42, 0.40)
    px = 0.56
    holes = [circle(0.034, 12, px, -H / 2 + 0.11 + i * (H - 0.22) / 6) for i in range(7)]
    body = paint(plate(out, 0.07, holes=holes, round_=0.022, name="ticket"), M.paper("ticket", color=card, age=0.25, fibre=0.6))
    pale = M.ink("ticket_print", (0.86, 0.80, 0.62))
    frame = paint(tube([(x, y, 0.071) for x, y in rounded(1.18, 0.74, 0.07, -0.26, 0.0)], 0.013, "frame", cyclic=True, flat=0.4, smooth=False), pale)
    font = "playfair-display/900Black/PlayfairDisplay_900Black.ttf"
    t1 = paint(text("ADMIT", font, 0.25, (-0.26, 0.15, 0.07), 0.006, spacing=1.06), pale)
    t2 = paint(text("ONE", font, 0.25, (-0.26, -0.15, 0.07), 0.006, spacing=1.2), pale)
    num = paint(text("47", font, 0.24, (0.82, 0.0, 0.07), 0.006, rotation=math.pi / 2), pale)
    return _item([body, frame, t1, t2, num], roll=14, no_line=[frame, t1, t2, num])


def map_():
    """A chart folded in three: a dashed red route across it to an X."""
    W, H = 2.1, 1.56
    def bend(x, y):
        k = 0.34
        if x < -0.35:
            return k * (x + 1.05) * 0.9
        if x < 0.35:
            return k * 0.7 * 0.9 - k * (x + 0.35) * 0.9
        return k * (x - 0.35) * 0.9
    sh = paint(sheet(W, H, THICK, bend=bend, nx=42, name="map"), M.paper("map", color=(0.82, 0.70, 0.47), age=0.55, fibre=0.6))
    red = M.ink("route", (0.60, 0.05, 0.04))
    brown = M.ink("coast", (0.33, 0.22, 0.13))
    path = lambda t: (-0.82 + 1.42 * t, -0.48 + 0.78 * t + 0.16 * math.sin(t * 7.0))  # noqa: E731
    marks = []
    for i in range(7):
        t0, t1 = i / 7 + 0.02, i / 7 + 0.095
        pts = [(*path(t), bend(*path(t)) + 0.008) for t in (t0, (t0 + t1) / 2, t1)]
        marks.append(paint(tube(pts, 0.024, "dash", flat=0.4, smooth=False), red))
    ex, ey = 0.74, 0.40
    for d in (1, -1):
        pts = [(ex - 0.11, ey - 0.11 * d, bend(ex - 0.11, ey) + 0.008), (ex + 0.11, ey + 0.11 * d, bend(ex + 0.11, ey) + 0.008)]
        marks.append(paint(tube(pts, 0.03, "x", flat=0.4, smooth=False), red))
    # A coastline and a couple of contours, in faded brown.
    for (cx, cy, r, k) in ((-0.55, 0.36, 0.26, 3), (0.5, -0.38, 0.22, 4), (-0.55, 0.36, 0.14, 3)):
        pts = []
        for i in range(28):
            a = 2 * math.pi * i / 28
            rr = r * (1 + 0.22 * math.sin(k * a + cx * 9))
            x, y = cx + rr * math.cos(a) * 1.25, cy + rr * math.sin(a)
            pts.append((x, y, bend(x, y) + 0.006))
        marks.append(paint(tube(pts, 0.011, "contour", cyclic=True, flat=0.4), brown))
    return _item([sh] + marks, roll=-5, no_line=marks)


def scroll():
    """A scroll, part unrolled: parchment between two rolls, a red ribbon from the lower one."""
    W, H = 1.3, 1.36
    bend = lambda x, y: 0.05 - 0.07 * (x * x)  # noqa: E731
    parch = (0.82, 0.69, 0.46)
    sh = paint(sheet(W, H, 0.03, bend=bend, name="scroll"), M.paper("parchment", color=parch, age=0.5, fibre=0.7))
    rolls = []
    roll_m = M.paper("roll", color=(0.74, 0.60, 0.38), age=0.5, fibre=0.7)
    wood = M.walnut("rod", axis="X", gloss=0.6)
    for sy, r in ((1, 0.17), (-1, 0.20)):
        y = sy * (H / 2 + r * 0.55)
        rolls.append(paint(cyl(r, W + 0.04, (0, y, r * 0.8), "X", "roll", bevel=0.02), roll_m))
        for sx in (-1, 1):
            knob = turned([(0, 0), (0.07, 0), (0.07, 0.06), (0.115, 0.08), (0.125, 0.13), (0.09, 0.17), (0.0, 0.18)], wood, axis="X", name="knob", segments=32)
            knob.scale = (sx, 1, 1)
            knob.location = (sx * (W / 2 + 0.02), y, r * 0.8)
            rolls.append(knob)
    ink = writing(_rows(0.42, 4, -0.42, 0.42, step=0.25, short=(3,)), surf=bend, seed=9)
    # The ribbon, hanging from the lower roll, its end notched.
    rb = plate([(-0.11, 0.0), (0.11, 0.0), (0.11, -0.52), (0.0, -0.41), (-0.11, -0.52)], 0.025, round_=0.008, name="ribbon")
    paint(rb, M.felt("ribbon", color=WAXRED, nap=0.3))
    place(rb, (0.30, -H / 2 - 0.02, 0.42), (0, 0, 7))
    return _item([sh, rb] + rolls + ink, roll=9, no_line=ink)


def notepad():
    """A spiral notepad: a card back, a block of white leaves, the wire along the top, the top leaf dented by the last hand."""
    W, H = 1.46, 1.84
    back = paint(plate(rounded(W + 0.06, H + 0.06, 0.07, 0, -0.02), 0.05, round_=0.02, name="pad_back"), M.paper("pad_back", color=(0.50, 0.36, 0.20), age=0.2, fibre=0.8))
    block = paint(kit.box((W, H, 0.17), (0, 0, 0.05 + 0.085), "pad_block", bevel_width=0.012), M.paper("pad_edge", color=(0.80, 0.76, 0.66), age=0.0, fibre=1.0))
    # The top leaf, its lower corner lifting.
    def curl(x, y):
        d = max(0.0, x - y - 1.25)
        return 0.9 * d * d
    top = paint(sheet(W, H, 0.012, bend=curl, z=0.236, name="pad_top"), M.paper("pad_leaf", color=WHITE, age=0.05, fibre=0.3))
    dents = writing(_rows(0.34, 4, -0.48, 0.48, step=0.27, short=(3,)), surf=curl, z=0.236, color=(0.60, 0.55, 0.47), seed=17, radius=0.014)
    # The wire: a coil through the leaves' top edge, each turn standing clear of the pad.
    y0, r, turns = H / 2 - 0.10, 0.125, 9
    pts = []
    for i in range(turns * 16 + 1):
        a = 2 * math.pi * i / 16
        pts.append((-W / 2 + 0.13 + (W - 0.26) * i / (turns * 16), y0 + 0.02 + r * math.cos(a) * 0.9, 0.15 + r * math.sin(a)))
    wire = paint(tube(pts, 0.032, "wire"), M.silver("wire", color=(0.75, 0.74, 0.72), rough=0.25, tarnish=0.3))
    holes = [paint(plate(circle(0.036, 12, -W / 2 + 0.13 + (W - 0.26) * (k + 0.5) / turns, y0 - 0.075), 0.004, z=0.25, round_=0.001, name="hole"), M.ink("hole", (0.05, 0.035, 0.04))) for k in range(turns)]
    return _item([back, block, top, wire] + holes + dents, roll=-5, no_line=dents + holes, plain=[wire])


def printed():
    """The printed card: a line in pale blue-green, a jumble of red printed over it (until a red lens sorts them)."""
    W, H = 2.0, 1.38
    card = paint(plate(rounded(W, H, 0.07), 0.06, round_=0.022, name="card"), M.paper("card", color=WHITE, age=0.1, fibre=0.3))
    rule = paint(tube([(x, y, 0.061) for x, y in rounded(W - 0.2, H - 0.2, 0.05)], 0.009, "rule", cyclic=True, flat=0.4, smooth=False), M.ink("rule", (0.55, 0.47, 0.34)))
    font = "special-elite/400Regular/SpecialElite_400Regular.ttf"
    blue = M.ink("print_blue", (0.025, 0.21, 0.30))
    red = M.ink("print_red", (0.70, 0.06, 0.04))
    words = [paint(text(t, font, 0.44, (0.0, y, 0.06), 0.004, spacing=1.1), blue) for t, y in (("MEET", 0.27), ("AT NINE", -0.27))]
    # The red: big loose loops and crossings laid over both lines.
    over = []
    for row, y in enumerate((0.27, -0.27)):
        pts = []
        for i in range(70):
            t = i / 69
            x = -0.78 + 1.56 * t
            pts.append((x + 0.07 * math.sin(t * 33 + row), y + 0.17 * math.sin(t * 21 + row * 2.1) + 0.05 * math.sin(t * 53), 0.066))
        over.append(paint(tube(pts, 0.03, "scrawl", flat=0.4), red))
        for k in range(5):
            x = -0.66 + k * 0.33 + 0.05 * row
            over.append(paint(tube([(x - 0.1, y - 0.15, 0.067), (x + 0.1, y + 0.15, 0.067)], 0.028, "slash", flat=0.4, smooth=False), red))
    return _item([card, rule] + words + over, roll=6, no_line=[rule] + words + over)


def fold_in():
    """A fold-in page: two fold lines down it, the middle panel pleating away, an arrow at the head of each fold."""
    W, H, f = 2.0, 1.9, 0.34
    def bend(x, y):
        a = abs(x)
        return (0.20 - 0.16 * (a - f) / (W / 2 - f)) if a > f else (-0.06 + 0.26 * a / f)
    side = _paper("fold_side", CREAM, 0.25)
    mid = _paper("fold_mid", (0.62, 0.52, 0.38), 0.25)
    sw = W / 2 - f
    left = paint(sheet(sw, H, THICK, bend=bend, nx=14, cx=-(f + sw / 2), name="fold_left"), side)
    right = paint(sheet(sw, H, THICK, bend=bend, nx=14, cx=(f + sw / 2), name="fold_right"), side)
    middle = paint(sheet(2 * f, H, THICK, bend=bend, nx=14, name="fold_mid"), mid)
    ink = []
    for sx in (-1, 1):
        c = sx * (f + sw / 2)
        ink += writing(_rows(0.42, 5, c - 0.22, c + 0.22, step=0.25), surf=bend, seed=40 + sx, gaps=False)
    ink += writing(_rows(0.42, 5, -0.2, 0.2, step=0.25), surf=bend, seed=44, gaps=False, color=(0.36, 0.28, 0.22))
    red = M.ink("fold_mark", (0.62, 0.05, 0.04))
    marks = []
    y = H / 2 - 0.2
    for sx in (-1, 1):
        on = lambda x, yy: (x, yy, bend(x, yy) + 0.008)  # noqa: E731
        tip_, base = sx * (f + 0.05), sx * (f + 0.36)
        for a_, b_ in (((base, y), (tip_, y)), ((tip_ + sx * 0.13, y + 0.11), (tip_, y)), ((tip_ + sx * 0.13, y - 0.11), (tip_, y))):
            marks.append(paint(tube([on(*a_), on(*b_)], 0.028, "arrow", flat=0.4, smooth=False), red))
    return _item([left, right, middle] + ink + marks, roll=-4, no_line=ink + marks)
