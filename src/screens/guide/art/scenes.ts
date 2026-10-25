// The four guide scenes (docs/DESIGN.md 04, Steps), drawn as warm line art in
// the art box's own units (ref.layout.guide.art, 240 x 266, centre 120, 133).
// The numbers in the path data are the drawings themselves; the measured parts
// of the spec (stroke, tones, fade length, phone, inner screen, brackets,
// plan-phone size, radius, ink limit) come from tokens through geometry.ts,
// draw.ts and StepArt. Every scene's ink stays within ref.layout.guide.art.inkMax.
import { ref } from "@/theme/tokens";
import { circle, planPhoneTip, polar, roundedRect, segment } from "./geometry";
import type { Mark, Point, Scene } from "./types";

const PLAN = ref.layout.guide.planPhone;

// Step 1 · Start at the doorway. A doorway frame (mid) with a room corner
// beyond it (back). A hand (context, fading toward the wrist) holds the hero
// phone in front; the screen redraws the corner between the brackets.
const doorway: Scene = {
  behind: [
    { d: "M46 212V8H150V212", tone: "mid" },
    { d: "M54 212V16H142V212", tone: "mid" },
    { d: "M46 212H54M142 212H150", tone: "mid" },
    // The corner: the wall junction, and the floor line along both walls.
    { d: "M88 16V142", tone: "back" },
    { d: "M54 164L88 142L142 166", tone: "back" },
    // The hand, behind the phone: the palm's edge, the fingertips round the
    // right edge, and the wrist, which fades out at the bottom.
    { d: "M112 168C102 172 98 188 100 206C101 224 98 244 95 264", tone: "context", fade: true },
    { d: "M182 166C189 165 193 169 193 174C193 179 189 183 182 182", tone: "context" },
    { d: "M182 186C190 185 194 189 194 195C194 200 190 204 182 203", tone: "context" },
    { d: "M182 207C189 206 193 210 193 215C193 220 189 224 182 223", tone: "context" },
    { d: "M182 227C187 226 190 229 190 233C190 237 187 240 182 239", tone: "context" },
    { d: "M176 253C177 257 179 261 180 264", tone: "context", fade: true },
  ],
  phone: {
    x: 112,
    y: 116,
    screen: [
      { d: "M147 130V190", tone: "back" },
      { d: "M121 208L147 190L173 204", tone: "back" },
    ],
  },
};

// Step 2 · Work around the room. A plan of the room (back) with three phone
// plan symbols: at the doorway (plate I, taken), at the far corner (plate II,
// current: phone and wedge in hero) and at the busiest wall (plate III). The
// mid phones' wedges are context, fading over their last 40. The doorway and
// far-corner wedges overlap.
const ROOM = { left: 40, top: 26, right: 200, bottom: 238 };
// Half the view wedge's angle, in degrees.
const HALF_VIEW = 28;

/** Distance from `from` along `deg` to the room's outline. */
function toWall(from: Point, deg: number): number {
  const probe = polar([0, 0], deg, 1);
  const hits = [
    probe[0] > 0 ? (ROOM.right - from[0]) / probe[0] : probe[0] < 0 ? (ROOM.left - from[0]) / probe[0] : Infinity,
    probe[1] > 0 ? (ROOM.bottom - from[1]) / probe[1] : probe[1] < 0 ? (ROOM.top - from[1]) / probe[1] : Infinity,
  ];
  return Math.min(...hits);
}

function planPhone(centre: Point, deg: number, tone: Mark["tone"]): Mark {
  return { d: roundedRect(centre, PLAN.width, PLAN.height, deg), tone, fill: "surface" };
}

/** The two rays of a view wedge, from the phone's far edge to the walls. */
function wedge(centre: Point, deg: number, tone: Mark["tone"]): Mark[] {
  const tip = planPhoneTip(centre, deg);
  return [deg - HALF_VIEW, deg + HALF_VIEW].map((rayDeg) => {
    const end = polar(tip, rayDeg, toWall(tip, rayDeg));
    return { d: segment(tip, end), tone, fade: tone === "context" };
  });
}

const DOOR_PHONE: Point = [78, 220];
const DOOR_DEG = 34;
const CORNER_PHONE: Point = [134, 128];
const CORNER_DEG = 33;
const WALL_PHONE: Point = [160, 180];
const WALL_DEG = -90;

const plan: Scene = {
  behind: [
    // The outline, with the doorway as a gap in the near wall.
    { d: `M60 ${ROOM.bottom}H${ROOM.left}V${ROOM.top}H${ROOM.right}V${ROOM.bottom}H96`, tone: "back" },
    ...wedge(DOOR_PHONE, DOOR_DEG, "context"),
    ...wedge(WALL_PHONE, WALL_DEG, "context"),
    ...wedge(CORNER_PHONE, CORNER_DEG, "hero"),
    planPhone(DOOR_PHONE, DOOR_DEG, "mid"),
    planPhone(WALL_PHONE, WALL_DEG, "mid"),
    planPhone(CORNER_PHONE, CORNER_DEG, "hero"),
  ],
};

// Step 3 · Get one close view. Top-down onto a desktop corner (mid, its two
// edges fading). An open notebook and a key lie under the hero phone (back),
// the notebook's outer pages showing either side. The screen shows the key
// and the page between the brackets, 4 in from their lines and clear of their
// arms, so the four L-shapes stay separate. No hand.
const desk: Scene = {
  behind: [
    { d: "M50 222H206", tone: "mid", fade: true },
    { d: "M38 210V30", tone: "mid", fade: true },
    { d: "M38 210C38 217 43 222 50 222", tone: "mid" },
    { d: "M122 92C104 88 76 88 58 92V176C76 172 104 172 122 176", tone: "back" },
    { d: "M122 92C140 88 168 88 186 92V176C168 172 140 172 122 176", tone: "back" },
    { d: "M122 92V176", tone: "back" },
    { d: "M64 108H80M64 118H82M64 128H78M64 138H82M64 148H76", tone: "back" },
    { d: "M164 108H180M164 118H178M164 128H180M164 138H174", tone: "back" },
    { d: circle([166, 156], 6), tone: "back" },
    { d: "M160 154L128 142", tone: "back" },
  ],
  phone: {
    x: 87,
    y: 64,
    screen: [
      { d: "M108 106H136M108 115H133M108 124H136M108 133H130", tone: "back" },
      { d: circle([130, 153], 6), tone: "back" },
      { d: "M124 150L108 142M112 144L110 148M117 146.5L115 150.5", tone: "back" },
    ],
  },
};

// Step 4 · Keep the case private. The hero phone frames a bookshelf and a lit
// lamp (mid, three ray ticks fanning up from the shade's top edge, clear of
// the stem); its screen redraws them. An envelope and an open laptop with
// three lit screen lines sit below, outside the brackets (back, no fade).
const privacy: Scene = {
  behind: [
    // Bookshelf: case, two shelves, books.
    { d: "M40 150V22H106V150Z", tone: "mid" },
    { d: "M40 64H106M40 108H106", tone: "mid" },
    { d: "M48 64V36H54V64M58 64V40H63V64M67 64V34H73V64", tone: "mid" },
    { d: "M48 108V82H54V108M58 108V78H64V108M70 108L78 84L84 86L76 108", tone: "mid" },
    // Lamp: shade, stem, base and three ray ticks.
    { d: "M166 36H190L197 60H159Z", tone: "mid" },
    { d: "M178 60V142M166 142H190", tone: "mid" },
    { d: "M163 30L159 24M178 29V21M193 30L197 24", tone: "mid" },
    // Envelope and laptop, below the frame.
    { d: "M44 196H92V228H44ZM44 196L68 214L92 196", tone: "back" },
    { d: "M124 190H190V226H124Z", tone: "back" },
    { d: "M134 202H154M134 210H162M134 218H150", tone: "back" },
    { d: "M116 226H198L192 236H122Z", tone: "back" },
  ],
  phone: {
    x: 82,
    y: 30,
    screen: [
      { d: "M102 118V70H118V118ZM102 94H118", tone: "mid" },
      { d: "M105.5 94V79M109 94V76M112.5 94V80M105.5 118V103M109 118V100M112.5 118V105", tone: "mid" },
      // Lamp: shade, stem and base, then the three ticks fanning up from the
      // shade's top edge, a stroke's width clear of the shade, the shelf and
      // the top-right bracket.
      { d: "M123 76H131L133.5 85H120.5Z", tone: "mid" },
      { d: "M127 85V116M122.5 116H131.5", tone: "mid" },
      { d: "M123.5 72.5L122 69.5M127 72.5V68.5M130.5 72.5L132 69.5", tone: "mid" },
    ],
  },
};

/** Steps 1 to 4, in order. */
export const SCENES: readonly Scene[] = [doorway, plan, desk, privacy];
