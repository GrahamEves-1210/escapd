// ESCAPD design tokens: "The Darkroom Dossier & Brass Mechanism".
// Soot, walnut, and tarnished brass for the instrument. Manila and carbon ink
// for anything the player has to read. Room photos keep their own colour.
import type { TextStyle, ViewStyle } from "react-native";
import type { Genre } from "@/lib/puzzle-types";

export const color = {
  canvas: "#090807",
  surface: "#14110E",
  raised: "#1E1915",
  text: "#F2ECE1",
  textSecondary: "#A89C8A",
  hairline: "rgba(200, 157, 84, 0.32)",
  accent: "#C89D54",
  accentPressed: "#DFB66C",
  error: "#A63429",
  warning: "#D4883A",

  onAccent: "#171411",
  accentMuted: "rgba(200, 157, 84, 0.16)",
  photoScrim: "rgba(9, 8, 7, 0.78)",
  sheetScrim: "rgba(9, 8, 7, 0.55)",
  bracketShadow: "rgba(9, 8, 7, 0.72)",

  manila: "#E8DFC8",
  ink: "#171411",
  verdigris: "#4E7A72",
  wax: "#A63429",
  rim: "rgba(255, 255, 255, 0.10)",
  brassRule: "rgba(200, 157, 84, 0.25)",
  velvet: "#2A1216",
} as const;

export const font = {
  display: "PlayfairDisplay_600SemiBold",
  narrative: "PlayfairDisplay_400Regular",
  narrativeItalic: "PlayfairDisplay_400Regular_Italic",
  body: "PlusJakartaSans_400Regular",
  bodyMedium: "PlusJakartaSans_500Medium",
  bodySemibold: "PlusJakartaSans_600SemiBold",
  bodyBold: "PlusJakartaSans_700Bold",
  wordmark: "PlayfairDisplay_700Bold",
  mono: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_600SemiBold",
} as const;

// Sizes from the plan. Text always honours system scaling; never shrink to fit.
export const type = {
  caseDisplay: { fontFamily: font.display, fontSize: 34, lineHeight: 38 },
  screenTitle: { fontFamily: font.bodySemibold, fontSize: 22, lineHeight: 28 },
  sectionTitle: { fontFamily: font.bodySemibold, fontSize: 18, lineHeight: 23 },
  narrativeTitle: { fontFamily: font.display, fontSize: 24, lineHeight: 30 },
  narrative: { fontFamily: font.narrative, fontSize: 18, lineHeight: 26 },
  body: { fontFamily: font.body, fontSize: 16, lineHeight: 23 },
  control: { fontFamily: font.bodySemibold, fontSize: 15, lineHeight: 20 },
  caption: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 18 },
  stamp: { fontFamily: font.mono, fontSize: 11, lineHeight: 14, letterSpacing: 1.2 },
  slip: { fontFamily: font.mono, fontSize: 15, lineHeight: 22 },
  code: { fontFamily: font.monoBold, fontSize: 28, lineHeight: 34, fontVariant: ["tabular-nums"] },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

// 4 pt base. The photo plate keeps 14 pt of darkroom canvas on either side.
export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  gutter: 20,
  xl: 24,
  xxl: 32,
  plate: 14,
} as const;

// Photographic plates use Apple continuous corners. Mechanical panels use a
// shorter radius so the hardware reads as inlaid, not as another photo.
export const radius = {
  image: 24,
  mount: 30,
  thumb: 14,
  thumbRing: 18,
  sheet: 20,
  control: 8,
  slip: 8,
  round: 999,
} as const;

export const curve = {
  borderCurve: "continuous",
} as const satisfies ViewStyle;

// Every motion communicates feedback or state. Reduced motion swaps movement
// for opacity changes under 150 ms. There are no perpetual animations.
export const motion = {
  sceneCrossfade: 200,
  sceneDrift: 18,
  bracketSettle: 380,
  bracketHold: 1400,
  sheetSpring: { damping: 28, stiffness: 320, mass: 1 },
  itemAcquired: 380,
  wrongShake: { duration: 220, distance: 4 },
  solvedTrace: 600,
  completionPullBack: 700,
  reducedFade: 140,
  toast: 2600,
  loupeMagnification: 2.2,
  loupeSize: 136,
} as const;

export const elevation = {
  flat: { backgroundColor: color.surface },
  raised: { backgroundColor: color.raised, borderColor: color.hairline, borderWidth: 1 },
} as const;

export const z = {
  scene: 0,
  hotspots: 10,
  chrome: 20,
  coach: 25,
  tray: 30,
  toast: 40,
  sheet: 50,
} as const;

export const hit = {
  min: 48,
} as const;

export const tokens = { color, font, type, space, radius, curve, motion, elevation, z, hit };
export type Tokens = typeof tokens;

// The reference look, for the hub, camera, permission, photo guide and Pro
// screens: the four screenshots in docs/refs (Opal 01, Once 02, pushr 03,
// Apple Health 04), measured on a 393 x 852 pt iPhone (safe areas 59 / 34).
// Neutral greys, flat grounds, pills, discs and hairlines; the only brass is
// the focus ring. /play and the light table keep the live theme above.
// Gradient angles are CSS angles (180 = top to bottom, 90 = left to right).

/**
 * One gradient stop: a plain hex colour and its own opacity. react-native-svg
 * takes a stop's alpha from stopOpacity alone and paints an rgba() stop colour
 * solid, so a colour here is never rgba().
 */
export interface GradientStop {
  readonly offset: number;
  readonly color: `#${string}`;
  readonly opacity: number;
}

// Colour roles. Measured hex (tint-corrected where a capture tint showed).
const refColor = {
  // Grounds, darkest first, then the light screen.
  /** Pure black: 01 and 04's ground; the inset wells (empty viewfinder, zoom track, counter pill). */
  void: "#000000",
  /** The camera screen's ground (02); fill of 01's round header chips. */
  ground: "#101010",
  /** Faintest fill above black: the ghost pill. */
  shade: "#0A0A0A",
  /** Near-black rims on 02: the shutter ring and the last-photo frame (measured #070707). */
  well: "#070707",
  /** 02's zoom thumb (measured #1A1A1A to #1B1B1B). */
  thumb: "#1B1B1B",
  /** Raised controls on dark (square buttons); the primary pill on paper; glyphs and quiet labels on paper. */
  raised: "#1E1E1E",
  /** The light permission screen and its sheet (03). */
  paper: "#FFFFFF",
  /** The cool grey illustration panel at the top of 03's sheet. */
  panel: "#F3F5F7",

  // Text on dark.
  /** Titles, header titles, active labels, icons, pill labels, the hero illustration line. */
  textPrimary: "#FFFFFF",
  /** Tag text on 01's game cards (white 82 %). */
  textLabel: "rgba(255, 255, 255, 0.82)",
  /** Subtitles, meta lines and one-line instructions (6.3 to 6.9:1). */
  textSecondary: "#949494",
  /** The same grey as white 60 %, for a glyph over 01's glow (the dismiss X). */
  textSecondaryAlpha: "rgba(255, 255, 255, 0.60)",
  /** Inactive segment label only (2.8:1). */
  textTertiary: "#5A5A5A",
  /** The shot counter's neighbouring numerals (white 24 % on black); decorative only. */
  textDim: "#3F3F3F",

  // Text on paper.
  /** 03's sheet title; the solid outline of 03's illustration. */
  inkDisplay: "#000000",
  /** 03's sheet body (4.7:1 on paper). */
  inkMuted: "#737373",

  // Hairlines, glass and highlights.
  /** White 10 %: 01's divider peak and tag-pill stroke. */
  rim: "rgba(255, 255, 255, 0.10)",
  /** The rim as a solid colour on black: the ghost pill's 1 pt edge (measured #1C1C1C top-left, #181818 bottom-right). */
  hairline: "#1A1A1A",
  /** White 5 %: the 1 pt rim of 02's square buttons and last-photo image. */
  rimFaint: "rgba(255, 255, 255, 0.05)",
  /** White 3.5 %: 01's game-card glass over the floor glow. */
  glassFill: "rgba(255, 255, 255, 0.035)",
  /** Black 13 %: 01's dismiss disc over the floor glow. */
  dismissFill: "rgba(0, 0, 0, 0.13)",
  /** 04's light grey glass dismiss disc on black. */
  glassDisc: "#848484",
  /** White 14 %: the brightest point of the diagonal 1 pt ring on 01's chips. */
  specularDark: "rgba(255, 255, 255, 0.14)",
  /** The glass disc's ring highlight, lower right. */
  specularLight: "#B6B6B6",
  /** The glass disc's ring highlight, upper left. */
  specularLightAlt: "#AAAAAA",
  /** The 1 pt highlight along the top inside edge of 02's shutter disk (peak, leaning top right). */
  bevel: "#3A3A3A",
  /** White 20 %: the halo around 02's shutter (with a negative spread, effect.shutterGlow). */
  shutterGlow: "rgba(255, 255, 255, 0.20)",

  // 01's accent line and floor glow.
  /** Hero line-icon gradient, top left. */
  lineStart: "#CEFEB4",
  /** Hero line-icon gradient, bottom right. */
  lineEnd: "#ADFCF1",
  /** Floor glow, the flat bright area on the left half. */
  glowOlive: "#243425",
  /** Floor glow, the flat bright area on the right half. */
  glowTeal: "#1E342C",

  // Illustration depth on dark (04), brightest first; the hero line is textPrimary.
  /** The object at middle depth. */
  lineMid: "#DDDDDD",
  /** The back object. */
  lineBack: "#7F7F7F",
  /** Hand and inner-screen context lines, fading to black. */
  lineContext: "#555555",

  // 03's light illustration and haze.
  /** The single highlight band on the solid phone outline. */
  illustrationBevel: "#929090",
  /** The centre of the grey haze behind the status bar. */
  ambientCore: "#D4D4D6",

  // Pressed states. The screenshots show none: these are proposals.
  /** The primary pill pressed: raised at the live Button's 82 % over paper. */
  raisedPressed: "#474747",
} as const;

// The non-system faces (loaded in app/_layout.tsx). Every other style is
// the platform system font (SF Pro on iOS, Roboto on Android): no fontFamily,
// a fontWeight. A named face carries its own weight, so it sets no fontWeight.
const refFont = {
  /** Once's header serif (02's title): Roboto Serif Regular. */
  serif: "RobotoSerif_400Regular",
  /** Once's italic numerals (02's shot counter): Crimson Text Italic. */
  italic: "CrimsonText_400Regular_Italic",
  /** pushr's wide grotesk (03's and 05's titles): Archivo ExtraBold, which matches its stroke (4.98 vs 5.05 pt); Black was 18 % heavier. */
  grotesk: "Archivo_800ExtraBold",
  /** DETECTIVE NOIR's name (modeThemes.noir.display): Playfair Display Black. */
  noirDisplay: "PlayfairDisplay_900Black",
  /** CRIME SCENE's name (modeThemes.crime_scene.display): Archivo Black. */
  crimeDisplay: "Archivo_900Black",
  /** PARANORMAL's name (modeThemes.paranormal.display): Crimson Text SemiBold Italic. */
  paranormalDisplay: "CrimsonText_600SemiBold_Italic",
  /** The play screen's typewriter (ref.layout.play.type: notes, evidence tags, the informant): Courier Prime. */
  typewriter: "CourierPrime_400Regular",
  typewriterBold: "CourierPrime_700Bold",
} as const;

const stop = (offset: number, color: `#${string}`, opacity = 1): GradientStop => ({ offset, color, opacity });

export const ref = {
  color: refColor,
  // Static. Linear ones carry a CSS angle; radial ones a centre and radius in pt.
  gradient: {
    // 01's floor glow, drawn over `ground`: nothing down to fadeStart of the
    // screen height, full from fadeEnd to the bottom (flat there). The stops
    // run left to right across the screen. Kit: FloorGlow.
    bottomGlow: {
      ground: refColor.void,
      fadeStart: 0.58,
      fadeEnd: 0.79,
      stops: [
        stop(0, "#141C12"),
        stop(0.25, refColor.glowOlive),
        stop(0.43, refColor.glowOlive),
        stop(0.5, "#213529"),
        stop(0.56, refColor.glowTeal),
        stop(0.69, refColor.glowTeal),
        stop(1, "#111B19"),
      ],
    },
    // 01's game card as it looks over the glow (glassFill on bottomGlow), as an opaque fill.
    card: {
      angle: 180,
      stops: [stop(0, "#0A0A0A"), stop(0.31, "#0F0F0F"), stop(0.5, "#141513"), stop(1, "#283628")],
    },
    // The card's 1 pt rim, fading out down the card. Opal's measures white
    // ≈5 % along the top, 2–2.5 % down the sides to half height, gone by 0.85.
    cardRim: {
      angle: 180,
      stops: [stop(0, "#FFFFFF", 0.05), stop(0.15, "#FFFFFF", 0.025), stop(0.5, "#FFFFFF", 0.02), stop(0.85, "#FFFFFF", 0)],
    },
    // 01's 1 pt divider under the header, brightest in the middle.
    divider: {
      angle: 90,
      stops: [stop(0.1, "#FFFFFF", 0), stop(0.5, "#FFFFFF", 0.1), stop(0.94, "#FFFFFF", 0)],
    },
    // 01's hero line icons: one gradient across the whole icon, not one per stroke.
    line: {
      angle: 135,
      stops: [stop(0, refColor.lineStart), stop(1, refColor.lineEnd)],
    },
    // 02's shutter disk: darker at the top right, lighter at the bottom left.
    // The line spans the disk's box, so the stops run wider than the
    // measured #1E to #26 across the 67 disk itself.
    shutterDisk: {
      angle: 210,
      stops: [stop(0, "#1C1C1C"), stop(1, "#2A2A2A")],
    },
    // The disk one notch darker while pressed (proposal).
    shutterDiskPressed: {
      angle: 210,
      stops: [stop(0, "#171717"), stop(1, "#252525")],
    },
    // The opaque fill inside 04's device outlines, as measured down the
    // reference's phone (#3E at 4 %, #34 at 12 %, #23 at 24 %, #10 at 36 %,
    // #0C at 42 %, black from about 56 %).
    deviceFill: {
      angle: 180,
      stops: [stop(0, "#424242"), stop(0.13, "#343434"), stop(0.28, "#1E1E1E"), stop(0.42, "#0C0C0C"), stop(0.56, "#000000")],
    },
    // pushr's haze as fitted on 03 (rms 2.7 grey levels against the
    // reference), shared by 03 and 05 (kit: PaperHaze). Not a centred circle:
    // the focal point sits up and right of the centre, so it falls off faster
    // to the right and down; paper fades in over its foot so the page is white
    // by fade.to. Centre and focus x are offsets from the screen's middle.
    haze: {
      centre: { dx: 12.4, y: 153.5 },
      focus: { dx: 38.8, y: 113.5 },
      r: 218,
      stops: [
        stop(0, refColor.ambientCore),
        stop(0.12, refColor.ambientCore, 0.98),
        stop(0.23, refColor.ambientCore, 0.91),
        stop(0.45, refColor.ambientCore, 0.59),
        stop(0.63, refColor.ambientCore, 0.3),
        stop(0.8, refColor.ambientCore, 0.13),
        stop(1, refColor.ambientCore, 0),
      ],
      fade: { from: 250.7, to: 287.5 },
    },
  },
  font: refFont,
  /** react-native-web's "System" stack, for SVG text on the web, which doesn't inherit it (native SVG text uses the system font already). */
  webSystemFont: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
  // Measured from the references. Every style follows system text scaling.
  type: {
    /** 03's and 05's sheet title: Archivo ExtraBold 30/36, tracked +1.4 so "camera permission" spans pushr's 309 (315 at +1.8), lowercase as in the reference. Left-aligned, inkDisplay. */
    display: { fontFamily: refFont.grotesk, fontSize: 30, lineHeight: 36, letterSpacing: 1.4, textTransform: "lowercase" },
    /** 02's shot counter: Crimson Text Italic 29, +1.75. Numerals about 31 apart centre to centre. */
    counter: { fontFamily: refFont.italic, fontSize: 29, lineHeight: 34, letterSpacing: 1.75 },
    /** 02's header title: Roboto Serif Regular 17, centred, textPrimary. */
    serifTitle: { fontFamily: refFont.serif, fontSize: 17, lineHeight: 22, letterSpacing: 0 },
    /** 01's screen title: Semibold 22, centred, textPrimary. */
    title: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
    /** 04's step title: Bold 22, left-aligned, up to two lines, textPrimary. */
    stepTitle: { fontSize: 22, lineHeight: 28, fontWeight: "700" },
    /** 04's one-line instruction: Regular 22, left-aligned, textSecondary. */
    stepBody: { fontSize: 22, lineHeight: 28, fontWeight: "400" },
    /** The ghost and quiet pill labels: Semibold 17. */
    headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
    /** 01's header title: Semibold 16 (Opal's "Work Time" cap 11.3 is SF Semibold 16). */
    navTitle: { fontSize: 16, lineHeight: 21, fontWeight: "600" },
    /** The label on the 64 pt primary pill (03): Semibold 20 (pushr's "continue" fits SF Pro Semibold at 19.7–20.3 pt). */
    ctaLabel: { fontSize: 20, lineHeight: 24, fontWeight: "600" },
    /** The line under 01's title: Medium 17, textSecondary. */
    subtitle: { fontSize: 17, lineHeight: 22, fontWeight: "500" },
    /** 03's and 05's sheet body: Medium 17 (pushr's line widths fit SF Pro Text Medium, not Regular), left-aligned, ragged right, inkMuted. */
    body: { fontSize: 17, lineHeight: 22, fontWeight: "500" },
    /** 02's meta line under the title: Regular 13, textSecondary. */
    meta: { fontSize: 13, lineHeight: 16, fontWeight: "400" },
    /** 02's segment labels, active (textPrimary) and inactive (textTertiary) the same size: Semibold 13. */
    label: { fontSize: 13, lineHeight: 16, fontWeight: "600" },
    /** 01's game-card tags: Semibold 13, +0.4, uppercase, textLabel. */
    tag: { fontSize: 13, lineHeight: 16, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
    /** 06's status line, the feature line under the build wait's title: Medium 22, centred. One line at 375 for every line it shows. */
    status: { fontSize: 22, lineHeight: 28, fontWeight: "500" },
  } as const satisfies Record<string, TextStyle>,
  // Spacing that more than one screen uses. ctaBottom is added to the bottom
  // safe-area inset. A screen's own distances live in its ref.layout block.
  space: {
    /** Title to subtitle; segment thumb inset; step title to body. */
    xs: 4,
    /** Tag pill padding; pill to quiet button. */
    sm: 8,
    /** Viewfinder side margins (02). */
    plate: 14,
    /** 01's chips from the screen edge; sheet title to body (03). */
    lg: 16,
    /** 02's controls, counter and thumbnail from the screen edge. */
    edge: 20,
    /** 03's sheet gutter; 02's control row to the bottom row. */
    xl: 24,
    /** Between major blocks (header to viewfinder, subtitle to cards, panel to title). */
    band: 28,
    /** From a last baseline to the next block. */
    xxl: 32,
    /** 04's reading gutter. */
    reading: 38,
    /** Bottom of the last button above the bottom safe-area inset. */
    ctaBottom: 4,
  },
  // Continuous corners (curve) everywhere except the small tag pills.
  radius: {
    /** 01's tag pills. */
    tag: 8,
    /** 02's segment thumb (16 minus the 4 inset). */
    knob: 12,
    /** 02's 44 pt square header buttons. */
    square: 14,
    /** 03's sheet top corners; 02's segment track. */
    sheet: 16,
    /** 02's last-photo image (24 minus the 4 frame) and counter pill. */
    nested: 20,
    /** 02's last-photo frame. */
    frame: 24,
    /** 02's viewfinder. */
    viewfinder: 40,
    /** Every bottom sheet's top corners: the camera viewfinder's 40 (the user's call). */
    bottomSheet: 40,
    /** Pills, chips, discs and the shutter. Game cards scale theirs (button.gameCard.radiusRatio). */
    round: 999,
  },
  curve,
  // Every focusable control gets this outline, following its own shape. Brass,
  // the user's decision (the references show no focus state); 8:1 on black.
  focus: { width: 2, offset: 2, color: color.accent },
  hit: {
    min: 44,
    comfortable: 48,
  },
  // Pressed states are proposals (the screenshots show none): the pills change
  // colour over motion.control; the other controls keep the live 0.75 press.
  button: {
    // The live Button's and IconButton's disabled opacities.
    disabledOpacity: { pill: 0.45, icon: 0.4 },
    // pushr's black pill on paper (03): 64 tall, full content width, ctaLabel.
    primary: { height: 64, radius: 999, fill: refColor.raised, pressedFill: refColor.raisedPressed, label: refColor.textPrimary },
    // Apple Health's dark pill on black (04): 52 tall, a 1 pt hairline, headline.
    ghost: {
      height: 52,
      radius: 999,
      fill: refColor.shade,
      pressedFill: refColor.raised,
      borderWidth: 1,
      border: refColor.hairline,
      label: refColor.textPrimary,
    },
    // Text only, label + padX each side, headline. On paper as in 03, or on dark.
    quiet: {
      height: 48,
      padX: 16,
      // Grey on paper (03 and 05 agree; 4.7:1), darkening when pressed, so the black pill stays the one strong action.
      paper: { label: refColor.inkMuted, pressedLabel: refColor.raised },
      dark: { label: refColor.textPrimary, pressedLabel: refColor.textSecondary },
    },
    // 02's square header buttons: 44 box, 48 hit, Phosphor 20.
    square: { size: 44, radius: 14, fill: refColor.raised, borderWidth: 1, border: refColor.rimFaint, icon: 20, hit: 48, pressedOpacity: 0.75 },
    // 01's round header chips: 36 disc, diagonal 1 pt ring (specularDark at
    // top left and bottom right, 0 at the other corners), Phosphor 18.
    chip: { size: 36, radius: 999, fill: refColor.ground, ringWidth: 1, ring: refColor.specularDark, icon: 18, hit: 48, pressedOpacity: 0.75 },
    // A glyph with no container: white on dark, raised on paper.
    bare: { icon: 24, hit: 48, glyph: refColor.textPrimary, glyphOnPaper: refColor.raised, pressedOpacity: 0.75 },
    // 01's dismiss disc over the glow.
    dismissDark: { size: 48, radius: 999, fill: refColor.dismissFill, glyph: refColor.textSecondaryAlpha, icon: 20, pressedOpacity: 0.75 },
    // 04's grey glass dismiss disc on black, with a 1 pt specular ring.
    dismissGlass: {
      size: 48,
      radius: 999,
      fill: refColor.glassDisc,
      ringWidth: 1,
      ring: refColor.specularLight,
      ringAlt: refColor.specularLightAlt,
      glyph: refColor.inkDisplay,
      icon: 26,
      pressedOpacity: 0.75,
    },
    // 02's shutter: a 75 ring 4 thick around a 67 disk (gradient.shutterDisk,
    // bevel along its top), effect.shutterGlow. It carries Phosphor
    // MagnifyingGlass in white at `iconFallback` (the painted glass is `icon`).
    shutter: {
      ring: 75,
      ringWidth: 4,
      ringFill: refColor.well,
      disk: 67,
      highlight: refColor.bevel,
      icon: 32,
      iconFallback: 28,
      pressedScale: 0.94,
    },
    // 02's zoom segment: a 100 x 40 track, 45 x 32 thumbs inset 4.
    segment: {
      width: 100,
      height: 40,
      radius: 16,
      fill: refColor.void,
      inset: 4,
      thumbWidth: 45,
      thumbHeight: 32,
      thumbRadius: 12,
      thumbFill: refColor.thumb,
      active: refColor.textPrimary,
      inactive: refColor.textTertiary,
    },
    // 02's last photo: a 72 frame 4 thick around the image.
    thumbnail: { size: 72, radius: 24, frameWidth: 4, frameFill: refColor.well, imageRadius: 20, imageRim: refColor.rimFaint, pressedOpacity: 0.75 },
    // 01's game cards (gradient.card, gradient.cardRim): radius and tag offset
    // scale with card width (31.5 and 24 on the 187 pt reference card); the
    // tag (26 tall, 9 padding, radius 8, 1 pt rim) keeps its size.
    gameCard: { aspect: 0.584, radiusRatio: 0.169, tagInsetRatio: 0.128, tagHeight: 26, tagPadX: 9, tagRadius: 8 },
  },
  // No drop shadows and no blur anywhere: depth is steps in lightness.
  effect: {
    /** 02's shutter halo: about 12 above the ring, a little to the right, gone about 2 below (color.shutterGlow, a negative spread). */
    shutterGlow: "1px -4px 10px -3px rgba(255, 255, 255, 0.20)",
    /** The diagonal specular rings (01's chips, 04's glass disc). */
    specularRingWidth: 1,
    /** 01's game cards on the reference, mirrored. */
    cardTilt: 5,
    /** ESCAPD's three-card fan (degrees). */
    fanTilt: 6,
    /** 03's phone outline, clockwise (degrees). */
    illustrationTilt: 14,
    /** 04's context lines fade to transparent over their last 40 pt. */
    contextFade: 40,
    /** 01's hero icons: secondary strokes at this opacity. */
    secondaryLineOpacity: 0.6,
  },
  // Phosphor regular (stroke = size / 16), the closest weight to the measured
  // 1.2 to 2.1 pt chrome strokes. Sizes are Phosphor box sizes.
  icon: {
    /** Chrome glyph stroke as drawn. */
    stroke: 1.5,
    /** 04's dark line illustrations (the reference's lines integrate to 1.75–1.9 pt). */
    illustrationStroke: 1.75,
    /** 03's solid phone outline band. */
    illustrationBand: 16,
    /** 01's hero line icons: stroke as a share of icon size (3.5 at 48). */
    heroStrokeRatio: 0.072,
    heroMin: 48,
    heroMax: 68,
    /** In 01's round chips. */
    chip: 18,
    /** In 02's square header buttons; the pill spinner. */
    header: 20,
    /** Bare controls (flash, flip, back). */
    control: 24,
    /** 01's dismiss X. */
    dismiss: 20,
    /** 04's glass dismiss X. */
    close: 26,
    /** The brass magnifier image on the shutter. */
    shutter: 32,
    /** The Phosphor shutter fallback. */
    shutterFallback: 28,
  },
  // Screen geometry from docs/DESIGN.md that no shared token covers, one block
  // per screen. Shared values stay above; these are only the screen's own.
  layout: {
    // 01 · Home, at / (the shell's reference look), measured on 393 x 852
    // (safe 59 / 34): Opal's header (ref.button.chip), then the three mode
    // cards, each in its mode's theme (modeThemes).
    hub: {
      // The 1 pt lines: the divider, the card rims, the tag pills, the notice's and the sheet's edges.
      hairline: 1,
      // The chip row's top below the safe top (y 71), and the ESCAPD logo
      // (assets/brand/wordmark.png, cut from the brand art: cream letters, the
      // A's keyhole lit amber, a soft glow keyed onto clear): `logo` tall
      // including its glow (the letters about 29 pt), `logoAspect` its
      // width / height. It stays inside the chips' 48 pt row, so the deck
      // below keeps its place.
      header: { top: 12, logo: 40, logoAspect: 890 / 161 },
      // The chips' diagonal 1 pt ring, as a gradient from their top right to
      // their bottom left. On the circle it spans only 0.146-0.854 of the
      // line, so: nothing at 45° / 225°, white 10.5 % at the cardinals, 15 %
      // on the top-left and bottom-right arcs (Opal: peaks 0.15 / 0.13).
      chipRing: [
        stop(0.146, refColor.textPrimary, 0),
        stop(0.25, refColor.textPrimary, 0.105),
        stop(0.5, refColor.textPrimary, 0.15),
        stop(0.75, refColor.textPrimary, 0.105),
        stop(0.854, refColor.textPrimary, 0),
      ],
      // The How you play glyph, ESCAPD's three-rail sliders at Opal's numbers
      // in the 18 chip glyph box: rails 13 wide, stroke 1.2, 3.96 apart; ring
      // knobs 3.8 across at these shares of the rail (top, middle, bottom).
      sliders: { width: 13, stroke: 1.2, pitch: 3.96, knob: 3.8, knobs: [0.73, 0.41, 0.7] },
      // The three mode cards (MODES_PROMPT.md Part 2, round 6): a deck dealt
      // down the screen under the divider, each card lying partly over the one
      // above it (later cards on top), the first `top` below the divider,
      // `edge` from the screen's sides, the last `foot` above the safe bottom.
      // `deck`: each card covers the foot of the one above by `cover` of a
      // card's height, so on a short screen (375 x 667) all three fit and on a
      // tall one they fill it: card = column / (3 - 2 x cover). Every card
      // keeps its words plus `peek` of its art clear of the next card (large
      // text grows the cards and the deck scrolls), and none is shorter than
      // `minHeight`. Each is turned `tilt` degrees about its centre (one per
      // card, alternating; the words' side keeps its room), and casts `shadow`
      // up onto the card it covers, a soft darkening where they overlap, and
      // catches `edge`, a faint line of light along its top.
      // Each card is solid and physical: the mode's drawn cover full bleed,
      // corners `radius` (continuous), a `rim` pt edge in the mode's rim. Its
      // name and tagline sit `pad` in from the top and sides (the part no
      // card covers) on a plate of the mode's ground at `plate` opacity that
      // fades down to clear over `fade` pt below them (`fadeStops`, shares of
      // the fade from the plate's edge, end on `plate`): enough for the mode's
      // ink at 4.5:1 over a white picture (hub-test). While its tap works, a
      // card shows a small busy capsule beside its tagline: the mode's ground
      // with a `rim` pt edge, `tag` padding. No status tag. A card dimmed while another works is
      // shaded with void at 1 - disabledOpacity.pill (never see-through, so
      // the card under it stays hidden). Pressed: `pressScale`, with the kit's
      // squash (ref.motion.juice.press).
      modes: {
        top: 16,
        edge: 16,
        foot: 12,
        minHeight: 168,
        deck: {
          cover: 0.36,
          peek: 40,
          tilt: [2.5, -2, 2],
          shadow: "0px -10px 24px 0px rgba(0, 0, 0, 0.62)",
          // Light along each card's top edge, inside its rim (between the corners): white 0 to 16 % to 0 across.
          edge: {
            angle: 90,
            stops: [stop(0, refColor.textPrimary, 0), stop(0.5, refColor.textPrimary, 0.16), stop(1, refColor.textPrimary, 0)],
          },
        },
        radius: 20,
        rim: 1,
        pad: 18,
        plate: 0.72,
        fade: 56,
        fadeStops: [
          { offset: 0, opacity: 0 },
          { offset: 0.5, opacity: 0.38 },
          { offset: 1, opacity: 0.72 },
        ],
        taglineGap: 2,
        tag: { padX: 10, padY: 4, gap: 8 },
        pressScale: 0.98,
        // Each mode's one signature touch, decorative and static:
        // noir's brass rule `gap` above the name;
        rule: { width: 28, height: 2, gap: 10 },
        // paranormal's soft glow: a radial light in the mode's glow colour
        // centred at (cx, cy) of the card, `r` of its width across.
        glow: {
          cx: 0.74,
          cy: 0.3,
          r: 0.62,
          stops: [
            { offset: 0, opacity: 0.3 },
            { offset: 0.45, opacity: 0.12 },
            { offset: 1, opacity: 0 },
          ],
        },
        type: {
          tagline: { fontSize: 17, lineHeight: 22, fontWeight: "500" },
          tag: { fontSize: 13, lineHeight: 16, fontWeight: "600" },
        } as const satisfies Record<string, TextStyle>,
      },
      // The notice's glyph (a card's tap that can't go on): one meta line square.
      noticeIcon: 16,
      // How you play, a dark sheet in the chips' and cards' material. Scrim
      // black 55 %. It slides up on ref.motion.sheetRise and away on sheetFall (`exit` is unused)
      // slide; the scrim fades in and out; focus moves to its title once it
      // has risen (or sooner under reduced motion), and returns to How you
      // play after the exit (or motion.reducedFade) plus `focusMargin` (ms).
      sheet: {
        scrim: "rgba(0, 0, 0, 0.55)",
        maxHeight: "64%",
        exit: 200,
        scrimIn: 200,
        scrimOut: 160,
        titleFocus: 300,
        titleFocusReduced: 50,
        focusMargin: 100,
        // A sheet's own close: onClose runs when its slide ends, or this many ms after the slide's duration if that never reports.
        closeSlack: 150,
        // Every switch (Settings, Case options): a white track with a black
        // thumb when on, grey when off. No green, mint or aqua anywhere.
        switch: { on: refColor.textPrimary, off: refColor.textTertiary, thumb: refColor.void },
      },
      // Settings (the hub's DarkSheet), grouped rows in the review screen's
      // list style: a Bold 14 section heading `headingGap` above its group,
      // the sections `section` apart; each group a raised panel with
      // `radius` corners; rows at least `rowHeight` tall (`padY` above and
      // below their words), `pad` in from the panel's sides, label and
      // control `gap` apart, a one-line detail (`detailMax` characters at most,
      // so it stays one line beside a switch on a 375 pt screen) `detailGap`
      // under the label,
      // split by 1 pt rim lines inset `pad` from the left; a navigation row
      // ends in a Phosphor CaretRight at `caret`. Pressed rows at
      // `pressedOpacity` (proposal). The sheet may grow to `top` under the
      // safe top, so every row fits with no scroll on an iPhone SE at the
      // default text size; large text scrolls.
      settings: {
        heading: { fontSize: 14, lineHeight: 20, fontWeight: "700" } as const satisfies TextStyle,
        headingGap: 8,
        section: 16,
        radius: 8,
        fill: refColor.raised,
        divider: refColor.rim,
        rowHeight: 48,
        padY: 6,
        detailGap: 2,
        detailMax: 34,
        pad: 16,
        gap: 12,
        caret: 15,
        pressedOpacity: 0.75,
        top: 8,
      },
    },
    // A mode's first-time intro (/mode/intro/<genre>), in the mode's theme
    // (modeThemes): every colour is the mode's, never one here.
    mode: {
      // The back square (ref.button.square in the mode's raised and rim) `edge`
      // from the side and `top` below the safe top, as on the camera.
      edge: 21,
      top: 8,
      // The fixed header's backing, so the content never runs under the square
      // or the status bar: the ground from the screen's top to `header.below`
      // under the square, then a `header.shade`-tall fade to clear. It fades
      // in over the last `header.fade` pt of scroll before the banner's foot
      // reaches the backing's foot, so at rest the square sits on the art.
      // The content reports its scroll every `throttle` ms (a frame at 60 fps).
      header: { below: 8, fade: 24, shade: 24, throttle: 16 },
      // The banner: the mode's drawn cover (home's card art) full bleed from
      // the screen's top to `banner` below the safe top, shaded in the ground
      // behind the status bar and fading into it over its lower part
      // (`bannerFade`, shares of its height). The back square sits on it; the
      // words sit below it.
      banner: 148,
      bannerFade: [
        { offset: 0, opacity: 0.55 },
        { offset: 0.3, opacity: 0 },
        { offset: 0.42, opacity: 0 },
        { offset: 0.78, opacity: 0.62 },
        { offset: 1, opacity: 1 },
      ],
      // The column's side inset; the tagline `taglineGap` under the name.
      inset: 20,
      taglineGap: 4,
      // The pinned foot (the photo guide's pill, in its reading column,
      // ref.space.ctaBottom above the safe bottom): `pad` above the pill, and
      // the content scrolls under a `shade`-tall fade into the ground.
      foot: { pad: 12, shade: 24 },
      // The intro: the kicker `introTop` under the banner; the steps
      // `stepsTop` under the tagline, `stepGap` apart; each step's numeral
      // (the mode's display face at `numeral`) in a `numeralWidth` column, its
      // words `stepTextGap` under the step's title.
      intro: { introTop: 4, stepsTop: 32, stepGap: 24, numeralWidth: 40, stepTextGap: 4 },
      type: {
        tagline: { fontSize: 17, lineHeight: 22, fontWeight: "500" },
        kicker: { fontSize: 13, lineHeight: 16, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" },
        body: { fontSize: 16, lineHeight: 23, fontWeight: "400" },
        step: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
        numeral: { fontSize: 34, lineHeight: 38 },
      } as const satisfies Record<string, TextStyle>,
    },
    // 02 · Camera (Once), measured on 393 x 852 (safe 59 / 34). The controls
    // themselves are ref.button.square / bare / segment / shutter / thumbnail.
    camera: {
      // Header buttons, counter and thumbnail from the screen edges (measured
      // 20.8 to 21.2), and the square buttons' top below the safe top (y 67).
      edge: 21,
      top: 8,
      // The thumbnail image's 1 pt rim.
      hairline: 1,
      // The square buttons' rim as measured (#222 to #242424 over the raised
      // fill; rimFaint composites to #292929 there, a visibly brighter edge).
      squareRim: "#232323",
      // Glyphs as measured: the back arrow 14.3 wide with a 1.5 to 1.7 stroke
      // is Phosphor bold at 18 (Images matches it); the control row's bolt
      // (20.3 tall) and the flip slot (16.6 wide) are 22.
      headerIcon: { size: 18, weight: "bold" },
      controlIcon: 22,
      // The control row's glyph centres from each screen edge: flash under
      // the back arrow (x 43), the grid on Once's flip glyph (x 347.6, not
      // the library button's 350). The lens segment stays on the screen's centre.
      controlColumns: { left: 43, right: 45.4 },
      // The chosen lens's "×": a 7.5 pt xmark, 5 after the digits (Phosphor X
      // bold at 11.5; its side bearing makes up the rest of the gap).
      lensMark: { size: 11.5, gap: 3 },
      // The serif title's line box below the buttons' top, and the meta line
      // metaGap under it: baselines y 87 and 108 (measured 87.0 / 107.8);
      // 3 + 22 + 3 + 16 fills the buttons' 44.
      promptTop: 3,
      metaGap: 3,
      // Bands on 852: button bottom to the viewfinder (111 -> 140), the
      // viewfinder to the zoom track (626.7 -> 656.4), the track to the bottom
      // row (696.4 -> 720.4), the bottom row to the safe bottom (792.4 -> 818).
      band: { viewfinder: 29, controls: 29.7, bottom: 24, foot: 25.6 },
      // Viewfinder: exactly 3:4 (width / height), fitted by containBox; the
      // sensor's 4:3 held upright (CameraView `ratio`, Android).
      frameAspect: 0.75,
      feedRatio: "4:3",
      // Framing grid: rule of thirds in 1 pt white lines at this opacity.
      grid: { divisions: 3, line: 1, opacity: 0.4 },
      // Privacy note: a black pill on the feed (void at fillOpacity), its foot
      // `inset` above the viewfinder's, as wide as the copy (one line on 393).
      note: { inset: 16, padX: 12, padY: 8, fillOpacity: 0.6 },
      // The turn dial: the privacy note's see-through black pill, `inset`
      // below the viewfinder's top, a `dial` circle at its left end (`padLeft`
      // in) and "Photo 2 of 6" `gap` after it. On the dial, a `ringWidth`
      // textTertiary ring `ring` in from its edge carries each photo's stop:
      // taken ones a white dot (`taken`), the next a white ring (`target`, its
      // line `targetLine`, filled once the turn is far enough), the rest a
      // small grey dot (`rest`); the live turn is a white arc (`arc`) on the
      // ring from the last stop toward the next.
      turn: {
        inset: 16,
        dial: 32,
        padLeft: 4,
        padRight: 12,
        padY: 4,
        gap: 8,
        ring: 4,
        ringWidth: 1,
        taken: 2.75,
        target: 3.25,
        targetLine: 1.5,
        rest: 1.5,
        arc: 2,
      },
      // The counter's void pill (radius.nested): numerals `gap` apart, the
      // current one centred and nudged by dx / dy (the italic's slant, the
      // caps' centre). A new plate rolls the strip over motion.counterRoll.
      // `gap` adds to the tracking each numeral carries (1.75 after it, and on
      // iOS and the web a leading pad of 1.75). Round 4's Arabic numerals
      // (Crimson Italic digits, 11.6 advance) sit Once's measured ~31 apart
      // centre to centre, so one neighbour shows on each side, cut by the
      // pill's edges (at the old 4 two showed: "1 2 3 4").
      counter: { width: 73, height: 52.5, gap: 16, dx: 0.8, dy: 1.4, maxFontScale: 1.25 },
      // Shutter: its centre 2.7 below the bottom row's (measured); the disk's
      // 1 pt bevel, brightest across the top and gone by about 80 deg either
      // side (fitted to the reference's edge peaks, objectBoundingBox
      // fractions); the glass nudged so its lens, not its box, reads as centred.
      shutter: {
        drop: 2.7,
        bevelWidth: 1,
        bevelLine: { x1: 0.5, y1: 0, x2: 0.5, y2: 1 },
        bevel: [stop(0, refColor.bevel), stop(0.3, refColor.bevel, 0.35), stop(0.5, refColor.bevel, 0)],
        glassNudge: { x: 1, y: 1 },
      },
      // Lens labels cap so "0.5 ×" stays inside its 45 thumb.
      lensMaxFontScale: 1.25,
      // The way on from MIN_PLATES: a 1 pt grey ring on the thumbnail frame's
      // outer edge, quiet (the reference's tertiary grey; no brass).
      cue: { width: 1, color: refColor.textTertiary },
      // The error line's Warning glyph, inside one meta line.
      noticeIcon: 14,
      // Busy: the thinking line replaces the detail only past this many ms.
      thinkingDelay: 1000,
    },
    // 03 · Camera permission: pushr's white sheet, measured on 393 x 852
    // (docs/refs/03-camera-permission.png). Paper, panel, inks, the 64 pill,
    // the display title, the gutter and the gaps are shared tokens above;
    // these are the screen's own.
    permission: {
      // The body's box below the title's: title baseline to first body
      // baseline 39 as measured (39.1), with Archivo's and the system font's
      // line boxes.
      titleToBody: 14,
      // The illustration panel across the top of the sheet: full-bleed, 150 tall
      // (measured 149.7), panel grey under the sheet's top corners.
      panel: 150,
      // The phone outline, fitted to the reference's render. Drawn in its own
      // upright space (origin at the frame's unrounded top-left corner, y down
      // from its top edge), then sheared by ref.effect.illustrationTilt, so the
      // top edge falls to the right while the sides stay upright, as pushr's
      // phone turned in perspective. The panel's foot crops it.
      phone: {
        // The origin: this far left of the panel's centre (x 115.6 on 393) and below its top.
        dx: -80.9,
        top: 28.8,
        width: 157,
        // Drawn this long, past the panel's foot.
        length: 160,
        // Outer corners as ellipses (rx, ry): wider at the top left, taller at the top right.
        outer: { left: { rx: 44, ry: 41 }, right: { rx: 30, ry: 36 } },
        // The solid black band, then the open screen (panel grey) inside it.
        band: { left: 18, right: 18.5, top: 16 },
        inner: { left: { rx: 8, ry: 18 }, right: { rx: 19, ry: 27 } },
        // Shading, all ref.color.illustrationBevel over the black at these
        // opacities. The lit inner wall down the left: 9 wide, full from 39.5
        // below the top edge (a 2 ramp), and `corner` round the corner above it.
        bevel: { width: 9, from: 39.5, ramp: 2, corner: 0.2 },
        // The outer wall down the right: 7.6 wide, centred 5.6 in from the
        // edge, `upper` (#333333) round the corner down to `to`, `lower`
        // (#171717) below; it fades in over `ramp` from the corner's start.
        sheen: { inset: 5.6, width: 7.6, upper: 0.35, lower: 0.16, to: 48, ramp: 15 },
        // A 1 pt gloss line along the top band, 6 below its edge, fading out to the right.
        gloss: { y: 6, from: 26, peak: 36, to: 125, width: 1, opacity: 0.36 },
      },
      // The island, in its own axes (u along it, v across it, from its
      // centre): 57.3 x 24, rotated 12 deg, centred 72.7 along the frame from
      // its origin and 30.7 below its top edge. A round left end; the right
      // end square-cut with `endRadius` corners, showing a flat lit face (u
      // `face.from` to `face.to`, `face.height` tall, corners `face.radius`)
      // in illustrationBevel: `lit` down to `split` of its height, `shade`
      // from `shadeFrom`. The black between the face and the gloss line is the
      // seam. A gloss line 5.5 above its axis (u -22 to 12, opacity 0.45 to 0.2).
      island: {
        x: 72.7,
        y: 30.7,
        width: 57.3,
        height: 24,
        rotate: 12,
        endRadius: 8,
        gloss: { v: -5.5, from: -22, to: 12, width: 1.2, start: 0.45, end: 0.2 },
        face: { from: 20.5, to: 28.2, height: 19, radius: 4, lit: 0.38, shade: 0.16, split: 0.55, shadeFrom: 0.8 },
      },
      // The notice's Warning glyph: one meta line square.
      noticeIcon: 16,
      // A thinking line shows only once its wait has run past ~1 s (Checking,
      // a single library photo).
      thinkingDelay: 1000,
      // Accessibility focus moves to the title once the sheet has risen (under
      // reduced motion: after motion.reducedFade).
      titleFocusDelay: 300,
    },
    // 04 · First-time photo guide, in Apple Health's look (docs/refs/04).
    // 393 x 852, safe 59 / 34; the column is ref.space.reading 38 each side.
    guide: {
      // The glass close disc (button.dismissGlass): its outer edge, ring
      // included (48 + 2 x 1 = 50, measured 50.3), 10 below the safe top and
      // 32 from the right edge: x 311-361, y 69-119, centre (336, 94). Its
      // 1 pt specular ring, as a gradient at CSS 135 deg: a circle's rim spans
      // offsets 0.15 (upper left, #AAAAAA) to 0.85 (lower right, #B6B6B6) of
      // its square's gradient line; top and left read #A0A0A0, right and
      // bottom #939393, the other diagonal #8D8D8D (measured 141 to 182).
      close: {
        top: 10,
        right: 32,
        ring: {
          angle: 135,
          stops: [
            stop(0.15, refColor.specularLightAlt),
            stop(0.25, "#A0A0A0"),
            stop(0.5, "#8D8D8D"),
            stop(0.75, "#939393"),
            stop(0.85, refColor.specularLight),
          ],
        },
      },
      // The art band, from the disc's bottom (y 119) to the title. On 393 x
      // 852 the art box sits at y 266-532 (147 below the disc, as measured,
      // and 81 above a one-line title). A taller band shares its free height
      // 147 : 81. Text growth comes out of `below` first, then `above`, each
      // down to `clear`; only then does the art shrink evenly, and below
      // art.minHeight (scale 0.45) it hides.
      voids: { above: 147, below: 81, clear: 24 },
      // The art box in its own units, centred on the screen (x 76.5-316.5).
      // Ink no wider than inkMax (the reference's is 131 x 265).
      art: { width: 240, height: 266, inkMax: 170, minHeight: 120 },
      // Title line box to body line box: the measured baselines are 30.4-30.9
      // apart on 28 lines. Title 613-641, body 644-700 on the base device.
      titleGap: 3,
      // The body's grey, a touch lighter than the shared textSecondary: the
      // reference's blurred glyph cores read #95-#9B and peak at #A5-#AA.
      bodyText: "#999999",
      // Body's last line to the button top (y 700-762; measured 62.5), and the
      // replay status line (ref.type.meta, 16) inside it, 23 clear each side.
      ctaGap: 62,
      statusTop: 23,
      statusBottom: 23,
      // Horizontal swipe: activation and vertical-fail offsets, then the
      // release commit thresholds (pt and pt/s).
      swipe: { activeOffsetX: 16, failOffsetY: 16, commitDistance: 56, commitVelocity: 500 },
      // Replay wait: the thinking line appears only past this many ms.
      thinkingDelay: 1000,
      // Replay error: the Warning glyph beside the meta line.
      errorIcon: 16,
      // The line art's inks beyond ref.color's line greys (art units). `thin`:
      // the inner screen's edge and ridges. The inner screen's edge darkens
      // from lineContext at its top to screenBottom. Print on a lit panel:
      // `text` (its first line) and `textDim`. `ridge`: detail inside a dark
      // shape. Context lines that run off the bottom fade from lineContext at
      // fade.from to nothing at fade.to (the reference hand: 77 at y 172, 33
      // at 224, 7 at 256, 0 at 266); step 2's rays and step 3's desk fade over
      // their last endFade instead.
      ink: {
        thin: 1,
        screenBottom: "#323232",
        text: "#A8A8A8",
        textDim: "#585858",
        ridge: "#3C3C3C",
        fade: { from: 170, to: 266 },
        endFade: 40,
      },
      // Fills beyond ref.gradient.deviceFill, each across its shape's own box:
      // the lit panel (the reference's bottle label: #6B6B6B at the top right
      // to black three quarters across) and the small tag (its box label,
      // #474747 to #0D0D0D top to bottom).
      fill: {
        panel: { angle: 235, stops: [stop(0, "#6B6B6B"), stop(0.75, refColor.void)] },
        tag: { angle: 180, stops: [stop(0, "#474747"), stop(1, "#0D0D0D")] },
      },
      // The hero phone (measured 70 x 137, corners 10.5; inner screen inset 13
      // at the sides, 24.5 at the top and 27 at the bottom, corners 10; a thin
      // lineBack bezel 1.3 inside the outline at corners 9.2, the darker
      // shoulder inside the reference's white edge), and step 2's plan phones
      // seen from above.
      phone: {
        width: 70,
        height: 137,
        radius: 10.5,
        bezel: { inset: 1.3, radius: 9.2 },
        screen: { insetX: 13, insetTop: 24.5, insetBottom: 27, radius: 10 },
      },
      planPhone: { width: 22, height: 42, radius: 5 },
    },
    // 05 · Pro (test paywall), modelled on 03's pushr sheet: paper and the
    // haze (kit PaperHaze), a full-bleed sheet (radius.sheet top corners)
    // whose panel holds the case-file art, then title, body, the note row,
    // the primary pill and the grey quiet pill. Gaps are ref.space unless
    // named here: panel to title xl, body to note row sm, note row to pill
    // band, pill to quiet sm; the sheet's top stops lg below the safe top;
    // bottom ctaBottom above the safe area (lg with no bottom inset); gutter xl.
    pro: {
      // Loading: the ActivityIndicator appears only if the access check is
      // still running after this many ms, so a faster check shows nothing.
      spinnerDelay: 300,
      // 03's illustration panel (panel colour), full-bleed; it crops the art.
      panelHeight: 150,
      // Title box to body box: title baseline to first body baseline 39, as
      // pushr's (39.1), with Archivo's 36 line over the 17/22 body.
      titleGap: 14,
      // The note row's error glyph (Warning / WifiSlash): one meta line square.
      noticeIcon: 16,
      // Lines the note row reserves: the test note or an error (test builds);
      // "isn't on sale yet" takes two (test purchases off).
      noteLines: 1,
      infoLines: 2,
      // The case file, drawn as 03's phone (ref.layout.permission.phone):
      // the same frame metrics, lights and placement, with a folder's tab in
      // its top edge and a label in place of the island. Drawn upright (origin
      // at the frame's unrounded top-left corner, y down from the tab's top
      // edge), then sheared by `slope` (ref.effect.illustrationTilt, 14 deg) so
      // the top falls to the right while the sides stay upright; the panel's
      // foot crops it. Ink: 157 wide, its top 38.6 below the panel's top.
      art: {
        // Origin this far left of the panel's centre (x 115.6 on 393) and below its top.
        dx: -80.9,
        top: 28.8,
        width: 157,
        // Drawn this long, past the panel's foot.
        length: 160,
        slope: Math.tan((14 * Math.PI) / 180),
        // Outer corners as ellipses (rx, ry), heavy; the inner ones tight.
        outer: { left: { rx: 44, ry: 40 }, right: { rx: 30, ry: 36 } },
        band: { left: 18, right: 18.5, top: 16 },
        inner: { left: { rx: 8, ry: 18 }, right: { rx: 19, ry: 27 } },
        // The folder's tab: the tab's top edge runs to `width`, then a
        // shoulder falls `rise` over `shoulder` to the body's top edge, both
        // bends rounded over `bend`. The right corner sits on the body's edge.
        tab: { width: 62, rise: 18, shoulder: 16, bend: 6 },
        // Lights, all illustrationBevel over the black at these opacities, as
        // 03's: the lit inner wall down the left (9 wide, full from 37.5 below
        // the top, `corner` round the corner); the outer wall down the right
        // (7.6 wide, 5.6 in, `upper` #333 round the corner to `to` below the
        // body's edge, `lower` #171717 below, fading in over `ramp`); a 1 pt
        // gloss line 6 inside the top band, following the tab, fading right.
        bevel: { width: 9, from: 37.5, ramp: 2, corner: 0.2 },
        sheen: { inset: 5.6, width: 7.6, upper: 0.35, lower: 0.16, to: 48, ramp: 15 },
        gloss: { y: 6, from: 26, peak: 36, to: 125, width: 1, opacity: 0.36 },
        // The label: a black stadium (03's island is 57.3 x 23.6), its left
        // end `left` along the frame and `drop` below the body band's inner
        // edge, right of the shoulder, with the island's gloss line.
        label: {
          left: 78,
          drop: 3,
          width: 50,
          height: 23.6,
          gloss: { v: -5.5, from: -18, to: 10, width: 1.2, start: 0.45, end: 0.2 },
        },
      },
    },
    // 06 · Building your case (/capture/develop): the build wait. No
    // reference screen. One focal visual (the room: the player's photos side
    // by side in a viewfinder frame, turning round the loop under a wandering
    // torch beam), the title in the mode's display face, one status line
    // (ThinkingStates "status"), and on ready the CASE READY stamp and the
    // guide's pill. A square close button (02's) in the header.
    develop: {
      // The close square: 02's header button, `edge` from the left, `top`
      // below the safe top. The column starts `below` under it.
      header: { edge: 21, top: 8, below: 16 },
      // The room's frame: the screen's width less space.edge each side, as
      // tall as the column allows between minHeight and maxHeight, with 02's
      // viewfinder corners (ref.radius.viewfinder 40, continuous) on the
      // capture palette's well.
      frame: { minHeight: 220, maxHeight: 440, rim: 1 },
      // Each photo is a tile as tall as the frame, `aspect` wide (a centre
      // crop of the 3 : 4 photo: neighbours in a 360 overlap, so the crop
      // trims the repeats and about 1.7 photos show at once), `gap` apart in
      // the well's colour. They bake at review.tile.bake (07's bakes, reused).
      tile: { aspect: 0.56, gap: 2 },
      // The turn round the room: `speed` pt/s to the left (photo 1, then 2:
      // clockwise, as they were taken), eased up from rest over `rampIn`. A
      // drag takes over at once; on release the room coasts (decay
      // `deceleration`), rests `resume`, then eases back up. Ready: it eases
      // to rest over `settle`.
      drift: { speed: 24, rampIn: 1600, resume: 900, settle: 1200, deceleration: 0.996 },
      // The torch beam: a dark veil (the page's colour at `veil`) over the
      // room with a soft clear pool `radius` x the frame's width across, its
      // centre wandering x / y (shares of the frame) on two sines of
      // `periodX` / `periodY`, the pool tinted with the mode's stamp colour
      // at `tint`. Ready: the lights come on. They catch (the veil to
      // flicker[0] over flicker[1] ms), stutter back to flicker[2] over
      // flicker[3] ms, then the veil lifts over `lightsOn`. Reduced motion:
      // the veil simply fades over `lightsOn`.
      beam: { radius: 0.52, veil: 0.84, soft: 0.38, tint: 0.18, x: 0.3, y: 0.16, periodX: 9000, periodY: 6400, lightsOn: 700, flicker: [0.25, 80, 0.7, 90] },
      // Reduced motion: one photo at a time, filling the frame, held `hold`
      // and cross-faded over `fade`; the beam a still pool in the middle.
      still: { hold: 4000, fade: 900 },
      // Below the frame: the title (the mode's display face at the mode's
      // `titleSize`, one line at 375) `gap.title` under it, the status line
      // `gap.status` under the title. The status rotates every `hold` ms.
      gap: { title: 28, status: 10 },
      titleSize: { shell: 26, noir: 26, crime_scene: 21, paranormal: 30 },
      status: { hold: 3200 },
      // Ready: the stamp slams `stampDelay` after the wait ends (as the drift
      // settles and the lights come on), centred on the frame; `success`
      // ms after it lands, then the pill fades in over `pillFade`. As it lands
      // the room jolts (case closed's nudge, play.complete.slam.nudge).
      ready: { stampDelay: 700, success: 180, pillFade: 320 },
    },
    // The shared state screen (src/components/StateScreen.tsx): loading,
    // offline, error and access states for the player, the build wait and
    // /account/confirmed. No reference: 07's flat ground, 01's centred title
    // (ref.type.title) and subtitle (ref.type.subtitle, grey), 02's void
    // wells, and the photo guide's foot (its pill, then a quiet button, in the
    // reading column). Loading is the kit's ThinkingStates (body size) instead
    // of a spinner. Colours are the mode's (useModeTheme): the shell's are
    // the reference look's.
    state: {
      // The centred text column's inset from the screen edges (controls sit at ref.space.edge).
      textInset: 32,
      // A caller's glyph sits in a well (the theme's ground: void in the shell) with a 1 pt faint rim, as 02's wells.
      well: { size: 72, rim: 1, rimColor: refColor.rimFaint },
      // The well to the title, the title to the body.
      gap: { title: 20, body: 8 },
      // The pinned actions, as the guide's foot: `pad` above the pill, the
      // quiet secondary `gap` under it (ref.space.ctaBottom over the safe area).
      footer: { pad: 16, gap: 8 },
    },
    // The in-game player (/tutorial, /play/[roomId]) and Case closed
    // (/tutorial/complete). No reference: derived from 02 (the photo in a
    // rounded well on the flat ground, Once's square header buttons, the serif
    // title over a grey meta line, near-black wells, white glyphs whose shape
    // shows state), 01's dark sheet (kit DarkSheet) and 07's cards and hint
    // rows; its actions are the photo guide's pills (ModePill). Room photos
    // keep their full colour.
    play: {
      // Header: the squares (ref.button.square, 02's measured rim and bold 18
      // glyphs) `edge` from the screen edges, `top` below the safe top, one
      // each side (Back, Case options); the serif title promptTop below the
      // squares' top and the meta line metaGap under it (3 + 22 + 3 + 16 = 44).
      edge: 21,
      top: 8,
      promptTop: 3,
      metaGap: 3,
      squareRim: "#232323",
      headerIcon: { size: 18, weight: "bold" },
      // Bands: the squares to the photo area, the photo area to the tray,
      // between the tray's rows, and the tray to the bottom safe area.
      band: { photo: 12, tray: 12, row: 12, foot: 8 },
      // The photo: full bleed, edge to edge, square corners. It fills the
      // screen's width; when the area is shorter than that photo, it is cropped
      // top and bottom evenly, but only into the margins no visible hotspot
      // reaches and never more than `maxCrop` of its height a side; otherwise
      // it is contained (narrower). Use mode: a white `armed` ring inside its edge.
      photo: { armed: 1.5, maxCrop: 0.1 },
      // Swiping photo to photo: pages one screen wide with no gap, following
      // the finger, round a loop (past the last view comes the first, before
      // the first the last), like turning round in the room. With one view
      // nothing loops: the page moves at `edgeResistance` and springs back.
      // On release the page projects `projection` s of velocity ahead and snaps
      // to the nearest page (one at most), settling on an ease-out with no
      // overshoot (`easing`, initial slope `slope`), its duration matched to the
      // release speed within min..max ms. The pan wins after `activeOffset` pt
      // sideways and fails after `failOffset` pt vertically. Reduced motion: no
      // following; a swipe past `reducedSwipe` pt or `swipeVelocity` pt/s
      // cross-fades to the next page over motion.reducedFade.
      pager: {
        activeOffset: 12,
        failOffset: 12,
        edgeResistance: 0.3,
        projection: 0.2,
        easing: [0.25, 1, 0.5, 1],
        slope: 4,
        minDuration: 180,
        maxDuration: 380,
        reducedSwipe: 40,
        swipeVelocity: 500,
        // Until a photo reports its size: the camera's 3:4.
        fallbackAspect: 0.75,
      },
      // The thumbnail wheel at the photo's foot (in place of page dots): the
      // views as small photos in the mode's treatment (baked once at `bake` pt
      // on the long edge) round a drum seen from the front. The view in view
      // faces you in the middle, `width` x `height` (3:4), fully lit; each view
      // round the loop is `step` degrees further round a drum `drum` pt in
      // radius, so the neighbours sit drum x sin(step) to each side, turned
      // away by `tilt` of that angle (slightly, so they stay legible), shrunk to `neighbourScale` (`farScale` one further) and dimmed
      // by void at `dim`; past `fadeFrom` views off centre a thumbnail fades
      // out by `fadeTo`. The drum turns with the pager's own swipe (one shared
      // position), so it moves with the finger. Corners `radius` (02's last
      // photo's, scaled), a `rim` pt edge in the mode's rim, a soft `shadow`;
      // a view with something new: a white dot `marked` across with a void
      // `markedRing`. The control is `span` x `slot`, `inset` above the
      // photo's foot; the strip each side of the middle thumbnail
      // ((span - width) / 2, at least ref.hit.min) is the tap target for that
      // neighbour. Reduced motion: no turning, the drum just updates.
      wheel: {
        width: 36,
        height: 48,
        radius: 10,
        rim: 1,
        step: 38,
        drum: 64,
        tilt: 0.6,
        perspective: 320,
        neighbourScale: 0.76,
        farScale: 0.58,
        dim: 0.5,
        fadeFrom: 1,
        fadeTo: 1.6,
        shadow: "0px 3px 10px 0px rgba(0, 0, 0, 0.55)",
        marked: 7,
        markedRing: 1.5,
        span: 124,
        slot: 56,
        inset: 8,
        bake: 144,
      },
      // Hotspot brackets, white on a void halo (02's privacy-note black):
      // `arm` long, `inset` from the target's edge, a `tick` at each side's
      // middle; idle ones rest at `subtle`. Solved ones are textSecondary with
      // a check in a void disc (`seal`); a just-revealed one is drawn `iris`
      // thick; the solve flash is a white `trace`; the reveal thread a dashed
      // white line on its halo.
      brackets: { arm: 10, inset: 1.5, tick: 4, stroke: 1.5, iris: 2.5, halo: 4, haloOpacity: 0.55, subtle: 0.42 },
      seal: { size: 16, icon: 10, inset: 2, fillOpacity: 0.7 },
      trace: { width: 2, radius: 4 },
      thread: { width: 1.5, halo: 4, dash: 4, haloOpacity: 0.55 },
      // The loupe: 02's last-plate frame as a circle (a `well` ring) with a faint inner rim.
      loupe: { ring: 4, rim: 1 },
      // A hotspot's press-in waits this long, so a swipe that starts on one
      // pages without a press (or its haptic); a quick tap still presses.
      hotspotPressDelay: 120,
      // The 1 pt white cue ring (02's, in white): the next code slot.
      cueRing: 1,
      // The tray: four tiles across the content width (ref.space.edge each
      // side, `gap` apart), never narrower than `minTile`; each a square
      // button (raised, ref.radius.square, the square rim), its glyph over its
      // name; empty places are void wells. Chosen: a white `selectedRing` and
      // the glyph's fill weight.
      tray: { columns: 4, gap: 8, minTile: 76, height: 72, padX: 6, padY: 8, icon: 22, selectedRing: 1.5 },
      // 07's cards (raised, 8 corners, 16 padding) for the coach, the failure
      // line, the item in use, the worktable, list rows and the result's
      // text; `padY` for one-line rows; the glyph `icon`; an item's void
      // `well` (ref.radius.knob corners).
      card: { radius: 8, pad: 16, padY: 12, gap: 12, icon: 18, well: 40 },
      // The toast: 02's privacy note (a see-through void pill) at the top of the photo area.
      toast: { top: 12, padX: 12, padY: 8, fillOpacity: 0.6, maxWidth: "86%" },
      // The code pad. Tumbler wheels: vertical pickers in void wells (02's
      // counter pill corners), `rows` rows of `row` each: the digit in the
      // middle row in 02's italic, white; its neighbours above and below in
      // textDim, as the counter's. Dragging rolls the digits (`activeOffset`
      // pt starts it); on release it projects `projection` s of velocity and
      // snaps to the nearest digit on the pager's no-overshoot curve, within
      // min..max ms. Tapping a neighbour steps to it. Fixed slots and the
      // free-text field are void wells; the keypad keys are square buttons. A
      // wrong code: 02's error line (white Warning and words).
      code: {
        wheel: { width: 64, row: 44, rows: 3, activeOffset: 4, projection: 0.12, minDuration: 140, maxDuration: 420 },
        slot: { width: 52, height: 64 },
        key: 56,
        // Three keys to a row, space-between.
        keyWidth: "31.5%",
        input: 64,
        noticeIcon: 14,
        messageMin: 20,
      },
      // The code pad's padlock (ref.motion.juice.latch), drawn in the mode's
      // accent, centred over the code: a `body` with `radius` corners and a
      // `keyhole` in accentInk; a U `shackle` of `bar` pt stock whose legs sit
      // `seat` pt into the body; `room` pt clear above it for the lift. The
      // lit ring round the code stands `ringPad` out at `ring` pt.
      codePad: {
        lock: {
          body: { width: 22, height: 16, radius: 4 },
          keyhole: { width: 3, height: 6, radius: 1.5 },
          shackle: { width: 14, height: 14, bar: 3, seat: 5 },
          room: 9,
        },
        ring: 1.5,
        ringPad: 6,
      },
      // Case closed fits one screen with no scroll at the default text size,
      // down to an iPhone SE (667 tall, 20 safe top), its actions included:
      // the column `inset` from the sides and `pad` from the top and from the
      // actions (whose band starts `actions.pad` above its pill). The case
      // card's parts sit `gap.head` apart (the exit line `gap.exit` under the
      // message; the stats and the rating `gap.card` apart). The case itself
      // takes the column's spare height: noir's folder (compact `pad`, up to
      // `folder.max`), crime scene's accused card (`accused.padY`, up to
      // `accused.max`) or paranormal's room (from `photo.min` to the column's
      // width at `photo.aspect`, `photo.radius` corners, "The presence is
      // gone." on it); what is left is shared above and below. CASE CLOSED
      // keeps `stamp.room` clear above and below for its tilt. The stats are
      // a compact row of 07's cards (`stat` padding, value over label).
      // Large text scrolls.
      // The victory moment (GAME_FEEL_PROMPT.md, 5; src/render/victory.ts):
      // - beat: ms. The case enters over `enter`; a stamp starts its fall at
      //   `slam` (P.stamp.slam ms to impact); paranormal snaps to colour at
      //   `snap`, "The presence is gone." falls at `gone`, then CASE CLOSED at
      //   `goneStamp`. The stats land `statsGap` after the last impact,
      //   `stat` apart (rising `rise` pt); the magnifiers `ratingGap` later,
      //   `magnifier` apart; `solved` then `cta` after the last of them. A
      //   stat that is still loading is waited for up to `wait` past its beat.
      // - reduced: everything fades (motion.reducedFade): the stats at
      //   `stats` (their ticks `tick` apart), the rating at `rating`, the
      //   solved cue and the actions at `solved`. All in under 600 ms.
      // - slam: a falling stamp overshoots to `overshoot` and settles back
      //   over `settle`; its ink spreads from the frame to `inkTo` times its
      //   size, from `inkPeak` to nothing, over `ink`. "The presence is
      //   gone." falls from `goneFrom`. The case card is nudged `nudge.y` pt
      //   down and `nudge.x` across, `nudge.step` ms a beat.
      // - folder: noir's case file, a raised folder with a `tab`, its title
      //   typed on a paper `label`. title: case titles in Playfair.
      // - rating: "Observation" then, `labelGap` along the same line, three
      //   magnifiers `size` across, `gap` apart, `stroke` line art; an earned
      //   one fills its lens at `lens` and pops from `pop`.
      complete: {
        inset: 24,
        pad: 12,
        gap: { head: 8, exit: 4, card: 12 },
        photo: { aspect: 2, radius: 8, min: 96 },
        accused: { padY: 12, max: 260 },
        stamp: { room: 8 },
        stat: { padX: 8, padY: 10, gap: 2 },
        actions: { pad: 12 },
        beat: { enter: 220, slam: 420, snap: 360, gone: 480, goneStamp: 900, statsGap: 300, stat: 180, rise: 10, ratingGap: 240, magnifier: 220, solved: 160, cta: 160, wait: 1200 },
        reduced: { stats: 200, tick: 60, rating: 320, solved: 420 },
        slam: { overshoot: 0.93, settle: 140, inkTo: 1.22, inkPeak: 0.45, ink: 420, goneFrom: 1.45, nudge: { x: 3, y: 5, step: 50 } },
        folder: { radius: 8, pad: 12, max: 220, tabWidth: 120, tabHeight: 12, tabRadius: 6, label: { padX: 14, padY: 6, radius: 2, tilt: -1 } },
        title: { fontFamily: "PlayfairDisplay_700Bold", fontSize: 24, lineHeight: 30 } as const satisfies TextStyle,
        statValue: { fontSize: 20, lineHeight: 24 },
        rating: { size: 28, gap: 12, labelGap: 12, stroke: 2.25, lens: 0.3, pop: 1.35 },
      },
      // ---- The modes in the player (MODES_PROMPT.md, Part 2). Every colour is
      // the mode's (modeThemes, read through useModeTheme); these are shapes and times.
      // A stamp (CONTRADICTED on a suspect card; CASE CLOSED and GUILTY on case
      // closed): the mode's stamp colour, a `border` frame (`borderLarge` for
      // the large ones) with `radius` corners, tilted `tilt` degrees, the
      // frame at `opacity` like ink. The word is always solid: at 11 pt
      // CONTRADICTED needs its full 4.5:1 on a card's raised fill, which any
      // ink fade would take away. A large stamp slams down: from `slamFrom` times its
      // size to rest over `slam` ms after `slamDelay`, and the card under it
      // jolts `jolt` pt. Reduced motion: it fades in.
      stamp: {
        border: 1.5,
        borderLarge: 4,
        radius: 4,
        padX: 6,
        padY: 2,
        padXLarge: 14,
        padYLarge: 4,
        tilt: -6,
        opacity: 0.94,
        slamFrom: 2.2,
        slam: 220,
        slamDelay: 420,
        jolt: 3,
        joltTime: 60,
        // Room above and below a large stamp for its tilt (layout ignores rotation).
        tiltRoom: 16,
      },
      // 1 pt edges: suspect cards, list dividers, the Accuse screen's footer.
      hairline: 1,
      // Crime scene's Suspects square: the count of broken alibis on a
      // stamp-coloured disc (`badge` across) over its top right corner, and
      // the word "Suspects" under it in the meta line's type, `captionGap`
      // below (the title's metaGap), so the control the result sheet names
      // is named on screen too. The square keeps its 44 width in the row (so
      // the title keeps its room); the word is centred under it in a
      // `captionWidth` box that spills into the empty band under the title
      // and Case options, wide enough for the word at twice the text size.
      suspects: { badge: 18, badgeInset: -6, captionGap: 3, captionWidth: 120 },
      // The Accuse screen: radio cards (07's card; picked, a `ring` in the
      // stamp colour and a filled `dot` in the `radio` disc), `rowGap` apart,
      // the three lists `section` apart.
      accuse: { radio: 22, radioRing: 1.5, dot: 10, ring: 2, rowGap: 8, section: 28 },
      // The accusation's reveal: the form dims to `scrim`, the accused card
      // comes forward (from `cardFrom` times its size, `rise` pt low, over
      // `enter` ms), the GUILTY stamp slams; case closed follows after `hold`
      // (`holdReduced` under reduced motion, where it all fades).
      reveal: { scrim: 0.94, cardFrom: 0.9, rise: 28, enter: 360, hold: 2800, holdReduced: 1600 },
      // Paranormal's "the presence": one `segment` per anomaly, `height`
      // tall and `gap` apart, after its label in the header; a segment lights
      // over `rise` ms as its anomaly is found (reduced motion: reducedFade),
      // with a `halo` of the glow where the platform draws coloured shadows.
      presence: { segment: 14, height: 3, gap: 3, labelGap: 8, rise: 600, halo: { opacity: 0.9, radius: 4 } },
      // Paranormal's case closed: the room snaps back to full colour (the
      // treatment's own fade) and "The presence is gone." holds over it, on
      // 02's see-through void pill, for `hold` ms (`holdReduced`).
      gone: { hold: 2800, holdReduced: 1800, padX: 18, padY: 10, fillOpacity: 0.6 },
      // Paranormal hotspot effects, drawn over the photo in the mode's glow
      // and never touchable. Animated on the UI thread (opacity and transform
      // only), one `cycle` ms loop each; reduced motion holds each at `rest`.
      // - flicker: a pool of light `spread` times the target (at least `min`
      //   pt across, so a small object still glows), stuttering between `low`
      //   and `peak`.
      // - apparition: a faint figure, a tall haze (`rx`, `ry` of the target)
      //   under a smaller head (`head` of rx, `headRise` of ry above), drawn
      //   `spread` times the target so it fades out past its edges; it
      //   breathes between `low` and `peak` and drifts `drift` pt up and down.
      // - moved: the object's ghost outline, `dx` / `dy` pt from where it
      //   stands, dashed (`dash`, `stroke`), easing `settle` of the way back.
      // - cold: a frost halo, drawn `spread` times the target: clear to
      //   `inner` of the way out, at `edge` strength by `rim` (about the
      //   target's edge), gone again at the halo's edge.
      // - whisper: two rings (cold white, then the glow) growing steadily from
      //   `from` to `to` times the target's long side as they fade from
      //   `peak`, half a cycle apart.
      effects: {
        flicker: { spread: 1.6, min: 120, low: 0.18, peak: 0.85, rest: 0.5, cycle: 2600, core: 0.75 },
        apparition: { spread: 1.5, rx: 0.36, ry: 0.5, head: 0.42, headRise: 0.78, low: 0.45, peak: 0.95, rest: 0.75, drift: 6, cycle: 4200, core: 0.7 },
        moved: { dx: -8, dy: -6, dash: 5, stroke: 1.5, radius: 6, settle: 0.5, low: 0.35, peak: 0.85, rest: 0.65, cycle: 3400 },
        cold: { spread: 1.3, inner: 0.45, rim: 0.78, edge: 0.45, low: 0.55, peak: 1, rest: 0.8, cycle: 4800 },
        whisper: { stroke: 2, from: 0.25, to: 1.3, peak: 0.9, rest: [0.6, 0.35], cycle: 3000 },
      },
      type: {
        /** A stamp on a card (CONTRADICTED): pushr's grotesk, small and tracked. */
        stamp: { fontFamily: refFont.grotesk, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, textTransform: "uppercase" },
        /** The accusation's GUILTY: Archivo Black, tracked wide. */
        stampLarge: { fontFamily: refFont.crimeDisplay, fontSize: 34, lineHeight: 40, letterSpacing: 4, textTransform: "uppercase" },
        /** Case closed's stamps (CASE CLOSED, GUILTY), sized to its card: Archivo Black, tracked. */
        stampMedium: { fontFamily: refFont.crimeDisplay, fontSize: 28, lineHeight: 32, letterSpacing: 3, textTransform: "uppercase" },
        /** A suspect's name on a card: Bold 18. */
        suspect: { fontSize: 18, lineHeight: 24, fontWeight: "700" },
        /** A count on a badge: Bold 11. */
        badge: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
        /** The presence's label: Semibold 11 caps, tracked. */
        presence: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 1.2, textTransform: "uppercase" },
        /** "The presence is gone.": paranormal's face at reading size. */
        gone: { fontFamily: refFont.paranormalDisplay, fontSize: 26, lineHeight: 32 },
        /** A clue's note and the informant's line: the typewriter at reading size. */
        note: { fontFamily: refFont.typewriter, fontSize: 16, lineHeight: 24 },
        /** A note's small print (a description under the message) and a polaroid's caption. */
        noteSmall: { fontFamily: refFont.typewriter, fontSize: 14, lineHeight: 20 },
        /** An evidence tag's item name. */
        tag: { fontFamily: refFont.typewriterBold, fontSize: 12, lineHeight: 15 },
        /** The tray's stamped lip label (EVIDENCE) and the informant's byline: the mono plate label. */
        plate: { fontFamily: font.mono, fontSize: 10, lineHeight: 14, letterSpacing: 1.6, textTransform: "uppercase" },
        /** The case clock: the mono plate label, tabular figures. */
        clock: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, fontVariant: ["tabular-nums"] },
        /** The matchbook's label: the typewriter, bold. */
        matchbook: { fontFamily: refFont.typewriterBold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4 },
        /** Code digits: 02's counter. */
        digit: { fontFamily: refFont.italic, fontSize: 29, lineHeight: 34, letterSpacing: 1.75 },
        /** Keypad digits: system Medium 24. */
        key: { fontSize: 24, lineHeight: 28, fontWeight: "500" },
        /** Narrative text (a result's message, a quiet result): 07's body, Regular 16/23. */
        body: { fontSize: 16, lineHeight: 23, fontWeight: "400" },
        /** A card's title (an item's name, a list row): 07's card text, Bold 16. */
        card: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
        /** Section headings in sheets: 07's Bold 14. */
        section: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
        /** Hint and detail lines: 07's Regular 14. */
        hint: { fontSize: 14, lineHeight: 20, fontWeight: "400" },
        /** The keypad's Clear key: Semibold 16. */
        action: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
        /** Case closed: the case's name in 02's serif, larger. */
        caseTitle: { fontFamily: refFont.serif, fontSize: 30, lineHeight: 36, letterSpacing: 0 },
        /** Case closed: a stat's value. */
        stat: { fontSize: 22, lineHeight: 28, fontWeight: "600" },
      } as const satisfies Record<string, TextStyle>,
      // A state screen's glyph (offline, can't open), drawn grey by the player.
      stateIcon: 32,
      // ---- The diegetic play screen (GAME_FEEL_PROMPT.md, 4). Materials are
      // per mode (keyed by genre), drawn only on the play screen; text on them
      // keeps 4.5:1 or more (diegetic-test).
      // The evidence tray: a leather tray (`radius`, `pad`) with a stitched
      // seam `stitchInset` in (`stitch` thick, dashed), a lip row (`lip` tall:
      // the stamped EVIDENCE label and the informant's matchbook), and felt
      // wells for the items, each item an object (a tag) sitting in its well.
      evidence: {
        radius: 12,
        pad: 10,
        stitchInset: 4,
        stitch: 1,
        lip: 32,
        well: { radius: 8, edge: 2 },
        // A tag's string hole: `hole` across, `holeInset` from its top left.
        hole: 5,
        holeInset: 6,
        materials: {
          noir: {
            leather: "#1C1712", edge: "#080605", stitch: "rgba(200, 157, 84, 0.55)", well: "#100D0A", wellEdge: "#040302", tag: "#2A231C",
          },
          crime_scene: {
            leather: "#1F1110", edge: "#090505", stitch: "rgba(236, 228, 211, 0.4)", well: "#130A0A", wellEdge: "#050202", tag: "#2E1A18",
          },
          paranormal: {
            leather: "#111A1E", edge: "#05090B", stitch: "rgba(191, 228, 236, 0.45)", well: "#0A1114", wellEdge: "#030607", tag: "#1C292E",
          },
        },
      },
      // Picking up an item: it flies from the hotspot to its tray slot on an
      // arc (`arc` pt above the straight line at its middle) over `flight` ms,
      // shrinking from `from` to the tile's size, then the tile bounces
      // (`bounce` up, then a spring back). Measuring gives up after
      // `measureTimeout` ms and the item simply lands. It lands when the
      // flight's animation reports its end; `landSlack` ms past `flight` it
      // lands anyway. Reduced motion: no flight; the item appears in its slot
      // (the haptic is kept).
      pickup: { flight: 520, arc: 90, from: 1.25, size: 44, bounce: 1.14, bounceUp: 90, spring: { damping: 9, stiffness: 260, mass: 0.6 }, measureTimeout: 160, landSlack: 200 },
      // A clue as an object on the sheet: a note on lined, torn paper (`tear`
      // pt of torn edge, ruled every line, a margin rule `margin` in, tilted
      // `tilt` degrees) and, for an object in the room, a polaroid of it (the
      // photo cropped to the object: `width` across, a `frame` border and a
      // `foot` for its caption, tilted `polaroidTilt`). Item tags (`tagWidth`)
      // say what was pocketed. Below `stackScale` font scale the polaroid sits
      // beside the note; above, it stacks over it. The paper haptic waits
      // `paperDelay` ms after a solve's success haptic, so they never land together.
      clue: {
        pad: 16,
        tear: 6,
        margin: 28,
        rule: 1,
        tilt: -0.8,
        width: 104,
        frame: 6,
        foot: 26,
        polaroidTilt: -3,
        gap: 12,
        stackScale: 1.3,
        paperDelay: 260,
        papers: {
          noir: { paper: "#EAE3D2", ink: "#1A1611", inkMuted: "#574F45", rule: "rgba(26, 22, 17, 0.13)", margin: "rgba(200, 157, 84, 0.7)", frame: "#F1EEE7", shade: "rgba(0, 0, 0, 0.35)" },
          crime_scene: { paper: "#E8E0CF", ink: "#1C1210", inkMuted: "#5B4C46", rule: "rgba(28, 18, 16, 0.13)", margin: "rgba(163, 32, 31, 0.65)", frame: "#EFEAE0", shade: "rgba(0, 0, 0, 0.4)" },
          paranormal: { paper: "#E3EBED", ink: "#0F1C21", inkMuted: "#475A61", rule: "rgba(15, 28, 33, 0.13)", margin: "rgba(110, 160, 172, 0.75)", frame: "#EDF2F3", shade: "rgba(0, 0, 0, 0.35)" },
        },
      },
      // Ask the informant: a silhouette (`figure` across) in a booth panel
      // under a streetlight glow (`glow` opacity), beside his line on a paper
      // slip; the matchbook in the tray's lip (`matchbook` tall, its striker
      // `striker` tall at the foot) opens him.
      informant: { figure: 64, glow: 0.22, matchbook: 32, matchbookPadX: 12, striker: 5, strikerOpacity: 0.35, gap: 12 },
      // The case clock in the header: the mono plate label, once a second.
      clock: { tick: 1000, gap: 8 },
      // The idle glint: after `idle` ms with no touch, each discoverable,
      // unfound hotspot gets a flashlight pulse (a soft pool `spread` times its
      // size, at least `min` pt across), `pulses` times over `pulse` ms each
      // up to `peak`, then it stops until the next idle spell. Reduced motion:
      // a still, faint pool at `rest` until the next touch.
      glint: { idle: 20000, pulses: 2, pulse: 1100, peak: 0.5, rest: 0.16, spread: 1.4, min: 64, stagger: 140 },
      // Presses other than the pills' (proposal; nothing in the references).
      pressedOpacity: 0.75,
    },
    // 07 · Your photos (/capture/review), round 6: the camera's (02) and the
    // photo guide's (04) language, so the three capture screens read as one
    // flow. The header is the camera's (ref.layout.camera edge, top,
    // promptTop and metaGap: a 44 square back button, the serif title over the
    // grey meta line). The column sits at ref.space.edge; the photos are 02's
    // last-photo thumbnail grown into 3:4 tiles (camera.frameAspect: the shot
    // as the viewfinder framed it) in a 2-column grid; the pinned foot is the
    // guide's (its pill in the reading column, ctaBottom over the safe area).
    // Inside a mode every colour is the capture palette's (src/capture/ui/palette.ts).
    review: {
      // Vertical gaps: the header to the first block (the camera's header to
      // its viewfinder), a whole-set note to the lead, the lead to the grid,
      // the grid to the hint, the hint to "Add a photo", the pill to "Before
      // you build", and the column's end over the foot.
      gap: { top: 29, issue: 20, lead: 24, hint: 22, add: 18, section: 44, end: 28 },
      type: {
        /** A photo's numeral, before its name: 02's counter face (Crimson Text Italic), smaller. */
        numeral: { fontFamily: refFont.italic, fontSize: 22, lineHeight: 24, letterSpacing: 0.5 },
        /** A flagged photo's reason under its name, and the open tile's line: Medium 15. */
        reason: { fontSize: 15, lineHeight: 20, fontWeight: "500" },
        /** A tip: Regular 17, a friendly line rather than a rule. */
        tip: { fontSize: 17, lineHeight: 22, fontWeight: "400" },
        /** A tip's numeral in its disc: the counter's italic. */
        tipNumber: { fontFamily: refFont.italic, fontSize: 18, lineHeight: 22, letterSpacing: 0 },
        /** The privacy line and the build helper over the pill: Regular 15. */
        note: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
      } as const satisfies Record<string, TextStyle>,
      // Two columns `gap` apart (170 pt tiles on 393), rows `rowGap` apart;
      // the name `labelGap` under its tile, a reason `reasonGap` under the name.
      grid: { columns: 2, gap: 13, rowGap: 24, labelGap: 10, reasonGap: 2, numeralGap: 8 },
      // A tile is 02's last photo (ref.button.thumbnail) grown: the photo at
      // thumbnail.imageRadius inside a thumbnail.frameWidth frame of the
      // palette's near-black at thumbnail.radius, its 1 pt imageRim over it.
      // A flagged photo: a `flaggedRing` warning ring on the frame's outer
      // edge (where the camera draws its way-on ring). The ×: Phosphor X bold
      // `icon` in white on a `disc` of the palette's well at `fillOpacity`
      // (02's privacy-note black), `inset` in from the photo's corner, on a
      // 44 hit area.
      tile: {
        flaggedRing: 2,
        remove: { disc: 30, icon: 14, weight: "bold", inset: 8, fillOpacity: 0.6 },
        // A slot the player emptied: the tile's shape in a dashed `border`
        // of the tertiary grey (clearly a gap, not a photo), the camera glyph
        // and "Take this photo" `gap` apart.
        open: { border: 1.5, rim: refColor.textTertiary, gap: 10 },
        // Inside a mode, the capture flow's photos (these tiles, the
        // camera's last photo, the build wait's strip) bake the mode's
        // treatment at this long edge (px): a tile is 170 x 227 pt, 681 px
        // tall at 3x. One size for all three, so one bake per photo serves them all.
        bake: 720,
      },
      // The hint row: the tap glyph's box beside its line, `gap` apart.
      note: { icon: 20, gap: 8 },
      // "Add a photo": the guide's ghost pill (52, ref.button.ghost's
      // hairline) in the palette's well, the camera glyph `gap` from its label.
      add: { gap: 10 },
      // The add pill's camera, ESCAPD line art to 07's: 19.7 x 16.7 overall,
      // square corners, a ~1.2 line; a bump `bump` wide and `bodyTop` tall
      // centred on the top edge; a lens `lens` across (outer), its centre
      // `lensY` below the top.
      camera: { width: 19.7, height: 16.7, line: 1.2, bodyTop: 2, bump: 7.3, lens: 9.6, lensY: 8.8 },
      // The retake hint's glyph, ESCAPD line art: a finger pressing inside a
      // rounded-square button, 12.3 x 18 ink, 1 line, round caps. Paths in pt
      // (stroke centres), offset x / y in the `box` glyph box.
      tap: {
        box: 20,
        x: 3,
        y: 1,
        line: 1,
        paths: [
          // The button, open where the finger enters it.
          "M 3.33 6.4 H 3.1 A 1.3 1.3 0 0 1 1.8 5.1 V 1.75 A 1.3 1.3 0 0 1 3.1 0.45 H 6.4 A 1.3 1.3 0 0 1 7.7 1.75 V 5.1 A 1.3 1.3 0 0 1 6.4 6.4 H 5.67",
          // Finger, knuckles, palm and thumb in one outline.
          "M 3.33 11.4 V 4.67 A 1.17 1.17 0 0 1 5.67 4.67 V 8.9 A 1 1 0 0 1 7.67 8.9 A 1 1 0 0 1 9.67 9.2 A 1 1 0 0 1 11.67 10.2 V 13.3 C 11.67 15.2 10.9 16.6 10 17.5 H 3.8 L 0.5 11.4 A 1.15 1.15 0 0 1 2.6 10.4 L 3.33 11.4",
          // The creases between the fingers.
          "M 5.67 8.9 V 9.9 M 7.67 8.9 V 9.9 M 9.67 9.2 V 10.1",
        ],
      },
      // A failure about the whole set: a raised note at the top, `pad` inside,
      // at the camera's nested corners (ref.radius.nested).
      issue: { pad: 18 },
      // "Before you build" (04's step title), the tips `listGap` under it, the
      // privacy line `noteGap` under the tips.
      section: { listGap: 18, noteGap: 22 },
      // The tips, a plain vertical list: a `disc` (raised, its numeral in the
      // counter's italic), the line `discGap` after it, tips `gap` apart.
      tips: { disc: 30, discGap: 12, gap: 14 },
      // The pinned foot (the guide's): `pad` over the helper or the pill, the
      // helper `helperGap` over the pill, and a `fade` of the page colour over
      // the column's last points so the photos slip under it.
      footer: { pad: 12, helperGap: 12, fade: 32 },
      // Flagged photos and their helper: the live warning amber (6.7:1 on ground).
      warning: color.warning,
    },
  },
  // Control feedback and the few movements the reference look adds. Functional
  // game motion (scene crossfade, sheet rise, bracket settle, reduced fade)
  // stays on `motion` above. No decorative or ambient animation.
  motion: {
    // Every press and state colour change.
    control: { duration: 120, easing: "ease-out" },
    // Bottom sheets slide up on a long ease-out with no overshoot (iOS's sheet
    // curve), and slide away on an ease-in. Never a spring: the user found the
    // bounce cheap. Reduced motion: motion.reducedFade, no movement.
    sheetRise: { duration: 380, easing: [0.32, 0.72, 0, 1] },
    sheetFall: { duration: 240, easing: [0.32, 0, 0.67, 0] },
    // 02's shutter disk scales down while pressed; the ring stays still.
    shutterPress: { scale: 0.94, duration: 100, easing: "ease-out" },
    // 02's counter numerals roll to the next shot (proposal).
    counterRoll: { duration: 220, easing: "ease-in-out" },
    // 02's zoom thumb slides under the chosen option (proposal).
    segmentSlide: { duration: 200, easing: "ease-out" },
    // Thinking states: progress, not decoration, so it runs only while a real
    // wait does. Each line holds, then exits up as the next rises in from
    // below; a highlight band about 0.8x the line's width sweeps the glyphs
    // left to right. Reduced motion: lines swap with motion.reducedFade, no
    // movement, no sweep, the line in `still`.
    thinking: {
      hold: 2000,
      swap: 150,
      gap: 50,
      distance: 8,
      easing: "ease-in-out",
      // On dark: the reference greys.
      shimmer: {
        duration: 2000,
        easing: "linear",
        band: 0.8,
        base: refColor.textSecondary,
        highlight: refColor.textPrimary,
        still: refColor.textSecondary,
      },
      // The same sweep on paper (03's sheet).
      shimmerPaper: { base: refColor.inkMuted, highlight: refColor.inkDisplay, still: refColor.inkMuted },
    },
    // A mode photo: the original shows until its baked treatment is ready,
    // then the treatment fades in over it; the same fade takes it away again
    // (paranormal's case closed, back to full colour). Reduced motion: instant.
    treatment: { duration: 240, easing: "ease-out" },
    // "Every tap answers back" (GAME_FEEL_PROMPT.md 1): the physical answer
    // to a press, transforms and opacity only, on the UI thread. Reduced
    // motion keeps every haptic and drops the movement.
    juice: {
      // Press-in squash on every button (usePressSquash, src/components/noir/
      // squash.tsx): down to `scale` over `in`, back to 1 on the `release`
      // spring (about 0.7 of critical damping: a trace of overshoot, settled
      // in about 220 ms). Large panels (a case file row) sink to `panel`,
      // as home's mode cards do (ref.layout.hub.modes.pressScale). Reduced
      // motion: no scale.
      press: {
        scale: 0.96,
        panel: 0.98,
        in: { duration: 90, easing: "ease-out" },
        release: { damping: 22, stiffness: 420, mass: 0.6 },
      },
      // A wrong code: the pad rattles side to side, `distance` pt at the first
      // swing, each later swing a share of it (`swings`), over `duration` ms
      // in all. Reduced motion: no movement; the pad dips to `dim` opacity
      // and back over motion.reducedFade.
      rattle: { duration: 300, distance: 8, swings: [1, -0.8, 0.55, -0.32, 0.14, 0], dim: 0.45 },
      // A correct code: the padlock's shackle springs up `lift` ms (with a
      // `kick` pt overshoot that settles back over `settle` ms), then swings
      // open about its left leg `swing` degrees over `swingTime` ms, while a
      // ring in the mode's accent lights round the code over `glow` ms after
      // `glowDelay`. The flow continues (the scene change or result) after
      // `hold` ms. Reduced motion: the closed lock cross-fades to the open one
      // and the ring fades in over motion.reducedFade, and the flow continues
      // then (under 150 ms).
      latch: { lift: 150, kick: 2, settle: 90, swing: -24, swingTime: 180, glowDelay: 120, glow: 220, hold: 620 },
      // A code wheel settling on a digit runs `overshoot` of a row past it,
      // then seats back over `back` ms: a detent, so a step reads as a
      // mechanical click (one tick per digit). Reduced motion: no roll.
      detent: { overshoot: 0.08, back: 90 },
    },
  },
  // How a mode photo is baked (src/components/noir/treatPhoto.ts): once per
  // photo and mode, on an offscreen Skia surface, never per frame. The
  // strengths per mode are modeThemes[genre].treatment.
  treatment: {
    // Photos are at most 1600 on the long edge (src/capture/fit.ts); a larger
    // source is baked down to this. Encoded as JPEG at `quality`.
    maxEdge: 1600,
    quality: 88,
    // Film grain: one tileable square of fractal noise (`frequency` cycles per
    // pixel, `octaves` layers, fixed `seed`), made grey and stretched `stretch`
    // times about mid-grey, then repeated across the photo with an overlay
    // blend at the mode's grain strength. Baked at full size, so it sits at
    // about one device pixel on a phone-width photo.
    grain: { tile: 256, frequency: 0.75, octaves: 2, seed: 7, stretch: 2.6 },
    // The vignette: a radial gradient from the centre to the corners, clear to
    // `from` of the way out, then black at the mode's vignette strength.
    vignette: { from: 0.5 },
    // Paranormal's soft glow: the graded photo blurred at `scale` of its size
    // (blur `sigma` x the long edge) and screened back over it at the mode's
    // bloom strength.
    bloom: { scale: 0.25, sigma: 0.012 },
  },
} as const;

// ---------------------------------------------------------------------------
// The modes (MODES_PROMPT.md, Part 2). The shell (home, Pro, account) keeps
// the reference look above; the screens inside a mode (its intro, the
// capture flow, the player and its case closed) take that mode's theme, read
// through useModeTheme() in src/game/mode.ts. Colours here are the only mode
// colours: screen code never writes one.
// ---------------------------------------------------------------------------

/**
 * A mode photo's look, baked once per photo (treatPhoto.ts): the colour
 * matrix over its toe, then the grain, then the vignette; `bloom` adds
 * paranormal's glow. Strengths are 0 to 1.
 */
export interface PhotoTreatment {
  /** A 4 x 5 row-major colour matrix (Skia's ColorFilter.MakeMatrix; offsets 0 to 1). Skia clamps its output to 0 to 1. */
  readonly matrix: readonly number[];
  /**
   * The shadow floor under a hard `matrix`, the same shape: each channel keeps
   * whichever of the two is brighter (drawn first, then `matrix` over it with
   * Lighten). Where the grade's contrast would crush the darkest tones to
   * black, the toe keeps them apart; above where the two cross, the grade
   * rules. Null when the grade already keeps its blacks.
   */
  readonly toe: readonly number[] | null;
  readonly grain: number;
  readonly vignette: number;
  readonly bloom: number;
}

export interface ModeTheme {
  /** The mode, or null for the shell's neutral theme. */
  readonly genre: Genre | null;
  /** The mode's name in title case ("Detective Noir"), for labels and screen readers; `display` sets its case on screen. */
  readonly name: string;
  readonly tagline: string;
  /** The screen's ground. */
  readonly ground: `#${string}`;
  /** Panels on the ground: case files, sheets, wells. */
  readonly surface: `#${string}`;
  /** Raised controls: square buttons, chips, rows. */
  readonly raised: `#${string}`;
  /** Primary text and glyphs. 4.5:1 or more on ground, surface and raised (tokens-test). */
  readonly ink: `#${string}`;
  /** Secondary text. 4.5:1 or more on ground, surface and raised. */
  readonly inkMuted: `#${string}`;
  /** The mode's colour as a fill: the primary button, meters, the selected card's edge. Not a text colour (crime scene's red is too dark for text). */
  readonly accent: `#${string}`;
  /** Text and glyphs on `accent`. 4.5:1 or more. */
  readonly accentInk: `#${string}`;
  /** Stamps (OPEN, IN PROGRESS, CLOSED, CONTRADICTED, GUILTY) and any text in the mode's colour. 4.5:1 or more on ground, surface and raised. */
  readonly stamp: `#${string}`;
  /** 1 pt edges and dividers. */
  readonly rim: string;
  /** A soft glow colour (paranormal: the presence meter, the apparition). */
  readonly glow?: `#${string}`;
  /** A tiny accent, used sparingly (crime scene: the police-tape yellow). */
  readonly detail?: `#${string}`;
  /** The mode's name in its display face: family, size, tracking and case. */
  readonly display: TextStyle;
  /** The baked photo look; null in the shell (photos show as they are). */
  readonly treatment: PhotoTreatment | null;
}

/** Rec. 709 luma weights: the grey a desaturated pixel takes. */
const LUMA = [0.2126, 0.7152, 0.0722] as const;

/**
 * A photo grade as one colour matrix. Applied in order: `saturation` (0 is
 * grey, 1 unchanged); `contrast` about `pivot`, plus `offset`; a per-channel
 * `gain`; then a per-channel `lift`, which maps 0 to 1 onto `lift` to 1.
 * Alpha passes through. Black lands on the lift only when the contrast keeps
 * black at 0 (pivot x (1 - contrast) + offset = 0, as paranormal's does). A
 * harder contrast takes black below 0 and Skia clips everything under that
 * to black: pair such a grade with a toe().
 */
function grade({
  saturation = 1,
  contrast = 1,
  pivot = 0.5,
  offset = 0,
  gain = [1, 1, 1],
  lift = [0, 0, 0],
}: {
  saturation?: number;
  contrast?: number;
  pivot?: number;
  offset?: number;
  gain?: readonly [number, number, number];
  lift?: readonly [number, number, number];
}): readonly number[] {
  const rows = [0, 1, 2].flatMap((r) => {
    const scale = (1 - lift[r]) * gain[r];
    const columns = [0, 1, 2].map((c) => scale * contrast * ((1 - saturation) * LUMA[c] + (r === c ? saturation : 0)));
    return [...columns, 0, scale * (pivot * (1 - contrast) + offset) + lift[r]];
  });
  return [...rows, 0, 0, 0, 1, 0];
}

/**
 * A grade's toe (PhotoTreatment.toe) as a colour matrix: after `saturation`
 * (as in grade()), each channel's black lands on `black` and rises `slope`
 * times as fast as the photo. Its offsets are never below 0, so no tone
 * clips: under a hard grade, the darkest tones keep their steps.
 */
function toe({
  saturation = 1,
  black,
  slope,
}: {
  saturation?: number;
  black: readonly [number, number, number];
  slope: readonly [number, number, number];
}): readonly number[] {
  const rows = [0, 1, 2].flatMap((r) => {
    const columns = [0, 1, 2].map((c) => slope[r] * ((1 - saturation) * LUMA[c] + (r === c ? saturation : 0)));
    return [...columns, 0, black[r]];
  });
  return [...rows, 0, 0, 0, 1, 0];
}

/** Every mode's look. Home shows them in this order: noir, crime_scene, paranormal. */
export const modeThemes: Readonly<Record<Genre, ModeTheme>> = {
  // Monochrome with warm brass: the reference look's greys, the live theme's brass.
  noir: {
    genre: "noir",
    name: "Detective Noir",
    tagline: "Solve the case",
    ground: "#0D0D0D",
    surface: "#171717",
    raised: "#222222",
    ink: "#F2EFE9",
    inkMuted: "#A19C93",
    accent: color.accent,
    accentInk: color.onAccent,
    stamp: color.accent,
    rim: "rgba(255, 255, 255, 0.10)",
    display: { fontFamily: refFont.noirDisplay, fontSize: 30, lineHeight: 36, letterSpacing: 1, textTransform: "uppercase" },
    // Grey, a hard contrast pivoted low so dark rooms keep their midtones, heavy grain, a deep vignette.
    // The toe holds black at 9/255 and keeps the shadows' steps (the grade alone clips everything under 0.094 grey).
    treatment: {
      matrix: grade({ saturation: 0, contrast: 1.4, pivot: 0.38, offset: 0.02 }),
      toe: toe({ saturation: 0, black: [0.035, 0.035, 0.035], slope: [0.8, 0.8, 0.8] }),
      grain: 0.14,
      vignette: 0.6,
      bloom: 0,
    },
  },
  // Near-black (warm), blood red, bone white; police-tape yellow only as a detail.
  crime_scene: {
    genre: "crime_scene",
    name: "Crime Scene",
    tagline: "Find the killer",
    ground: "#0E0B0A",
    surface: "#181211",
    raised: "#221917",
    ink: "#ECE4D3",
    inkMuted: "#ACA191",
    // The user's range (#8E1B1B to #A3201F), at its brightest: a fill under bone text (6.5:1).
    accent: "#A3201F",
    accentInk: "#F3EDE1",
    // The same red lifted until stamp text reads at 4.5:1 on every crime-scene ground.
    stamp: "#E2524C",
    rim: "rgba(236, 228, 211, 0.10)",
    detail: "#E9C33B",
    display: { fontFamily: refFont.crimeDisplay, fontSize: 30, lineHeight: 36, letterSpacing: 2.4, textTransform: "uppercase" },
    // Nearly grey, a harsh flash contrast, red pushed into the shadows. The grade alone clips red under
    // 0.09 grey and green and blue under 0.15; the toe sets black at (23, 0, 0) and keeps the shadows'
    // steps in red, with green and blue held low and harsh.
    treatment: {
      matrix: grade({ saturation: 0.15, contrast: 1.55, pivot: 0.43, gain: [1.02, 0.95, 0.93], lift: [0.09, 0.004, 0.004] }),
      toe: toe({ saturation: 0.15, black: [0.09, 0, 0], slope: [0.65, 0.55, 0.55] }),
      grain: 0.12,
      vignette: 0.68,
      bloom: 0,
    },
  },
  // Pale, cold blue-green (ectoplasm) kept grey and between 188° and 200° so it never reads as mint; cold white; a soft glow.
  paranormal: {
    genre: "paranormal",
    name: "Paranormal",
    tagline: "Face the unknown",
    ground: "#0A0E10",
    surface: "#111A1D",
    raised: "#1A2529",
    ink: "#EDF3F5",
    inkMuted: "#93A8AF",
    accent: "#A7C7CE",
    accentInk: "#0A1316",
    stamp: "#B8D7DD",
    rim: "rgba(190, 228, 236, 0.12)",
    glow: "#BFE4EC",
    display: { fontFamily: refFont.paranormalDisplay, fontSize: 32, lineHeight: 38, letterSpacing: 1.6, textTransform: "uppercase" },
    // Cool blue-green, lifted blacks (the grade keeps black on its lift, so no toe), a soft glow, light grain.
    treatment: {
      matrix: grade({ saturation: 0.1, contrast: 1.05, pivot: 0.4, offset: 0.02, gain: [0.8, 0.96, 1], lift: [0.04, 0.09, 0.11] }),
      toe: null,
      grain: 0.07,
      vignette: 0.5,
      bloom: 0.35,
    },
  },
};

/**
 * The shell's neutral theme (no mode): today's reference-look colours, so a
 * screen that reads useModeTheme() outside a mode looks as it did before the
 * modes. Photos stay untreated.
 */
export const shellTheme: ModeTheme = {
  genre: null,
  name: "ESCAPD",
  tagline: "",
  ground: refColor.void,
  surface: refColor.ground,
  raised: refColor.raised,
  ink: refColor.textPrimary,
  inkMuted: refColor.textSecondary,
  accent: refColor.paper,
  accentInk: refColor.ground,
  stamp: refColor.textPrimary,
  rim: refColor.rim,
  display: { fontFamily: refFont.serif, fontSize: 30, lineHeight: 36, letterSpacing: 0 },
  treatment: null,
};
