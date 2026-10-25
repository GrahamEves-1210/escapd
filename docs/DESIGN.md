# ESCAPD design spec: Noir, and the play screen's look

> **Direction change (2026-10-25).** The play screen (`/play`) and the light table (`/capture/review`) are the visual identity: brass accent, Playfair case titles, film-plate framing, mono plate labels. **All five screens now follow that look.** From Noir they keep only the silk background (hub, guide, Pro). Every button is the play screen's 8 pt-rounded `Button`, and the focus ring is brass. See **The play screen's look** after Global tokens. Global tokens below are the original Noir set: most of it is no longer used by any screen (that section says which parts still are).

This document began as ESCAPD's **Noir** identity, applied to five screens: game mode (the new hub), camera, camera permission, the first-time photo guide, and the test paywall.

Noir in one paragraph: a near-black ground, quiet grey reading text and bright white statements. Soft static pools of white light may fall on key objects; reading areas stay flat. Large areas are neutral and opaque. There is **one signal colour**, oxblood red, used rarely, like a case stamp: a selection that matters, "solved", case stamps, the escape moment, and at most one "go" button per screen. Murder-mystery noir, never gore or horror.

| # | Screen | Layout reference | Your note in Figma |
|---|---|---|---|
| 01 | Game mode selection, now the hub at `/` | [docs/refs/01-game-mode.png](refs/01-game-mode.png) | "3 cards instead of 2." |
| 02 | Camera | [docs/refs/02-camera.png](refs/02-camera.png) | "the photo button has a magnifier glass icon on it." |
| 03 | Camera permission | [docs/refs/03-camera-permission.png](refs/03-camera-permission.png) | none |
| 04 | First-time photo guide | [docs/refs/04-photo-tutorial.png](refs/04-photo-tutorial.png) | "taking photos step by step short tutorial for first onboarding." |
| 05 | Pro (test paywall) | none | none |

**Where things come from.**
- **Layout:** positions, sizes and rhythm were measured from the reference screenshots in Figma, which show other apps. They're used only for layout; none of their names, copy, icons or styling carry over.
- **Look:** comes entirely from Noir.
- **Effects you supplied as web code** (Thinking states, the dither loader, the card tilt): rebuilt for React Native. Each is described where it's used, with what changed and why.

**Status.**
- All five screens are built and follow the play screen's look (branch `redesign-noir`).
- The look uses the live tokens at the top of `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `motion`, `hit`). From the `ref` export the screens still use `ref.background` (silk), `ref.focus` (now brass), `ref.motion.thinking` (with `shimmerWarm`), `ref.motion.tilt`, `ref.motion.shutterPress` and each screen's `ref.layout` block.
- Geist and Geist Mono are still installed and loaded in `app/_layout.tsx`, but no screen uses them any more; they can be removed.

**Base:** iPhone 393 × 852 pt, safe areas 59 top and 34 bottom, tap targets of at least 44 pt.

**Contents:** Global tokens · 01 Game mode · 02 Camera · 03 Camera permission · 04 Photo guide · 05 Pro · Decisions · Needs you · Screens with no layout reference yet

## Global tokens

> **Status since 2026-10-25: the original Noir set, mostly retired.** No screen uses Noir's colours, Geist type, pills, panels, oxblood signal or light pools any more; the screens use the play screen's look (next section) and the live tokens. Still in use from this set: `ref.background` (the silk still), `ref.focus` (geometry, now in brass), `ref.motion.thinking` (swap and sweep; screens use the `shimmerWarm` colours), `ref.motion.tilt` (the hub's glass), `ref.motion.shutterPress`, `ref.light.object` (only as the fixed, documented gradient component; no screen draws a pool now) and each screen's `ref.layout` block. The rest is kept below as the record of the Noir pass.

Noir is a near-black, opaque ground with quiet grey reading text and bright white statements. Soft pools of white light fall only on key objects and hero areas. One oxblood signal marks what matters to the case, the way a stamp would: a selection that changes the case, a solved case, case stamps and the escape. The tone is murder-mystery noir, terse and procedural, never gore or horror.

**Where the tokens live.** Every value below is in `src/theme/tokens.ts` as the `ref` export, so `ground` here is `ref.color.ground` in code. Nothing in the app reads `ref` yet, and the live theme above it (`color`, `font`, `type`, `space`, `radius`, `motion`, …) is unchanged. Screen sections use `ref.*` names. The only live tokens they cite are the functional game motion values (`motion.*`, see Motion).

**Fonts are not installed yet.** Geist and Geist Mono come from `@expo-google-fonts/geist` and `@expo-google-fonts/geist-mono`. When these screens are built, install both packages and add `Geist_400Regular`, `Geist_500Medium`, `GeistMono_400Regular` and `GeistMono_500Medium` to the `useFonts` call in `app/_layout.tsx`, which already holds the splash screen until fonts load. Playfair Display is already installed and loaded. Plus Jakarta Sans and JetBrains Mono are not used on Noir screens.

All sizes are iOS points on a 393 × 852 iPhone, with safe areas of 59 at the top and 34 at the bottom.

### Colours

| Token | Hex | Role | Contrast (WCAG 2.x) |
|---|---|---|---|
| **Surfaces** | | | |
| `ground` | #050505 | Ground of every screen. Opaque | — |
| `panel` | #0E0E0E | Panels, cards, sheets and frames. Fill of secondary pills, icon buttons and the segment track | — |
| `panelPressed` | #161616 | Pressed fill of anything filled with `panel` | `bright` on it 16.2:1, `read` 7.7:1 |
| `hairline` | #222222 | 1 pt edge of panels, cards, sheets, icon buttons and the segment track | 1.3:1 on ground, 1.2:1 on panel. Decorative: each control is identified by its label or glyph |
| `hairline2` | #303030 | Secondary-pill border, segment thumb, illustration context lines, determinate progress-bar track | 1.5:1 on ground. Decorative, as above |
| `scrim` | rgba(5, 5, 5, 0.72) | Dims the screen behind a sheet that covers content (01). The only translucent fill in Noir | — |
| **Text and glyphs** | | | |
| `bright` | #F2F2F2 | Titles, statements, labels on dark, glyphs, active toggles, primary fill, shutter, focus outline, dither cells, progress-bar fill | 18.2:1 on ground, 17.2:1 on panel |
| `brightPressed` | #D4D4D4 | Pressed primary fill and pressed shutter disk | — |
| `read` | #A6A9AD | Body text, quiet-button labels, pressed bare glyphs, error-message text, the reduced-motion status line | 8.6:1 on ground, 8.2:1 on panel |
| `meta` | #8A8D91 | Small supporting text, mono labels and tags, inactive toggles and segment labels, the shimmer base | 6.1:1 on ground, 5.8:1 on panel |
| `inverseInk` | #0A0A0A | Labels and glyphs on `bright` fills | 17.7:1 on bright, 13.4:1 on brightPressed |
| **Signal** | | | |
| `signal` | #C8302B | Fills and marks only: the one signal button, case stamps, the solved mark, the escape moment | 3.8:1 on ground, 3.6:1 on panel. Passes the 3:1 for marks and fails as text |
| `signalPressed` | #A82823 | Pressed signal button | — |
| `signalText` | #E5484D | The only red text on dark | 5.2:1 on ground, 4.9:1 on panel |
| `bright` on `signal` | #F2F2F2 on #C8302B | Labels on signal fills (button, stamp) | 4.8:1. 6.3:1 on signalPressed #A82823 |
| **Notices** | | | |
| `warning` | #C9A227 | Warning text and its icon | 8.4:1 on ground, 8.0:1 on panel |
| `error` | #B5564F | Error icon or mark only. The message text is `read` | 4.3:1 on ground, 4.05:1 on panel |

The text tones differ in lightness: bright to read is 2.1:1 and read to meta 1.4:1. `bright` against `meta` is 2.98:1, just under 3:1, so colour is never the only state cue. Flash also swaps glyphs (Phosphor `Lightning` when on, `LightningSlash` when off). The grid toggle's state shows as the grid lines on the viewfinder. Zoom's state shows in the feed and through the thumb (`hairline2` #303030 on the `panel` track is only 1.46:1, so the thumb is not a cue on its own either). Every toggle sets `accessibilityState={{ checked }}` and every segment option sets `selected`.

**Usage rules**
- **`signal` #C8302B** marks what matters to the case: the solved state, case stamps (`ref.stamp`), the escape or completion moment, and a selection that changes the case. It is also the fill of at most one "go" button per screen (`ref.button.signal`). That button replaces the white primary and never sits next to one. On these screens the signal appears only as:
  - the SOLVED stamp on YOUR CASE (01);
  - the 2 pt ring on the last-photo thumbnail from plate 3 on (02);
  - the "Open the camera" button on step 4 (04);
  - the "Unlock Pro" button (05), in test builds only.

  03 has no signal, and neither does 05 when test purchases are off. Utility toggles (flash, grid, zoom) never use signal: active is `bright` and off is `meta`. Never use `signal` for text (3.8:1), chrome icons, links, errors or decoration. Game moments that mark a solve, such as the solved trace, use `signal`.
- **`signalText` #E5484D** is the only red text. It works at any size on ground or panel. Use it as rarely as the signal. Never put it on a signal fill: labels there are `bright`.
- **`error` #B5564F** (4.3:1) is only ever an icon or mark: a Phosphor glyph at `ref.icon.small` 16 next to a message in `read`. Never use it for text, a button fill or a border. Next to the oxblood signal it reads as muted brick, so the two are never confused.
- **`warning` #C9A227** may be text (8.4:1), but always with an icon in `warning` (Phosphor `Warning`, 16). Today the code pad gives a wrong code the warning tone and a failure the error tone.
- A notice never relies on colour alone: it always has an icon and words.

### Backgrounds and light pools

Allowed backgrounds:
- flat `ground` #050505;
- a static light pool (below);
- the existing `Grain` overlay (`src/components/Grain.tsx`, 4 % noise, never drawn over photos);
- the background still, black silk (below).

**Background still: black silk warp (chosen).** You chose the shader library you sent, `@paper-design/shaders-react` (through beui's `ShaderBackground`), and then its black-and-white warp. The library is web-only (WebGL on a DOM canvas, no React Native renderer), so it never runs in the app. The still is rendered from it offline and shipped as an image.
- **The still:** `Warp` from @paper-design/shaders-react 0.0.81, frame 0, speed 0, colours `#050505 · #262626 · #050505`, shape `stripes`, proportion 0.5, softness 1, distortion 0.2, swirl 0.5, swirlIterations 6, shapeScale 0.3, rotation 50, scale 0.8. It reads as folded black satin.
- **Brightness:** the brightest pixel is exactly `#262626` (`ref.background.peak`), the most that keeps `meta` text at 4.5:1 anywhere on it (4.54:1). `read` is 6.4:1 and `bright` 13.5:1 at its brightest point.
- **Source:** `F:/escapd-tools/bg-shaders/out-bw/warp-silk-262626.png` (1179 × 2556), with the exact props in that folder. Ship `noir-warp-silk-lossless.webp` (522 KB) as `assets/backgrounds/noir-warp-silk.webp` (`ref.background.asset`). Lossy WebP is not allowed: at quality 95 it already pushes a few pixels to `#292929`, under 4.5:1 for `meta`.
- **Alternatives rendered:** the same warp brighter (peak `#3D3D3D`; small grey labels would then need a panel), a true black-and-white version (no text can sit on it), and a marble variant. All are in `F:/escapd-tools/bg-shaders/compare-bw.html`.
- **Where:** 01, 04 and 05 draw it under everything. **02 and 03 stay flat `ground`.** They are both states of `/capture`: the camera is where the player judges their photos, and permission hands over to it with no change of ground. Going from 04 to the camera is a `motion.sceneCrossfade`.
- **Light pools sit on top of it,** under the same rules (never behind reading text). Where a pool's centre falls on a bright fold, the sum reaches about #3A3A3A, and only opaque panels carry text there.
- **Flat reading areas:** the brief says reading areas stay flat. You chose this texture for these screens, and at this brightness the contrast figures above still hold.

Rules for any background still:
- **Grayscale and low contrast.** No hue. No pixel is brighter than about #3A3A3A.
- **Text stays readable over it.** At #3A3A3A, `bright` is 10.2:1 and `read` is 4.8:1, but `meta` is only 3.4:1. So `read` and `bright` text may sit anywhere on the still. `meta`, `label` and `note` text need #262626 or darker under every glyph (4.5:1). Check each text box against the rendered asset at the lightest pixel under it.
- **Photos are never tinted by it.** Room photos, the viewfinder feed and thumbnails sit above it, opaque. The still is never drawn over a photo, never shows through one (no alpha, no blend mode) and never replaces a frame's own edge.
- **No animation.** It has no shader speed, parallax or drift, there is no cross-fade between stills, and it never follows touch or tilt. Live shaders stay out: the library's animated variants are ambient motion, and it has no native renderer.
- **Build.** Use one `expo-image` `<Image>` that fills the screen under all content, with `contentFit="cover"`, `pointerEvents="none"` and `accessible={false}`. The master is 1179 × 2556 px (393 × 852 @3x). Ship it lossless (PNG or lossless WebP), because a low-contrast gradient bands in JPEG.

A light pool is a static radial gradient of `bright` #F2F2F2 at low alpha, drawn on the ground under a key object or hero area. Each screen section gives the pool's centre.

| Token | Radius | Stops (offset: colour, opacity) | Resulting grey on ground | Used on |
|---|---|---|---|---|
| `ref.light.hero` | 220 | 0: #F2F2F2, 0.10 · 0.5: #F2F2F2, 0.04 · 1: #F2F2F2, 0 | #1D1D1D at the centre, #0E0E0E at half radius | none since the direction change (was 01, behind the card fan) |
| `ref.light.object` | 120 | 0: #F2F2F2, 0.07 · 0.5: #F2F2F2, 0.025 · 1: #F2F2F2, 0 | #161616 at the centre, #0B0B0B at half radius | 03, on the illustration (01 and 04 no longer use pools) |

- **Build.** Use one react-native-svg `<Svg>`, absolutely positioned under the content with `pointerEvents="none"`. Inside it, a `<Rect>` is filled with a `<RadialGradient>`: `gradientUnits="userSpaceOnUse"`, `cx`/`cy` at the screen's centre point and `r` = the token's radius, using the token's stops.
- **Opacity is its own prop (bug fixed 2026-10-25).** Each stop is `stopColor` (a plain hex) plus `stopOpacity`. react-native-svg packs a stop's alpha from `stopOpacity` alone (default 1) and ignores the alpha inside an `rgba()` colour, so the first build's `rgba(242, 242, 242, 0.10)` stops painted as solid #F2F2F2 rectangles on device. The same applies to every gradient in the app (the glass glare, the shimmer, the fading line art). `src/components/noir/__tests__/gradient-stops-test.tsx` reads the packed stops the native view receives and fails on any opaque stop, and on any `rgba()`/`hsla()` stop colour in `src/` or `app/`.
- **Static.** A pool is never animated. It never pulses, never follows a touch and never moves with a scroll gesture. It stays still while 01's magnifying glass tilts above it. In 04 the pool changes along with its step.
- **One per lit object or hero area, and pools never overlap** (their alphas would add up). 01 is the only screen with two: `ref.light.hero` behind the fan and `ref.light.object` under the magnifying glass.
- **Never behind reading text.** No title, body, meta, label or note text sits inside a pool's radius unless an opaque panel above the pool carries it, like the tags on 01's cards. The reason is not contrast: `read` is still 7.1:1 at the hero centre. The rule is that reading areas stay flat.
- **Never over a room photo or the viewfinder,** never coloured, and never a halo around a button or icon.
- **Check banding on device.** The hero pool spans 24 grey levels over 220 pt, about one level every 9 pt. If bands show, put the `Grain` overlay over the pool's area.

### Typography

| Family | Faces (`ref.font`) | Package | Role |
|---|---|---|---|
| Geist | `ui` Geist_400Regular · `uiMedium` Geist_500Medium | `@expo-google-fonts/geist` (to install) | UI and reading |
| Geist Mono | `mono` GeistMono_400Regular · `monoMedium` GeistMono_500Medium | `@expo-google-fonts/geist-mono` (to install) | Labels, case numbers, dates, codes and short notes. Always uppercase and tracked |
| Playfair Display | `caseTitle` PlayfairDisplay_400Regular · `caseTitleItalic` PlayfairDisplay_400Regular_Italic | `@expo-google-fonts/playfair-display` (installed) | Case titles and the escape moment only |

| Style (`ref.type.*`) | Family | Weight | Size / line height | Tracking | Case | Colour | Used for |
|---|---|---|---|---|---|---|---|
| `escape` | Playfair Display | 400 | 40 / 44 | −0.4 | Sentence | `bright` | The escape / completion line |
| `caseTitle` | Playfair Display | 400 | 28 / 34 | −0.2 | As the case is named | `bright` | Case titles ("The Study") |
| `statement` | Geist | 400 | 30 / 34 | −0.9 | Sentence | `bright` | A screen's one large statement, e.g. 03 "Let ESCAPD use the camera" (two lines allowed) |
| `title` | Geist | 400 | 22 / 28 | −0.45 | Sentence | `bright` | Screen titles, tutorial step titles |
| `headline` | Geist | 500 | 17 / 22 | −0.2 | Sentence | `bright` | Header titles, panel headings, sheet row labels |
| `button` | Geist | 500 | 17 / 22 | −0.2 | Sentence, verb first (except the step control "Next", 04 steps 1–3) | Set by the button | Labels on pills and quiet buttons |
| `body` | Geist | 400 | 17 / 24 | 0 | Sentence | `read` | Body copy, the 01 subtitle, the 03 body |
| `meta` | Geist | 400 | 13 / 18 | 0 | Sentence | `meta` | Small supporting text; the Thinking-states line |
| `label` | Geist Mono | 500 | 12 / 16 | +1.2 | UPPERCASE (`textTransform`) | `meta`; `bright` on a stamp | Card tags, eyebrows ("1 OF 4"), stamps, segment labels |
| `note` | Geist Mono | 400 | 13 / 18 | +0.6 | UPPERCASE (`textTransform`) | `meta` | Short notes ("NONE YET"), dates, case numbers |
| `code` | Geist Mono | 500 | 28 / 34 | +2, tabular figures | Numerals and capitals | `bright` | Codes, the Roman-numeral plate counter (02) |

- **Weights.** Large type is regular (400). The one exception is `code` (Geist Mono 500, 28/34, +2), used for codes and the 02 plate counter. Otherwise Medium (500) is used only at 17 pt and below (`headline`, `button`, `label`). No bold or semibold faces: the live `font.display` (Playfair 600) and `font.wordmark` (Playfair 700) are not used.
- **Tight tracking, in em:** statement −0.03, title −0.02, headline and button −0.012, escape −0.01, caseTitle −0.007.
- **Playfair only for `caseTitle` and `escape`.** `ref.font.caseTitleItalic` exists, but no style on these screens uses it.
- **Mono widths.** Each Geist Mono character advances about 0.6 em. A `label` (12 pt) takes 7.2 + 1.2 = 8.4 pt per character, and a `note` (13 pt) takes 7.8 + 0.6 = 8.4 pt. A 90 pt run fits 10 characters.
- **Trailing tracking.** iOS adds tracking after the last glyph too. When a mono label is centred in a fixed box (stamp, segment), subtract one tracking step (1.2 for `label`) from the right padding.
- **Text size.** All text follows the system text size, and nothing shrinks to fit. The fixed heights in this section are minimums: pills grow past 52 at large sizes. The one exception is the SVG status line, which has its own fallback (see Thinking states).

### Spacing

| Token | pt | Role |
|---|---|---|
| `xs` | 4 | Title to subtitle; segment thumb inset |
| `sm` | 8 | Stamp horizontal padding; notice icon to its text |
| `md` | 12 | Between stacked pills; between related lines in one block |
| `plate` | 14 | Viewfinder side margin (02), for a 365 frame width |
| `lg` | 16 | Header controls from the screen edge; sheet title to body; game-card tag inset |
| `edge` | 20 | Default screen gutter, for a 353 content width; camera controls from the edge (02) |
| `xl` | 24 | Sheet gutter, for a 345 content width |
| `band` | 28 | Between major blocks: header to content, content to controls |
| `xxl` | 32 | From the last line of a text block to the next block or button |
| `reading` | 38 | Tutorial reading column (04), for a 317 content width |
| `ctaBottom` | 4 | Added to the 34 bottom safe-area inset. The last button's bottom edge sits at y 814 |

### Radii, borders, focus, hit targets

| Token | Value | Applies to |
|---|---|---|
| `ref.radius.panel` | 6 | Every panel, card, frame, sheet (top corners only), photo, viewfinder, thumbnail and stamp, plus the focus outline around any of these |
| `ref.radius.pill` | 999 | Buttons, icon buttons, the segment track and thumb, the shutter ring and disk, plus the focus outline around these and around bare icons and quiet buttons |
| `ref.curve` | `{ borderCurve: "continuous" }` | Spread onto every rounded View (radius 6 and 999), including photo frames and focus outlines. It is the same object as the live `curve`. iOS only: Android ignores `borderCurve` and draws circular corners |
| `ref.border.hairline` | 1 | Edges of panels, cards and icon buttons, the sheet's top edge, the segment track (`hairline`), the secondary-pill border (`hairline2`) |
| 2 pt strokes | 2 | Focus outline (`ref.focus.width`), shutter ring (`ref.button.shutter.ringWidth`), the 02 signal ring on the thumbnail |
| Line art | 1.6 / 1.5 | Illustration strokes (`ref.illustration.stroke`); viewfinder brackets (02) |
| `ref.focus` | width 2, offset 2, `bright` #F2F2F2 | Every focusable control |
| `ref.hit.min` | 44 | Minimum for every tap target |
| `ref.hit.comfortable` | 48 | Used wherever there's room |

- **Radii.** There are no other radii: no width-ratio corners and no nested-corner arithmetic.
- **Corner curve.** Every rounded shape uses `...ref.curve` (continuous, Apple-style corners). The focus outline uses it too, so the ring's curve matches the control's.
- **Focus outline.**
  - Drawn on `onFocus` and removed on `onBlur` (keyboard, switch control, D-pad).
  - It is an absolutely positioned View at inset −4 (offset 2 + width 2) with `borderWidth` 2, `borderColor` `bright` and `pointerEvents="none"`. Its `borderRadius` is the control's own token: 999 for pill shapes and 6 for panel shapes.
  - The ring rotates with a tilted game card. Resulting ring sizes: 60 tall around a 52 pill, 52 across around a 44 icon button, 84 across around the shutter.
  - VoiceOver and TalkBack draw their own focus indicators on top.
- **Hit targets.**
  - Each segment option is a Pressable at least 44 × 44. The visible 36 pt track and the 28 pt thumb (inset 4) are drawn centred behind the options, with `pointerEvents="none"`. Do not rely on hitSlop past the track's bounds: React Native does not deliver touches outside a parent's bounds on Android.
  - Bare glyphs (24) sit centred in a 44 box.
  - Stamps, tags and labels are not targets.
  - Neighbouring hit areas never overlap.

### Buttons and controls

| Control | Size | Fill | Label / glyph | Border | Pressed | Typical use |
|---|---|---|---|---|---|---|
| Primary `ref.button.primary` | 52 tall (minimum), full content width (353 / 345 / 317), radius 999 | `bright` #F2F2F2 | `ref.type.button`, `inverseInk` #0A0A0A (17.7:1), centred, one line | none | Fill → `brightPressed` #D4D4D4 (label 13.4:1) | The screen's main action: 03 "Allow the camera" / "Open Settings"; 04 "Next" |
| Secondary `ref.button.secondary` | 52 tall, full content width, radius 999 | `panel` #0E0E0E | `ref.type.button`, `bright` (17.2:1) | 1 pt `hairline2` #303030 | Fill → `panelPressed` #161616 | A second action with weight |
| Signal `ref.button.signal` | 52 tall, full content width, radius 999 | `signal` #C8302B | `ref.type.button`, `bright` (4.8:1) | none | Fill → `signalPressed` #A82823 (label 6.3:1) | At most one per screen, in place of the primary: 04 step 4 "Open the camera"; 05 "Unlock Pro" |
| Quiet `ref.button.quiet` | 44 tall, label + 16 each side | none | `ref.type.button`, `read` #A6A9AD (8.6:1) | none | Label → `bright` | A low-weight alternative: 03 "Choose photos instead"; 05 "Not now" |
| Icon `ref.button.icon` | 44 circle, radius 999 | `panel` | Phosphor 20 (`ref.icon.header`), `bright` | 1 pt `hairline` #222222 | Fill → `panelPressed` | Header controls (02); 04 close (X) |
| Bare `ref.button.bare` | 44 hit box, no visible shape | none | Phosphor 24 (`ref.icon.control`), `bright` | none | Glyph → `read` | 03 back arrow |
| Bare toggle (utility) | As bare | none | Glyph `bright` when on, `meta` #8A8D91 when off (2.98:1 apart, so never the only cue). Flash swaps glyphs: Phosphor `Lightning` on, `LightningSlash` off (add both to `src/components/icons.ts`). Grid: its lines on the viewfinder show the state | none | Glyph → `read` (either state) | 02 flash, framing grid. Never signal |
| Shutter `ref.button.shutter` | Ring 76 across, 2 pt, with a 4 pt ground gap inside it; disk 64 across | Disk `bright` | Phosphor `MagnifyingGlass` 28 (`ref.icon.shutter`), `inverseInk` | The ring, 2 pt `bright` | Disk fill → `brightPressed` and disk scale → 0.96 (`ref.motion.shutterPress`: 120 ms ease-out). The ring stays still | 02 only. The screen's primary action |
| Segment `ref.button.segment` | Track 36 tall, radius 999; thumb 28 tall, inset 4 (`ref.space.xs`), radius 999; option width ≥ 44 (thumb ≥ 44 × 28), each option a ≥ 44 × 44 Pressable over the track | Track `panel`; thumb `hairline2` #303030 | `ref.type.label`: active `bright` (11.8:1 on the thumb), inactive `meta` (5.8:1 on the track) | 1 pt `hairline` | Selecting swaps the label colours, and the thumb fades out under the old option and in under the new one over `ref.motion.control`. It does not slide | 02 zoom (0.5× / 1×) |

These rules apply to every control:
- **Pressed** is a colour change only. On press-in and press-out, a shared value moves 0 ↔ 1 with `withTiming(…, { duration: 120, easing: Easing.out(Easing.ease) })` (`ref.motion.control`; this equals CSS ease-out, bezier(0, 0, 0.58, 1)), and `interpolateColor` blends the rest colour into the pressed colour. Controls never change opacity on press, and only the shutter scales. Its scale uses the same timing: `ref.motion.shutterPress` { scale 0.96, duration 120, easing "ease-out" } is `withTiming(0.96, { duration: 120, easing: Easing.out(Easing.ease) })`.
- **Disabled** is the whole control at `ref.button.disabledOpacity` 0.4, with no press response and `accessibilityState={{ disabled: true }}`. A note that explains why a control is disabled is information, not part of the control, and stays at full opacity (see Game card). The shutter stays at 0.4 until the camera is ready and again once the roll is full.
- **Focus** uses `ref.focus` for every control (see above).
- **Labels.** Every label is one line in sentence case and starts with a verb, except the step control "Next" (04 steps 1–3). Icon-only controls carry an `accessibilityLabel`. Toggles set `accessibilityState={{ checked }}`, and segment options set `selected`.
- **Signal limit.** A screen has at most one `ref.button.signal`, and it replaces the white primary.

### Panels, case stamp, game card

| Element | Spec |
|---|---|
| Panel `ref.panel` | Fill `panel` #0E0E0E, a 1 pt `hairline` #222222 edge, radius 6. Opaque, with no shadow, elevation, gradient or blur. When the whole panel is the target, its fill turns `panelPressed` #161616 over `ref.motion.control` on press. No panel inside a panel |
| Sheet | A `ref.panel` with radius 6 on the top corners and square bottom corners that meet the screen edge. 1 pt `hairline` along the top edge. Its content ends at safe bottom + `ctaBottom`. It rises with `motion.sheetSpring`. `scrim` rgba(5, 5, 5, 0.72) sits behind it when it covers content (01 How you play); there is no scrim when the sheet is the screen's own lower half (03) |
| Case stamp `ref.stamp` | 24 tall, label + 8 each side, radius 6, fill `signal` #C8302B. Label in `ref.type.label` (Geist Mono 12, +1.2, uppercase), `bright` #F2F2F2 (4.8:1). "SOLVED" is about 66 wide (6 × 8.4 + 16). Level, not tilted, and not a control. Used for SOLVED on YOUR CASE (01) and for the escape moment's stamp. Mono eyebrows without a fill ("1 OF 4", the plate labels on thumbnails) are plain `ref.type.label` text in `meta`, not stamps. The 02 plate counter is `ref.type.code` in `bright`, not a label |
| Game card `ref.gameCard` | 122 × 209, radius 6, fill and edge as `ref.panel`. Tag in `ref.type.label`, `meta`, with no outline, 16 from the top (`tagInset`). The 90 pt run inside both insets fits 10 characters. In the three-card fan the side cards are rotated ±6° (`fanTilt`) about their centres. The hero line art follows Images. Pressed: `panelPressed`. Disabled (01 YOUR CASE with no room): 0.4 applies to the card's panel, tag and line art. The `ref.type.note` "NONE YET" is drawn outside that opacity layer at full `meta` (5.8:1 on `panel`, 6.0:1 on the dimmed card; inside the layer it would fall to about 1.8:1), and the card's `accessibilityLabel` includes it, e.g. "Your case, none yet". Solved: `ref.stamp`. The hit area is the whole card, and the focus outline has radius 6 and rotates with the card |

### Images

| Kind | Treatment |
|---|---|
| Room photos (viewfinder feed, thumbnails, plates, scene photos) | Full colour. No filter, tint, desaturation, grain, gradient, light pool or background still over them. Frames have radius 6 and use `contentFit="cover"`. The 02 continue cue is a 2 pt `signal` ring outside the frame, never a tint on the photo |
| Brand art, tutorial art, empty states, game-card icons | Grayscale line work in react-native-svg, `ref.illustration`: stroke 1.6, round caps and joins. Depth comes from line tone: hero `bright` #F2F2F2, mid `read` #A6A9AD, back `meta` #8A8D91, and context `hairline2` #303030, which fades to transparent over its last 40 pt (`contextFade`). Where a shape has to hide the lines behind it, it is filled with the surface colour (`ground` or `panel`). No gradient fills and no colour. On 01's cards: hero lines `bright`, secondary lines `read`. The one exception is the painted magnifying glass (next row) |
| Painted magnifying glass (temporary exception) | **Files:** `assets/brand/magnifier.png` 96 × 96 px (96 pt @1x), `magnifier@2x.png` 192, `magnifier@3x.png` 288 and `magnifier-1024.png` 1024 × 1024 (source: `assets-src/magnifying-glass/studio.html`).<br>**Look:** brass rim, green glass and a wooden handle, painted in colour. The user asked to keep it as it is for now, so it is the one temporary exception to "brand art is grayscale". Its brass and green are the only non-Noir colours while the exception lasts. A Noir (grayscale) version is a later experiment. It must be a re-render from the studio, never a filter or tint applied in the app.<br>**Where:** only as 01's hero object, a 128 × 128 pt box (painted area about 104 × 119), with Tilt (see Tilt). Nowhere else: the 02 shutter keeps Phosphor `MagnifyingGlass`, and no other screen, icon or empty state uses the image.<br>**Size:** the 96 pt set is too small at 128 pt, because 128 pt @3x needs 384 px and `@3x` is only 288. Use `magnifier-1024.png` (01 does), or render a 128 / 256 / 384 px set from the studio.<br>**Geometry in the 1024 file:** ink box x 95–929, y 38–986. The glass is a circle centred at (629, 339) px with r ≈ 258: (0.614, 0.331) and r 0.252 of the image box (fit within 3 px, checked by overlay). The rim's outer edge is at r ≈ 0.292. The glass is semi-transparent (alpha ≈ 0.5–0.85), so the ground and 01's pool show through it |
| Wordmark | ESCAPD in `bright`, one colour. The brass keyhole edge in `Wordmark.tsx` also becomes `bright` |

### Icons

The icon set is Phosphor (`phosphor-react-native`, imported through `src/components/icons.ts`), regular weight only. Stroke = size ÷ 16.

| Token (`ref.icon.*`) | pt | Stroke | Used in |
|---|---|---|---|
| `small` | 16 | 1.0 | Notice icons next to text (`warning`, `error`) |
| `header` | 20 | 1.25 | Inside `ref.button.icon` |
| `control` | 24 | 1.5 | `ref.button.bare`: back, flash, grid |
| `shutter` | 28 | 1.75 | `MagnifyingGlass` on the shutter disk |

- **Colours.** Icons are `bright` by default, `meta` on toggles that are off, `read` on a pressed bare control and `inverseInk` on `bright` fills. `warning` and `error` appear only on notice icons.
- **One weight.** Only regular: no bold (the live ⋯ menu's bold doesn't carry over), no fill weight and no halos.
- **Never meaning alone.** An icon never carries meaning by itself: icon-only controls have an `accessibilityLabel`, and notices include words.

### Motion

No decorative or ambient animation:
- Nothing loops, except a loading indicator while a real wait runs: the Thinking-states line, the dither, or a native in-button `ActivityIndicator` (see Loading indicators).
- Nothing follows the finger, except 01's magnifying glass. That is the one exception to "no pointer effects", granted by the user (see Tilt).
- There is no counter roll and no sliding thumb.
- A screen at rest is still.

| Motion | Token | Value | Where | Reduced motion |
|---|---|---|---|---|
| Control press | `ref.motion.control` | 120 ms ease-out, colour only | Every button, toggle, segment and tappable card | Unchanged (colour is not movement) |
| State changes that used to move | `ref.motion.control` | 120 ms colour or opacity change | Segment selection, toggles, the 02 counter changing numeral | Unchanged |
| Shutter press | `ref.motion.shutterPress` | Disk scales to 0.96 over 120 ms ease-out, plus the fill change | 02 | Colour only, no scale |
| Thinking states | `ref.motion.thinking` | See Thinking states | Darkroom waits | Cross-fade of 140 ms, `read`, no shimmer |
| Dither loader | `ref.motion.dither` | 4 × 4 cells, opacity 0.1 ↔ 1 over a 1000 ms cycle, ease-in-out, with Bayer-ordered starts 62.5 ms apart. It appears only after 300 ms. See Loading indicators | Short screen-level waits (05 Loading) | Static checkerboard |
| In-button activity | Native `ActivityIndicator` | Platform spinner, small, in the label colour | A button's own action (01 cards, 05 "Unlock Pro") | Unchanged (system control) |
| Determinate progress | — | A 2 pt bar that steps to n / N with no tween | Plates sending (`/capture/develop`) | Unchanged |
| Tilt | `ref.motion.tilt` | ±16° toward the finger: follow 400 ms, return 1000 ms, both `Easing.bezier(0.22, 1, 0.36, 1)`. Glare 0 ↔ 0.32 over 300 ms. See Tilt | 01 magnifying glass only | No tilt, no glare |
| Scene or step change | `motion.sceneCrossfade` + `motion.sceneDrift` | 200 ms cross-fade with an 18 pt horizontal drift in the direction of travel | 04 steps; gameplay scenes | `motion.reducedFade` 140 ms fade, no drift |
| Route change | Root Stack in `app/_layout.tsx` | Fade | All routes | None |
| Sheet rise | `motion.sheetSpring` | Spring with damping 28, stiffness 320, mass 1. Exit slide 200 ms. Scrim fades in over 200 ms and out over 160 ms (`Sheet.tsx`) | 01 How you play; 03 | 140 ms fade in and out |
| Viewfinder brackets settle | `motion.bracketSettle` | 380 ms, `Easing.bezier(0.2, 0, 0, 1)` | 02 | 140 ms fade |
| Wrong-code shake | `motion.wrongShake` | 4 pt over 220 ms (4 × 55 ms) | Code pad | No shake; the message only |
| Solved trace | `motion.solvedTrace` | 600 ms (300 ms in, 300 ms out), in `signal` | Solved hotspot | 280 ms fade (2 × `reducedFade`) |
| Completion pull-back | `motion.completionPullBack` | The scene scales to 0.94 over 700 ms, and the completion screen follows 250 ms later | The escape moment | No scale; 300 ms |
| Reduced fade | `motion.reducedFade` | 140 ms | Every reduced-motion swap | — |

- **Reduced motion** comes from `ThemeProvider`'s `reducedMotion`, which is on when either the system setting or the player's own preference is on.
- **Other gameplay motion** (`motion.itemAcquired` 380, toasts) is unchanged and does not appear on these screens.

### Thinking states (status line with shimmer)

This is the progress line for a real wait. The user supplied two web components from transitions.dev. The first, "Shimmer text", is a CSS band sweeping across grey text. The second, "Thinking states", is the same shimmer on a status line that rotates through several lines. Noir uses the second, with the first as its glyph layer. The tokens are in `ref.motion.thinking`: `hold` 2000, `swap` 150, `gap` 50, `distance` 8, `easing` "ease-in-out", and `shimmer` { `duration` 2000, `easing` "linear", `band` 0.8, `base` #8A8D91, `highlight` #F2F2F2 }.

**Where it appears**
- **Only during a real wait:** the darkroom's waiting states (`/capture/develop`, which has no reference screen yet) and any other real wait longer than about 1 s.
- **Never** on a title, a button, an idle screen, a skeleton placeholder, a countdown timer, or as decoration.
- **One per screen.** None of these screens has one unless its section names such a wait.
- **Stops the moment the wait ends.** Call `cancelAnimation` on its shared values, clear the hold timer and unmount it. The result screen replaces it without a final sweep.

**Copy (truthful).** The generation job reports only `queued` and `running`, so no line may claim to be the live step.

| State | Lines | Rotation |
|---|---|---|
| Running | "Finding the objects" · "Choosing what to hide" · "Writing the case" (the three things today's darkroom copy says it does) | Rotates every 2200 ms |
| Queued | "Waiting for the darkroom" | None; the shimmer repeats |
| Sending plates | "Sending plate 2 of 5" (real progress) | Swaps with the same transition each time the count changes |

Each line is sentence case, set in `ref.type.meta` (Geist 13/18) or `ref.type.body` (Geist 17/24) as the screen chooses, and kept to 28 characters or fewer. The longest decided line has 24.

**Rotation timeline** (t = 0 when a swap starts; easing is `Easing.inOut(Easing.ease)`)

| t (ms) | Outgoing line | Incoming line |
|---|---|---|
| 0 | Starts moving up 0 → −8 pt and fading 1 → 0 over 150 ms | Waits 8 pt below, opacity 0 |
| 50 (`gap`) | — | Starts rising +8 → 0 and fading 0 → 1 over 150 ms. Its shimmer restarts from the left |
| 150 | Gone. It becomes the next incoming copy | — |
| 200 | — | Settled. The `hold` begins |
| 450–1650 | — | The highlight band crosses the glyphs exactly once |
| 2200 | — | The next swap starts, and this line becomes the outgoing one |

The box keeps the width of the longest line, so it never resizes during a swap. Lines are centred and never wrap. The box does not clip: keep 8 pt clear above and below it so a moving line never overlaps neighbouring text. The web original also blurs the text 2 px during a swap. Noir drops that: there is no blur in Noir, and React Native has no CSS `filter`.

**Shimmer: the web CSS mapped to Noir**

| Web original | Value there | Noir / React Native |
|---|---|---|
| `--shimmer-dur` | 2000ms | `shimmer.duration` 2000 |
| `--shimmer-ease` | linear | `Easing.linear` |
| `--shimmer-base` | #7c7c7c | `shimmer.base` = `meta` #8A8D91 (6.1:1 on ground) |
| `--shimmer-highlight` | #0d0d0d, a dark band meant for a light page | `shimmer.highlight` = `bright` #F2F2F2 (18.2:1). On Noir's dark ground the band brightens instead of darkening |
| `--shimmer-band` 400% with stops at 40 / 50 / 60 % | The band is 20 % of a gradient four times the text's width | `shimmer.band` 0.8: the band is 0.8 × the line's width, peaking in the middle with linear ramps |
| `background-position` 100% → 0% | The band centre travels from −1 to +2 text widths, left to right | The centre `c` travels from −W to +2W (W = the line's width). The band is on the glyphs from 400 to 1600 ms of each 2000 ms pass and off for the remaining 800 ms |
| `animation: … infinite` | Loops forever | `withRepeat(…, -1, false)`, only while the wait lasts |
| `::before` with `content: attr(data-text)` and `background-clip: text` | A second text layer, kept in sync with `data-text` | One SVG `<Text>` whose fill is a gradient `meta` → `bright` → `meta`. This gives the same colours, because the CSS overlay blends `bright` over `meta` at the band's alpha. There is no duplicate string to keep in sync |
| `@media (prefers-reduced-motion: reduce)` | No animation; the line stays #7c7c7c | A static React Native `<Text>` in `read` #A6A9AD (8.6:1) |

Every colour the sweep passes through lies between `meta` and `bright`, so the line never drops below 6.1:1 on ground.

**Why the web code can't be used as it is**
- `<span>` is not a React Native host component, so the component throws on render. `className` and the `data-*` attributes are ignored.
- There is no `document` on native. The snippet's guard makes the style injection a silent no-op, so the CSS never exists.
- React Native has no pseudo-elements, no `attr()`, no CSS custom properties and no `@media`.
- React Native `<Text>` has no `background-image`, `background-clip: text` or `-webkit-text-fill-color`, so it cannot fill glyphs with a moving gradient. That leaves `background-position` with nothing to animate, so there is no direct way to sweep a band across glyphs.

**React Native build** (no new dependency: react-native-svg 15.16.0 and Reanimated 4.7.1 are installed)
- **Sizer.** For each line, render one hidden React Native `<Text>` in the chosen style, at opacity 0 with `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`. Its `onTextLayout` gives `lines[0].width` (W) and the baseline as `lines[0].y + lines[0].ascender` (React Native's `TextLayoutLine` has no `baseline` field). Check on iOS and Android that the SVG glyphs line up with the hidden sizer at the style's lineHeight, and adjust `y` by (lineHeight − (ascender + descender)) / 2 if they don't. The widest line sets the box width. The box height is the style's line height × the text-size scale.
- **Copies.** Two `Animated.View` copies, A and B, are absolutely positioned and centred over the sizer, and they swap roles at each rotation. Each has shared values for `translateY` and `opacity`, driven by `withTiming(…, { duration: 150, easing: Easing.inOut(Easing.ease) })`. The incoming copy is wrapped in `withDelay(50, …)`. A JS or Reanimated timer runs the 2000 ms hold.
- **Glyph layer.** Each copy holds an `<Svg>` (width W, height = line height × scale) containing one `<Text>`.
  - Its `fontFamily` is the style's face (`Geist_400Regular`), its `fontSize` is 13 or 17 × `useWindowDimensions().fontScale` (SVG text does not scale with the system on its own), and `y` is the sizer's baseline, `lines[0].y + lines[0].ascender`. Check on iOS and Android that the SVG glyphs line up with the hidden sizer at the style's lineHeight, and adjust `y` by (lineHeight − (ascender + descender)) / 2 if they don't.
  - The string is set as written. SVG ignores `textTransform`, and these lines are sentence case anyway.
  - `fill` is `url(#<id>)`, a `<LinearGradient>` with `gradientUnits="userSpaceOnUse"`, `y1 = y2 = 0` and three stops: 0 `meta`, 0.5 `bright`, 1 `meta`. The default pad spread keeps everything outside the band at `meta`.
  - Each copy needs its own gradient id, because both copies are on screen during a swap.
- **Sweep.** `Animated.createAnimatedComponent(LinearGradient)` with `useAnimatedProps(() => ({ x1: c.value - 0.4 * W, x2: c.value + 0.4 * W }))`. `c` starts at −W and runs `withRepeat(withTiming(2 * W, { duration: 2000, easing: Easing.linear }), -1, false)`. It is reset to −W whenever its copy starts rising in.
- **Platform check.** If a platform doesn't repaint an animated gradient, animate the `x` of a band-filled `<Rect>` instead, inside a `<ClipPath>` made from the same `<Text>`, over a base `<Text>` in `meta`. Use the same geometry.
- **Text-size fallback.** If any line wraps in its sizer at the player's text size, use the reduced-motion presentation and let the text wrap.

**Reduced motion.** The lines don't move and have no shimmer. They swap with a 140 ms `motion.reducedFade` cross-fade, in `read` #A6A9AD, as plain React Native `<Text>`.

**Accessibility**
- **Hidden decoration.** The copies, the SVG and the sizers are hidden from screen readers.
- **Fixed label.** The container is `accessible` and has a fixed `accessibilityLabel` holding the real status, e.g. "Developing your case".
- **Announcements.** Only real status changes are announced (queued → running → ready, a new plate count), never a rotation or a sweep. On Android, `accessibilityLiveRegion="polite"` handles this. On iOS, which has no live regions, call `AccessibilityInfo.announceForAccessibility(label)` when the status changes.

### Loading indicators

The user offered beui's `Loader`: 17 web variants built with motion/react and Tailwind. Noir uses one of them, the dither, ported to React Native with 16 `View`s and Reanimated (`withRepeat` and `withDelay` on opacity). Nothing new is installed; Reanimated 4.7.1 is already there. Every other wait uses Thinking states, the native spinner or a real progress bar. Pick by the wait:

| Wait | Indicator |
|---|---|
| Long (more than ~1 s), with something true to say | Thinking states (above), `ref.motion.thinking` |
| Short and screen-level (≈ 0.3–3 s), with no status line: a screen's data, or an access check with nothing on screen yet | Dither, `ref.motion.dither` |
| A button's own action while it runs | Native `ActivityIndicator` inside the button. The label stays |
| Real, countable progress (n of N) | Determinate 2 pt bar plus a mono count |

Never use the looping "percent" variant: it counts a made-up percentage, so it fakes progress. A dither never shares a wait with another indicator.

**Dither** (`ref.motion.dither`: size 24, grid 4, gap 1.2, duration 1000, easing "ease-in-out", min 0.1, max 1, color `bright` #F2F2F2). It reads as a 4 × 4 halftone developing, like a plate in the darkroom.
- **Geometry.** A 24 × 24 box of 16 square cells. Each cell is (24 − 3 × 1.2) / 4 = 5.1 pt, 1.2 apart, filled `bright`. The cells have no radius: they are halftone dots, not panels or pills. The box is centred in the area that is loading, on flat ground, with no pool or panel behind it.
- **Order.** The 4 × 4 Bayer matrix, row-major [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]. By row, top to bottom: 0 8 2 10 · 12 4 14 6 · 3 11 1 9 · 15 7 13 5. A cell's number is its order.
- **Motion.** Each cell's opacity runs 0.1 → 1 → 0.1 over 1000 ms (500 ms up and 500 ms down, ease-in-out each way), repeating. Each cell starts order ÷ 16 of a cycle late, which is order × 62.5 ms (0 to 937.5 ms).
  - In Reanimated: `opacity = useSharedValue(0.1)`, then `withDelay(order * 62.5, withRepeat(withTiming(1, { duration: 500, easing: Easing.bezier(0.42, 0, 0.58, 1) }), -1, true))`.
  - That bezier is exactly the ease-in-out of CSS and motion. `Easing.inOut(Easing.ease)`, used for Thinking states, is a close match.
  - Start all 16 in one effect, so their phases stay locked.
- **Show delay.** Start a 300 ms timer when the wait starts, and mount the dither only if the wait is still running when it fires. Clear the timer when the wait ends, so a faster wait shows nothing. If a wait often runs past ~3 s and there's something true to say, use a Thinking line instead.
- **Stop.** Unmount it the moment the wait ends, with `cancelAnimation` on all 16 values in the cleanup. There is no exit animation.
- **Reduced motion.** A static pattern with no animation: cells with order < 8 at opacity 1, the rest at 0.1. This makes a checkerboard, lit where row + column is even.
- **Accessibility.** The 24 × 24 container is one element: `accessible`, `accessibilityRole="progressbar"` and `accessibilityLabel="Loading"`, with no value, because the wait is indeterminate. The cells are hidden. It is not a keyboard or switch focus target, and it never takes focus.
- **From the web original:** the grid, order, range and timing are as decided for the web variant. Its motion/react and Tailwind rendering becomes 16 `Animated.View`s, each with `useAnimatedStyle` on opacity.

**In-button activity** (a button's own action, e.g. 05 "Unlock Pro")
- **The label stays where it is.** A native `ActivityIndicator` (`size="small"`, 20 × 20 on iOS) is added at the trailing end. It is vertically centred, with its right edge 16 (`ref.space.lg`) in from the pill's end, and drawn in the button's label colour: `inverseInk` #0A0A0A on a primary, `bright` #F2F2F2 on a secondary or signal. Nothing else is replaced.
- **Reserve its room.** A button that can go busy has a label padX of 44 (16 + 20 + 8) on both sides, so the centred label never shifts or runs under the indicator.
- **While busy,** the button ignores taps but keeps its full-opacity fill, so busy doesn't look disabled. It sets `accessibilityState={{ busy: true, disabled: true }}`, and focus stays on it.
- **Reduced motion:** unchanged. It's a system control and keeps the platform's behaviour.

**Determinate progress** (countable progress only, e.g. plates sent on `/capture/develop`, which has no reference screen yet)
- **Bar.** 2 pt tall, full column width, square ends (it's a rule, not a control). The track is `hairline2` #303030. The fill is `bright` #F2F2F2, growing from the left to n / N of the track. When n changes the fill steps to the new width with no tween, so there's no counter roll and no sliding.
- **Count.** `ref.type.note` (Geist Mono 13/18, +0.6, uppercase) in `meta` #8A8D91, e.g. "2 OF 5", right-aligned 8 pt above the bar's right end. It shows the real count only: never looped, pre-filled or estimated. Where a Thinking line already says the count in words ("Sending plate 2 of 5"), the bar sits under that line and the mono count is left out, so the count isn't said twice.
- **Accessibility.** One element: `accessibilityRole="progressbar"`, `accessibilityValue={{ min: 0, max: N, now: n }}` and a label such as "Sending plates". Only count changes are announced, as for Thinking states: `accessibilityLiveRegion="polite"` on Android, `announceForAccessibility` on iOS.

**Rejected variants**

| Variant | Why not |
|---|---|
| percent | Loops a made-up percentage, so it fakes progress |
| spinner, comet, helix | Decorative rotation. Where a spinner belongs (inside a button), the native `ActivityIndicator` is used |
| newton, morph, bars, dots | Playful, decorative motion |
| metaballs | Playful, and it needs an SVG blur filter. Noir has no blur |
| scramble | A decorative text effect |
| ascii sets | Feels like a terminal or AI chat, not a case file |

### Tilt (the magnifying glass)

This is the one exception to "no pointer effects", granted by the user: 01's painted magnifying glass tilts toward a press-and-drag. It is the user's transitions.dev "Card hover tilt", a web hover effect, ported to touch. The tokens are in `ref.motion.tilt`: `perspective` 1000, `max` 32 (the full swing, so ±16°), `follow` { 400, [0.22, 1, 0.36, 1] }, `return` { 1000, [0.22, 1, 0.36, 1] } and `glare` { `opacity` 0.32, `fade` 300, three `layers` }.

**Where.** 01 only. The glass is the hero object in the empty band between the divider and the title (box 128 × 128 at y 152–280, painted area about 104 × 119), under a static `ref.light.object` pool that stops at the title's top edge. The pool stays still, and nothing else on the screen moves. 01's section has the exact numbers.

**Web original → React Native**

| Web original | React Native (Noir) |
|---|---|
| Hover, tracked on an outer wrapper that never transforms | Press-and-drag, tracked on a plain wrapper `View` the size of the art box that never transforms. Tracking the wrapper rather than the tilting image keeps the image from sliding out from under the finger.<br>Gesture: `usePanGesture({ minDistance: 0, maxPointers: 1, … })` in a `GestureDetector`, the RNGH 3.3 hook form already used in `src/render/SceneView.tsx`. `Gesture.Pan().minDistance(0)` is the same gesture but is deprecated in RNGH 3.3. With minDistance 0 it activates on touch-down |
| Pointer position over the card, 0–1 | `px = clamp(e.x / w, 0, 1)` and `py = clamp(e.y / h, 0, 1)`, local to the wrapper. Clamped because a pan keeps reporting after the finger leaves the box |
| rotateY = (px − 0.5) × 32° | The same: `(px - 0.5) * ref.motion.tilt.max`, so ±16° |
| rotateX = (0.5 − py) × 32° | The same, ±16°. The top edge tips away when the finger is near the top |
| perspective 1000 | `transform: [{ perspective: 1000 }, { rotateX: rx + "deg" }, { rotateY: ry + "deg" }]` on the inner `Animated.View`. React Native has no parent `perspective` for children to inherit, so it goes into the view's own transform, first in the array |
| Follows over 400 ms, cubic-bezier(0.22, 1, 0.36, 1) | Every gesture update re-targets: `rx.set(withTiming(target, { duration: 400, easing: Easing.bezier(0.22, 1, 0.36, 1) }))`, and the same for `ry`. Each new target starts from the current value, as a CSS transition does when it changes mid-flight |
| When the pointer leaves, eases flat over 1000 ms on the same curve | `onFinalize` (release or cancel) runs `withTiming(0, { duration: 1000, easing: Easing.bezier(0.22, 1, 0.36, 1) })` on both axes. A plain tap tips briefly toward the tap point and settles back |
| Glare: three layered white radial gradients (95 / 200 / 360) centred under the pointer, blended with mix-blend-mode | Three react-native-svg `RadialGradient`s at r 95 / 200 / 360 pt, with the stops and offsets from `ref.motion.tilt.glare.layers`. Plain white alpha with no blend, **clipped to the lens circle** |
| Glare fades in to 0.32 over 300 ms while hovering | The glare's `Animated.View` goes 0 → 0.32 on touch-down and back to 0 in `onFinalize`, over `glare.fade` 300 ms. The token sets no curve, so use `Easing.out(Easing.ease)`, as `ref.motion.control` does |

**What changed, and why**
1. **Hover became press-and-drag.** Touch has no hover, so nothing moves until a finger is down.
2. **The glare is clipped to the lens.** It is light on glass, so the brass rim, the handle and the ground get none. On the web it covered the whole card.
3. **No blend mode.** The glare is plain white alpha, as decided. React Native 0.88 does have a `mixBlendMode` View style (New Architecture), so a blended glare is possible later if plain alpha looks flat on device. It isn't used now.
4. **px became pt, with the values unchanged.** The radii were sized for a web card. On the ≈ 60 pt lens, the 95 layer makes the visible hotspot, and the 200 and 360 layers lift the whole lens almost evenly. Under the finger the three layers stack to 1 − 0.52 × 0.78 × 0.90 = 0.635 alpha, × 0.32 = about 0.20 white. Check it on device. Scaling the radii would be a change for the user to approve.
5. **Perspective moved into the view's own transform** (see the table).

**Build**
- **Tree.**
  1. A wrapper `View`: the art box, with the `GestureDetector` and no transform.
  2. Inside it, the tilting `Animated.View`, with the transform from `useAnimatedStyle`.
  3. Inside that, an expo-image `<Image>` (`magnifier-1024.png`, `contentFit="contain"`) and the glare `Animated.View` (absolute fill, animated opacity, `pointerEvents="none"`).
  4. Inside the glare view, `<Svg width={w} height={h}>`.
- **Clip.** `<Defs>` holds `<ClipPath id="lens"><Circle cx={0.614 * w} cy={0.331 * h} r={0.252 * w} /></ClipPath>`: the glass circle measured in Images, which in 01's 128 × 128 box is centre (78.6, 42.4), r 32.3. Then `<G clipPath="url(#lens)">` holds three full-box `<Rect>`s filled `url(#glare1)`, `url(#glare2)` and `url(#glare3)`. Re-measure the circle if the art is re-rendered.
- **Glare centre.** Each `RadialGradient` has `gradientUnits="userSpaceOnUse"`, with `cx` = `fx` and `cy` = `fy` = the finger position in wrapper coordinates. These are set directly, with no easing, through `useAnimatedProps` on `Animated.createAnimatedComponent(RadialGradient)`. On release the glare fades out where it is. The glare sits inside the tilting view, so it tilts with the glass. The small offset between wrapper and tilted-image coordinates (a few pt at most at ±16°) is not corrected.
- **Platform check.** If a platform doesn't repaint an animated gradient centre, clip with a circular `View` at the lens instead (`overflow: "hidden"`, `borderRadius` = r), and move a fixed-gradient SVG inside it with `translateX` and `translateY`.
- **No conflicts.** The gesture covers only the art box, and no tap target may sit under it, because with minDistance 0 it claims the touch at once.

**Reduced motion.** No tilt and no glare. The image is static and the gesture is `enabled: false`, so it captures no touches.

**Accessibility.** The glass is decorative. The wrapper is `accessible={false}`, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"` and `focusable={false}`, with no role, label, action or haptic. Screen readers, keyboard and switch focus all skip it.

**Glare stops.** `ref.motion.tilt.glare` holds one `color` (#FFFFFF) and, per layer, `opacities` beside `offsets` (95: 0.48 · 0.06 · 0; 200: 0.22 · 0.04 · 0; 360: 0.10 · 0). Each `<Stop>` is `stopColor={glare.color}` plus `stopOpacity`, for the reason given under light pools.

## The play screen's look (all five screens)

Since 2026-10-25 every screen in this document follows the identity of the play screen and the light table, the live theme in `src/theme/tokens.ts` ("The Darkroom Dossier & Brass Mechanism"): first the hub (01), the photo guide (04) and Pro (05), then the camera (02) and camera permission (03). The hub, guide and Pro keep Noir's **silk background** (`ref.background`); the camera route (02, 03) stays on flat canvas so photos are judged on a plain ground. Each screen's section below describes it as built.

| Element | How it's built | Tokens |
|---|---|---|
| Ground | `color.canvas`, then the silk still (`BackgroundStill`), then film grain (`Grain`), as on `/play` and the light table. No light pools | `color.canvas`, `ref.background` |
| Case titles, cover statements | Playfair Display SemiBold 34/38 | `type.caseDisplay` |
| Screen headings | Playfair Display SemiBold 24/30 | `type.narrativeTitle` |
| Prose lines | Playfair Display Regular 18/26 | `type.narrative` |
| UI and reading text | Plus Jakarta Sans | `type.sectionTitle`, `type.body`, `type.control`, `type.caption` |
| Plate labels, file labels, top-bar stamps | JetBrains Mono 11/14, +1.2, in capitals, brass: "LIGHT TABLE", "PLATE III", "ESCAPD 400 · PLATE I" | `type.stamp` + `color.accent` |
| Film-plate mount | Walnut mount with a 1 pt brass hairline around an inner plate on soot with a 1 pt rim. Large: 30 / 24 radii (SceneView). Small (cards, thumbnails): 18 / 14 (light table tiles). A brass mono plate label sits under it | `color.surface`, `color.hairline`, `color.canvas`, `color.rim`, `radius.mount`/`radius.image`, `radius.thumbRing`/`radius.thumb`, `curve` |
| Manila slip | Dossier content and checklists, ink text, stamp heading in ink (the light table's "BEFORE YOU DEVELOP", the case-closed dossier) | `color.manila`, `color.ink`, `radius.slip`, `space.lg` |
| Panels and notices | Walnut, 1 pt brass hairline, radius 8 | `color.surface`, `color.hairline`, `radius.control` |
| Top bar | Live `IconButton` (48 round, glyph in `color.text`), a centred brass stamp, a 48 spacer: the light table's pattern | `hit.min` |
| Sheets and switches | Live `Sheet` (as `/play`'s Case options) and React Native `Switch` with a brass track | `color.accent`, `color.hairline`, `color.text` |
| Buttons | The play screen's own `Button` (`src/components/Button.tsx`) on every screen: 8 pt corners, at least 48 tall, `space.gutter` / `space.md` padding, label in `type.control` (Jakarta SemiBold 15/20), centred. Primary is brass with the dark label (the main "go"), pressed `color.accentPressed`; secondary is walnut with a 1 pt brass hairline; quiet is text only; destructive is walnut with the error label. Pressed 0.82, disabled 0.45, `loading` swaps the label for a spinner. Icon buttons are the play screen's `IconButton` (48 round). No pills, no oxblood | `radius.control`, `hit.min`, `color.accent`, `color.onAccent`, `color.raised`, `color.hairline` |
| Focus ring | A 2 pt **brass** ring 2 pt outside the control, following its shape (12 pt corners around an 8 pt button, round around an icon button, the control's own shape on custom controls such as cards, the shutter and the lens switch). `Button` and `IconButton` draw it themselves, stepping out by their 1 pt edge when they have one. Shown only for keyboard, D-pad and switch focus | `ref.focus` (`color.accent`, 8:1 on canvas) |
| Waits | `ThinkingStates tone="warm"`: the same swap and sweep in live caption / body / stamp type, from `color.textSecondary` to `color.text`. Short waits with no status line: a small `ActivityIndicator` in brass | `ref.motion.thinking.shimmerWarm`, `color.accent` |
| Case stamps ("SOLVED") | Brass stamp text in a 1 pt brass bordered box, never oxblood | `type.stamp`, `color.accent`, `radius.control` |
| Errors on dark | An icon in `color.warning` or `color.error` beside text in `color.textSecondary`. Error-coloured text only on manila (5.0:1) | — |

**Contrast on the silk's brightest pixel (#262626):** `color.text` 12.9:1, `color.textSecondary` 5.6:1, `color.accent` 6.1:1, `color.warning` 5.3:1; `color.error` only 2.3:1, so it is never used as text on a dark ground. `color.onAccent` on brass is 7.3:1 (9.7:1 pressed); ink on manila is 13.8:1.

## 01 · Game mode (the hub at /)

Reference: docs/refs/01-game-mode.png (layout only). The look is the play screen's: /play's Kodachrome mount and brass plate label (src/render/SceneView.tsx), the light table's heading and caption (app/capture/review.tsx), the case-closed panels and rule (app/tutorial/complete.tsx), Case options' sheet and switch (src/render/Player.tsx), and /play's live buttons (src/components/Button.tsx, IconButton.tsx). 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`, `motion`), plus `ref.background` (the silk), the live `Button` (`radius.control` 8, `minHeight` `hit.min` 48), `ref.button.disabledOpacity` (the kit's 0.4, for dimmed cards), `ref.motion.thinking.shimmerWarm` (through `ThinkingStates tone="warm"`), `ref.motion.tilt` (the glass), the kit's brass focus ring (`ref.focus`, `color.accent`) and control timing (`ref.motion.control`), and the screen's own `ref.layout.hub` (`wordmarkHeight` 14, `hairline` 1, `glass` 128, `lens` (0.614, 0.331) r 0.252, `weights` 7 : 7 : 50 and 15 : 17, `fan` { height 226, sideOffset 105, sideDrop 10, tilt 6, cover 28, minWidth 375, maxFontScale 1 }, `card` { 122 × 209, art 48, artStroke 1.6 }, `stackedMinHeight` 96, `noticeIcon` 18, `sheetExit` 200, `sheetFocusMargin` 100). No Geist, no NoirText, no `ref.type` or `ref.color`, no light pool, no oxblood.

Route: `app/index.tsx` (`/`) re-exports `src/screens/hub/HubScreen.tsx`. Files: `HubScreen.tsx` (layout, routing, sheet, notice slot, focus return), `Deck.tsx` (fan, stack, fan focus ring), `GameCard.tsx` (mount, plate, labels, SOLVED stamp, busy), `CardArt.tsx`, `CardNote.tsx`, `HubNotice.tsx`, `HowYouPlaySheet.tsx`, `Magnifier.tsx` (the glass), `layout.ts` (geometry rules), `caseStatus.ts` (every word and state), `useHubData.ts` (fetch and follow). Tests: `src/screens/hub/__tests__/hub-test.tsx`, `layout-test.tsx`.

### Feel

Three case files laid on the silk under a brass reading glass, each one a small photographic plate on a walnut mount, the way /play mounts the player's room. The ground is the black silk still under the live grain, and nothing is lit from behind: the mounts' brass hairlines and the brass labels carry the page. One Playfair statement ("Choose a case") with a small warm caption under it, as the light table heads its plates. Each plate holds a fine warm line drawing (cream hero lines, taupe secondary lines, brass details), and under each plate sits a brass mono plate label (THE STUDY, YOUR ROOM, YOUR CASE) with a short status note. After the player solves their own case, a brass SOLVED stamp is pressed on the corner of that plate. Nothing moves unless something is happening: a mount warms and its hairline brightens to brass when pressed, the How you play sheet rises, a small brass indicator turns on a plate while its card opens, and a warm shimmer crosses DEVELOPING while the player's room is being built. The glass is the one exception: press and drag it and it leans toward the finger with a glint on its lens; let go and it settles flat. It never moves on its own. The voice is terse, procedural and case-file.

**Accent on this screen:** brass only (`color.accent` #C89D54): the plate labels, the mounts' hairlines (`color.hairline`, brass at 0.32), the line art's details, the rule under the header, the SOLVED stamp, the busy indicator, the Show interactives track and the guide button's hairline. The painted brass glass is art, not accent. There is no "go" button on the screen (the cards are the actions) and no `variant="signal"`.

### Layout, top to bottom

393 × 852, default text size, all three cards idle, glass shown.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Root `color.canvas` #090807. Then `<BackgroundStill />` (`ref.background.asset`, the black silk warp, peak `ref.background.peak` #262626, contentFit cover; the kit paints its own ground until it decodes). Then the live `<Grain />` (assets/grain.png repeated at 0.04 opacity), as /play and the light table. Then content. **No light pools** (removed with their layout code and tokens) | — |
| Status bar | y 0–59 | System, light content | — |
| Header row | y 63–111 (48): safe top + `space.xs` 4, the `hit.min` 48 row, `space.xs` 4 below (header box y 0–115). padX `space.gutter` 20 | /play's top-bar spacing with the light table's gutters: a spacer, a centred mark, a button | — |
| Header, left slot | x 20–68, y 63–111 (48 × 48) | Empty `hit.min` spacer, not focusable (the hub has no account entry) | — |
| Wordmark | Centred on x 196.5: 66.3 × 14 at x 163.4–229.6, y 80–94 (centre y 87, level with the button) | `<Wordmark height={14} />` (`ref.layout.hub.wordmarkHeight`) with its defaults: strokes `color.text` #F2ECE1, the D's doorway edge `color.accent` (the brass edge; the old bright edge is dropped). iOS: a wrapping View, `accessibilityRole="image"`, label "ESCAPD"; Android reads the Svg's own label | ESCAPD wordmark |
| How you play | Button x 325–373, y 63–111, centre (349, 87). Its 4 hitSlop and its focus ring reach x 321–377, y 59–115, inside the header | The live `IconButton` (48 round, `surface="plain"`: no fill, no border; pressed opacity 0.75, disabled 0.4). Glyph Phosphor `Question` at `ICON_SIZE` 22, `ICON_WEIGHT` regular, `color.text`. It draws its own brass focus ring (State: Focus); the hub composes none | Help mark for How you play |
| Rule | y 115–116, x 20–373, 1 pt (`ref.layout.hub.hairline`) | `color.hairline` rgba(200,157,84,0.32), flat, as the case-closed screen rules off a section | — |
| Column | y 116–818 (702): a flex column from the rule to the safe bottom | Holds the glass (128), the hero block (302) and three spacers at 7 : 7 : 50 over the remaining 272 | — |
| Glass spacer, top | y 116–145.75 (29.75); flex 7 | Silk and grain | — |
| Magnifying glass | Box 128 × 128 at x 132.5–260.5, y 145.75–273.75, centred on x 196.5. Lens (glass inside the brass rim) at (0.614, 0.331) r 0.252 of the box: (78.6, 42.4) r 32.3 box-local, (211.1, 188.2) on screen. Painted ink 104.4 × 118.8; at full tilt it stays inside its 128 box | `assets/brand/magnifier-1024.png` unchanged, expo-image `contentFit="contain"`, full colour (the painted brass is art). No shadow, halo or outline, and no pool behind it any more. A non-transforming 128 drag wrapper holding a 128 `Animated.View` that tilts (`ref.motion.tilt`), with a lens-clipped glare layer whose stops carry `stopColor` + `stopOpacity` (`ref.motion.tilt.glare`). Hidden from accessibility | The brass reading glass (decorative) |
| Glass spacer, bottom | y 273.75–303.5 (29.75); flex 7 | Silk and grain | — |
| Title | Line box y 303.5–333.5 (30), centred, 152.1 wide (x 120.5–272.6) | `Text variant="narrativeTitle"` (Playfair Display SemiBold 24/30), tone primary `color.text` (12.9:1 at the silk peak), `accessibilityRole="header"`, padX 20 | **"Choose a case"** |
| Subtitle | Line box y 337.5–355.5 (18), `space.xs` 4 below the title, 141.2 wide | `Text variant="caption"` (Plus Jakarta Sans Medium 13/18), tone secondary `color.textSecondary` #A89C8A (5.6:1 at the peak), as the light table's caption under its heading. Fixed line | **"Three files on the desk."** |
| Fan container | y 379.5–605.5 (226, `ref.layout.hub.fan.height`), `space.xl` 24 below the subtitle; never clips | — | 3 cards. Visual extent x 21.7–371.3, y 379.5–602.5 (349.6 wide) |
| Card, centre | x 135.5–257.5, y 379.5–588.5: 122 × 209 (`ref.layout.hub.card`), upright, on top (`zIndex`) | Card material below | **YOUR ROOM** |
| Card, left | Centre (91.5, 494); unrotated box x 30.5–152.5, y 389.5–598.5 (`fan.sideOffset` 105 left of the axis, `fan.sideDrop` 10 lower); `rotate: -6deg` (`fan.tilt`) about its centre; under the centre card, which covers its inner edge 5.8 wide at the top, 16.8 at mid-height and 27.7 at its foot | Same | **THE STUDY** |
| Card, right | Centre (301.5, 494); unrotated box x 240.5–362.5; `rotate: 6deg`; the mirror | Same | **YOUR CASE** |
| Card material: mount | Each card, 122 × 209 | Walnut mount, as /play's Kodachrome mount at the small radii: fill `color.surface` #14110E, 1 pt `color.hairline` on all four sides, `radius.thumbRing` 18, `curve` (continuous). Opaque: the centre card's hairline is what separates it from the side cards beneath. No shadow, gradient or translucency | — |
| Card material: plate | Card-local x 4–118, y 4–155 (114 × 151, ≈ 3:4), inset 4 = `radius.thumbRing` − `radius.thumb`, so the corners are concentric | Fill `color.canvas` #090807, 1 pt `color.rim` rgba(255,255,255,0.10), `radius.thumb` 14, `curve`: the light table's tile edge | — |
| Content column | The axis everything on a card centres on. Centre card: x 4–118 (axis 61). Left card: x 4–94 (axis 49). Right card: x 28–118 (axis 73): `fan.cover` 28 in on the side under the centre card, the mount's 4 on the outer side | — | — |
| Line art (on the plate) | 48 × 48 (`card.art`), on the axis, centred on the plate: card-local y 55.5–103.5 (centre 79.5) | react-native-svg line drawing, stroke 1.6 (`card.artStroke`), round caps and joins, no fill, gradient or halo. Hero lines `color.text`, secondary lines `color.textSecondary`, brass details `color.accent`. Static; rotates with its card | Study: arched door (hero), threshold (secondary), keyhole (brass). Room: a room corner, its vertical edge (hero) and two diverging floor lines (secondary), inside four viewfinder brackets (brass, like /play's registration marks). Case: folder (hero), its tab ruled off (secondary), a seal circle (brass) |
| Plate label (the tag) | Card-local line box y 163–177, `space.sm` 8 under the plate, centred on the axis. 70.2 wide (9 glyphs × 7.8) | `Text variant="stamp"` (JetBrains Mono Medium 11/14, +1.2, written in capitals), `tone="accent"` (7.5:1 on the walnut), the pattern of SceneView's "ESCAPD 400 · PLATE I" | THE STUDY · YOUR ROOM · YOUR CASE |
| Status note | Card-local y 179–197 (one caption line, 18), `space.xxs` 2 under the tag, centred on the axis; `space.sm` + 4 = 12 to the card's foot | `Text variant="caption"`, tone secondary (7.0:1 on the walnut). Widths: Unseal 41.9, Continue 57.5, Replay 42.8, Photograph 74.9, Open 35.6, See why 52.1, None yet 56.2, Offline 43.4, Try later 49.0. DEVELOPING is the warm Thinking state instead (States) | Study: Unseal / Continue / Replay. Room: Photograph. Case: see Case status |
| SOLVED stamp (YOUR CASE only) | Card-local x 45.2–110, y 123–147 (64.8 × 24): pressed on the plate's lower right corner, `space.sm` 8 in from its right and bottom edges. Screen centre ≈ (314.8, 526.1) | A brass case stamp: 1 pt `color.accent` border, `radius.control` 8, `curve`, padding `space.xs` 4 × `space.sm` 8, no fill; label `stamp` in `tone="accent"` (8.0:1 on the plate). Upright on its card, so it carries the card's +6°. Static, appears without animation. Never oxblood | **SOLVED**, only when the latest session on the player's newest own case is completed |
| Lower spacer | y 605.5–818 (212.5); flex 50 | Silk and grain | The notice overlays this space |
| Notice (when shown) | x 20–373 (353, `space.gutter` sides), top y 629.5 (`space.xl` below the fan container), 44 tall for one line (bottom 673.5). Text column 293 wide: both messages fit one line at the default size (283.6 and 202.2) | Panel as the case-closed stat panels: `color.surface`, 1 pt `color.hairline`, `radius.control` 8, `curve`, padding `space.md` 12 × `space.lg` 16. Icon Phosphor at 18 (`ref.layout.hub.noticeIcon`, as /play's failure banner) in `color.warning` #D4883A (6.6:1), centred on the first caption line; `space.sm` 8; text `caption` in tone primary. Absolutely positioned in an always-mounted slot, so the layout never shifts | See States |
| Safe bottom | y 818–852 | — | — |
| **How you play sheet** (over everything) | Scrim full screen. Sheet x 0–393, y 609–852 (243), `maxHeight` 64 % (545) | The live `Sheet`, `titleStyle="utility"`, as /play's Case options. Scrim `color.sheetScrim` rgba(9,8,7,0.55), fades in 200 / out 160. Sheet `color.surface` walnut with the live grain, 1 pt `color.hairline` top edge, top corners `radius.sheet` 20, a 1 pt `color.brassRule` inner rule 4 in, a 42 × 4 brass handle (`color.accent`) at y 618–622. Rises with `motion.sheetSpring` (damping 28, stiffness 320), leaves with a 200 ms slide | — |
| Sheet: header row | y 630–678 (48) | Title at x 20, line box y 642–665: `sectionTitle` (Plus Jakarta Sans SemiBold 18/23), tone primary, `accessibilityRole="header"`. Close: live `IconButton` 48 at x 337–385 (8 from the right edge), `X` at 22 in `color.textSecondary` | **"How you play"** · Phosphor `X` |
| Sheet: Show interactives row | y 690–730 (40), 12 below the header | Text column x 20–310 (290): label `control` (Plus Jakarta Sans SemiBold 15/20) tone primary, y 690–710, hidden from screen readers (the switch carries it); `space.xxs` 2; description `caption` tone secondary, y 712–730, one line at the default size (285.5 of 290), two at larger text. `space.md` 12. React Native `Switch` at x 322–373 (iOS 51 × 31), centred on the row: `trackColor={{ true: color.accent, false: color.hairline }}`, `thumbColor={color.text}` | **"Show interactives"** / "Keep the marks on objects you can use visible." (Case options' copy) |
| Sheet: guide button | x 20–373, y 746–794 (353 × 48), `space.lg` 16 below the row | The live `Button variant="secondary"` (/play's button): `radius.control` 8, `minHeight` `hit.min` 48, padding `space.md` 12 × `space.gutter` 20, fill `color.raised` #1E1915, 1 pt `color.hairline`, label `control` in `color.text` (14.8:1), centred; pressed opacity 0.82 | **"How to photograph a room"** |
| Sheet: bottom | y 794–852: content `space.sm` 8 + sheet `space.lg` 16 + safe bottom 34 | — | — |

**Totals on 852:** safe top 0–59; header 59–115 (buttons 63–111); rule 115–116; glass spacer 116–145.75; glass 145.75–273.75; glass spacer 273.75–303.5; title 303.5–333.5; gap 4; subtitle 337.5–355.5; gap 24; fan 379.5–605.5; lower spacer 605.5–818; safe bottom 818–852. Header 57 = 4 + 48 + 4 + 1. The column (116–818, 702) holds the glass (128) and the hero block (30 + 4 + 18 + 24 + 226 = 302), and splits the remaining 272 at 7 : 7 : 50 (29.75 : 29.75 : 212.5). Without the glass (States) the column falls back to two spacers at 15 : 17 around the hero block: 187.5 : 212.5 on this screen, which puts the title and fan exactly where they are with it. The sheet runs 609 + 1 + 8 + 4 + 8 + 48 + 12 + 40 + 16 + 48 + 8 + 16 + 34 = 852.

**Fan card, card-local (default text size):** mount 0–122 × 0–209; plate x 4–118, y 4–155; art 48 on the axis, y 55.5–103.5; busy indicator and SOLVED stamp in the plate's lower band (indicator y 127–147, stamp y 123–147); plate label y 163–177; note y 179–197; 12 to the foot. The label block is laid out from the foot up (4 + 8, the caption line, 2, the stamp line, 8), so below the default text size the lines shrink and the plate takes what they give back.

**Content centres on screen:** centre card: label (196.5, 549.5), note (196.5, 567.5), art (196.5, 459.0). Left card: label (86.4, 560.4), note (88.3, 578.3), art (77.0, 470.4). The right card mirrors it: (306.6, 560.4), (304.7, 578.3), (316.0, 470.4).

**Side-card clearance** (from the centre card's edge, along the side card's own width, at the deepest point of each element): every plate label 13.5; DEVELOPING 7.7; notes: Continue 17.8, None yet 18.4, See why 20.5, Try later 22.0, Replay 25.1, Unseal 25.6; line art 32.3; SOLVED stamp 24.0; busy indicator 41.8. Centred on the card instead, the labels would clear by 1.5 and DEVELOPING would run 4.3 under the centre card: that is why side cards centre on the exposed face (Decision 9).

### Tappable elements

| Element | Hit area ≥ 44 | Action in ESCAPD |
|---|---|---|
| How you play button | 48 + the live `hitSlop` 4 = 56 × 56, x 321–377, y 59–115 (all inside its own box and the header, so the slop is reachable) | Opens the How you play sheet. a11y: role button, label "How you play". Disabled (0.4) while a card is busy |
| Magnifying glass (a drag surface, not an action) | The outer wrapper, 128 × 128 at x 132.5–260.5, y 145.75–273.75, no `hitSlop`. 30.75 below the How you play hit area, 105.75 above the fan | **No action:** no tap handler, navigation, haptic or role; not focusable; hidden from screen readers. Press-and-drag tilts it with `ref.motion.tilt`: Pan with `minDistance(0)`, `shouldCancelWhenOutside(false)`, `maxPointers(1)`; px, py = finger ÷ 128 clamped 0–1; rotateY = (px − 0.5) × 32, rotateX = (0.5 − py) × 32 (±16°) under `perspective` 1000, each update re-targeting `withTiming` 400 ms on bezier(0.22, 1, 0.36, 1). Glare: the token's three white radial layers (radius 95 / 200 / 360), centred on the finger, clipped to the lens circle, fading 0 → 0.32 over 300 ms from touch-down. Release or cancel: flat over 1000 ms on the same curve, glare out over 300 ms. Off while the sheet is open and under reduced motion; set flat with no animation when the screen loses focus |
| THE STUDY card | Exposed face ≈ 94–116 × 209 (the centre card takes 5.8–27.7 of its inner side; touches there go to the centre card) | `ensureSession()` (card busy), then `router.push('/tutorial')` (start_or_resume_session resumes or starts). The note comes from `getLatestSession(TUTORIAL_ROOM_ID)`: none or abandoned Unseal, active Continue, completed Replay. a11y labels: "The Study. Unseal the first case." / "…Continue the first case." / "…Replay the first case." A failure shows the notice |
| YOUR ROOM card | Full 122 × 209 (on top) | **Access check first** (card busy): `openCapture()` runs `ensureSession()` and `getMyAccess()`, then routes a guest to `/account?next=back`, a player without `custom_rooms` to `/pro`, a player at the monthly cap to `/capture/develop?from=hub`, and a player with access to `/capture/guide` the first time (seen flag unset), otherwise `/capture`. If the check can't run it rejects without navigating and the card carries on to `/capture` (its backstop still shows a first-timer the guide; `/capture/develop` checks access again before anything is sent). a11y "Your room. Photograph a room." |
| YOUR CASE card | Exposed face ≈ 94–116 × 209 | From `getLatestCustomRoom()` (drafts count as no room) and, for a ready room, `getLatestSession(room.id)`. Ready → `/play/<id>` (Open, Continue, or Replay with SOLVED). Queued or generating (DEVELOPING) and failed (See why) → `/capture/develop?roomId=<id>`. No room, offline or try later: disabled. a11y: one element, "Your case." plus the state (Case status); the label updates with the state |
| Sheet scrim | Everything above the sheet (y 0–609) | Closes the sheet. Not focusable |
| Sheet Close | 48 + `hitSlop` 4 = 56 × 56, x 333–389, y 626–682 | Closes the sheet; screen-reader focus returns to How you play once the sheet has left (States: Focus). a11y "Close" |
| Show interactives switch | The native switch (iOS 51 × 31; Android's Switch keeps its 48 minimum), exactly as Case options | Sets `hotspotAssist` through `usePreferences().setHotspotAssist` (AsyncStorage `escapd:pref:hotspot-assist`, shared with Case options). One a11y element: role switch, label "Show interactives", the native on/off value |
| How to photograph a room | 353 × 48 + the live `hitSlop` 4 = 361 × 56 | Closes the sheet (no focus return), then pushes `/capture/guide?replay=1` (section 04). Replay never clears the seen flag; the guide sets it when closed or finished |
| Android back | — | Sheet open → closes it (true). A card busy → consumed (true) until navigation or the notice. Otherwise not handled: the system leaves the app (root) |
| Not tappable | — | Wordmark, rule, title, subtitle, mounts, plates, plate labels, notes, line art, stamp, notice. Each card is one button; its children are not separately focusable. The glass takes drags only |
| Focus order | — | Screen reader: ESCAPD (image) → How you play → "Choose a case" (header) → subtitle → THE STUDY → YOUR ROOM → YOUR CASE → notice. The glass is skipped. Cards render in that order; the centre card is stacked with `zIndex`, not render order. Keyboard: How you play → THE STUDY → YOUR ROOM → YOUR CASE. Sheet open: title → Close → Show interactives → How to photograph a room; VoiceOver is trapped by the sheet (`accessibilityViewIsModal`), and the screen behind is `importantForAccessibility="no-hide-descendants"` for TalkBack. The live Sheet moves focus to its title 300 ms after opening (50 under reduced motion) |

### States

- **Appear:** No entry animation. The glass arrives flat and without glare. The screen arrives with the root Stack's fade.
- **Loading (focus fetch):** Renders at once with THE STUDY "Unseal" and YOUR ROOM "Photograph". YOUR CASE keeps its caption line blank (a non-breaking space, so the line holds at any text size), ignores taps and is not dimmed, so nothing flashes; no spinner. For screen readers: `accessibilityState={{ busy: true, disabled: true }}`, label "Your case. Loading." until the fetch resolves. The fetch runs on every focus and only with a stored session (`currentSession()`), never creating a guest to label a card: `getLatestSession(TUTORIAL_ROOM_ID)` and `getLatestCustomRoom()` in parallel, then `getLatestSession(room.id)` for a ready room. No session → None yet.
- **Developing (YOUR CASE queued or generating):** the note is `ThinkingStates tone="warm" variant="note" decorative`: one line, no rotation, the live `stamp` type (JetBrains Mono 11/14, +1.2), **DEVELOPING** 78.0 wide, centred in the 18 caption slot (card-local y 181–195). The shimmer runs from `ref.motion.thinking.shimmerWarm.base` `color.textSecondary` to `.highlight` `color.text` and back, band 0.8 × 78 = 62.4, the band centre sweeping −78 → +156 over 2000 ms linear and repeating while the room develops. Hidden from accessibility: the card's label says "Your case. Developing." and the shimmer is never announced. While it shows and the hub has focus, the room is followed with `watchRoom(id)` plus a 5 s poll (`POLL_MS`), stopping on blur. A flip to ready shows Open, to failed See why: the shimmer stops and the caption note appears at once (both rest in `color.textSecondary`, so there is nothing to ease). The flip is announced, "Your case is ready." or "Your case didn't develop. Open it to see why.", only when seen while the hub is open.
- **Pressed:** Card: mount fill `color.surface` → `color.raised` #1E1915 and hairline `color.hairline` → `color.accent` over 120 ms ease-out (the kit's control timing), back on release; selection haptic on press-in (only with haptics on). No scale, no opacity change. How you play and Close: the live IconButton's opacity 0.75. Guide button: the live Button's opacity 0.82. Switch: native.
- **Busy (after tapping THE STUDY or YOUR ROOM):** the tapped card keeps its label and note and adds a small native `ActivityIndicator` in `color.accent` on its plate: centred on its content axis, card-local y 127–147 (`space.sm` above the plate's foot, the band where SOLVED would sit). THE STUDY's is centred at ≈ (83.0, 527.6), 41.8 clear of the centre card; YOUR ROOM's at (196.5, 516.5). It rotates with its card. The card stays at full opacity, ignores taps, and sets `accessibilityState={{ busy: true, disabled: true }}`, keeping focus. The other two cards and How you play go to 0.4 (`ref.button.disabledOpacity`; the live IconButton's own 0.4) and are disabled until navigation or the notice. A dimmed centre card keeps an opaque `color.canvas` underlay, so the side cards don't show through it.
- **Disabled (YOUR CASE: no room, only a draft, no session, offline, try later):** mount, plate, line art and plate label at 0.4 as one layer (`needsOffscreenAlphaCompositing`); the note explains why, so it stays at full strength (6.2:1 over the dimmed mount at the silk peak). `accessibilityState.disabled`; with no room, hint "Photograph a room first."
- **Case status:**

  | Case status | Note | Stamp | Card a11y label |
  |---|---|---|---|
  | Ready, never played | Open | — | "Your case. Open the case." |
  | Ready, latest session abandoned ("Restart this case") | Open | — | "Your case. Open the case." |
  | Ready, in progress | Continue | — | "Your case. Continue the case." |
  | Ready, solved | Replay | SOLVED | "Your case. Solved. Replay the case." |
  | Queued or generating | DEVELOPING (warm Thinking state) | — | "Your case. Developing." |
  | Failed | See why (never blames the player) | — | "Your case. It didn't develop. See why." |
  | No room (or a draft) | None yet | — | "Your case. None yet." + hint "Photograph a room first." |
  | Fetch failed: network / other | Offline / Try later | — | "Your case. Offline." / "Your case. Try later." |

  Drafts: `getLatestCustomRoom()` returns a draft too; it maps to No room. Abandoned sessions map to Open on YOUR CASE and Unseal on THE STUDY.
- **Error (THE STUDY only):** the notice panel: "You're offline. Connect to begin." (Phosphor `WifiSlash`) or "Couldn't start the case. Try again in a moment." (Phosphor `Warning`), icon in `color.warning`, text `caption` primary; never error-coloured text (`color.error` is 2.3:1 on the dark ground). It fades in over 120 ms (opacity, so it stays under reduced motion), is announced (iOS `announceForAccessibility`; Android through the always-mounted slot's `accessibilityLiveRegion="polite"`, since Android speaks a live region when its content changes, not when it mounts), and stays until the next card tap or the next focus. A repeat failure mounts a new panel, so it fades and is announced again. The card returns to idle; the layout does not move. One screen-reader element labelled by its text (`accessible` on iOS, `screenReaderFocusable` on Android, so it is never a keyboard stop).
- **Fetch failure:** YOUR CASE shows Offline (network) or Try later (other errors), disabled at 0.4, and refetches on the next focus. THE STUDY and YOUR ROOM stay enabled with their defaults.
- **Focus:** the kit ring (`ref.focus`: 2 pt brass `color.accent` #C89D54 at a 2 pt offset, 8:1 on the canvas), shown while a control has keyboard or switch focus. Fan cards: one overlay above the fan with the focused card's box, centre and rotation, `radius.thumbRing` 18, drawn with RN outline props (`outlineWidth` 2, `outlineOffset` 2), `zIndex` above the centre card, `pointerEvents="none"`, hidden from accessibility; the cards are never restacked, and the fan container never clips. Stacked cards: the same outline on the card. How you play: the live IconButton draws its own pill ring, a 56 circle (48 + 2 offset + 2 width); the hub composes none. The guide button (the live Button) draws its own control ring, radius `radius.control` + 4 = 12, concentric with its corners. The live Sheet's Close is a live IconButton and draws the same pill ring. VoiceOver and TalkBack draw their own cursors. **Focus return:** closing the sheet (Close, scrim, Android back) returns screen-reader focus to How you play once the sheet has left: the live Sheet has no exit callback, so the hub waits its 200 ms slide (`ref.layout.hub.sheetExit`; `motion.reducedFade` 140 under reduced motion) plus a 100 ms margin (`sheetFocusMargin`) for the modal layer's removal: 300 ms, or 240. Reopening the sheet, leaving for the guide, or leaving the hub cancels it.
- **Permission:** none here. Camera permission is section 03.
- **Large text / narrow screens:** the fan needs fontScale ≤ 1.0 and width ≥ 375 (`fan.maxFontScale`, `fan.minWidth`). Its visual width is 349.6, so the side margin is 12.7 at 375, 21.7 at 393. From the first larger text step (iOS 1.12, Android 1.15), or under 375 wide, the cards stack:
  - **Stacked cards:** three upright cards in reading order, width = screen − 2 × `space.gutter` 20 (353 at 393, 320 at 360), gap `space.lg` 16, in a scrolling column.
  - **Inside a stacked card:** the walnut mount (radius 18, brass hairline) with its plate at the right end: 88 wide (= 96 − 2 × 4), inset 4 top, right and bottom, full height, radius 14, the 48 line art centred in it. The card reserves 92 on the right for it. The text column takes the rest with padding 16, vertically centred: plate label (`stamp`, accent), `space.xxs` 2, the note (caption secondary, or the warm DEVELOPING line, start-aligned), with the busy indicator `space.sm` 8 after it, then the SOLVED stamp `space.sm` 8 below. Minimum height 96 (`stackedMinHeight`); height hugs the content. No tilt.
  - **The glass goes first:** when the cards stack, the glass is not rendered and nothing takes its place (a drag surface inside a scroll would fight it). The column runs 15 : 17 spacers around the hero block in the scroll content; the top spacer is frozen while the notice shows, so nothing above it moves.
  - **Short screens (fanned):** the glass is dropped before anything else changes. It needs a column of at least 649.4 (rule bottom to safe bottom), so the 7 : 7 : 50 spacers keep ≥ `space.xl` 24 above and below it: 128 + 302 + a free share ≥ 219.4. 852 has 702 (spacers 29.75); 375 × 812 (safe 44 / 34) has 677 (27.0), so it keeps the glass; 375 × 667 (safe 20 / 0) has 590 and drops it, returning to 15 : 17. Decided from the window, the text size and the safe areas (then the column's measured height); never animated.
  - **Title and subtitle** wrap; nothing shrinks. The wordmark stays at 14.
  - **Sheet:** rows wrap; the live Sheet stops at 64 % of the screen and scrolls.
- **Reduced motion** (`useTheme().reducedMotion`):
  - DEVELOPING is a still line in `shimmerWarm.still` `color.textSecondary`.
  - The live Sheet and its scrim cross-fade over `motion.reducedFade` 140 instead of rising; focus returns after 240.
  - The glass is a still image in the same place: no tilt, no glare, gesture disabled; turned on mid-drag, it is set flat with no animation.
  - The 120 ms colour changes and the notice's opacity fade stay (nothing moves). The native busy indicator keeps the platform's behaviour.

### User notes

> "The play screen (/play) and light table are the visual identity — brass accent, Playfair case titles, film-plate framing, mono plate labels. Restyle the hub (/), the photo guide and the Pro screen to match THAT look (keep the silk background and pill buttons from Noir)."

Applied. The hub keeps its structure, routing, data, states and accessibility, and takes the play screen's materials: the silk under the live grain, Playfair for the heading, the light table's caption, walnut mounts with brass hairlines around canvas plates, brass mono plate labels, a brass case stamp, the live Sheet and Switch from Case options, and /play's live secondary Button for the guide replay. The Noir light pools are gone.

**2026-10-25, round 2: every button in the play screen's 8 pt-rounded style, and a brass focus ring.** Applied. The guide replay in the How you play sheet is the live `Button variant="secondary"` (was the kit's brass-scheme pill), 48 tall, so the sheet is 4 shorter (y 609–852). How you play's focus ring is the live IconButton's own brass ring; the ring the hub used to lay around it is gone. The cards, which the hub draws itself, keep the kit's ring (outline props), now brass.

> "3 cards instead of 2."

Kept. Three cards (122 × 209, the reference's 0.584 aspect) in the reference's horizontal band: the centre one upright and on top, the side ones ±6° and 10 lower, overlapping it by 17. Left to right reads learn (THE STUDY) → photograph (YOUR ROOM) → play (YOUR CASE). None of the reference's content is used.

### Decisions

1. **Route:** the hub at `/` replaces the old title screen (user answer 4); "Photograph another room" is the YOUR ROOM card.
2. **Ground:** `color.canvas`, then the silk still, then the live grain. No light pools: they were Noir, and they rendered as solid rectangles on device. Their layout rules (`fanPools`, `stackPools`, the title, subtitle and glass marks) and tokens are removed.
3. **Header:** the wordmark in its defaults (`color.text`, brass doorway edge) between a 48 spacer and the live IconButton, with /play's top-bar spacing on the light table's gutters, and a brass hairline rule under it.
4. **Type:** Playfair `narrativeTitle` for "Choose a case" (a screen heading), `caption` / secondary for the subtitle, `stamp` / accent for plate labels and SOLVED, `caption` for the status notes, `control` and `sectionTitle` in the sheet. Nothing from `ref.type`.
5. **Status note copy:** the notes moved from Noir's uppercase mono to `caption`, so they are written in sentence case (Unseal, Continue, Replay, Photograph, Open, See why, None yet, Offline, Try later). DEVELOPING stays in capitals because the warm Thinking state's note line is the live `stamp`. Accessibility labels are unchanged.
6. **Card material:** film-plate framing at the small radii: a walnut mount (`radius.thumbRing` 18, brass hairline) around a canvas plate (`radius.thumb` 14, `color.rim`) 4 in, so the corners are concentric. The plate label and note sit under the plate, as on /play.
7. **Line art:** warm, three tones: hero `color.text`, secondary `color.textSecondary`, brass details `color.accent` (keyhole, viewfinder brackets, seal).
8. **SOLVED:** a brass bordered stamp on the plate's lower right corner. There is no oxblood on this screen and no signal button.
9. **Side-card axis:** under the plate, the labels fall where the centre card covers 22.6–27.7 of a side card's inner edge. Each side card's content (art, labels, indicator) centres on the face left exposed: its content column is inset `fan.cover` 28 on the covered side and 4 on the other (axes 49 and 73, against 61 on the centre card). Labels then clear by ≥ 13.5 and DEVELOPING by 7.7; centred on the card they would clear by 1.5 and −4.3.
10. **Busy:** the live short-wait pattern, a small `ActivityIndicator` in `color.accent`, on the plate's lower band.
11. **Notice:** a case-closed panel with a `color.warning` icon and primary caption text, in an always-mounted polite live-region slot.
12. **How you play:** the live `Sheet` (`titleStyle="utility"`), as Case options, with a React Native `Switch` (brass track, `color.text` thumb) and the live `Button variant="secondary"` (/play's 8 pt-rounded button). The Noir panel sheet, segment and rule are gone, with their tokens (`segment`, `sheetMaxHeight`).
13. **Help button:** the live IconButton (48, plain, `Question` 22 in `color.text`), which draws its own brass focus ring; nothing is composed around it.
14. **Hero object and tilt:** unchanged: the painted brass glass at 128, centred between the rule and the title by the 7 : 7 : 50 spacers, tilting ±16° toward a press-and-drag with a lens-clipped glare; decorative; a still image under reduced motion. It has no pool behind it now.
15. **Spacer weights without the glass:** 15 : 17 (were 23 : 25), which on 852 leaves the title and fan exactly where the glass layout puts them.
16. **Pro check and guide replay:** unchanged: YOUR ROOM runs `openCapture()`; the replay lives in the sheet and never clears the seen flag.

### Needs you

1. **Switch touch area (iOS):** the native `Switch` is 51 × 31 on iOS, under the 44 rule. It matches /play's Case options exactly, so changing it here alone would split the two sheets. If you want ≥ 44 on both, the row could become the touch target (a `minHeight` 48 row that toggles on tap, the switch staying the one a11y element): a change to Case options too.
2. **DEVELOPING type:** as asked, it is `ThinkingStates tone="warm" variant="note"`, which is the live `stamp` (mono, capitals), while the other notes are `caption`. If you would rather the note slot keep one type, `variant="meta"` gives the same shimmer in `caption` ("Developing"): a one-line change.
3. **Live Sheet without an exit callback:** focus return uses the 300 ms timer above. An `onExited` prop on `Sheet` would make it exact; it is outside the hub. (The other half of this note is done: the live `IconButton` now draws the brass focus ring itself.)

## 02 · Camera

Reference: docs/refs/02-camera.png (layout only). The look is the play screen's: SceneView's Kodachrome mount, registration marks, loupe ring and plate label (src/render/SceneView.tsx), the light table's IconButton top bar and tiles (app/capture/review.tsx), the case-closed notice panels (app/tutorial/complete.tsx), the hub's small walnut mounts (src/screens/hub/GameCard.tsx), and the pre-Noir brass rangefinder (brass shutter ring with a manila core, brass corner brackets, a mono plate stamp). 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`, `motion`), plus `ref.button.disabledOpacity` (0.4, through the screen's Dimmable), `ref.motion.control` (120 ms ease-out) and `ref.motion.shutterPress` (0.96, 120 ms), `ref.motion.thinking` with `shimmerWarm` (through `ThinkingStates tone="warm"`), the kit's focus ring (`ref.focus`: 2 pt `color.accent` at a 2 pt offset), and the screen's own `ref.layout.camera`: `buttons` { edge 19, top 6 }, `hairline` 1, `frameAspect` 0.75, `feedRatio` "4:3", `mount` { pad 6, labelGap 6 }, `gridDivisions` 3, `bracketArm` 22, `bracketStroke` 1.5, `bracketTravel` 6, `bracketFade` 200, `bracketEasing` [0.2, 0, 0, 1], `plateBox` 72, `ringWidth` 2, `shutter` { size 76, ringWidth 3, core 60, icon 28 }, `lensOptionWidth` 50, `lensTrack` 36, `counterMaxFontScale` / `lensMaxFontScale` / `labelMaxFontScale` 1.25, `noticeIcon` 16, `thinkingDelay` 1000. No Geist, no NoirText, no `ref.type` / `ref.color` / `ref.panel` / `ref.button.{icon, bare, shutter, segment}`, no silk, no light pool, no oxblood.

This section covers `/capture` and `/capture?retake=<i>` once camera permission is granted. Everything before that, including the checking state, belongs to section 03. Players reach it from 01's YOUR ROOM after the Pro check, and through 04 on their first visit.

Route: `app/capture/index.tsx` (the shell over 02 and 03) renders `src/capture/ui/Rangefinder.tsx` once access is granted; the props contract is `src/capture/ui/types.ts`. Files in `src/capture/ui/rangefinder/`: `Header.tsx` (back, prompt, library, error line, thinking line), `Viewfinder.tsx` (mount, plate, feed, grid, rim, privacy note, plate label, and the fitting rule `viewfinderLayout`), `Brackets.tsx`, `ControlRow.tsx` (flash and grid switches, lens slot), `LensSegment.tsx`, `PlateCounter.tsx`, `Shutter.tsx`, `LastPlate.tsx`, `Dimmable.tsx` (eased disabled opacity, `SLOP`), `copy.ts` (every word, incl. `plateLabel`), `useLenses.ts`. Tests: `src/capture/ui/rangefinder/__tests__/rangefinder-test.tsx` (behaviour, hit areas, focus rings, the look, tokens only).

### Feel

A rangefinder on the darkroom bench. The ground is soot (`color.canvas`) under the live film grain and nothing else: no silk still, no pool, no vignette, so a photo is judged on a plain ground. The live feed sits on a film plate exactly as /play will later mount the room: a walnut mount with a brass hairline, a soot plate with a faint rim, and the brass mono label "ESCAPD 400 · PLATE I" stamped under it, so what the player frames already looks like the plate they will play. Four brass brackets settle onto the plate when the lens opens. Above it, a Playfair prompt between two live icon buttons, with a warm Jakarta detail. Below it, the flash and grid glyphs and a small brass lens selector; then the bottom row: an exposure counter in brass mono on a small walnut mount, the brass shutter (a 3 pt brass ring, the play loupe's, around a manila core carrying an ink magnifier), and the last plate on its own small walnut mount. Motion is limited to 120 ms colour and opacity changes, the 0.96 shutter press, the bracket settle when the lens opens, and the warm thinking line during a real wait. The voice is terse and procedural.

**Accent on this screen:** brass only (`color.accent` #C89D54): the brackets, the plate label, the counter's label and numeral, the shutter ring, the lens thumb, the thumbnail's continue ring and the focus rings; the mounts' and panels' hairlines are `color.hairline` (brass at 0.32). The shutter's manila core (`color.manila` #E8DFC8, 15.1:1 against the soot) is the brightest object and the one primary action. No oxblood anywhere; `color.error` is not used (error lines carry a `color.warning` glyph).

### Layout, top to bottom

393 × 852, default text size, plate I, camera ready, an ultra-wide lens reported.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Root `color.canvas` #090807. Its first child is the live `<Grain />` (assets/grain.png repeated at 0.04 opacity), under every control; the mounts and panels are opaque, so the grain never lies over the feed. No `BackgroundStill` (silk), light pool, vignette or gradient. The shell (`app/capture/index.tsx`) lays the same canvas and grain under 02 and 03, so the 200 ms fade-in from 03 changes no ground | — |
| Status bar | y 0–59 | System, light content | — |
| Header row | Box y 61–117: root paddingTop = safe top + `buttons.top` 6 − `SLOP` 4, then paddingVertical `SLOP` (`space.xs` 4, the live IconButton's hitSlop) around the 48 content y 65–113. padX `buttons.edge` 19 | — | Back · prompt · library |
| Back | x 19–67, y 65–113 (48, `hit.min`), centre (43, 89): 02's long-standing back centre, and the box 03's back sits on (`ref.layout.permission.back`, x 19–67, safe top + 6) | The live `IconButton` (src/components/IconButton.tsx), surface plain: transparent, round (`radius.round`). Phosphor `ArrowLeft` at `ICON_SIZE` 22, `ICON_WEIGHT` regular, `color.text` #F2ECE1 (17.0:1 on canvas). The live button draws its own brass focus ring | — |
| Title | x 75–318 (243 = 393 − 2 × 19 − 2 × 48 − 2 × `space.sm` 8), line box y 65–95, centred on x 196.5 | `Text variant="narrativeTitle"` (Playfair Display SemiBold 24/30), tone primary `color.text`. Hidden from accessibility on its own (the prompt element speaks) | The plate title from `src/capture/slots.ts`, widths at 24: "From the doorway" 201.9 · "Opposite corner" 179.1 · "The busiest wall" 177.3 · "A close view" 133.1 · "Another angle" 154.8 · "Last plate" 106.2. Roll full: "Six plates is a full roll" 234.5. All one line on 393 |
| Detail | Line box y 95–113, centred. Title 30 + detail 18 = 48, the buttons' height, so the block sits on their centre line (y 89) with no padding (`(hit.min − 30 − 18) / 2` = 0). A second line grows the header downward and the viewfinder shrinks to match | `Text variant="caption"` (Plus Jakarta Sans Medium 13/18), tone secondary `color.textSecondary` #A89C8A (7.4:1 on canvas) | "Wide. Include the floor and two walls." 230.1 · "Overlap the first plate." 138.6 · "The wall with the most objects." 189.3 · "A desk, shelf, or table." 136.0 · "Optional. Anything still unseen." 191.5 · "Optional. One more overlap." 177.0. Roll full: "Continue to the light table." 164.7. The error line or the thinking line replaces it (States) |
| Library | x 326–374, y 65–113, centre (350, 89) | The same live `IconButton`; Phosphor `Images` 22 regular, `color.text` | — |
| Viewfinder area | x 14–379, y 129–638 (365 × 509): flex 1 between the rows, marginX `space.plate` 14 (as SceneView's gutter), marginY `space.lg` 16 − `SLOP` from each row's box | — | — |
| Mount | x 14–379 (365), y 132.5–634.5 (502). `viewfinderLayout` fits the plate into the area less the mount's chrome (14 across, 34 down) with `containBox`, then centres the mount: on 852 that leaves 3.5 above and below, so the mount sits 19.5 from the header buttons and 19.5 from the control-row buttons | SceneView's Kodachrome mount: fill `color.surface` #14110E, 1 pt (`hairline`) `color.hairline` rgba(200, 157, 84, 0.32), `radius.mount` 30, `curve`, padding `mount.pad` 6. Opaque | — |
| Inner plate | x 21–372 (351), y 139.5–607.5 (468): exactly 3:4 (`frameAspect` 0.75), 7 in from the mount's outer edge (1 + 6), as SceneView's | `color.canvas`, `radius.image` 24, `curve`, overflow hidden. The canvas shows until frames arrive | `CameraView`: `facing="back"`, `mode="picture"`, `ratio` "4:3" (`feedRatio`), `flash`, `selectedLens` |
| Live feed | Fills the plate | Full colour. No filter, tint, scrim or overlay | The room |
| Framing grid (when on) | Thirds, edge to edge on the plate: verticals x 138 and 255, horizontals y 295.5 and 451.5 | 1 pt (`hairline`) `color.textSecondary` lines, opaque, `pointerEvents="none"`, hidden from accessibility: quieter than the brass brackets. Above the feed, below the rim, the brackets and the note. Shows and hides over `ref.motion.control` | Rule of thirds. Off by default |
| Plate rim | The plate's edge | 1 pt `color.rim` rgba(255, 255, 255, 0.10), `radius.image` 24, drawn over the feed and the grid (/play's plate, the light table's tiles) | — |
| Corner brackets | Inset `space.lg` 16 from the plate: corners (37, 155.5), (356, 155.5), (37, 591.5), (356, 591.5); arms 22 (`bracketArm`, ending at x 59 / 334 and y 177.5 / 569.5), stroke 1.5 (`bracketStroke`) | `color.accent` (8.0:1 on canvas), butt ends, mitred corners, `pointerEvents="none"`, hidden from accessibility. Hidden until `onCameraReady`, then they settle (States) | ESCAPD's bracket language, as /play's registration marks |
| Privacy note | Bottom-centred on the plate, bottom y 591.5 (16 up, level with the bottom bracket corners). Max width 259 (x 67–326 = 351 − 2 × (16 inset + 22 arm + `space.sm` 8)), clearing the bracket arms by 8. Two lines: y 539.5–591.5, 52 tall | A notice panel, as the case-closed panels: `color.surface`, 1 pt `color.hairline`, `radius.control` 8, `curve`, padding `space.md` 12 / `space.sm` 8 measured from its outer edge. Text `caption`, tone secondary (7.0:1 on walnut), centred; Android `textBreakStrategy="balanced"`, iOS `lineBreakStrategyIOS="standard"` | "Keep people, mail, and lit screens out of frame." (289.7 on one line, so two). Shown until plate I is taken, never in retake mode |
| Plate label | Inside the mount, `mount.labelGap` 6 under the plate: line box y 613.5–627.5 (one `stamp` line, 14 × fontScale capped at 1.25), centred on x 196.5; then 6 of walnut and the 1 pt hairline to the mount's foot | `Text variant="stamp"` (JetBrains Mono Medium 11/14, +1.2, capitals), `tone="accent"` (7.5:1 on walnut), iOS centring pad +1.2 (`trackingPad`), `numberOfLines` 1, `maxFontSizeMultiplier` `labelMaxFontScale` 1.25. A new label fades in over `ref.motion.control`. Hidden from accessibility: the counter carries it | SceneView's pattern: "ESCAPD 400  ·  PLATE I" (171.6, x 110.7–282.3) … "ESCAPD 400  ·  PLATE III" (187.2). Roll full: "ESCAPD 400  ·  ROLL FULL" (187.2). In retake mode it names the plate being retaken |
| Control row | Box y 650–706: 48 content y 654–702 (centre 678) plus `SLOP` 4 above and below; padX 19 | — | Flash · lens · grid |
| Flash | x 19–67, y 654–702, centre (43, 678), under Back | The live `IconButton` as a switch (role `switch`, `checked`). Glyph 22 drawn as a `GlyphStack`: `color.textSecondary` (7.4:1) when off, easing to `color.text` when on over `ref.motion.control`, so colour is never the only cue (the glyph swaps too) | Phosphor `LightningSlash` (off, the default) / `Lightning` (on) |
| Lens track | x 146.5–246.5, y 660–696 (100 × 36, 2 × `lensOptionWidth` 50 by `lensTrack` 36), centred in the 259 centre slot (x 67–326) | `color.surface`, 1 pt `color.hairline`, `radius.control` 8 (the live buttons' corner), `curve` | Shown only when the phone reports an ultra-wide lens, after `onCameraReady` |
| Lens thumb | 46 × 28, inset `space.xs` 4 from the track's outer edge: left x 150.5–196.5 or right x 196.5–242.5, y 664–692 | `color.accent`, radius `radius.control` − 4 = 4 (concentric with the track), `curve`. Crossfades between halves over `ref.motion.control`; never slides | Under the selected lens |
| Lens labels | Centred on their thumbs at x 173.5 / 219.5, y 678 | `stamp` (JetBrains Mono Medium 11/14, +1.2), iOS centring pad. On the thumb `color.onAccent` #171411 (7.3:1 on brass); off it `color.textSecondary` (7.0:1 on walnut). Widths 31.2 / 15.6 | "0.5×" · "1×". The "×" (U+00D7) always shows. Default 1× |
| Grid | x 326–374, y 654–702, centre (350, 678), under Library | As Flash | Phosphor `GridNine` |
| Bottom row | y 722–798 (76), every centre on y 760: marginTop `space.gutter` 20 − `SLOP` from the control row's box; padX 21 (`space.plate` 14 + `hairline` 1 + `mount.pad` 6: the plate's own edges) | — | Counter · shutter · last plate |
| Plate counter | x 21–93, y 724–796 (72, `plateBox`), the thumbnail's twin | Mount: `color.surface`, 1 pt `color.hairline`, `radius.thumbRing` 18, `curve`. Plate 4 in (`radius.thumbRing` − `radius.thumb`, so the corners are concentric): x 25–89, y 728–792 (64), `color.canvas`, 1 pt `color.rim`, `radius.thumb` 14. The text stack is centred on the whole 72 window (not the plate): 14 + `space.xxs` 2 + 34 = 50, label line y 735–749, numeral line y 751–785, 7 inside the plate. Label `stamp`, tone accent (8.0:1 on canvas), iOS centring pad; numeral `code` (JetBrains Mono SemiBold 28/34, tabular), tone accent. Both cap at `counterMaxFontScale` 1.25. Display only, no pressed state | "PLATE" (39.0) over the numeral of the plate about to be taken: "I" (16.8) to "VI"; "III" 50.4. No neighbouring numerals, no roll |
| Shutter | Box x 158.5–234.5, y 722–798 (76, `shutter.size`), centre (196.5, 760) | Ring: 3 pt (`shutter.ringWidth`) `color.accent`, `radius.round`, drawn as the box's first child so the box itself has no border; the play loupe's ring. A 5 pt gap of ground inside it (opening Ø 70). Core: Ø 60 (`shutter.core`) at x 166.5–226.5, y 730–790, `color.manila` #E8DFC8. No gradient, bevel, shadow or glow | Phosphor `MagnifyingGlass`, regular, 28 (`shutter.icon`), `color.ink` #171411 (13.8:1 on manila), centred. The user's magnifier note |
| Last-plate thumbnail | x 300–372, y 724–796 (72), right edge on the plate's (372) | A small film plate: mount `color.surface`, 1 pt `color.hairline`, `radius.thumbRing` 18; plate 4 in (x 304–368, y 728–792, 64), `color.canvas`, `radius.thumb` 14, clipped, the photo `contentFit="cover"` in full colour; a 1 pt `color.rim` drawn over the photo. From 3 plates a 2 pt (`ringWidth`) `color.accent` ring closes over the mount's edge, inside the 72 box, so nothing moves. Before plate I: the empty canvas well | The newest plate on the roll |
| Bottom space | y 798–818 (`space.gutter` 20), then the 34 home-indicator inset | Soot and grain | System home indicator |

**Adds up, top to bottom:** 59 safe top + 6 + 48 header + 19.5 + 502 mount + 19.5 + 48 control row + 20 + 76 bottom row + 20 + 34 = 852. The mount: 1 + 6 + 468 plate + 6 + 14 label + 6 + 1 = 502. The area (509) holds the mount and its 7 spare (the inner fit is 475 for a 468 plate), split 3.5 / 3.5; the minimum gap at either end is `space.lg` 16.

**Adds up, across:**
- Header: 19 + 48 + 8 + 243 + 8 + 48 + 19 = 393.
- Control row: 19 + 48 + 79.5 + 100 + 79.5 + 48 + 19 = 393.
- Bottom row: 21 + 72 + 65.5 + 76 + 65.5 + 72 + 21 = 393 (equal gaps).
- Viewfinder: 14 + 1 + 6 + 351 + 6 + 1 + 14 = 393.

**Columns:**
- Left, x 43: Back and Flash (glyph centres).
- Centre, x 196.5: the prompt, the plate label, the lens segment and the shutter.
- Right, x 350: Library and Grid.
- The counter and the thumbnail align with the plate's edges, x 21 and 372 (centres 57 and 336).

**Hit boxes inside their parents.** Native hit-testing (iOS Fabric and Android) drops touches outside a parent that nothing overflows, so each row carries the IconButtons' slop inside its own box (paddingVertical 4, padX 19 ≥ 4) and the gaps around it shrink by as much: every visible position above is unaffected.

### Tappable elements

- Hit areas are at least 44: the live IconButtons are 48 with `hitSlop` 4 (56 × 56); the lens halves are 50 × 48; the shutter 76; the thumbnail 72.
- Pressed: the live IconButtons go to opacity 0.75 (their own); every custom control is a colour change over `ref.motion.control` 120 ms ease-out; the only scale is the shutter's.
- Disabled is 0.4: the live IconButtons dim themselves at once (their own 0.4); the shutter, the lens segment and the thumbnail ease into and out of `ref.button.disabledOpacity` 0.4 over `ref.motion.control` (Dimmable).

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| Back | 48 + `hitSlop` 4 → 56 × 56: x 15–71, y 61–117, inside the header row | "Close the camera": `onClose` (the shell's `router.back()`, or `router.replace("/")` to the 01 hub when there is no history). The roll stays in memory (`roll.ts`), so there is no confirm. In retake mode it is "Cancel retake": back to `/capture/review` with the plate unchanged. While a retake capture is busy, back is ignored until it settles (a late result never triggers a second `router.back()`). |
| Android hardware back | System | Same as Back in every state, including the busy rule in retake mode (`useFocusEffect` + `BackHandler`, returns true). |
| Library | 56 × 56: x 322–378, y 61–117 | "Choose photos from your library" (retake: "Choose a photo instead"). `useLibraryImport`: multi-select up to `MAX_PLATES` − taken (1 in retake); each photo through `processPhoto` → `addPlate` in its own try/catch, failures counted for the error line. Retake: `processPhoto` → `replacePlate` → `router.back()`. Disabled while busy and when the roll is full. |
| Viewfinder | Not tappable | expo-camera has no tap-to-focus point and no pinch zoom here; the platform's continuous autofocus does the work. Hidden from screen readers (the prompt says what to frame). |
| Privacy note | Not tappable | Plain text, read in focus order. |
| Flash | 56 × 56: x 15–71, y 650–706 | Toggles `flash` "off" / "on" for the camera session. Role `switch`, label "Flash", `checked`. |
| Lens "0.5×" | 50 × 48 half, x 146.5–196.5, y 654–702, no slop | iOS: `selectedLens` = the ultra-wide entry from `getAvailableLensesAsync()`. Role `radio`, label "Ultra-wide lens", `selected`; `accessibilityShowsLargeContentViewer`. |
| Lens "1×" | x 196.5–246.5, y 654–702 | Default main lens (`selectedLens` unset). Role `radio`, label "Main lens". The two halves form a `radiogroup` "Lens". |
| Grid | 56 × 56: x 322–378, y 650–706 | Shows or hides the framing grid for the camera session. Role `switch`, label "Framing grid", `checked`. |
| Shutter | The 76 box | `takePictureAsync({ quality: 0.92, exif: false })` → `feedback.tap()` → `processPhoto` → `addPlate`; the counter, thumbnail, plate label and prompt then advance. Retake: `replacePlate(i)` → `router.back()`. a11y: "Take plate III, The busiest wall" (retake "Retake plate II, Opposite corner"; full roll "Take a plate"). The primary action. |
| Last-plate thumbnail | 72 × 72 | Pushes `/capture/review` (the light table). a11y "Open the light table, 2 plates", from 3 plates "Continue to the light table, 3 plates". Disabled before plate I and while busy. Retake: "Cancel retake", calls `onClose`. |
| Plate counter | Not tappable | a11y by state: "Next: plate III. 2 of 6 plates taken." · "Roll full. 6 of 6 plates taken." · "Retaking plate II." |
| Plate label, brackets, grid, rim, grain | Not tappable | Hidden from accessibility. |

**Focus order (VoiceOver / TalkBack):** Back → header (title and detail as one element, role `header`, polite live region) → Library → privacy note (while shown) → Flash → Ultra-wide lens → Main lens → Framing grid → plate counter → Shutter → Last plate. Accessibility focus moves to the header once the rangefinder has faded in (`motion.sceneCrossfade` 200 ms). On iOS, which has no live regions, a new prompt, error or status is announced once with `announceForAccessibility`.

**Keyboard and switch focus** reaches controls only: Back → Library → Flash → 0.5× → 1× → Grid → Shutter → Last plate. The header and the counter are `accessible` on iOS and `screenReaderFocusable` on Android, so they are one TalkBack element each but never a keyboard stop; their texts are hidden from Android's accessibility tree.

### States

- **Before camera permission is granted** (loading, undetermined, denied): section 03. This layout mounts only after a grant.
- **Camera starting** (before `onCameraReady`):
  - The plate shows its `color.canvas` fill; the brackets are hidden.
  - The shutter is at 0.4 (eased). Flash and grid are at 0.4 (the live IconButton's own). Back and Library are live.
  - The centre slot is empty. The lens list (`getAvailableLensesAsync` / `onAvailableLensesChanged`) is read after `onCameraReady`; with an ultra-wide the segment fades in 0 → 1 over `ref.motion.control` 120 ms. A dimmed segment is never shown.
  - The privacy note and the plate label ("ESCAPD 400 · PLATE I") already show.
- **Ready:**
  - The four brass brackets settle together over `motion.bracketSettle` 380 ms on `bezier(0.2, 0, 0, 1)` (`bracketEasing`): each starts 6 (`bracketTravel`) further out along its diagonal (inset 10) and moves to inset 16, fading 0 → 1 over `bracketFade` 200 ms. No hold or dim afterwards.
  - The shutter returns to 1.0 over 120 ms; flash and grid return at once.
- **Camera didn't start** (`onMountError`): the detail slot becomes the error line: Phosphor `Warning`, regular, 16 (`noticeIcon`) in `color.warning` #D4883A (7.0:1 on canvas), centred on the first caption line, `space.sm` 8, then "The camera didn't start." in `caption` / `color.textSecondary`; the group centred (170.0 wide). Announced politely. The shutter, flash and grid stay at 0.4 and the lens never appears; Library and Back are the ways forward.
- **Pressed:**
  - Back, Library, Flash, Grid: the live IconButton's opacity 0.75 while held.
  - Inactive lens half: label `color.textSecondary` → `color.text` over 120 ms.
  - Shutter: the core eases `color.manila` → `color.accentPressed` #DFB66C (ink 9.7:1 on it) and scales to 0.96 (`ref.motion.shutterPress`, 120 ms ease-out). The ring stays still.
  - Thumbnail: the mount's fill `color.surface` → `color.raised` #1E1915 and its hairline `color.hairline` → `color.accent`, as the hub's cards; the continue ring `color.accent` → `color.accentPressed`. The photo never changes. All over 120 ms, reversing on release.
- **Disabled:** the whole control at 0.4, glyph and edges included; disabled controls keep screen-reader focus with the dimmed state. The empty thumbnail before plate I stays a full-opacity well.
- **Focus** (keyboard, D-pad, switch): the kit ring, 2 pt `color.accent` at a 2 pt offset, following each shape:
  - Back, Library, Flash, Grid: the live IconButton's own pill ring, a Ø 56 circle (e.g. Back x 15–71, y 61–117). No ring is composed around them.
  - Lens: one ring around the whole track while either half has focus, the kit's "control" shape (radius 8 + 4 = 12, concentric): x 142.5–250.5, y 656–700, inside the control row and clear of the flash and grid hit boxes (x 71 / 322).
  - Shutter: a Ø 84 circle (x 154.5–238.5, y 718–802), measured from the unbordered 76 box.
  - Thumbnail: an 80 × 80 rounded square at radius 22 (`radius.thumbRing` + 4, concentric), x 296–376, y 720–800.
- **Busy** (capturing and re-encoding, or processing library picks):
  - Taps on the shutter are ignored; it stays a static full-opacity manila core with its magnifier and `accessibilityState.busy`. No spinner.
  - Library and Flash at 0.4 (at once); the lens segment and the thumbnail at 0.4 (eased), the thumbnail keeping its image and ring. Back and Grid stay live; back is ignored during a retake capture.
  - The prompt, counter, plate label and shutter label hold the plate the wait started on and change once, as it ends.
  - Under ~1 s nothing more shows. Past `thinkingDelay` 1000 ms the detail slot holds `ThinkingStates tone="warm"` (decorative): one centred line in `caption` 13/18; the shimmer sweeps from `ref.motion.thinking.shimmerWarm.base` `color.textSecondary` to `.highlight` `color.text`, band 0.8 × the line, 2000 ms linear, repeating. Capture, a single pick or any retake: "Preparing plate III" (108.0). Two or more picks: "Preparing photo 2 of 4", swapping on each real count change (swap 150 ms ease-in-out, gap 50, distance 8) in a box sized to "Preparing photo 4 of 4" (138.5), so it never resizes. The prompt's label carries a fixed status ("Preparing plate III" / "Preparing 4 photos"), not re-announced on each count. The line stops the moment processing ends.
- **Captured:** haptic tap (`feedback.tap()`); the thumbnail swaps with a 120 ms cross-dissolve; the counter's label and numeral and the plate label fade in over 120 ms (never roll); the title and detail swap with no animation and are announced; after plate I the privacy note fades out over 120 ms.
- **Error** (capture or library): the detail slot becomes the error line until the next attempt, as under Camera didn't start: warning glyph 16, gap 8, `caption` in `color.textSecondary`, centred, announced politely. "That plate didn't take. Try again." (220.0 with the glyph). Library: "One photo couldn't be used." (201.8) or "2 photos couldn't be used." up to 6 (189.3), all within 243; the photos that worked join the roll. The error red is never used: on this ground it is 3.0:1.
- **3 plates or more** (`MIN_PLATES`, outside retake mode): the 2 pt brass ring fades in over the thumbnail's mount edge over 120 ms; its label becomes "Continue to the light table, n plates".
- **Roll full (6):** shutter and Library at 0.4. Title "Six plates is a full roll", detail "Continue to the light table.". Counter "FULL" (31.2) over "VI"; plate label "ESCAPD 400 · ROLL FULL". The thumbnail keeps its ring; Flash, lens and Grid stay live (the preview runs).
- **Retake mode** (`?retake=<i>`): the counter reads "RETAKE" (46.8) over that plate's numeral; the prompt shows that plate's title and detail (no "Retake." prefix); the plate label names it ("ESCAPD 400 · PLATE II"); the thumbnail shows the plate being replaced, without a ring; Library picks 1; no privacy note.
- **No ultra-wide lens** (Android today, older iPhones): the segment is hidden; Flash and Grid keep their columns and the row stays 48.
- **No flash unit:** not detected today; see Needs you.
- **Large text:**
  - Title and detail grow uncapped and wrap; the header grows downward and `containBox` shrinks the plate. Text never shrinks. At 1.25, "From the doorway" (252.4) takes two lines.
  - Counter: label and numeral cap at 1.25 and measure against the whole 72 window, so "III" (63.0 at 35 pt) never breaks; the stack is 17.5 + 2 + 42.5 = 62, inside the 64 plate. The `accessibilityLabel` carries the full sentence.
  - Lens labels cap at 1.25: "0.5×" ≈ 37.8 in its 46 thumb. The iOS large-content viewer shows them on long press.
  - Plate label caps at 1.25 (≤ 234 wide, one line); `viewfinderLayout` reserves 6 + 14 × min(fontScale, 1.25) under the plate, so large text shrinks the plate rather than wrapping the label.
  - The privacy note may take 3–4 lines, still bottom-anchored on the plate. Glyph sizes are fixed.
- **Narrow and short screens** (the plate absorbs the difference):
  - 375 × 812 (safe 44 / 34): the prompt is 225 wide, so plate I's detail wraps (230.1) and the header is 66 tall: plate 324 × 432. From plate II: plate 333 × 444.
  - 375 × 667 (safe 20 / 0): buttons y 26–74, bottom row y 571–647 (20 above the screen edge). Plate I: plate 258.75 × 345, centred (x ≈ 58–317); the privacy note's max width is 166.75, so three lines.
  - 360 wide (Android): prompt 210; bottom-row gaps 49.
- **Reduced motion** (`useTheme().reducedMotion`):
  - The bracket settle becomes a `motion.reducedFade` 140 ms opacity fade with no travel.
  - The shutter press is the colour change only, no scale.
  - The 120 ms colour and opacity changes stay (nothing moves).
  - The thinking line is still, in `shimmerWarm.still` `color.textSecondary`; count changes cross-fade over 140 ms.
  - Nothing else on this screen moves.

### User notes

> "Restyle the camera (02) and camera-permission (03) screens to the same brass / play-screen look as the hub, guide and Pro."

Applied. The rangefinder keeps every control, behaviour, state, copy line, accessibility label, focus order and Android back rule, and takes the play screen's materials: soot and live grain (no silk, so photos are judged on a plain ground), the feed on SceneView's walnut mount and plate with a brass plate label, brass brackets, a Playfair prompt between live IconButtons, a brass lens selector, small walnut mounts for the counter and the last plate, and the pre-Noir brass shutter. The pre-Noir manila prompt slip is not brought back: the prompt stays in the header, as asked.

> "the photo button has a magnifier glass icon on it."

Kept: Phosphor `MagnifyingGlass` (regular, 28, `color.ink`) on the manila core, inside a 3 pt brass ring that is /play's loupe ring, so the shutter reads as the loupe the case is examined with. The painted magnifier PNG is the hub's hero object and is not used here.

**Reference layout kept:** dark ground, a large framed viewfinder, the title and detail at the top, a three-slot control row, a round shutter, a counter at bottom-left and the last shot at bottom-right. The flip slot is the framing grid; the counter is a static Roman plate window. None of the reference's text, names or glyphs are used.

**Changes from the Noir build:**
- Ground: flat `ref.color.ground` #050505 → `color.canvas` with the live grain (still no silk or pool).
- Viewfinder: a radius-6 graphite frame (365 × 486.7) → a walnut mount (30) around a soot plate (24, rim) of 351 × 468, with a brass plate label.
- Brackets: bright → brass.
- Header: Noir 44 icon buttons on graphite → live 48 plain IconButtons (same centres); Geist headline / meta → Playfair `narrativeTitle` / Jakarta `caption`.
- Flash and grid: bare 44 glyphs, meta / bright → live IconButtons, `color.textSecondary` / `color.text`.
- Lens: a graphite pill with a grey thumb → a walnut 8 pt track with a brass thumb and mono stamp labels.
- Counter: a graphite panel in Geist Mono → a small walnut mount and plate in brass JetBrains Mono.
- Shutter: a 2 pt white ring and white disk → a 3 pt brass ring and a manila core, magnifier in ink.
- Thumbnail: a radius-6 window with an oxblood ring → a small walnut mount (18 / 14) with a brass ring.
- Privacy note: a graphite panel → a walnut notice panel in `caption`.
- Error line: error-red glyph and read text → `color.warning` glyph and `color.textSecondary` text.
- Thinking line: Noir tone → `tone="warm"`.
- Focus rings: bright → brass (central, `ref.focus.color`).

### Decisions

1. **Ground:** `color.canvas` with the live grain as the root's first child; no silk (the camera stays flat so photos are judged on a plain ground), no pool.
2. **Viewfinder as a film plate:** SceneView's mount exactly (walnut, 1 pt brass hairline, 6 of walnut, `radius.mount` 30 around `radius.image` 24, the plate's 1 pt rim), so the player frames what /play will show. `viewfinderLayout` fits the 3:4 plate into the space left less the mount's chrome and centres the mount.
3. **Plate label:** SceneView's "ESCAPD 400 · PLATE n" under the plate; "ROLL FULL" on a full roll; in retake mode it names the plate being retaken (the counter says RETAKE). Decorative, capped at 1.25 on one line.
4. **Header buttons:** live IconButtons centred on 02's columns (43, 89) and (350, 89), so 03's back (`ref.layout.permission.back`: x 19–67, safe top + 6) lands on this one. The live button draws its own brass ring; none is composed.
5. **Prompt type:** `narrativeTitle` 24/30, not `narrative` 18/26: one title line plus one caption line is exactly the buttons' 48, and every title fits 243 on one line at 393 (widest 234.5).
6. **Toggles:** the live IconButton with role `switch`; glyph `color.textSecondary` off, `color.text` on, eased over 120 ms; pressed and disabled are the live 0.75 / 0.4.
7. **Lens:** the brass thumb with an onAccent label (the live primary Button's and /play's switch track's brass), on a walnut track at the live buttons' 8 pt corner.
8. **Counter:** the thumbnail's twin (72 walnut mount, 64 soot plate) with a brass `stamp` label over a brass `code` numeral.
9. **Shutter:** the pre-Noir brass shutter: a 3 pt brass ring (the loupe's), a 5 gap and a 60 manila core with an ink magnifier; pressed manila → `color.accentPressed` and 0.96; busy stays static.
10. **Thumbnail:** a small film plate (18 / 14); the continue cue is a 2 pt brass ring over the mount's edge from 3 plates; pressed as the hub's cards.
11. **Grid lines:** `color.textSecondary`, quieter than the brass brackets.
12. **Privacy note:** a walnut notice panel, not a manila slip: manila is kept for the shutter core, and the plate stays the brightest thing in the frame.
13. **Errors:** a `color.warning` glyph beside `color.textSecondary` text.
14. **Rhythm:** on 852, 19.5 / 19.5 / 20 / 20 between header, mount, control row, bottom row and safe bottom (minimums `space.lg` and `space.gutter`). The counter and thumbnail align with the plate's edges (21 / 372).
15. **Disabled easing:** the custom controls ease into 0.4 over 120 ms (Dimmable); the live IconButtons dim at once, as on every live screen.
- **Cross-screen:** the thinking state runs on real waits only (the darkroom on /capture/develop, here the Busy wait); access is checked on 01 before `/capture` opens.

### Needs you

1. **Ultra-wide distortion:** confirm that the generation pipeline (`_shared/perception.ts`, `_shared/geometry.ts`) copes with 0.5× barrel distortion before the lens segment ships. If it doesn't, limit 0.5× to plate I or hide the segment (`useLenses` returns `ultraWide: null`); the centre slot simply stays empty.
2. **No flash unit:** the old spec's state (LightningSlash at 0.4, "Flash unavailable") was never built and isn't now: the screen has no flash-availability signal from expo-camera 58, so the toggle stays live on a phone without a flash. Drop the state, or detect it.
3. **Rounded preview on Android:** the plate clips the `CameraView` at `radius.image` 24 with `overflow: hidden`. Some Android preview surfaces ignore rounded clipping; check on device that the feed's corners follow the plate (the rim is drawn over them either way).
4. **Lens keyboard stops:** each lens half is its own keyboard stop (0.5× then 1×), with one ring around the track; the Noir text's "one stop, arrow keys move the selection" was never built. Keep as is, or make the radiogroup a single stop.

## 03 · Camera permission

Reference: docs/refs/03-camera-permission.png (layout only: a bottom sheet with a phone line drawing, a title, a short explanation and one button). The look is the play screen's: the live `Sheet` (src/components/Sheet.tsx, as `/play`'s Case options) for the sheet, the light table's tiles and /play's Kodachrome mount for the film plate, the photo guide's warm line art for the drawing, the light table's back control, and the live `Button`. 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`, `motion`), plus the kit's focus ring (`ref.focus`, brass, drawn by the live `Button` and `IconButton`), `ref.motion.thinking` with `shimmerWarm` (through `ThinkingStates tone="warm"`), and the screen's own `ref.layout.permission` (`back` { left 19, top 6 }, `hairline` 1, `plate` { height 128 }, `phone` { cornerDx −53.8, cornerDy 20, rotate 14, width 134, radius 6, screenInset 16, bracketInset 14, bracketArm 22, wallDrop 44, ceilingAngle 15, ceilingLength 30 }, `line` { stroke 1.6, fade 40, mid `color.textSecondary` @ 1, context `color.textSecondary` @ 0.3, bracket `color.accent` }, `noticeIcon` 18, `thinkingDelay` 1000, `titleFocusDelay` 300). No Geist, no NoirText, no `ref.type` / `ref.color` / `ref.button` / `ref.panel`, no light pool, no silk, no oxblood.

**Where it lives.** A route state of `/capture` (app/capture/index.tsx), including `/capture?retake=<i>`: not a new route and not a modal. The shell renders `CameraPermission` (src/capture/ui/CameraPermission.tsx) for every state before camera access is granted: Checking while `useCameraPermissions()` returns `null` and, outside retake mode, while 04's guide-seen backstop runs (`useGuideBackstop`: session flag, then AsyncStorage `escapd:onboarding:capture-guide`); the sheet whenever access is not granted. An unseen guide runs `router.replace('/capture/guide')` and no sheet ever renders. 02's rangefinder mounts only once access is granted. The shell lays one ground under both states: root `color.canvas` #090807, then the live `<Grain />` (assets/grain.png repeated at 0.04), then the state. No silk (`BackgroundStill`): the camera route stays flat, so 03 hands over to 02 with no change of ground. The grain sits under 02, never on its feed.

**Files.** `CameraPermission.tsx` (states, back control, buttons, notices, Android back), `permission/PermissionSheet.tsx` (sheet frame, text, the cap and large-text steps), `permission/IllustrationZone.tsx` (mount, plate, drawing), `permission/PermissionNotice.tsx`, `permission/PermissionThinking.tsx`, `permission/QuietAction.tsx` (the live quiet `Button` with Library busy), `permission/copy.ts` (every word), `permission/useGuideBackstop.ts`, `src/capture/useLibraryImport.ts`. Tests: `permission/__tests__/CameraPermission-test.tsx` (behaviour and look), `PermissionSheet-test.tsx` (frame, cap, bottom padding, large text), `captureRoute-test.tsx` (the shell and its ground).

**Hosting.** A custom bottom-anchored view in the live `Sheet`'s look, not the `Sheet` component: it is the route's own state, so it has no scrim, no X, no eyebrow and no brass handle (a handle says "drag me away", and this sheet can't be dismissed). It reuses `Sheet`'s frame (walnut, `<Grain />`, `radius.sheet` top corners, 1 pt brass top edge, inner brass rule), its enter motion (`motion.sheetSpring`: damping 28, stiffness 320, mass 1; a `motion.reducedFade` 140 ms fade under reduced motion) and its move-focus-to-title behaviour (after `titleFocusDelay` 300 ms, or 140 ms under reduced motion). Side padding `space.gutter` 20, as the live Sheet, giving a 353 column. Bottom padding: bottom inset + `space.xs` 4.

### Feel

A single decision, taken in the darkroom before the camera opens. The top of the screen is soot with grain and nothing on it but the back arrow. A walnut drawer rises from below, edged in brass like `/play`'s Case options. In it, a small film plate shows a warm line drawing of a phone held up to a room, its viewfinder brackets in brass, cropped by the plate's foot. Below the plate:
- a Playfair heading in bone
- a Jakarta paragraph in taupe saying the photos stay private
- one brass button
- a quiet way out in bone.

Nothing moves except the sheet's rise, the buttons' press feedback and, during a real wait, the warm thinking line. The status bar stays `light` throughout. Thinking states appear only during a real wait of more than ~1 s: Library busy, and Checking only when it runs past ~1 s (see States). A normal permission check and the OS dialog don't qualify.

**Accent on this screen:** brass only. The sheet's top edge and inner rule, the mount's hairline, the drawn brackets and the primary button are brass; the notice glyph is `color.warning`. No oxblood: asking for the camera decides nothing about the case.

### Layout, top to bottom

Default, default text size, empty roll.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Status bar | y 0–59 (safe-area top) | System, `light` content | — |
| Ground | Full screen, behind everything | The route shell's: `color.canvas` #090807, then the live `Grain` (0.04). Opaque and flat: no silk, no light pool, no camera feed. The same ground 02 opens on | — |
| Back control | Box x 19–67, y 65–113 (48 round, `hit.min`), centre (43, 89): `ref.layout.permission.back` (left 19, top = safe top + 6), the same centre as 02's back (`ref.layout.camera.buttons`). `hitSlop` `space.xs` 4 → 56 × 56, x 15–71, y 61–117, held inside a 56 wrapper so every touch lands in a parent | The live `IconButton`, surface plain: no fill, no border; pressed at opacity 0.75. Phosphor `ArrowLeft` at `ICON_SIZE` 22, `ICON_WEIGHT` regular, `color.text` #F2ECE1 (17.0:1 on canvas) | a11y "Close the camera"; "Cancel retake" in retake mode (02's labels) |
| Empty ground | y 117–371 (254) | Canvas and grain. Kept empty on purpose | — |
| Sheet | x 0–393, y 371–852 (481). Content-sized and bottom-anchored: it grows upward and its bottom stays fixed | The live Sheet's frame: fill `color.surface` #14110E, the live `Grain` inside, top corners `radius.sheet` 20 with `...curve`, 1 pt (`hairline`) `color.hairline` rgba(200, 157, 84, 0.32) along the top edge and round the corners, square bottom corners at the screen edge, `overflow: hidden`. Opaque, no shadow, no scrim, no handle | — |
| Inner rule | From y 375, x 4–389, down both sides to the screen foot | The live Sheet's: 1 pt `color.brassRule` rgba(200, 157, 84, 0.25), `space.xs` 4 inside the top and sides, top corners `radius.sheet − space.xs` 16, open at the bottom. Not touchable | — |
| Zone gap | y 372–396 (`space.xl` 24 below the top hairline) | Walnut | — |
| Mount | x 20–373 (353, the column), y 396–532 (136) | A small film-plate mount, as the light table's tiles: `color.surface`, 1 pt `color.hairline`, `radius.thumbRing` 18 with `...curve`, padding 3, so the plate sits 4 in (`radius.thumbRing − radius.thumb`) and the corners are concentric | — |
| Plate | x 24–369 (345), y 400–528 (`ref.layout.permission.plate.height` 128) | `color.canvas`, `radius.thumb` 14 with `...curve`, clipped: its foot is the crop. A 1 pt `color.rim` rgba(255, 255, 255, 0.10) edge drawn over the art | — |
| Illustration | Visible ink ≈ 158 × 108: x 116–274, y 420–528, centre x ≈ 194, cropped by the plate's foot | Warm line art in react-native-svg (`ref.layout.permission.line`), stroke 1.6, round caps and joins, all rotated 14° clockwise about the body's top-left corner, which sits 53.8 left of the plate's centre and 20 below its top: plate (118.7, 20), screen (142.7, 420); the top-right corner at (272.7, 452.4). **Body:** 134 wide unrotated, corners 6, running past the crop; fill `color.surface` (a walnut silhouette on the soot plate), outline `line.mid` = `color.textSecondary` #A89C8A (7.4:1 on canvas). **Inner screen:** inset 16 on the sides and top, corners 6, fill `color.canvas`, 1 pt edge in `line.context` = `color.textSecondary` at stroke opacity 0.3 (1.6:1). **Brackets:** the rangefinder's two upper corners, arms 22, inset 14 from the inner screen (unrotated corners (30, 30) and (104, 30); on screen (164.6, 456.4) and (236.3, 474.3)), `line.bracket` = `color.accent` #C89D54 (8.0:1). The lower pair falls below the crop. **Room corner** (context): a wall join on the screen's centre line from 44 below the inner top edge to the crop; two ceiling lines leave its top rising outward at 15°, each 30 long and fading to transparent along its length (`LinearGradient` stops `stopColor` `color.textSecondary`, `stopOpacity` 0.3 → 0). All context lines also fade out over the last `line.fade` 40 before the crop (an alpha `Mask` whose gradient runs `stopOpacity` 1 → 0; react-native-svg ignores a stop colour's alpha). No light pool, no shading, no island, no logo | A room in the viewfinder. Hidden from screen readers, no touches, never animated |
| Title | x 20–373, line box y 556–586 (one line, ≈ 306 wide), `space.xl` 24 below the mount | `Text variant="narrativeTitle"` (Playfair Display SemiBold 24/30), `tone="primary"` `color.text` (16.0:1 on walnut), left-aligned. `accessibilityRole="header"` | "Let ESCAPD use the camera". The space in "the camera" is a non-breaking space (U+00A0), so a narrow column or large text never strands "camera" |
| Body | x 20–373, line boxes y 594–686 (4 × 23), `space.sm` 8 below the title box | `Text variant="body"` (Plus Jakarta Sans Regular 16/23), `tone="secondary"` `color.textSecondary` (7.0:1 on walnut), left-aligned, ragged right; lines ≈ 305–318 wide | "You'll photograph three to six views of one room. Each photo is re-encoded on your phone first, so its location never leaves it. Nothing is sent until you develop the case." |
| Inline notice (only when set) | x 20–373, line box `space.sm` 8 below the body, 18 per line. The sheet grows upward 26 for the first line and 18 for each further line; the primary keeps its 24 gap below it | `Text variant="caption"` (Plus Jakarta Sans Medium 13/18), `tone="secondary"` `color.textSecondary`. **Progress:** the text alone. **Error:** Phosphor `Warning` at `noticeIcon` 18, `ICON_WEIGHT` regular, in `color.warning` #D4883A (6.6:1 on walnut; an icon, never coloured text) at x 20–38, centred on the first caption line, then `space.sm` 8 and the text at x 46–373. **Thinking** (Library busy): one centred line, see States | See States. `accessibilityLiveRegion="polite"` |
| Primary button | x 20–373 (353 × 48), y 710–758, `space.xl` 24 below the body | The live `Button variant="primary"`: fill `color.accent` #C89D54, `radius.control` 8 with no border or shadow, `minHeight` `hit.min` 48, padding `space.gutter` 20 / `space.md` 12. Label `type.control` (Plus Jakarta Sans SemiBold 15/20) in `color.onAccent` #171411 (7.3:1), centred | "Allow the camera" (Default); "Open Settings" (Denied) |
| Quiet button | ≈ 208.5 × 48 (label ≈ 168.5 + 2 × `space.gutter`), centred on x 196.5: x 92–301, y 766–814, `space.sm` 8 below the primary | The live `Button variant="quiet"`: transparent, `radius.control` 8, `minHeight` 48, label `type.control` in `color.text` (16.0:1), `alignSelf: center` | "Choose photos instead"; "Choose a photo instead" in retake mode; "Go to the light table" when the roll is full |
| Light-table button (3–5 plates, not retake mode, only) | ≈ 182 × 48 (label ≈ 142 + 40), centred, y 766–814, `space.sm` 8 below "Choose photos instead", which moves up to 710–758 (the primary to 654–702). The sheet grows upward 56: top 315, mount 340–476, title 500–530, body 538–630 (Denied: top 338). Still below the y 121 cap | The live `Button variant="quiet"`, as the row above | "Go to the light table" |
| Bottom | y 814–852 (38 = `space.xs` 4 + 34 safe area) | Sheet fill runs to the screen edge | System home indicator |

Check: 59 + 6 + 48 (back, 65–113) + 258 (to the sheet) + 1 + 24 + 136 (mount, 396–532) + 24 + 30 (title) + 8 + 92 (body) + 24 + 48 (primary) + 8 + 48 (quiet) + 4 + 34 = 852.

Rhythm: 20 side gutter and 353 column, the live Sheet's; 1 top edge; 4 to the inner rule; 24 to the mount; 136 mount (4 + 128 + 4); 24 to the title; 30 title; 8 to the body; 23 body pitch; 24 to the primary; 48 buttons; 8 between buttons; 38 to the bottom. Against Noir's 548 the sheet is 67 shorter (481): the title sets on one line (−38), the body on 4 lines of 23 (−28), the top edge, gap and mount take 161 against Noir's 150 zone (+11), the title-to-body and body-to-button gaps are 8 / 24 against 16 / 28 (−12), and the buttons are 48 + 48 against 52 + 44 (0).

### Tappable elements

Screen-reader order: back → title → body → notice (when set) → primary → quiet button → light-table button (3–5 plates). When the sheet enters, and after any switch to or from Denied, accessibility focus moves to the title (header). Keyboard and switch focus: back → primary → quiet button → light-table button (3–5 plates); the notice and thinking lines are never focus stops. The sheet, rule, mount, plate, drawing and text are not focusable.

| Element | Hit area ≥ 44 | Action in ESCAPD |
|---|---|---|
| Back | 48 round at (43, 89) + `hitSlop` 4 → 56 × 56 | `router.back()`, or `router.replace('/')` (the 01 hub) when there is no history. Retake mode: `router.back()` to `/capture/review`, plate unchanged. The roll stays in memory (`roll.ts`), so there is no confirm. Live in every state, including Checking, Requesting and Library busy. Never disabled. |
| Android hardware back | System | Same as the back control in every state, only while /capture is the focused route. While the OS permission dialog is open, the dialog handles back itself; Android treats that as a deny that can still ask again, so the screen stays on Default. |
| "Allow the camera" | 353 × 48 (+ the Button's `hitSlop` 4) | `requestPermission()` shows the OS alert with the app.json string. **Granted:** see Granted. **Denied, `canAskAgain` false:** switches in place to Denied. **Denied, can still ask (Android's first deny):** stays on Default. **Throws:** stays on Default with the error notice. |
| "Open Settings" (Denied) | 353 × 48 | `Linking.openSettings()`. On return the shell's `AppState` listener re-reads the permission on `active` (`getPermission()`): a grant goes to Granted; otherwise the sheet stays on Denied with no notice. |
| "Choose photos instead" | ≈ 208.5 × 48 | `useLibraryImport().pick()`: `ImagePicker.launchImageLibraryAsync`, multi-select up to 6 minus plates taken (1 in retake mode, labelled "Choose a photo instead"). Each photo goes through `processPhoto` → `addPlate`, one at a time. If the roll reaches ≥ 3, it pushes `/capture/review`. Retake mode: `replacePlate` → `router.back()` to `/capture/review`. Below 3 plates it stays here with the progress notice. |
| "Go to the light table" (3–5 plates, not retake) | ≈ 182 × 48 | Pushes `/capture/review`. |
| "Go to the light table" (roll full: in "Choose photos instead"'s slot) | ≈ 182 × 48 | Pushes `/capture/review`. |
| Sheet, rule, mount, plate, drawing, text | — | Not tappable. No swipe-to-dismiss and no handle: the sheet is this route's state, not a modal. |

### States

- **Checking:** lasts until `permission !== null` and, outside retake mode, the guide-seen check have both resolved. The route's `color.canvas` and grain plus the live back control only: no sheet, no camera, no spinner. Past ~1 s (`thinkingDelay` 1000) one non-rotating line, "Opening the rangefinder", appears centred on the screen (line box y 417–435, centre (196.5, 426)): `ThinkingStates tone="warm"` in `type.caption` (Plus Jakarta Sans Medium 13/18), the sweep `ref.motion.thinking.shimmerWarm` from `color.textSecondary` to `color.text` (band 0.8, 2000 ms linear). Its a11y label is the same text, announced once. Under reduced motion it is a still `color.textSecondary` line. It stops the moment Checking ends.
  - **Guide not seen:** `router.replace('/capture/guide')`. No sheet ever renders.
  - **Guide seen (or retake mode), not granted:** the sheet rises with `motion.sheetSpring`. This is the only path to the sheet.
  - **Granted:** straight to the rangefinder with no sheet; it fades in over `motion.sceneCrossfade` 200 ms (reduced motion: `motion.reducedFade` 140 ms) while this back control fades out over the same time into 02's at the same centre (43, 89).
- **Default** (undetermined, can ask): the Layout table as written.
- **Pressed** (the live components; no colour animation): primary fill `color.accent` → `color.accentPressed` #DFB66C (label 9.7:1) and opacity 0.82; quiet buttons opacity 0.82; back opacity 0.75. No scale.
- **Disabled:** the live Button's inactive state, opacity 0.45 on the whole control. It applies to the quiet button(s) during Requesting, to the primary while it loads, and to the primary and the quiet button(s) during Library busy. The back control is never disabled.
- **Focus:** the brass ring the live components draw themselves (`ref.focus`: 2 pt `color.accent` at a 2 pt offset, 8.0:1 on canvas): around the primary a 361 × 56 rounded rect (radius 12, concentric with `radius.control`); around each quiet button a (width + 8) × 56 rounded rect; around the back control a 56 circle. No ring is composed around them. It shows for as long as the control has keyboard, D-pad or switch focus.
- **Requesting** (after "Allow the camera"): the live `Button`'s `loading`: an `ActivityIndicator` in `color.onAccent` in place of the label, the button at 0.45, taps ignored, `accessibilityState` { disabled: true, busy: true }, its accessibility label still "Allow the camera"; a disabled Pressable stays focusable, so focus stays. The quiet button(s) are disabled at 0.45 and the back control stays live. The OS alert covers the screen until `requestPermission()` resolves.
- **Granted:** the rangefinder opens at the next untaken plate (retake mode: the retaken plate). The sheet slides out downward with `motion.sheetSpring` while the rangefinder (mounted only now) fades in over 200 ms on the same ground and the back control crossfades into 02's. Reduced motion: one 140 ms crossfade, the sheet fading out.
- **Denied, can't ask again:** new copy, crossfaded over `motion.reducedFade` 140 ms, and accessibility focus moves to the new title.
  - Title "The camera is off" (`narrativeTitle`, one line, ≈ 189 wide).
  - Body "ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken." (3 lines, y 617–686).
  - The primary reads "Open Settings"; the quiet button is unchanged; the drawing is unchanged (no red, no slash).
  - Geometry: sheet top 394 (23 lower than Default), mount 419–555, title 579–609; buttons unchanged.
- **Height changes** (Denied copy, notice in or out, a light-table button joining): the sheet top moves with `motion.sheetSpring` and its bottom stays fixed; the controls hold still on screen. Under reduced motion the top moves at once, with the 140 ms text crossfade.
- **Library busy:** after the picker closes, `useLibraryImport` runs `processPhoto` one photo at a time on up to 6 picks; that takes seconds after the OS UI has gone, so it is a Thinking state.
  - Controls: the quiet button(s) keep their labels, disabled at 0.45 with `accessibilityState` { disabled: true, busy: true } and no spinner (the line carries the progress); they stay focusable, so the button that started the import keeps focus. The primary is disabled at 0.45 with its label. The back control stays live. The quiet buttons are drawn from the roll count as the import started until it ends (or, after the push to the light table, until /capture is focused again), so no light-table button joins mid-import.
  - Line: in the notice slot (`space.sm` 8 below the body; the sheet grows 26), `ThinkingStates tone="warm"` in `type.caption`, centred on x 196.5, real progress: "Re-encoding photo 1 of 4", "Re-encoding photo 2 of 4", … (the last number is the count picked). Each count change swaps with `ref.motion.thinking` (swap 150 ms ease-in-out, gap 50, distance 8); the sweep is `shimmerWarm` (`color.textSecondary` → `color.text`, band 0.8, 2000 ms linear). A hidden sizer holds "Re-encoding photo N of N", so the box never resizes mid-swap.
  - Accessibility: the drawn line is hidden; its wrapper is the status, label "Re-encoding your photos", `accessibilityLiveRegion="polite"`, announced once as it appears (count changes are not announced): one screen-reader element (`accessible` on iOS, `screenReaderFocusable` on Android) and never a keyboard or switch stop.
  - Reduced motion: a still `color.textSecondary` line whose text swaps with a 140 ms crossfade.
  - End: the line stops the moment the loop ends and gives way to the partial or error notice, the push to `/capture/review`, or `router.back()` in retake mode. For a single photo (retake mode, or one pick) it shows only if the work is still running after 1 s.
- **Library partial** (< 3 plates): progress notice in `color.textSecondary`: "1 plate on the roll. A case needs at least three." / "2 plates on the roll. A case needs at least three."
- **Library error:** error notice, `Warning` 18 in `color.warning` plus the text in `color.textSecondary`: "One of those photos couldn't be used. Try another." (one line ≈ 314 wide beside the icon).
- **Request error** (`requestPermission()` throws): the same error notice, "The camera didn't answer. Try again." The screen stays on Default.
- **Roll ready** (3–5 plates, not retake mode): a second quiet button, "Go to the light table", 8 below "Choose photos instead"; the sheet is 56 taller (top y 315 in Default, 338 in Denied). It is last in the screen-reader and focus order.
- **Roll full** (6 plates): one quiet button, "Go to the light table", in place of "Choose photos instead".
- **Retake mode** (`?retake=<i>`): the back control's a11y label is "Cancel retake" and the quiet button reads "Choose a photo instead" (it picks 1). The guide is never checked. Copy and geometry are otherwise identical.
- **Large text:** all text honours system scaling and never shrinks. Button labels wrap and the buttons grow past 48. The sheet grows upward to a cap at y 121 (the back control's 48 box ends at 113, plus `space.sm` 8: safe top + `back.top` 6 + `hit.min` 48 + 8). Beyond that:
  1. The illustration zone (the 24 gap and the 136 mount, 160 in all) is removed (decorative); the title then sits `space.xl` 24 below the sheet's top hairline.
  2. If the content still doesn't fit, the title, body and notice scroll inside the sheet while the buttons stay pinned.
- **Narrow and short screens:**
  - 375 × 667 (safe 20 / 0): column 335, plate 327. The title stays one line and the body 4 lines. With a 0 bottom inset the bottom padding is `space.lg` 16. The sheet is 459 tall (top y 208), well below the 82 cap (back box 26–74, + 8), so the plate stays. The back control is at x 19–67, y 26–74.
  - 430-wide phones: column 390, plate 382; title and body keep their line counts.
- **Reduced motion:** opacity changes only. The sheet's enter and exit, the Denied swap and Granted each become a `motion.reducedFade` 140 ms fade; height changes jump. The thinking lines are still `color.textSecondary` lines whose text swaps with a 140 ms fade. The drawing is static in every mode, and nothing on this screen loops.

### User notes

- User note for this screen: restyle it to the play screen's brass look (2026-10-25), with the live `Button` and `IconButton` and their brass focus ring.
- The brief's reference description, verbatim: "white bottom sheet with phone line illustration, bold "camera permission" title, short explanation, black pill "continue" button". How the play look honours it:
  - The bottom sheet stays, as the live Sheet's walnut drawer with its brass edge and inner rule instead of white.
  - The phone line illustration stays, now warm line work on a small film plate, with brass rangefinder brackets and a room corner on its screen.
  - The bold title becomes a Playfair SemiBold screen heading (`narrativeTitle`) in bone.
  - The short explanation stays, in Jakarta, now 4 lines.
  - The black pill becomes the live brass `Button` (8 pt corners), reading "Allow the camera" in sentence case.
  - The reference offers one action and no way out. ESCAPD keeps its quiet "Choose photos instead" path and a back control, so a player who refuses the camera can still go forward or leave.

### Decisions

1. **Case:** sentence case everywhere.
2. **Title copy:** "Let ESCAPD use the camera" (non-breaking "the camera"), now `narrativeTitle` on one line. Denied: "The camera is off" / "ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken." No copy changed in the restyle.
3. **Light:** no light pool and no haze; the film plate is the drawing's only frame.
4. **Illustration colours:** brackets `color.accent`; phone outline `color.textSecondary`; screen edge and room corner `color.textSecondary` at 0.3; body walnut, screen soot. Fades are `stopColor` + `stopOpacity`.
5. **Body:** `type.body` (Jakarta 16/23) in `color.textSecondary`, 4 lines.
6. **Additions:** the back control and the quiet button are kept. The sheet is 481 tall, top y 371.
7. **No white flash:** Checking is the route's canvas and grain plus the back control, the ground 02 opens on.
8. **Settings return:** the shell's `AppState` `active` re-check is built.
9. **Surface, fonts, corners, buttons:** answered by the play look. Walnut sheet on soot, Playfair + Jakarta, `radius.sheet` 20, the live `Button` (48, `radius.control` 8) and `IconButton` (48 round).
10. **Modal or route state:** route state of `/capture`, not dismissable, no scrim, and so no brass handle.
11. **Requesting:** the live `Button`'s `loading` spinner (Noir showed none); Library busy keeps the quiet labels with no spinner, since the thinking line carries the progress.
12. **Back control position:** centred on 02's back (43, 89), now with the live 48 IconButton; 02 uses the same `edge` 19 / `top` 6, so the crossfade doesn't jump.

### Needs you

- **Focus ring on an inactive button.** The live `Button` draws its brass ring inside itself, so when a focused button goes inactive (Requesting's `loading`, or the quiet button that started a library import and keeps focus through Library busy) the ring dims with it to 0.45, about 2.4:1 on walnut, under the 3:1 a focus indicator needs. Fixing it means drawing the ring outside the dimmed layer in `src/components/Button.tsx` (shared, not this screen's file).

## 04 · First-time photo guide

Reference: docs/refs/04-photo-tutorial.png (step structure only: four beats, a drawing over a title, an instruction and one button). The look is the play screen's: the light table's top bar and heading (app/capture/review.tsx), SceneView's Kodachrome mount and plate label (src/render/SceneView.tsx) and /play's live buttons (src/components/Button.tsx, IconButton.tsx). 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`, `motion`), plus `ref.background` (the silk), the live `Button` (`radius.control` 8, `minHeight` `hit.min` 48) and `IconButton`, `ref.motion.thinking.shimmerWarm` (through `ThinkingStates tone="warm"`), the kit's brass focus ring (`ref.focus`, drawn by the live Button and IconButton themselves), and the screen's own `ref.layout.guide`. No Geist, no NoirText, no `ref.type` / `ref.color`, no light pool, no oxblood.

Route: `app/capture/guide.tsx` (`/capture/guide`; `?replay=1` when opened from 01's How you play sheet), rendering `src/screens/guide/PhotoGuide.tsx`. It is shown once, before the first camera session.

Files: `PhotoGuide.tsx` (layout, routing, back, swipe, announcements), `CloseButton.tsx` (the live IconButton, which draws its own brass focus ring), `GuideArt.tsx` (mount, plate, plate label, the large-text sizing `artBox`), `art/` (the four scenes as data: `scenes.ts`, `geometry.ts`, `draw.ts`, `StepArt.tsx`), `GuideText.tsx` (title and body), `StepButton.tsx`, `ReplayErrorLine.tsx`, `stepper.tsx` (the crossfade), `swipe.ts`, `useReplayCheck.ts`, `copy.ts` (every word), `layout.ts`. Tests: `src/screens/guide/__tests__/guide-test.tsx` (behaviour and look) and `art-test.tsx` (drawings and plate sizing).

### Feel

A four-plate briefing pulled from the darkroom file before the first shot. Each step is a warm line drawing set on a film plate, the same walnut Kodachrome mount the case is played on, with its brass plate number stamped underneath. Above it a brass mono stamp says where the player is; below it a Playfair heading and a short Jakarta instruction. One button, /play's own 8 pt-rounded kind, closes the page. The drawings are bone on soot, receding to taupe, with the viewfinder brackets in brass, as the camera's own brackets once were. Silk and grain lie under everything; nothing glows or moves except the 200 ms crossfade between steps.

**Accent on this screen:** brass only. The stamp, the plate label, the mount's hairline and the drawn viewfinder brackets are `color.accent` #C89D54; steps 1–3's "Next" is the live walnut secondary Button (brass hairline edge); step 4's "Open the camera" is the live brass primary, the screen's one "go". Never `variant="signal"`.

### Layout, top to bottom

Default, default text size. The title, body and button block is bottom-anchored, so it grows upward.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Root `color.canvas` #090807. Then `<BackgroundStill />` (`ref.background.asset`, the black silk, peak `ref.background.peak` #262626, contentFit cover). Then the live `<Grain />` (assets/grain.png repeated at 0.04). Then content. No light pool. | — |
| Status bar | y 0–59 (safe-area top) | System, light content | — |
| Top bar | y 59–107: one row-reverse row, padX `space.gutter` 20, gap `space.xs` 4, plus `space.xs` 4 of padding below (y 107–111) that holds Close's slop | The light table's top bar, mirrored so Close is on the right | — |
| Close | x 325–373, y 59–107 (48 round, `hit.min`), centre (349, 83). Hit 56 × 56 (`hitSlop` `space.xs` 4) | The live `IconButton` (src/components/IconButton.tsx), surface plain: no fill, no border. Phosphor `X` at `ICON_SIZE` 22, `ICON_WEIGHT` regular, `color.text` #F2ECE1 (12.9:1 at the silk peak) | — |
| Step stamp | Slot x 72–321 (249) between Close and a 48 spacer at x 20–68; text centred on x 196.5, ≈ 209 wide (27 × 7.8 − 1.2), x ≈ 92–301. Line box y 76–90, its first line centred on Close (top margin (48 − 14 × fontScale) / 2 = 17) | `Text variant="stamp"` (JetBrains Mono Medium 11/14, +1.2, capitals), `tone="accent"` `color.accent` (6.1:1 at the peak), centred. Plain text, no box. a11y label "Before you shoot. Step 1 of 4" | `BEFORE YOU SHOOT  ·  1 OF 4` |
| Void | y 111–178 (67, `ref.layout.guide.voids.above`) | Silk and grain | — |
| Mount | x 57.5–335.5 (278), y 178–564 (386), centred | SceneView's Kodachrome mount: `color.surface` #14110E, 1 pt (`ref.layout.guide.hairline`) `color.hairline` rgba(200, 157, 84, 0.32), `radius.mount` 30 with `...curve`, padding `ref.layout.guide.mount.pad` 6. Identical on all four steps; it never moves or animates. | — |
| Inner plate | x 64.5–328.5 (264), y 185–537 (352): 3:4, the shape of a room plate | `color.canvas` #090807, `radius.image` 24 with `...curve`, clipped. A 1 pt `color.rim` rgba(255, 255, 255, 0.10) edge drawn over the art, as the light table's tiles | — |
| Art box | x 76.5–316.5 (240), y 228–494 (266), centred in the plate (12 clear at the sides, 43 above and below). Visual centre (196.5, 361). Ink no wider than 170 (`ref.layout.guide.art.inkMax`) | Warm line art in react-native-svg (`ref.layout.guide.line`): stroke 1.6, round caps and joins, no shading. Depth comes only from brightness. **Hero:** `color.text` #F2ECE1 (17.0:1 on canvas). **Mid:** `color.textSecondary` #A89C8A (7.4:1). **Back:** `color.textSecondary` at stroke opacity 0.7 (4.1:1). **Context** (hands, view wedges, the phone screen's edge): `color.textSecondary` at 0.3 (1.6:1), fading linearly to transparent over its last 40 (`line.fade`): a gradient with `stopColor` the colour and `stopOpacity` 0.3 → 0 (react-native-svg ignores a stop colour's alpha). **Fills:** device bodies are opaque `color.surface` (walnut) with the inner screen in `color.canvas`, so they hide the lines behind them. **Hero phone** (steps 1, 3, 4): 70 × 137, corners 6 (`ref.layout.guide.phone.radius`); inner screen inset 13 / 24.5 / 27 (44 × 85.5), corners 6, 1 pt context edge; it redraws the framed subject, clipped to its corners. **Brackets** (steps 1, 3, 4): four L-shapes in `color.accent` (`line.bracket`), arms 9, stroke 1.6, inset 4 from the inner screen; static. | One scene per step (see Steps) |
| Plate label | Line box y 543–557 (14), 6 under the plate (`mount.labelGap`), centred on x 196.5. ≈ 163 wide ("STEP I", 21 × 7.8 − 1.2) to ≈ 178 ("STEP III"); the slot reserves the widest | SceneView's plate label: `stamp`, `tone="accent"`, centred (7.5:1 on walnut). Decorative: hidden with the art | `ESCAPD 400  ·  STEP I` … `STEP IV` |
| Mount foot | y 557–564: 6 walnut + 1 edge | — | — |
| Void | y 564–620 (56, `voids.below`). It absorbs text growth first | Silk and grain | — |
| Title | x 20–373 (353), line box 620–650 (one line) | `Text variant="narrativeTitle"` (Playfair Display SemiBold 24/30), `tone="primary"` `color.text`, left-aligned, `accessibilityRole="header"` | Step title (≤ 24 characters) |
| Gap | 650–654 (`space.xs` 4) | — | — |
| Body | x 20–373 (353), line boxes 654–677 and 677–700 | `Text variant="body"` (Plus Jakarta Sans Regular 16/23), `tone="secondary"` `color.textSecondary` (5.6:1 at the peak), left-aligned, at most 2 lines (≤ 70 characters) | Step instruction |
| Status gap | 700–766 (66, `ref.layout.guide.ctaGap`): top 24 (`statusTop`), status line box 724–742 (18), bottom 24 (`statusBottom`) | Empty except in replay's wait and error | — |
| Step button | x 20–373 (353), y 766–814 (48). Padding `space.md` 12 × `space.gutter` 20 around the label. With larger text the button grows upward; its bottom stays at 814 | The live `Button` (src/components/Button.tsx, /play's button): `radius.control` 8, `minHeight` `hit.min` 48, no shadow. Steps 1–3 `variant="secondary"`: fill `color.raised` #1E1915, 1 pt `color.hairline` edge, label `color.text` (14.8:1). Step 4 `variant="primary"`: fill `color.accent` #C89D54, no edge, label `color.onAccent` #171411 (7.3:1). Label `type.control` (Plus Jakarta Sans SemiBold 15/20), centred | "Next" on steps 1–3, "Open the camera" on step 4 |
| Bottom | 814–852 (38) = safe bottom 34 + `space.xs` 4, as Pro | Silk | — |

Check: 59 + 48 + 4 + 67 + 386 + 56 + 30 + 4 + 46 + 66 + 48 + 4 + 34 = 852. The live Button is 4 shorter than the pill it replaced, and the status gap takes those 4 (62 → 66, the status line now 24 clear above and below), so the mount, title and body keep their places.

**Gutters.** `space.gutter` 20 on both sides for the top bar, title, body, status line and button (the light table's and Pro's gutter). The mount and the stamp are centred on x 196.5.

**Mount arithmetic.** Width = plate + 2 × (1 edge + 6 walnut) = 264 + 14. Height = plate + 34: 2 × 7, the 6 label gap and the 14 label line (`mountChrome` in GuideArt.tsx).

### Steps

The copy paraphrases `src/capture/slots.ts` (plates I–IV) and the light-table checklist, and the camera's title and subtitle then echo it. Only step 1 borrows a composition from the reference: a hand holding a phone in front of its subject. Every object and scene is ESCAPD's own. The drawings are warm line art; the player's own photos never appear here.

| # | Stamp | Plate label | Title | Body | Scene (ESCAPD's own drawing) | Button |
|---|---|---|---|---|---|---|
| 1 | `BEFORE YOU SHOOT  ·  1 OF 4` | `ESCAPD 400  ·  STEP I` | Start at the doorway | One wide plate. Get the floor and two walls in. | A doorway frame (mid). Beyond it a room corner: the wall junction and the floor line along both walls (back). A hand (context, the wrist fading) holds the hero phone in front; its screen redraws the corner (back) between the brass brackets. | Walnut secondary "Next" |
| 2 | `BEFORE YOU SHOOT  ·  2 OF 4` | `ESCAPD 400  ·  STEP II` | Work around the room | The far corner, then the busiest wall. Let plates overlap. | A plan of the room outline (back) with three phone plan symbols, 20 × 40, corners 6, walnut-filled, no screen detail: at the doorway (plate I, mid), the far corner (plate II, current: phone and wedge hero) and the busiest wall (plate III, mid). The mid phones' wedges are context, fading over 40. The doorway and far-corner wedges overlap. No brackets. | Walnut secondary "Next" |
| 3 | `BEFORE YOU SHOOT  ·  3 OF 4` | `ESCAPD 400  ·  STEP III` | Get one close view | A desk, shelf, or table. Small things make good clues. | Top-down onto a desktop corner (mid; its two edges fade over the last 40). An open notebook and a key lie under the hero phone (back), the notebook's outer pages showing either side. The screen shows the key and the page (back) between the brass brackets, a stroke's width clear of them. No hand. | Walnut secondary "Next" |
| 4 | `BEFORE YOU SHOOT  ·  4 OF 4` | `ESCAPD 400  ·  STEP IV` | Keep the case private | No people, mail, or lit screens. Lights on, hold steady. | The hero phone frames a bookshelf and a lit lamp (mid; three ray ticks above the shade, line only); its screen redraws them (mid) between the brass brackets. An envelope and an open laptop with three lit screen lines sit below, outside the frame (back, no fade). | Brass primary "Open the camera" |

### Tappable elements

Screen-reader order: Close → stamp → title → body → button (the mount, drawing and plate label are hidden). Keyboard and switch focus: Close → button. When the screen opens (its route transition ends) and after every step change, accessibility focus goes to the title and the screen announces "Step n of 4" (queued).

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| Close (X) | 48 × 48 visual + `hitSlop` 4 each side = 56 × 56, held inside the top bar by its 4 bottom padding | **First run:** skips the guide. Sets the session flag (`captureGuideSeen = true`), starts the AsyncStorage write `escapd:onboarding:capture-guide` = "1" without awaiting it, then `router.replace({ pathname: '/capture', params })`, carrying the route's params. accessibilityLabel "Skip the guide". **Replay:** sets the same flags, then `router.back()` to the hub (`router.replace('/')` with no history). accessibilityLabel "Close the guide". |
| Next (steps 1–3) | 353 × 48 (taller with large text), the whole button, plus the live `hitSlop` 4 (361 × 56) | Moves to step n + 1. The drawing, plate label, stamp, title and body crossfade; the mount, Close and the button stay put. Taps during the 200 ms transition are ignored. |
| Open the camera (step 4) | 353 × 48 (taller with large text), plus `hitSlop` 4 | Sets the session and storage flags, then `router.replace('/capture')` with the carried params. The opener has already checked access; /capture shows 03 if the camera isn't allowed yet, otherwise 02 at plate I. **Replay:** in order, sets the session flag and starts the storage write, then calls `openCapture({ replace: true, skipGuide: true })` (01's YOUR ROOM check). With access it replaces to `/capture`; without, to `/account?next=back` (guest), `/pro?cap=<n>` (no `custom_rooms` entitlement) or `/capture/develop?from=hub` (monthly cap reached). Whichever route it takes, the guide leaves the stack and back returns to the hub. Pending and failure: Replay wait and Replay error. |
| Horizontal swipe | Full width, y 111–766 (between the top bar and the button) | `usePanGesture` with `activeOffsetX` ±16, `failOffsetY` ±16 (`ref.layout.guide.swipe`). Commits on release when \|dx\| ≥ 56 or \|vx\| ≥ 500 pt/s. Left = next (steps 1–3), right = previous (steps 2–4). The content doesn't track the finger; a committed swipe runs the same crossfade. A left swipe on step 4 and a right swipe on step 1 do nothing. The buttons remain the accessible path. |
| iOS swipe-back | System left edge | Enabled on step 1 only (`navigation.setOptions({ gestureEnabled: step === 0 })`). Leaves to the opener without setting the flag. |
| Android hardware back | — | Step 2 or later: the previous step, same crossfade. Step 1: `router.back()` to the opener (`router.replace('/')` with no history), without setting the flag. Ignored mid-transition and once the guide is leaving. |
| Stamp, mount, drawing, plate label, title, body | — | Not tappable. The band holding the mount is `accessible={false}` and hidden from screen readers; the stamp's accessibilityLabel is "Before you shoot. Step n of 4". |

**Entry rule.** Four places call one helper, `openCapture({ replace?, skipGuide?, signal? })` in `src/capture/openCapture.ts`: 01's YOUR ROOM (push), guide replay's step 4 (`{ replace: true, skipGuide: true }`), `/pro` after its test purchase (`{ replace: true }`) and /tutorial/complete (`{ replace: true }`, not wired yet). `replace` makes the navigation a `router.replace`; `skipGuide` skips step 2. Every caller sits directly on the hub, so back from wherever it lands returns to the hub.
1. **Access check:** `ensureSession()`, then `get_my_access`, in order:
   - **Guest** (`is_anonymous`): `/account?next=back`. The server requires an email account.
   - **No `custom_rooms` entitlement:** `/pro` (with `?cap=<generations_cap>` when known).
   - **Monthly cap reached** (entitled, `can_generate` false): `/capture/develop?from=hub`, develop's cap state.
   - **Check can't run** (offline or a server error): navigates nowhere and rejects. 01 then continues to `/capture`, where the backstop below still shows the guide to a first-timer; guide replay shows Replay error.
2. **Seen flag**, with access (skipped when `skipGuide`): the session flag, else `escapd:onboarding:capture-guide` = "1" sets it and goes to `/capture`; any other value or a failed read goes to `/capture/guide`.

/capture without `?retake` keeps the same flag check as a backstop for any other way in. Retake mode never shows the guide, and the guide never asks for camera permission.

### States

- **Default:** steps 1–4 as in the tables, the step 1–3 button the live walnut secondary.
- **Final step:** the button becomes the live brass primary, at once (the live Button has no cross-fade): fill `color.raised` #1E1915 → `color.accent` #C89D54, label `color.text` → `color.onAccent`, the secondary's 1 pt brass edge drops, and the label text swaps from "Next" to "Open the camera". The slot reserves the longer label's height (as either variant: the secondary's edge adds 2 once the label outgrows 48), so nothing above moves. Going back from step 4 reverses it.
- **Pressed:** the live Button's press: the whole button at opacity 0.82, and the primary's fill to `color.accentPressed` #DFB66C (onAccent 9.7:1). No scale. Close takes the live IconButton's pressed state: opacity 0.75.
- **Focus:** the kit's ring (`ref.focus`: 2 pt brass `color.accent` #C89D54, 2 pt offset, 8:1 on the canvas), drawn by the live controls themselves: Close's IconButton draws the pill ring (a 56 circle), the step button's live Button the control ring (radius `radius.control` + 4 = 12, concentric with its corners). The guide composes no ring. Never removed while focused.
- **Transition:** the drawing, plate label, stamp, title and body crossfade over `motion.sceneCrossfade` 200 ms, with no drift and no counter roll. The mount, its walnut and canvas, Close and the button stay still. Brackets appear with their drawing and don't settle or scale.
- **Reduced motion** (`useTheme().reducedMotion`): the crossfade becomes `motion.reducedFade` 140 ms opacity. The buttons' press feedback is an opacity change and stays. Nothing else animates.
- **Disabled:** none. Close and the button are always enabled; taps during a transition are ignored rather than shown as disabled.
- **Loading:** none in first-run mode (the opener owns `openCapture()`'s wait, and all art is bundled SVG, drawn on the first frame). Replay has one real wait (below).
- **Replay wait:** on tap, "Open the camera" goes into the live Button's `loading`: a small native `ActivityIndicator` (20 × 20) in `color.onAccent` takes the label's place, centred at (196.5, 790); the button keeps its brass fill and its height (at larger text, the label's height), drops to the live 0.45 opacity, ignores further taps and sets `accessibilityState={{ busy: true, disabled: true }}`. Its accessibility label stays "Open the camera". If the check runs past 1 s (`ref.layout.guide.thinkingDelay` 1000), one line appears in the status slot: `ThinkingStates tone="warm"`, "Checking the file", no rotation, live `type.caption` (Plus Jakarta Sans Medium 13/18), centred on x 196.5, line box y 724–742, shimmer `ref.motion.thinking.shimmerWarm` (base `color.textSecondary`, highlight `color.text`, band 0.8, 2000 ms linear), accessibilityLabel "Checking access", announced on mount. It unmounts the moment the check returns or navigates. Reduced motion: the still line in `color.textSecondary`.
- **Replay error:** same slot, y 724–742. Phosphor `Warning` 16 (`ref.layout.guide.errorIcon`) in `color.warning` #D4883A (5.3:1; the error red is 2.3:1 on dark, so it is never used here) at x 20, centred on the first caption line and hidden from screen readers; then 8 (`space.sm`); then "Couldn't reach the darkroom. Try again." in `type.caption`, `tone="secondary"` (≈ 265 wide, one line in the 329 left). The row is a polite live region (announced on iOS) but not an accessibility element, so focus stays Close → button. The button returns to idle (label back, full opacity) and stays live; a retry clears the line and re-enters Replay wait. Leaving step 4 (back or swipe) drops a running check.
- **Error:** storage errors are silent. A failed read shows the guide once per session; a failed write shows it again on the next launch. Neither can loop: Close and "Open the camera" set the session flag before leaving, and /capture checks it first. No network calls in first-run mode.
- **Permission denied:** not handled here; 03 handles the camera after the guide. The advice also applies to "Choose photos instead".
- **Large text:** text honours system scaling and never shrinks. Close (48) stays pinned; the stamp's first line stays centred on it and a wrap grows downward (two lines still fit the 48 row). The title, body and button grow upward from 814: the button first (its label's lines + 24, never under 48, + 2 for the secondary's edge; the label may wrap within padX 20), then the title and body rise. The band between the top bar and the title gives way in order: the 56 under the mount down to `space.xl` 24, then the 67 above it down to 24, then the plate shrinks evenly (the drawing scales with it, so strokes thin in proportion), keeping 24 clear above and below. The plate label stays at text size and wraps within the plate width; its measured height comes out of the plate. Below a 160 high plate (`ref.layout.guide.plate.minHeight`: scale 0.45, art box ≈ 109 × 121) the whole mount hides. If the block still doesn't fit, the title and body scroll while the button stays pinned (scrolling is enabled only on overflow, so at rest it is no focus stop).
- **Narrow screen:** gutters stay 20; the column is width − 40 (335 at 375, 320 at 360). The mount (278) stays centred. The stamp's slot is width − 144; it fits on one line down to 354 wide and wraps to two lines below that. A short screen (375 × 667, safe 20 / 0) gives the band 397: the voids go to 24 each and the plate shrinks to 315 tall (scale 0.89).
- **Replay:** identical layout. Only Close's behaviour and step 4's access check differ.

### User notes

> "taking photos step by step short tutorial for first onboarding."

How the note is honoured:
- **Step by step:** four steps, one idea each, with a brass "n OF 4" stamp above and a matching "STEP n" plate number under each drawing. Next and swipe move forward; swipe, Android back and step 1's iOS edge move back.
- **Short:** a three- or four-word title and an instruction of at most two lines per step. Nothing scrolls on a 393 × 852 device at the default text size, and the X skips the whole guide at any step.
- **First onboarding:** shown only before the first camera session, after the access check, gated by a per-device flag. Never in retake mode or after the flag is set; replay is opt-in from 01's How you play sheet.
- **Taking photos:** the content is the real plate plan (doorway, far corner, busiest wall, close view) plus the privacy rules, and each drawing sits on the same 3:4 plate and mount the photos will be played on.

### Decisions

1. **Close (X):** skips the guide, opens the camera and marks the guide seen. In replay it returns to the hub.
2. **Step count:** four steps, stamp `BEFORE YOU SHOOT  ·  n OF 4` in brass `type.stamp`, centred in the top bar where the light table's "LIGHT TABLE" sits.
3. **Seen flag:** per device in AsyncStorage `escapd:onboarding:capture-guide`, plus the in-memory session flag.
4. **Replay:** "How to photograph a room" in 01's How you play sheet opens `/capture/guide?replay=1`.
5. **Swipe:** horizontal swipe also moves between steps; the buttons stay.
6. **Buttons:** /play's live `Button` (radius 8, 48 minimum). Steps 1–3 "Next" are `variant="secondary"` (walnut, brass edge); step 4 "Open the camera" is `variant="primary"` (brass), the screen's one "go", and replay's wait is its `loading`. No oxblood anywhere. (2026-10-25, round 2: replaces the kit's brass-scheme pill.)
7. **Close control:** the live IconButton (48, transparent, X in `color.text`), as the light table and `/play`, on the right; a 48 spacer on the left keeps the stamp centred.
8. **Illustrations:** four warm line scenes (`ref.layout.guide.line`), each on a film-plate mount: walnut `radius.mount` 30 with a brass hairline around a 3:4 canvas plate at `radius.image` 24 with a rim, and a brass plate label. The light pool is gone. Hero in `color.text`, mid in `color.textSecondary`, back and context in `color.textSecondary` at 0.7 and 0.3, brackets brass.
9. **Plate label:** "ESCAPD 400  ·  STEP I" to "STEP IV", after SceneView's "ESCAPD 400  ·  PLATE I". "STEP", not "PLATE", because step 4 is a rule, not a plate, and plates I–IV already name the photos.
10. **Paywall timing:** access is checked before the guide, in `openCapture()`, so a player without access never sees it on first run (see Entry rule).
11. **Ground, type, gutter, bottom inset:** `color.canvas` + silk + grain; Playfair `narrativeTitle` for the title, Jakarta `body` for the instruction, JetBrains Mono `stamp` for labels; gutter `space.gutter` 20; bottom = safe 34 + `space.xs` 4, the same as Pro.
12. **Errors on dark:** the warning icon in `color.warning` with the message in `color.textSecondary`, never error-red text.
13. **Focus ring:** brass (`ref.focus.color` = `color.accent`), drawn by the live IconButton and Button themselves; CloseButton.tsx composes none (round 2).

### Needs you

1. **Back and context line tones.** The live palette has no warm grey dimmer than `color.textSecondary`, so back and context lines are `textSecondary` at stroke opacity 0.7 and 0.3. Where two translucent strokes meet (the room corner in step 1, the notebook spine in step 3, the overlapping wedges in step 2) the overlap reads slightly brighter. Accept it, or add an opaque live tone (for example a `textTertiary` #786F63, which is `textSecondary` at 0.7 over the canvas) and the drawings switch to it?
2. **Focus ring on the walnut "Next".** The live Button draws its ring as a child, and Yoga places a child inside its parent's border, so on the bordered secondary the ring sits 1 pt closer than on the primary (1 clear of the edge, not 2; radius 12 on an 8 + 3 offset). Drawing the secondary's edge as a child layer in `Button` would make it exact: a kit change, not a guide one.
3. **Replay wait's spinner.** The kit pill kept "Open the camera" readable while it waited (no spinner; the thinking line says what is happening after 1 s). The live `loading` swaps the label for a spinner and dims the button to 0.45, so in a short check the spinner flashes. Accept the live pattern, or give the live Button a "busy, keep the label" mode?

## 05 · Pro (test paywall)

Reference: none (no screenshot exists). The look is the play screen's: the light table's top bar and manila slip (app/capture/review.tsx), the case-closed dossier's Playfair title and its live buttons (app/tutorial/complete.tsx, src/components/Button.tsx). 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`), plus `ref.background` (the silk), the live `Button` (`radius.control` 8, `minHeight` `hit.min` 48), the kit's brass focus ring (`ref.focus`, drawn by the live Button itself) and control timing (the fades), and the screen's own `ref.layout.pro` (`spinnerDelay` 300, `noticeIcon` 18). No Geist, no NoirText, no `ref.type`, no light pool.

Route: `app/pro.tsx` (`/pro`, optional `?cap=<n>`), re-exporting `src/screens/pro/ProScreen.tsx`. `openCapture()` (section 04, Entry rule) pushes it, or replaces with it, when the player has an email account but no `custom_rooms` entitlement. It sits in the root Stack with the same fade as every route; the iOS edge swipe stays on.

Files: `ProScreen.tsx` (layout, Loading indicator, fade), `BenefitSlip.tsx` (the manila slip), `ProNoticeLine.tsx` (error and info lines), `useProFlow.ts` (states, routing, test purchase), `useFocusOnOpen.ts`, `useOverflowScroll.ts`, `copy.ts` (every word). Tests: `src/screens/pro/__tests__/pro-test.tsx`.

### Feel

A case-file cover from the darkroom dossier. A brass mono stamp at the top names the file, then a long stretch of silk and grain. Low on the page sit one Playfair statement and a manila slip, typed in carbon ink, listing what Pro does. Below them come one brass button (the screen's only "go") and a quiet way out. There is no art, mount, price, countdown, badge, oxblood or decorative motion: the cover says what the player gets and steps aside. In test builds a small mono stamp says plainly that the purchase is a test.

**Accent on this screen:** brass only. "Unlock Pro" (test builds) and "Check again" (test purchases off) are both the live `Button variant="primary"`: fill `color.accent` #C89D54, label `color.onAccent` #171411 (7.3:1). Never `variant="signal"`.

### Layout, top to bottom

Default, test build (`EXPO_PUBLIC_TEST_PURCHASES=1`), default text size. The block from the statement down to the slip is bottom-anchored, so it grows upward into the void.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Root `color.canvas` #090807. Then `<BackgroundStill />` (`ref.background.asset`, the black silk, peak `ref.background.peak` #262626, contentFit cover). Then the live `<Grain />` (assets/grain.png repeated at 0.04 opacity). Then content. No light pool. | — |
| Status bar | y 0–59 (safe-area top) | System, light content | — |
| Top bar | y 59–107: one row, `minHeight` `hit.min` 48, padX `space.gutter` 20. A `hit.min` 48 spacer at x 20–68 and another at x 325–373; the stamp column between them, x 68–325 (257) | The light table's top bar, with no control in it | — |
| File stamp | Centred in the top bar, line box y 76–90 (14). Text ≈ 186 wide (24 × 7.8 − 1.2 tracking), x ≈ 103–290 | `Text variant="stamp"` (JetBrains Mono Medium 11/14, +1.2), `tone="accent"` `color.accent` (6.1:1 at the silk peak). a11y label "Case file. ESCAPD Pro." | `CASE FILE  ·  ESCAPD PRO` |
| Void | y 107–399 (292): 24 fixed (`space.xl`, the scroll frame's top margin) + 268 flexible | Silk and grain. It absorbs growth from large text. | — |
| Statement | x 20–373 (353), line boxes 399–437 and 437–475 (2 × 38) | `Text variant="caseDisplay"` (Playfair Display SemiBold 34/38), `tone="primary"` `color.text` #F2ECE1 (12.9:1 at the peak), left-aligned, `accessibilityRole="header"` | "Open a file on your own room." The two spaces in "your own room." are U+00A0, so it sets "Open a file on / your own room." (≈ 238 + ≈ 238) |
| Gap | 475–499 (24, `space.xl`) | — | — |
| Benefit slip | x 20–373 (353), y 499–626 (127) | The light table's slip: `color.manila` #E8DFC8, `radius.slip` 8 with `...curve`, padding `space.lg` 16, gap `space.xs` 4, no border. Inner box x 36–357 (321) | — |
| Slip heading | x 36, line box 515–529 (14), ≈ 108 wide | `stamp` in `tone="ink"` `color.ink` #171411 (13.8:1 on manila). a11y label "What Pro opens." | `WHAT PRO OPENS` |
| Slip lines | Three rows, 4 apart: line boxes 533–556, 560–583, 587–610 (23 each). Numeral column x 36–60 (`minWidth` `space.xl` 24, `paddingRight` `space.sm` 8); sentence x 60–357 (297) | Numeral: `stamp`, `tone="ink"`, dropped (23 − 14) / 2 = 4.5 × fontScale so its 14 box centres on the sentence's first line (537.5–551.5, 564.5–578.5, 591.5–605.5); hidden from screen readers. Sentence: `Text variant="body"` (Plus Jakarta Sans 16/23), `tone="ink"`. Each row is one screen-reader element labelled by its sentence | `01` "Your room becomes the case." (≈ 208)<br>`02` "The clues hide in your things." (≈ 231)<br>`03` "Up to {generations_cap} new cases a month." ("Up to 20 new cases a month." today, ≈ 208). Cap unknown: "A monthly allowance of new cases." (≈ 254) |
| Gap | 626–658 (32, `space.xxl`, the scroll frame's bottom margin) | — | — |
| Notice slot | x 20–373, y 658–676 (`type.caption.lineHeight` 18 × fontScale). Always reserved; empty in Default | **Error:** glyph `ref.layout.pro.noticeIcon` 18 in `color.warning` #D4883A (5.3:1; an icon, never coloured text) at x 20–38, y 658–676, centred on the first caption line. Then `space.sm` 8, then text x 46–373 (327) in `Text variant="caption"` (Plus Jakarta Sans Medium 13/18), `tone="secondary"` `color.textSecondary` #A89C8A (5.6:1). Slot: `accessibilityLiveRegion="polite"`, `collapsable={false}` | See States |
| Gap | 676–684 (8, `space.sm`) | — | — |
| Test stamp | Centred on x 196.5, line box 684–698 (14). ≈ 100 wide, x ≈ 146–247 | `stamp`, `tone="secondary"` `color.textSecondary` (5.6:1). Not a control. `accessible={false}` and hidden: its words are the button's hint | `TEST PURCHASE` |
| Gap | 698–710 (12, `space.md`) | — | — |
| Unlock Pro | x 20–373 (353 × 48), y 710–758. Label centred, ≈ 83 wide | The live `Button variant="primary"` (/play's button): `radius.control` 8, `minHeight` `hit.min` 48, padding `space.md` 12 × `space.gutter` 20, fill `color.accent`, no border or shadow. Label `type.control` (Plus Jakarta Sans SemiBold 15/20) in `color.onAccent` (7.3:1) | "Unlock Pro" |
| Gap | 758–766 (8, `space.sm`) | — | — |
| Not now | x 20–373 (353 × 48), y 766–814, the full column as the case-closed screen's quiet button; label centred, ≈ 58 wide | The live `Button variant="quiet"`: transparent, no border, `radius.control` 8, `minHeight` 48, the same padding. Label `type.control` in `color.text` (12.9:1 at the silk peak) | "Not now" |
| Bottom | 814–852 (38) = safe bottom 34 + `space.xs` 4 | Silk | — |

Check: 59 + 48 + 292 + 76 + 24 + 127 + 32 + 18 + 8 + 14 + 12 + 48 + 8 + 48 + 38 = 852. The two live buttons (48 + 48) take the same 96 as the pill and quiet pill they replaced (52 + 44), so everything above "Unlock Pro" keeps its place.

**Gutters.** `space.gutter` 20 on both sides for the top bar, statement, slip, notice and both buttons (the light table's and the case-closed screen's gutter). The test stamp and the buttons' labels are centred on x 196.5.

**No header control.** The top bar holds only the stamp, centred between two 48 spacers, so it sits exactly where the light table's "LIGHT TABLE" does. "Not now", Android back and the iOS edge swipe are the exits; a back arrow would duplicate "Not now" and add a keyboard stop.

**No mount.** Nothing on this screen is a photograph or art, so there is no film-plate mount or plate label.

**Copy, and what it's grounded in**

| Slot | Copy | Grounded in |
|---|---|---|
| File stamp | CASE FILE  ·  ESCAPD PRO | The product name in the develop copy ("Your own rooms are part of ESCAPD Pro"); the play screen's stamp pattern ("ESCAPD 400  ·  PLATE I") |
| Statement | Open a file on your own room. | What Pro unlocks: the `custom_rooms` entitlement, the only entitlement key |
| Slip heading | WHAT PRO OPENS | New with this look, after the light table's "BEFORE YOU DEVELOP". Echoes the statement |
| 01 | Your room becomes the case. | 3–6 plates of one room (`min_photos_per_room` 3, `max_photos_per_room` 6) become a playable case. Echoes the tagline "Your room becomes the mystery." |
| 02 | The clues hide in your things. | The darkroom "finds the objects, chooses what to hide, and writes the case". One of 7 hand-authored templates is fitted to the objects in the plates (`_shared/templates.ts`) |
| 03 | Up to {generations_cap} new cases a month. | `get_my_access().generations_cap`: 20 over a rolling 30-day window; only queued, running and succeeded jobs count, so failed developments are free. Read from the server, never hard-coded |
| Test stamp | TEST PURCHASE | Test builds only |
| Action | Unlock Pro / Check again | — |
| Quiet | Not now | — |

### Tappable elements

Screen-reader order: file stamp → statement (header) → slip heading → 01 → 02 → 03 → notice (when set) → "Unlock Pro" (or "Check again") → "Not now". Each slip line is one element labelled by its sentence (`accessible` on iOS, `screenReaderFocusable` on Android so it is never a keyboard stop); the numerals and the test stamp are hidden. Keyboard and switch focus: the action button → "Not now" (the statement-and-slip ScrollView is scrollable, and so a keyboard stop on Android, only while it overflows). When the screen opens, accessibility focus moves to the statement once the opening transition has ended (at once for a root route).

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| "Unlock Pro" (test build) | 353 × 48 (taller with large text), the whole button, plus the live `hitSlop` 4 | Purchasing (States). a11y label "Unlock Pro", hint "Test purchase. Nothing is charged." Ignored while loading. |
| "Check again" (test purchases off) | 353 × 48, the same slot | Re-runs `ensureSession()` + `getMyAccess()`, the button `loading` (the spinner in its label's place). Entitled → Already has access. Not entitled → stays, refreshes line 03's cap and announces "No access on this account yet." It is how a tester continues after access is granted by hand (scripts/grant-test-access.sql). |
| "Not now" | 353 × 48, plus `hitSlop` 4 | `router.back()`, or `router.replace('/')` (the 01 hub) with no history. Changes nothing. Disabled (the live 0.45) during Purchasing and Check again. |
| Android hardware back | System | Same as "Not now", in every state, Purchasing included. Leaving aborts the focus's AbortSignal, so a late result never navigates. |
| iOS edge swipe | System left edge | Enabled. Same as Android back. |
| Stamp, statement, slip, test stamp | — | Not tappable. |

**Entry rule (section 04's `openCapture()`).** `ensureSession()` then `getMyAccess()`, in this order:
1. `is_anonymous` → `/account?next=back`. The server requires an email account.
2. No `has_custom_rooms_entitlement` → `/pro?cap=<generations_cap>` (push, or replace with `replace`); plain `/pro` when the cap isn't a number.
3. Entitled but `can_generate` false (cap reached) → `/capture/develop?from=hub`, develop's own cap state. **The cap is develop's message, never this screen's.**
4. Otherwise the seen flag: `/capture/guide` the first time, else `/capture`. If the check can't run, the caller continues to `/capture`, and develop checks again before anything is sent.

The develop screen keeps its own "Your own rooms are part of ESCAPD Pro" state for access that lapses between camera and darkroom, and does not link here (/pro continues to the guide or camera, which is wrong with plates waiting on the light table).

### Test purchase

**Today (built):** `src/capture/testPurchase.ts` is a stub. `testPurchasesEnabled()` is `process.env.EXPO_PUBLIC_TEST_PURCHASES === "1"` (inlined at build time). `grantTestEntitlement()` rejects at once with `TestPurchaseUnavailableError` and makes no network or Supabase call, so "Unlock Pro" always ends in the Error state "Test purchases are off on this server." The stub's own message is for logs only. `TestPurchaseError(code)` carries the function's error codes for later: `test_purchases_off`, `account_required`, `unauthorized`, `internal_error`.

**Planned (not built; Supabase work is out of scope):** a test-only Edge Function `grant-test-entitlement` that does by API what scripts/grant-test-access.sql does by hand, for the caller only.

| Step | Behaviour |
|---|---|
| 1. Gate | `env("ESCAPD_TEST_PURCHASES") !== "1"` → 403 `test_purchases_off`, before auth. |
| 2. Caller | `requireUser(req)` (as `delete-account`, `merge-guest`); bad or missing token → 401 `unauthorized`. `verify_jwt = false` in `supabase/config.toml`. |
| 3. Guests | `user.is_anonymous` → 403 `account_required`. |
| 4. Write | Service-role upsert into `public.entitlements`: `{ user_id, entitlement_key: "custom_rooms", provider: "manual", status: "active", expires_at: null }`, `onConflict: "user_id,entitlement_key,provider"`. User id from the verified token only; body ignored; idempotent. |
| 5. Reply | 200 `{ granted: true }`; a database error → 500 `internal_error`. Through `handler()`: POST only, CORS, uniform error JSON. |

Client, once it exists: `grantTestEntitlement()` becomes `supabase.functions.invoke("grant-test-entitlement", { body: {} })` in `src/lib/escapd-api.ts`, rethrowing a `FunctionsHttpError` as `TestPurchaseError` with the `error` code from `await error.context.json()`. Both flags are needed and only the server secret protects anything: `EXPO_PUBLIC_*` ships in the binary and the URL is public, so while the secret is set any signed-in email account on that project can grant itself Pro. Undo: the "Undo" statement in scripts/grant-test-access.sql revokes a `manual` row.

Later, RevenueCat replaces this path (`Purchases.logIn(<supabase user id>)`, a store purchase on "Unlock Pro", `revenuecat-webhook` writing a `revenuecat` row, re-check `get_my_access`). The screen then gains a price in place of the TEST PURCHASE stamp, Restore purchases and the store-required terms and privacy links; the function and both flags are deleted.

### States

- **Default:** as in Layout. Opened from `openCapture()` with `?cap=`, it renders on the first frame with no second access check.
- **Loading** (no usable `?cap`: a deep link, a restored route): the same ground as Default (canvas, silk, grain) and nothing else. If `getMyAccess()` is still running after `ref.layout.pro.spinnerDelay` 300 ms, a native `ActivityIndicator` (small, 20 × 20) in `color.accent` appears centred at (196.5, 426), box x 186.5–206.5, y 416–436. A faster check shows nothing. a11y: one element, role progressbar, label "Loading" (`accessible` on iOS, `screenReaderFocusable` and `focusable={false}` on Android, so never a keyboard stop). The result routes as Guest or Already has access (the indicator stays until openCapture navigates), or shows Default with the result's `generations_cap`. Default's content (stamp to Not now) fades in over the kit's `controlTiming` (ref.motion.control, 120 ms ease-out, opacity only); the ground does not change. A failed check shows Default with line 03's fallback ("A monthly allowance of new cases.") and no notice.
- **Purchasing** (after "Unlock Pro"): the live Button's `loading`, not a Thinking state (one call plus one RPC, nothing true to rotate).
  - A native `ActivityIndicator` (20 × 20) in the label colour `color.onAccent` takes the label's place, centred at (196.5, 734): x 186.5–206.5, y 724–744.
  - The button keeps its `color.accent` fill and drops to the live 0.45 opacity, ignores taps and sets `accessibilityState={{ busy: true, disabled: true }}`; its label and hint stay for screen readers.
  - "Not now" drops to 0.4 and is disabled; system back stays live. Any notice clears.
  - Calls: `currentSession()` (stored, no network; a guest routes as Guest without calling the function), then `grantTestEntitlement()`, then `getMyAccess()`.
- **Success:** `getMyAccess()` reports `has_custom_rooms_entitlement`. `useFeedback().success()` (develop's haptic) and `announceForAccessibility("Pro unlocked.")`, then `openCapture({ replace: true })`: the guide first time, else the camera, or develop's cap state if the allowance is used. /pro leaves the stack, so back returns to the hub. No success screen, stamp or celebration. Loop guard: /pro calls `openCapture` only after it has seen the entitlement itself; a 200 without it is the generic error.
- **Error:** in the notice slot (y 658–676), one line: glyph in `color.warning`, text `caption` in `tone="secondary"`. It fades in over `controlTiming` (opacity) and is announced: on iOS by `announceForAccessibility`, on Android by the always-mounted polite live region on the slot (the line itself is `accessibilityLiveRegion="none"`, because Android speaks only changes inside an existing live region). The button returns to idle (label back) for a retry, "Not now" to full opacity; a retry clears the notice. `color.error` is not used on this screen (2.3:1 on the silk).

  | Cause | Glyph (`color.warning`, 18) | Text (`caption`, secondary) |
  |---|---|---|
  | Offline (`isNetworkError`) | Phosphor `WifiSlash` | "You're offline. Connect and try again." (≈ 251) |
  | Today's stub (`TestPurchaseUnavailableError`), or 403 `test_purchases_off` | Phosphor `Warning` | "Test purchases are off on this server." (≈ 251) |
  | 403 `account_required` | — | No notice: routes as Guest |
  | 401, 5xx, entitlement still missing, anything else | Phosphor `Warning` | "Couldn't unlock Pro. Try again." (≈ 205) |

- **Already has access:** whenever a check on this screen finds the entitlement (Loading, the silent re-check on `AppState` → `active`, "Check again"), `openCapture({ replace: true })` with no haptic or announcement. With `?cap=` the first frame is Default; the skip happens only if a later check finds access.
- **Guest:** a check that finds `is_anonymous`, or the function's `account_required`, runs `router.replace({ pathname: "/account", params: { next: "back" } })`. /account then goes back to the hub. /pro never calls the function for a guest.
- **Test purchases off** (`EXPO_PUBLIC_TEST_PURCHASES` is not "1"; every production build today):
  - No TEST PURCHASE stamp. The notice and test-stamp slots together (y 658–698, `minHeight` 18 + 8 + 14 = 40, × fontScale for the two lines) hold an info line, bottom-aligned at 698: 2 lines, y 662–698, x 20–373, `caption` in `tone="secondary"`, no glyph (information, not an error), never a live region or announcement: "Pro isn't on sale yet. If you're testing, ask for access, then check again." (≈ 75 characters).
  - The action slot holds "Check again", the live `Button variant="primary"`; while it checks it is `loading`, its spinner in `color.onAccent` in the label's place.
  - A failed check puts its error line (glyph + text) in the info line's place, inside an always-mounted polite live region that holds only errors; the info line returns, outside the region (so it is not re-announced), on the next check. Nothing above moves.
- **Pressed:** the live Button's press: the whole button at opacity 0.82, and the brass primary's fill `color.accent` → `color.accentPressed` #DFB66C (label 9.7:1). No scale.
- **Focus:** the kit's brass ring (`ref.focus`: 2 pt `color.accent`, offset 2), drawn by the live Button itself with radius `radius.control` + 4 = 12, concentric with its corners: 361 × 56 around either button (x 16–377; y 706–762 around the action, y 762–818 around "Not now").
- **Disabled:** only "Not now", during Purchasing and Check again (the live Button's 0.45). The action button shows the same 0.45 while it is loading.
- **Reduced motion** (`useTheme().reducedMotion`): nothing on this screen moves in any mode. The fades (Default, error lines) are opacity-only and stay. The native indicators keep the platform's behaviour.
- **Large text:** all text honours system scaling and never shrinks.
  - The top bar grows: the stamp wraps inside its 257 column.
  - The bottom-anchored block grows upward into the void, keeping ≥ 24 above the statement. Slip lines grow with their text (a sentence may wrap); numerals stay centred on the first line.
  - Both buttons are their label's lines + 24 (`space.md` above and below), never under 48: from text scale 1.2 they grow, "Not now" upward from 814 and the action button above it; a label may wrap inside the 20 side padding.
  - If the block still doesn't fit, the statement and slip scroll (and only then become a keyboard stop) while the notice, test stamp, pill and "Not now" stay pinned.
- **Narrow screen:** gutters stay 20, so the column is width − 40 (335 at 375, 320 at 360), the slip's inner box column − 32 (303 / 288) and the sentences inner − 24 (279 / 264). The longest line (fallback, ≈ 254) fits at 360; a wrapped line grows its row by 23 and the block rises.

### Decisions

1. **Look:** the play screen's dossier look (user decision): brass stamp, Playfair statement, manila slip, /play's live buttons, over canvas + silk + Grain. Noir's Geist type, dither, ruled index and oxblood signal are gone.
2. **Route and trigger:** `/pro`, pushed or replaced by `openCapture()` with `?cap=<generations_cap>`, only for a missing `custom_rooms` entitlement. Guests go to `/account` first; a reached cap is develop's message.
3. **Top bar without a control:** the light table's bar geometry (48 row, stamp centred between 48 spacers) with no back or close button. "Not now", Android back and the edge swipe are the exits.
4. **Benefits on manila:** three lines on the light table's slip, numerals as hidden ink stamps, sentences in `body` ink (16/23, larger than the light table's `caption` lines, since these are the screen's content). New heading "WHAT PRO OPENS".
5. **Brass, never signal:** both actions are the live brass primary `Button`; "Not now" is the live quiet `Button`. (2026-10-25, round 2: these replace the kit's brass-scheme pills; 8 pt corners, 48 tall, the brass focus ring drawn by the button.)
6. **Notices on dark:** a `color.warning` glyph plus `caption` text in secondary for every error. No error-coloured text or glyph on the dark ground.
7. **Loading:** the live short-wait pattern, a small `ActivityIndicator` in `color.accent` after 300 ms, on the same ground as Default, so only the content fades in.
8. **Test purchase:** stub today (always "Test purchases are off on this server."); the planned `grant-test-entitlement` function as in Test purchase. Offered only when `EXPO_PUBLIC_TEST_PURCHASES=1`.
9. **Purchasing feedback:** the live Button's `loading` (the native spinner in the label's place), not a Thinking state.
10. **After success:** `openCapture({ replace: true })`; /pro leaves the stack.
11. **Test purchases off:** an honest "isn't on sale yet" line plus "Check again". No fake purchase button.
12. **Later:** RevenueCat replaces the test path; the screen gains a price, Restore purchases, terms and privacy links.

### Needs you

1. **Where test purchases may run.** The server secret is the only real gate: while `ESCAPD_TEST_PURCHASES=1` is set on a Supabase project, any signed-in email account on it can give itself Pro. Proposed: set it only on a testers' project, and `EXPO_PUBLIC_TEST_PURCHASES=1` only in the EAS `development` and `preview` environments. If one project will also serve store builds, remove the secret (or never deploy the function) before release. Please confirm the project and build profiles.
2. **Slip heading.** "WHAT PRO OPENS" is new copy for the manila slip. Keep it, or name another (for example "IN THIS FILE").
3. **Top-bar control.** The cover keeps 05's "no header control" rule, so its top bar is a stamp only. If you want the light table's full pattern, a close `IconButton` (X, 48) at the right would duplicate "Not now" and add a keyboard stop.

## Decisions

Every question left open by the first draft, and how Noir or your answers settled it. Each screen section has the full reasoning under its own "Decisions".

### Across screens

| Question | Decision |
|---|---|
| Palette, fonts, button shape | All five screens: the play screen's look (brass, Playfair titles, film-plate mounts, mono plate labels), the play screen's 8 pt `Button`, a brass focus ring. The silk background stays on the hub, guide and Pro |
| Where game mode lives | It **is** the hub at `/` and replaces today's title screen (you confirmed) |
| Getting to the camera | One helper, `openCapture()`, checks access first. Guest → `/account?next=back`. No Pro → `/pro`. Monthly limit reached → the darkroom's existing limit message. Access → the photo guide the first time, otherwise the camera. If the check can't run, the hub carries on to the camera (the darkroom checks again before anything is sent) |
| Where red appears | Nowhere as a signal colour any more: "go" actions, stamps and the camera's continue cue are brass. Red is only the live error colour, as an icon on dark grounds or as text on manila |
| Loading | A real wait with something true to say: Thinking states in the warm tone. A button's own action: the live `Button`'s `loading` (spinner in place of the label). A short wait with no status line: a small brass ActivityIndicator. Countable progress: a thin bar with a mono count |
| The painted magnifying glass | Kept as it is for now (your answer): the one exception to grayscale brand art, used only as 01's hero object. A Noir version comes later |
| Tilt | Allowed as the one pointer effect (your answer): the 01 glass only |
| Backgrounds | Your choice: the black-and-white warp from your shader library, as one pre-rendered still (black silk, peak #262626), on 01, 04 and 05. 02 and 03 (the camera route) stay flat |
| Paywall | `/pro` with a test purchase that grants access and lets you through (your answer) |

### Per screen

- **01 · Game mode** (the play screen's look):
  - Wordmark with its brass doorway edge, a help button that opens "How you play" (the live Sheet with a brass Switch for Show interactives, and "How to photograph a room").
  - No back or close button.
  - "Choose a case" in Playfair, subtitle "Three files on the desk."
  - The three cards are small film plates on walnut mounts with brass plate labels, warm line art and sentence-case notes; SOLVED is a brass stamp; DEVELOPING is the warm shimmer.
  - YOUR CASE with no room is dimmed and shows "None yet".
  - The brass glass sits above the title and tilts. No light pools.
- **02 · Camera** (the play screen's look):
  - Flat canvas with film grain (no silk), so photos are judged on a plain ground.
  - The viewfinder is a film plate on a walnut mount with brass corner brackets and the label "ESCAPD 400 · PLATE I".
  - Header buttons, flash and grid are the play screen's IconButtons; flash is off or on; the framing grid replaces flip camera.
  - 0.5× wherever the phone has an ultra-wide lens (default 1×), as a walnut switch with a brass thumb.
  - The Roman-numeral plate counter is brass mono in a small mount, showing the plate about to be taken.
  - The brass shutter with a manila core carries the magnifier icon (your Figma note).
  - The last-plate thumbnail gets a brass ring from 3 plates.
  - Library picker at the top right. Privacy note until plate I. Plate V detail: "Optional. Anything still unseen."
- **03 · Camera permission** (the play screen's look):
  - Flat canvas with film grain; a walnut sheet in the play screen's sheet style (brass hairline, no handle).
  - A warm line drawing of the phone with brass brackets on a small film-plate mount; no light pool.
  - Sentence case; title "Let ESCAPD use the camera" in Playfair; body in Jakarta.
  - Brass "Allow the camera" / "Open Settings", quiet "Choose photos instead", using the play screen's Button.
  - No flash between screens: the camera uses the same canvas and grain.
- **04 · Photo guide** (the play screen's look):
  - Four steps under the brass stamp "BEFORE YOU SHOOT · n OF 4".
  - Each drawing sits on a walnut film-plate mount labelled "ESCAPD 400 · STEP I" to "STEP IV"; warm line art with brass brackets. No light pool.
  - "Next" is the walnut secondary button; "Open the camera" the brass primary (the play screen's 8 pt Button).
  - Swiping also moves between steps.
  - X skips to the camera and marks the guide seen; on a replay, X returns to the hub.
  - The seen flag is stored on the device. Replay lives in How you play.
- **05 · Pro** (the play screen's look):
  - A case-file cover: brass stamp "CASE FILE · ESCAPD PRO", the statement in Playfair, the three benefits on a manila slip headed "WHAT PRO OPENS".
  - Brass "Unlock Pro" calls the test grant, which is still a stub (Supabase work was out of scope), then carries on to the guide or camera.
  - When test purchases are off, it says plainly that Pro isn't on sale yet and offers "Check again".

## Needs you

Nothing blocking. Settled on 2026-10-25: the camera and permission screens follow the play screen's look, all buttons are its 8 pt style, and the focus ring is brass. Known small differences, kept unless you say otherwise:
- **Loading:** the live `Button`'s `loading` dims the button (0.45) and swaps its label for a spinner. On the guide's replay check the spinner can flash briefly when the check is quick.
- **Pressed state:** buttons press by opacity (0.82), not a colour fade, and "Next" → "Open the camera" swaps colour instantly.
- **Pro:** the slip heading "WHAT PRO OPENS" and no close button in its top bar. **Guide:** "STEP I–IV" plate labels. **Hub:** sentence-case notes.

Settled earlier:
- **Background:** the black-and-white warp (black silk, peak #262626). Bolder versions are in `F:/escapd-tools/bg-shaders/compare-bw.html`.
- **Test purchases:** one Supabase project with `ESCAPD_TEST_PURCHASES=1` is fine for now; turning it off is on the pre-release list (Build notes).
- **Guests and test purchases:** skipped for now. Guests add an email before the paywall, as the server requires.
- **The 0.5× lens:** check that room generation copes with ultra-wide distortion before the lens control ships (Build notes).

## Build notes

- **Fixed 2026-10-25: light pools painted as solid rectangles.** Gradient stops now carry `stopOpacity`; see Global tokens, Backgrounds and light pools. The hub and guide no longer draw pools at all.

These aren't questions; they're work the spec depends on.

- **Fonts and icons:**
  - Install and load Geist and Geist Mono.
  - Export Phosphor `Lightning` / `LightningSlash` from `src/components/icons.ts`.
  - Give `Wordmark` a prop so its D can be drawn white.
- **01:**
  - Show the glass from `magnifier-1024.png`; the 96 pt set is too small for its 128 pt box.
  - Check the tilt direction and glare strength on a real phone.
  - The darkroom's limit message talks about "your plates", which doesn't fit a player arriving from the hub with none. It needs a line of its own for that case.
- **02:** the plate V line in `src/capture/slots.ts` changes.
- **03:** re-check camera permission when the app comes back from Settings (AppState).
- **04:** the four guide illustrations still need drawing as grayscale SVG line art.
- **05:** write the `grant-test-entitlement` Edge Function and the matching flag (`EXPO_PUBLIC_TEST_PURCHASES`).
- **Background:** copy `F:/escapd-tools/bg-shaders/out-bw/noir-warp-silk-lossless.webp` (522 KB) to `assets/backgrounds/noir-warp-silk.webp`. Lossless only: lossy WebP brightens the peak past the text-contrast limit.
- **02 lens:** before the 0.5× control ships, check that room generation (`supabase/functions/_shared/perception.ts`, `geometry.ts`) copes with ultra-wide barrel distortion. If it doesn't, limit 0.5× to plate I or hide it.
- **Before any release:** remove the `ESCAPD_TEST_PURCHASES` secret from the Supabase project, leave `EXPO_PUBLIC_TEST_PURCHASES` out of production builds, and replace the test path with the real purchase.
- **Live theme:** when the build starts, move the live theme (`color`, `font`, `type`) over to `ref` so the rest of the app, including the player, becomes Noir too.

## Screens with no layout reference yet

These will get Noir from the tokens but have no layout of their own in this document.

**Existing routes**

| Route | Screen | Notes |
|---|---|---|
| `/tutorial` | The Study, the guided first case (shared Player) | Case title in Playfair; the escape moment uses `ref.type.escape` |
| `/play/[roomId]` | Player for your own room: scene, hotspots, inventory, code pad, loupe, Explore list, Case options sheet | Your room photos stay in full colour |
| `/tutorial/complete` | Case closed: time and hints used | The escape moment and the SOLVED stamp in signal red |
| `/capture/review` | Light table: review plates before upload | |
| `/capture/develop` | Darkroom: account and Pro checks, monthly limit, sending, developing, ready, failed | Thinking states for sending and developing; the limit message reached from the hub |
| `/account`, `/account/confirmed` | Add your email; confirming it | |
| Shared | `StateScreen` loading and error, `Toast` | Loading follows the loading rules |

`/pro` (05) is fully specified but has no layout reference.

**Planned, not built yet:**
- Real purchase (RevenueCat), replacing the test path.
- Case list ("My cases"): rename, delete, regenerate.
- Completion screen for your own rooms.
- Settings.
- Account management: sign-in, Apple and Google linking, deleting an account.
- Hint UI.
- Case intro.
- Countdown after a wrong code.
- Cancelling a development.
