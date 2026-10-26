# ESCAPD design spec: the reference look

> **Direction change (2026-10-25, round 3).** You re-sent the four reference screenshots and asked for them to be followed as closely as possible: colours, type, icons, layout, shadows, gradients, corner radii, layering. **The hub, camera, camera permission, photo guide and Pro now copy their references' look as well as their layout.** The light table (`/capture/review`) takes its layout and details from a fifth reference (Vestiaire Collective's Photos screen). As you asked, it doesn't copy that screen's colours: it uses the camera's dark palette, since it opens straight from the camera. After that you pointed out that the in-game screen and the loading screens were still brass, so they were moved over too: the player and Case closed (08), the darkroom (06) and the shared loading and error screen. Only the account screens (`/account`) still use the round-2 look.
>
> **Round 4 (your feedback on the rebuilt app).** The darkroom metaphor is gone from everything players see: photos, not plates; "Photos", not the light table; "Building your case", not the darkroom; Arabic numerals. The hub header is just the ESCAPD logo, and its chip opens a real Settings sheet. The photo guide shows before every new room. In a case, the photo strip and Explore as list are gone: the photo is full-bleed and swipes edge to edge between views, and the code wheels slide. The review screen's tips are a plain list, with a reassuring privacy line that doesn't mention AI. Bottom sheets slide with no bounce and have 40 pt corners. Haptics run through the whole app. What was reversed from round 2 is listed under **Decisions → Reversed in round 3**.

| # | Screen | Route | Layout and look reference | Your note |
|---|---|---|---|---|
| 01 | Game mode, the hub | `/` | [Opal, game mode](refs/01-game-mode.png) | "3 cards instead of 2." |
| 02 | Camera | `/capture` | [Once, camera](refs/02-camera.png) | "the photo button has a magnifier glass icon on it." |
| 03 | Camera permission | `/capture` (before access) | [pushr, permission sheet](refs/03-camera-permission.png) | none |
| 04 | First-time photo guide | `/capture/guide` | [Apple Health, how-to steps](refs/04-photo-tutorial.png) | "taking photos step by step short tutorial for first onboarding." |
| 05 | Pro (test paywall) | `/pro` | none: built on 03's sheet | none |
| 06 | Building your case (the build wait), and the shared loading and error screen | `/capture/develop`; `StateScreen` everywhere | none: derived from 07, 02 and 01 | "dont forget the thinking states … under the moving magnifine glass" |
| 07 | Light table | `/capture/review` | [Vestiaire Collective, Photos](refs/07-light-table.png) | "you dont have to port over the colors but everything else." |
| 08 | In-game player and Case closed | `/tutorial`, `/play/[roomId]`, `/tutorial/complete` | none: derived from 02, 01 and 07 | "the showing photos actual in game screen and loading screen hasnt been changed to match the new premium look" |

**Where things come from.**
- **Measured from the references:** layout, sizes, type sizes and weights, colours (01–05), gradients, rims, glows, corner radii and layering. Each screen section gives the measurements next to the values used.
- **Never copied:** the other apps' names, logos, copy and icons. Text is ESCAPD's; icons are Phosphor or drawn for ESCAPD.
- **Effects you supplied as web code:** Thinking states, rebuilt for React Native (kit `ThinkingStates`), used under the drifting glass while a case builds. The tilt and the shader background are no longer used.

**Source of truth.** `src/theme/tokens.ts`. The live theme at the top of the file (`color`, `type`, `space`, `radius`, `curve`, `motion`, `hit`) is the round-2 brass look, now used only by the account screens and the live `Button` / `IconButton` / `Sheet` / `Text` components they import. The `ref` export is the reference look. Screen code uses tokens only: no colour, size or font literals. Each screen's own geometry lives in `ref.layout.<screen>`.

**Base:** iPhone 393 × 852 pt, safe areas 59 top and 34 bottom. Tap targets are at least 44 pt, text contrast at least 4.5:1, and reduced motion is respected everywhere.

**Contents:** Global tokens · 01 Game mode · 02 Camera · 03 Camera permission · 04 Photo guide · 05 Pro · 06 Building your case · 07 Review (Photos) · 08 In-game player · Decisions · Needs you · Build notes · Screens with no layout reference yet

## Global tokens (`ref` in src/theme/tokens.ts)

Values are in pt. The comments in `tokens.ts` carry each measurement; this section is the overview.

### Colour

| Role | Token | Value | Where |
|---|---|---|---|
| Black ground | `ref.color.void` | #000000 | 01 and 04's ground; the inset wells |
| Camera ground | `ref.color.ground` | #101010 | 02; 01's round chips |
| Ghost fill | `shade` | #0A0A0A | the ghost pill |
| Rim well | `well` | #070707 | 02's shutter ring and last-photo frame |
| Zoom thumb | `thumb` | #1B1B1B | 02's segment thumb |
| Raised | `raised` | #1E1E1E | 02's square buttons; the black pill on paper; glyphs on paper |
| Paper | `paper` | #FFFFFF | 03 and 05's ground and sheet |
| Panel | `panel` | #F3F5F7 | the illustration panel on 03 and 05 |
| Text | `textPrimary` / `textSecondary` / `textTertiary` | #FFFFFF / #949494 / #5A5A5A | tertiary only for the inactive segment label |
| Ink on paper | `inkDisplay` / `inkMuted` | #000000 / #737373 | 03 and 05's title and body (4.7:1) |
| Hairlines | `rim`, `rimFaint`, `hairline` | white 10 %, white 5 %, #1A1A1A | dividers, tag pills, square buttons, the ghost pill |
| Glass | `glassFill`, `glassDisc`, `specularDark`, `specularLight` | | 01's cards and chips, 04's close disc |
| Hero line | `lineStart` → `lineEnd` | #CEFEB4 → #ADFCF1 | 01's card art (one gradient across each icon) |
| Floor glow | `glowOlive`, `glowTeal` | #243425, #1E342C | 01's floor glow |
| Haze | `ambientCore` | #D4D4D6 | 03 and 05's grey haze |
| Focus | `ref.focus.color` | brass #C89D54 | every focusable control (your round-2 decision, kept) |

### Type

System font (SF Pro on iOS, Roboto on Android) unless a family is named. Every style follows the system text size.

| Token | Font, size/line, weight | Where |
|---|---|---|
| `display` | Archivo ExtraBold 30/36, +1.4, lowercase | 03 and 05's sheet titles |
| `counter` | Crimson Text Italic 29/34, +1.75 | 02's photo counter |
| `serifTitle` | Roboto Serif Regular 17/22 | 02's header title |
| `title` | 22/28 Semibold | 01's screen title |
| `stepTitle` / `stepBody` | 22/28 Bold / Regular | 04 |
| `navTitle` | 16/21 Semibold | 01's header title |
| `ctaLabel` | 20/24 Semibold | the 64 pt black pill |
| `headline` | 17/22 Semibold | ghost and quiet pill labels |
| `subtitle` | 17/22 Medium | 01's subtitle |
| `body` | 17/22 Medium | 03 and 05's sheet body |
| `meta`, `label`, `tag` | 13/16 Regular, Semibold, Semibold +0.4 uppercase | 02's meta and segment; 01's card tags |

Fonts loaded in `app/_layout.tsx`: Roboto Serif 400, Crimson Text 400 Italic and Archivo 800 for the reference look, plus Playfair, Plus Jakarta Sans and JetBrains Mono for the live theme. Geist was removed.

### Shape, space and depth

- **Corners** are continuous (`ref.curve`) except the small tag pills: `tag` 8, `knob` 12, `square` 14, `sheet` 16, `nested` 20, `frame` 24, `viewfinder` 40, `bottomSheet` 40 (every bottom sheet's top corners, matching the camera's viewfinder; the Close chip sits concentric with the corner, 22 in), `round` 999. 01's game cards scale their radius with their width (`button.gameCard.radiusRatio`).
- **Shared spacing:** `ref.space` (`xs` 4 … `reading` 38, `ctaBottom` 4 above the bottom safe area). Anything used by one screen only is in its `ref.layout` block.
- **Depth** is steps in lightness, never drop shadows or blur. The one glow is 02's shutter halo (`ref.effect.shutterGlow`, white 20 % above the ring).

### Gradients (`ref.gradient`)

Every stop is a plain hex colour plus a separate opacity: react-native-svg ignores the alpha inside an rgba() stop colour and paints it solid. The `GradientStop` type enforces this, and `src/components/noir/__tests__/gradient-stops-test.tsx` checks every gradient and scans the source for rgba stops.

| Gradient | What it draws |
|---|---|
| `bottomGlow` | 01's floor glow rising from the bottom edge (kit `FloorGlow`); the hub moves its fade up with the card fan |
| `card`, `cardRim` | 01's game-card glass and its 1 pt rim, fading out down the card |
| `divider` | 01's hairline under the header, brightest in the middle |
| `line` | 01's hero line art |
| `shutterDisk`, `shutterDiskPressed` | 02's shutter disk, 210° |
| `deviceFill` | the fill inside 04's phone drawings |
| `haze` | 03 and 05's grey haze over paper (kit `PaperHaze`): off-centre radial, paper fading in over its foot |

### Buttons (`ref.button`)

- **Pills** (kit `PillButton`):
  - **primary**: pushr's black pill on paper, 64 tall, full width, `ctaLabel`.
  - **ghost**: Apple Health's dark pill on black, 52 tall, 1 pt hairline.
  - **quiet**: text only, 48 tall, grey on paper and darkening when pressed, or white on dark.
- **Chrome:**
  - **square**: 02's 44 pt square buttons, radius 14.
  - **chip**: 01's 36 pt round chips with a diagonal specular ring.
  - **bare**: a glyph with no container.
  - **dismissGlass**: 04's grey glass close disc.
- **Camera:**
  - **shutter**: a 75 ring around a 67 disk, carrying the magnifier.
  - **segment**: the 100 × 40 zoom switch.
  - **thumbnail**: the 72 last-photo frame.
- **gameCard**: 01's card proportions.

Pressed states are proposals, because the screenshots show none: pills change colour over `ref.motion.control` (120 ms), and the other controls dim to 0.75. Dark screens with one strong action use the light table's white bar (48 tall, radius 2): the light table, the darkroom, the loading and error screen and the player. The live 8 pt `Button` is left only on the account screens.

### Icons

Phosphor regular. Chrome glyphs are 18–26 pt (`ref.icon`). 04's line drawings use a 1.75 pt stroke. 01's hero art scales its stroke with its size (`heroStrokeRatio`).

### Motion (`ref.motion`)

- **Presses:** `control` 120 ms ease-out for every press; `shutterPress` 0.94 over 100 ms.
- **Camera:** `counterRoll` 220 ms and `segmentSlide` 200 ms.
- **Bottom sheets:** `sheetRise` slides them up over 380 ms on a long ease-out with no overshoot (cubic-bezier 0.32, 0.72, 0, 1), and `sheetFall` slides them away over 240 ms on an ease-in. They are never sprung: you found the old bounce cheap. Kit helpers: `sheetEntering`, `sheetExiting`, `sheetRiseTiming`.
- **Thinking states** (`thinking`): a line holds, exits up as the next rises in, and a highlight band about 0.8× the line's width sweeps it. It runs only during a real wait. Under reduced motion the lines swap with a fade and nothing moves.
- **The glass while a case builds:** its drift is in `ref.layout.develop`.
- **Photo pager and code wheels (08):** follow the finger and settle on a no-overshoot ease-out, sized to the release speed (`ref.layout.play.pager`, `code.wheel`).
- Nothing else animates.

### Haptics (`src/game/feedback.ts`)

One vocabulary for the whole app. It follows Settings → Haptics and does nothing on the web.

| Call | Feel | Used for |
|---|---|---|
| `tick` | selection | a code-wheel digit, a photo page settling, a toggle, the lens segment, a guide step, each photo sent |
| `press` | light impact | buttons, chips, cards, tiles, hotspots; every `PillButton` and StateScreen button by default |
| `thud` | medium impact | the shutter, "Build the case", "Open the case" |
| `success` / `warning` / `error` | notification | an item found, a lock opening, an escape, a case ready / a use that doesn't work, a failed build / a wrong code, a failed shot |

There is one haptic per moment, never stacked, and only on discrete events. Under Jest, `jest/setup.js` mocks the module with every key.

### Focus and accessibility

- **Focus ring:** every focusable control draws the brass ring (2 pt, 2 pt out) in its own shape (kit `FocusRing` / `useFocusRing`). On the web it shows only for keyboard focus (`:focus-visible`), so a tap or click never leaves it on.
- **Decorative layers** (glows, haze, art) are hidden from screen readers and never take touches.

### Kit (`src/components/noir`)

`PillButton`, `DarkSheet` (the bottom sheet from the hub, used by the player), `FocusRing` / `useFocusRing` / `focusRingStyle`, `FloorGlow`, `LightPool(s)`, `PaperHaze`, `ThinkingStates`, `GlyphStack`, `gradientStops` / `gradientLine`, `trackingPad`, `useShowAfter` and the motion helpers. `BackgroundStill` (the silk) was removed; its asset stays in `assets/backgrounds`.

## 01 · Game mode (the hub at /)

Reference: docs/refs/01-game-mode.png (Opal, "Pick a game to continue"), measured at 2.389 px/pt on a 393 × 852 pt screen (safe areas 59 / 34); the Mobbin footer from y 2033 px is not part of the design. This round matches it as closely as the platform allows: the black ground with the green-teal floor glow, the header of round dark chips with the diagonal specular ring, the centred title with a small image before it, the faint gradient divider, the large empty band, the centred Semibold title and grey subtitle, the tilted dark-glass cards with fading rims, hairline label pills and gradient line icons, the spacing and the z-order. ESCAPD keeps its own copy, icons, three cards (the user's note) and every behaviour.

Route: `app/index.tsx` (`/`) re-exports `src/screens/hub/HubScreen.tsx`. Files: `HubScreen.tsx` (ground, header, divider, column, routing, notice slot, sheet, focus return, Android back), `Chip.tsx` (Opal's round chip, for Settings and the sheet's Close, and the three-rail sliders glyph), `Deck.tsx` (fan, stack, fan focus ring), `GameCard.tsx` (card layout, states, press), `CardGlass.tsx` (the card material), `TagPill.tsx` (label pills, SOLVED included), `CardArt.tsx` (the three gradient line icons), `CardNote.tsx` (state line and the developing thinking line), `HubNotice.tsx`, `SettingsSheet.tsx`, `layout.ts` (geometry rules: the band, the fan's position, the glow), `caseStatus.ts` (every word and state), `useHubData.ts` (fetch and follow). Tests: `src/screens/hub/__tests__/hub-test.tsx`, `layout-test.tsx`. The painted glass hero and its tilt (`Magnifier.tsx`) are gone.

Tokens: `ref` in `src/theme/tokens.ts` throughout (`ref.color`, `ref.type`, `ref.space`, `ref.radius`, `ref.curve`, `ref.gradient.bottomGlow / card / cardRim / divider / line`, `ref.button.chip / dismissDark / gameCard / ghost / disabledOpacity`, `ref.icon`, `ref.effect.secondaryLineOpacity`, `ref.focus`, `ref.motion.control` and `thinking`), the live `motion.sheetSpring` / `motion.reducedFade` and `z.sheet`, and the hub's own `ref.layout.hub`: `hairline` 1; `header` { top 12, mark 20, markGap 6 }; `chipRing` (white 0 / 10.5 / 15 / 10.5 / 0 % at 0.146 / 0.25 / 0.5 / 0.75 / 0.854 from the chip's top right to its bottom left); `sliders` { width 13, stroke 1.2, pitch 3.96, knob 3.8, knobs 0.73 / 0.41 / 0.7 }; `weights` { above 131, below 96 }; `band` 124; `glass` { overlap 0.02, falloff 0.18 }; `fan` { height 335, sideOffset 93.2, sideDrop 10, tilt 6, cover { top 29.85, foot 63.49 }, designWidth 393, minScale 0.75, maxFontScale 1 }; `card` { width 140, height 320, tagTop 24, noteGap 6, icon 68, iconCentre 0.54, solvedCentre 0.74, pressScale 0.97 }; `stackedMinHeight` 96; `noticeIcon` 16; `sheet` { scrim black 55 %, maxHeight 64 %, exit 200, scrimIn 200, scrimOut 160, titleFocus 300, titleFocusReduced 50, focusMargin 100, switch { on `lineEnd`, off `textTertiary`, thumb `textPrimary` } }. No live colour, type, space or radius; no silk, grain, wordmark, walnut or brass (the focus ring excepted).

### Feel

A quiet black room with a low green light coming up from the floor. The top half is pure black and empty: a header of two round dark chips' worth of space, a small brass magnifier beside "Case files", a divider that is only a breath of light, then a long dark band. Below it the title and a grey line, and three dark-glass files dealt onto the desk, the middle one upright on top and the other two tipped out to either side. The glow rises through the lower halves of the cards. There are no shadows: every edge is a white hairline at 8–14 %, and hierarchy comes from weight and white opacity (100 / 82 / 60 %), not from hue. Bright colour is kept to two small places: the painted brass magnifier in the header and the pale lime-to-aqua line icons, which read as glowing only because they are the brightest thing on near-black. Nothing moves unless something is happening.

**Accent on this screen:** the line icons' gradient (`ref.color.lineStart` #CEFEB4 to `lineEnd` #ADFCF1) and the Show interactives track (`lineEnd`). Brass only in the painted magnifier (art, not accent) and the focus ring.

### Layout, top to bottom

393 × 852, default text size, all three cards idle (the harness is offline, so YOUR CASE shows None yet). Measured positions of the web render (Inter in place of SF Pro) against the reference are in brackets.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Root `ref.color.void` #000000, then the kit's `<FloorGlow glow={fanGlow(...)} />`: `ref.gradient.bottomGlow`'s colours (#141C12 → `glowOlive` #243425 at 0.25–0.43 → #213529 → `glowTeal` #1E342C at 0.56–0.69 → #111B19, left to right), fitted to the fan as Opal's is: nothing above the cards' centre (y 490, 0.575 of the height), full by the fan's foot (y 665, 0.78), which is the token's own 0.58 / 0.79 on 852. Scaled fans follow their smaller hand; stacked cards keep the token. Static, untouchable, hidden. No grain [render: x 5 at y 520 / 640 / 720 #030503 / #121910 / #141D13 against Opal's #050505 / #0F170E / #141C12; y 730 at x 100 / 197 / 293 #243425 / #203429 / #1B2F28 against #243425 / #213529 / #1E3229] | — |
| Status bar | y 0–59 | System, light content (root layout) | — |
| Header row | Hit boxes y 65–113 (48), padX 10 (`ref.space.lg` 16 − the chip's 6 of padding) | A row: left slot, title group, right chip | — |
| Left slot | x 10–58 (48 × 48), empty, not focusable | Opal's dismiss chevron is left out: the hub is the root and has nothing to dismiss to. Its place keeps the title centred | — |
| Logo | Centred on x 196.5 between the two 48 slots, vertically centred on the chips (y 89): the wordmark 14 tall (`header.logo`; its letters' full height, a little over Opal's 16 pt title cap 11.3), 66.3 wide | `<Wordmark>` (src/components/Wordmark.tsx, unchanged) with `tint` `ref.color.textPrimary` (white) and `edgeColor` `ref.color.textSecondary` (the D's doorway edge grey: no brass). Wrapped in one accessible View, `accessibilityRole="header"`, label "ESCAPD" | The ESCAPD wordmark (no magnifier, no "Case files", as the user asked) |
| Settings chip | Disc x 341–377, y 71–107 (36, `ref.button.chip`), centre (359, 89); hit box x 335–383, y 65–113 [ref 340.7–377.1 × 70.7–107.1; render 341–377 × 71–107] | Fill `ref.color.ground` #101010; 1 pt ring drawn in react-native-svg with `chipRing`, a gradient from the disc's top right to its bottom left with stops at 0.146 / 0.25 / 0.5 / 0.75 / 0.854 (white 0 / 10.5 / 15 / 10.5 / 0 %): on a circle the line spans only 0.146–0.854, so nothing at 45° / 225°, 10.5 % at the cardinals, 15 % on the top-left and bottom-right arcs (Opal 0.15 / 0.13). No shadow. Glyph: ESCAPD's three-rail sliders (`SlidersGlyph`, `ref.layout.hub.sliders`) in the 18 box: rails 13 wide, stroke 1.2, 3.96 apart, ring knobs 3.8 across at 73 / 41 / 70 % along, round caps, `textPrimary` (Opal: 13 × 11.3) | Opens Settings |
| Divider | y 123–124 (1), full width; `ref.space.lg` 16 below the discs [ref 122.6–123.6] | `ref.gradient.divider`, 90°: white 0 at 0.10 → 10 % at 0.50 → 0 at 0.94, as a react-native-svg gradient (stops `stopColor` + `stopOpacity`) [render #101010 at x 196, #060606 at x 100] | — |
| Column | y 124–818 (694): the divider to the safe bottom. Opal's X disc is left out and no slot is kept for it | A flex column: the top spacer (131 : 96 of the free space, never more than `band` 124), the hero block, the bottom spacer (the rest) | — |
| Upper void | y 124–248 (124, `ref.layout.hub.band`: Opal's band from the divider to the title box) [Opal divider to title cap 131.2; render 129.7] | Black | — |
| Title | Line box y 248–276, centred, padX 20 [Opal cap 254.6, baseline 270.1; render cap 253.7, baseline 270.3] | `ref.type.title` (system Semibold 22/28), `textPrimary`, `accessibilityRole="header"` | **"Choose a case"** |
| Subtitle | Line box y 280–302, `ref.space.xs` 4 below the title [Opal baseline 297.2; render 297.3] | `ref.type.subtitle` (system Medium 17/22), `textSecondaryAlpha` (white 60 %, #999999 on black; Opal ≈ #9C) | **"Three files on the desk."** |
| Fan container | y 330–665 (335, `fan.height`, the side cards' visual foot), `ref.space.band` 28 below the subtitle; never clips. Visual extent x 19.3–373.7, Opal's band [Opal 19.3–373.8, y 329.4–658; render top 330, centre card foot 650, side feet about 663] | — | 3 cards, dealt like a hand |
| Card, centre | x 126.5–266.5, y 330–650 (140 × 320: Opal's height 319.6; the widest that still shows a side card's pill whole), upright, in front (`zIndex`) | Card material below | **YOUR ROOM** |
| Card, left | Centre (103.3, 500): `fan.sideOffset` 93.2 left of the axis, `fan.sideDrop` 10 lower, `rotate: -6deg` (`fan.tilt`) about its centre; tucked behind the centre card, which covers its inner edge 29.9 wide at the top and 63.5 at the foot (`fan.cover`): about 105 of it shows at the pill, 89 at the icon | Same | **THE STUDY** |
| Card, right | Centre (289.7, 500), `rotate: 6deg`, the mirror | Same | **YOUR CASE** |
| Card material | Each card | `CardGlass`: opaque `ref.gradient.card` (180°: #0A0A0A → #0F0F0F 0.31 → #141513 0.50 → #283628) with a 1 pt `ref.gradient.cardRim` (Opal's measured rim: white 5 % at the top, 2.5 % at 0.15, 2 % at 0.5, 0 by 0.85, so the foot has none), corners 23.7 (`gameCard.radiusRatio` 0.169 × 140) continuous, clipped by views (the rim is the 1 pt between an outer and an inner clip). Opaque, so the centre card hides the side cards' rims, as in the reference. See-through in look (Opal's z-stack): the centre card is white 2 % (`glass.overlap`) brighter where it lies over a side card (the side cards' rotated outlines drawn in its own space, clipped by it), and each side card darkens from black 0 at its inner edge to 18 % (`glass.falloff`) at its outer edge, as the floor light falls off. No shadow | — |
| Tag pill | Card-local top 24 (`card.tagTop`, Opal's 24), 26 tall (`tagHeight`), 9 from the outer edge to the text (`tagPadX`, the stroke included), width hugging the text: Opal's absolute size | `TagPill`: no fill, 1 pt `ref.color.rim` (white 10 %), radius `ref.radius.tag` 8 (not continuous); text `ref.type.tag` (system Semibold 13/16, +0.4, uppercase) in `textLabel` (white 82 %), centred (`trackingPad` on iOS) | THE STUDY · YOUR ROOM · YOUR CASE |
| State line | Card-local y 56–72, `card.noteGap` 6 under the pill | `ref.type.meta` (system Regular 13/16), `textSecondary`, centred. Developing: the kit's thinking line (States) | Study: Unseal / Continue / Replay. Room: Photograph. Case: Case status |
| Hero icon | 68 × 68 (`card.icon`, `ref.icon.heroMax`), centred at card-local y 172.8 (`card.iconCentre` 54 %, as Opal's); ink about 62 [Opal's art 62–68; render 61.7 × 61.7 on the centre card] | `CardArt`: ESCAPD's own line art in react-native-svg, drawn in a 48-unit box it nearly fills, stroke 4.9 at 68 (`heroStrokeRatio` 0.072, Opal's 4.9), round caps and joins, no fill, one `ref.gradient.line` across the whole box (135°, lime → aqua); secondary strokes at `ref.effect.secondaryLineOpacity` 0.6. No halo. Rotates with its card. Stacked cards show it at 48 | Study: an arched door on its threshold (primary) with a keyhole (secondary). Room: four viewfinder corner brackets (primary) round a room corner, one vertical edge and two diverging floor lines (secondary). Case: a dossier folder with its tab (primary) and a wax-seal circle (secondary) |
| SOLVED pill (YOUR CASE only) | Centred at card-local y 236.8 (`card.solvedCentre` 74 %), 26 tall | `TagPill`, the same as the tag: a label pill in the reference style, not a stamp | **SOLVED**, when the latest session on the newest own case is completed |
| Side-card centring | Each block (the pill with its state line, the icon, SOLVED) is centred on the face the centre card leaves exposed at the block's middle: inset on the covered side by `coveredWidth(v)` = 29.85 + 33.64 × v / 320 (34.5 for the head, 48.0 for the icon, 54.8 for SOLVED). The centre card's blocks are centred on the card | YOUR CASE's pill (97 with Inter, about 92 with SF) fits the 105 exposed at its height |
| Lower void | y 665–818 (153, the rest of the column) | Floor glow only (Opal's X disc is left out) | The notice overlays it |
| Notice (when shown) | Top y 689 (`ref.space.xl` 24 below the fan container), centred, hugging its text; one line 34 tall | A capsule: `ref.color.ground`, 1 pt `ref.color.rim`, `ref.radius.round`, padding 8 × 16; Phosphor glyph at 16 (`noticeIcon`) in `textPrimary`, centred on the first line; gap 8; text `ref.type.meta` in `textPrimary`. Absolutely placed in an always-mounted slot, so nothing moves | States: Error |
| Safe bottom | y 818–852 | Glow | — |
| **Settings sheet** (over everything) | Scrim full screen. The kit's `DarkSheet`, `maxHeight` 88 % (`settings.maxHeight`); at the default size it holds everything without scrolling (top at y 408 on 852) | The kit's dark sheet: fill `ref.color.ground`, top corners `ref.radius.bottomSheet` 40, a 1 pt rim, black 55 % scrim; slides up on `ref.motion.sheetRise` with no spring and away on `sheetFall`; Close (the kit's chip) concentric with the corner | — |
| Sheet: header | Title on the 24 gutter; Close's disc centred on the 40 corner's centre of curvature | Title `ref.type.headline`, `accessibilityRole="header"`. A save that fails shows its note as the sheet's grey meta line under the title (announced) | **"Settings"** · X |
| Sheet: sections | Content padX 24, sections 24 apart; each a Bold 14/20 heading (`settings.heading`, `textPrimary`, header role) 8 (`settings.headingGap`) above its group | The review screen's list style: a group is a `ref.color.raised` panel (`settings.fill`) with 8 corners (`settings.radius`, continuous); rows at least 52 tall (`settings.rowHeight`), 16 in (`settings.pad`), label and control 12 apart (`settings.gap`), split by 1 pt `ref.color.rim` lines inset 16 from the left. Label `ref.type.body` white; a detail line `ref.type.meta` grey under it; a value `ref.type.body` grey on the right; a navigation row ends in Phosphor `CaretRight` 15 grey. Pressed rows at 0.75 (proposal) | Gameplay · Accessibility · Account · About |
| Sheet: rows | Gameplay: Show interactives, Haptics. Accessibility: Reduce motion. Account: Add your email (a guest or no session) or Email (signed in, plain value); ESCAPD Pro. About: Version | Switch rows: a React Native `Switch` (track on `lineEnd` aqua, off `textTertiary`, thumb white) that only shows the value; the row is the control | "Show interactives" / "Keep the marks on objects you can use visible." · "Haptics" / "A light tap when you press or find something." · "Reduce motion" / "Fades in place of slides and sweeps." · "Add your email" or "Email  ada@…" · "ESCAPD Pro" · "Version  0.1.0" |
| Sheet: bottom | content 8 + `ref.space.lg` 16 + the safe bottom | — | — |

**Totals on 852:** safe top 0–59; chip row 65–113 (discs 71–107); divider 123–124; column 124–818 = band 124 + title 28 + 4 + subtitle 22 + 28 + fan 335 + lower void 153; safe bottom 818–852. Header 65 = 12 + 36 + 16 + 1. The top spacer takes 131 / 227 of the free space but never more than 124. The fan is designed on 393; a narrower screen scales the whole hand by width / 393, and a short one by what its column leaves for it (`fanScale`), its top kept and nothing clipped; below 0.75 the cards stack. 375 × 667: 0.954 (foot at y 587 with safe areas 59 / 34).

### Tappable elements

| Element | Hit area ≥ 44 | Action in ESCAPD |
|---|---|---|
| Settings chip | 48 × 48 box around the 36 disc (x 335–383, y 65–113), inside the header, no hitSlop | Opens Settings. Role button, label "Settings". The `press` haptic on press-in. Pressed opacity 0.75; disabled 0.4 while a card is busy |
| THE STUDY card | Its exposed face (the centre card takes 5.8–27.7 of its inner edge) | `ensureSession()` (card busy), then `router.push('/tutorial')` (start_or_resume_session resumes or starts). The state line comes from `getLatestSession(TUTORIAL_ROOM_ID)`: none or abandoned Unseal, active Continue, completed Replay. Labels "The Study. Unseal / Continue / Replay the first case." A failure shows the notice |
| YOUR ROOM card | Full 140 × 320 (in front) | Access check first (card busy): `openCapture()` sends a guest to `/account?next=back`, no `custom_rooms` to `/pro`, the monthly cap to `/capture/develop?from=hub`, a first-timer to `/capture/guide`, otherwise `/capture`. If the check can't run it rejects and the card carries on to `/capture`. Label "Your room. Photograph a room." |
| YOUR CASE card | Its exposed face | From `getLatestCustomRoom()` (drafts count as no room) and, for a ready room, `getLatestSession(room.id)`. Ready → `/play/<id>`; developing or failed → `/capture/develop?roomId=<id>`; none, offline, try later: disabled. One element, "Your case." plus the state |
| Sheet scrim | Above the sheet | Closes the sheet. Not focusable |
| Sheet Close | The kit's chip, 48 box | Closes the sheet (the kit's `press` haptic); focus returns to the Settings chip once it has left (`ref.motion.sheetFall` + 100). Label "Close" |
| Switch rows (Show interactives, Haptics, Reduce motion) | The whole row, at least 52 tall | One accessible element each: role switch, its label, the detail as hint, `checked` state; a press flips it with the `tick` haptic (Haptics: one tick just after it turns on, none as it turns off). Show interactives is local (`setHotspotAssist`). Haptics and Reduce motion save to the account (`ensureSession()` first, then `usePreferences().update`): the new value shows at once; if saving fails it flips back and the grey note says "Couldn't save that while offline. It's back as it was." (or "…just now…") |
| Add your email · ESCAPD Pro | The whole row, at least 52 tall | Buttons with a chevron and the `press` haptic: the sheet closes (no focus return), then `/account?next=back` or `/pro`. A signed-in player's email is a plain value, not a control. The guide replay is gone: the guide shows before every new room |
| Android back | — | Sheet open → closes it. A card busy → consumed until navigation or the notice. Otherwise not handled: the system leaves the app (root) |
| Not tappable | — | Left slot, the ESCAPD logo, divider, title, subtitle, pills, state lines, icons, SOLVED, notice. Each card is one button; its children are not separately focusable |
| Focus order | — | Screen reader: ESCAPD (header) → Settings → "Choose a case" (header) → subtitle → THE STUDY → YOUR ROOM → YOUR CASE → notice. The centre card is stacked with `zIndex`, not render order. Keyboard: Settings → the three cards. Sheet open: title → Close → Gameplay → Show interactives → Haptics → Accessibility → Reduce motion → Account → Add your email → ESCAPD Pro → About → Version; VoiceOver is trapped (`accessibilityViewIsModal`); the screen behind is `no-hide-descendants` for TalkBack; the sheet moves focus to its title 300 ms after opening (50 under reduced motion) |

### States

- **Appear:** no entry animation; the root Stack's fade. Rendered at once with THE STUDY "Unseal" and YOUR ROOM "Photograph".
- **Loading (focus fetch):** YOUR CASE keeps its state line blank (a non-breaking space in the meta line), ignores taps, is not dimmed, and reads "Your case. Loading." with `{ busy: true, disabled: true }`. The fetch runs on every focus and only with a stored session (never creating a guest to label a card). No session → None yet.
- **Building (queued or generating):** the state line is the kit's `ThinkingStates variant="meta" decorative`: "Building" in `ref.type.meta`, the shimmer sweeping from `textSecondary` to `textPrimary` and back (`ref.motion.thinking.shimmer`), repeating while the room develops. Hidden from accessibility (the card says "Your case. Developing."). While it shows and the hub has focus the room is followed with `watchRoom` plus a 5 s poll; a flip to ready (Open) or failed (See why) stops the shimmer at once and is announced ("Your case is ready." / "Your case didn't build. Open it to see why.") only when seen while the hub is open.
- **Pressed (card):** white `glassFill` (3.5 %) eases in over the whole card and it settles to 0.97 (`card.pressScale`), both over `ref.motion.control` (120 ms ease-out); a selection haptic on press-in. Reduced motion: the overlay only, no scale. **Chips:** opacity 0.75. **Ghost pill:** the kit's colour cross-fade. **Switch:** native.
- **Busy (THE STUDY or YOUR ROOM tapped):** the tapped card's state line becomes a small native `ActivityIndicator` in `textLabel`, centred in the line; the card stays at full strength, ignores taps and reads `{ busy: true, disabled: true }`, keeping focus. The other two cards go to 0.45 (`disabledOpacity.pill`) and the chip to 0.4, all disabled until navigation or the notice. A dimmed centre card keeps an opaque `void` underlay, so the side cards don't show through.
- **Disabled (YOUR CASE: no room or a draft, no session, offline, try later):** glass, pills and icon at 0.45 as one layer; the state line explains why and stays at full strength; with no room, hint "Photograph a room first."
- **Case status:**

  | Case status | State line | Pill | Card label |
  |---|---|---|---|
  | Ready, never played, or the latest session abandoned | Open | — | "Your case. Open the case." |
  | Ready, in progress | Continue | — | "Your case. Continue the case." |
  | Ready, solved | Replay | SOLVED | "Your case. Solved. Replay the case." |
  | Queued or generating | Building (thinking line) | — | "Your case. Building." |
  | Failed | See why (never blames the player) | — | "Your case. It didn't build. See why." |
  | No room (or a draft) | None yet | — | "Your case. None yet." + hint |
  | Fetch failed: network / other | Offline / Try later | — | "Your case. Offline." / "Your case. Try later." |

- **Error (THE STUDY only):** the notice capsule: "You're offline. Connect to begin." (Phosphor `WifiSlash`) or "Couldn't start the case. Try again in a moment." (`Warning`). It fades in over 120 ms (opacity, so it stays under reduced motion), is announced (iOS `announceForAccessibility`; Android through the slot's polite live region), and stays until the next card tap or focus; a repeat failure mounts a new one. One element on iOS (`accessible`), `screenReaderFocusable` on Android, never a keyboard stop. The layout does not move.
- **Focus:** the kit's brass ring (`ref.focus`: 2 pt at a 2 pt offset). Chips: `FocusRing shape="pill"` round the 36 disc. Fan cards: one overlay above the fan with the focused card's box, centre and rotation, RN outline props round its 20.6 continuous corners, above the centre card; the cards are never restacked. Stacked cards: the same outline on the card. Ghost pill: the kit's own ring. **Focus return:** closing the sheet (Close, scrim, Android back) returns screen-reader focus to Settings after the 200 ms exit (`sheet.exit`; `motion.reducedFade` under reduced motion) plus 100 (`sheet.focusMargin`); reopening, leaving for the guide or leaving the hub cancels it.
- **Large text / narrow / short screens:** the fan is designed on a 393-wide screen. Narrower screens scale the whole hand by width / 393 (360: 0.916); short columns scale it to what is left after the heading (`fanScale`); the hand shrinks about the axis with its top kept, so it never clips, and its container shrinks with it. The fan needs fontScale ≤ 1 (`fan.maxFontScale`) and a scale ≥ 0.75 (`fan.minScale`); otherwise the cards stack, upright, in reading order, in a scrolling column (spacers 131 : 96 round the hero block, the top one never more than the 124 band and frozen while the notice shows; the floor glow keeps the token's own 0.58 / 0.79): width = screen − 2 × `ref.space.edge` 20, gap 16, min height 96, height hugging the content, padding 16: the tag pill and the state line left-aligned (the busy indicator at the line's start; SOLVED 8 below), the 48 icon right-aligned and vertically centred. Same glass and rim at the card's own height, radius 23.7, no tilt. Text never shrinks; title, subtitle, notice and sheet rows wrap; the sheet scrolls past 64 %.
- **Reduced motion** (`useTheme().reducedMotion`): no press scale; the building line is still (`shimmer.still`); the sheet and scrim cross-fade over `motion.reducedFade` 140 and focus returns after 240. The colour and opacity changes keep their 120 ms timing.
- **Permission:** none here (section 03).

### User notes

> "you need to follow the formatting and design as closely as you possibly can. pay attention to the colors, typography, icons, layout, and small details like shadows gradients border radius background z stacks, how things are being laid out." (2026-10-25, round 3)

Applied. The hub takes Opal's look element by element: the void ground and the measured floor glow, the 36 chips with the diagonal specular ring at safe top + 12 and 16 from the edges, the image-plus-title group centred on the chips, the 1 pt gradient divider 16 below them, Opal's 124 band from the divider to the title box (title cap 253.7 / baseline 270.3 against 254.6 / 270.1), the 22 Semibold title and 17 Medium white-60 % subtitle 4 apart, the 28 band to the cards (from y 330), the floor glow rising from the cards' centre, the dark-glass cards with Opal's faint fading rim, no shadow, and its see-through z-stack (brighter where the front card lies over a back card, darker toward each side card's outer edge), the hairline label pills in 13 Semibold caps at 82 % white, the 54 %-height hero icon in the lime-to-aqua gradient with secondary strokes at 60 %, and the z-order (centre card on top, hiding the rims beneath).

> "3 cards instead of 2."

Kept, re-scaled after review: three cards at Opal's height (140 × 320) dealt like a hand into Opal's band (x 19.3–373.7), the centre one upright in front, the side ones ±6° and 10 lower, tucked behind it with about 85–105 of each showing. Opal's 187 width would leave only 82 of a side card showing at its pill, less than YOUR CASE's Opal-size pill, so the cards are 140 wide. Left to right: learn (THE STUDY) → photograph (YOUR ROOM) → play (YOUR CASE).

### Decisions

1. **Header (round 4, the user):** the ESCAPD wordmark, white with a grey doorway edge, centred, as the screen's header; no magnifier and no "Case files". The right chip keeps Opal's sliders and is labelled "Settings" (sliders read as settings; a gear would break Opal's look). Opal's left chevron and X disc stay left out (the hub is the root); the chevron's place keeps the logo centred.
2. **Glass hero:** removed with its tilt, glare and layout rules; `Magnifier.tsx` is deleted.
3. **Ground:** `void` + `FloorGlow`, no grain (the reference has none; the user's instruction overrides day one's Grain). Fanned, the glow is moved up with the fan (main's call after review): it starts at the cards' centre and is full 20 below the fan's foot, so the cards' olive feet sit on lit floor, as in Opal.
4. **Cards:** opaque glass (`ref.gradient.card` + Opal's faint `cardRim`) built from clipped views, so the corners are the platform's continuous corner and the centre card hides the side cards' rims; Opal's see-through look is painted on (white 2 % where the centre card lies over a side card; black 0 to 18 % across each side card toward its outer edge). Pressed: a 3.5 % white overlay and 0.97 scale (proposals; the reference shows no press).
5. **Side-card centring:** each block centres on the face the centre card leaves exposed at its own height (inset `coveredWidth`), not on the card: with the side cards tucked behind the centre card, only 85–105 of each shows. The centre card is unchanged.
6a. **Card scale (after review):** Opal's height (320), Opal's absolute pill and 24 tag offset, icons at 68 (ink about 62) with Opal's 4.9 stroke, dealt like a hand in Opal's band. Width 140, not Opal's 187: with three cards in Opal's 354 band, a 176–187 card leaves only 82–88 of a side card showing at its pill, and YOUR CASE's pill is 92–97.
6. **State line:** `ref.type.meta` grey in sentence case (Unseal, Photograph, Open, See why, None yet, Offline, Try later, Building). "Building" is sentence case too.
7. **SOLVED:** a label pill like the tags, centred at 83 % of the card's height, below the icon.
8. **Busy:** the state line becomes a small `ActivityIndicator` in `textLabel` (no brass).
9. **Notice:** a dark capsule in the chips' material, white glyph and meta text; no warning colour.
10. **Settings (round 4, the user: "more than 2 things in it"):** the kit's `DarkSheet` with grouped rows in the review screen's list style, only settings that work: Show interactives, Haptics, Reduce motion, the account row, ESCAPD Pro, the version. Sound, music and hints have no effect in the app yet, so they are left out. Server-backed switches save optimistically (a new player is made a guest first, as THE STUDY does, since settings live on the account) and flip back with a quiet grey note when saving fails. A signed-in email is shown as a value, not a link (the account screen has nothing to do for a full account).
13. **Copy (round 4 glossary):** "Developing" → "Building"; "Your case. Developing." → "Your case. Building."; "It didn't develop" → "It didn't build"; "Your case didn't develop…" → "Your case didn't build…". "Settings" → "Settings".
14. **Haptics (round 4):** card press-in `press`; the Settings chip `press`; switches `tick` on change (Haptics ticks once after it turns on, never as it turns off); navigation rows `press`; Close is the kit's `press`.
11. **Icons:** ESCAPD's three-rail sliders glyph (react-native-svg), Phosphor `X`, `WifiSlash`, `Warning` at regular weight; the three card icons are ESCAPD's own line art in Opal's style.
12. **Subtitle colour:** `ref.color.textSecondaryAlpha` (white 60 %), Opal's measured ≈ #9C on black.

### Needs you

1. **Card width:** Opal's cards are 187 × 320; ours are 140 × 320, so three fit Opal's 354 pt hand with each side card's label clear of the centre card (about 105 pt of each side card shows at the label). Wider cards would need smaller side labels, or a hand that runs past the screen edges.
2. **Switch track:** the "on" track uses the icons' aqua (`lineEnd`); the reference shows no switch. White thumb on pale aqua is low-contrast on iOS (the thumb's shadow carries it). Alternative: `textPrimary` track with a `void` thumb.
3. **iOS switch touch area:** the native switch is 51 × 31 on iOS, under 44; as in Case options.

## 02 · Camera

Reference: docs/refs/02-camera.png (Once), measured at 2.165 px/pt on a 393 × 852 pt screen (safe areas 59 / 34); the Mobbin footer from y 1843 px is not part of the design. This round matches it as closely as the platform allows: the flat ground, the square header buttons, the serif title over a grey meta line, the big rounded black viewfinder, the control row with its segmented zoom, the italic counter, the glowing shutter and the framed last photo. ESCAPD keeps its own copy, its Roman plate numerals, its glyphs and every behaviour. Every value is a `ref` token from `src/theme/tokens.ts` (`ref.color`, `ref.type`, `ref.space`, `ref.radius`, `ref.button.square / bare / segment / shutter / thumbnail`, `ref.gradient.shutterDisk / shutterDiskPressed`, `ref.effect.shutterGlow`, `ref.motion`, `ref.hit`, `ref.focus`) plus the screen's own `ref.layout.camera`. No silk, grain, mount, plate label, brackets, Playfair, mono stamp, brass or oxblood.

This section covers `/capture` and `/capture?retake=<i>` once camera permission is granted; everything before that belongs to 03. Route: `app/capture/index.tsx` (the shell over 02 and 03) renders `src/capture/ui/Rangefinder.tsx` after a grant; the props contract is `src/capture/ui/types.ts`.

Files in `src/capture/ui/rangefinder/`: `Header.tsx` (back, prompt, library, error line, thinking line), `SquareButton.tsx` (Once's 44 square), `Viewfinder.tsx` (the well, feed, framing grid, privacy note, and the fitting rule `viewfinderLayout`), `ControlRow.tsx`, `BareToggle.tsx` (Once's bare glyph, as a switch), `LensSegment.tsx`, `PlateCounter.tsx` (the odometer), `Shutter.tsx`, `LastPlate.tsx`, `Dimmable.tsx` (eased disabled opacity), `copy.ts` (every word), `useLenses.ts`. Tests: `src/capture/ui/rangefinder/__tests__/rangefinder-test.tsx` (behaviour, hit areas, focus rings, the look, tokens only). `Brackets.tsx` is gone.

### Feel

A quiet, near-black instrument. Depth comes from value steps, never shadows: the flat `ground` #101010, `raised` #1E1E1E buttons and thumb, `void` #000000 wells (viewfinder, zoom track, counter pill) and `well` #070707 rims (shutter ring, last-plate frame). Everything that speaks is white; secondary text steps down through `textSecondary` #949494, `textTertiary` #5A5A5A and `textDim` #3F3F3F. The viewfinder takes 57 % of the screen. A serif title makes it personal, a rolling italic numeral makes it a film camera, which suits ESCAPD's plates and roll. The only light on the screen is the soft upward glow round the shutter, whose white magnifying glass is the focal object.

**Accent on this screen:** none. The only brass is the focus ring (`ref.focus`, the user's decision), and only while a control has keyboard, D-pad or switch focus.

### Layout, top to bottom

Default text size, 393 × 852, plate I, camera ready, an ultra-wide lens reported. Measured positions of the web render (Inter in place of SF Pro) against the reference are in brackets.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Solid `ref.color.ground` #101010 on the Rangefinder's own root, opaque over the shell's ground. No grain, glow, vignette or gradient [ref #101010 everywhere outside the controls] | — |
| Status bar | y 0–59 | System, light content | — |
| Header row | Box y 65–113: root paddingTop = safe top + `layout.camera.top` 8 − 2, then paddingVertical 2 (the squares' slop) round the 44 content y 67–111. padX `layout.camera.edge` 21 | — | Back · prompt · library |
| Back | x 21–65, y 67–111, centre (43, 89) [ref 20.8–65.6 × 67.4–112.2; render 21–65 × 67–110.7] | `SquareButton` = `ref.button.square`: 44 square, fill `raised` #1E1E1E, `ref.radius.square` 14 continuous, a 1 pt rim on all four edges in `layout.camera.squareRim` #232323 [ref #222–#242424], no shadow | Phosphor `ArrowLeft` at `layout.camera.headerIcon` (bold, 18: 14 wide, 1.7 stroke) [ref 14.3 wide, 1.5–1.7 stroke], `textPrimary`, centred |
| Title | Prompt column x 73–320 (247 = 393 − 2 × 21 − 2 × 44 − 2 × `space.sm` 8), centred on x 196.5. Line box y 70–92 (`layout.camera.promptTop` 3 below the buttons' top) [ref baseline 87.0; render cap top 74.0, baseline 87.0] | `ref.type.serifTitle`: Roboto Serif Regular 17/22, letterSpacing 0, `textPrimary`, centred | The plate title (`src/capture/slots.ts`), widths at 17: "From the doorway" 160.0 · "Opposite corner" 141.0 · "The busiest wall" 141.4 · "A close view" 107.1 · "Another angle" 122.4 · "Last plate" 85.4. Roll full: "Six plates is a full roll" 186.6. All one line on 393 [ref "Alex's party" 103.9; ours 103.2 at 17] |
| Meta line | Line box y 95–111 (`layout.camera.metaGap` 3 under the title): 3 + title 22 + 3 + meta 16 = 44, the buttons' height [ref ink 97.9–108.1, baseline 107.8; render ink 98.0–107.7] | `ref.type.meta`: system Regular 13/16, `textSecondary` #949494 [ref #8C8C8C–#929292], centred. A second line grows the header downward and the viewfinder shrinks | The plate detail: "Wide. Include the floor and two walls." · "Overlap the first plate." · "The wall with the most objects." · "A desk, shelf, or table." · "Optional. Anything still unseen." · "Optional. One more overlap." Roll full: "Continue to the light table." The error line or the thinking line replaces it (States) |
| Library | x 328–372, y 67–111, centre (350, 89) [ref 327.4–372.2] | The same `SquareButton` | Phosphor `Images`, bold 18, `textPrimary` (in Once's QR slot) |
| Viewfinder area | x 14–379, y 140–626.7: flex 1, marginX `ref.space.plate` 14, marginTop `band.viewfinder` 29 − 2, marginBottom `band.controls` 29.7 − 4 | — | — |
| Viewfinder | x 14–379, y 140–626.7 (365 × 486.7, exactly 3:4, `frameAspect` 0.75) [ref 14.2–378.9 × 140.0–626.6; render 14–379 × 140–626.7]. `viewfinderLayout` = `containBox(area, 0.75)`, so a short screen shrinks it (centred) before any text does | One well: `ref.color.void`, `ref.radius.viewfinder` 40 continuous, overflow hidden. No border, shadow or overlay: a hard edge on the ground | `CameraView` `facing="back"`, `mode="picture"`, `ratio` "4:3" (`feedRatio`), `flash`, `selectedLens`. Black until frames arrive |
| Framing grid (when on) | Thirds, edge to edge in the well: x 135.7 and 257.3, y 302.2 and 464.4 | 1 pt (`grid.line`) `textPrimary` lines at `grid.opacity` 0.4, above the feed and under the note, hidden from accessibility; shows and hides over `ref.motion.control` | Rule of thirds. Off by default |
| Privacy note | Bottom-centred in the well, its foot `note.inset` 16 above the well's (y 610.7); one line at 393: about 296 × 32 (padding `note.padX` 12 / `note.padY` 8), max width 333 (well − 2 × 16) | A black pill in Once's void: an absolute fill of `void` at `note.fillOpacity` 0.6 so the feed still reads through it, `ref.radius.round`, continuous. Text `ref.type.meta` in `textPrimary`, centred; Android `textBreakStrategy="balanced"`, iOS `lineBreakStrategyIOS="standard"` | "Keep people, mail, and lit screens out of frame." Until plate I is taken, never in retake mode; fades out over `ref.motion.control` |
| Control row | Box y 652.4–700.4 (48 = the glyphs' and halves' hit height), centre 676.4; space-between with paddingLeft 19 and paddingRight 21.4: the glyph boxes centred `layout.camera.controlColumns` 43 from the left edge and 45.4 from the right (x 347.6, Once's flip glyph, not the library's 350). The lens slot is an absolute fill (pointerEvents box-none), so the segment stays on the screen's centre | — | Flash · lens · grid |
| Flash | Box x 19–67, centre (43, 676.4) [ref glyph centre (43.4, 676.1)] | `BareToggle` = `ref.button.bare`: no container; glyph at `layout.camera.controlIcon` 22, `bare.glyph` `textPrimary` | Phosphor `LightningSlash` fill (off, the default) / `Lightning` fill (on): Once's filled bolt [ref 17.5 × 20.3; ours about 15 × 20] |
| Lens track | x 146.5–246.5, y 656.4–696.4 (100 × 40) [ref 146.5–246.7 × 656.3–696.5; render 656.3–695.7] | `ref.button.segment`: fill `void`, radius 16 continuous | Only when the phone reports an ultra-wide lens (iOS), after `onCameraReady`; it fades in |
| Lens thumb | 45 × 32, inset `segment.inset` 4: left x 150.5–195.5 or right x 197.5–242.5, y 660.4–692.4 [ref right 197.7–242.6 × 660.4–692.2] | `segment.thumbFill` `ref.color.thumb` #1B1B1B [ref #1A1A1A–#1B1B1B], `segment.thumbRadius` 12 continuous. Slides between its stops over `ref.motion.segmentSlide` (200 ms ease-out) | Under the chosen lens. Default 1.0 |
| Lens labels | Centred on the thumb stops, x 173 and 220, y 676.4 [ref 173.9 and 221.2] | `ref.type.label`: system Semibold 13/16, the same size in both states; `segment.active` `textPrimary` on the thumb, `segment.inactive` `textTertiary` off it. The chosen one is followed by Phosphor `X` bold at `lensMark.size` 11.5 (7.2 of ink), `lensMark.gap` 3 after the digits, in `textPrimary` [ref "×" 7.5 × 7.7, 5 after the "0"] | "0.5" · "1.0", the chosen one with its xmark: "1.0 ×" |
| Grid | Box x 323.6–371.6, centre (347.6, 676.4) [ref flip glyph (347.7, 676.6); render glyph centre 348.0] | As Flash | Phosphor `GridNine` regular (off) / fill (on), in Once's flip slot |
| Bottom row | Box y 716.2–796.6 (80.4 = the shutter's 75 + room for its 2.7 drop above it), every child centred on y 756.4; marginTop `band.bottom` 24 − 4 − 4.2; padX `edge` 21; justify space-between, so the gaps are 65.5 and 65.5 [ref 64.7 and 65.9] | — | Counter · shutter · last plate |
| Plate counter | x 21–94, y 730.2–782.7 (`counter.width` 73 × `counter.height` 52.5) [ref 21.2–94.4 × 730.2–782.7] | `void` pill, `ref.radius.nested` 20 continuous, clipping a strip of the six numerals in `ref.type.counter` (Crimson Text Italic 29/34, +1.75, a leading pad of one step on iOS and the web so the glyphs centre), `counter.gap` 4 apart on top of the 1.75 trailing tracking and the 1.75 leading pad, so the ink sits about 7 apart [ref 7.4 / 6.4; render 6.6 / 6.7]. The strip is placed from the numerals' measured boxes so the current one is centred, nudged `counter.dx` 0.8 right (the italic's slant) and `counter.dy` 1.4 down [ref "34" ink 747.7–765.7, centre x 59.3; render "III" 747.7–766.0, centre x 60.0]. Current `textPrimary`; neighbours `textDim` #3F3F3F, evenly, cut by the pill's edges | The plate about to be taken: "I" … "VI". Plate I has no left neighbour (its right one, "II", fits inside the pill); VI and a full roll have no right one. Retake mode: the retaken plate alone |
| Shutter glow | About 12 above the ring, a little to the right, gone about 2 below [radial levels at 38 / 40 / 44 / 48 from the centre, top: ref 38 / 32 / 20 / 19, render 38 / 31 / 21 / 17; right: ref 26 / 21 / 17 / 16, render 30 / 24 / 18 / 16; bottom: ref 22 / 17 / 16 / 16, render 19 / 17 / 16 / 16] | `ref.effect.shutterGlow` `1px -4px 10px -3px rgba(255, 255, 255, 0.20)` (`ref.color.shutterGlow`) as the ring's `boxShadow`; the negative spread keeps it off the sides and foot | The only light on the screen |
| Shutter ring | Ø 75, x 159.5–234.5, y 721.6–796.6, centre (197, 759.1): `layout.camera.shutter.drop` 2.7 below the row's centre, as measured [ref centre (196.8, 759.1), Ø 75] | `ref.button.shutter.ringFill` `ref.color.well` #070707 [ref #070707; render 7], 4 thick round the disk | — |
| Shutter disk | Ø 67, concentric [ref 66.8] | `ref.gradient.shutterDisk` (210°: #1C1C1C at the top right → #2A2A2A at the bottom left over the disk's box, about #1E → #26 across the disk itself), drawn with react-native-svg on `userSpaceOnUse` lines from the kit's `gradientLine` [levels 22 in from the edge at 0 / 90 / 180 / 270°: ref 31 / 31 / 38 / 37, render 33 / 34 / 38 / 37]. A 1 pt bevel inside its edge (`shutter.bevelWidth`), `ref.color.bevel` #3A3A3A along a vertical line (`shutter.bevelLine`), opacity 1 at the top, 0.35 at 0.3 and 0 at 0.5 of the disk's height (`shutter.bevel` stops, plain hex + opacity), so it is gone by about 80° either side [edge peaks at 0 / 20 / 40 / 60 / 80 / 340 / 320 / 300°: ref 52 / 49 / 51 / 44 / 38 / 57 / 44 / 42; render 58 / 54 at 0 / 30, 40 at 60, 54 / 45 at 330 / 300] | Phosphor `MagnifyingGlass`, regular, `ref.button.shutter.iconFallback` 28 (stroke 1.75), `textPrimary`, on the disk's centre nudged +1, +1 (`shutter.glassNudge`) so the lens, not the glyph's box, reads as centred: the user's note, in the reference's white icon style |
| Last-plate frame | x 300–372, y 720.4–792.4 (72) [ref 300.2–372.1 × 720.5–792.4] | `ref.button.thumbnail`: fill `frameFill` `ref.color.well` #070707 [ref #050809 / #070707; render 7], `radius` 24 continuous, frame 4. No glow | — |
| Last-plate image | x 304–368, y 724.4–788.4 (64) | `imageRadius` 20 (concentric), clipped, `contentFit="cover"`, full colour; a 1 pt (`layout.camera.hairline`) `imageRim` `rimFaint` rim over it. Before plate I: the empty `void` well | The newest plate on the roll (retake: the plate being replaced) |
| Continue cue | The frame's outer edge, inside the 72 box | From `MIN_PLATES` (3), outside retake mode: a 1 pt (`cue.width`) ring in `cue.color` `textTertiary` #5A5A5A, `radius` 24, fading in over `ref.motion.control`. Reference greys only | — |
| Bottom | Row bottom 792.4 (thumbnail) / 796.6 (ring) to the safe bottom 818: `band.foot` 25.6 from the thumbnail; then the 34 inset | Ground | Home indicator |

Check: 59 + 8 + 44 + 29 + 486.7 + 29.7 + 40 + 24 + 72 + 25.6 + 34 = 852.

**Columns.** Left x 43: Back and Flash. Centre x 196.5: the prompt, the viewfinder, the lens segment (the shutter's centre is 197, as the row's equal gaps put it [ref 196.8]). Right: Library at x 350 and the Grid glyph at x 347.6, as Once's QR button and flip glyph. The counter and the thumbnail sit 21 from the edges, the viewfinder 14.

**Hit boxes inside their parents.** Native hit-testing (iOS Fabric and Android) drops touches outside a parent that nothing overflows, so each row carries its controls' hit areas inside its own box and the bands round it shrink by as much: the header row the squares' 2 of slop, the control row the 4 above and below the 40 track, the bottom row the shutter's drop. Every visible position above is unaffected.

### Tappable elements

- Hit areas are at least `ref.hit.min` 44: the squares are 44 with `hitSlop` 2 (48 × 48, `ref.button.square.hit`); the bare glyphs 48 × 48; the lens halves 50 × 48; the shutter 75; the thumbnail 72.
- Pressed: the squares, the bare glyphs and the thumbnail go to 0.75 (`pressedOpacity`); the inactive lens label eases `textTertiary` → `textSecondary`; the shutter's disk scales (States).
- Disabled is `ref.button.disabledOpacity.icon` 0.4 on the whole control, eased over `ref.motion.control` (Dimmable). The empty thumbnail before plate I stays a full-opacity well.

| Element | Hit area | Action |
|---|---|---|
| Back | 48 × 48: x 19–67, y 65–113 | "Close the camera": `onClose` (the shell's `router.back()`, or `router.replace("/")` with no history). The roll stays in memory (`roll.ts`), so there is no confirm. Retake: "Cancel retake", back to `/capture/review`, the plate unchanged. While a retake is busy, back is ignored until it settles. |
| Android hardware back | System | Same as Back in every state, including the busy rule in retake mode (`useFocusEffect` + `BackHandler`, returns true). |
| Library | 48 × 48: x 326–374, y 65–113 | "Choose photos from your library" (retake: "Choose a photo instead"). `useLibraryImport`: multi-select up to `MAX_PLATES` − taken (1 in retake), each photo through `processPhoto` → `addPlate`, failures counted for the error line; retake: `replacePlate` → `router.back()`. Disabled while busy and on a full roll. |
| Viewfinder | Not tappable | expo-camera has no tap-to-focus point and no pinch zoom here. Hidden from screen readers (the prompt says what to frame). |
| Privacy note | Not tappable | Plain text, read in focus order. |
| Flash | 48 × 48: x 19–67, y 652.4–700.4 | Toggles `flash` "off" / "on" for the camera session. Role `switch`, label "Flash", `checked`. |
| Lens "0.5" | 50 × 48: x 146.5–196.5 | iOS: `selectedLens` = the ultra-wide from `getAvailableLensesAsync()`. Role `radio`, "Ultra-wide lens", `selected`; large-content viewer "0.5" / "0.5 ×". |
| Lens "1.0" | 50 × 48: x 196.5–246.5 | Default main lens (`selectedLens` unset). Role `radio`, "Main lens". The halves form a `radiogroup` "Lens". |
| Grid | 48 × 48: x 323.6–371.6, y 652.4–700.4 | Shows or hides the framing grid for the session. Role `switch`, "Framing grid", `checked`. |
| Shutter | The 75 box | `takePictureAsync({ quality: 0.92, exif: false })` → `feedback.tap()` → `processPhoto` → `addPlate`; the counter rolls, the thumbnail and the prompt advance. Retake: `replacePlate(i)` → `router.back()`. a11y "Take plate III, The busiest wall" (retake "Retake plate II, Opposite corner"; full roll "Take a plate"). |
| Last-plate thumbnail | 72 × 72 | Pushes `/capture/review`. a11y "Open the light table, 2 plates"; from 3 plates "Continue to the light table, 3 plates". Disabled before plate I and while busy. Retake: "Cancel retake", calls `onClose`. |
| Plate counter | Not tappable | a11y "Next: plate III. 2 of 6 plates taken." · "Roll full. 6 of 6 plates taken." · "Retaking plate II." |

**Focus order (VoiceOver / TalkBack):** Back → header (title and meta as one element, role `header`, polite live region) → Library → privacy note (while shown) → Flash → Ultra-wide lens → Main lens → Framing grid → plate counter → Shutter → Last plate. Focus moves to the header once the rangefinder has faded in (`motion.sceneCrossfade` 200 ms). On iOS, which has no live regions, a new prompt, error or status is announced once with `announceForAccessibility`.

**Keyboard and switch focus** reaches controls only: Back → Library → Flash → 0.5 → 1.0 → Grid → Shutter → Last plate. The header and the counter are `accessible` on iOS and `screenReaderFocusable` on Android, so each is one TalkBack element but never a keyboard stop; their texts are hidden from Android's accessibility tree.

**Focus rings** (the kit's: 2 pt brass at a 2 pt offset, following each shape): the squares a rounded square at 14 + 4 (+1 for the rim), x 17–69 for Back; the bare glyphs a Ø 52 circle; the lens one ring round the whole track at 16 + 4 while either half has focus; the shutter a Ø 83 circle; the thumbnail an 80 square at 24 + 4.

### States

- **Before camera permission is granted:** section 03. This layout mounts only after a grant.
- **Camera starting** (before `onCameraReady`): the well is black. The shutter, Flash and Grid are at 0.4; Back and Library are live. The centre slot is empty: the lens list is read after `onCameraReady`, and with an ultra-wide the segment fades in 0 → 1 over 120 ms (never shown dimmed first). The privacy note already shows.
- **Ready:** as in the layout table. The shutter, Flash and Grid return to 1.0 over 120 ms.
- **Camera didn't start** (`onMountError`): the meta slot becomes the error line, "The camera didn't start."; the shutter, Flash and Grid stay at 0.4 and the lens never appears; Library and Back are the ways on.
- **Pressed:** squares, glyphs and thumbnail 0.75 while held; the inactive lens label eases to `textSecondary`; the shutter's disk and glass scale to `ref.motion.shutterPress.scale` 0.94 over 100 ms ease-out and its gradient cross-fades to `ref.gradient.shutterDiskPressed` (one notch darker); the ring and glow stay still.
- **Disabled:** the whole control at 0.4, eased; disabled controls keep screen-reader focus with the dimmed state.
- **Busy** (capturing and re-encoding, or library picks): shutter taps are ignored, it stays still at full opacity with `accessibilityState.busy`. Library, Flash, the lens and the thumbnail go to 0.4 (the thumbnail keeps its image and ring). Back and Grid stay live; back is ignored during a retake. The prompt, counter and shutter label hold the plate the wait started on and change once, as it ends. Under ~1 s nothing more shows; past `thinkingDelay` 1000 ms the meta slot holds the kit's `ThinkingStates variant="meta" ground="dark"` (decorative; shimmer `textSecondary` → `textPrimary`, `ref.motion.thinking`): "Preparing plate III", or for two or more picks "Preparing photo 2 of 4", sized to "Preparing photo 4 of 4". The prompt's label carries the fixed status ("Preparing plate III" / "Preparing 4 photos").
- **Captured:** haptic tap. The counter's strip rolls one numeral left over `ref.motion.counterRoll` (220 ms ease-in-out) while the old numeral dims to `textDim` and the new one brightens to `textPrimary`; the thumbnail cross-dissolves to the new plate (120 ms); the title and meta swap and are announced; after plate I the privacy note fades out (120 ms).
- **Error** (capture or library): the meta slot becomes the error line until the next attempt: Phosphor `Warning`, regular, `layout.camera.noticeIcon` 14, `textPrimary`, centred on the first meta line, `space.xs` 4, then the words in `ref.type.meta` `textPrimary`: white where the detail is grey, so it reads as more urgent in the reference's own value steps; centred, announced politely. "That plate didn't take. Try again." · "One photo couldn't be used." · "2 photos couldn't be used." (the ones that worked join the roll). No amber, no oxblood.
- **3 plates or more** (`MIN_PLATES`, outside retake): the cue ring fades in on the thumbnail frame; its label becomes "Continue to the light table, n plates".
- **Roll full (6):** shutter and Library at 0.4. Title "Six plates is a full roll", meta "Continue to the light table.". The counter shows VI with no right neighbour. The thumbnail keeps its ring; Flash, lens and Grid stay live (the preview runs).
- **Retake mode** (`?retake=<i>`): the counter shows that plate's numeral alone (neighbours hidden); the prompt shows that plate's title and detail; the thumbnail shows the plate being replaced, without a ring; Library picks 1; no privacy note.
- **No ultra-wide lens** (Android, older iPhones, the web): the centre slot is empty; Flash and Grid keep their columns and the row its height.
- **Large text:** title and meta grow uncapped and wrap; the header grows downward and `containBox` shrinks the viewfinder (centred). Text never shrinks. The counter's numerals cap at `counter.maxFontScale` 1.25 (the strip is placed from measured boxes, so it stays centred; the a11y label carries the sentence); the lens labels cap at `lensMaxFontScale` 1.25. Glyph sizes are fixed.
- **Narrow and short screens:** the viewfinder absorbs the difference. 375 × 667 (safe 20 / 0): the well is about 281 × 375, centred; the bottom row sits 21.4 above the screen edge. The privacy note's max width follows the well (well − 32), so it takes two lines on wells under about 328 wide, as there.
- **Reduced motion** (`useTheme().reducedMotion`): the counter does not travel (the strip jumps halfway, unseen) and the two numerals cross-fade over `motion.reducedFade` 140 ms; the lens thumb fades out and back in under the new half over 140 ms instead of sliding; the shutter press is the gradient change only, no scale; 120 ms opacity and colour changes stay; the thinking line is still.

### User notes

> "you need to follow the formatting and design as closely as you possibly can. pay attention to the colors, typography, icons, layout, and small details like shadows gradients border radius background z stacks, how things are being laid out."

Applied. Every element is placed, sized and coloured from the measured reference (brackets above): the ground, the 44 squares with their faint rim, the serif title and meta baselines, the 365 × 486.7 well at radius 40, the 100 × 40 track and 45 × 32 thumb, the 73 × 52.5 counter pill and its italic numerals, the 75 ring, 67 gradient disk, top bevel and upward glow, and the 72 / 64 frame and image. Z-order follows the reference: the glow under the ring, the disk over it, the glass over the disk; the thumb under the labels; the image under its rim.

> "the photo button has a magnifier glass icon on it."

Applied: Phosphor `MagnifyingGlass` in the reference's white icon style (regular, 28, stroke 1.75), centred on the disk, scaling with it on press.

**ESCAPD's own, in Once's style:** the plate prompt in the title and meta slots; Roman plate numerals in the italic odometer; the library picker in the right header slot; the framing grid in Once's flip slot; flash off / on; 0.5 only with an ultra-wide lens; the privacy note until plate I, as a see-through black pill; the continue cue on the thumbnail from 3 plates, in grey; retake mode, a full roll, the thinking line and the error line.

**Changes from the play-screen build:** soot and grain → the flat `ground`; 48 round IconButtons → Once's 44 squares; Playfair `narrativeTitle` / Jakarta `caption` → Roboto Serif 17 / system 13; the walnut mount, plate rim, brass brackets and "ESCAPD 400 · PLATE I" label → one black well at radius 40; colour-changing toggles → white glyphs whose shape shows the state; the walnut 8 pt lens track with a brass thumb → Once's void track with a sliding raised thumb and an xmark; the 72 walnut counter with a brass "PLATE" stamp → Once's void pill with the rolling italic numerals; the brass ring and manila core → Once's near-black ring, gradient disk, bevel and glow with a white glass; the walnut thumbnail mount with a brass ring → Once's near-black frame with a grey cue ring; errors in an amber glyph → white glyph and words.

### Decisions

1. **Ground:** `ref.color.ground` on the Rangefinder's own root, opaque, so the shell's soot and grain never show.
2. **Viewfinder:** Once's clean well, so ESCAPD's brackets, mount, rim and plate label are dropped (they were brass; the reference has nothing on the feed). `viewfinderLayout` is `containBox(area, 0.75)`.
3. **Header glyphs:** Phosphor bold 18 (`layout.camera.headerIcon`) rather than `ref.button.square.icon` 20 regular: it matches the measured arrow (14.3 wide, 1.5–1.7 stroke); regular 20 drew 15 × 12.5 at 1.25.
4. **Square rim:** `layout.camera.squareRim` #232323, the measured edge. `ref.button.square.border` (`rimFaint`, white 5 %) composites to #292929 on the raised fill, a visibly brighter edge than the reference's.
5. **Control glyphs:** 22 (`layout.camera.controlIcon`) rather than `ref.icon.control` 24, matching the bolt's measured 20.3 height. Flash is filled in both states, as Once's bolt; the grid is GridNine regular when off (bold read as nearly solid at 22 and blurred the off / on difference) and fill when on.
6. **Zoom labels:** "0.5" and "1.0" in the same size and weight; the chosen one is followed by a drawn xmark (Phosphor X bold 11.5) rather than a "×" character, which rendered small and heavy in the system font; the large-content viewer still reads "1.0 ×".
7. **Counter:** Roman numerals I–VI in Once's odometer, laid on one strip and centred from their measured boxes, their ink about 7 apart as Once's, so neighbours show more or less depending on the numeral's width ("III" is wider than "34"). At plate I the pill's right edge just cuts "II".
8. **Shutter drop:** kept, 2.7 below the row's centre, as measured (it balances the upward glow).
9. **Errors:** white text and a white Warning glyph in the meta slot (brightness, the reference's own hierarchy), not amber.
10. **Continue cue:** a 1 pt `textTertiary` ring on the thumbnail frame from 3 plates, plus the "Continue to the light table" label: quiet, in the reference's greys, no brass.
11. **Privacy note:** a see-through black pill (void at 0.6) with white meta text, one line at 393, 16 above the well's foot; it fades out after plate I.
12. **Busy shutter:** still and full-opacity with `busy` set; the wait shows only in the meta slot's thinking line (no spinner on the disk).
13. **Disabled easing:** every control eases into 0.4 over 120 ms (Dimmable), the squares and glyphs included.
14. **Shared tokens retuned for 02 (review round):** `ref.color.well` #070707 (new: the shutter ring and the thumbnail frame; `shade` stays for the ghost pill), `ref.color.thumb` #1B1B1B (new: the zoom thumb), `ref.color.bevel` #3A3A3A, `ref.color.shutterGlow` white 20 %, `ref.effect.shutterGlow` `1px -4px 10px -3px`, `ref.gradient.shutterDisk` / `shutterDiskPressed` at 210° (#1C1C1C → #2A2A2A / #171717 → #252525). The bevel line is vertical, not tilted: fitted to the reference's edge peaks it has about 60 % of the squared error of a top-right tilt, which lit 60–100° on the right 9–10 levels too bright.

### Needs you

1. **Ultra-wide distortion:** confirm that the generation pipeline copes with 0.5× barrel distortion before the lens segment ships; if not, limit 0.5 to plate I or hide it (`useLenses` returns `ultraWide: null`).
2. **No flash unit:** expo-camera 58 gives no flash-availability signal, so the toggle stays live on a phone without a flash.
3. **Rounded preview on Android:** the well clips the `CameraView` at radius 40 with `overflow: hidden`; some Android preview surfaces ignore rounded clipping. Check on device.
4. **Shutter glow on device:** the glow is RN's `boxShadow` (new architecture). The web render matches the reference's profile; check iOS and Android draw it the same.
5. **Lens keyboard stops:** each lens half is its own keyboard stop (0.5 then 1.0) with one ring round the track. Keep, or make the radiogroup a single stop.
6. **Foundation tokens:** `ref.button.square.border` (`rimFaint`) and `ref.button.square.icon` / `ref.icon.control` don't match the measurements on this screen; 02 overrides them in `ref.layout.camera` (`squareRim`, `headerIcon`, `controlIcon`). Fold them into `ref.button` if 03's back control should match.

## 03 · Camera permission

Reference: docs/refs/03-camera-permission.png (pushr, "camera permission"), measured at 2.178 px/pt on a 393 × 852 pt screen (safe areas 59 / 34); the Mobbin footer from y 1854 px is not part of the design. This round matches it as closely as the platform allows: the white ground with the soft, cool grey haze behind the status bar, the full-bleed white sheet rising from below with 16 pt continuous top corners, the light grey illustration panel holding a heavy black phone outline turned in perspective (lit inner wall, dark outer wall, gloss lines, island) and cropped by the panel's foot, the wide black lowercase title, the grey system-font body, the 64 pt black pill with its white semibold label, and the spacing, colours and radii as measured. ESCAPD keeps its own copy (only the case changes), adds its quiet "choose photos instead" path in the reference's grey under the pill, and keeps every state and behaviour. There is no back control, as in the reference: leaving is the system's back.

Route: a state of `/capture` (`app/capture/index.tsx`), including `/capture?retake=<i>`; not a new route and not a modal. The shell renders `CameraPermission` (`src/capture/ui/CameraPermission.tsx`) for every state before camera access is granted: Checking while `useCameraPermissions()` returns `null` and, outside retake mode, while 04's guide-seen backstop runs (`useGuideBackstop`: session flag, then AsyncStorage `escapd:onboarding:capture-guide`); the sheet whenever access is not granted. An unseen guide runs `router.replace('/capture/guide')` and no sheet renders. 02's rangefinder mounts only once access is granted. Files: `CameraPermission.tsx` (states, buttons, notices, Android back, VoiceOver escape), `permission/PermissionGround.tsx` (paper and the kit's `PaperHaze`, and their fade on a grant), `permission/PermissionSheet.tsx` (the sheet, text, the cap and large-text steps), `permission/IllustrationPanel.tsx` (panel and phone), `permission/PermissionNotice.tsx`, `permission/copy.ts` (every word), `permission/useGuideBackstop.ts`, `src/capture/useLibraryImport.ts`. Tests: `permission/__tests__/CameraPermission-test.tsx` (look and every state), `PermissionSheet-test.tsx` (sheet, type, cap, bottom padding, large text), `captureRoute-test.tsx` (the shell, its ground, the status bar, the edge swipe).

Tokens: `ref` in `src/theme/tokens.ts` throughout (`ref.color.paper / panel / inkDisplay / inkMuted / raised / illustrationBevel / ground`, `ref.gradient.haze` (through the kit's `PaperHaze`, shared with 05), `ref.type.display / body / ctaLabel / headline / meta`, `ref.space.sm / lg / xl / band / ctaBottom`, `ref.radius.sheet`, `ref.curve`, `ref.button.primary / quiet (paper: label inkMuted, pressed raised) / disabledOpacity.pill`, `ref.effect.illustrationTilt`, `ref.focus`, `ref.motion.control / thinking.shimmerPaper`), the live `motion.sheetSpring / sceneCrossfade / reducedFade`, and the screen's own `ref.layout.permission`: `titleToBody` 14; `panel` 150; `phone` { dx −80.9, top 28.8, width 157, length 160, outer { left { rx 44, ry 41 }, right { rx 30, ry 36 } }, band { left 18, right 18.5, top 16 }, inner { left { rx 8, ry 18 }, right { rx 19, ry 27 } }, bevel { width 9, from 39.5, ramp 2, corner 0.2 }, sheen { inset 5.6, width 7.6, upper 0.35, lower 0.16, to 48, ramp 15 }, gloss { y 6, from 26, peak 36, to 125, width 1, opacity 0.36 } }; `island` { x 72.7, y 30.7, width 57.3, height 24, rotate 12, endRadius 8, gloss { v −5.5, from −22, to 12, width 1.2, start 0.45, end 0.2 }, face { from 20.5, to 28.2, height 19, radius 4, lit 0.38, shade 0.16, split 0.55, shadeFrom 0.8 } }; `noticeIcon` 16; `thinkingDelay` 1000; `titleFocusDelay` 300. No live colour, type, space or radius; no walnut, brass (the focus ring excepted), grain, silk or Playfair.

### Feel

Bright, quiet and a single decision. The upper third is white with one soft, out-of-focus grey bloom behind the status bar, right of centre, like a lens that hasn't found the room yet. A white sheet rises from the bottom. Its top is a pale cool-grey band holding a heavy black phone outline, turned so its top edge falls to the right, lit along its inner left wall and cropped by the band's foot. Under it sit a blunt, wide, black lowercase title, a calm grey paragraph saying the photos stay private, one heavy black pill and, quieter, a grey way to use photos already taken. No shadows, scrim, grabber, hairline or colour accent: all the hierarchy is weight and size. Nothing moves except the sheet's rise, the press colour changes and, during a real wait, the thinking line. The status bar's glyphs are dark on this screen.

### Layout, top to bottom

Default, default text size, empty roll, 393 × 852. Web render positions (Inter in place of SF Pro) in brackets where they were measured.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Status bar | y 0–59 (safe top) | System; dark glyphs (`setStatusBarStyle("dark")` from the shell while /capture is focused and the camera isn't showing) | – |
| Ground | Full screen, behind everything | `PermissionGround`: `ref.color.paper` #FFFFFF. The shell's `ref.color.ground` #101010 lies under it (02's ground), hidden until a grant | – |
| Haze | Core #D4D4D6 at about (229, 110–150), cut off by the screen's top (≈ #F0 at y 0), white by y ≈ 288; left edge #FE at x 0, right #FA at x 390 | The kit's `PaperHaze` (`ref.gradient.haze`, fitted on this screen and shared with 05): a react-native-svg `RadialGradient` in `ambientCore` with `stopOpacity` stops, circle centre (screen centre + 12.4, 153.5), r 218, focal point (screen centre + 38.8, 113.5), so it falls off faster to the right and down; then a paper `LinearGradient` (stopOpacity 0 → 1) over y 250.7–287.5. Fitted to the reference: rms 1.7 grey levels (measured x 228: y 18 #EA/#E9, 83 #D6/#D6, 175 #D8/#D7, 229 #E6/#E5, 266 #F5/#F6, 285 #FE/#FF). Static in every mode, hidden from accessibility | Decorative "unfocused room" |
| Sheet | x 0–393, y 318–852 (534). Content-sized, bottom-anchored: it grows upward, its bottom fixed | `PermissionSheet`: `ref.color.paper`, top corners `ref.radius.sheet` 16 with `ref.curve` (measured 17, range 15–19), square at the foot, `overflow: hidden`. No shadow, scrim, grabber, hairline, rule or grain. Not dismissable | – |
| Illustration panel | x 0–393, y 318–468 (`panel` 150; measured 149.7) | `ref.color.panel` #F3F5F7 under the sheet's top corners; clips the phone at its foot | – |
| Phone outline | Ink x 115.7–272.3, y 356.3–468 (ref 114.8–273.2 × 38.1 below the panel top; here 38.3) | `IllustrationPanel`, react-native-svg, fitted to the reference's render (IoU fit, both outlines within ≈ 0.5 pt). Drawn upright then sheared by `ref.effect.illustrationTilt` 14° (`matrix(1 tan14° 0 1 …)`): top edge falls 0.25 pt per pt to the right, sides stay upright. Outer corners as ellipses (top left 44 × 41, top right 30 × 36), band 18 left / 18.5 right / 16 top in `ref.color.inkDisplay` #000000, the open screen in `ref.color.panel` with corners 8 × 18 and 19 × 27. Lights, all `ref.color.illustrationBevel` #929090 at stop opacities: the lit inner wall down the left (9 wide, full from 39.5 below the top edge, 0.2 round the corner above it; measured #929090, 124–133 on 393), the outer wall down the right (7.6 wide, 5.6 in: #333333 to 48 below the top, #171717 under it), a 1 pt gloss line 6 below the top edge fading out to the right (#343434 at its peak) | Hidden from screen readers, no touches, never animated |
| Island | Centre 72.7 along the frame from its origin and 30.7 below its top edge: (188.3, 395.6) here, (188.3, 465.2) on the reference; 57.3 × 24, rotated 12° | Black, a round left end and a square-cut right end (corners 8) showing pushr's flat lit end face: a 7.7 × 19 rounded rect (corners 4) at u 20.5–28.2 in illustrationBevel, 0.38 over its upper half fading to 0.16 low down, with black between it and the body as the seam; a 1.2 pt gloss line 5.5 above its axis (opacity 0.45 → 0.2) | Part of the phone |
| Title | x 24–369, line boxes y 492–564 (2 × 36), `ref.space.xl` 24 below the panel. [Ink 498.3–556; ref ink starts 29.3 below the panel, here 30.6 to the "l" ascender] | `ref.type.display`: Archivo ExtraBold (`Archivo_800ExtraBold`, stems 4.98 against pushr's 5.05) 30/36, +1.4 ("camera permission" spans pushr's 309), `textTransform: lowercase`, `ref.color.inkDisplay` #000000, left-aligned. `accessibilityRole="header"` | "let escapd use / the camera" (copy "Let ESCAPD use the camera"; the space in "the camera" is a non-breaking space, so it never strands "camera") |
| Body | x 24–369, line boxes y 578–666 (4 × 22 on the web, Inter Medium, widest line 339 of 345; expected 4 on iOS too), `ref.layout.permission.titleToBody` 14 below the title's box: title baseline to first body baseline 38.7 on the web (ref 39.1) | `ref.type.body`: system font Medium (500) 17/22 (pushr's line widths fit SF Pro Text Medium), `ref.color.inkMuted` #737373 (4.7:1), lowercase, left-aligned, ragged right | "you'll photograph three to six views of one room. each photo is re-encoded on your phone first, so its location never leaves it. nothing is sent until you develop the case." |
| Inline notice (only when set) | x 24–369, `ref.space.sm` 8 below the body; the sheet grows upward by 8 + its lines | `PermissionNotice`: `ref.type.meta` (Regular 13/16), `ref.color.inkMuted`, lowercase. Error: Phosphor `Warning` regular at `noticeIcon` 16 in `ref.color.raised`, centred on the first line, `ref.space.sm` before the text. Thinking (Library busy): the kit's `ThinkingStates` `ground="paper"` (meta, the sweep inkMuted → inkDisplay; a still inkMuted line under reduced motion), start-aligned | See States. `accessibilityLiveRegion="polite"` |
| Primary pill | x 24–369 (345 × 64), y 694–758, `ref.space.band` 28 below the body's box (32.6 below its last baseline, as measured) | The kit's `PillButton` primary (`ref.button.primary`): fill `ref.color.raised` #1E1E1E, full stadium (radius `ref.radius.round`), no border or shadow; label `ref.type.ctaLabel` Semibold 20/24 (pushr's "continue" ≈ 20 pt) `ref.color.textPrimary` #FFFFFF (16.7:1), centred | "allow the camera" (Default), "open settings" (Denied); accessibility label in sentence case |
| Quiet button | ≈ 214 × 48 (label ≈ 182 + 2 × `ref.button.quiet.padX` 16), centred, y 766–814, `ref.space.sm` 8 below the pill | The kit's `PillButton variant="quiet" ground="paper"` (`ref.button.quiet`): no fill, no border, at least 48 tall; label `ref.type.headline` Semibold 17/22 in `ref.button.quiet.paper.label` = the reference's grey `ref.color.inkMuted` (4.7:1), lowercase (a lowercased label string; the accessibility label keeps the copy) | "choose photos instead"; "choose a photo instead" in retake mode; "go to the light table" with a full roll |
| Light-table button (3–5 plates, not retake) | ≈ 190 × 48, centred, 8 below the quiet button; everything above moves up 56 (sheet top 262) | As the quiet button | "go to the light table" |
| Bottom | y 814–852 (38 = 34 safe area + `ref.space.ctaBottom` 4; `ref.space.lg` 16 with no bottom inset) | Sheet fill to the screen edge | – |

Rhythm: 24 gutter, 345 column; 150 panel; 24 panel to title box; 36 title lines; 14 title to body; 22 body pitch; 28 body to pill; 64 pill; 8 pill to quiet; 48 quiet; 38 bottom. Check: 318 + 150 + 24 + 72 + 14 + 88 + 28 + 64 + 8 + 48 + 38 = 852. The reference's sheet starts at 387.5; ESCAPD's starts 69.5 higher for its two-line title (+36) and the quiet button (+56), less its four-line body (−22) and the 2 pt tighter bottom.

### Tappable elements

Screen-reader order: title → body → notice (when set) → pill → quiet button → light-table button (3–5 plates). When the sheet enters, and after any switch to or from Denied, accessibility focus moves to the title (after `titleFocusDelay` 300 ms, or `motion.reducedFade` under reduced motion). Keyboard and switch focus: pill → quiet button → light-table button; the notice and the thinking lines are never focus stops. The focus ring is the kit's brass pill ring (`ref.focus`) round each button.

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| "allow the camera" | 345 × 64 | `requestPermission()` shows the OS alert with the app.json string. Granted: see Granted. Denied with `canAskAgain` false: switches in place to Denied. Denied but can still ask (Android's first deny): stays on Default. Throws: stays on Default with the error notice. Pressed: fill `raised` → `raisedPressed` #474747 over `ref.motion.control` 120 ms ease-out; no opacity or scale |
| "open settings" (Denied) | 345 × 64 | `Linking.openSettings()`. On return, the shell's `AppState` listener re-reads the permission on `active`: a grant goes to Granted; otherwise the sheet stays on Denied with no notice |
| "choose photos instead" | ≈ 214 × 48 | `useLibraryImport().pick()`: multi-select up to 6 minus the plates taken (1 in retake mode), each photo through `processPhoto` → `addPlate`, one at a time. If the roll reaches ≥ 3, push `/capture/review`. Retake mode: `replacePlate` → `router.back()` to the light table. Below 3 plates: stays, with the progress notice. Pressed: label `inkMuted` → `raised` over `ref.motion.control` |
| "go to the light table" | ≈ 190 × 48 | Push `/capture/review` (3–5 plates as a second quiet button; with a full roll in the first one's slot) |
| System back | – | No back control on screen (none in the reference). iOS edge swipe (`gestureEnabled: true` set by the shell), Android hardware back (`BackHandler`, only while /capture is focused) and VoiceOver's escape gesture (`onAccessibilityEscape` on the screen's root) all run the shell's close: `router.back()`, or `router.replace('/')` with no history; in retake mode back to the light table with the plate unchanged. Live in every state, Checking, Requesting and Library busy included. While the OS permission dialog is open it handles back itself |
| Ground, haze, sheet, panel, phone, text | – | Not tappable; no swipe-to-dismiss |

### States

- **Checking:** until `permission !== null` and, outside retake mode, the guide-seen check have both resolved. The white ground and haze alone: no sheet, no buttons, no spinner, nothing that flashes. Past ~1 s (`thinkingDelay` 1000) one line, "opening the rangefinder", appears centred on the screen (`ThinkingStates` `ground="paper"`, meta), accessibility label "Opening the rangefinder", announced once; it stops the moment Checking ends.
  - Guide not seen: `router.replace('/capture/guide')`; no sheet ever renders.
  - Guide seen (or retake mode), not granted: the sheet rises with `motion.sheetSpring` (damping 28, stiffness 320, mass 1) over the still ground.
  - Granted: straight to Granted with no sheet.
- **Default** (undetermined, can ask): the Layout table.
- **Requesting:** the pill is the kit's busy pill: label kept at full opacity, a small white `ActivityIndicator` 16 in from its right edge (the label is padded 44 both sides so it never shifts), taps ignored, `accessibilityState` { disabled, busy }, focus kept. The quiet button(s) are disabled at `ref.button.disabledOpacity.pill` 0.45. The OS alert covers the screen until `requestPermission()` resolves.
- **Granted:** the rangefinder (02) mounts and fades in over `motion.sceneCrossfade` 200 ms while the sheet slides out with `motion.sheetSpring` and the white ground and haze fade out over the same 200 ms, showing the shell's flat #101010 under the camera: one crossfade from white to the camera's dark, nothing else flashes. The status bar turns light at the end of the fade. A returning player with access already granted sees the white Checking ground only for the permission read, then the same crossfade. Reduced motion: every part is a `motion.reducedFade` 140 ms fade.
- **Denied, can't ask again:** new copy, crossfaded over `motion.reducedFade`; accessibility focus moves to the new title. Title "the camera is off" (one line), body "escapd can't ask again from here. turn on camera for escapd in settings, or choose photos you've already taken." (3 lines), pill "open settings"; the quiet button and the drawing are unchanged (no red, no slash). The sheet top drops to y 376 (one title line and one body line fewer); the buttons don't move.
- **Height changes** (Denied, a notice in or out, a light-table button joining): the sheet's top moves with `motion.sheetSpring`, its bottom and the buttons hold still. Reduced motion: the top moves at once, with the 140 ms text crossfade.
- **Library busy:** after the picker closes, the photos are re-encoded one at a time. The quiet button(s) (the kit's quiet pill, `disabled` and `busy`) keep their labels, dimmed to 0.45, `accessibilityState` { disabled, busy }, still focusable (Pressable stays focusable when disabled) (the button that started the import keeps focus); the pill is disabled at 0.45 with its label. The thinking line sits in the notice slot with real progress, "re-encoding photo 1 of 4" …, sized to "re-encoding photo 4 of 4"; its accessibility label "Re-encoding your photos" is announced once, count changes aren't. For one photo (retake mode or a single pick) it shows only past ~1 s. The buttons are drawn from the roll count as the import started until it ends (or, after the push to the light table, until /capture is focused again), so no light-table button joins mid-import.
- **Library partial** (< 3 plates): progress notice "1 plate on the roll. a case needs at least three." / "2 plates …" (inkMuted, no icon).
- **Library error:** error notice with the Warning glyph: "one of those photos couldn't be used. try another."
- **Request error:** the same error notice, "the camera didn't answer. try again."; stays on Default.
- **Roll ready** (3–5 plates, not retake mode): a second quiet button, "go to the light table", 8 below the first; the sheet is 56 taller (top y 262 in Default). Last in reading and focus order.
- **Roll full** (6 plates): one quiet button, "go to the light table", in place of "choose photos instead".
- **Retake mode** (`?retake=<i>`): the quiet button reads "choose a photo instead" (picks 1); no light-table button; the guide is never checked; leaving cancels the retake.
- **Pressed:** colour only, over `ref.motion.control` (pill fill #1E1E1E → #474747; quiet label #737373 → #1E1E1E). No opacity or scale.
- **Focus:** the kit's brass pill ring, 2 pt at a 2 pt offset, round each button while it has keyboard, D-pad or switch focus.
- **Large text:** all text scales and never shrinks; titles and labels wrap and the buttons grow past their minimums. The sheet grows upward to a cap `ref.space.lg` 16 below the safe top; past that the illustration panel is dropped (decorative), then the title, body and notice scroll while the buttons stay pinned.
- **Narrow and short screens:** the column is the width less 48; the haze and the phone keep their offsets from the screen's centre. With no bottom inset the last button sits `ref.space.lg` 16 above the edge.
- **Reduced motion:** opacity only. The sheet's entrance and exit, the Denied swap and Granted are 140 ms fades; height changes jump; thinking lines are still inkMuted lines that swap with a 140 ms fade. The haze and the drawing are static in every mode.

### User notes

- The user (2026-10-25): "follow the formatting and design as closely as you possibly can. pay attention to the colors, typography, icons, layout, and small details like shadows gradients border radius background z stacks, how things are being laid out."
- Screen decisions for this round: pushr's white ground and grey haze; the sheet with its measured corners; the light grey panel with the thick black tilted phone outline, its grey highlight band, cropped by the panel; the Archivo Black 30 pt lowercase title; the grey system-font body; the 64 pt black pill with a white semibold label; exact spacing, colours and radii. The reference's lowercase on this screen for the title, the body and the button labels, ESCAPD's own words. No back control (system back, plus VoiceOver's escape). Every state and behaviour kept; "choose photos instead" as a quiet text button in the reference's grey below the pill; a clean handover to the camera.

### Decisions

1. **Case:** every visible line is lowercase, as the reference: `textTransform: lowercase` on the title, body, notices and quiet labels; lowercased strings for the kit's pill label and the drawn thinking lines (neither takes a textTransform). The copy in `copy.ts` stays in sentence case, which is what screen readers hear (accessibility labels, header text), so "ESCAPD" is still read as the name. Notices and thinking lines weren't named in the brief; they follow the rest of the screen.
2. **Phone:** the reference's 3D render is redrawn as vector line art and fitted to its outline (corners, bands, tilt, crop within ≈ 0.5 pt), with its island and its few lights (left inner wall, right outer wall, gloss lines, the island's lit end). The day-one plan put rangefinder brackets inside the screen instead of the island; with the island where the reference has it there is no room for them, and the island is generic phone hardware, not a brand mark, so the reference's phone is kept.
3. **Haze:** fitted on this screen and now the kit's `PaperHaze` (`ref.gradient.haze`), shared with 05 so the two stay identical: the reference's bloom falls off faster to the right and downward and is white by y 288, which the old centred `ref.gradient.ambient` circle couldn't do.
4. **Quiet button:** the kit's quiet `PillButton` on paper, whose label is now the reference's grey (`ref.button.quiet.paper`); Library busy passes `disabled` and `busy` together for the dimmed, inert, still-focusable look.
5. **Pill busy:** the kit's busy pill (label kept, spinner at the right) replaces the play look's spinner-in-place-of-label.
6. **Notices:** meta 13/16 in inkMuted; an error is told by the Warning glyph in `raised`, never by colour (the reference has no accent).
7. **Checking:** white ground and haze only, no spinner, no back control; a thinking line only past ~1 s.
8. **Handover:** the shell's own ground is now 02's #101010 (no grain, no silk); 03 lays its white over it and fades it out with the sheet on a grant. The status bar turns dark only while /capture shows 03 and back to light at the end of the fade or on blur, so the light table and the rest of the app keep light glyphs.
9. **Back:** no on-screen control. The iOS edge swipe is explicitly on for /capture, Android back and VoiceOver escape call the same close; retake mode's "Cancel retake" is now that system back.

### Needs you

- **Large text cap:** with no back control the sheet may rise to 16 pt under the status bar before the panel drops. Confirm, or keep more white above it.
- **Returning players:** with access already granted, the white Checking ground shows for the permission read before the crossfade to the dark camera (one 200 ms crossfade, as asked). Keeping 02's dark ground until the read says the sheet is needed would remove it for returning players but give first-timers a dark-to-white change instead.

## 04 · First-time photo guide

Reference: docs/refs/04-photo-tutorial.png (Apple Health, "Use Camera to Add a Medication"), measured at 2.038 px/pt on a 393 × 852 pt screen (safe areas 59 / 34); the Mobbin footer from y 1735 px is not part of the design. This round matches it as closely as the platform allows: colours, glass disc, illustration style, type, pill and spacing. ESCAPD keeps its own copy, its own four drawings and every behaviour. Every value is a `ref` token from `src/theme/tokens.ts` (`ref.color`, `ref.type`, `ref.space`, `ref.button.dismissGlass`, `ref.button.ghost`, `ref.gradient.deviceFill`, `ref.icon.illustrationStroke`, `ref.focus`) plus the screen's own `ref.layout.guide`; the warning icon uses the live `color.warning`, as the other screens' error lines. No silk, grain, light pool, mount, Playfair, mono stamp, brass or oxblood.

Route: `app/capture/guide.tsx` (`/capture/guide`; `?replay=1` when opened from 01's How you play sheet), rendering `src/screens/guide/PhotoGuide.tsx`. Shown once, before the first camera session.

Files: `PhotoGuide.tsx` (layout, routing, back, swipe, announcements), `CloseButton.tsx` (the glass disc), `GuideArt.tsx` (the art band and its large-text sizing `artBox`), `art/` (the four scenes as data: `types.ts`, `geometry.ts`, `scenes.ts`, `draw.ts`, `StepArt.tsx`), `GuideText.tsx` (title and body), `StepButton.tsx` (the kit's ghost `PillButton`), `ReplayErrorLine.tsx`, `stepper.tsx` (the crossfade), `swipe.ts`, `useReplayCheck.ts`, `copy.ts` (every word). Tests: `src/screens/guide/__tests__/guide-test.tsx` (behaviour and look) and `art-test.tsx` (drawings and art sizing).

### Feel

A dark room before the lights come up. One small line drawing floats in a big black field; the words and the single button sit in the bottom third. Nothing glows and nothing casts a shadow. Hierarchy comes only from brightness: a white hero line, grey lines behind it, a bold white sentence that runs into a grey one, and a button you can barely see. The only light object is the grey glass disc that lets you out. Four calm beats before the first plate, not a feature tour.

**Accent on this screen:** none. The only brass is the focus ring (`ref.focus`, the user's decision), and only while a control has keyboard, D-pad or switch focus.

### Layout, top to bottom

Default text size, 393 × 852. The title, body and button block is bottom-anchored, so it grows upward. Measured positions of the web render (Inter in place of SF Pro) against the reference are in brackets.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Solid `ref.color.void` #000000. Nothing else: no still, grain, glow or vignette (the reference is 0 everywhere). | — |
| Status bar | y 0–59 (safe-area top) | System, light content (root layout) | — |
| Close disc | Outer x 311–361, y 69–119 (50 × 50, centre 336, 94): top = safe top + `ref.layout.guide.close.top` 10, right inset `close.right` 32 [ref 311.4–361.9 × 68.7–119.3; render 311–361 × 69–119] | `ref.button.dismissGlass`: a 48 disc of `glassDisc` #848484 inside a 1 pt (`ringWidth`) specular ring, drawn as one react-native-svg circle. The ring is `close.ring`, a linear gradient at CSS 135°: `specularLightAlt` #AAAAAA at 0.15 (upper left), #A0A0A0 at 0.25 (top and left), #8D8D8D at 0.5 (upper right, lower left), #939393 at 0.75 (right and bottom), `specularLight` #B6B6B6 at 0.85 (lower right) [measured 170 / 160 / 141–144 / 144–149 / 182]. No shadow, no blur (the reference is probably Liquid Glass; on pure black the solid grey looks the same). | Phosphor `X`, regular, `dismissGlass.icon` 26 (16.2 of ink, stroke 1.6, as measured), `dismissGlass.glyph` (`inkDisplay` #000000), centred. A dark glyph on a light disc. |
| Top void | y 119–266 (147, `ref.layout.guide.voids.above`) [ref 147.2] | Empty black | — |
| Illustration | Art box x 76.5–316.5 (240, `ref.layout.guide.art.width`), y 266–532 (266, `art.height`), centred on the screen. Ink about 131–158 wide, no wider than `art.inkMax` 170 [ref ink 131 × 265 at x 126.6–257.6; render step 1 x 124–257, y 269–529] | Line art in react-native-svg, round caps and joins, `ref.icon.illustrationStroke` 1.75 (the reference's lines integrate to 1.75–1.9). Depth from brightness only, and only a subject's outline takes its depth's ink: detail inside it is a step dimmer (back, ridge or print), as the reference's cap ridges and label lines are. **Inks:** hero `ref.color.textPrimary` #FFFFFF (the phone taking the shot); mid `lineMid` #DDDDDD (the main object's silhouette); back `lineBack` #7F7F7F (the object behind, and the main object's inner detail); context `lineContext` #555555 (the hand, an envelope, every view ray). **Thin** (`ink.thin` 1): the phone's bezel (`lineBack`, 1.3 inside the outline at corners 9.2, `phone.bezel`: the reference's darker shoulder inside its white edge), the phone's inner screen edge, a vertical gradient `lineContext` → `ink.screenBottom` #323232 [ref #555555 → #323232], and `ink.ridge` #3C3C3C details inside dark shapes. **Print** on a lit panel: `ink.text` #A8A8A8 (first line), `ink.textDim` #585858. **Fades:** context lines that run off the bottom (and step 2's walls) fade from their ink at art y `ink.fade.from` 170 to nothing at `ink.fade.to` 266 (measured on the reference's palm line: 77 at y 172, 33 at 224, 7 at 256, 0 at 266; its fingers don't fade); step 2's rays and step 3's desk edges fade over their last `ink.endFade` 40. Every fade is a gradient with plain hex stops and separate `stopOpacity`. **Fills** (opaque, so a shape hides what is behind it): `void` #000000; `device` = `ref.gradient.deviceFill` (180°: #424242, #343434 at 0.13, #1E1E1E at 0.28, #0C0C0C at 0.42, #000000 from 0.56, as measured) inside every phone; `fill.panel` (235°: #6B6B6B → #000000 at 0.75, the reference's bottle label) on lit faces; `fill.tag` (180°: #474747 → #0D0D0D, its box label) on small labels, books and pictures. **Overlap:** back objects tuck 8–10 behind the mid one, as the reference's box behind its bottle. **Hero phone** (steps 1, 3, 4, at art (95, 108), the reference's place): `ref.layout.guide.phone` 70 × 137, corners 10.5; inner screen inset 13 / 24.5 / 27 (44 × 85.5), corners 10. **Hand** (steps 1, 4): thumb pad and palm edge to the left of the phone and the wrist under it (fading down), the index finger hooked round the top of the right edge (behind the phone), and three fingertips over the right edge: void-filled lobes about 14 wide, wide at the top right and tapering down, each tucked under the one above, at x 162–179 / 161–176 / 163–180 and y 180–209 / 203–230 / 217–244, so together they hide the phone's edge from y 181 to 242. No brackets, no brass. | One scene per step (see Steps) |
| Gap | y 532–613 (81, `voids.below`; the reference's two-line title leaves 52) | — | — |
| Title | x 38–355 (317), line box 613–641 (one line; a second line grows it upward) [ref two-line block 584–641, baselines 605.9 / 634.4; render ink 618.7–639.3] | `ref.type.stepTitle`: system font Bold 22/28, `textPrimary`, left-aligned, `accessibilityRole="header"` | Step title |
| Gap | 641–644 (`ref.layout.guide.titleGap` 3) [ref baselines 30.4–30.9 apart] | — | — |
| Body | x 38–355 (317), line boxes 644–672 and 672–700 [ref ink 649.9–693.5; render 649.7–694.3] | `ref.type.stepBody`: system font Regular 22/28, `ref.layout.guide.bodyText` #999999 (a touch lighter than the shared `textSecondary` #949494: the reference's blurred glyph cores read #95–#9B and peak at #A5–#AA), left-aligned, at most two lines | Step instruction |
| Status gap | 700–762 (62, `ctaGap`): `statusTop` 23, the status line box 723–739 (16), `statusBottom` 23 [ref 62.5 from the last line box to the pill] | Empty except in replay's wait and error | — |
| Step pill | x 38–355 (317), y 762–814 (52). With larger text it grows upward; its bottom stays at 814 [ref outer 37.7–356.1 × 761.1–814.6; render 38–355 × 762–814] | The kit's `PillButton variant="ghost"` (`ref.button.ghost`): full capsule, fill `shade` #0A0A0A, a solid 1 pt `hairline` #1A1A1A edge [ref #1C1C1C top, #181818 bottom], no shadow. Label `ref.type.headline` (Semibold 17/22) `textPrimary`, centred [ref label ink 179.5–214.3 × 782.3–794.0; render 178.7–215.3 × 781.7–794.3]. Side padding 44 (it can show the busy spinner). | "Next" on steps 1–3, "Open the camera" on step 4. Same pill on every step. |
| Bottom | 814–852 (38) = safe bottom 34 + `ref.space.ctaBottom` 4 [ref 36.7–37.7] | Black | — |

Check: 59 + 10 + 50 + 147 + 266 + 81 + 28 + 3 + 56 + 62 + 52 + 4 + 34 = 852.

**Gutters.** `ref.space.reading` 38 on both sides for the title, body, status line and pill [ref 37.8–39.3]. The disc is not on this gutter (right inset 32). The art box is centred on the screen.

### Steps

The copy paraphrases `src/capture/slots.ts` (plates I–IV) and the light-table checklist. Every object is ESCAPD's own; steps 1 and 4 borrow the reference's composition (a mid object at the upper left, a back object behind it to the right, the hero phone held in front at the lower right), step 3 keeps the phone in the same place without the hand, and step 2 is a plan.

| # | Title | Body | Scene (ESCAPD's own drawing) | Pill |
|---|---|---|---|---|
| 1 | Start at the doorway | One wide plate. Get the floor and two walls in. | A door casing (mid silhouette, void-filled) seen a little from the left: the head and right jamb show their depth (`tag` fill, back edges), the door stands open inward as a lit sliver (mid, `panel` fill) with its knob (back). Beyond it the far corner (back): the wall join and the floor along both walls. A framed picture (back, `tag` fill, a ridge mountain) hangs to the right, its left 8 tucked behind the casing; the near wall's foot (back) runs from the casing to behind the phone. The hand holds the hero phone in front. | Next |
| 2 | Work around the room | The far corner, then the busiest wall. Let plates overlap. | A plan (back): walls with their thickness (double line, 5 apart) fading toward the near wall, so there is no hard bottom edge; the doorway a gap in it; a shelf (back, `tag`, ridge books) along the busiest wall. Three phones seen from above (22 × 42, corners 5, `ref.layout.guide.planPhone`, `device` fill along their heading): plate I just inside the doorway and plate III aimed at the shelf (back), plate II aimed at the far corner (hero; its view a `device`-filled wedge). Every view's rays are context and fade over their last 40; plate I's view overlaps both others. | Next |
| 3 | Get one close view | A desk, shelf, or table. Small things make good clues. | Top down onto a desk corner (back; its two edges fade over their last 40, the near one 11 below the phone). An open notebook (mid) from art y 8: the left page void with writing, the right page lit (`panel`) with writing (`text` first lines, `textDim` the rest). A key (back, `tag` bow, ridge hole) beside it. The hero phone held flat above, at the same place as steps 1 and 4; no hand. | Next |
| 4 | Keep the case private | No people, mail, or lit screens. Lights on, hold steady. | A bookcase: its silhouette and right side mid, its inner frame, shelves and books back (`tag` / `panel` / void spines, `textDim` spine labels). A lit lamp behind it to the right (back, `panel` shade, three ray ticks), the shade's lower left tucked behind the case's side. An envelope (context) outside the shot at the lower left. The hand holds the hero phone in front. | Open the camera |

### Tappable elements

Screen-reader order: Close → title → body → pill (the drawing is hidden). Keyboard and switch focus: Close → pill. When the screen opens (its route transition ends) and after every step change, accessibility focus goes to the title and the screen announces "Step n of 4" (queued). The pill's accessibility hint is "Step n of 4", so the count stays discoverable with no step label on screen.

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| Close disc | 50 × 50, the whole disc | **First run:** skips the guide. Sets the session flag (`captureGuideSeen = true`), starts the AsyncStorage write `escapd:onboarding:capture-guide` = "1" without awaiting it, then `router.replace({ pathname: '/capture', params })`, carrying the route's params. accessibilityLabel "Skip the guide". **Replay:** sets the same flags, then `router.back()` to the hub (`router.replace('/')` with no history). accessibilityLabel "Close the guide". Pressed: the whole disc at `dismissGlass.pressedOpacity` 0.75. |
| Next (steps 1–3) | 317 × 52 (taller with large text), the whole pill | Moves to step n + 1: the drawing, title and body crossfade; the disc and the pill stay put. Taps during the 200 ms transition are ignored. Pressed: the fill cross-fades to `ghost.pressedFill` `raised` #1E1E1E over `ref.motion.control` 120 ms (the kit's press; a proposal, the reference shows none). |
| Open the camera (step 4) | 317 × 52 (taller with large text) | Sets the session and storage flags, then `router.replace('/capture')` with the carried params. The opener has already checked access; /capture shows 03 if the camera isn't allowed yet, otherwise 02 at plate I. **Replay:** in order, sets the session flag and starts the storage write, then calls `openCapture({ replace: true, skipGuide: true })` (01's YOUR ROOM check). With access it replaces to `/capture`; without, to `/account?next=back` (guest), `/pro?cap=<n>` (no `custom_rooms` entitlement) or `/capture/develop?from=hub` (monthly cap reached). Whichever route it takes, the guide leaves the stack and back returns to the hub. Pending and failure: Replay wait and Replay error. |
| Horizontal swipe | Full width, y 119–762 (between the disc and the pill) | `usePanGesture` with `activeOffsetX` ±16, `failOffsetY` ±16 (`ref.layout.guide.swipe`). Commits on release when \|dx\| ≥ 56 or \|vx\| ≥ 500 pt/s. Left = next (steps 1–3), right = previous (steps 2–4). The content doesn't track the finger; a committed swipe runs the same crossfade. A left swipe on step 4 and a right swipe on step 1 do nothing. The buttons remain the accessible path. |
| iOS swipe-back | System left edge | Enabled on step 1 only (`navigation.setOptions({ gestureEnabled: step === 0 })`). Leaves to the opener without setting the flag. |
| Android hardware back | — | Step 2 or later: the previous step, same crossfade. Step 1: `router.back()` to the opener (`router.replace('/')` with no history), without setting the flag. Ignored mid-transition and once the guide is leaving. |
| Drawing, title, body | — | Not tappable. The art band is `accessible={false}` and hidden from screen readers. |

**Entry rule.** Unchanged: four places call `openCapture({ replace?, skipGuide?, signal? })` in `src/capture/openCapture.ts` (01's YOUR ROOM, guide replay's step 4, `/pro` after its test purchase, /tutorial/complete). It checks access first (guest → `/account?next=back`; no `custom_rooms` → `/pro`; cap reached → `/capture/develop?from=hub`; check can't run → rejects), then, unless `skipGuide`, the seen flag (session flag, else AsyncStorage "1" → `/capture`; anything else or a failed read → `/capture/guide`). /capture without `?retake` keeps the same flag check as a backstop. Retake mode never shows the guide, and the guide never asks for camera permission.

### States

- **Default:** steps 1–4 as in the tables, the same ghost pill on every step.
- **Final step:** only the label changes, "Next" → "Open the camera", at once; the pill's slot reserves the longer label's height (its lines + 30), so nothing above moves. Going back from step 4 reverses it.
- **Pressed:** the pill's fill cross-fades `shade` → `raised` over `ref.motion.control` (the kit's PillButton; no opacity or scale change). The disc at 0.75 opacity.
- **Focus:** the kit's brass ring (`ref.focus`: 2 pt `color.accent`, 2 pt outside), a circle round the disc (`FocusRing shape="pill"`, 58 across) and a capsule round the pill (drawn by PillButton). Never removed while focused.
- **Transition:** the drawing, title and body crossfade over `motion.sceneCrossfade` 200 ms, with no drift. The disc and the pill stay still.
- **Reduced motion** (`useTheme().reducedMotion`): the crossfade becomes `motion.reducedFade` 140 ms opacity. The pill's press is a colour change and stays. Nothing else animates.
- **Disabled:** none. The disc and the pill are always enabled; taps during a transition are ignored rather than shown as disabled.
- **Loading:** none in first-run mode (the opener owns `openCapture()`'s wait; the art is bundled SVG). Replay has one real wait.
- **Replay wait:** on tap, "Open the camera" goes `busy`: the label stays, the small native spinner (20, the label's white) appears 16 in from the pill's right end, the fill stays at full opacity, further taps are ignored and `accessibilityState` is `{ busy: true, disabled: true }`. If the check runs past 1 s (`ref.layout.guide.thinkingDelay` 1000), one line appears in the status slot: the kit's `ThinkingStates` (`variant="meta"`, ground dark), "Checking the file", no rotation, `ref.type.meta` (Regular 13/16), centred, line box y 723–739, shimmer `ref.motion.thinking.shimmer` (`textSecondary` → `textPrimary`, band 0.8, 2000 ms linear), accessibilityLabel "Checking access", announced on mount. It unmounts the moment the check returns or navigates. Reduced motion: the still line in `textSecondary`.
- **Replay error:** same slot, centred: Phosphor `Warning` 16 (`ref.layout.guide.errorIcon`) in `color.warning` #D4883A, centred on the first meta line and hidden from screen readers; `ref.space.sm` 8; "Couldn't reach the darkroom. Try again." in `ref.type.meta`, `textSecondary`. The row is a polite live region (announced on iOS) but not an accessibility element, so focus stays Close → pill. The pill returns to idle and stays live; a retry clears the line and re-enters Replay wait. Leaving step 4 (back or swipe) drops a running check.
- **Error:** storage errors are silent. A failed read shows the guide once per session; a failed write shows it again on the next launch. Neither can loop: the disc and "Open the camera" set the session flag before leaving, and /capture checks it first. No network calls in first-run mode.
- **Permission denied:** not handled here; 03 handles the camera after the guide.
- **Large text:** text honours system scaling and never shrinks. The disc stays pinned. The title, body and pill grow upward from 814: the pill first (its label's lines + 30, never under 52; the label may wrap within its 44 side padding), then the title and body rise. The art band gives way in order: the 81 under the drawing down to `voids.clear` 24, then the 147 above it down to 24, then the drawing shrinks evenly (strokes thin in proportion), 24 clear above and below; below `art.minHeight` 120 (scale 0.45) it hides. If the block still doesn't fit, the title and body scroll while the pill stays pinned (scrolling is enabled only on overflow, so at rest it is no focus stop).
- **Narrow screen:** gutters stay 38; the column is width − 76 (299 at 375, 284 at 360). The disc keeps its 32 inset. A short screen (375 × 667, safe 20 / 0) leaves the band about 380: the voids go toward 24 and the drawing keeps its full size or shrinks a little.
- **Replay:** identical layout. Only the disc's behaviour and step 4's access check differ.

### User notes

> "taking photos step by step short tutorial for first onboarding."

> Round 3: "you need to follow the formatting and design as closely as you possibly can. pay attention to the colors, typography, icons, layout, and small details like shadows gradients border radius background z stacks, how things are being laid out."

How the notes are honoured:
- **Step by step:** four steps, one idea each. Next and swipe move forward; swipe, Android back and step 1's iOS edge move back. The count is spoken ("Step n of 4") rather than shown, as the reference shows none.
- **Short:** a three- or four-word title and an instruction of at most two lines per step; nothing scrolls on 393 × 852 at the default size, and the disc skips the whole guide at any step.
- **First onboarding:** shown only before the first camera session, after the access check, gated by a per-device flag; replay is opt-in from 01's How you play sheet.
- **As close as possible:** the ground, disc (size, fill, ring, glyph), phone (size, corners, fill gradient, inner screen), stroke weight and greys, the hand's fade, title and body type, column, gaps and the pill land within about 1 pt and 2 levels of the reference in the web render.

### Decisions

1. **Look:** Apple Health's reference replaces the play screen's look on this screen: `ref.color.void` ground, system font, the glass disc and the ghost pill. No silk, grain, mount, Playfair, mono stamp, brass or oxblood (round 3).
2. **No step label:** "BEFORE YOU SHOOT · n OF 4" and the plate label are gone. Screen readers get "Step n of 4" as the announcement after each step change and as the pill's accessibility hint.
3. **One pill on every step:** the ghost pill on all four steps; step 4's label is "Open the camera". Replay's wait is the pill's `busy` with its spinner, the label kept.
4. **Close disc:** the reference's grey glass disc, solid (react-native has no Liquid Glass): 48 + a 1 pt two-highlight specular ring = 50, the black Phosphor X at 26. First run: skip to the camera, marked seen; replay: back to the hub.
5. **Illustrations:** ESCAPD's four scenes redrawn in the reference's style: white hero phone with the device gradient and a thin inner screen, mid / back / context greys, opaque black and gradient fills (`panel`, `tag`), the hand and rays fading. The viewfinder brackets are gone (they were brass, and the reference's phone shows only its inner screen).
6. **Spacing:** the reference's measured positions: disc 10 below the safe top and 32 from the right; drawing 147 below the disc; title-to-body 3; 62 above the pill; pill bottom at safe bottom + 4; gutters 38. ESCAPD's titles are one line, so the text block is bottom-anchored and the gap above the title is 81 (the reference's two-line title leaves 52).
7. **Seen flag, swipe, replay, entry rule, paywall timing:** unchanged from round 2.
8. **Errors on dark:** the warning icon in `color.warning` with the message in `textSecondary`, as the other screens; never coloured text.
9. **Focus ring:** brass, the kit's (user decision).

### Needs you

1. **Pressed states are proposals.** The reference shows none: the pill uses the kit's `shade` → `raised` cross-fade and the disc the 0.75 opacity. Keep, or match another screen?
2. **Warning colour.** The replay error keeps `color.warning` orange on the icon (as Pro, the camera and the permission sheet do). The reference look has no warning colour; a grey icon would be closer to Apple Health. Keep the orange?
3. **Step 2 is a plan, not the reference's composition.** It reads as a diagram (three phones, overlapping views) rather than the hand-held phone of steps 1, 3 and 4. Keep it, or redraw step 2 as another held-phone scene (for example the phone framing the busiest wall with the far corner behind)?

## 05 · Pro (test paywall)

Reference: none of its own. Modelled on `docs/refs/03-camera-permission.png` (pushr), the same kind of single decision in the same capture flow, on its day-one spec (`out/fixed/03-camera-permission.md`) for the measured values, and on the 03 build (`src/capture/ui/permission/`) for shared behaviour. 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a `ref` token from `src/theme/tokens.ts` (the reference look), the kit's `PaperHaze` and `PillButton`, and the screen's own `ref.layout.pro` block, plus `motion.sheetSpring` / `motion.reducedFade` for the sheet's entry (as 03). No silk, Grain, brass stamp, Playfair, manila slip, live `color.*` or 8 pt Button.

Route: `app/pro.tsx` (`/pro`, optional `?cap=<n>`), re-exporting `src/screens/pro/ProScreen.tsx`. `openCapture()` pushes it, or replaces with it, when the player has an email account but no `custom_rooms` entitlement. It sits in the root Stack with the same fade as every route; the iOS edge swipe stays on.

Files: `ProScreen.tsx` (layout, Loading indicator, sheet entry and cap, status bar), `CaseFilePanel.tsx` (the panel and its art), `ProNoticeLine.tsx` (error and info lines), `useProFlow.ts` (states, routing, test purchase; unchanged), `useFocusOnOpen.ts`, `useOverflowScroll.ts` (now also reports the content's height), `copy.ts` (every word). `BenefitSlip.tsx` is deleted. Tests: `src/screens/pro/__tests__/pro-test.tsx` (46).

### Feel

pushr's sheet, holding ESCAPD's offer. The upper third is white paper with the one soft grey bloom, a room not yet in focus. A full-bleed white sheet rises from the bottom; its cool grey top panel holds a case file drawn exactly as pushr draws its phone (the same heavy black frame, corners, lean and lights, cut off by the panel's edge), with a folder's tab in its top edge and a solid label where the phone has its island. Under it: a blunt, extended black title, three short grey lines saying what Pro does, one small grey note, the heavy black pill and a quiet grey way out. No shadow, scrim, grabber, colour accent, price or badge; all the hierarchy is weight and size.

### Layout, top to bottom

Default, test build (`EXPO_PUBLIC_TEST_PURCHASES=1`), default text size. The sheet is content-sized and bottom-anchored, so it grows upward. Positions measured on the web render (shared harness `pro` and the `pro-test` copy), which match the stack below to the pt.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Ground | Full screen | `ref.color.paper` #FFFFFF painted by the root view. No camera, silk, Grain or scrim | — |
| Status bar | y 0–59 | Dark glyphs: `setStatusBarStyle("dark")` while /pro has focus, `"light"` on blur (as `/capture`) | System |
| Haze | Up and right of centre; white by y ≈ 287 | The kit's `<PaperHaze />` (`ref.gradient.haze`: `ambientCore` #D4D4D6 in a radial gradient with its focal point up-right of its centre, paper fading in over its foot; 03's fitted haze). Static in every mode | Decorative, hidden |
| Void | y 59–316 | Paper and haze. The sheet's top never rises above safe top + `ref.space.lg` 16 (y 75), as 03 | — |
| Sheet | x 0–393, y 316–852 | `ref.color.paper`, top corners `ref.radius.sheet` 16 with `ref.curve`, square bottom corners, `overflow: hidden` (clips the panel). No shadow, hairline, grabber or scrim; not dismissable by swipe. Its top is 71.5 above the reference's 387.5: a second title line (+36), the note row (+24) and "not now" (+56), less two body lines (−44) and 2 for the 14 title gap, less the last button ending at safe + 4 instead of + 6.1 (+2) | — |
| Panel | x 0–393, y 316–466 (`ref.layout.pro.panelHeight` 150) | `ref.color.panel` #F3F5F7, the sheet's top corners, crisp foot. Clips the art | — |
| Case-file art | Ink x 115.7–272.3 (156.7 wide; 03's phone 157), ink top 38.3 below the panel top (03: 38.6), cropped at the panel's foot | react-native-svg, `ref.layout.pro.art`, drawn as 03's phone (`ref.layout.permission.phone`): frame origin `dx` −80.9 from the panel's centre and `top` 28.8 below its top, `width` 157, drawn `length` 160, sheared by `slope` (tan 14°, `ref.effect.illustrationTilt`) so the top falls right and the sides stay upright. A solid `ref.color.inkDisplay` frame with elliptical outer corners (`outer` 44 × 40 left, 30 × 36 right), bands `band` 18 left / 18.5 right / 16 top, tight inner corners (`inner` 8 × 18, 19 × 27); the inside in `ref.color.panel`. The folder: `tab` the top edge runs to 62, then a shoulder falls 18 over 16 to the body's edge, both bends rounded over 6; the right corner sits on the body's edge. 03's lights, all `ref.color.illustrationBevel` #929090 at stop opacities: `bevel` the lit inner wall down the left (9 wide, full from 37.5, 0.2 round the corner); `sheen` the outer wall down the right (7.6 wide, 5.6 in, 0.35 ≈ #333 round the corner to 48 below the body edge, 0.16 ≈ #171717 below, fading in over 15); `gloss` a 1 pt line 6 inside the top band, following the tab, peak 0.36 at x 36, gone by 125. `label`: a black stadium 50 × 23.6 (03's island 57.3 × 23.6, narrower to clear the inner corner), its left end 78 along the frame, 3 below the body band's inner edge, with the island's gloss line (1.2 wide, 5.5 above its axis, 0.45 → 0.2) | Decorative: the panel is `accessible={false}`, hidden, `pointerEvents="none"` |
| Title | x 24–369, line boxes 490–526 and 526–562 (2 × 36), `ref.space.xl` 24 below the panel. Ink top 30 below the panel (ref 29.3); first baseline ≈ 51.5 below it (ref 51.2). "open a file on" ≈ 211 wide, "your own room" ≈ 238 | `ref.type.display`: Archivo Black 30/36, +0.25, lowercase on screen, `ref.color.inkDisplay` #000000 (21:1), left-aligned. `accessibilityRole="header"` | "Open a file on your own room" (sentence case for screen readers; shown "open a file on / your own room"). The two spaces in "your own room" are U+00A0. No full stop, as the reference's title |
| Body | x 24–369, line boxes 576–598, 598–620, 620–642: `ref.layout.pro.titleGap` 14 below the title, so title baseline → first body baseline ≈ 39 (pushr 39.1) | `ref.type.body`: system font 17/22, weight 400, `ref.color.inkMuted` #737373 (4.7:1), `textTransform: "lowercase"`, left-aligned, ragged right. Three lines, one sentence each, pitch 22 like the reference paragraph. Each is a `Text`: one screen-reader element, never a keyboard stop | "Your room becomes the case." / "The clues hide in your things." / "Up to {generations_cap} new cases a month." Cap unknown: "A monthly allowance of new cases." Shown lowercase (ink 234, 225 and 275 wide on the web) |
| Note row | x 24–369, y 650–666 (`ref.space.sm` 8 below the body). Always reserved: `minHeight` = `ref.type.meta.lineHeight` 16 × fontScale × `ref.layout.pro.noteLines` 1 | `ref.type.meta` 13/16, weight 400, `inkMuted`, lowercase: 03's small grey. At rest it holds the test note, hidden from screen readers (its words are the pill's hint). An error takes its place (States) | "Test purchase" (shown "test purchase") |
| Primary pill | x 24–369 (345 × 64), y 694–758 (`ref.space.band` 28 below the note row) | The kit's `PillButton` primary: fill `ref.color.raised` #1E1E1E, `ref.radius.round`, no border or shadow; label `ref.type.ctaLabel` 20/24 600 (pushr's "continue"), `ref.color.textPrimary` #FFFFFF (16.7:1). `spinner` reserves 44 each side | Label "unlock pro" (a lowercased string); a11y label "Unlock Pro", hint "Test purchase. Nothing is charged." |
| not now | y 766–814 (48), `ref.space.sm` 8 below the pill; label + 16 each side (≈ 63 + 32), centred on x 196.5 | The kit's `PillButton variant="quiet" ground="paper"`: `ref.button.quiet` (48 tall, `padX` 16), label `ref.type.headline` 17/22 600 in `ref.button.quiet.paper.label` = `inkMuted` #737373 (4.7:1). No fill, border or shadow | Label "not now"; a11y label "Not now" |
| Bottom | y 814–852: safe 34 + `ref.space.ctaBottom` 4 (with no bottom inset, `ref.space.lg` 16, as 03) | Paper | — |

Check: 316 + 150 + 24 + 72 + 14 + 66 + 8 + 16 + 28 + 64 + 8 + 48 + 34 + 4 = 852.

**Test purchases off** (every production build today; the shared `pro` harness target): the note row reserves two meta lines (`infoLines` 2, 32 tall, y 634–666) for "Pro isn't on sale yet. If you're testing, ask for access, then check again." (2 lines on the web, ≈ 321 + 106), so everything above sits 16 higher (sheet 300, panel 300–450, title 474–546, body 560–626). The pill reads "check again". Rendered: panel 300–450, art ink 338.3, title ink 480, note ink 637–666, pill 694–758, "not now" ink 785–796.

**Gutters.** `ref.space.xl` 24 both sides for the title, body, note row and pill (03's 345 column). "not now" is centred.

**No visible back control,** as in pushr. "not now", Android back, the iOS edge swipe and VoiceOver's escape gesture (`onAccessibilityEscape` on the root) are the exits.

**Copy, and what it's grounded in.** Every string in `copy.ts` is sentence case, which is what screen readers hear; the screen shows it lowercase, as the reference does (`textTransform: "lowercase"` for text, lowercased label strings for the kit's pills with the sentence-case copy as their accessibility labels), the same split as 03.

| Slot | Copy | Grounded in |
|---|---|---|
| Title | Open a file on your own room | The previous statement, without its full stop (the reference's title style). What Pro unlocks: the `custom_rooms` entitlement |
| Line 1 | Your room becomes the case. | The previous slip line 01; 3–6 plates of one room become a playable case |
| Line 2 | The clues hide in your things. | Slip line 02; the darkroom hides clues among the objects it finds |
| Line 3 | Up to {generations_cap} new cases a month. / A monthly allowance of new cases. | Slip line 03; `get_my_access().generations_cap`, never hard-coded |
| Note | Test purchase | The previous TEST PURCHASE stamp |
| Pill | Unlock Pro / Check again | Unchanged |
| Quiet | Not now | Unchanged |
| Info | Pro isn't on sale yet. If you're testing, ask for access, then check again. | Unchanged |
| Errors | You're offline. Connect and try again. / Test purchases are off on this server. / Couldn't unlock Pro. Try again. | Unchanged |

Dropped with the dossier look: the "CASE FILE · ESCAPD PRO" stamp and the "WHAT PRO OPENS" slip heading (pushr's structure has nothing above the sheet and no heading over its body).

### Tappable elements

Screen-reader order: title (header) → the three lines → the error or info line (the test note is hidden) → the pill → "not now". Keyboard and switch focus: the pill → "not now" (the title-and-lines ScrollView is scrollable, and so an Android keyboard stop, only while it overflows). When the screen opens, accessibility focus moves to the title once the opening transition has ended (at once for a root route).

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| "unlock pro" (test build) | 345 × 64 (taller with large text) | Purchasing (States). Ignored while busy. Pressed: fill `raised` → `ref.color.raisedPressed` #474747 over `ref.motion.control` 120 ms (no opacity or scale). Focus: the kit's brass pill ring (`ref.focus`) |
| "check again" (test purchases off) | 345 × 64, the same slot | Re-runs `ensureSession()` + `getMyAccess()` with the pill busy. Entitled → Already has access. Not entitled → stays, refreshes line 3's cap and announces "No access on this account yet." |
| "not now" | ≈ 95 × 48 | `router.back()`, or `router.replace('/')` (the hub) with no history. Changes nothing. Disabled at `ref.button.disabledOpacity.pill` 0.45 during Purchasing and check again. Pressed: label `inkMuted` → `raised` (the kit's quiet paper press). Focus: the brass pill ring |
| Android hardware back | System | Same as "not now", in every state, Purchasing included. Leaving aborts the focus's AbortSignal, so a late result never navigates |
| iOS edge swipe | System left edge | Enabled. Same as Android back |
| VoiceOver escape (two-finger Z) | Root view | `onAccessibilityEscape` → the same as "not now" |
| Haze, panel, art, title, lines, note | — | Not tappable. No swipe-to-dismiss: the sheet is the route, not a modal |

**Entry rule (section 04's `openCapture()`)**, unchanged: guest → `/account?next=back`; no `custom_rooms` → `/pro?cap=<generations_cap>` (push, or replace); entitled but cap reached → `/capture/develop?from=hub`; otherwise the guide the first time, else `/capture`.

### States

- **Default:** as in Layout. Opened from `openCapture()` with `?cap=`, the sheet is in place on the first frame, with no second access check and no entry motion.
- **Loading** (no usable `?cap`: a deep link, a restored route): paper and the haze only, no sheet. If `getMyAccess()` is still running after `ref.layout.pro.spinnerDelay` 300 ms, a small native `ActivityIndicator` in `ref.color.raised` (03's Checking indicator) appears centred at (196.5, 426): one element, role progressbar, label "Loading" (`accessible` on iOS, `screenReaderFocusable` + `focusable={false}` on Android). The result routes as Guest or Already has access (the indicator stays until openCapture navigates), or shows Default: the sheet rises from below the screen with `motion.sheetSpring` (damping 28, stiffness 320, mass 1), as 03's sheet enters; under reduced motion it fades in over `motion.reducedFade` 140 ms with no movement. A failed check shows Default with line 3's fallback and no notice.
- **Purchasing** (after "unlock pro"): the kit's busy pill: the label stays, the fill stays at full opacity, a small native `ActivityIndicator` in the label colour sits 16 in from the right edge (44 reserved on both sides, so the label never moves), taps are ignored and `accessibilityState` is `{ busy: true, disabled: true }`. "not now" drops to 0.45 and is disabled; system back and VoiceOver escape stay live. Any notice clears and the test note returns. Calls: `currentSession()` (a guest routes as Guest without calling the function), then `grantTestEntitlement()`, then `getMyAccess()`.
- **Success:** `useFeedback().success()` and `announceForAccessibility("Pro unlocked.")`, then `openCapture({ replace: true })`. Loop guard: only after /pro has seen the entitlement itself; a 200 without it is the generic error.
- **Error:** in the note row, in the test note's place: a Phosphor glyph at `ref.layout.pro.noticeIcon` 16 in `ref.color.raised` #1E1E1E (03's PermissionNotice; the reference has no colour accent), centred on the first meta line, `ref.space.sm` 8, then the message in `ref.type.meta`, `inkMuted`, lowercase. It fades in over the kit's `controlTiming` (opacity) and is announced: on iOS by `announceForAccessibility`, on Android by the always-mounted polite live region (`pro-error-region`, `collapsable={false}`) that holds only errors; the line itself is `accessibilityLiveRegion="none"` and one screen-reader element labelled in sentence case. The pill returns to idle for a retry; a retry clears the error and the test note returns. One-line errors fit the reserved row, so nothing moves.

  | Cause | Glyph (`raised`, 16) | Text (`meta`, inkMuted, shown lowercase) |
  |---|---|---|
  | Offline (`isNetworkError`) | Phosphor `WifiSlash` | "You're offline. Connect and try again." |
  | Today's stub (`TestPurchaseUnavailableError`), or 403 `test_purchases_off` | Phosphor `Warning` | "Test purchases are off on this server." |
  | 403 `account_required` | — | No notice: routes as Guest |
  | 401, 5xx, entitlement still missing, anything else | Phosphor `Warning` | "Couldn't unlock Pro. Try again." |

- **Already has access:** whenever a check here finds the entitlement (Loading, the silent re-check on `AppState` → `active`, "check again"), `openCapture({ replace: true })` with no haptic or announcement.
- **Guest:** `router.replace({ pathname: "/account", params: { next: "back" } })`. /pro never calls the function for a guest.
- **Test purchases off** (`EXPO_PUBLIC_TEST_PURCHASES` not "1"): no test note. The note row (two lines reserved) holds the info line: `meta`, `inkMuted`, lowercase, no glyph, never a live region or announcement, one screen-reader element. The pill reads "check again" and goes busy while it checks. A failed check puts its error line in the info line's place, inside the live region; the info returns, outside the region, on the next check.
- **Pressed / Focus / Disabled:** see Tappable elements. The brass focus ring stays the user's decision (the reference shows no focus state).
- **Reduced motion** (`useTheme().reducedMotion`): the sheet's entry after Loading is a 140 ms fade with no movement; the error fade and press colour changes stay. The haze never moves. Native indicators keep the platform's behaviour.
- **Large text** (as 03): all text scales and never shrinks. The sheet grows upward. The pill (64 minimum) and "not now" (48 minimum) grow with their labels; the reserved note row grows with fontScale. When title + lines + controls + the 150 panel would pass the cap (safe top + 16), the decorative panel is dropped first; only if the title and lines still don't fit do they scroll inside the sheet (and only then become an Android keyboard stop), while the note row, pill and "not now" stay pinned. The heights the decision uses don't depend on it, so it is stable.
- **No bottom inset** (iPhone SE, Android with buttons): the last button ends `ref.space.lg` 16 above the screen's foot instead of safe + 4, as 03.
- **Narrow screen:** the gutter stays 24, so the column is width − 48 (327 at 375, 312 at 360); "a monthly allowance of new cases." (≈ 275 on the web) still fits at 360. The art keeps its offset from the panel's centre.

### User notes

- No reference and no user note for this screen. The coordinator's direction (2026-10-25, round 3): model it on 03 (pushr), the same kind of decision in the same capture flow: white ground with the grey haze; a sheet from below with the light grey panel holding an illustration in pushr's thick black outline style (an ESCAPD subject); the bold extended lowercase title in Archivo Black; the grey system-font body for the three benefits as short lines, lowercase; the black 64 pt pill and a quiet grey "not now"; the test note in the reference's small grey style; no visible back control. How it is applied: every one of those, at 03's measured values (24 gutter, 150 panel, 16 sheet corners, 30 panel-to-title ink, 39 title-to-body baselines, 22 body pitch, 64 pill with its 20 pt label, safe + 4 bottom), and the case file drawn to 03's phone metrics (157 wide, ink top 38.6, bands 18 / 18.5, elliptical corners, the same lights).
- Independent review (2026-10-25), applied: the shared `PaperHaze` haze; the case file to 03's phone metrics and lights; the error glyph in `raised`; the 14 title gap; 03's bottom-inset fallback, top cap and panel-first large-text rule; sentence-case copy shown lowercase; the kit's (now grey) quiet pill instead of a local button; the kit's 20 pt pill label.

### Decisions

1. **Look:** 03's pushr sheet (round 3), replacing the play screen's case-file cover (brass stamp, Playfair, manila slip, 8 pt Buttons, silk and Grain).
2. **Subject of the art:** a case file: 03's phone frame, metrics and lights, with a folder's tab in its top edge and a label for the island. The tab and its rounded shoulder say "file"; everything else reads as the same object family as 03's drawing.
3. **One note row:** the test note, the "isn't on sale yet" info and every error share one reserved row under the body, the error taking the resting line's place (the test note's words are the pill's hint, so nothing is lost). It keeps the reference's tight body-to-pill rhythm.
4. **"not now":** the kit's quiet pill on paper, grey `inkMuted` darkening to `raised` when pressed (the kit now draws 03's and 05's quiet buttons this way), so the black pill stays the one strong action.
5. **Error glyph:** `raised` ink, as 03's notice: the reference has no colour accent.
6. **Lowercase:** display only. Copy stays sentence case for screen readers; text takes `textTransform: "lowercase"`, the kit's pill labels lowercased strings, as 03.
7. **Busy pill:** the kit's busy state (label kept, indicator at the right, full opacity).
8. **Sheet entry:** only when Default replaces Loading, with 03's spring, or a fade under reduced motion.
9. **Status bar:** dark on this light screen, set on focus and restored on blur.
10. Unchanged from round 2: route and trigger, the stubbed test purchase, Success via `openCapture({ replace: true })`, "check again" when test purchases are off, Guest and Already-has-access routing, the foreground re-check, the always-mounted polite live region.

### Needs you

1. **The art.** A case file (03's phone with a folder tab and a label) is the subject chosen here. If you'd rather see a key, an evidence bag or the magnifier in pushr's style, it is one drawing in `CaseFilePanel.tsx` with its geometry in `ref.layout.pro.art`.
2. **Where test purchases may run** (unchanged from round 2): the server secret is the only real gate; please confirm the project and build profiles.

## 06 · Building your case (the build wait, formerly the darkroom)

Reference: none. It's derived from 07 Photos (the review screen it opens from), 02 Camera and 01 Game mode. Values are in pt, on 393 × 852 (safe areas 59 / 34).

**Round 4: plain language.** The user said to "drop the light table dark room thing, it's not very self explanatory". The screen is no longer named; the wait is "Building your case". Every visible and spoken string follows the round-4 glossary: photo (not plate), build / building / ready (not develop), home screen (not title screen), Arabic numerals, and no AI. Layout, the glass, its drift and the thinking line are unchanged. Internal names (`/capture/develop`, `useDevelopment`, testIDs, `ref.layout.develop`, file names) stay as they are.

Route: `app/capture/develop.tsx` (`/capture/develop`, optional `?roomId=<id>`). `useDevelopment` logic and routing are unchanged.

Files in `src/screens/develop/`:
- `copy.ts`: the stamp, title and body, and the thinking line for each wait stage.
- `PlateStrip.tsx`: the player's photos as 07's tiles in miniature.
- `DarkroomGlass.tsx`: the glass and its drift.
- `DarkroomHero.tsx`: the strip, with the glass over it and the line under it.

Other files:
- The non-wait states and the pinned buttons are the shared `src/components/StateScreen.tsx` (its section is below).
- Failure copy is in `src/capture/failure.ts`, and the error lines in `src/capture/useDevelopment.ts` (strings only).

Tests:
- `src/screens/develop/__tests__/darkroom-test.tsx` (34, including a plain-language sweep of every stage and 5 haptics tests)
- `src/components/__tests__/StateScreen-test.tsx` (4)
- `src/capture/__tests__/failure-test.ts` (+1 plain-language test)

Tokens:
- `ref.layout.develop` and `ref.layout.state`
- the shared `ref.color`, `ref.type`, `ref.space.edge`, `ref.radius.round`, `ref.button.gameCard` (the tag pill), `ref.curve`, `ref.motion.thinking`, and `ref.focus` via the kit's FocusRing

### Feel

A calm "we're on it" page, one step after Photos. It uses the same flat #101010 ground. The player's photos sit in a numbered row (1 to 6), still dark where they haven't been sent yet. The painted glass drifts over them, with a grey shimmering line under it saying what's happening: "Finding the objects", "Choosing what to hide", "Writing the case". Below sit a small outlined tag (BUILDING), a white title and a grey line saying how long it takes. When the case is ready, the photos come up in full colour and the white bar says "Open the case". Every failure reads as a friendly next step, never an alarm.

### Copy, before → after (round 4)

| Where | Before | After |
|---|---|---|
| Access check (loading) | Opening the darkroom | One moment |
| Sending: stamp / title | SENDING PLATES / Sending your plates | SENDING PHOTOS / Sending your photos |
| Sending: body / line | Plate 2 of 5. Keep the app open… / Sending plate 2 of 5 | Photo 2 of 5. Keep the app open until they're all sent. / Sending photo 2 of 5 |
| Queued: title | Waiting for the darkroom | Your case is next |
| Queued: body | Your case is next. You can leave this screen; it keeps developing, and you'll find it on the title screen. | You can leave this screen. It keeps building, and you'll find it on the home screen. |
| Queued: line (status label) | Waiting for the darkroom | Waiting to start (label "Your case is next") |
| Running: stamp / title | DEVELOPING / Developing your case | BUILDING / Building your case |
| Running: lines | Finding the objects · Choosing what to hide · Writing the case | unchanged |
| Retry: stamp | SECOND ATTEMPT | SECOND TRY |
| Retry: body | The first attempt didn't finish. The darkroom will try again shortly… | The first try didn't finish, so it's starting again. You don't need to do anything. |
| Ready: stamp / title / body | CASE DEVELOPED / Your room is a case now / …somewhere in the plates. | CASE READY / Your case is ready / Everything you need is somewhere in your photos. |
| Waiting button | Leave it developing | Leave it building |
| Account body | Cases you develop are saved… then develop. | Cases you build are saved to your account so they're never lost. Add an email and confirm it, then build. |
| Limit | You've developed every case this month allows / Your plates stay on this phone… | You've built every case this month allows / Your photos stay on this phone until you close the app. |
| Secondary buttons | Back to the light table / Back to the title | Back to your photos / Back to home |
| Failed: retake buttons | Retake plates / Photograph the room again | Retake photos / Take the photos again |
| Privacy failure | Some plates show something private / A person, or mail… Retake the marked plates without them. | A few photos need a retake / They show a person, or something private like mail, documents, or a lit screen. Retake the marked photos without them. |
| Too few objects | …The plates need at least four clear objects: … develop again. | Not enough to build a case from / The photos need at least four clear objects, like a desk, a shelf, a cabinet, or a lamp. Add a close view or two and build again. |
| Unreadable photo | A plate didn't come through / …and develop again. | A photo didn't come through / One of the photos couldn't be read. Retake it, or choose a different photo, and build again. |
| Invalid case | The case didn't hold together / These plates… four clear plates… | The case didn't come together / These photos didn't give the puzzle enough to work with. Try four clear photos from different corners. |
| Blocked | These plates couldn't be developed / Retake them without people, private documents, or screens. | These photos couldn't be used / Try again with photos that don't show people, private documents, or screens. |
| Transient | The darkroom is busy / Developing didn't finish… Your plates are safe… | That took longer than it should / Your case didn't finish building this time. Your photos are safe. Try again in a minute. |
| Our side | The darkroom is closed / Something on our side stopped this case from developing. | Your case couldn't be built right now / Something on our side stopped it. Your photos are safe. Try again later. |
| Errors | …Your plates are safe… / Couldn't reach the darkroom… / Your plates were cleared… Photograph the room again. / …never sent. Photograph the room again. | You're offline. Your photos are safe. Connect and try again. / Couldn't connect to ESCAPD. Your photos are safe. Try again. / Your photos were cleared when the app closed. Take them again. / This case was never sent. Take the photos again. |
| Photo numbers on the strip | I, II, III… | 1, 2, 3… |

Unchanged: "Keep your cases on an account", "Add your email", "Your own rooms are part of ESCAPD Pro", "Try again", "The case didn't go through", "Trying again", "Open the case", "Elapsed n min".

### Layout, top to bottom (unchanged in round 4)

The column is centred vertically between the safe top and the pinned band. The hero and the clock sit at `ref.space.edge` 20 from the screen edges, and the text at `ref.layout.state.textInset` 32.

| Element | Size and spacing | Style | Tokens |
|---|---|---|---|
| Ground | Full bleed, flat | `ref.color.ground` #101010, as 02 and 07 | `ref.color.ground` |
| Stage (during a wait) | Column width × 122. The strip sits 4 below its top | Holds the strip; the glass is drawn over it | `develop.stage` { height 122, stripTop 4 } |
| Photo strip | 3–6 cells, 48 wide, 8 apart (6 = 328 wide), centred | Each cell has its number (1–6), then the tile 2 below. Hidden from screen readers | `develop.plate` { size 48, gap 8, labelGap 2 } |
| Number | 17 tall line box | Regular 12/17, `textSecondary` #949494 (6.3:1), 07's tile-label style | `develop.plate.label` |
| Tile | 48 × 48, corners 4 continuous, 1 pt edge | Photo cover in full colour inside a `ref.color.rim` edge. A `raised` fill shows only while it loads | `develop.plate` { radius 4, rim 1 } |
| Veil (until ready) | Over the whole tile | `void` at 0.7 over photos still to send and 0.35 over sent ones. Neutral, so hues never shift | `develop.veil` |
| Glass | 96 × 96. The lens centre rests on the tiles' middle, 47 below the stage top | `assets/brand/magnifier.png` @2x / @3x | `develop.glass` |
| Thinking line | 12 below the stage, the column's width | Kit `ThinkingStates`, meta 13/16, dark ground | `develop.gap.line` 12, `ref.motion.thinking` |
| Stamp | 28 below the hero. 26 tall, 9 to the text | 01's tag pill: 1 pt `rim`, radius 8, `ref.type.tag` in `textLabel` | `develop.gap.copy`, `ref.button.gameCard.tag*` |
| Title | 16 below the stamp | `ref.type.title` Semibold 22/28, `textPrimary`, centred, role header | `develop.gap.title` |
| Body | 8 below | `ref.type.subtitle` Medium 17/22, `textSecondary`, centred | `develop.gap.body` |
| Elapsed (queued or running) | 20 below the body; at least 32 tall, 14 to the text | "3 min" in `ref.type.meta` grey on a `void` pill (7:1) | `develop.gap.clock`, `develop.clock` |
| Pinned band | 16, action(s), 16 + the safe bottom; sides 20 | StateScreen's `StateActions`. No band while sending | `ref.layout.state.footer`, `.bar` |

### Tappable elements and haptics

Haptics use the shared vocabulary in `src/game/feedback.ts`. There is one per moment, never stacked, never on mount or on animation frames.

| Element / moment | When | Action | Haptic |
|---|---|---|---|
| A photo finishes sending | `sending` count steps up | — | `tick` (each step; never on mount, never when resuming mid-send) |
| The case is ready | `ready` | — | `success` (kept) |
| The case failed | `failed` | — | `warning` (kept: calm, never `error`) |
| **Open the case** (white bar, testID `open-case`) | `ready` | Clears the photos, replaces with `/play/<roomId>` | `thud` on press-in (committing to play) |
| **Leave it building** (quiet pill) | `waiting` | `router.replace("/")` | `press` (the kit's default) |
| StateScreen bar and quiet button | the other states | as listed under States | `press` on press-in by default |

Sizes: the bar is at least 48 tall, full width minus 40, radius 2, with a paper fill and a ground label (19:1). The quiet pill is 48 tall. Both draw the brass focus ring.

### States

| Stage | What shows |
|---|---|
| `checking` | StateScreen loading: the thinking line "One moment" alone |
| `account` | "Keep your cases on an account" · Add your email · Back to your photos |
| `access` (entitlement) | "Your own rooms are part of ESCAPD Pro" · Try again · Back to your photos |
| `access` (cap) | "You've built every case this month allows" · Back to home |
| `sending` | Photos veiled (sent ones lighter), the glass, "Sending photo n of total", SENDING PHOTOS, no band. A tick per photo sent |
| `waiting` queued | Glass, "Waiting to start", IN THE QUEUE, "Your case is next", the clock, Leave it building |
| `waiting` running | Glass, the three lines rotating under the fixed status "Building your case", BUILDING, the clock, Leave it building |
| `waiting` retry | Glass, "Trying again", SECOND TRY, the clock, Leave it building |
| `ready` | No glass and no line. Photos in full colour, CASE READY, "Your case is ready", Open the case. Success haptic |
| `failed` | StateScreen with the failure copy above: Retake photos / Take the photos again / Try again / Back to home, plus Back to home (quiet) unless "later". Warning haptic |
| `error` | "The case didn't go through" + the error line · Try again · Back to your photos |

Glass motion is unchanged: a figure-eight with x 56, y 8, tilt ±5°, one loop per 4000 ms on the UI thread, carried across sending → queued → running. Reduced motion: still glass and a plain grey line that swaps with a fade.

### Accessibility

- The strip and the glass are hidden from screen readers. The thinking line is one polite status, read by its fixed label ("Sending photo 2 of 5", "Your case is next", "Building your case", "Trying again").
- The stamp, title and body make one polite live region. The elapsed clock sits outside it ("Elapsed 3 min"), so its ticks aren't re-read.
- A test walks every stage and asserts that no visible text or accessibility label contains plate, develop, darkroom, light table, title screen, roll or AI.
- Contrast:

  | Text | Ratio |
  |---|---|
  | Title | 19:1 |
  | Tag | 13:1 |
  | Grey text | 6.3:1 |
  | Clock | 7:1 |
  | Bar label | 19:1 |
- Tap targets are at least 48.

### StateScreen (`src/components/StateScreen.tsx`, shared)

Used by the player (loading, offline, unsupported, not ready, error, update needed), the build wait, and `/account/confirmed`.

**Its props are unchanged** (`title`, `body`, `icon`, `primary`, `secondary`, `loading`). It also exports:
- `StateActions`, the pinned band
- `StateAction` = Action + optional `testID` + optional `haptic` (`"press"` by default, `"thud"`, or `false`)

| Element | Spec | Tokens |
|---|---|---|
| Ground | Flat `ground`, the safe top as padding | `ref.color.ground` |
| Column | Centred vertically, 32 from the edges, text centred | `state.textInset` |
| Icon (if given) | The caller's glyph centred in a 72 `void` disc with a 1 pt `rimFaint` rim; 20 to the title | `state.well`, `state.gap.title` |
| Title / body | `ref.type.title` white / `ref.type.subtitle` grey, 8 apart | `state.gap.body` |
| Loading | No spinner. Kit `ThinkingStates` with the title as its one line (body size), labelled with the title; a body, if any, 8 below | — |
| Band | 16, primary bar, 8, quiet secondary, 16 + the safe bottom; sides 20 | `state.footer` |
| Primary | 07's white bar: at least 48 tall, radius 2, paper fill, Semibold 16/22 ground label; pressed 0.75; `press` haptic on press-in unless the action asks for `thud` or none | `state.bar` |
| Secondary | Kit `PillButton variant="quiet" ground="dark"` (48, Semibold 17 white), `press` haptic | `ref.button.quiet` |

Accessibility: when not loading, the icon, title and body form one polite live region. When loading, the thinking line is the only one.

### Decisions

- **The queued title and line now differ.** The title is "Your case is next" and the line under the glass is "Waiting to start", so the two no longer repeat each other. The line's status label is the title.
- **"One moment"** for the access check. It's plain, and it names no screen.
- **Calm failure titles:** "A few photos need a retake" rather than "something private", and "That took longer than it should" rather than "busy" or "closed". Every failure that keeps the photos says "Your photos are safe".
- **"Back to your photos"** replaces "Back to the light table", matching the review screen's new title, "Photos".
- **"Leave it building"** keeps the old button's reassurance that the case carries on in the background.
- **Primary on dark is still 07's white bar,** shared by StateScreen. "Open the case" fires `thud`, the weighty commit; every other bar or quiet press fires `press`, matching the kit's pills.
- **The send tick** fires only when the count steps up from a count already shown. It never fires on mount, when resuming mid-send, or on the move to the queue.

### Shots

All shots were taken with Supabase blocked. They're in `C:/Users/Dell/AppData/Local/Temp/claude/f--escapd-escapd/079a8a0e-2bca-41c1-b406-d4915e22da25/scratchpad/darkroom06/out/`:
- `contact-waits.png`: checking, sending, queued, running, retry, no photos, ready, running under reduced motion
- `contact-states.png`: account, Pro access, limit, privacy failure, transient failure, error, play-loading
- one PNG per state

The harness is `darkroom06/shoot.mjs`. It shims `useDevelopment` to a canned stage, puts fake photos in the capture store, and reports `onTextLayout` from the DOM so the kit's line draws on the web.

### Needs you

- **ThinkingStates on the web needs `onTextLayout`,** which react-native-web never fires. The shots use a harness shim. Native is fine.
- **The player's StateScreen glyphs** are coloured by `src/render/Player.tsx`, the player agent's file.
- **The darkroom's StateScreen states have no glyph.** If you want one per state, it can be passed through `icon`.
- **Check the 0.7 veil on a device,** on very dark rooms.

## 07 · Review screen ("Photos", formerly the light table)

> **Round 4 (2026-10-25), the user's feedback:** "before you develop shouldnt have the scrolling 3 things jsut list them vertically, no see all button and the warning should be less threatening and dont mention AI. I also think we should drop the light table dark room thing its not very self explanatory. the step by step thing should show before you make a room every time." Plus "add some haptics too". What changed here:
> - **Plain language** (the round 4 glossary): title "Photos", heading "Your photos", "Add a photo", "Tap a photo to retake it", labels "1 · From the doorway" (Arabic numerals), "Retake photo 2" / "Remove photo 2", "Build the case". No plate, roll, light table, darkroom, develop, AI or "never".
> - **"Before you build"**: the three checks as friendly tips in a plain vertical list; no sideways cards, no "See all".
> - **The privacy line** reassures instead of warning: "Your photos are only used to build your case. No one else sees them.", with no lock glyph.
> - **Softer blocked states:** a flagged photo says "Retake this one" (still amber, still a 2 pt amber rim); the helpers read "Retake the marked photos, then build the case." and "Take at least 3 photos to build the case."
> - **Haptics** (`useFeedback`): `press` as a tile (retake) or a × (remove) is pressed in; `thud` as the live "Build the case" bar is pressed in (the commit); nothing on the disabled bar.
> - Everything else below is unchanged from round 3 unless a row says "Round 4".

Reference: docs/refs/07-light-table.png (a resale app's "Photos" screen), 1179 × 2676 px = 393 pt at 3 px/pt. The screen is the top 852 pt; the grey "curated by Mobbin" bar (from y 852) and the app's tab bar (y 768.7 to 852) are not part of the design, because ESCAPD has no tab bar. This round matches the reference's layout, type sizes and weights, shapes, sizes, spacing and icon style as measured. It does not copy its colours: the user said "you dont have to port over the colors but everything else". Each colour role maps to the camera screen's dark palette in `ref`. ESCAPD keeps its own copy, its plate prompts and every behaviour the screen had. No names, copy or logo come from the reference app.

Route: `app/capture/review.tsx` (`/capture/review`, optional `?flag=0,2`) reads `flag` and renders `src/screens/review/LightTable.tsx`. Files in `src/screens/review/`:
- `copy.ts` holds every word.
- `ReviewHeader.tsx` is Back and the title.
- `AddPlateButton.tsx` is the outlined pill.
- `Glyphs.tsx` is ESCAPD line art drawn to the reference's camera and tap glyphs.
- `PlateGrid.tsx` holds the label + tile + × cells and the × halo.
- `NoteRow.tsx` is the hint-row pattern, used for the retake hint and the privacy note.
- `ChecksSection.tsx` holds the heading, See all, the cards and the privacy note.
- `DevelopFooter.tsx` is the pinned bar and its helper line.

Tests: `src/screens/review/__tests__/review-test.tsx` (16). Every value comes from `ref` in `src/theme/tokens.ts`: `ref.color`, `ref.space.edge`, `ref.radius.round`, `ref.hit.min`, `ref.focus` (via the kit's FocusRing), `ref.button.disabledOpacity.pill`, `ref.curve`, and the screen's own `ref.layout.review`. The one exception is `ref.layout.review.warning`, which is the live `color.warning`. No literals in screen code. Grain, mounts, mono stamps, the manila slip and the live `Button` / `IconButton` / `Text` are gone from this screen.

### Feel

A plain, tidy checklist page on a flat near-black ground. The player sees the plates in full colour, three to a row, each named by its prompt. They can see at a glance what to retake. Below the plates sit a short checklist on dark cards and one obvious white bar to go on. Nothing glows and nothing moves. The photos carry the only colour, apart from a quiet amber on any plate the privacy check flagged. Hierarchy comes from type weight (Bold title and headings, Regular body, grey labels) and from one inversion: the only white fill on the screen is the develop bar.

### Colour mapping (reference role → ESCAPD)

| Reference | Measured | ESCAPD | Token |
|---|---|---|---|
| Page | #FFFFFF | #101010 | `ref.color.ground` |
| Ink: header, title, body, pill outline and label, camera glyph, headings, See all, card text | #141414 / #000000 | #FFFFFF (19:1) | `ref.color.textPrimary` |
| Grey: tile labels, hint text and glyph | #5C5C5C / #5E5E5E (6.6:1 on white) | #949494 (6.3:1) | `ref.color.textSecondary` |
| Tile edge | #E0E0E0, 1 pt (1.32:1 on white) | white 10 % = #282828 (1.29:1) | `ref.color.rim` |
| Tip cards | #FFF7F1 | #1E1E1E | `ref.color.raised` |
| Number disc on a card | #FFFFFF (the page) | #101010 (the page) | `ref.color.ground` |
| "Next" bar | #000000 (strongest on white) | #FFFFFF (strongest on #101010) | `ref.layout.review.footer.fill` = `ref.color.paper` |
| "Next" label | #FFFFFF (the page) | #101010 (the page, 19:1) | `footer.label` = `ref.color.ground` |
| × on a photo | white | white, plus a faint dark halo | `textPrimary`, `ref.color.void` |
| (none) flagged plate | — | amber #D4883A (6.7:1) | `ref.layout.review.warning` (`color.warning`) |

### Layout, top to bottom

393 × 852, safe areas 59 / 34. Measured reference values are listed first, then ESCAPD as rendered (web, Inter for the system font). "Baseline" means the text baseline. Text uses the system font (SF Pro on iOS) with no `fontFamily`, set by `fontWeight`. The weights were measured from stem widths against SF Pro (Regular 0.085 em, Semibold 0.122, Bold 0.143) and the sizes from cap heights.

| Element | Reference (measured) | ESCAPD | Tokens |
|---|---|---|---|
| Ground | White, flat, full bleed | #101010, flat; no grain, no glow | `ref.color.ground` |
| Header row | y 59–103 (44) under the safe top. Text gutter 16 | Same: `marginTop` = safe top, `minHeight` 44, `paddingHorizontal` 16. Three columns (two `flex: 1` sides), so the title stays centred | `layout.review.header.height` 44, `gutter` 16 |
| Left text button | "Close", Regular 14 (stem 0.089 em, 'l' 10.0), ink from x 17.0, baseline 87 | "Back", Regular 14/20, textPrimary, x 16 (ink 17.0), baseline 87: its label is nudged `backDrop` 1 below centre onto the title's baseline, as in the reference. Hit area ≥ 44 × 44 | `type.back`, `header.backDrop` |
| Title | "Photos", Bold 16 (P cap 11.33, stem 0.14 em), centred (ink centre 197.0), baseline 87 | "Light table", Bold 16/22, textPrimary, centred, baseline 87.3. Role header | `type.navTitle` |
| Heading | "Item photos", Bold 18 (I cap 13.0, stem 0.145 em), x 17, cap top 126, baseline 139 | "Your plates", Bold 18/24, textPrimary, x 16, line box 121–145 (18 below the header), cap top 125.7, baseline ≈139.4. Role header | `type.title`, `gap.title` 18 |
| Body | Regular 16/23 (cap 11.33), title colour, baselines 176 / 199 | "{n} of 6. Retake anything dark, blurred, or too close to read the room." Regular 16/23, textPrimary, 14 below the heading, right margin 48 (the reference wraps at least 44 short of the edge), baselines ≈176 / 199 (ink 163.7–179.7 / 187.3–199.3; ref 164.0–179.0 / 187.3–199.3) | `type.body`, `gap.body` 14, `captionInsetEnd` 48 |
| Add pill | Outlined stadium x 19.5–373.5, y 228.5–277.5 (49), 1 pt black stroke centred on x 20 / 373, full radius. Camera glyph 19.7 × 16.7 ink, ~1 pt line, 11 from the glyph's ink to the label. "Add photos" Semibold 16 (A cap 11.33, stem 0.117 em). The group is centred (ink centre 197.2), cap centre on the pill's centre (253.3 / 253.0) | "Add a plate": x 19.5–373.5, y 228.5–277.5 (49), 1 pt white border inside the box so it straddles x 20 / 373 as the reference's stroke does, `ref.radius.round`, `curve`. The camera is ESCAPD line art to the reference's glyph (`CameraGlyph`): 19.7 × 16.7, square corners, 1.2 line, a 7.3 × 2 bump centred on the top, a 9.6 lens centred 8.8 below the top; 11 from the label (ink to ink). Label Semibold 16/22, textPrimary. Group centred. Gone at MAX_PLATES (as the add tile was) | `add` { inset 19.5, height 49, border 1, gap 11 }, `camera`, `type.action`, `gap.add` 23.5 |
| Grid | 3 columns at x 20 / 140.33 / 260.67, tiles 112.33 square, 8 apart both ways | Same: tile = (width − 2 × 20 − 2 × 8) / 3 = 112.33 on 393. Rows of three; every cell in a row is as tall as the tallest, content pushed to the bottom, so tiles align and labels sit bottom-aligned on the tiles | `grid` { columns 3, gap 8 }, `ref.space.edge` |
| Tile labels | Regular 12/≈17.3 (M cap 8.67), #5C5C5C, left at the tile edge (ink 21.0). Wrap to two lines, bottom-aligned: line 1 baseline 304.67 and line 2 baseline 322.0 ("Brand label / (inside/ outside)"), one-line labels on line 2's baseline. Tile top 328.33 | The plate's prompt with its numeral: "I · From the doorway", "II · Opposite corner", "III · The busiest wall", "IV · A close view", "V · Another angle", "VI · Last plate" (`promptFor(i)`). Regular 12/17, textSecondary, bottom-aligned, the box 2 above the tile. The grid starts 14.5 under the pill: label ink 296.3–305.3 / 313.0–324.7 (ref 296.0–305.0 / 313.0–324.7), tile top 328.0. The last word of a prompt is held to the one before it (a no-break space), so "I · From the doorway" (116 pt in SF at 12 > 112.3) breaks "I · From / the doorway", never leaving a short word alone on line 1; the others fit, as in the reference's row. Read as "Plate I, From the doorway" | `type.label`, `grid.labelGap` 2, `gap.grid` 14.5 |
| Tile | 112.33 square, photo cover, 1 pt #E0E0E0 edge outside the photo, outer radius ≈5 (fitted 4.7) | Photo `contentFit="cover"` in full colour inside a 1 pt `ref.color.rim` border, radius 5 continuous (photo clipped at 4). The frame has no fill, so the rim composites over the ground (#282828, 1.29:1; measured in the render). A raised fill on an inner layer shows only while the image loads | `tile` { radius 5, rim 1 }, `ref.color.rim`, `ref.color.raised` |
| × on a tile | White X, 9.67 ink, ≈1 pt line, centre 21.2 from the right edge and 20.8 from the top | Phosphor X regular 16 (1 pt line, 10 ink), white, centre 21 from the top and right edges, on a 44 × 44 hit area (y −1 to 43, overhanging the tile by 1). Under it, a halo along the same strokes: `ref.color.void` at 0.45, 3 wide, round caps. It vanishes on dark photos (as in the reference) and keeps the × readable on a bright wall | `tile.remove` { icon 16, weight "regular", centre 21, halo 3, haloOpacity 0.45, haloFrom 56, haloTo 200, haloBox 256 }, `ref.hit.min` |
| Second row | No label (the reference's fourth photo has none): tile 8 under row 1 (448.33) | Every plate has a prompt, so row 2 has its label: label box 448.3, tile 467.3–579.7. The grid is 19 taller than the reference's for four plates, and everything below moves down by that much | — |
| Hint row | Hand-on-button glyph, grey, ink x 23.0–35.3, y 577.7–595.7 (18). "Tap and drag to rearrange your photos" Regular 14 (T cap 10.33), #5E5E5E, ink from x 42.3, baseline 592.3. Glyph top 17.0 and baseline 31.7 below the tiles | "Tap a plate to retake it" (ESCAPD has no reordering). The glyph is ESCAPD line art to the reference's (`TapGlyph`): a pointing finger pressing inside a rounded-square button, 1 line, round caps; paths in `tap.paths`, offset 3 / 1 in a 20 box at x 20, so the ink is x 23.0–35.3 × 18 (reference 23.0–35.3 × 18), textSecondary. Text Regular 14/20, textSecondary, 2 from the box (ink from 42.7; reference 42.3). Shown only when there are plates | `note` { icon 20, gap 2 }, `tap`, `type.hint`, `gap.hint` 17 |
| Section heading | "Tips for taking photos", Bold 14 (T cap 10.33, stem 0.14 em), #000, ink x 24.3, baseline 637.0 (44.7 under the hint's). The reference's "See all ›" link sits at the right | **Round 4:** "Before you build", Bold 14/20, textPrimary, x 24, 24 under the hint row (where round 3's heading sat). Role header. **No "See all"** (the user: "no see all button"; the guide now shows before every room anyway) | `type.section`, `section.inset` 24, `gap.section` 24 |
| Tips | The reference's sideways tip cards (313 wide, peach, a numbered disc and a Bold title) | **Round 4: a plain vertical list** (the user: "shouldnt have the scrolling 3 things jsut list them vertically"), 16 under the heading, at x 20: three rows, 12 apart, each a 24 disc in `ref.color.raised` (on the page ground now that there is no card) holding the number (Bold 16/22, white), and the tip in Regular 16/22, white, 8 after the disc, its first line centred on it. Friendly tips, not rules: "Keep people out of the shot." · "Tuck away mail, documents, and screens." · "Turn the lights on and hold steady." Each reads "1. Keep people out of the shot." as one text element; the disc is drawn only | `tips` { disc 24, discGap 8, gap 12 }, `type.tipNumber`, `type.tip`, `section.listGap` 16 |
| Privacy line | — | **Round 4:** "Your photos are only used to build your case. No one else sees them." Regular 14/20, textSecondary, 16 under the tips, at x 20, **no glyph** (the lock read as a warning; AI is not mentioned). The column ends 24 lower | `type.hint`, `section.noteGap` 16, `gap.end` 24 |
| Bottom band | Page-colour band from y 689, sharp edge, no shadow or rule. 16, then the bar y 705–753 (48), then 15.7 to the tab bar. Bar x 20–373, #000, radius ≈2 (fitted 1.3–2). "Next" Semibold 16 (N cap 11.33, stem 0.119 em), white, centred, cap centre on the bar's centre | Pinned under the scrolling column in `ref.color.ground`, sharp edge: 16, then the bar, then 16 + the safe bottom. Bar y 754–802 on 852, x 20–373, `minHeight` 48, radius 2 continuous, fill paper. "Develop the case" Semibold 16/22 in ground, centred. When the case can't develop yet, a helper line sits 8 above the bar (Regular 14/20, centred) and the bar dims to 0.45 | `footer` { pad 16, bar 48, radius 2, helperGap 8, fill, label }, `type.action`, `type.hint`, `ref.button.disabledOpacity.pill` |

### Tappable elements

Focus order follows reading order: Back, (title), (heading), (count line), Add a plate, then for each plate its label, its tile and its ×, then (hint), (section heading), See all, (cards), (privacy note), (helper), Develop the case. Every control shows the kit's brass focus ring (`ref.focus`) on keyboard, D-pad or switch focus, following its own shape: Back and See all at radius 8, the pill round, a tile at 5, the × round, the bar at 2.

| Element | Hit area | Action | Accessibility |
|---|---|---|---|
| Back | ≥ 44 × 44 (16 to 60 × the 44 row) | `router.back()`, or `router.replace("/capture")` with no history (as before). Android back pops the stack to the camera natively (unchanged) | button "Back to the camera" |
| Add a plate | 354 × 49 | `router.push("/capture")` (as the add tile did). Not rendered at MAX_PLATES | button "Add a plate" |
| Tile | 112.3 square | Retake: `router.push({ pathname: "/capture", params: { retake: String(i) } })` (the old retake button) | button "Retake plate II" |
| × | 44 × 44, centred on the glyph | `removePlate(i)` (the old trash button); no confirm, as before | button "Remove plate II" |
| Develop the case | 353 × ≥ 48 | `router.push("/capture/develop")`. Disabled with fewer than MIN_PLATES (3) or while any plate is still flagged | button "Develop the case", state disabled |

The tile and its × are siblings, not nested, so screen readers reach both. Press feedback is the reference look's proposal, since the reference shows none: every control drops to opacity 0.75 (`pressedOpacity`), and the pill fills with `ref.color.raised` instead. Nothing animates, so reduced motion changes nothing.

### States

| State | What shows |
|---|---|
| Empty roll | "0 of 6. …", Add a plate, no grid, no hint; the section and cards; the helper "A case needs at least 3 plates." in grey over the dimmed bar |
| 1–2 plates | Grid, hint, grey helper, bar disabled |
| 3–5 plates, none flagged | Full screen; no helper; bar enabled |
| 6 plates (MAX) | Add a plate is gone; the grid follows the count line 14 below |
| Flagged (`?flag=0,2`, a failed privacy check sent the player back) | Each flagged plate's label turns amber, "Retake this plate" (amber, Regular 12/17) is added under it, and its tile rim becomes 2 pt amber. The helper "Retake the marked plates before developing." is amber; the bar is disabled. Flags are pinned to the photo flagged at that moment (by URI, recomputed only when the param changes), so a retaken plate loses its mark, and the bar enables once none is left. Indexes that name no plate are ignored |
| Large text | Every text scales. Labels and the count line wrap, row cells grow and tiles stay aligned, the header title wraps between equal sides, the card disc grows with its number, the helper and bar grow. The column scrolls under the pinned band |
| Narrow screens | Tiles shrink with the width (three columns always); cards cap at the screen width − 40 |

### User notes

> "use this as a reference for the photo review dark room. you dont have to port over the colors but everything else."

Applied. Layout, type, shapes, sizes, spacing and icon style follow the reference as measured. The colours are the camera screen's dark palette, mapped role for role (table above).

### Decisions

1. **Colour mapping.** White page → `ground`; black ink → white; greys → `textSecondary`; the faint tile edge → `ref.color.rim` (1.29:1, as faint as the reference's 1.32:1); peach cards → `raised`; the white disc → `ground` (the page colour, as in the reference); the black bar → paper with a ground-colour label. The bar is the only white fill, so it stays the one strong action.
2. **Flagged plates use amber `color.warning` (#D4883A, 6.7:1), not the old oxblood.** `color.error` #A63429 is only 2.85:1 on #101010, too low for text. The mark follows the reference's own style language (label colour, edge weight) instead of adding a badge. The words "Retake this plate" carry the meaning too, so it never relies on colour alone.
3. **The privacy sentence is a hint-style note under the cards, not a fourth card.** As a card, its four lines stretched every card to about 120 pt and left the one- and two-line checks half empty, so it did not fit the pattern. The lock-and-grey-text row reuses the reference's other pattern.
4. **The hint row says "Tap a plate to retake it"** beside the reference's finger-on-a-button glyph (redrawn as ESCAPD line art). ESCAPD has no reordering, and tapping a tile now retakes it (the old per-plate retake button is gone).
5. **Prompt labels include the numeral** ("I · From the doorway"). They are read as "Plate I, From the doorway", because screen readers handle "I" and "·" badly.
6. **The × has a faint dark halo** (void 45 %, 3 pt, under the 1 pt white strokes). Real room photos are often bright where the × sits; on dark photos the halo is invisible.
7. **Cards are numbered 1–3 in Arabic numerals**, as the reference's are. Roman numerals stay with the plates.
8. **The band and bar keep the reference's 16 / 48 / 16** and sit above the bottom safe area, where the reference has its tab bar. The bar's bottom is at y 802 on 852 instead of 753.
9. **Every press is a proposal** (opacity 0.75; the pill fills with raised). So are the disabled bar (0.45, with its label still 4.6:1 on the dimmed fill) and the helper line. The reference shows none of these states.
10. **Text in a card is optically centred on its disc.** In the reference, the number and title sit about 1.8 pt below the disc's centre (a native line-height artefact). ESCAPD centres them.
11. The header's Back label is nudged 1 pt, so it shares the title's baseline (both at y 87), as "Close" and "Photos" do.

### Remaining differences from the reference, and why

- **Colours:** by instruction (Decision 1).
- **Typeface:** the reference uses the app's own narrower grotesk; ESCAPD uses the system font (SF Pro on iOS; Inter in the web harness). Sizes and weights match by cap height and stem width, so SF text runs about 8–12 % wider: "Photos" is 50.7 wide in the reference, and "Light table" at the same size is wider. That is why "I · From the doorway" wraps where a narrower face might not.
- **Second-row labels:** every plate has a prompt. With four plates the grid is 19 pt taller than the reference's, and the hint, section and cards sit about 19–21 pt lower. Only about 61 pt of the cards shows above the band instead of 31.5 (about 33 when the helper line shows).
- **Glyph shapes:** the camera and the tap glyph are now ESCAPD line art drawn to the reference's own (same boxes, proportions and line); their knuckle and lens details are traced by hand at about 0.3 pt. CaretRight and X are Phosphor and match in size and line weight.
- **× halo, amber flags, disabled bar and helper, pressed states, privacy note:** ESCAPD behaviour or decisions (2, 3, 6, 9).
- **Add pill (web only):** Chrome snaps the fractional 19.5 / 228.5 border to device pixels, so the stroke renders about 0.3 pt right and down of the reference's; iOS draws it at the exact fraction.
- **Card text:** about 1.8 pt higher (Decision 10).
- **Bar position:** above the safe area, not above a tab bar (Decision 8).
- **Web-only:** Inter glyph widths; no difference in layout.

### Needs you

- Is the privacy sentence fine as a grey note under the cards, or would you rather have it as a fourth card (which makes every card about twice as tall)?
- The × halo for bright photos: keep it, or go strictly reference (white X only)?
- Flag colour: amber `color.warning` for legibility, or the old oxblood (2.85:1 on this ground, below AA for text)?

### Verification

- Screenshots: a copy of the harness with a `review` target. It opens /capture with the fake camera granted, presses the shutter 4 times (each waits for the shutter to settle), then taps the last-plate thumbnail, so the roll is filled the real way. Options: `REVIEW_SHOTS=n`, `REVIEW_FLAG=…`, `REVIEW_SCROLL=1`, `REVIEW_CARD=n`, `SHOT_NAME`, `DUMP_RECTS=1`. It never starts its own server. Compare against 07, cut above its tab bar: `C:/Users/Dell/AppData/Local/Temp/claude/f--escapd-escapd/079a8a0e-2bca-41c1-b406-d4915e22da25/scratchpad/review07/out/compare-review.png`. Variants are in the same `out/` folder: `review-end.png` (scrolled), `review-flag.png` (plate II flagged), `review-2.png` (too few), `review-6.png` (full roll, cards scrolled).
- Checks: `npx tsc --noEmit -p .` clean; `npx eslint app/capture/review.tsx src/screens/review src/theme/tokens.ts` clean; `npx jest src/screens/review` 16 / 16 passing.


### Round 4: the capture flow around this screen

**The guide before every room.** `openCapture()` with access now always opens `/capture/guide` (it clears the room's guide flag first, so `/capture`'s backstop also shows the guide when a caller falls back to `/capture` offline). The guide's last step and its X ("Skip to the camera") both continue to the camera: straight there after openCapture's check, or through the same access check (`openCapture({ replace, skipGuide })`) when the guide was opened directly with `?replay=1`, so that param keeps working. Android back / the iOS edge swipe on step 1 still return to the opener. `src/capture/guideSeen.ts` is kept (the backstop, the guide and openCapture import it) but no longer stores anything: one session flag says "the guide has been shown for this room"; `resetCaptureGuide()` starts a new room. Coming back to the camera for the same room ("Add a photo", a retake) does not show the guide again. The access checks (account, Pro, monthly limit) are unchanged.

**Copy, before → after** (visible text and accessibility labels):
- Review: "Light table" → "Photos"; "Your plates" → "Your photos"; "Add a plate" → "Add a photo"; "Tap a plate to retake it" → "Tap a photo to retake it"; "I · From the doorway" → "1 · From the doorway"; "Retake plate II" / "Remove plate II" → "Retake photo 2" / "Remove photo 2"; "Plate I, From the doorway" → "Photo 1, From the doorway"; "Retake this plate" → "Retake this one"; "Before you develop" → "Before you build"; the checks → "Keep people out of the shot." · "Tuck away mail, documents, and screens." · "Turn the lights on and hold steady."; "Plates are sent to ESCAPD and an AI model to build the case. They are never shared or shown to anyone else." → "Your photos are only used to build your case. No one else sees them."; "Develop the case" → "Build the case"; "Retake the marked plates before developing." → "Retake the marked photos, then build the case."; "A case needs at least 3 plates." → "Take at least 3 photos to build the case."; "See all" removed.
- Camera: counter and prompts in Arabic numerals (1–6, the same Crimson italic; `ref.layout.camera.counter.gap` 4 → 16 so one neighbour shows each side, ~31 apart as Once's); "Six plates is a full roll" / "Continue to the light table." → "6 photos is the most a case takes" / "Review your photos."; "Keep people, mail, and lit screens out of frame." → "Keep people, mail, and screens out of the shot."; "That plate didn't take. Try again." → "That photo didn't take. Try again."; "Take plate III, The busiest wall" → "Take photo 3, The busiest wall"; "Next: plate III. 2 of 6 plates taken." → "Next: photo 3. 2 of 6 photos taken."; "Roll full. 6 of 6 plates taken." → "6 of 6 photos taken. That's the most a case takes."; "Retaking plate II." → "Retaking photo 2."; "Open / Continue to the light table, 3 plates" → "Review your photos, 3 photos taken. Ready to build." (below 3: without "Ready to build."); "Preparing plate III" → "Preparing photo 3"; "Take a plate" → "Take a photo"; prompt detail "Overlap the first plate." → "Overlap the first photo."; "Last plate" → "Last photo".
- Permission: body "You'll photograph three to six views of one room. Each photo is re-encoded on your phone first, so its location never leaves it. Nothing is sent until you develop the case." → "You'll take 3 to 6 photos of one room. Each photo's location is removed on your phone first, and nothing is sent until you build the case."; "Go to the light table" → "Review your photos"; "Opening the rangefinder" → "Opening the camera"; "Re-encoding your photos" / "Re-encoding photo 1 of 2" → "Preparing your photos" / "Preparing photo 1 of 2"; "1 plate on the roll. A case needs at least three." → "1 photo taken. A case needs at least 3."
- Guide: "One wide plate…" → "One wide photo. Get the floor and two walls in."; "…Let plates overlap." → "…Let photos overlap."; step 4 "Keep the case private" / "No people, mail, or lit screens. Lights on, hold steady." → "Just the room" / "Leave out people, mail, and screens. Lights on, hold steady." (two lines in the 317 column, checked against SF Pro 22); X "Skip the guide" / "Close the guide" → "Skip to the camera"; check line "Checking the file" → "Getting the camera ready"; "Couldn't reach the darkroom. Try again." → "Couldn't connect. Try again."

**Haptics** (one per moment, on discrete events only):
- Camera: `thud` as the shutter fires (was `tap`); `error` on a failed shot (no thud then); `success` when the 6th photo fills the set (by shutter or a library pick); `tick` on flash, grid and a lens change (not on re-choosing the same lens); `press` on the square header buttons and the last-photo thumbnail.
- Review: `press` on tiles and ×s; `thud` on the live build bar.
- Guide: `tick` on each real step change (Next, swipe, Android back), none on an ignored tap or a swipe that moves nothing; `press` on the close disc.
- Permission: `success` when the camera prompt grants access; nothing on a refusal.

**Shots** (all in `C:/Users/Dell/AppData/Local/Temp/claude/f--escapd-escapd/079a8a0e-2bca-41c1-b406-d4915e22da25/scratchpad/review07/out/`): `r4-review.png` (default), `r4-review-end.png` (scrolled to the tips), `r4-review-flag.png` (photo 2 flagged), `r4-review-2.png` (too few), `r4-review-sheet.png` (all four), `r4-guide.png`, `r4-guide-4.png`, `r4-guide-sheet.png`, `r4-camera.png` (after two photos: "2 3 4" on the counter). The harness's review and camera targets now pass through the guide's X, as a player does.

**Checks:** `npx tsc --noEmit -p .` clean; eslint clean on every file touched; `npx jest src/screens/review src/screens/guide src/capture` 205 / 205.

## 08 · In-game player (/tutorial, /play/[roomId]) and Case closed (/tutorial/complete)

Reference: none. Derived from the rebuilt screens so that a player moving from the camera or the hub into a case feels no change of app: 02 Camera (Once) for the chrome (the flat `ground`, Once's 44 pt square header buttons, the Roboto Serif title over a grey meta line, near-black wells, white glyphs whose shape shows state, the italic numerals), 01's How you play sheet for every sheet (the kit's `DarkSheet`), 07 Light table for cards, hint rows, the outlined pill and the white bar, and the shared StateScreen for loading and errors. Round 4 (your feedback): no Explore as list, no photo strip, the photo full bleed and swiped photo to photo with no gap, a sliding code picker, plain words (no "plate"), and haptics. 393 × 852 pt, safe areas 59 / 34, values in pt. Room photos keep their full colour.

Routes: `app/tutorial/index.tsx` (The Study, with coach marks) and `app/play/[roomId].tsx` (your own room; the tutorial's id redirects to `/tutorial`) both render `src/render/Player.tsx`; `app/tutorial/complete.tsx` is Case closed.

Files in `src/render/`: `Player.tsx` (states, header, tray, failure line, code sheet, Case options, all game wiring), `ScenePager.tsx` (new: the swipe between views and the page dots), `SceneView.tsx` (one view: the full-bleed fit, pinch, pan, loupe, Use-mode ring), `HotspotLayer.tsx` (brackets, seal, trace, thread, reading order), `InventoryBar.tsx` (tray, Use card, worktable), `ItemIcon.tsx`, `CodePad.tsx`, `CodeWheel.tsx` (new: the sliding digit picker), `ResultSheet.tsx`, `CoachCard.tsx`, `Toast.tsx`, `parts.tsx` (`SquareButton`, `WhiteBar`, `OutlinePill`, `QuietToggle`, `RingPressable`, `Card`, `NoticeLine`), `geometry.ts` (plus `fillWidthFit`, `freeMargin`). Deleted: `ExploreList.tsx`, `SceneStrip.tsx`. Kit: `src/components/noir/DarkSheet.tsx`. Tests: `src/render/__tests__/Player-test.tsx` (the whole Study through submit_action, the look, the pager, reading order, haptics, the code wheels, tokens only), `complete-test.tsx`, `geometry-test.ts`.

Tokens: `ref.color`, `ref.type` (`serifTitle`, `headline`, `meta`, `body`, `subtitle`, `tag`, `title`), `ref.space`, `ref.radius` (`bottomSheet`, `square`, `nested`, `knob`, `tag`, `round`), `ref.curve`, `ref.button.square / chip / quiet / ghost / disabledOpacity`, `ref.icon.chip`, `ref.focus` (via the kit), `ref.motion.counterRoll / sheetRise / sheetFall`, `ref.layout.hub.sheet` and `hub.chipRing` (the sheet is the hub's, shared through `DarkSheet`), the live `motion` timings, `z` and `hit`, and the player's own `ref.layout.play`. No live colour, type, font, radius or space; no Grain, walnut, brass (the focus ring excepted), manila, Playfair, Jakarta, mono stamps, oxblood or amber.

### Feel

The camera, turned round: the room you photographed is now the room you search, and it fills the screen. The same flat near-black ground and two-tone square buttons, a serif case name over a quiet grey "View 1 of 3", then the photo edge to edge, square at the sides, in full colour. Swipe it and the next photo slides in touching it, following the finger and settling without a bounce. Everything the game draws over the photo is white or grey: thin corner brackets on a faint black halo, grey brackets and a small check once an object is spent, heavier white ones where something just appeared, and a small pill of page dots at the photo's foot. Under it, a tip card and a row of square item buttons over black wells. Sheets slide up as the hub's does. One white bar is the strong action wherever there is one. Nothing glows; the only colour is the room.

**Accent:** none. Brass only in the focus ring.

### Layout, top to bottom (player)

| Element | Position & size | Style | Content |
|---|---|---|---|
| Screen | full bleed | `ref.color.ground` | — |
| Header row | squares y 67–111 (44, 48 hit; the slop inside the row), padX `play.edge` 21 | 02's row: one square each side, the title column between | Back · title · Case options |
| Squares | 44 × 44, 48 hit | `ref.button.square`: `raised`, radius 14 continuous, 1 pt `play.squareRim` #232323; Phosphor bold 18 (`play.headerIcon`) white | ArrowLeft · DotsThree |
| Title | line box from y 70 (`promptTop` 3), centred, one line | `ref.type.serifTitle` (Roboto Serif 17/22), `textPrimary`, role header | The case title |
| Meta | `metaGap` 3 under the title | `ref.type.meta`, `textSecondary`; hidden from screen readers (the photo's label and the page dots say it) | "View 1 of 3" |
| Photo area | from `band.photo` 12 under the squares to the tray; full width; `ScenePager` | Pages one screen wide in a row, no gap | — |
| Photo (each page) | Fills the width (3:4 on 393: 524 tall), centred in the area; square edges | `SceneView`, `fillWidthFit`: when the area is shorter than the photo, cropped evenly top and bottom only while each side loses no more than the hotspot-free margin and `photo.maxCrop` 10 % (so no hotspot is ever cut); otherwise contained (narrower, uncropped). Hotspot rects stay fractions of the image box, so geometry is exact either way. Use mode: a 1.5 white ring inside its edge (`photo.armed`) | The room photo, full colour |
| Hotspot brackets | the hotspot's rect | 10 arms, 1.5 inset, 4 side ticks (`play.brackets`); white 1.5 over a void halo 4 wide at 0.55; idle 0.42, bright under Show interactives, Use mode, a coach mark or a reveal. Solved: grey + a 16 void disc with a white Check 10 (`play.seal`). Just revealed: white 2.5 (`brackets.iris`). Solve flash: a 2 white outline. Reveal thread: dashed white on a halo | — |
| Page dots | centred, `dots.inset` 12 above the photo's foot | 02's privacy note: a void pill at 0.6; 6 pt dots 8 apart; on view white, others `textSecondary`; a view with something new: an 8 pt white ring (1.5). The control is 44 tall | one dot per view |
| Loupe | 136 circle | 4 `well` ring, 1 `rimFaint` inner rim, 2.2× | — |
| Toast | top of the photo area, 12 down | 02's privacy note: void pill at 0.6, meta white | "That doesn't work here." etc. |
| Tray | `band.tray` 12 under the photo area; rows `band.row` 12 apart; `band.foot` 8 above the safe bottom | `ground` | notice, items |
| Notice slot | edge 20 | Coach: 07's card, white Lightbulb 18, Regular 14/20 white. Hidden while an item is chosen (the Use card or the worktable takes its place; the coach's target hotspot stays highlighted). Failure: the card with 02's error line, an outlined "Try again" and a quiet "Dismiss" | — |
| Use card (one item chosen) | edge 20 | 07's card: name Bold 16, description 14 grey, the instruction in meta grey, quiet "Cancel" | "Select an object in the room to use this artifact." |
| Worktable (two chosen) | edge 20 | 07's card: two void sockets (glyph, "Slot A" grey, name white) with a grey Plus; quiet "Cancel" and the white bar "Close clasp" | — |
| Items | one row, 4 tiles across (81.75 × 72 on 393, min 76), 8 apart | 02's square button: glyph 22 over the name (meta, 2 lines). Chosen: a 1.5 white ring and the glyph's fill weight. Empty places: void wells; no items: one void well with "Items you find appear here." | — |

On 393 × 852 the photo is full width in every state shot (start, Use mode, worktable, toast, assist, reveal): the coach gives way to the Use card and the worktable, the tray is 72, and the crop takes up the rest within the hotspot-free margin.

### Swiping photo to photo (`ScenePager`)

- A pan from the gesture-handler hook API drives a Reanimated translateX on the row; it wins after 12 pt sideways (`pager.activeOffset`) and fails after 12 pt vertically, one finger only.
- It follows the finger; past the first or last view it moves at 0.3 (`edgeResistance`).
- On release it projects 0.2 s of velocity, snaps to the nearest page (one at most), and settles on an ease-out with no overshoot (`pager.easing` [0.25, 1, 0.5, 1], initial slope 4), its duration matched to the release speed within 180–380 ms. No spring.
- Only the views next to the one in view are mounted; hotspots, gestures and the photo's accessibility belong to the view in view only, and its brackets settle in as it arrives.
- Zoomed in, the pager stands down (the pan moves the photo). The loupe's press-and-hold blocks the swipe: a swipe waits for the hold to fail, which it does as soon as the finger moves, and a held loupe is never swiped away.
- A hotspot's press-in waits 120 ms (`hotspotPressDelay`), so a swipe that starts on one doesn't press it; a quick tap still does.
- Reduced motion: the row doesn't follow the finger; a swipe past 40 pt or 500 pt/s changes the view with a quick cross-fade (`motion.reducedFade`).
- The page dots are the pager's accessible control: role adjustable, label "View", value "1 of 3" (plus "Something new on view 2" when there is), increment / decrement; tapping left of centre goes back and right goes on (UIPageControl's tap). A page settling on a new view gives a `tick`.

### Sheets (kit `DarkSheet`)

`ground` fill, 40 top corners (`ref.radius.bottomSheet`), a 1 pt `rim`, black 55 % scrim (clear for the result, so the scene stays visible), Close as 01's 36 chip; slides up on `ref.motion.sheetRise` and away on `sheetFall`, no spring; cross-fades under reduced motion; focus to the title; VoiceOver trapped. New: `scrollEnabled`, held off while a code wheel is dragged.

- **Result** (58 %): title in `serifTitle`; the message on 07's card (body 16/23 white; the description 14 grey); "Added to your items" (Bold 14) with item rows; a reveal hint row with Eye 18: white "Something new is within reach." in this view, grey "Something changed on another view." in another; the white bar "Pocket artifact" / "Continue".
- **Code** (90 %): title `serifTitle`, meta the hotspot's name; the prompt 14 grey; the wheels (below); fixed slots / free field / keypad as before; the message row (02's error line); the white bar "Test combination" / "Try code" (no press haptic: the outcome gives one); "Check your items" quiet toggle.
- **Case options** (64 %): the Show interactives row (the hub's switch, a `tick` when flipped) and a quiet "Restart this case" (the system confirm follows). Explore as list is gone.

### The code wheels (`CodeWheel`)

Each wheel is a vertical picker in a 64 × 132 void well (radius 20, 02's counter pill): three 44 rows; the digit in view in the middle row in 02's italic (`play.type.digit`, Crimson Text Italic 29/34) white, the neighbours above (one less) and below (one more) in `textDim`, as the counter's. Drag it up or down to roll the digits (after 4 pt): it follows the finger, then snaps to the nearest digit on the pager's no-overshoot curve, projecting 0.12 s of velocity, 140–420 ms; 9 rolls to 0. Tapping a neighbour steps to it. A light `tick` per digit that passes the middle. Screen readers: one adjustable element per wheel, "Digit 1", value "4", increment / decrement. Keyboard: the neighbours are focusable, each with the brass ring just inside the well. A wrong code resets the wheels (rolling back quietly, no ticks), shakes them and shows the error line. Reduced motion: the drag steps a digit at a time and there is no momentum. The caret steppers are gone.

### Layout (Case closed)

Unchanged from round 3: `ground`; a centred column (inset 24): 01's tag pill "CASE CLOSED", "The Study" in Roboto Serif 30/36, the server's message (body white) and the exit line (subtitle grey), two 07 stat cards (Time, Hints used), "The next case is your own room." in 14 grey; the pinned band: the white bar "Photograph your room", quiet "Back to start", quiet "Replay The Study". Copy checked for the old metaphor: none.

### Haptics (`useFeedback`)

| Moment | Haptic |
|---|---|
| A page settling on a new view (swipe, dots tap or accessibility action) | tick |
| Hotspot press-in (after the 120 ms delay) | press |
| Back, Case options | press |
| Choosing or unchoosing an item | tick |
| An item found; a combine that works; the lock opening; the case escaped | success (one, from the outcome) |
| Use or combine that doesn't work | warning |
| A code-wheel digit | tick |
| A wrong code | error |
| The Case options switch | tick |
| The loupe crossing a hotspot | tick |
| White bar, outlined pill, quiet toggle, keypad keys, the kit's pills and Close | press (not on Test combination or Close clasp: their outcome follows) |

### Accessibility: every object without Explore as list

Explore as list was the screen-reader and motor alternative to tapping the photo. It is gone; instead:
- every revealed hotspot on the view in view is an accessible button on the photo, labelled as before (`hotspotA11yLabel`, which also says "Use the brass key on…" in Use mode), at least 48 pt with its slop;
- they are read in reading order (top to bottom, then left to right) through `experimental_accessibilityOrder` on the hotspot layer (native IDs per hotspot), while drawing stays largest-first so a small object inside a large one is on top for touch;
- the other views are one adjustable control away (the page dots: swipe up or down), and the photo's label says which view this is ("View 2 of 3");
- hidden hotspots stay absent until revealed, as before.

### Tappable elements

| Element | Hit | Action |
|---|---|---|
| Back | 48 | `onExit` |
| Case options | 48 | opens Case options |
| Hotspot | its rect, grown to 48 | inspect / use the chosen item / open the code pad |
| Photo | — | swipe to the next or previous view; pinch, pan when zoomed, double tap, press-and-hold loupe |
| Page dots | 44 tall round the pill | left of centre: previous view; right: next |
| Item tile | ~82 × 72 | toggles the item |
| Cancel / Close clasp | 48 | leave Use / combine mode; send combine |
| Try again / Dismiss | 44 / 48 | retry the failed action; dismiss |
| Code wheel | 64 × 132 (neighbours 64 × 44) | drag to roll; tap a neighbour to step |
| Sheet Close / scrim | 48 / outside | close; focus returns to the hotspot |

Focus order: Back → title → Case options → the photo → its hotspots in reading order → page dots → notice → items.

### States

Loading, offline, can't open, isn't ready, didn't open, needs an update: the shared StateScreen. Ready; mid-swipe (two photos edge to edge); Show interactives on; a coach mark; Use mode (ring on the photo and the tile, Use card, no coach); worktable (no coach; busy: the bar's spinner); result found / quiet / revealed here / elsewhere; code: idle, mid-drag, set, wrong, failed send, solved; a failed request; a toast; completing (chrome fades, photo pulls back, swiping off, then Case closed). Reduced motion: no finger-following or momentum, cross-fades instead.

### Copy before → after

- "Plate I of III" (header) → "View 1 of 3"
- Photo label "Plate 1 of 3" → "View 1 of 3"
- "Something changed on another plate." → "Something changed on another view."
- Coach: "The room has more than one view. Tap the second view below." → "The room has more than one view. Swipe to see the next one." (`src/tutorial/coach.ts`, text only)
- Strip labels "Plate I, view 1 of 3" → the page dots: "View", "1 of 3"
- Code wheels "Increase / Decrease digit 1, currently 0" → "Digit 1", value "0"
- Worktable heading "Worktable" removed (the sockets and Close clasp say it)
- Explore as list, its rows and its header button: removed

### Decisions

1. **Full bleed with a safe crop.** The photo fills the width; when space is short it is cropped evenly top and bottom only into the margin no hotspot reaches (and at most 10 % a side), so nothing important is cut; beyond that it is contained. In every state on 393 × 852 it stays full width.
2. **The coach gives way** to the Use card and the worktable, so the photo keeps its height; the coach's target stays highlighted on the photo.
3. **Page dots** on the photo's foot instead of thumbnails: the position cue, the "something new" ring, and the adjustable accessibility control in one place.
4. **Only the view in view has hotspots**; neighbours are the photo alone, and their brackets settle in on arrival.
5. **Header:** one square each side now that Explore as list is gone; the title column is wider (247 on 393).
6. **Code wheels** reuse the camera counter's look (italic white digit, dim neighbours) and the pager's settle curve.
7. **The loupe blocks the swipe** (gesture `block`) and fails on movement, so a held loupe never pages and a swipe never shows the loupe.
8. **Lock opening:** one `success` from the outcome; no press on Test combination.
9. **The worktable heading** was dropped to save its 32 pt.

### Needs you

1. **Page dots over the photo's foot** take a 44 pt tall strip about 60 pt wide at the bottom centre; a small hotspot exactly there would be harder to tap. Alternative: dots under the photo (costs about 24 pt of photo).
2. **Reading order** uses React Native's `experimental_accessibilityOrder`; check it on device (VoiceOver and TalkBack).
3. **Crop limit:** 10 % a side at most; a room with hotspots at the very top or bottom contains instead (narrower, with side bands) in tight states.
4. **Native switch** (Case options): 51 × 31 on iOS, under 44, as in the hub.
5. **Shared tokens:** none added. New geometry is in `ref.layout.play` (`pager`, `dots`, `code.wheel`, `hotspotPressDelay`, `cueRing`; `photo.maxCrop`); `plates`, `gap`, `armedGap` and `code.caret` were removed.

### Verification

- Shots: contact sheet `C:/Users/Dell/AppData/Local/Temp/claude/f--escapd-escapd/079a8a0e-2bca-41c1-b406-d4915e22da25/scratchpad/ingame/contact-round4.png` (25 states, including mid-swipe, the reduced-motion swipe and the code wheel mid-drag); singles in `…/scratchpad/ingame/out/`. Harness `…/scratchpad/ingame/shoot-play.mjs`: canned Supabase answers, an in-memory SecureStore on the web, taps by testID, and held touch drags through CDP for the mid-swipe and mid-drag frames.
- Checks: `npx tsc --noEmit -p .` clean; `npx eslint src/render app/tutorial app/play/[roomId].tsx src/components/noir/DarkSheet.tsx src/tutorial/coach.ts src/theme/tokens.ts` clean; `npx jest src/render src/tutorial` 45 / 45 plus geometry 15 / 15.

## Decisions

Each screen section has its own "Decisions" with the reasoning. These are the ones that cut across screens.

### Reversed in round 3

| Round 2 (play-screen look) | Round 3 (reference look) |
|---|---|
| Brass, walnut and manila on all five screens; Playfair titles, Jakarta body, mono plate labels | Each screen takes its reference's colours and type. The system font throughout, plus Roboto Serif (02's title), Crimson Text Italic (02's counter) and Archivo ExtraBold (03 and 05's titles) |
| Every button the play screen's 8 pt `Button` | Pills again, as in the references (kit `PillButton`). On dark screens with one strong action, the light table's white bar. The 8 pt `Button` remains only on the account screens |
| The silk background on the hub, guide and Pro | No background images. 01 has Opal's floor glow, 03 and 05 pushr's grey haze, 02 and 04 flat grounds. `BackgroundStill` was deleted |
| The hub's painted glass above the title, tilting | The glass is the small icon beside the header title, as Opal's emoji is. No tilt |
| The player, the darkroom and the loading screens in the play-screen look (soot, walnut, brass, Playfair, film plates, grain) | The reference look: the camera's ground, rounded photo well, square buttons and serif title; the hub's dark sheet; the light table's tiles, cards and white bar; white and grey marks on photos; the thinking line for waits (08, 06) |
| The light table in the play screen's look (walnut, brass, film-plate mounts, grain) | Vestiaire's layout in the camera's dark palette: a three-column plate grid with labels and ×, an outlined Add pill, a hint row, sideways check cards and a pinned Develop bar. No grain |
| Film-plate viewfinder with brass brackets and "ESCAPD 400 · PLATE I" | Once's plain rounded viewfinder, square header buttons, zoom segment, italic counter and ringed shutter |
| Sentence-case copy on 03 and 05 | Lowercase, as pushr writes it |
| The guide's "BEFORE YOU SHOOT · n OF 4" stamp | No visible step label, as in Apple Health; screen readers still hear "Step n of 4" |
| Pro as a case-file cover with a manila slip | Pro built on 03's sheet: the same haze, panel, title, body and pills, with a case-file drawing |

### Kept from earlier rounds

| Question | Decision |
|---|---|
| Where game mode lives | It **is** the hub at `/` and replaces the old title screen (you confirmed). It is the root, so it has no back or close: Opal's left chip and X disc are left out |
| Getting to the camera | `openCapture()` checks access first. A guest goes to `/account?next=back`. Without Pro → `/pro`. At the monthly limit → the build screen's limit message. With access → the photo guide, **before every new room** (round 4), then the camera |
| Paywall | `/pro` with a test purchase that grants access and lets you through (your answer). The grant is a stub (`src/capture/testPurchase.ts`) until the Edge Function exists |
| Focus ring | Brass, on every screen (your round-2 decision) |
| Your Figma notes | Three cards on the hub. The magnifier on the shutter. The grid toggle takes the flip-camera slot |
| No visible back on 03 and 05 | The system back gesture and `onAccessibilityEscape` close them, as pushr has no back control |

### Round 4 (your feedback)

| You said | Now |
|---|---|
| "should be no explore as list" | Removed: the header button, the Case options row and the sheet. Every object stays a labelled button on the photo, read top to bottom |
| Before you build: "list them vertically, no see all button" | Three friendly tips in a plain numbered list, with no See all |
| "the warning should be less threatening and dont mention AI" | "Your photos are only used to build your case. No one else sees them." Grey, no lock glyph |
| "drop the light table dark room thing" | Plain words everywhere players see or hear: photos, "Photos", "Build the case", "Building your case", "Your case is ready", "home screen", Arabic numerals. Routes and file names unchanged |
| "the step by step thing should show before you make a room every time" | `openCapture()` always opens the guide. Coming back to the camera for the same room (add or retake) doesn't repeat it |
| Home: "just the escapd logo" | The ESCAPD wordmark in white with a grey doorway edge. No magnifier, no "Case files" |
| Case screen: no photos at the bottom, taller, "no side bars", swipe "with 0 margins" | Full-bleed photo pager, square-edged with 0 gap, follow-the-finger with a no-overshoot settle, page dots on the photo's foot, "View 1 of 3" |
| "unlock box should let you slide up number" | Drag-to-roll picker wheels with dimmed neighbours, wrapping 9 → 0, a tick per digit |
| Settings: "more than 2 things" | A Settings sheet: Show interactives, Haptics, Reduce motion, Add your email, ESCAPD Pro, Version |
| The bottom sheets' "goofy ass bounce" | Slide up over 380 ms on a long ease-out with no overshoot, 40 pt corners like the camera's |
| "add some haptics too" | The app-wide vocabulary above |

## Needs you

Nothing blocks. Each item has a default that is already built; say if you want it changed.

- **01 · Card width:** Opal's cards are 187 × 320; ours are 140 × 320. Three cards at 187 would hide the side cards' labels under the centre card. The alternatives are smaller side labels, or a fan that runs past the screen edges.
- **01 · Switch:** the "on" track in Settings uses the icons' aqua; the reference shows no switch. White on pale aqua is low-contrast on iOS. The alternative is a white track with a black thumb. The native iOS switch is 51 × 31, under 44.
- **02 · Lens keyboard stops:** each half of the zoom segment is its own keyboard stop. The alternative is one stop for the pair.
- **03 · Returning players:** the white checking ground shows briefly before the camera when access was already granted.
- **03 · Large text:** with no back control, the sheet can rise to 16 pt under the status bar at the largest text sizes.
- **04 · Step 2** is drawn as a plan (three phones, overlapping views), not a held phone like steps 1, 3 and 4. Keep, or redraw it as a held-phone scene?
- **04 · Warning colour:** the replay error keeps the orange warning icon; a grey one would be closer to Apple Health.
- **07 · Privacy line:** a grey note under the check cards. As a fourth card it would make every card about twice as tall.
- **07 · × halo:** a faint dark halo keeps the white × readable over bright photos. The reference has a plain white ×.
- **07 · Flag colour:** flagged photos are amber (6.7:1). The old oxblood is 2.85:1 on this ground, too low for text.
- **07 · Tap to retake:** tapping a photo now retakes it, which replaces the per-plate retake button.
- **Pressed states** (all screens): proposals, because the screenshots show none. Pills fade one step darker; other controls dim to 0.75.
- **05 · Art:** a case file drawn in 03's phone style. A key, an evidence bag or the magnifier would be one drawing to swap.
- **06 · Build-screen states:** the account, Pro, limit and error states show text only, with no glyph, as before. One per state can be added.
- **08 · Page dots:** their tap strip (about 60 × 44 at the photo's bottom centre) could make a tiny hotspot right there harder to tap. The alternative is dots under the photo, which costs about 24 pt of photo height.
- **08 · Very tall or short rooms:** in tight states a room with hotspots at its very top or bottom is shown narrower rather than cropped.
- **01 · Settings and guests:** turning Haptics or Reduce motion on or off on a fresh install makes the player a guest (the settings live on the account), as playing The Study does.
- **08 · Copy:** "Added to the satchel" became "Added to your items", and the "EXHIBIT //" eyebrow was dropped.

## Build notes

Work the spec depends on that is outside these screens:
- **05:** write the `grant-test-entitlement` Edge Function and the `EXPO_PUBLIC_TEST_PURCHASES` flag. `src/capture/testPurchase.ts` is the stub.
- **Before any release:**
  - Remove the `ESCAPD_TEST_PURCHASES` secret from the Supabase project.
  - Leave `EXPO_PUBLIC_TEST_PURCHASES` out of production builds.
  - Replace the test path with the real purchase.
- **02 · 0.5× lens:** check that room generation (`supabase/functions/_shared/perception.ts`, `geometry.ts`) copes with ultra-wide barrel distortion. If not, limit 0.5× to plate I or hide it.
- **02, on a device:**
  - Check that the shutter glow (`boxShadow`) draws the same on iOS and Android.
  - Check that Android clips the camera preview to the 40 pt corners.
  - Check what the flash toggle does on a phone with no flash.
- **03:** re-check camera permission when the app returns from Settings (AppState).
- **On a device:** VoiceOver and TalkBack reading order for the hotspots (`experimental_accessibilityOrder`), the pager and wheel gestures, and how every haptic feels.
- **Web preview:** react-native-svg passes props to the DOM, so decorative Svgs carry their accessibility props on a wrapping View.

## Screens with no layout reference yet

Only the account screens still use the round-2 look; they have no layout of their own here.

| Route | Screen |
|---|---|
| `/account`, `/account/confirmed` | Add your email; confirming it (the confirming wait already uses the new `StateScreen`) |

**Planned, not built yet:**
- the real purchase (RevenueCat)
- My cases
- the completion screen for your own rooms
- Settings
- account management
- the hint UI
- the case intro
- the countdown after a wrong code
- cancelling a development
