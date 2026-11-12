# The nine charms as flat designs: the shapes every finish is made from (the
# enamel pins' plates, walls and cells; the stickers' print and die-cut; the
# debossed silhouettes). Drawn on a 64 box, y down, like the SVGs they replace
# (src/screens/collection/CharmArt.tsx before round 13), so a design is a few
# filled shapes painted in order plus some lines. charms_pins.py builds them.
#
# Needs shapely (pip install shapely into the bpy Python) for the 2D geometry.
import math
import re

from shapely import affinity
from shapely.geometry import LineString, MultiLineString, MultiPolygon, Point, Polygon
from shapely.ops import unary_union

BOX = 64.0
UNIT = 2.0 / BOX          # one design unit in Blender units (the box is the kit's 2-unit prop)
FILL = 55.0               # the plate's longer side, in design units (the rest of the box is room for the shadow and the line)
RIM = 2.1                 # metal round the outside of the shapes
WALL = 1.3                # metal between two colours
LINE = 1.5                # a raised metal line's least width
DIECUT = 4.3              # a sticker's white border
INK = "#3A2630"           # a sticker's printed line

# ---------------------------------------------------------------- paths


def circ(cx, cy, r):
    return ("circle", cx, cy, r)


def spark(cx, cy, r):
    """A four-point sparkle."""
    w = r * 0.26
    return (f"M{cx} {cy - r} Q{cx + w} {cy - w} {cx + r} {cy} Q{cx + w} {cy + w} {cx} {cy + r} "
            f"Q{cx - w} {cy + w} {cx - r} {cy} Q{cx - w} {cy - w} {cx} {cy - r} Z")


def subpaths(d, steps=14):
    """An SVG path (absolute M L H V Q C Z only) as polylines: [(points, closed), ...]."""
    out, pts, closed = [], [], False
    tok = re.findall(r"[MLHVQCZ]|-?\d*\.?\d+", d)
    i, cmd, x, y = 0, None, 0.0, 0.0

    def num():
        nonlocal i
        v = float(tok[i])
        i += 1
        return v

    while i < len(tok):
        if tok[i] in "MLHVQCZ":
            cmd = tok[i]
            i += 1
            if cmd == "Z":
                closed = True
                continue
            if cmd == "M":
                if pts:
                    out.append((pts, closed))
                pts, closed = [], False
        if cmd == "M":
            x, y = num(), num()
            pts.append((x, y))
            cmd = "L"
        elif cmd == "L":
            x, y = num(), num()
            pts.append((x, y))
        elif cmd == "H":
            x = num()
            pts.append((x, y))
        elif cmd == "V":
            y = num()
            pts.append((x, y))
        elif cmd == "Q":
            cx, cy, ex, ey = num(), num(), num(), num()
            for k in range(1, steps + 1):
                t = k / steps
                pts.append(((1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t * t * ey))
            x, y = ex, ey
        elif cmd == "C":
            ax, ay, bx, by, ex, ey = num(), num(), num(), num(), num(), num()
            for k in range(1, steps + 5):
                t = k / (steps + 4)
                a, b, c, e = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
                pts.append((a * x + b * ax + c * bx + e * ex, a * y + b * ay + c * by + e * ey))
            x, y = ex, ey
    if pts:
        out.append((pts, closed))
    return out


def shape(d):
    """A filled part as a polygon."""
    if isinstance(d, tuple):
        return Point(d[1], d[2]).buffer(d[3], 32)
    return unary_union([Polygon(p).buffer(0) for p, _ in subpaths(d) if len(p) >= 3])


def stroke(d):
    """A line's centre (open or closed runs)."""
    if isinstance(d, tuple):
        return Point(d[1], d[2]).buffer(d[3], 32).exterior
    runs = [LineString(p + [p[0]] if c else p) for p, c in subpaths(d) if len(p) >= 2]
    return runs[0] if len(runs) == 1 else MultiLineString(runs)


# ---------------------------------------------------------------- the nine
# base, then details: the filled shapes, painted in order (their union is the
# charm's silhouette); a third value (cx, cy, k) grows a shape about a point. lines: raised metal on a pin (w: width); on a
# sticker they print in `alt` (default: the ink). tilt: how it sits, degrees.

DRAW = {
    # A skeleton key, its round bow cut through with a keyhole.
    "key": dict(
        tilt=-16,
        base=[
            (circ(32, 17, 11), "#7B4A80"),
            ("M29 26 H35 V53.5 Q32 57.5 29 53.5 Z", "#7B4A80"),
            ("M34 41.5 H42.5 Q44 41.5 44 43 V46.5 Q44 48 42.5 48 H34 Z", "#7B4A80"),
            ("M34 50 H40 Q41.5 50 41.5 51.5 V53.5 Q41.5 55 40 55 H34 Z", "#7B4A80"),
        ],
        details=[
            (circ(32, 15.2, 3.4), "#2A1620"),
            ("M30.3 16.5 H33.7 L34.8 22.6 H29.2 Z", "#2A1620"),
        ],
        lines=[dict(d="M28.6 32.5 H35.4"), dict(d="M28.6 35.8 H35.4")],
        shine="M23.4 14 Q24.2 9.6 28.4 8",
    ),
    # A fedora with an ink band and a press card tucked in it.
    "fedora": dict(
        tilt=-6,
        base=[
            ("M18.5 37 Q17 24 21 17.5 Q24.5 12.5 29 15.5 Q32 17 35 15.5 Q39.5 12.5 43 17.5 Q47 24 45.5 37 Z", "#5A3560"),
            ("M40.5 31.5 L44.5 19 L52.5 21.6 L48.5 34 Z", "#F4E6C8"),
            ("M7 41 Q8.5 35.5 19 35 Q32 34 45 35 Q55.5 35.5 57 41 Q56 46.5 45 46.5 Q32 48.5 19 46.5 Q8 46.5 7 41 Z", "#432748"),
        ],
        details=[("M18.2 30.5 Q32 33.5 45.8 30.5 L45.6 36.2 Q32 38.8 18.4 36.2 Z", "#21121C")],
        lines=[
            dict(d="M32 17.5 Q30.8 22 32 26.5"),
            dict(d="M44.6 23.4 L50.4 25.3 M43.7 26.4 L48.4 27.9", w=1.1, alt="#5A3560"),
        ],
        shine="M22 25 Q22 19.5 25 17",
    ),
    # A matchbook from a hotel bar, one match struck.
    "matchbook": dict(
        tilt=8,
        base=[
            ("M15.5 12.5 H20.5 V24 H15.5 Z", "#F4E6C8"),
            ("M22.5 12.5 H27.5 V24 H22.5 Z", "#F4E6C8"),
            ("M29.5 12.5 H34.5 V24 H29.5 Z", "#F4E6C8"),
            ("M39.5 31.5 L50.6 14.2 L54.4 16.6 L43.3 33.9 Z", "#F4E6C8"),
            ("M55.5 3.5 Q61 9.5 59.5 13.5 Q58 16.8 54.6 16 Q51.2 15 51.6 11.2 Q52 7.5 55.5 3.5 Z", "#FFD9A8", (54.5, 15.5, 1.35)),
            ("M14 22 H44 Q47 22 47 25 V53 Q47 56 44 56 H14 Q11 56 11 53 V25 Q11 22 14 22 Z", "#7A2A3C"),
        ],
        details=[
            (circ(18, 12.5, 3), "#C83D50"),
            (circ(25, 12.5, 3), "#C83D50"),
            (circ(32, 12.5, 3), "#C83D50"),
            (circ(52.6, 15.4, 2.8), "#3A2630"),
            ("M55.6 7.6 Q58.2 10.6 57.4 12.6 Q56.6 14.2 55 13.8 Q53.4 13.2 53.6 11.4 Q53.8 9.6 55.6 7.6 Z", "#F5A25A", (54.5, 15.5, 1.35)),
            ("M11 40 H47 V45 H11 Z", "#F4E6C8"),
            ("M11 49.5 H47 V53 Q47 56 44 56 H14 Q11 56 11 53 Z", "#3A2630"),
            (spark(29, 31.5, 5.6), "#E9C97F"),
        ],
        lines=[dict(d="M11 26.5 H47", w=1.2)],
        shine="M14.5 29 V37",
    ),
    # A magnifier, a fingerprint's ridges caught in its lens.
    "magnifier": dict(
        tilt=0,
        base=[
            ("M38 42 L42 38 L54.5 50.5 Q57 53 55 55 Q53 57 50.5 54.5 Z", "#6A3036"),
            (circ(27, 27, 17), "#C83D50"),
        ],
        details=[(circ(27, 27, 11.5), "#FFF3D6")],
        lines=[
            dict(d="M44.4 47.2 L47.2 44.4"),
            dict(d="M48.4 51.2 L51.2 48.4"),
            dict(d="M21.5 32 Q20.6 23.5 27.6 23.2 Q33.6 23 34 29.5", w=1.5, alt="#C83D50"),
            dict(d="M25 33 Q24.4 27 28 27 Q30.8 27 30.8 30.4", w=1.5, alt="#C83D50"),
        ],
        shine="M19.6 24 Q20.6 19.4 25 18",
    ),
    # A fingerprint, its ridges whorled.
    "fingerprint": dict(
        tilt=-5,
        base=[("M32 8 C44.5 8 52.5 18 52.5 31 C52.5 46 43.5 56 32 56 C20.5 56 11.5 46 11.5 31 C11.5 18 19.5 8 32 8 Z", "#C83D50")],
        details=[],
        lines=[
            dict(d="M32 29.5 Q34 29.5 34 31.5 Q34 34 31.5 36", alt="#FBEFE8"),
            dict(d="M27.5 31.5 Q27.5 25.5 32 25.5 Q38 25.5 38 31.5 Q38 37 33 41", alt="#FBEFE8"),
            dict(d="M23.5 33 Q22.5 21.5 32 21.5 Q42 21.5 42 31.5 Q42 39.5 35.5 45", alt="#FBEFE8"),
            dict(d="M18.5 30 Q19.5 17.5 32 17.5 Q45 17.5 46.5 30", alt="#FBEFE8"),
            dict(d="M27.5 44.5 Q31 40.5 30 35.5", alt="#FBEFE8"),
            dict(d="M17.5 37 Q19.5 45.5 26 50.5", alt="#FBEFE8"),
        ],
        shine="M16.5 22 Q17.5 15.5 22.5 12.5",
    ),
    # An evidence tag on its red string, checked off.
    "tag": dict(
        tilt=-10,
        base=[("M13 24 L23 13 H51 Q54.5 13 54.5 16.5 V45.5 Q54.5 49 51 49 H23 L13 38 Z", "#F6D776")],
        details=[
            ("M28 18.5 H50 V25 H28 Z", "#C83D50"),
            (circ(20.5, 31, 3.2), "#2A161B"),
            (circ(45, 40.5, 4.8), "#C83D50"),
        ],
        lines=[
            dict(d="M28 31 H48", w=1.6, alt="#7A5A33"),
            dict(d="M28 36.5 H39", w=1.6, alt="#7A5A33"),
            dict(d="M42.6 40.6 L44.4 42.5 L47.6 38.8", w=1.5, alt="#FBEFE8"),
            dict(d="M20.5 31 Q11 22 6.5 29 Q6 36 20.5 31", w=2, alt="#C83D50", loop=True),
        ],
        shine="M16.5 26 L21.5 20.5",
    ),
    # A sleepy crescent moon and its star.
    "moon": dict(
        tilt=-4,
        base=[
            ("M40 7 C25 7.5 13.5 19 14 32.5 C14.5 46 26 57 41 56 C45.5 55.7 49.5 54.2 52.5 52 C40 52.5 30.5 43.5 30 32 C29.6 21 34.5 11.5 40 7 Z", "#F6E7B0"),
            (spark(46, 22, 8), "#9FF2D8"),
        ],
        details=[(circ(21.5, 39, 2.4), "#C9B6F5")],
        lines=[dict(d="M18.5 32.5 Q21.5 35.5 24.5 32.5", w=1.8, alt="#3A2E5C")],
        shine="M19 21 Q21 15.5 25.5 12.5",
    ),
    # A planchette, its little window and its star.
    "planchette": dict(
        tilt=10,
        base=[("M32 5.5 C35.5 10.5 52 21 54.2 34.5 C55.8 46 46.5 55 32 55 C17.5 55 8.2 46 9.8 34.5 C12 21 28.5 10.5 32 5.5 Z", "#B8A6F7")],
        details=[
            (circ(32, 29, 8.5), "#F6E7B0"),
            (circ(32, 29, 6), "#252949"),
            (spark(32, 29, 3.4), "#9FF2D8"),
            (circ(20, 42, 1.8), "#F6E7B0"),
            (circ(44, 42, 1.8), "#F6E7B0"),
        ],
        lines=[dict(d="M20 48.5 Q32 52 44 48.5")],
        shine="M15.5 31 Q17 21.5 23 15.5",
    ),
    # A candle with a spirit-mint flame and lavender drips.
    "candle": dict(
        tilt=0,
        base=[
            ("M32 5.5 Q38.5 13.5 37.5 19 Q36.5 24 32 24 Q27.5 24 26.5 19 Q25.5 13.5 32 5.5 Z", "#9FF2D8"),
            ("M25 26 H39 V49 H25 Z", "#EEF0FF"),
            ("M15 50.5 Q16 46.5 32 46.5 Q48 46.5 49 50.5 Q48.5 56.5 32 56.5 Q15.5 56.5 15 50.5 Z", "#8F7FE0"),
        ],
        details=[
            ("M32 12.5 Q35 16.5 34.6 19.2 Q34 21.6 32 21.6 Q30 21.6 29.4 19.2 Q29 16.5 32 12.5 Z", "#FFFBEA"),
            ("M25 26 H39 V31 Q37.5 34 36.5 31.5 Q35.5 36.5 33.8 31.8 Q32 29.5 30 32.5 Q28.5 37 27.5 32 Q26.5 30 25 31.5 Z", "#C9B6F5"),
        ],
        lines=[dict(d="M32 23.6 V26.4", w=1.6, alt="#252949"), dict(d="M19.5 50.6 Q32 53 44.5 50.6")],
        shine="M28 35 V44",
    ),
}

KINDS = list(DRAW)
MODE = {"key": "noir", "fedora": "noir", "matchbook": "noir", "magnifier": "crime_scene", "fingerprint": "crime_scene", "tag": "crime_scene",
        "moon": "paranormal", "planchette": "paranormal", "candle": "paranormal"}

# ---------------------------------------------------------------- geometry


def lin(hex_):
    """#RRGGBB as linear RGB."""
    h = hex_.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out)


def _polys(g):
    """The polygons in any geometry."""
    if g is None or g.is_empty:
        return []
    if isinstance(g, Polygon):
        return [g]
    return [p for p in getattr(g, "geoms", []) for p in _polys(p)]


def _clean(g, r=0.22, least=1.6):
    """Open a shape a little (no slivers, no needle corners) and drop crumbs."""
    g = g.buffer(-r, 8).buffer(r, 8)
    return unary_union([p for p in _polys(g) if p.area >= least]) if not g.is_empty else g


class Design:
    """A charm laid out in the box: tilted as it sits, scaled so every charm's plate has
    the same longer side, centred. All in design units, y down."""

    def __init__(self, kind):
        art = DRAW[kind]
        self.kind = kind
        grow = lambda g, by: affinity.scale(g, by[2], by[2], origin=by[:2]) if by else g
        parts = [(grow(shape(p[0]), p[2] if len(p) > 2 else None), p[1]) for p in art["base"] + art.get("details", [])]
        lines = [dict(l, geom=stroke(l["d"]), w=max(l.get("w", 1.8), 0.0)) for l in art.get("lines", [])]
        shine = stroke(art["shine"]) if art.get("shine") else None
        # Where it sits in the box.
        body = unary_union([p for p, _ in parts] + [l["geom"].buffer(l["w"] / 2) for l in lines if l.get("loop")])
        body = affinity.rotate(body, art.get("tilt", 0), origin=(32, 32))
        x0, y0, x1, y1 = body.bounds
        f = (FILL - 2 * RIM) / max(x1 - x0, y1 - y0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

        def place(g):
            g = affinity.rotate(g, art.get("tilt", 0), origin=(32, 32))
            g = affinity.scale(g, f, f, origin=(cx, cy))
            return affinity.translate(g, 32 - cx, 32 - cy)

        self.scale = f
        self.parts = [(place(p), fill) for p, fill in parts]
        self.lines = [dict(l, geom=place(l["geom"]), w=l["w"] * f) for l in lines]
        self.shine = place(shine) if shine is not None else None
        self.silhouette = unary_union([p for p, _ in self.parts])
        loops = [l["geom"].buffer(max(l["w"], LINE) / 2 + 0.2) for l in self.lines if l.get("loop")]
        # The pin's plate: the shapes with a metal rim round them (and a wire loop where a string hangs out).
        self.plate = unary_union([self.silhouette.buffer(RIM, 16)] + loops).buffer(0.6, 16).buffer(-0.6, 16)
        # The raised lines.
        self.ridges = unary_union([l["geom"].buffer(max(l["w"], LINE) / 2, 12) for l in self.lines]) if self.lines else Polygon()
        # The enamel cells: each colour's visible part, a wall's width apart, the ridges cut out.
        seen = {}
        for i, (p, fill) in enumerate(self.parts):
            above = unary_union([q for q, _ in self.parts[i + 1:]]) if i + 1 < len(self.parts) else Polygon()
            seen.setdefault(fill, []).append(p.difference(above))
        self.cells = []
        for fill, regions in seen.items():
            cell = unary_union(regions).intersection(self.silhouette).buffer(-WALL / 2, 12).difference(self.ridges)
            cell = _clean(cell)
            if not cell.is_empty:
                self.cells.append((cell.simplify(0.03), fill))
        self.plate = self.plate.simplify(0.03)
        self.walls = self.plate.difference(unary_union([c for c, _ in self.cells]).buffer(0.001)).simplify(0.02)
        # A sticker's die-cut: a white border round everything, its dents rounded out.
        every = unary_union([self.silhouette] + [l["geom"].buffer(l["w"] / 2) for l in self.lines])
        self.diecut = every.buffer(DIECUT + 2.4, 24).buffer(-2.4, 24).simplify(0.03)

    # A sticker's print, as an image (Pillow): white, a thin ink line round the shapes, the colours, the lines.
    def print_image(self, px=1024, glint=0.5):
        from PIL import Image, ImageDraw
        ss = 2
        n = px * ss
        k = n / BOX
        im = Image.new("RGB", (n, n), (255, 253, 248))

        def paint(geom, color, opacity=1.0):
            mask = Image.new("L", (n, n), 0)
            d = ImageDraw.Draw(mask)
            for p in _polys(geom):
                d.polygon([(x * k, y * k) for x, y in p.exterior.coords], fill=int(255 * opacity))
                for hole in p.interiors:
                    d.polygon([(x * k, y * k) for x, y in hole.coords], fill=0)
            im.paste(Image.new("RGB", (n, n), color), (0, 0), mask)

        rgb = lambda h: tuple(int(h.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        paint(self.silhouette.buffer(1.15, 12), rgb(INK))
        for p, fill in self.parts:
            paint(p, rgb(fill))
        for l in self.lines:
            paint(l["geom"].buffer(max(l["w"], 1.2) / 2, 12), rgb(l.get("alt", INK)))
        if self.shine is not None and glint > 0:
            paint(self.shine.buffer(1.1, 12), (255, 255, 255), glint)
        return im.resize((px, px), Image.LANCZOS)

    def mask_image(self, geom, px=512):
        """A shape as a greyscale image (white inside)."""
        from PIL import Image, ImageDraw
        ss = 4
        n = px * ss
        k = n / BOX
        mask = Image.new("L", (n, n), 0)
        d = ImageDraw.Draw(mask)
        for p in _polys(geom):
            d.polygon([(x * k, y * k) for x, y in p.exterior.coords], fill=255)
            for hole in p.interiors:
                d.polygon([(x * k, y * k) for x, y in hole.coords], fill=0)
        return mask.resize((px, px), Image.LANCZOS)


def world(x, y):
    """A design point as (x, y) in Blender units: the box centred, y up (the pin lies flat, seen from above)."""
    return ((x - BOX / 2) * UNIT, (BOX / 2 - y) * UNIT)


if __name__ == "__main__":
    # A flat preview of every design's layers: python charms_designs.py out.png
    import sys

    from PIL import Image, ImageDraw
    cell = 256
    sheet = Image.new("RGB", (cell * len(KINDS), cell * 2), (42, 29, 49))
    for i, kind in enumerate(KINDS):
        d = Design(kind)
        k = cell / BOX
        im = Image.new("RGB", (cell, cell), (42, 29, 49))
        dr = ImageDraw.Draw(im)
        for p in _polys(d.plate):
            dr.polygon([(x * k, y * k) for x, y in p.exterior.coords], fill=(217, 178, 106))
            for h in p.interiors:
                dr.polygon([(x * k, y * k) for x, y in h.coords], fill=(42, 29, 49))
        for c, fill in d.cells:
            for p in _polys(c):
                dr.polygon([(x * k, y * k) for x, y in p.exterior.coords], fill=fill)
                for h in p.interiors:
                    dr.polygon([(x * k, y * k) for x, y in h.coords], fill=(217, 178, 106))
        sheet.paste(im, (i * cell, 0))
        st = Image.new("RGB", (cell, cell), (42, 29, 49))
        st.paste(d.print_image(cell), (0, 0), d.mask_image(d.diecut, cell))
        sheet.paste(st, (i * cell, cell))
        print(kind, "scale %.2f" % d.scale, "cells", len(d.cells), "plate", [round(v, 1) for v in d.plate.bounds])
    sheet.save(sys.argv[1] if len(sys.argv) > 1 else "charms_designs.png")
