# The camera's prints (src/capture/ui/rangefinder/LastPlate.tsx):
#   print   one print: a sheet of photo paper with its picture cut clear, so the app lays the
#           photo just taken behind it; it slides out from under the tray's cover
#   tray    where the prints pile up: a felt-lined well in a brass rim, with the brass cover
#           across its top that each print comes out from under
#
#   <bpy python> scripts/blender/props/camera_prints.py        # ONLY=print for one
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from camera_common import M, Stage, brass, clear, kit, rounded_rect, shoot, sweep, totals, wanted  # noqa: E402

PAPER = (48, 62)          # the sheet
BORDER = 3.5              # its white edge: the picture is 41 x 55, 3:4
PRINT_M = 4               # the picture's margin round the sheet
BOX = 72                  # the app's control
WELL = (4, 64, 8)         # the well: inset in the box, size, corner
TRAY_M = (6, 12)          # the picture's margin: sides and foot, and top (the cover stands over the box)


def print_():
    w, h = PAPER
    m = PRINT_M
    st = Stage(w + 2 * m, h + 2 * m)
    hole = [(m + BORDER, m + BORDER), (m + w - BORDER, m + BORDER), (m + w - BORDER, m + h - BORDER), (m + BORDER, m + h - BORDER)]
    sheet = st.extrude(rounded_rect(m, m, w, h, 1.4, 5), d=0.9, back=0, bevel=0.3, name="sheet", holes=[hole])
    kit.assign(sheet, M.paper("sheet", color=(1.0, 0.97, 0.91), fibre=0.25, age=0.08))
    st.light(shadow=0.0, reach=2.4, strength=0.6)
    st.ink(2)
    shoot(st, "print", lambda im: clear(st, im, m + BORDER + 0.3, m + BORDER + 0.3, w - 2 * BORDER - 0.6, h - 2 * BORDER - 0.6, 0))


def tray():
    mx, my = TRAY_M
    inset, well, r = WELL
    st = Stage(BOX + 2 * mx, BOX + my + mx)
    x, y = mx + inset, my + inset
    floor = st.slab(x - 0.5, y - 0.5, well + 1, well + 1, d=0.2, back=-1.5, r=r + 0.5, bevel=0, name="floor")
    kit.assign(floor, M.felt("floor", color=(0.040, 0.018, 0.046), nap=0.8))
    st.no_ink.append(floor)
    b = brass("tray", age=0.45, brushed=0.4, wear=0.8)
    rim = sweep(st, x, y, well, well, r, [(0, 0.3), (0.8, 3.0), (1.5, 3.6), (3.1, 3.6), (3.8, 2.8), (4.0, 0)], "rim")
    kit.assign(rim, b)
    # The cover the prints come out from under: across the well's top, its lower edge 1 inside the well.
    cover = st.slab(mx + 5, 2, BOX - 10, y + 1 - 2, d=6.2, r=4.5, bevel=1.5, name="cover")
    kit.assign(cover, brass("cover", age=0.35, brushed=0.6, wear=0.8, axis="X"))
    for sx in (mx + 12, mx + BOX - 12):
        st.screw(sx, 2 + (y - 1) / 2, 6.2, r=1.9, turn=sx * 7)
    st.light(shadow=0.0, reach=3.0)
    st.ink(2)
    shoot(st, "tray")


if __name__ == "__main__":
    if wanted("print"):
        print_()
    if wanted("tray"):
        tray()
    print("camera prints:", totals())
