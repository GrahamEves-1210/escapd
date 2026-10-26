// The four guide scenes (04, Steps), drawn in the reference's line-art style
// in the art box's own units (ref.layout.guide.art, 240 x 266). The numbers in
// the path data are the drawings themselves; the measured parts (strokes,
// inks, fills, fades, the hero phone and its screen) come from tokens through
// draw.ts. As in the reference, a mid object stands at the upper left with a
// back object behind it to the right, and the hero phone is held in front at
// the lower right; depth comes from brightness alone.
import { ref } from "@/theme/tokens";
import { circle, polar, polyline, roundedRect, turnedRect } from "./geometry";
import type { Mark, Point, Scene } from "./types";

const PHONE = ref.layout.guide.phone;
const PLAN = ref.layout.guide.planPhone;

/** Where the hero phone is held in steps 1, 3 and 4: the reference's place (its top-left corner). */
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

// Step 1 · Start at the doorway. A door casing (mid) seen a little from the
// left: its head and right jamb show their depth (back detail), and the door
// stands open inward, a lit sliver at the left of the opening. Beyond it the
// room's far corner (back): the wall join and the floor along both walls. A
// framed picture hangs on the wall to the right (back), tucked behind the
// casing as the reference's box is behind its bottle. The phone is held in
// front.
const doorway: Scene = {
  marks: [
    // The near wall's foot, behind everything.
    { d: "M48 142H128", ink: "back" },
    { d: roundedRect({ x: 116, y: 26, width: 40, height: 46 }, 2), ink: "back", fill: "void" },
    { d: roundedRect({ x: 122, y: 32, width: 28, height: 34 }, 1.5), fill: "tag" },
    { d: "M129 59L135.5 50.5L140 55.5L143 52.5L147 59", ink: "ridge" },
    // Casing: the front face, then the depth of the head and the right jamb.
    { d: "M48 142V7C48 5.3 49.3 4 51 4H121C122.7 4 124 5.3 124 7V142", ink: "mid", fill: "void" },
    { d: "M58 14H114V142H107V19H58Z", fill: "tag" },
    // The far corner through the opening.
    { d: "M90 19V102", ink: "back" },
    { d: "M58 112L90 102L107 107.4", ink: "back" },
    // The open door, hinged out of sight behind the left jamb.
    { d: "M58 21L72 27V128L58 134Z", ink: "mid", fill: "panel" },
    { d: circle([68.4, 78], 1.8), ink: "back" },
    { d: "M58 19H107V142M107 19L114 14", ink: "back" },
    { d: "M58 142V14H114V142", ink: "back" },
    ...heldPhone(),
  ],
};

// Step 2 · Work around the room. A plan of the room (back): walls with their
// thickness, fading toward the near wall (no hard bottom edge, as in the
// other steps), the doorway a gap in it, and a shelf along the busiest wall
// (right). Three phones seen from above: plate I just inside the doorway and
// plate III aimed at the busiest wall (back), and plate II aimed at the far
// corner (hero, now: its view a lit wedge). Every view's rays are context
// and fade before the walls; plate I's view overlaps both of the others.
const ROOM = { left: 52, top: 18, right: 180, bottom: 246 };
const WALL = 5;
const DOOR_GAP = { left: 62, right: 94 };
const HALF_VIEW = 27;

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

const DOOR: PlanShot = { centre: [70, 224], deg: 25 };
const CORNER: PlanShot = { centre: [100, 150], deg: 31 };
const SHELF: PlanShot = { centre: [108, 196], deg: 90 };

const plan: Scene = {
  marks: [
    beam(CORNER),
    ...rays(DOOR, "context"),
    ...rays(SHELF, "context"),
    ...rays(CORNER, "context"),
    // Walls, with the doorway as a gap in the near wall.
    {
      d: `M${DOOR_GAP.left} ${ROOM.bottom + WALL}H${ROOM.left - WALL}V${ROOM.top - WALL}H${ROOM.right + WALL}V${ROOM.bottom + WALL}H${DOOR_GAP.right}`,
      ink: "back",
      fade: "down",
    },
    { d: `M${DOOR_GAP.left} ${ROOM.bottom}H${ROOM.left}V${ROOM.top}H${ROOM.right}V${ROOM.bottom}H${DOOR_GAP.right}`, ink: "back", fade: "down" },
    { d: `M${DOOR_GAP.left} ${ROOM.bottom}V${ROOM.bottom + WALL}M${DOOR_GAP.right} ${ROOM.bottom}V${ROOM.bottom + WALL}`, ink: "back", fade: "down" },
    // The shelf on the busiest wall, its books end on.
    { d: roundedRect({ x: 166, y: 158, width: 14, height: 76 }, 1.5), ink: "back", fill: "tag" },
    { d: "M169 166H177M169 173H176M169 180H177M169 190H175M169 197H177M169 207H176M169 214H177M169 224H175", ink: "ridge" },
    planPhone(DOOR, "back"),
    planPhone(SHELF, "back"),
    planPhone(CORNER, "hero"),
  ],
};

// Step 3 · Get one close view. Top down onto a desk corner (back, both edges
// fading). An open notebook (mid) lies on it, its right page lit, a heading
// and lines of writing on both pages; a key (back) lies beside it. The phone
// is held flat and close above, at the same place as in steps 1 and 4.
const desk: Scene = {
  marks: [
    // The desk's edges, the near one 11 below the phone.
    { d: "M54 256C46.3 256 40 249.7 40 242V12", ink: "back", fade: "end" },
    { d: "M54 256H198", ink: "back", fade: "end" },
    // Notebook: left page, right page (lit), spine and writing.
    { d: "M48 10C60 7.6 76 8.4 88 13.6V104C76 99.2 60 98.4 48 100.4Z", ink: "mid", fill: "void" },
    { d: "M88 13.6C100 8.4 116 7.6 128 10V100.4C116 98.4 100 99.2 88 104Z", ink: "mid", fill: "panel" },
    { d: "M56 26H80", ink: "text" },
    { d: "M56 35H77M56 43H80M56 51H73M56 67H78M56 75H75", ink: "textDim" },
    { d: "M96 26H120", ink: "text" },
    { d: "M96 35H116M96 43H120M96 51H112", ink: "textDim" },
    // Key: bow, hole, shaft and two teeth.
    { d: circle([164, 32], 9), ink: "back", fill: "tag" },
    { d: circle([164, 32], 2.6), ink: "ridge" },
    { d: "M157.6 38.6L136.6 62.6M161 41.6L140 65.6M136.6 62.6C135.6 63.7 136 65.2 137.5 66.4C138.6 67.3 139.6 66.9 140 65.6", ink: "back" },
    { d: "M144 59.2L148.4 63.1L151.2 59.9M149.8 52.9L153.6 56.2", ink: "back" },
    ...heroPhone(HELD),
  ],
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
export const SCENES: readonly Scene[] = [doorway, plan, desk, privacy];
