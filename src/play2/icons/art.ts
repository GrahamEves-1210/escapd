// The held items' icons: the things themselves, modelled and rendered in
// Blender with the kit (scripts/blender/README.md): aged brass, paper thick
// enough to catch the light, wax, walnut, glass, each under the same lamp and
// the same ink line as the magnifier and the flashlight. One square picture
// per item, the thing filling it, so a key beside a torn note beside the UV
// flashlight reads as one set on the tray's felt, on a paper tag and on the
// close-up's table.
//
// Sources: scripts/blender/props/items_*.py (items_all.py renders the set and
// writes assets/items/<name>.png, @2x, @3x; 104 pt, the size an examined item
// is shown at).

export type IconName =
  | "key" | "note" | "letter" | "tornLeft" | "tornRight" | "taped" | "uvLight" | "uvLightOn" | "torch" | "photo" | "ticket"
  | "map" | "scroll" | "ring" | "book" | "coin" | "matchbook" | "wheel" | "box" | "bottle" | "watch"
  | "pencil" | "lens" | "notepad" | "printed" | "foldIn"
  // The gadgets' things (items_gadgets.py).
  | "soap" | "wax" | "balance" | "weight" | "musicBox" | "ribbon";

export const ART: Record<IconName, number> = {
  key: require("../../../assets/items/key.png"),
  note: require("../../../assets/items/note.png"),
  letter: require("../../../assets/items/letter.png"),
  // The two halves share one tear, so the pair in the tray look as if they'd fit.
  tornLeft: require("../../../assets/items/torn-left.png"),
  tornRight: require("../../../assets/items/torn-right.png"),
  taped: require("../../../assets/items/taped.png"),
  uvLight: require("../../../assets/items/uv-light.png"),
  uvLightOn: require("../../../assets/items/uv-light-on.png"),
  torch: require("../../../assets/items/torch.png"),
  photo: require("../../../assets/items/photo.png"),
  ticket: require("../../../assets/items/ticket.png"),
  map: require("../../../assets/items/map.png"),
  scroll: require("../../../assets/items/scroll.png"),
  ring: require("../../../assets/items/ring.png"),
  book: require("../../../assets/items/book.png"),
  coin: require("../../../assets/items/coin.png"),
  matchbook: require("../../../assets/items/matchbook.png"),
  wheel: require("../../../assets/items/wheel.png"),
  box: require("../../../assets/items/box.png"),
  bottle: require("../../../assets/items/bottle.png"),
  watch: require("../../../assets/items/watch.png"),
  pencil: require("../../../assets/items/pencil.png"),
  lens: require("../../../assets/items/lens.png"),
  notepad: require("../../../assets/items/notepad.png"),
  printed: require("../../../assets/items/printed.png"),
  foldIn: require("../../../assets/items/fold-in.png"),
  // What a key was pressed into (soap; candle wax by moonlight), the pocket balance and one of its weights,
  // a music box and a typewriter ribbon.
  soap: require("../../../assets/items/soap.png"),
  wax: require("../../../assets/items/wax.png"),
  balance: require("../../../assets/items/balance.png"),
  weight: require("../../../assets/items/weight.png"),
  musicBox: require("../../../assets/items/music-box.png"),
  ribbon: require("../../../assets/items/ribbon.png"),
};
