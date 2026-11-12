// The gadgets' rendered parts (scripts/blender/props/gadget_*.py -> assets/gadgets), at the boxes the
// gadgets give them. Kept apart from sprites.tsx's ART (the first mechanisms' parts); shown the same way,
// with its Sprite.
export const GADGET = {
  // SafeDial.tsx (gadget_safe.py)
  safeDoor: require("../../../../assets/gadgets/safe-door.png") as number,
  safeDial: require("../../../../assets/gadgets/safe-dial.png") as number,
  safeDialLight: require("../../../../assets/gadgets/safe-dial-light.png") as number,
  safeHandle: require("../../../../assets/gadgets/safe-handle.png") as number,
  safeTelltale: require("../../../../assets/gadgets/safe-telltale.png") as number,
  // KeyRing.tsx, gadgets/KeyArt.tsx (gadget_keys.py): the key and the soap, each with every cut at depth 0..3.
  key: [
    require("../../../../assets/gadgets/key-0.png") as number,
    require("../../../../assets/gadgets/key-1.png") as number,
    require("../../../../assets/gadgets/key-2.png") as number,
    require("../../../../assets/gadgets/key-3.png") as number,
  ],
  soap: [
    require("../../../../assets/gadgets/soap-0.png") as number,
    require("../../../../assets/gadgets/soap-1.png") as number,
    require("../../../../assets/gadgets/soap-2.png") as number,
    require("../../../../assets/gadgets/soap-3.png") as number,
  ],
  keyRing: require("../../../../assets/gadgets/key-ring.png") as number,
  keyWay: require("../../../../assets/gadgets/key-way.png") as number,
  // Telephone.tsx (gadget_phone.py)
  phoneBody: require("../../../../assets/gadgets/phone-body.png") as number,
  phoneWheel: require("../../../../assets/gadgets/phone-wheel.png") as number,
  phoneWheelLight: require("../../../../assets/gadgets/phone-wheel-light.png") as number,
  phoneStop: require("../../../../assets/gadgets/phone-stop.png") as number,
  phoneHandset: require("../../../../assets/gadgets/phone-handset.png") as number,
  phoneHandsetOff: require("../../../../assets/gadgets/phone-handset-off.png") as number,
  // Balance.tsx (gadget_balance.py)
  balanceStand: require("../../../../assets/gadgets/balance-stand.png") as number,
  balanceBeam: require("../../../../assets/gadgets/balance-beam.png") as number,
  balancePan: require("../../../../assets/gadgets/balance-pan.png") as number,
  balanceWeight: require("../../../../assets/gadgets/balance-weight.png") as number,
} as const;
