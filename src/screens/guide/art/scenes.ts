// The four guide scenes (04, Steps), drawn in the reference's line-art style
// in the art box's own units (ref.layout.guide.art, 240 x 266). The numbers in
// the path data are the drawings themselves; the measured parts (strokes,
// inks, fills, fades, the hero phone and its screen) come from tokens through
// draw.ts. Steps 1 and 2 are plans of the room seen from above, the player in
// its middle (the 360, src/capture/slots.ts); steps 3 and 4 hold the hero
// phone in front at the lower right, as the reference does, a mid or back
// object behind it. Depth comes from brightness alone.
import { ref } from "@/theme/tokens";
import { arc, circle, polar, polyline, roundedRect, turnedRect } from "./geometry";
import type { Mark, Point, Scene } from "./types";

const PHONE = ref.layout.guide.phone;
const PLAN = ref.layout.guide.planPhone;

/** Where the hero phone is held in steps 3 and 4: the reference's place (its top-left corner). */
const HELD: Point = [95, 108];

/** The hero phone: a hero outline over the device fill, the thin bezel just inside it, and its inner screen. */
function heroPhone(at: Point): Mark[] {
  const [x, y] = at;
  const s = PHONE.screen;
  const b = PHONE.bezel;
  return [
    { d: roundedRect({ x, y, width: PHONE.width, height: PHONE.height }, PHONE.radius), ink: "hero", fill: "device" },
    { d: roundedRect({ x: x + b.inset, y: y + b.inset, width: PHONE.width - b.inset * 2, height: PHONE.height - b.inset * 2 }, b.radius), ink: "bezel" },
    {
      d: roundedRect(
        { x: x + s.insetX, y: y + s.insetTop, width: PHONE.width - s.insetX * 2, height: PHONE.height - s.insetTop - s.insetBottom },
        s.radius,
      ),
      ink: "screen",
    },
  ];
}

// The hand holding the phone at HELD (context, fading toward the bottom).
// Behind the phone: the thumb's pad and the palm's edge on the left, the
// index finger hooked round the top of the right edge, and the wrist under
// the phone. In front: three fingertips over the right edge, rounded lobes
// wide at the top right and tapering down, each tucked under the one above
// (so drawn bottom first). Together they hide the phone's edge from y 181 to
// 242.
const HAND_BEHIND: Mark[] = [
  { d: "M97 160.5C92.5 157.8 88.4 157 85.2 157.4C83.6 157.7 83 159 83 161.4C82.6 170 80.2 180 77.2 190C73.6 202 70.6 214 70.1 228C69.7 240 71 253 72.6 266", ink: "context", fade: "down" },
  { d: "M163 154.4C168.8 155.8 174.8 158.8 178.4 162.4C175.6 166.6 170.4 169.8 163 171.2", ink: "context" },
  { d: "M148.5 243C145.4 250.5 141.8 258.4 138.6 266", ink: "context", fade: "down" },
];
const HAND_FRONT: Mark[] = [
  {
    d: "M164.6 219.4C168.4 217.4 174.6 217.8 177.6 221.4C180.2 224.4 179.4 229.4 177 233.4C174.6 237.4 171 241.6 168 243C165.6 244 163.4 242.8 163.2 240C162.8 235 163 226.8 163.6 222.4C163.8 220.8 164 220 164.6 219.4Z",
    ink: "context",
    fill: "void",
  },
  {
    d: "M162.4 204.2C165.6 202.6 171 202.8 174 205.6C176.4 208 175.8 212.4 174 216C171.8 220.4 169 225.8 166.8 228.2C164.8 230 162.2 229.2 161.6 226.4C160.8 221.6 160.8 212 161.4 207.4C161.6 205.8 161.8 204.8 162.4 204.2Z",
    ink: "context",
    fill: "void",
  },
  {
    d: "M162.6 181.2C166.5 179.6 172.6 179.8 176.4 183C179.6 185.8 179.2 190.6 177 194.6C174.4 199.4 170.6 205 167.6 207.6C165.4 209.4 162.6 208.4 162 205.4C161.2 200.6 161.4 191 161.8 185.4C161.9 183.4 162 182 162.6 181.2Z",
    ink: "context",
    fill: "void",
  },
];

function heldPhone(): Mark[] {
  return [...HAND_BEHIND, ...heroPhone(HELD), ...HAND_FRONT];
}

// Steps 1 and 2 · The plan. The room seen from above (back): walls with their
// thickness, fading toward the near wall (no hard bottom edge, as in the
// other steps), the doorway a gap in it, a shelf along the right wall and a
// table in the far left corner. The player stands on the spot in the middle
// (a context ring) and holds the phone out a little, its view a lit wedge out
// to the walls. Views are about the ultra-wide's (92 degrees, drawn 90), so
// two photos a turn apart (72) share about a fifth; every view's rays are
// context and fade before the walls.
const ROOM = { left: 52, top: 18, right: 180, bottom: 246 };
const WALL = 5;
const DOOR_GAP = { left: 62, right: 94 };
const HALF_VIEW = 45;
/** The middle of the room, where the player stands. */
const MIDDLE: Point = [(ROOM.left + ROOM.right) / 2, (ROOM.top + ROOM.bottom) / 2];
/** How far out from the middle the phone is held (to its centre). */
const ARM = 32;
/** One turn: the ultra-wide's 72, 5 photos all the way round (src/capture/turn.ts). */
const TURN = 72;
/** The ultra-wide's stops all the way round: photo 1 at the top, a turn apart. */
const STOPS = [0, 1, 2, 3, 4].map((i) => i * TURN);

/** Distance from `from` along `deg` to the room's inner wall. */
function toWall(from: Point, deg: number): number {
  const probe = polar([0, 0], deg, 1);
  const hits = [
    probe[0] > 0 ? (ROOM.right - from[0]) / probe[0] : probe[0] < 0 ? (ROOM.left - from[0]) / probe[0] : Infinity,
    probe[1] > 0 ? (ROOM.bottom - from[1]) / probe[1] : probe[1] < 0 ? (ROOM.top - from[1]) / probe[1] : Infinity,
  ];
  return Math.min(...hits);
}

/** The bearing of `to` from `from`, clockwise from straight up, in [0, 360). */
function bearing(from: Point, to: Point): number {
  const deg = (Math.atan2(to[0] - from[0], from[1] - to[1]) * 180) / Math.PI;
  return (deg + 360) % 360;
}

interface PlanShot {
  centre: Point;
  deg: number;
}

/** The phone held out from the middle, facing `deg`. */
const facing = (deg: number): PlanShot => ({ centre: polar(MIDDLE, deg, ARM), deg });

/** The middle of a plan phone's far edge, where its view starts. */
const tipOf = (shot: PlanShot) => polar(shot.centre, shot.deg, PLAN.height / 2);

function rays(shot: PlanShot, ink: Mark["ink"]): Mark[] {
  const tip = tipOf(shot);
  return [shot.deg - HALF_VIEW, shot.deg + HALF_VIEW].map((deg) => ({ d: polyline([tip, polar(tip, deg, toWall(tip, deg))]), ink, fade: "end" }));
}

/** The lit view: from the tip out to the walls, room corners included. */
function beam(shot: PlanShot): Mark {
  const tip = tipOf(shot);
  const from = shot.deg - HALF_VIEW;
  const within = (deg: number) => ((deg - from + 360) % 360) < HALF_VIEW * 2;
  const corners: Point[] = [
    [ROOM.left, ROOM.top],
    [ROOM.right, ROOM.top],
    [ROOM.right, ROOM.bottom],
    [ROOM.left, ROOM.bottom],
  ];
  const inside = corners
    .filter((c) => within(bearing(tip, c)))
    .sort((p, q) => ((bearing(tip, p) - from + 360) % 360) - ((bearing(tip, q) - from + 360) % 360));
  const edge = (deg: number) => polar(tip, deg, toWall(tip, deg));
  return { d: polyline([tip, edge(from), ...inside, edge(shot.deg + HALF_VIEW)], true), fill: "device", fillAngle: shot.deg };
}

function planPhone(shot: PlanShot, ink: Mark["ink"]): Mark {
  return { d: turnedRect(shot.centre, PLAN.width, PLAN.height, PLAN.radius, shot.deg), ink, fill: "device", fillAngle: shot.deg + 180 };
}

/** The room: walls with the doorway as a gap in the near wall, the shelf and the table. */
const ROOM_MARKS: Mark[] = [
  {
    d: `M${DOOR_GAP.left} ${ROOM.bottom + WALL}H${ROOM.left - WALL}V${ROOM.top - WALL}H${ROOM.right + WALL}V${ROOM.bottom + WALL}H${DOOR_GAP.right}`,
    ink: "back",
    fade: "down",
  },
  { d: `M${DOOR_GAP.left} ${ROOM.bottom}H${ROOM.left}V${ROOM.top}H${ROOM.right}V${ROOM.bottom}H${DOOR_GAP.right}`, ink: "back", fade: "down" },
  { d: `M${DOOR_GAP.left} ${ROOM.bottom}V${ROOM.bottom + WALL}M${DOOR_GAP.right} ${ROOM.bottom}V${ROOM.bottom + WALL}`, ink: "back", fade: "down" },
  // The shelf on the right wall, its books end on.
  { d: roundedRect({ x: 166, y: 158, width: 14, height: 76 }, 1.5), ink: "back", fill: "tag" },
  { d: "M169 166H177M169 173H176M169 180H177M169 190H175M169 197H177M169 207H176M169 214H177M169 224H175", ink: "ridge" },
  // The table in the far left corner, with a lamp's round shade on it.
  { d: roundedRect({ x: 52, y: 18, width: 30, height: 22 }, 1.5), ink: "back", fill: "tag" },
  { d: circle([62, 28], 4.5), ink: "ridge" },
];

/** The spot in the middle where the player stands. */
const SPOT: Mark = { d: circle(MIDDLE, 9), ink: "context" };

/** A clockwise arrow behind the player, turning right: from bearing 130 to 230 with its head at the end. */
function turnArrow(): Mark[] {
  const r = 15;
  const end = 230;
  const tip = polar(MIDDLE, end, r);
  // The head's two barbs, back along the arc's direction at the tip (bearing end + 90).
  const back = end + 90 + 180;
  return [
    { d: arc(MIDDLE, r, 130, end), ink: "context" },
    { d: polyline([polar(tip, back - 40, 5), tip, polar(tip, back + 40, 5)]), ink: "context" },
  ];
}

// Step 1 · Stand in the middle. The plan, the player on the spot in the
// middle, the phone (hero) facing the far wall, its view lit.
const FIRST = facing(0);
const middle: Scene = {
  marks: [beam(FIRST), ...rays(FIRST, "context"), ...ROOM_MARKS, SPOT, planPhone(FIRST, "hero")],
};

// Step 2 · Turn right, shoot again. The same plan one turn later: the first
// photo's view still in place (its rays, back), the phone turned right by one
// turn (hero, its view lit) so the two views share about a fifth, and an arrow round
// the spot turning clockwise.
const SECOND = facing(TURN);
const turn: Scene = {
  marks: [
    beam(SECOND),
    ...rays(FIRST, "back"),
    ...rays(SECOND, "context"),
    ...ROOM_MARKS,
    SPOT,
    ...turnArrow(),
    planPhone(SECOND, "hero"),
  ],
};

// Step 3 · All the way round. The phone held in front shows the camera's turn
// dial on its screen: a ring with a stop for each photo (the ultra-wide's
// five), four taken (lit dots), the next a dark ring, the turn toward it an
// arc. Behind the phone a large clockwise arrow (back) goes round with the
// same stops on it, its head arriving back at the start.
const ROUND: Point = [130, 112];
const ROUND_R = 76;
const DIAL: Point = [130, 172];
const DIAL_R = 13;

function roundArrow(): Mark[] {
  const from = 20;
  const end = 340;
  const tip = polar(ROUND, end, ROUND_R);
  const back = end + 90 + 180;
  return [
    { d: arc(ROUND, ROUND_R, from, end), ink: "back" },
    { d: polyline([polar(tip, back - 35, 8), tip, polar(tip, back + 35, 8)]), ink: "back" },
    // The stops on it (any under the phone are hidden by it).
    ...STOPS.map((deg): Mark => ({ d: circle(polar(ROUND, deg, ROUND_R), 3.5), ink: "back", fill: "tag" })),
  ];
}

function dial(): Mark[] {
  const stop = (deg: number) => polar(DIAL, deg, DIAL_R);
  return [
    { d: circle(DIAL, DIAL_R), ink: "back" },
    // The turn so far, from the fourth stop toward the last.
    { d: arc(DIAL, DIAL_R, STOPS[3], STOPS[3] + 55), ink: "mid" },
    ...STOPS.slice(0, -1).map((deg): Mark => ({ d: circle(stop(deg), 2.6), ink: "mid", fill: "panel" })),
    { d: circle(stop(STOPS[STOPS.length - 1]), 3.2), ink: "mid", fill: "tag" },
    // "Photo 5 of 5" under it, as print.
    { d: "M117 197H143", ink: "textDim" },
  ];
}

const round: Scene = {
  marks: [...roundArrow(), ...HAND_BEHIND, ...heroPhone(HELD), ...dial(), ...HAND_FRONT],
};

// Step 4 · Keep the case private. A bookcase (its silhouette and right side
// mid; the inner frame, shelves and books back) with books on three shelves,
// and behind it to the right a lit lamp (back), tucked behind the case's
// side. An envelope (context) lies outside the shot at the lower left. The
// phone is held in front.
const privacy: Scene = {
  marks: [
    // Lamp: rays, shade (lit) and stem.
    { d: "M130.6 17L128.8 11.4M140 15V8.8M149.4 17L152.2 11.6", ink: "back" },
    { d: "M140 46V106", ink: "back" },
    { d: "M129 24H151L159 46H121Z", ink: "back", fill: "panel" },
    // Case: right side, front, shelves.
    { d: "M118 5L126 10.4V150H118", ink: "mid", fill: "void" },
    { d: roundedRect({ x: 46, y: 4, width: 72, height: 146 }, 2), ink: "mid", fill: "void" },
    { d: "M51 9H113V145H51Z", ink: "back" },
    { d: "M51 52H113M51 56H113M51 98H113M51 102H113", ink: "back" },
    // Top shelf: four books and one leaning.
    { d: roundedRect({ x: 55, y: 22, width: 8, height: 30 }, 1), ink: "back", fill: "tag" },
    { d: roundedRect({ x: 63, y: 17, width: 7, height: 35 }, 1), ink: "back", fill: "panel" },
    { d: roundedRect({ x: 70, y: 24, width: 9, height: 28 }, 1), ink: "back", fill: "tag" },
    { d: "M80 52L92 21.6L98.6 24.2L86.6 52", ink: "back", fill: "void" },
    { d: "M57.5 30H60.5M65.5 26H67.5", ink: "textDim" },
    // Middle shelf: books and a box.
    { d: roundedRect({ x: 55, y: 66, width: 6, height: 32 }, 1), ink: "back", fill: "panel" },
    { d: roundedRect({ x: 61, y: 62, width: 8, height: 36 }, 1), ink: "back", fill: "tag" },
    { d: roundedRect({ x: 69, y: 70, width: 7, height: 28 }, 1), ink: "back", fill: "void" },
    { d: roundedRect({ x: 88, y: 80, width: 21, height: 18 }, 1.5), ink: "back", fill: "tag" },
    // Bottom shelf (the phone hides its right half).
    { d: roundedRect({ x: 55, y: 110, width: 8, height: 35 }, 1), ink: "back", fill: "tag" },
    { d: roundedRect({ x: 63, y: 115, width: 7, height: 30 }, 1), ink: "back", fill: "panel" },
    { d: roundedRect({ x: 70, y: 112, width: 8, height: 33 }, 1), ink: "back", fill: "void" },
    // Envelope.
    { d: roundedRect({ x: 40, y: 200, width: 29, height: 21 }, 2), ink: "context", fill: "void" },
    { d: "M41 201.5L54.5 212L68 201.5", ink: "context" },
    ...heldPhone(),
  ],
};

/** Steps 1 to 4, in order. */
export const SCENES: readonly Scene[] = [middle, turn, round, privacy];
