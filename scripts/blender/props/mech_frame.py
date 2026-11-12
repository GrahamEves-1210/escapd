# The picture on the wall (src/play2/mechanisms/FrameTilt.tsx): a gilt moulded frame with its
# hanging wire (one sprite: the app swings it about the nail; its middle is clear, the app's
# little night landscape lies behind it) and the brass nail it hangs from.
#
#   <bpy python> scripts/blender/props/mech_frame.py        # both; ONLY=frame-nail for one
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mech_common import M, Stage, kit, rounded_rect, totals, wanted  # noqa: E402
from mech_drawer import brass  # noqa: E402

W, H, MOULD, WIRE = 180, 116, 13, 16      # FrameTilt: the frame's box (w at most), MOULD, WIRE
M_X, M_TOP, M_BOT = 6, WIRE + 4, 8        # room round it in the picture: its shadow, the wire above


def gilt(name="gilt", **kw):
    return M.brass(name, **{"color": (0.80, 0.52, 0.17), "age": 0.55, "brushed": 0.15, "wear": 0.8, "rough": 0.34, **kw})


def frame():
    st = Stage(W + 2 * M_X, H + M_TOP + M_BOT)
    ox, oy = M_X, M_TOP

    def rect(inset, r=0.0):
        return rounded_rect(ox + inset, oy + inset, W - 2 * inset, H - 2 * inset, r, 4)

    # The moulding, outside in: a bold outer bead, a hollow, a small bead, the slip by the canvas.
    for a, b, d, bev, nm in ((1.0, 5.6, 7.0, 2.0, "outer"), (5.0, 9.6, 3.6, 0.6, "hollow"), (8.8, 11.4, 5.6, 1.1, "bead"), (11.0, MOULD + 0.6, 3.0, 0.5, "slip")):
        ring = st.ring(rect(a, 2.2 if a < 2 else 0.05), rect(b, 0.05), d=d, back=0, bevel=bev, name=nm, segments=4)
        kit.assign(ring, gilt(nm, age=0.75 if nm == "hollow" else 0.5))
    # The wire: from the frame's back up to the nail.
    wire = st.rod([(ox + W * 0.24, oy + 3, 0.6), (ox + W / 2, oy - WIRE + 1.2, 1.0), (ox + W * 0.76, oy + 3, 0.6)], 0.55, "wire")
    wire.data.materials.clear()
    kit.assign(wire, M.steel("wire", color=(0.30, 0.29, 0.27), blue=0.2, rough=0.4, wear=0.0))
    st.light(shadow=1.0, reach=6.0, strength=0.7)
    st.ink(3)
    st.shoot("frame-gilt")
    print("  frame at", (ox, oy), "in", (st.w, st.h))


def nail():
    st = Stage(14, 14, ss=2)
    head = st.turned([(0, 3.0), (1.6, 2.8), (3.0, 2.0), (3.7, 0.9), (3.8, 0)], 7, 7, 0, "nail", segments=32)
    kit.assign(head, brass("nail", age=0.35, brushed=0.1))
    st.light(shadow=0.0, reach=2.5, strength=0.7)
    st.ink(2)
    st.shoot("frame-nail")


if __name__ == "__main__":
    for name, fn in (("frame-gilt", frame), ("frame-nail", nail)):
        if wanted(name):
            fn()
    print("frame:", totals())
