# The held items' icons, all of them: renders each (items_paper.py, items_metal.py,
# items_things.py, items_gadgets.py) and writes assets/items/<name>.png, @2x, @3x (src/play2/icons/art.ts
# requires them by these names).
#
#   <bpy python> scripts/blender/props/items_all.py            # everything
#   <bpy python> scripts/blender/props/items_all.py key note   # just these
#   SAMPLES=24 <bpy python> scripts/blender/props/items_all.py --draft key   # render only, quick, nothing written to assets/
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import items_gadgets as gadgets  # noqa: E402
import items_metal as metal  # noqa: E402
import items_paper as paper  # noqa: E402
import items_things as things  # noqa: E402
from items_common import SIZE, export, shoot  # noqa: E402

# File name -> what builds it. (art.ts: the same names, camel-cased.)
ITEMS = {
    "key": metal.key, "coin": metal.coin, "ring": metal.ring, "watch": metal.watch, "wheel": metal.wheel, "lens": metal.lens,
    "note": paper.note, "torn-left": paper.torn_left, "torn-right": paper.torn_right, "taped": paper.taped, "letter": paper.letter,
    "photo": paper.photo, "ticket": paper.ticket, "map": paper.map_, "scroll": paper.scroll, "notepad": paper.notepad,
    "printed": paper.printed, "fold-in": paper.fold_in,
    "book": things.book, "box": things.box, "bottle": things.bottle, "matchbook": things.matchbook, "pencil": things.pencil,
    "torch": things.torch, "uv-light": things.uv_light, "uv-light-on": things.uv_light_on,
    # The gadgets' things (items_gadgets.py): what a key was pressed into, the balance and a weight, a music box, a ribbon.
    **gadgets.ITEMS,
}

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    draft = "--draft" in sys.argv
    out = export.scratch("items")
    total = 0
    for name in args or ITEMS:
        src = shoot(ITEMS[name], os.path.join(out, name + ".png"))
        a = export.load(src).getchannel("A")
        edge = max(max(a.crop(box).getextrema()) for box in ((0, 0, a.width, 1), (0, a.height - 1, a.width, a.height), (0, 0, 1, a.height), (a.width - 1, 0, a.width, a.height)))
        if edge > 8:
            print(f"  ** {name}: touches the frame (alpha {edge} on the border) **")
        if not draft:
            total += export.export(src, f"assets/items/{name}.png", sizes=(SIZE, SIZE), canvas=True)
    if not draft:
        print(f"total {total / 1024:.1f} KB")
