// ESCAPD design tokens: "The Darkroom Dossier & Brass Mechanism".
// Soot, walnut, and tarnished brass for the instrument. Manila and carbon ink
// for anything the player has to read. Room photos keep their own colour.
import type { TextStyle, ViewStyle } from "react-native";

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

// Noir, the decided identity for the screens in docs/DESIGN.md: near-black
// ground, grey reading text, white statements, and one oxblood signal used
// like a case stamp. Nothing reads these yet; the live theme above is
// unchanged. iOS points on a 393 x 852 iPhone, safe areas 59 / 34.

// Geist and Geist Mono are not installed yet (@expo-google-fonts/geist and
// @expo-google-fonts/geist-mono). Playfair stays for case titles and the escape.
const noirFont = {
  ui: "Geist_400Regular",
  uiMedium: "Geist_500Medium",
  mono: "GeistMono_400Regular",
  monoMedium: "GeistMono_500Medium",
  caseTitle: font.narrative,
  caseTitleItalic: font.narrativeItalic,
} as const;

const noirColor = {
  ground: "#050505",
  panel: "#0E0E0E",
  panelPressed: "#161616",
  hairline: "#222222",
  hairline2: "#303030",
  bright: "#F2F2F2",
  brightPressed: "#D4D4D4",
  read: "#A6A9AD",
  meta: "#8A8D91",
  inverseInk: "#0A0A0A",
  // Used rarely: a selection that matters, solved, case stamps, the escape.
  signal: "#C8302B",
  signalPressed: "#A82823",
  signalText: "#E5484D",
  // Never the signal, and always paired with a label or an icon.
  warning: "#C9A227",
  error: "#B5564F",
  scrim: "rgba(5, 5, 5, 0.72)",
} as const;

export const ref = {
  color: noirColor,
  // Static pools of soft white light on key objects and hero areas. Reading
  // areas stay flat. Each screen sets the centre; radius is in pt.
  light: {
    hero: {
      radius: 220,
      stops: [
        { offset: 0, color: "rgba(242, 242, 242, 0.10)" },
        { offset: 0.5, color: "rgba(242, 242, 242, 0.04)" },
        { offset: 1, color: "rgba(242, 242, 242, 0)" },
      ],
    },
    object: {
      radius: 120,
      stops: [
        { offset: 0, color: "rgba(242, 242, 242, 0.07)" },
        { offset: 0.5, color: "rgba(242, 242, 242, 0.025)" },
        { offset: 1, color: "rgba(242, 242, 242, 0)" },
      ],
    },
  },
  // The background still under 01, 04 and 05 (02 and 03 stay flat ground): a
  // black silk warp rendered offline from @paper-design/shaders-react. Its
  // peak keeps meta text at 4.5:1 anywhere. Not added to assets yet; ship it
  // lossless, since lossy WebP brightens the peak.
  background: {
    asset: "assets/backgrounds/noir-warp-silk.webp",
    peak: "#262626",
  },
  font: noirFont,
  // Large type is regular weight with tight tracking. Mono is for labels, case
  // numbers, dates, codes and short notes, always uppercase and tracked.
  type: {
    escape: { fontFamily: noirFont.caseTitle, fontSize: 40, lineHeight: 44, letterSpacing: -0.4 },
    caseTitle: { fontFamily: noirFont.caseTitle, fontSize: 28, lineHeight: 34, letterSpacing: -0.2 },
    statement: { fontFamily: noirFont.ui, fontSize: 30, lineHeight: 34, letterSpacing: -0.9 },
    title: { fontFamily: noirFont.ui, fontSize: 22, lineHeight: 28, letterSpacing: -0.45 },
    headline: { fontFamily: noirFont.uiMedium, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
    button: { fontFamily: noirFont.uiMedium, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
    body: { fontFamily: noirFont.ui, fontSize: 17, lineHeight: 24 },
    meta: { fontFamily: noirFont.ui, fontSize: 13, lineHeight: 18 },
    label: { fontFamily: noirFont.monoMedium, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
    note: { fontFamily: noirFont.mono, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase" },
    code: { fontFamily: noirFont.monoMedium, fontSize: 28, lineHeight: 34, letterSpacing: 2, fontVariant: ["tabular-nums"] },
  } as const satisfies Record<string, TextStyle>,
  // ctaBottom is added to the bottom safe-area inset.
  space: {
    xs: 4,
    sm: 8,
    md: 12,
    plate: 14,
    lg: 16,
    edge: 20,
    xl: 24,
    band: 28,
    xxl: 32,
    reading: 38,
    ctaBottom: 4,
  },
  radius: {
    panel: 6,
    pill: 999,
  },
  curve,
  border: {
    hairline: 1,
  },
  // Every focusable control gets this outline, following its own shape.
  focus: { width: 2, offset: 2, color: noirColor.bright },
  hit: {
    min: 44,
    comfortable: 48,
  },
  // Pressed states are colour changes over motion.control. Disabled controls
  // drop to disabledOpacity. Only one signal button per screen.
  button: {
    disabledOpacity: 0.4,
    primary: { height: 52, radius: 999, fill: noirColor.bright, pressedFill: noirColor.brightPressed, label: noirColor.inverseInk },
    secondary: { height: 52, radius: 999, fill: noirColor.panel, pressedFill: noirColor.panelPressed, borderWidth: 1, border: noirColor.hairline2, label: noirColor.bright },
    signal: { height: 52, radius: 999, fill: noirColor.signal, pressedFill: noirColor.signalPressed, label: noirColor.bright },
    quiet: { height: 44, padX: 16, label: noirColor.read, pressedLabel: noirColor.bright },
    icon: { size: 44, radius: 999, fill: noirColor.panel, pressedFill: noirColor.panelPressed, borderWidth: 1, border: noirColor.hairline, glyph: noirColor.bright, iconSize: 20 },
    bare: { hit: 44, glyph: noirColor.bright, pressedGlyph: noirColor.read, iconSize: 24 },
    shutter: { ring: 76, ringWidth: 2, ringColor: noirColor.bright, disk: 64, fill: noirColor.bright, pressedFill: noirColor.brightPressed, glyph: noirColor.inverseInk, iconSize: 28 },
    segment: { height: 36, radius: 999, fill: noirColor.panel, borderWidth: 1, border: noirColor.hairline, thumbFill: noirColor.hairline2, active: noirColor.bright, inactive: noirColor.meta },
  },
  // Opaque graphite panels and frames. No glass, blur or coloured glow.
  panel: { fill: noirColor.panel, borderWidth: 1, border: noirColor.hairline, radius: 6 },
  stamp: { height: 24, padX: 8, radius: 6, fill: noirColor.signal, label: noirColor.bright },
  gameCard: { width: 122, height: 209, radius: 6, tagInset: 16, fanTilt: 6 },
  // Brand art, tutorial art and empty states are grayscale line work. The
  // player's own room photos always stay in full colour.
  illustration: {
    stroke: 1.6,
    hero: noirColor.bright,
    mid: noirColor.read,
    back: noirColor.meta,
    context: noirColor.hairline2,
    contextFade: 40,
  },
  // Phosphor regular throughout.
  icon: {
    small: 16,
    header: 20,
    control: 24,
    shutter: 28,
  },
  // Screen geometry from docs/DESIGN.md that no shared token covers, one block
  // per screen. Shared values stay above; these are only the screen's own.
  layout: {
    // 01 · Game mode, the hub at /
    hub: {
      // Header wordmark height (stroke 8/60 x 14 = 1.9).
      wordmarkHeight: 14,
      // The painted glass: a 128 box. Lens centre and radius as fractions of
      // the box, measured on magnifier-1024.png (78.6, 42.4) r 32.3 at 128.
      glass: 128,
      lens: { x: 0.614, y: 0.331, r: 0.252 },
      // Column spacer weights (divider to safe bottom): above and below the
      // glass and below the fan; without the glass, above and below the hero.
      weights: { aboveGlass: 7, belowGlass: 7, belowFan: 50, aboveHero: 23, belowHero: 25 },
      // Fan: container height (y 392-618), side-card centre offset from the
      // axis, side-card drop; it needs this width and text scale or it stacks.
      fan: { height: 226, sideOffset: 105, sideDrop: 10, minWidth: 375, maxFontScale: 1 },
      // Card-local: tag to note, line art box and centre y, busy indicator box
      // (y 170-190, the stamp band).
      card: { noteGap: 6, art: 48, artCentreY: 113, busyTop: 170, busySize: 20 },
      // Stacked cards (large text, narrow screens): minimum height.
      stackedMinHeight: 96,
      // Stacked cards: the text column's cap, 353 - 2 x 16 padding - 48 art - 16 gap.
      stackedTextWidth: 257,
      // How you play: two 56 halves, thumbs inset 3 with a 6 gap (50 x 30).
      segment: { option: 56, thumbInset: 3, thumbGap: 6 },
      // The sheet stops at this share of the screen height and scrolls. It
      // leaves with the live Sheet's slide (ms).
      sheetMaxHeight: 0.64,
      sheetExit: 200,
    },
    // 02 · Camera
    camera: {
      // Header buttons, control-row toggles, counter and thumbnail sit 21 from
      // the screen edges: the measured 20.8-21.2, kept as ref.space.edge + 1
      // so 03's back box matches (x 21-65).
      edge: 21,
      // Clear under the bottom row, above the bottom safe-area inset
      // (852 - 34 - 797.7). On a 0-inset screen the row sits >= 20 above the edge.
      bottomClear: 20.3,
      // Viewfinder: exactly 3:4 (width / height), fitted by containBox. The feed
      // is the sensor's 4:3 held upright (CameraView `ratio`, Android).
      frameAspect: 0.75,
      feedRatio: "4:3",
      // Framing grid: rule of thirds.
      gridDivisions: 3,
      // Corner brackets: 22 arms, 1.5 stroke, inset ref.space.lg. On camera
      // ready they settle in from 6 further out (inset 10) over
      // motion.bracketSettle on this curve, fading in over bracketFade.
      bracketArm: 22,
      bracketStroke: 1.5,
      bracketTravel: 6,
      bracketFade: 200,
      bracketEasing: [0.2, 0, 0, 1],
      // Plate counter and last-plate thumbnail: 72 x 72 windows.
      plateBox: 72,
      // The thumbnail's continue cue from 3 plates: a 2 pt signal ring.
      ringWidth: 2,
      // Lens segment halves: a 100 x 36 track with 46 x 28 thumbs.
      lensOptionWidth: 50,
      // Large text caps, so the 72 window and the 46 thumbs hold.
      counterMaxFontScale: 1.25,
      lensMaxFontScale: 1.25,
      // Busy: the thinking line replaces the subtitle only past this many ms.
      thinkingDelay: 1000,
    },
    // 03 · Camera permission
    permission: {
      // Back arrow box: 02's header icon box exactly (x 21-65, top = safe top
      // + ref.space.sm). 21 is the measured edge, ref.space.edge + 1.
      backLeft: 21,
      // Illustration zone at the top of the sheet: 150 tall, including the
      // sheet's 1 pt top hairline and the 1 pt crop rule at its foot.
      zone: 150,
      // ref.light.object centre (194, 398) with the sheet top at 304: 2.5 left
      // of the screen centre and 94 below the sheet top.
      poolDx: -2.5,
      poolDy: 94,
      // Phone line art, drawn in unrotated phone coordinates and rotated 14 deg
      // clockwise about its top-left corner (142.7, 342): 53.8 left of the
      // screen centre and 38 below the sheet top. Body 134 wide; inner screen
      // inset 16 (sides, top); brackets inset 14 from it with 22 arms; the wall
      // join starts 44 below the inner top edge; ceiling lines 30 long, rising
      // outward at 15 deg.
      phone: {
        cornerDx: -53.8,
        cornerDy: 38,
        rotate: 14,
        width: 134,
        screenInset: 16,
        bracketInset: 14,
        bracketArm: 22,
        wallDrop: 44,
        ceilingAngle: 15,
        ceilingLength: 30,
      },
      // A thinking line shows only once its wait has run past ~1 s (Checking,
      // a single library photo).
      thinkingDelay: 1000,
      // Accessibility focus moves to the title once the sheet has risen, as the
      // live Sheet does (under reduced motion: after motion.reducedFade).
      titleFocusDelay: 300,
    },
    // 04 · First-time photo guide
    guide: {
      // Close sits off the 38 gutter at right inset 34 (as measured); the step
      // stamp ends 15 clear of it, so its max width is width - 131.
      closeRight: 34,
      stampGap: 15,
      // Illustration art box, centred at x 196.5. On 393 x 852 its voids are
      // 151 above (header to art) and 88 below (art to title). Text growth
      // comes out of the 88 first, then the 151; then the box shrinks evenly
      // keeping ref.space.xl clear above and below, and it hides with its
      // pool below minHeight. Ink stays within inkMax.
      art: { width: 240, height: 266, minHeight: 120, above: 151, below: 88, inkMax: 170 },
      // Body's last line to the button top (y 700-762), and the replay status
      // line's box inside it (y 724-742).
      ctaGap: 62,
      statusTop: 24,
      statusBottom: 20,
      // Horizontal swipe: activation and vertical-fail offsets, then the
      // release commit thresholds (pt and pt/s).
      swipe: { activeOffsetX: 16, failOffsetY: 16, commitDistance: 56, commitVelocity: 500 },
      // Replay wait: the thinking line appears only past this many ms.
      thinkingDelay: 1000,
      // Illustration geometry in the art box's own units (it scales with the
      // box): the hero phone and its inner-screen insets (44 x 85.5 screen),
      // the bracket L-shapes, and step 2's phone plan symbols.
      phone: { width: 70, height: 137, screenInsetX: 13, screenInsetTop: 24.5, screenInsetBottom: 27 },
      bracket: { arm: 9, inset: 4 },
      planPhone: { width: 20, height: 40 },
    },
    // 05 · Pro (test paywall)
    pro: {
      // Safe top to the file label's line box (y 85-101): 04's stamp position,
      // centred on 04's Close (safe top + 12, 44 tall).
      labelTop: 26,
      // Loading: the dither appears only if the access check is still running
      // after this many ms, so a faster check shows nothing.
      ditherDelay: 300,
    },
  },
  // Control colour changes only. Functional game motion (scene crossfade,
  // sheet rise, wrong-code shake, solve and escape) stays on `motion` above.
  // No decorative or ambient animation.
  motion: {
    control: { duration: 120, easing: "ease-out" },
    shutterPress: { scale: 0.96, duration: 120, easing: "ease-out" },
    // Thinking states: progress, not decoration, so it runs only while a real
    // wait does (a room developing). Each line holds, then exits up as the
    // next rises in from below; a highlight band about 0.8x the line's width
    // sweeps the glyphs left to right. The web original also blurs during the
    // swap; Noir has no blur. Reduced motion: lines swap with motion.reducedFade,
    // no movement, no sweep, colour read.
    thinking: {
      hold: 2000,
      swap: 150,
      gap: 50,
      distance: 8,
      easing: "ease-in-out",
      shimmer: { duration: 2000, easing: "linear", band: 0.8, base: noirColor.meta, highlight: noirColor.bright },
    },
    // Short waits with no status line: a 4 x 4 Bayer dither dissolve, like a
    // halftone developing. Cells light in Bayer order, each opacity 0.1 to 1
    // over one cycle. Reduced motion: static half-lit pattern.
    dither: { size: 24, grid: 4, gap: 1.2, duration: 1000, easing: "ease-in-out", min: 0.1, max: 1, color: noirColor.bright },
    // The one exception to "no pointer effects": the magnifying glass tilts
    // toward a press-and-drag (max is the full swing, so +/-16 deg) and eases
    // flat on release. Glare is white light clipped to the lens. Reduced
    // motion: no tilt, no glare.
    tilt: {
      perspective: 1000,
      max: 32,
      follow: { duration: 400, easing: [0.22, 1, 0.36, 1] },
      return: { duration: 1000, easing: [0.22, 1, 0.36, 1] },
      glare: {
        opacity: 0.32,
        fade: 300,
        layers: [
          { radius: 95, stops: ["rgba(255, 255, 255, 0.48)", "rgba(255, 255, 255, 0.06)", "rgba(255, 255, 255, 0)"], offsets: [0, 0.52, 0.84] },
          { radius: 200, stops: ["rgba(255, 255, 255, 0.22)", "rgba(255, 255, 255, 0.04)", "rgba(255, 255, 255, 0)"], offsets: [0, 0.58, 0.78] },
          { radius: 360, stops: ["rgba(255, 255, 255, 0.10)", "rgba(255, 255, 255, 0)"], offsets: [0, 0.88] },
        ],
      },
    },
  },
} as const;
