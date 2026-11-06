// The held items' icons, drawn in the house hand (docs/ART_DIRECTION.md, "made
// by hand"): little die-cut stickers of the things themselves, warm fills of
// brass, wood, paper and wax under the cat's inky line (gone over twice, round
// ends, never a ruler's edge), lit from the upper left like the brass
// magnifier and flashlight. One 48-unit grid, one line weight, one palette, so
// a key beside a torn note beside the UV flashlight reads as one set.
//
// Pure data (no imports): ItemIcons.tsx draws it with react-native-svg, and a
// preview can turn the same shapes into an SVG file.

/** The set's colours: one warm palette for every mode (brass reads as an heirloom against each). */
export const INK = "#26161C";
export const C = {
  ink: INK,
  inkSoft: "#6E4F52",
  brass: "#D9A44C",
  brassLight: "#F6DC94",
  brassDark: "#9A6226",
  wood: "#8C5634",
  woodLight: "#B37A4C",
  woodDark: "#5C341F",
  paper: "#F4E5C8",
  paperShade: "#DDC59C",
  paperLight: "#FFF8EA",
  wax: "#BE3B4B",
  waxDark: "#86232F",
  rose: "#EE9AA6",
  roseDark: "#C9707E",
  blushTape: "#F4A7C0",
  yellowTape: "#F6D776",
  dusk: "#3D3156",
  duskHill: "#69527E",
  moon: "#FFE6AE",
  polaroid: "#FCF7EE",
  gem: "#E2708F",
  gemLight: "#FFC2D2",
  cloth: "#8F2F3E",
  clothDark: "#62202B",
  violet: "#9F7DFF",
  violetLight: "#E1D5FF",
  violetDeep: "#5A3CB4",
  warmLens: "#FFE3A6",
  glass: "#9CC9C1",
  glassDark: "#5F918B",
  spark: "#FFF6DC",
} as const;

/** One drawn mark. `ink`: outlined in the house line (on top of any fill), gone over twice. */
export type Shape = (
  | { t: "path"; d: string }
  | { t: "circle"; cx: number; cy: number; r: number }
  | { t: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { t: "rect"; x: number; y: number; width: number; height: number; rx?: number }
  | { t: "g"; transform?: string; children: Shape[] }
) & {
  fill?: string;
  /** A plain stroke (a highlight, a line of writing), in this colour. */
  stroke?: string;
  /** The stroke's width (the ink line's too; default 1.7). */
  w?: number;
  /** Outlined in ink. */
  ink?: boolean;
  o?: number;
  dash?: string;
  evenodd?: boolean;
};

export const LINE = 1.7;

const path = (d: string, rest: Omit<Shape, "t" | "d"> = {}): Shape => ({ t: "path", d, ...rest }) as Shape;
const g = (transform: string, children: Shape[], o?: number): Shape => ({ t: "g", transform, children, o });
/** A highlight or a line of writing: a soft stroke, round ends. */
const line = (d: string, stroke: string, w = 1.1, o = 1): Shape => path(d, { stroke, w, o });
/** A four-point sparkle (✦) of radius r at (x, y). */
export function sparklePath(x: number, y: number, r: number, waist = 0.16): string {
  const k = r * waist;
  const f = (n: number) => +n.toFixed(2);
  return `M${f(x)} ${f(y - r)} Q${f(x + k)} ${f(y - k)} ${f(x + r)} ${f(y)} Q${f(x + k)} ${f(y + k)} ${f(x)} ${f(y + r)} `
    + `Q${f(x - k)} ${f(y + k)} ${f(x - r)} ${f(y)} Q${f(x - k)} ${f(y - k)} ${f(x)} ${f(y - r)} Z`;
}
const spark = (x: number, y: number, r: number, fill: string = C.spark): Shape => path(sparklePath(x, y, r), { fill });
/** A strip of washi tape, a little see-through, its ends nicked. */
const tape = (x: number, y: number, w: number, h: number, rot: number, fill: string): Shape =>
  g(`rotate(${rot} ${x + w / 2} ${y + h / 2})`, [
    path(`M${x} ${y} L${x + w} ${y + 0.3} L${x + w - 0.8} ${y + h / 2} L${x + w} ${y + h} L${x} ${y + h - 0.3} L${x + 0.8} ${y + h / 2} Z`, { fill, o: 0.88 }),
  ]);

export type IconName =
  | "key" | "note" | "letter" | "tornLeft" | "tornRight" | "taped" | "uvLight" | "uvLightOn" | "torch" | "photo" | "ticket"
  | "map" | "scroll" | "ring" | "book" | "coin" | "matchbook" | "wheel" | "box" | "bottle" | "watch";

// A skeleton key, bow to the lower left, turned on the diagonal.
const key: Shape[] = [
  g("translate(24 24) scale(1.14) translate(-24 -24) rotate(-38 24 24)", [
    // The bit and the shaft, then the bow over them.
    path("M33.2 25.4 L33.2 32.8 L36.2 32.8 L36.2 30 L38.2 30 L38.2 32.8 L41.4 32.8 L41.4 25.4 Z", { fill: C.brass, ink: true }),
    { t: "rect", x: 18.5, y: 21.9, width: 23.4, height: 4.2, rx: 1.5, fill: C.brass, ink: true },
    { t: "rect", x: 18.8, y: 20.6, width: 3.4, height: 6.8, rx: 1.2, fill: C.brassDark, ink: true },
    path("M11.5 15.6 C16.6 15.2 20.2 19.2 19.8 24 C19.6 28.8 16 32.6 11.4 32.3 C6.8 32 3.8 28.4 4 23.8 C4.3 19.2 7.4 15.9 11.5 15.6 Z M11.8 20.6 C9.8 20.5 8.4 22 8.4 24 C8.4 26 9.9 27.4 11.8 27.4 C13.7 27.4 15.2 26 15.2 24 C15.2 22 13.8 20.6 11.8 20.6 Z", { fill: C.brass, ink: true, evenodd: true }),
    line("M6.6 21.4 C7.4 19.2 9.2 17.9 11.4 17.7", C.brassLight, 1.5),
    line("M23.6 23.3 L39.6 23.3", C.brassLight, 1),
    line("M13 30.2 C15.4 29.9 17.4 28.2 18 25.8", C.brassDark, 1, 0.7),
  ]),
];

// A note: a cream slip, a dog-eared corner, three lines of handwriting, a strip of tape.
const note: Shape[] = [
  g("rotate(-5 24 24)", [
    path("M11.6 9.2 L36.6 8.6 L37.6 33.4 L32.6 39.2 L12.4 39.8 Z", { fill: C.paper, ink: true }),
    path("M37.6 33.4 L33.4 33.2 L32.6 39.2 Z", { fill: C.paperShade, ink: true, w: 1.3 }),
    line("M15.6 17.4 C18.4 16.4 20.4 18 23 16.9 C25.4 16 28.2 17.6 32.6 16.6", C.inkSoft, 1.2),
    line("M15.8 23.2 C18.6 22.3 21 23.8 23.6 22.9 C26.2 22.1 28.4 23.4 31.8 22.6", C.inkSoft, 1.2),
    line("M16 29 C18.6 28.3 20.8 29.6 24.2 28.8", C.inkSoft, 1.2),
  ]),
  tape(18, 5.4, 12.5, 5.6, -8, C.blushTape),
];

// A letter: an envelope sealed with a drop of red wax, a star pressed in it.
const letter: Shape[] = [
  g("rotate(-4 24 24)", [
    path("M6.6 13.4 L41.4 12.6 L41.8 35.8 L7.2 36.4 Z", { fill: C.paper, ink: true }),
    path("M7.4 35.9 L19.6 25.4 M41.2 35.4 L28.6 25.2", { stroke: C.inkSoft, w: 1.1 }),
    path("M6.9 13.8 L24 27.4 L41.1 13", { fill: C.paperShade, ink: true, w: 1.5 }),
    path("M24.1 22.2 C27.4 22 29.4 24.4 29.2 27.2 C29 30.2 26.6 32.2 23.8 32 C20.8 31.8 18.8 29.6 19 26.8 C19.2 24.2 21.2 22.3 24.1 22.2 Z", { fill: C.wax, ink: true }),
    path("M24.0 23.5 L24.9 25.9 L27.4 26.0 L25.4 27.6 L26.1 30.0 L24.0 28.6 L21.9 30.0 L22.6 27.6 L20.6 26.0 L23.1 25.9 Z", { fill: C.waxDark }),
    line("M20.6 24.6 C21.2 23.6 22.2 23 23.2 22.9", "#F08B97", 1.1),
  ]),
];

// A torn half: paper with a ragged edge, its torn fibres showing white.
const TEAR = "M31.4 8.4 L29.4 12.4 L32.8 16 L29.8 19.8 L33.4 23.6 L30 27.4 L33 31.2 L30.2 35 L32.2 39.6";
const torn: Shape[] = [
  g("translate(2.4 0) rotate(-6 24 24)", [
    path(`M11 9.2 ${TEAR.replace(/^M/, "L")} L11.6 40 Z`, { fill: C.paper }),
    line(TEAR.replace(/(\d+(\.\d+)?) (\d+(\.\d+)?)/g, (_, x: string, __, y: string) => `${(+x - 1.3).toFixed(1)} ${y}`), C.paperLight, 1.8),
    path(`M11 9.2 ${TEAR.replace(/^M/, "L")} L11.6 40 Z`, { ink: true }),
    line("M14.6 17.6 C17.4 16.6 20 18 23.2 17 C24.8 16.6 26 17 27.4 16.8", C.inkSoft, 1.2),
    line("M14.8 23.6 C17.6 22.6 20 24 23.4 23.2 C25 22.8 26.4 23.2 28 23", C.inkSoft, 1.2),
    line("M15 29.6 C17.8 28.8 20.2 30 23.6 29.2 C24.8 29 25.8 29.2 26.8 29", C.inkSoft, 1.2),
  ]),
];

// The torn halves taped back together: the whole page, the tear down its middle, two strips of washi across it.
const taped: Shape[] = [
  g("rotate(4 24 24)", [
    path("M9.6 8.8 L38.4 8.2 L39 39.6 L10.2 40.2 Z", { fill: C.paper, ink: true }),
    line("M24.2 8.5 L22.6 12.6 L25.6 16.4 L23 20.4 L26 24.2 L22.8 28.2 L25.6 32 L23.4 36 L24.6 40", C.inkSoft, 1.1),
    line("M13.4 16.4 C16 15.6 18 16.8 20.6 16.2 M27.6 16.2 C30 15.4 32.2 16.6 35 16", C.inkSoft, 1.2),
    line("M13.6 23 C16.4 22.2 18.4 23.4 21 22.8 M28.4 22.8 C30.8 22.2 32.6 23.2 35.2 22.6", C.inkSoft, 1.2),
    line("M13.8 33.4 C16.2 32.8 18.4 33.8 20.8 33.2 M28 33.2 C30.6 32.4 32.4 33.6 34.4 33", C.inkSoft, 1.2),
  ]),
  tape(17.4, 10.6, 13.6, 6, -14, C.blushTape),
  tape(17.6, 26.2, 13.6, 6, 10, C.yellowTape),
];

// A flashlight: a brass head round its lens, a knurled collar, a dark wood barrel, a brass cap; pointing up and right.
function flashlight(lens: string, lensLight: string, on: boolean): Shape[] {
  const body: Shape[] = [
    // Drawn pointing up, the lens's centre at (0, 0), the body down the +y axis.
    { t: "rect", x: -4.6, y: 24.4, width: 9.2, height: 3.8, rx: 1.4, fill: C.brass, ink: true },
    { t: "rect", x: -4.1, y: 10.6, width: 8.2, height: 14.4, rx: 1, fill: C.wood, ink: true },
    line("M-1.6 12.6 L-1.6 23 M1.8 13.6 L1.8 22", C.woodDark, 0.8, 0.8),
    line("M-2.9 12 L-2.9 23.6", C.woodLight, 1, 0.9),
    { t: "rect", x: -1.3, y: 14.4, width: 2.6, height: 3.6, rx: 1, fill: C.brass, ink: true, w: 1.2 },
    { t: "rect", x: -4.9, y: 7.8, width: 9.8, height: 3.2, rx: 0.8, fill: C.brassDark, ink: true },
    path("M-7.4 0 L7.4 0 L4.6 8 L-4.6 8 Z", { fill: C.brass, ink: true }),
    line("M-5.4 1.6 L-3.6 6.8", C.brassLight, 1.3),
    { t: "ellipse", cx: 0, cy: 0, rx: 7.4, ry: 2.5, fill: lens, ink: true },
    line("M-4.4 -0.6 C-2.8 -1.5 -0.8 -1.7 1 -1.5", lensLight, 1.1),
  ];
  const beam: Shape[] = on
    ? [
        path("M-7.4 0 L-12.4 -11.6 C-6 -14.6 6 -14.6 12.4 -11.6 L7.4 0 Z", { fill: C.violet, o: 0.34 }),
        path("M-4.6 0 L-7.4 -12.6 C-3 -14 3 -14 7.4 -12.6 L4.6 0 Z", { fill: C.violetLight, o: 0.34 }),
        { t: "ellipse", cx: 0, cy: 0, rx: 9.6, ry: 4, fill: C.violetLight, o: 0.35 },
      ]
    : [];
  const sparks: Shape[] = on
    ? [spark(40.6, 7.4, 3.2, C.violetLight), spark(32.4, 3.6, 2, C.violetLight), spark(44.4, 15.4, 1.8, C.violetLight)]
    : [];
  return [g("translate(30.6 17.4) rotate(45) scale(1.16)", [...beam, ...body]), ...sparks];
}

// A polaroid: a moonlit hill in a white frame, taped at the top.
const photo: Shape[] = [
  g("rotate(5 24 24)", [
    { t: "rect", x: 10.4, y: 7.6, width: 27.2, height: 32.6, rx: 1.2, fill: C.polaroid, ink: true },
    { t: "rect", x: 13.4, y: 10.6, width: 21.2, height: 20, fill: C.dusk },
    { t: "circle", cx: 29, cy: 15.6, r: 2.7, fill: C.moon },
    path("M13.4 30.6 L13.4 25.6 C16.6 22.6 19.6 23.6 22.6 26.2 C25.8 23.4 29.6 22.4 34.6 25.4 L34.6 30.6 Z", { fill: C.duskHill }),
    spark(18.6, 15, 1.4, C.moon),
    { t: "rect", x: 13.4, y: 10.6, width: 21.2, height: 20, ink: true, w: 1.3 },
    line("M15.4 35.4 C18 34.8 20.4 35.8 23.6 35.2", C.inkSoft, 1.1),
  ]),
  tape(18.6, 4.4, 11, 5.4, -6, C.yellowTape),
];

// A ticket stub: notched sides, a perforated tear, a star on the stub.
const ticket: Shape[] = [
  g("rotate(-14 24 24)", [
    path("M6.6 15.4 L41.4 15.4 L41.4 21 C39.2 21.2 38.4 22.6 38.4 24 C38.4 25.4 39.2 26.8 41.4 27 L41.4 32.6 L6.6 32.6 L6.6 27 C8.8 26.8 9.6 25.4 9.6 24 C9.6 22.6 8.8 21.2 6.6 21 Z", { fill: C.rose, ink: true }),
    { t: "rect", x: 12.6, y: 18.6, width: 16.4, height: 10.8, rx: 1, fill: "none", stroke: C.roseDark, w: 1.1 },
    line("M15.4 22.4 L26.4 22.4 M15.4 25.8 L22.6 25.8", C.paperLight, 1.4),
    path("M32.4 16.6 L32.4 31.4", { stroke: INK, w: 1.3, dash: "1.4 2.2" }),
    path("M36.8 20.6 L37.8 23 L40.2 23.2 L38.3 24.7 L39 27.2 L36.8 25.8 L34.6 27.2 L35.3 24.7 L33.4 23.2 L35.8 23 Z", { fill: C.paperLight }),
  ]),
];

// A map: a folded chart, three panels, a dashed red path to an X.
const map: Shape[] = [
  path("M7.4 13 L18 9.6 L30 13 L40.6 9.6 L40.6 35.4 L30 38.8 L18 35.4 L7.4 38.8 Z", { fill: C.paper }),
  path("M18 9.6 L30 13 L30 38.8 L18 35.4 Z", { fill: C.paperShade }),
  path("M12 32.6 C14.6 28.4 18.6 31 21 26.6 C23.4 22.2 27.4 24.2 30 20.4 C31.4 18.4 32.6 17.6 33.6 17.4", { stroke: C.wax, w: 1.5, dash: "2.2 2.2" }),
  path("M33.4 14.4 L38 19 M38 14.4 L33.4 19", { stroke: C.wax, w: 2 }),
  path("M7.4 13 L18 9.6 L30 13 L40.6 9.6 L40.6 35.4 L30 38.8 L18 35.4 L7.4 38.8 Z M18 9.6 L18 35.4 M30 13 L30 38.8", { ink: true }),
  line("M10.4 19 C12 18.2 13.6 18.6 15 18", C.inkSoft, 1),
];

// A scroll: parchment, rolled at both ends, tied with a red ribbon.
const scroll: Shape[] = [
  g("rotate(-10 24 24)", [
    { t: "rect", x: 12.6, y: 12, width: 22.8, height: 24, fill: C.paper, ink: true },
    line("M16.4 18.4 C19 17.6 21.6 18.8 24.4 18 C26.8 17.4 29 18.4 31.6 17.8", C.inkSoft, 1.1),
    line("M16.4 23.4 C19 22.6 21.4 23.8 24.4 23 C27 22.4 29 23.4 31.4 22.8", C.inkSoft, 1.1),
    line("M16.4 28.4 C19 27.8 21.2 28.8 24 28.2", C.inkSoft, 1.1),
    { t: "rect", x: 10.4, y: 7.6, width: 27.2, height: 5.6, rx: 2.8, fill: C.paperShade, ink: true },
    { t: "rect", x: 10.4, y: 34.8, width: 27.2, height: 5.6, rx: 2.8, fill: C.paperShade, ink: true },
    line("M13.2 9.4 L34.4 9.4 M13.2 36.6 L34.4 36.6", C.paperLight, 1.1),
    path("M22 31.6 L26 31.6 L27.4 41.6 L24 39.6 L20.6 41.6 Z", { fill: C.wax, ink: true, w: 1.3 }),
  ]),
];

// A ring: a gold band seen at a slant, a rose stone in its setting, a sparkle.
const ring: Shape[] = [
  path("M24 19.8 C31.4 19.8 36.2 24.4 36.2 30.2 C36.2 36 31 40.4 24 40.4 C17 40.4 11.8 36 11.8 30.2 C11.8 24.4 16.6 19.8 24 19.8 Z M24 24.6 C19.2 24.6 16.2 27.2 16.2 30.4 C16.2 33.6 19.4 36 24 36 C28.6 36 31.8 33.6 31.8 30.4 C31.8 27.2 28.8 24.6 24 24.6 Z", { fill: C.brass, ink: true, evenodd: true }),
  line("M14.6 27.2 C16 24.2 19.4 22.2 23.4 22", C.brassLight, 1.5),
  line("M29.4 37.4 C32 36.4 33.8 34.4 34.2 31.8", C.brassDark, 1.1, 0.8),
  path("M20 21.4 L21.6 18.4 L26.4 18.4 L28 21.4 Z", { fill: C.brassDark, ink: true, w: 1.3 }),
  path("M17.8 13.6 L20.6 9.4 L27.4 9.4 L30.2 13.6 L24 20.6 Z", { fill: C.gem, ink: true }),
  path("M17.8 13.6 L30.2 13.6 M21.8 13.6 L24 20.6 L26.2 13.6 M20.6 9.4 L21.8 13.6 L24 9.4 L26.2 13.6 L27.4 9.4", { stroke: INK, w: 0.9, o: 0.7 }),
  path("M21 12.6 L22.4 10.2 L23.6 12.6 Z", { fill: C.gemLight }),
  spark(35.4, 11.6, 3.4),
  spark(11.8, 17.4, 1.8),
];

// A book: oxblood cloth, a gold-foil title frame, the pages' edge, a bookmark ribbon.
const book: Shape[] = [
  g("rotate(-6 24 24)", [
    path("M35.4 9.8 L38.6 11 L38.6 40.6 L35.4 39.8 Z", { fill: C.paper, ink: true, w: 1.3 }),
    path("M37 12.4 L37 38.8", { stroke: C.paperShade, w: 0.9 }),
    path("M29.2 39.2 L29.2 45 L31.2 43.2 L33.2 45 L33.2 39.2 Z", { fill: C.blushTape, ink: true, w: 1.3 }),
    { t: "rect", x: 11.2, y: 8.2, width: 24.6, height: 32.2, rx: 2, fill: C.cloth, ink: true },
    { t: "rect", x: 11.2, y: 8.2, width: 4.4, height: 32.2, rx: 1.6, fill: C.clothDark, ink: true, w: 1.3 },
    { t: "rect", x: 19.2, y: 14.2, width: 12.4, height: 7.6, rx: 1, fill: "none", stroke: C.brass, w: 1.2 },
    line("M21.6 17 L29.2 17 M22.6 19.2 L28.2 19.2", C.brassLight, 1),
    path("M25.4 27 L26.2 28.8 L28 29 L26.6 30.2 L27.1 32 L25.4 31 L23.7 32 L24.2 30.2 L22.8 29 L24.6 28.8 Z", { fill: C.brass }),
    line("M18 10.6 L18 38", "#B24A58", 1, 0.8),
  ]),
];

// A coin: a gold piece with a raised rim and a star struck in it, its edge showing below.
const coin: Shape[] = [
  { t: "circle", cx: 24.6, cy: 25.8, r: 14, fill: C.brassDark, ink: true },
  { t: "circle", cx: 24, cy: 24, r: 14, fill: C.brass, ink: true },
  { t: "circle", cx: 24, cy: 24, r: 10.4, fill: "none", stroke: C.brassDark, w: 1.1 },
  path("M24 16.4 L25.9 21.4 L31.2 21.6 L27 24.8 L28.6 30 L24 27 L19.4 30 L21 24.8 L16.8 21.6 L22.1 21.4 Z", { fill: C.brassLight, ink: true, w: 1.2 }),
  line("M13.4 19.6 C14.8 15.8 18.2 13 22.4 12.4", C.brassLight, 1.5),
  spark(36.6, 12.4, 3),
];

// A matchbook: open, four matches standing up behind the red cover, a striker strip.
const matchbook: Shape[] = [
  g("rotate(-6 24 24)", [
    { t: "rect", x: 11, y: 8.6, width: 26, height: 14, rx: 1.4, fill: C.waxDark, ink: true },
    ...[0, 1, 2, 3].flatMap((i): Shape[] => [
      { t: "rect", x: 14.2 + i * 5.4, y: 12.4, width: 2.6, height: 12, rx: 0.8, fill: C.paper, ink: true, w: 1.1 },
      { t: "ellipse", cx: 15.5 + i * 5.4, cy: 12.2, rx: 2.2, ry: 2.6, fill: C.wax, ink: true, w: 1.2 },
    ]),
    { t: "rect", x: 9.6, y: 21, width: 28.8, height: 19.4, rx: 2, fill: C.wax, ink: true },
    { t: "rect", x: 9.6, y: 34.6, width: 28.8, height: 5.8, rx: 1.4, fill: "#4E2E2C", ink: true, w: 1.3 },
    line("M12.6 37.4 L13.4 37.6 M16.4 36.8 L17 37.2 M20.6 37.8 L21.2 37.4 M25 36.9 L25.6 37.3 M29.4 37.8 L30 37.4 M33.6 37 L34.2 37.4", "#8A6258", 1),
    { t: "circle", cx: 24, cy: 27.8, r: 4.4, fill: C.paper, ink: true, w: 1.3 },
    path("M24 24.8 C25.8 26.6 26.2 28 25.6 29.2 C25.2 30.2 24.6 30.6 24 30.6 C23.2 30.6 22.6 30.2 22.4 29.4 C22.2 28.4 22.8 27.6 23.4 27.2 C23.4 28 23.8 28.4 24.2 28.4 C24.6 27.4 24.4 26 24 24.8 Z", { fill: "#E8963E" }),
  ]),
];

// A cipher wheel: a brass disc ticked round with letters, a turning paper disc inside it, a red pointer.
const wheelTicks = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const f = (n: number) => n.toFixed(2);
  return `M${f(24 + Math.cos(a) * 12.6)} ${f(25 + Math.sin(a) * 12.6)} L${f(24 + Math.cos(a) * 15.2)} ${f(25 + Math.sin(a) * 15.2)}`;
}).join(" ");
const innerTicks = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2 + 0.26;
  const f = (n: number) => n.toFixed(2);
  return `M${f(24 + Math.cos(a) * 6.4)} ${f(25 + Math.sin(a) * 6.4)} L${f(24 + Math.cos(a) * 8.4)} ${f(25 + Math.sin(a) * 8.4)}`;
}).join(" ");
const wheel: Shape[] = [
  { t: "circle", cx: 24, cy: 25, r: 16.6, fill: C.brass, ink: true },
  path(wheelTicks, { stroke: C.brassDark, w: 1.2 }),
  line("M10.6 19.4 C12.6 14.6 16.8 11 22.2 10", C.brassLight, 1.5),
  { t: "circle", cx: 24, cy: 25, r: 10.6, fill: C.paper, ink: true },
  path(innerTicks, { stroke: C.inkSoft, w: 1.1 }),
  { t: "circle", cx: 24, cy: 25, r: 2.4, fill: C.brassDark, ink: true, w: 1.3 },
  path("M24 9.6 L27.4 3.6 L20.6 3.6 Z", { fill: C.wax, ink: true, w: 1.4 }),
];

// A small wooden box with a brass clasp: whatever it is, it's kept safe.
const box: Shape[] = [
  path("M8.6 21.4 L33 21.4 L33 39.6 L8.6 39.6 Z", { fill: C.wood, ink: true }),
  path("M33 21.4 L40 16.4 L40 34.4 L33 39.6 Z", { fill: C.woodDark, ink: true }),
  path("M8.6 21.4 L15.6 16.4 L40 16.4 L33 21.4 Z", { fill: C.woodLight, ink: true }),
  line("M11.4 26.2 L22.6 26.2 M12.6 32.4 L19.6 32.4 M24.4 34.6 L30.4 34.6", C.woodDark, 0.9, 0.9),
  line("M18.6 18.6 L33.4 18.6", "#D6A273", 1),
  { t: "rect", x: 18.2, y: 20, width: 5.2, height: 6.6, rx: 1, fill: C.brass, ink: true, w: 1.3 },
  { t: "circle", cx: 20.8, cy: 23.8, r: 0.9, fill: C.ink },
  path("M8.6 36.4 L12 36.4 L12 39.6 M33 36.4 L29.6 36.4 L29.6 39.6", { stroke: C.brass, w: 1.6 }),
];

// An apothecary bottle: green glass, a cork, a paper label.
const bottle: Shape[] = [
  g("rotate(8 24 24)", [
    { t: "rect", x: 20.2, y: 5.8, width: 7.6, height: 5.6, rx: 1.2, fill: C.woodLight, ink: true, w: 1.4 },
    path("M21 11.2 L27 11.2 L27 16 C33 17.6 35.4 21.6 35.4 27 L35.4 37.4 C35.4 39.6 34 40.8 31.8 40.8 L16.2 40.8 C14 40.8 12.6 39.6 12.6 37.4 L12.6 27 C12.6 21.6 15 17.6 21 16 Z", { fill: C.glass, ink: true }),
    path("M15.6 26.6 C15.8 22.4 17.8 19.8 21.2 18.6", { stroke: "#D8F0EA", w: 1.6 }),
    path("M31.6 36.6 L31.6 28", { stroke: C.glassDark, w: 1.2 }),
    { t: "rect", x: 16.2, y: 25.8, width: 15.6, height: 9.4, rx: 1, fill: C.paper, ink: true, w: 1.3 },
    line("M18.8 29.4 C21 28.8 23.4 29.8 25.8 29.2 M19.2 32 C21.4 31.6 23 32.2 24.6 31.8", C.inkSoft, 1),
  ]),
];

// A pocket watch: a brass case on its bow, a cream face, hands at ten to two.
const watchTicks = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * Math.PI * 2;
  const f = (n: number) => n.toFixed(2);
  const r0 = i % 3 === 0 ? 7.2 : 8;
  return `M${f(24 + Math.cos(a) * r0)} ${f(27 + Math.sin(a) * r0)} L${f(24 + Math.cos(a) * 9.2)} ${f(27 + Math.sin(a) * 9.2)}`;
}).join(" ");
const watch: Shape[] = [
  path("M24 3.6 C26.4 3.6 28 5.2 28 7.4 C28 9.4 26.4 10.8 24 10.8 C21.6 10.8 20 9.4 20 7.4 C20 5.2 21.6 3.6 24 3.6 Z M24 5.6 C22.8 5.6 22 6.4 22 7.4 C22 8.4 22.8 9 24 9 C25.2 9 26 8.4 26 7.4 C26 6.4 25.2 5.6 24 5.6 Z", { fill: C.brass, ink: true, evenodd: true }),
  { t: "rect", x: 21.6, y: 9.8, width: 4.8, height: 4, rx: 1, fill: C.brassDark, ink: true, w: 1.3 },
  { t: "circle", cx: 24, cy: 27, r: 14.2, fill: C.brass, ink: true },
  line("M12.2 22.6 C13.8 18 17.6 14.6 22.4 13.6", C.brassLight, 1.5),
  { t: "circle", cx: 24, cy: 27, r: 10.6, fill: C.paper, ink: true, w: 1.4 },
  path(watchTicks, { stroke: C.inkSoft, w: 1 }),
  path("M24 27 L19.8 23.4 M24 27 L28.6 21", { stroke: INK, w: 1.6 }),
  { t: "circle", cx: 24, cy: 27, r: 1.3, fill: C.wax },
];

export const ART: Record<IconName, Shape[]> = {
  key, note, letter, taped, photo, ticket, map, scroll, ring, book, coin, matchbook, wheel, box, bottle, watch,
  tornLeft: torn,
  // The other half: the same page mirrored, so the two halves in the tray look as if they'd fit.
  tornRight: [g("translate(48 0) scale(-1 1)", torn)],
  uvLight: [...flashlight(C.violet, C.violetLight, false), spark(41.4, 7.6, 2.4, C.violetLight)],
  uvLightOn: flashlight(C.violetLight, "#FFFFFF", true),
  torch: flashlight(C.warmLens, "#FFFFFF", false),
};
