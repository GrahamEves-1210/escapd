# ESCAPD design spec: Noir, and the play screen's look

> **Direction change (2026-10-25).** The play screen (`/play`) and the light table (`/capture/review`) are the visual identity: brass accent, Playfair case titles, film-plate framing, mono plate labels. The hub (01), the photo guide (04) and Pro (05) now follow that look, keeping two things from Noir: the silk background and the pill buttons. The camera (02) and camera permission (03) still use Noir as specified below. See **The play screen's look** after Global tokens.

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
- All five screens are built (branch `redesign-noir`).
- Noir tokens are the `ref` export in `src/theme/tokens.ts`; the play screen's look uses the live tokens above it (`color`, `type`, `space`, `radius`, `curve`, `motion`), plus `ref.background`, `ref.button.brass` and `ref.motion.thinking.shimmerWarm`.
- Geist and Geist Mono are installed and loaded in `app/_layout.tsx`; only the Noir screens (02, 03) use them.

**Base:** iPhone 393 × 852 pt, safe areas 59 top and 34 bottom, tap targets of at least 44 pt.

**Contents:** Global tokens · 01 Game mode · 02 Camera · 03 Camera permission · 04 Photo guide · 05 Pro · Decisions · Needs you · Screens with no layout reference yet

## Global tokens

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

## The play screen's look (hub, guide, Pro)

Since 2026-10-25 the hub (01), the photo guide (04) and Pro (05) follow the identity of the play screen and the light table, the live theme in `src/theme/tokens.ts` ("The Darkroom Dossier & Brass Mechanism"). Two things carry over from Noir: the **silk background** (`ref.background`) and the **pill buttons** (now in a brass scheme). The camera (02) and permission (03) keep Noir. Each screen's section below describes it as built.

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
| Pill buttons | Noir's `PillButton` with `scheme="brass"`: primary is brass with the dark label (the screen's main "go"), secondary is walnut with a brass hairline, quiet is text. Same height, shape, pressed colour change (120 ms) and focus ring as Noir. Label in `type.control` (Jakarta SemiBold 15/20). No oxblood | `ref.button.brass` |
| Waits | `ThinkingStates tone="warm"`: the same swap and sweep in live caption / body / stamp type, from `color.textSecondary` to `color.text`. Short waits with no status line: a small `ActivityIndicator` in brass | `ref.motion.thinking.shimmerWarm`, `color.accent` |
| Case stamps ("SOLVED") | Brass stamp text in a 1 pt brass bordered box, never oxblood | `type.stamp`, `color.accent`, `radius.control` |
| Errors on dark | An icon in `color.warning` or `color.error` beside text in `color.textSecondary`. Error-coloured text only on manila (5.0:1) | — |

**Contrast on the silk's brightest pixel (#262626):** `color.text` 12.9:1, `color.textSecondary` 5.6:1, `color.accent` 6.1:1, `color.warning` 5.3:1; `color.error` only 2.3:1, so it is never used as text on a dark ground. `color.onAccent` on brass is 7.3:1 (9.7:1 pressed); ink on manila is 13.8:1.

## 01 · Game mode (the hub at /)

Reference: docs/refs/01-game-mode.png (layout only). The look is the play screen's: /play's Kodachrome mount and brass plate label (src/render/SceneView.tsx), the light table's heading and caption (app/capture/review.tsx), the case-closed panels and rule (app/tutorial/complete.tsx), Case options' sheet and switch (src/render/Player.tsx), and the kit's brass pills. 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`, `motion`), plus `ref.background` (the silk), `ref.button.brass` (through `PillButton scheme="brass"`), `ref.button.disabledOpacity` (the kit's 0.4, as the brass pill dims), `ref.motion.thinking.shimmerWarm` (through `ThinkingStates tone="warm"`), `ref.motion.tilt` (the glass), the kit's focus ring (`ref.focus`) and control timing (`ref.motion.control`), and the screen's own `ref.layout.hub` (`wordmarkHeight` 14, `hairline` 1, `glass` 128, `lens` (0.614, 0.331) r 0.252, `weights` 7 : 7 : 50 and 15 : 17, `fan` { height 226, sideOffset 105, sideDrop 10, tilt 6, cover 28, minWidth 375, maxFontScale 1 }, `card` { 122 × 209, art 48, artStroke 1.6 }, `stackedMinHeight` 96, `noticeIcon` 18, `sheetExit` 200, `sheetFocusMargin` 100). No Geist, no NoirText, no `ref.type` or `ref.color`, no light pool, no oxblood.

Route: `app/index.tsx` (`/`) re-exports `src/screens/hub/HubScreen.tsx`. Files: `HubScreen.tsx` (layout, routing, sheet, notice slot, focus return), `Deck.tsx` (fan, stack, fan focus ring), `GameCard.tsx` (mount, plate, labels, SOLVED stamp, busy), `CardArt.tsx`, `CardNote.tsx`, `HubNotice.tsx`, `HowYouPlaySheet.tsx`, `Magnifier.tsx` (the glass), `layout.ts` (geometry rules), `caseStatus.ts` (every word and state), `useHubData.ts` (fetch and follow). Tests: `src/screens/hub/__tests__/hub-test.tsx`, `layout-test.tsx`.

### Feel

Three case files laid on the silk under a brass reading glass, each one a small photographic plate on a walnut mount, the way /play mounts the player's room. The ground is the black silk still under the live grain, and nothing is lit from behind: the mounts' brass hairlines and the brass labels carry the page. One Playfair statement ("Choose a case") with a small warm caption under it, as the light table heads its plates. Each plate holds a fine warm line drawing (cream hero lines, taupe secondary lines, brass details), and under each plate sits a brass mono plate label (THE STUDY, YOUR ROOM, YOUR CASE) with a short status note. After the player solves their own case, a brass SOLVED stamp is pressed on the corner of that plate. Nothing moves unless something is happening: a mount warms and its hairline brightens to brass when pressed, the How you play sheet rises, a small brass indicator turns on a plate while its card opens, and a warm shimmer crosses DEVELOPING while the player's room is being built. The glass is the one exception: press and drag it and it leans toward the finger with a glint on its lens; let go and it settles flat. It never moves on its own. The voice is terse, procedural and case-file.

**Accent on this screen:** brass only (`color.accent` #C89D54): the plate labels, the mounts' hairlines (`color.hairline`, brass at 0.32), the line art's details, the rule under the header, the SOLVED stamp, the busy indicator, the Show interactives track and the guide pill's hairline. The painted brass glass is art, not accent. There is no "go" button on the screen (the cards are the actions) and no `variant="signal"`.

### Layout, top to bottom

393 × 852, default text size, all three cards idle, glass shown.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | Root `color.canvas` #090807. Then `<BackgroundStill />` (`ref.background.asset`, the black silk warp, peak `ref.background.peak` #262626, contentFit cover; the kit paints its own ground until it decodes). Then the live `<Grain />` (assets/grain.png repeated at 0.04 opacity), as /play and the light table. Then content. **No light pools** (removed with their layout code and tokens) | — |
| Status bar | y 0–59 | System, light content | — |
| Header row | y 63–111 (48): safe top + `space.xs` 4, the `hit.min` 48 row, `space.xs` 4 below (header box y 0–115). padX `space.gutter` 20 | /play's top-bar spacing with the light table's gutters: a spacer, a centred mark, a button | — |
| Header, left slot | x 20–68, y 63–111 (48 × 48) | Empty `hit.min` spacer, not focusable (the hub has no account entry) | — |
| Wordmark | Centred on x 196.5: 66.3 × 14 at x 163.4–229.6, y 80–94 (centre y 87, level with the button) | `<Wordmark height={14} />` (`ref.layout.hub.wordmarkHeight`) with its defaults: strokes `color.text` #F2ECE1, the D's doorway edge `color.accent` (the brass edge; the old bright edge is dropped). iOS: a wrapping View, `accessibilityRole="image"`, label "ESCAPD"; Android reads the Svg's own label | ESCAPD wordmark |
| How you play | Button x 325–373, y 63–111, centre (349, 87). Its box (with the 4 hitSlop and the focus ring) x 321–377, y 59–115, inside the header | The live `IconButton` (48 round, `surface="plain"`: no fill, no border; pressed opacity 0.75, disabled 0.4). Glyph Phosphor `Question` at `ICON_SIZE` 22, `ICON_WEIGHT` regular, `color.text`. The live button draws no focus ring, so the hub lays the kit's pill ring around it (State: Focus) | Help mark for How you play |
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
| **How you play sheet** (over everything) | Scrim full screen. Sheet x 0–393, y 605–852 (247), `maxHeight` 64 % (545) | The live `Sheet`, `titleStyle="utility"`, as /play's Case options. Scrim `color.sheetScrim` rgba(9,8,7,0.55), fades in 200 / out 160. Sheet `color.surface` walnut with the live grain, 1 pt `color.hairline` top edge, top corners `radius.sheet` 20, a 1 pt `color.brassRule` inner rule 4 in, a 42 × 4 brass handle (`color.accent`) at y 614–618. Rises with `motion.sheetSpring` (damping 28, stiffness 320), leaves with a 200 ms slide | — |
| Sheet: header row | y 626–674 (48) | Title at x 20, line box y 638–661: `sectionTitle` (Plus Jakarta Sans SemiBold 18/23), tone primary, `accessibilityRole="header"`. Close: live `IconButton` 48 at x 337–385 (8 from the right edge), `X` at 22 in `color.textSecondary` | **"How you play"** · Phosphor `X` |
| Sheet: Show interactives row | y 686–726 (40), 12 below the header | Text column x 20–310 (290): label `control` (Plus Jakarta Sans SemiBold 15/20) tone primary, y 686–706, hidden from screen readers (the switch carries it); `space.xxs` 2; description `caption` tone secondary, y 708–726, one line at the default size (285.5 of 290), two at larger text. `space.md` 12. React Native `Switch` at x 322–373 (iOS 51 × 31), centred on the row: `trackColor={{ true: color.accent, false: color.hairline }}`, `thumbColor={color.text}` | **"Show interactives"** / "Keep the marks on objects you can use visible." (Case options' copy) |
| Sheet: guide button | x 20–373, y 742–794 (353 × 52), `space.lg` 16 below the row | `PillButton scheme="brass" variant="secondary"`: radius pill, fill `color.raised` #1E1915 (pressed `color.surface`), 1 pt `color.hairline`, label `control` in `color.text` (14.8:1) | **"How to photograph a room"** |
| Sheet: bottom | y 794–852: content `space.sm` 8 + sheet `space.lg` 16 + safe bottom 34 | — | — |

**Totals on 852:** safe top 0–59; header 59–115 (buttons 63–111); rule 115–116; glass spacer 116–145.75; glass 145.75–273.75; glass spacer 273.75–303.5; title 303.5–333.5; gap 4; subtitle 337.5–355.5; gap 24; fan 379.5–605.5; lower spacer 605.5–818; safe bottom 818–852. Header 57 = 4 + 48 + 4 + 1. The column (116–818, 702) holds the glass (128) and the hero block (30 + 4 + 18 + 24 + 226 = 302), and splits the remaining 272 at 7 : 7 : 50 (29.75 : 29.75 : 212.5). Without the glass (States) the column falls back to two spacers at 15 : 17 around the hero block: 187.5 : 212.5 on this screen, which puts the title and fan exactly where they are with it. The sheet runs 605 + 1 + 8 + 4 + 8 + 48 + 12 + 40 + 16 + 52 + 8 + 16 + 34 = 852.

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
| Sheet scrim | Everything above the sheet (y 0–605) | Closes the sheet. Not focusable |
| Sheet Close | 48 + `hitSlop` 4 = 56 × 56, x 333–389, y 622–678 | Closes the sheet; screen-reader focus returns to How you play once the sheet has left (States: Focus). a11y "Close" |
| Show interactives switch | The native switch (iOS 51 × 31; Android's Switch keeps its 48 minimum), exactly as Case options | Sets `hotspotAssist` through `usePreferences().setHotspotAssist` (AsyncStorage `escapd:pref:hotspot-assist`, shared with Case options). One a11y element: role switch, label "Show interactives", the native on/off value |
| How to photograph a room | 353 × 52 | Closes the sheet (no focus return), then pushes `/capture/guide?replay=1` (section 04). Replay never clears the seen flag; the guide sets it when closed or finished |
| Android back | — | Sheet open → closes it (true). A card busy → consumed (true) until navigation or the notice. Otherwise not handled: the system leaves the app (root) |
| Not tappable | — | Wordmark, rule, title, subtitle, mounts, plates, plate labels, notes, line art, stamp, notice. Each card is one button; its children are not separately focusable. The glass takes drags only |
| Focus order | — | Screen reader: ESCAPD (image) → How you play → "Choose a case" (header) → subtitle → THE STUDY → YOUR ROOM → YOUR CASE → notice. The glass is skipped. Cards render in that order; the centre card is stacked with `zIndex`, not render order. Keyboard: How you play → THE STUDY → YOUR ROOM → YOUR CASE. Sheet open: title → Close → Show interactives → How to photograph a room; VoiceOver is trapped by the sheet (`accessibilityViewIsModal`), and the screen behind is `importantForAccessibility="no-hide-descendants"` for TalkBack. The live Sheet moves focus to its title 300 ms after opening (50 under reduced motion) |

### States

- **Appear:** No entry animation. The glass arrives flat and without glare. The screen arrives with the root Stack's fade.
- **Loading (focus fetch):** Renders at once with THE STUDY "Unseal" and YOUR ROOM "Photograph". YOUR CASE keeps its caption line blank (a non-breaking space, so the line holds at any text size), ignores taps and is not dimmed, so nothing flashes; no spinner. For screen readers: `accessibilityState={{ busy: true, disabled: true }}`, label "Your case. Loading." until the fetch resolves. The fetch runs on every focus and only with a stored session (`currentSession()`), never creating a guest to label a card: `getLatestSession(TUTORIAL_ROOM_ID)` and `getLatestCustomRoom()` in parallel, then `getLatestSession(room.id)` for a ready room. No session → None yet.
- **Developing (YOUR CASE queued or generating):** the note is `ThinkingStates tone="warm" variant="note" decorative`: one line, no rotation, the live `stamp` type (JetBrains Mono 11/14, +1.2), **DEVELOPING** 78.0 wide, centred in the 18 caption slot (card-local y 181–195). The shimmer runs from `ref.motion.thinking.shimmerWarm.base` `color.textSecondary` to `.highlight` `color.text` and back, band 0.8 × 78 = 62.4, the band centre sweeping −78 → +156 over 2000 ms linear and repeating while the room develops. Hidden from accessibility: the card's label says "Your case. Developing." and the shimmer is never announced. While it shows and the hub has focus, the room is followed with `watchRoom(id)` plus a 5 s poll (`POLL_MS`), stopping on blur. A flip to ready shows Open, to failed See why: the shimmer stops and the caption note appears at once (both rest in `color.textSecondary`, so there is nothing to ease). The flip is announced, "Your case is ready." or "Your case didn't develop. Open it to see why.", only when seen while the hub is open.
- **Pressed:** Card: mount fill `color.surface` → `color.raised` #1E1915 and hairline `color.hairline` → `color.accent` over 120 ms ease-out (the kit's control timing), back on release; selection haptic on press-in (only with haptics on). No scale, no opacity change. How you play and Close: the live IconButton's opacity 0.75. Guide pill: `color.raised` → `color.surface`. Switch: native.
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
- **Focus:** the kit ring (`ref.focus`: 2 pt `#F2F2F2` at a 2 pt offset), shown while a control has keyboard or switch focus. Fan cards: one overlay above the fan with the focused card's box, centre and rotation, `radius.thumbRing` 18, drawn with RN outline props (`outlineWidth` 2, `outlineOffset` 2), `zIndex` above the centre card, `pointerEvents="none"`, hidden from accessibility; the cards are never restacked, and the fan container never clips. Stacked cards: the same outline on the card. How you play: the kit's pill ring on its 56 box (48 + 2 offset + 2 width). The guide pill draws its own kit ring. The live Sheet's Close draws none (a live component). VoiceOver and TalkBack draw their own cursors. **Focus return:** closing the sheet (Close, scrim, Android back) returns screen-reader focus to How you play once the sheet has left: the live Sheet has no exit callback, so the hub waits its 200 ms slide (`ref.layout.hub.sheetExit`; `motion.reducedFade` 140 under reduced motion) plus a 100 ms margin (`sheetFocusMargin`) for the modal layer's removal: 300 ms, or 240. Reopening the sheet, leaving for the guide, or leaving the hub cancels it.
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

Applied. The hub keeps its structure, routing, data, states and accessibility, and takes the play screen's materials: the silk under the live grain, Playfair for the heading, the light table's caption, walnut mounts with brass hairlines around canvas plates, brass mono plate labels, a brass case stamp, the live Sheet and Switch from Case options, and a brass-scheme pill. The Noir light pools are gone.

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
12. **How you play:** the live `Sheet` (`titleStyle="utility"`), as Case options, with a React Native `Switch` (brass track, `color.text` thumb) and `PillButton scheme="brass" variant="secondary"`. The Noir panel sheet, segment and rule are gone, with their tokens (`segment`, `sheetMaxHeight`).
13. **Help button:** the live IconButton (48, plain, `Question` 22 in `color.text`), with the kit's pill ring laid around it because the live button draws none.
14. **Hero object and tilt:** unchanged: the painted brass glass at 128, centred between the rule and the title by the 7 : 7 : 50 spacers, tilting ±16° toward a press-and-drag with a lens-clipped glare; decorative; a still image under reduced motion. It has no pool behind it now.
15. **Spacer weights without the glass:** 15 : 17 (were 23 : 25), which on 852 leaves the title and fan exactly where the glass layout puts them.
16. **Pro check and guide replay:** unchanged: YOUR ROOM runs `openCapture()`; the replay lives in the sheet and never clears the seen flag.

### Needs you

1. **Switch touch area (iOS):** the native `Switch` is 51 × 31 on iOS, under the 44 rule. It matches /play's Case options exactly, so changing it here alone would split the two sheets. If you want ≥ 44 on both, the row could become the touch target (a `minHeight` 48 row that toggles on tap, the switch staying the one a11y element): a change to Case options too.
2. **DEVELOPING type:** as asked, it is `ThinkingStates tone="warm" variant="note"`, which is the live `stamp` (mono, capitals), while the other notes are `caption`. If you would rather the note slot keep one type, `variant="meta"` gives the same shimmer in `caption` ("Developing"): a one-line change.
3. **Live components without hooks the hub needs:** the live `Sheet` has no exit callback (focus return uses the 300 ms timer above) and its Close, like every live `IconButton`, draws no keyboard focus ring. An `onExited` prop on `Sheet` and a focus ring in `IconButton` would make both exact; both are outside the hub.

## 02 · Camera

Reference: docs/refs/02-camera.png (layout only)

This section covers `/capture` and `/capture?retake=<i>` once camera permission is granted. Everything before that, including the checking state, belongs to section 03. Players reach it from 01's YOUR ROOM after the Pro check, and through 04 on their first visit. Sizes are in pt on 393 × 852 with safe areas 59 / 34. Geometry was measured at 2.165 px/pt (±0.5 pt) from the area above px 1843, then re-flowed where Noir changes it (marked "Noir:").

### Feel (Noir)

A darkroom with one window. The ground is flat `ref.color.ground` #050505 edge to edge. The only light on the screen is the live feed: full colour, unfiltered, in a frame with radius 6 that fills 57% of the height. There is no `ref.light` pool, glow, Grain or gradient, because the viewfinder already is the pool. The chrome is graphite and hairline (`ref.panel`: fill #0E0E0E, 1 pt `ref.color.hairline` #222222).

- **White** (`ref.color.bright` #F2F2F2) marks statements: the plate prompt, the four corner brackets, and the shutter. The shutter is a white disk inside a white ring with an inverse-ink magnifier. It is the brightest object and the one primary action.
- **Grey** is for reading: prompt details in `ref.color.meta` #8A8D91 and the privacy rule in `ref.color.read` #A6A9AD.
- **Type:** Geist sets the prompt. Geist Mono sets the plate numeral and the lens labels, so they read like a film camera's exposure counter and an evidence log.
- **Oxblood** appears once. A 2 pt `ref.color.signal` #C8302B ring closes around the last-plate thumbnail when the roll reaches its 3-plate minimum, meaning the case can proceed.
- **Motion** is limited to 120 ms colour changes, the 0.96 shutter press, the bracket settle when the lens opens, and the thinking line during a real wait. Nothing else moves.

**Signal on this screen:** one mark, the 2 pt `ref.color.signal` ring on the last-plate thumbnail. It shows once the roll holds ≥ 3 plates (`MIN_PLATES`), outside retake mode.
- Not used here: `ref.button.signal`, `ref.stamp`, and any red text (`ref.color.signalText`).
- Signal "go" actions: 1 (the limit is 1). The ring-marked thumbnail ("continue to the light table") is the only signal-marked action.
- The shutter is the primary action and is white, never signal. The flash and grid toggles are utility controls, also never signal.

### Layout, top to bottom

| Element | Position & size | Style | ESCAPD content |
|---|---|---|---|
| Canvas | 0,0 · 393 × 852 | `ref.color.ground` #050505, opaque and flat. No light pool, Grain, vignette, gradient or glow. | — |
| Status bar | y 0–54 (safe top 59) | System, `light` content | — |
| Header row | y 67–111 (top = safe top + 8) · 44 tall | — | Back · prompt · library |
| Back button | Box x 21–65, y 67–111 · 44 × 44 · centre (43, 89). Section 03's back arrow sits on this exact box and crossfades into this button. | `ref.button.icon`: circle, `ref.radius.pill` 999, fill `ref.color.panel` #0E0E0E, 1 pt (`ref.border.hairline`) `ref.color.hairline` #222222. No shadow. | Phosphor `ArrowLeft`, regular, `ref.icon.header` 20, `ref.color.bright` #F2F2F2, centred |
| Title | Centred on x 196.5. Max width 247 (x 73–320: the button inner edges minus 8 on each side). Line box y 69–91. 1 line (2 with large text). | `ref.type.headline` (Geist Medium 17/22, −0.2), `ref.color.bright`. Noir: the reference's serif is gone, because Playfair is only for case titles. | The plate prompt title from `src/capture/slots.ts`: "From the doorway" · "Opposite corner" · "The busiest wall" · "A close view" · "Another angle" · "Last plate". Roll full: "Six plates is a full roll" (≈ 180 wide). |
| Subtitle | Centred, max width 247. Line box y 91–109; title plus subtitle is a 40 pt block centred on the button centre y 89. 1 line, 2 at most. A second line grows the header 18 downward and the viewfinder shrinks to match. | `ref.type.meta` (Geist Regular 13/18), `ref.color.meta` #8A8D91 | The plate detail: "Wide. Include the floor and two walls." (≈ 232, the widest that fits) · "Overlap the first plate." · "The wall with the most objects." · "A desk, shelf, or table." · plate V **"Optional. Anything still unseen."** (proposed, ≈ 193; today's "Optional. Something the first plates missed." is ≈ 270 and wraps) · "Optional. One more overlap." Roll full: "Continue to the light table." The error line replaces it (see States). |
| Library button | Box x 328–372, y 67–111 · 44 × 44 · centre (350, 89). Right edge 21. | `ref.button.icon`, the same as Back | Phosphor `Images`, regular, 20, `ref.color.bright`. This replaces the reference's own glyph in this slot. |
| Viewfinder frame | x 14–379, y 139–625.7 · 365 × 486.7 (exactly 3:4, 57% of the height) · `ref.radius.panel` 6. Top = header bottom 111 + `ref.space.band` 28. Sides are `ref.space.plate` 14. Noir: the reference's large round corners become radius 6, and the top moves 1 pt up to sit on the band token. | `ref.panel`: the fill `ref.color.panel` #0E0E0E shows until frames arrive. The 1 pt `ref.color.hairline` edge stays drawn over the feed. Overflow hidden. | `CameraView`: `facing="back"`, `mode="picture"`, 4:3, with `flash` and `selectedLens`. `containBox` fits the frame into the space that's left and centres it, so the viewfinder shrinks before any text does. |
| Live feed | Fills the frame | Full colour. No filter, tint, scrim or overlay. | The room |
| Framing grid (when on) | Inside the frame, edge to edge, at thirds: verticals at x 135.7 and 257.3, horizontals at y 301.2 and 463.4 | 1 pt (`ref.border.hairline`) `ref.color.read` #A6A9AD lines, opaque, `pointerEvents="none"`. Drawn above the feed and below the brackets and the privacy note. | Rule of thirds. Off by default. |
| Corner brackets | Inset 16 (`ref.space.lg`) from each frame edge. Noir: the radius-6 corner no longer needs the old 20 inset. Corners at (30, 155), (363, 155), (30, 609.7), (363, 609.7). Arms 22, stroke 1.5. | `ref.color.bright`, butt caps, mitred corner, `pointerEvents="none"`. Hidden until `onCameraReady`, then they settle in (see States). | ESCAPD's bracket language, the same as hotspots in play |
| Privacy note | Bottom-centred in the frame. Bottom y 609.7: 16 above the frame edge and level with the bottom bracket corners. Max width 273 (x 60–333 = 365 − 2 × (16 inset + 22 arm + 8)), which clears the bracket arms (they end at x 52 / 341) by 8. Two lines: y 557.7–609.7 · 52 tall. | `ref.panel` (opaque #0E0E0E, 1 pt `ref.color.hairline`, `ref.radius.panel` 6). Padding 12 / 8 (`ref.space.md` / `ref.space.sm`). Text `ref.type.meta` in `ref.color.read`, centred, ≈ 300 wide over two lines. | "Keep people, mail, and lit screens out of frame." Shown until plate I is taken, and never in retake mode. Section 04 carries it too. |
| Control row | y 653.7–697.7 · 44 tall · centre y 675.7. Top = frame bottom + `ref.space.band` 28. Noir: the 40.2 measured row becomes the 44 hit row, and the segment sits at 36 inside it. | — | Flash · lens · grid |
| Flash toggle | Box x 21–65 · 44 × 44 · centre (43, 675.7), in the back-button column | `ref.button.bare`: no container, `ref.icon.control` 24. Off: `ref.color.meta`. On: `ref.color.bright`. It is a utility toggle, so never signal. | Phosphor `LightningSlash`, regular (off, the default) / `Lightning`, regular (on) |
| Lens segment, track | x 146.5–246.5, y 657.7–693.7 · 100 × 36, centred in the row | `ref.button.segment`: `ref.radius.pill`, fill `ref.color.panel`, 1 pt `ref.color.hairline` | Shown only on devices that report an ultra-wide lens, once the lens list resolves after `onCameraReady` (see States, Camera starting). Otherwise it is hidden and the centre slot stays empty. |
| Lens segment, thumb | 46 × 28, inset 4 (`ref.space.xs`). Left x 150.5–196.5 or right x 196.5–242.5, y 661.7–689.7. | `ref.button.segment.thumbFill` `ref.color.hairline2` #303030, `ref.radius.pill`. When the side changes it crossfades over `ref.motion.control` 120 ms. It never slides. | Under the active lens |
| Lens labels | Centred in each half at x 173.5 / 219.5, y 675.7 | `ref.type.label` (Geist Mono Medium 12/16, +1.2). Active `ref.color.bright`, inactive `ref.color.meta`. Fixed widths ≈ 33.6 / 16.8 (Geist Mono 0.6 em + 1.2 per glyph). | "0.5×" and "1×". The "×" (U+00D7) always shows, so nothing reflows when the lens changes. Default is 1×. |
| Grid toggle | Box x 328–372 · 44 × 44 · centre (350, 675.7), in the library column | `ref.button.bare`, 24. Off: `ref.color.meta`. On: `ref.color.bright`. | Phosphor `GridNine`, regular. It takes the slot of the reference's flip control. |
| Bottom row | y 721.7–797.7 · 76 tall · all three centres on y 759.7. Top = control row bottom + `ref.space.xl` 24. | — | Counter · shutter · last plate |
| Plate counter | x 21–93, y 723.7–795.7 · 72 × 72 · `ref.radius.panel` 6. Noir: the 73 × 52.6 odometer pill becomes a square counter window that mirrors the thumbnail. | `ref.panel`. The text stack is centred: 16 label line + 4 gap + 34 numeral line = 54, leaving 9 above and below. Fixed at 72 × 72 at every text size: label and numeral cap at `maxFontSizeMultiplier` 1.25 (see Large text). Display only, with no pressed state. | Label `ref.type.label` in `ref.color.meta`: "PLATE" (≈ 42 wide). Numeral `ref.type.code` (Geist Mono Medium 28/34, +2, tabular) in `ref.color.bright`: the plate about to be taken, "I" to "VI" ("III" ≈ 54 of the 70 inner width). It has no neighbouring numerals and does not roll. |
| Shutter ring | Ø 76 · x 158.5–234.5, y 721.7–797.7 · centre (196.5, 759.7) | `ref.button.shutter`: a 2 pt `ref.color.bright` ring with a 4 pt `ref.color.ground` gap inside it | — |
| Shutter disk | Ø 64 · x 164.5–228.5, y 727.7–791.7, concentric | `ref.button.shutter.fill` `ref.color.bright`. No gradient, bevel, rim or glow. | Phosphor `MagnifyingGlass`, regular, `ref.icon.shutter` 28, `ref.color.inverseInk` #0A0A0A, centred. If the lens reads high-left on device, nudge it ≤ 1 down-right. This is the user's magnifier note. |
| Last-plate thumbnail | x 300–372, y 723.7–795.7 · 72 × 72 · `ref.radius.panel` 6 · right edge 21 | The photo fills the frame (`contentFit="cover"`) in full colour, with a 1 pt `ref.color.hairline` border on top. From 3 plates the border becomes a 2 pt `ref.color.signal` #C8302B ring, drawn inside the 72 box so the photo doesn't move. Before plate I it is an empty `ref.panel` well. | The newest plate on the roll |
| Bottom space | y 797.7–852: 20.3 clear, then the 34 home-indicator inset | `ref.color.ground` | System home indicator |

**Adds up, top to bottom:** 59 safe top + 8 + 44 header row + 28 + 486.7 viewfinder + 28 + 44 control row + 24 + 76 bottom row + 20.3 + 34 = 852.

**Adds up, across:**
- Header: 21 + 44 + 8 + 247 + 8 + 44 + 21 = 393.
- Control row: 21 + 44 + 81.5 + 100 + 81.5 + 44 + 21 = 393.
- Bottom row: 21 + 72 + 65.5 + 76 + 65.5 + 72 + 21 = 393. The gaps are equal; the measured gaps were 64.7 / 65.9.
- Viewfinder: 14 + 365 + 14 = 393.

**Columns:**
- Left, x 43: back and flash.
- Centre, x 196.5: title, lens and shutter.
- Right, x 350: library and grid.
- The counter and the thumbnail align by their outer edges at 21 (centres 57 and 336), as measured.
- The 21 edge is the measured value (20.8–21.2) and is kept as a literal (`ref.space.edge` 20 + 1), so 03's back box matches.

### Tappable elements

- Hit areas are at least `ref.hit.min` 44, and 48 (`ref.hit.comfortable`) wherever the row has room.
- Pressed is a colour change over `ref.motion.control` (120 ms ease-out). The only scale is the shutter's; there is no opacity-press.
- Disabled is `ref.button.disabledOpacity` 0.4.

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| Back | 44 + `hitSlop` 2 → 48 × 48 | "Close the camera": `router.back()`, or `router.replace("/")` (the 01 hub) when there is no history. The roll stays in memory (`roll.ts`), so there is no confirm. In retake mode it is "Cancel retake": `router.back()` to `/capture/review`, with the plate unchanged. While a retake capture is busy, back is ignored until it settles (a late result never triggers a second `router.back()`). |
| Android hardware back | System | Same as Back in every state, including the busy rule in retake mode. |
| Library | 44 + `hitSlop` 2 → 48 × 48 | "Choose photos from your library" (retake: "Choose a photo instead"). Opens `launchImageLibraryAsync` with multi-select up to `MAX_PLATES − taken` (1 in retake). Photos go one after another, each through `processPhoto` → `addPlate` in its own try/catch, so a failed photo never drops the picks after it; the failures are counted for the error line (see States, Error). Retake: `processPhoto` → `replacePlate` → `router.back()`. Disabled while busy and when the roll is full. |
| Viewfinder | Not tappable | expo-camera has no tap-to-focus point and no pinch zoom outside its scanner, so the platform's continuous autofocus does the work and nothing more is promised. |
| Privacy note | Not tappable | Plain text, read in focus order |
| Flash | 44 + `hitSlop` 2 → 48 × 48, centre (43, 675.7) | Toggles `flash` between "off" and "on". The setting lasts for the camera session. Role `switch`, label "Flash", `checked`. |
| Lens "0.5×" | 50 × 36 half + vertical `hitSlop` 6 → 50 × 48 | iOS: sets `selectedLens` to the ultra-wide entry from `getAvailableLensesAsync()`. Role `radio`, label "Ultra-wide lens", `selected`. |
| Lens "1×" | Same | Default main lens (`selectedLens` unset). Role `radio`, label "Main lens". The two halves form a `radiogroup` "Lens". |
| Grid | 44 + `hitSlop` 2 → 48 × 48, centre (350, 675.7) | Shows or hides the framing grid. Off by default; the setting lasts for the camera session. Role `switch`, label "Framing grid", `checked`. |
| Shutter | Ø 76 ring | `takePictureAsync({ quality: 0.92, exif: false })` → `feedback.tap()` → `processPhoto` → `addPlate`. The counter, thumbnail, title and subtitle then advance to the next plate. In retake mode it calls `replacePlate(i)` → `router.back()`. a11y: "Take plate III, The busiest wall" (retake: "Retake plate II, Opposite corner"). It is the primary action. |
| Last-plate thumbnail | 72 × 72 | Pushes `/capture/review` (the light table). a11y: "Open the light table, 2 plates", and from 3 plates "Continue to the light table, 3 plates". Disabled before plate I and while busy. In retake mode it is labelled "Cancel retake" and calls `router.back()`. |
| Plate counter | Not tappable | Text. a11y by state: normal "Next: plate III. 2 of 6 plates taken." · roll full "Roll full. 6 of 6 plates taken." · retake "Retaking plate II." |

**Focus order (VoiceOver / TalkBack):** Back → header (title and subtitle as one element, role `header`) → Library → privacy note (while shown) → Flash → Ultra-wide lens → Main lens → Framing grid → plate counter → Shutter → Last plate. When the screen opens, accessibility focus starts on the header.

**Keyboard and switch focus** reaches controls only: Back → Library → Flash → Lens → Grid → Shutter → Last plate. The lens radiogroup is one stop: the arrow keys or a switch action move the selection between "1×" and "0.5×". VoiceOver and TalkBack keep the two `radio` elements.

### States

- **Before camera permission is granted** (permission loading, undetermined or denied): owned entirely by section 03. This layout mounts only after a grant.
- **Camera starting** (before `onCameraReady`):
  - The frame shows its `ref.color.panel` #0E0E0E fill and the brackets are hidden.
  - The shutter, flash and grid are at 0.4. Back and Library stay live.
  - The centre slot of the control row is empty. The lens list (`getAvailableLensesAsync` / `onAvailableLensesChanged`) is read after `onCameraReady`; if it reports an ultra-wide lens, the segment fades in with a 0 → 1 opacity change over `ref.motion.control` 120 ms. Otherwise the slot stays empty. A dimmed segment is never shown.
  - The privacy note already shows.
- **Ready:** as in the layout table.
  - On `onCameraReady`, the four brackets settle together over `motion.bracketSettle` 380 ms, ease `bezier(0.2, 0, 0, 1)`. Each starts 6 further out along its diagonal (inset 10) and moves to inset 16, while fading 0 → 1 over 200 ms. This is the caliper motion of hotspots in play, with no hold or dim afterwards.
  - The controls return to 1.0 over `ref.motion.control` 120 ms.
- **Camera didn't start** (`onMountError`):
  - The subtitle becomes an error line in the Error state's layout: Phosphor `Warning`, regular, 16 (`ref.icon.small`) in `ref.color.error` #B5564F, a 4 gap, then "The camera didn't start." in `ref.type.meta` / `ref.color.read` #A6A9AD. Centred and announced politely.
  - The shutter, flash and grid stay at 0.4, and the lens segment never appears (no lens list without `onCameraReady`). Library and Back are the ways forward.
- **Pressed:** every change runs over `ref.motion.control` 120 ms ease-out and reverses on release.
  - Back and Library: fill `ref.color.panel` → `ref.color.panelPressed` #161616.
  - Flash and grid: glyph → `ref.button.bare.pressedGlyph` `ref.color.read` #A6A9AD.
  - Inactive lens half: label `ref.color.meta` #8A8D91 → `ref.color.read`.
  - Shutter: the disk fill goes `ref.color.bright` #F2F2F2 → `ref.color.brightPressed` #D4D4D4 and scales to 0.96 (`ref.motion.shutterPress`, 120 ms). The ring stays fixed.
  - Thumbnail: the 1 pt border goes `ref.color.hairline` #222222 → `ref.color.read`. The signal ring goes `ref.color.signal` #C8302B → `ref.color.signalPressed` #A82823. The photo itself never changes.
- **Disabled:** the whole control drops to 0.4 (`ref.button.disabledOpacity`), glyph and border included.
  - The empty thumbnail before plate I is the exception: it stays a full-opacity empty well.
  - Disabled controls stay in screen-reader focus with the "dimmed" state.
- **Focus:** `ref.focus` is a 2 pt `ref.color.bright` outline with a 2 pt offset, following each control's shape:
  - Ø 52 circle around Back, Library, Flash and Grid.
  - A pill (`ref.radius.pill`) around the whole 100 × 36 lens track, outer box x 142.5–250.5, y 653.7–697.7, because the radiogroup is one keyboard/switch stop. It stays inside the control row and clears the flash and grid hit boxes (x 67 / 326).
  - Ø 84 circle around the shutter.
  - A rounded rectangle with radius 6 around the 72 thumbnail, sitting 2 outside it.
- **Busy** (capturing and re-encoding, or processing library picks):
  - Taps on the shutter are ignored. It keeps its static full-opacity white disk and magnifier, with `accessibilityState.busy`. No spinner.
  - Library, flash, the lens segment and the thumbnail are at 0.4; the thumbnail keeps its image and ring. Back and Grid stay live, except that back is ignored during a retake capture.
  - Waits under ~1 s show nothing more, so nothing flickers.
  - Waits over ~1 s use the thinking state (`ref.motion.thinking`) in the subtitle slot:
    - One line, `ref.type.meta`, centred, no rotation. Glyph shimmer `ref.motion.thinking.shimmer`: base `ref.color.meta` #8A8D91, highlight `ref.color.bright` #F2F2F2, band 0.8 × line width, left → right, 2000 ms linear, repeating.
    - It shows only real progress. Capture, a single library pick, or any retake: "Preparing plate III". Library, 2+ picks: "Preparing photo 2 of 4", swapping with the `ref.motion.thinking` transition (swap 150 ms ease-in-out, gap 50, distance 8) each time the count changes. A hidden sizer holds the longest line ("Preparing photo 4 of 4"), so the box never resizes.
    - Reduced motion: a static line in `ref.color.read` #A6A9AD; count changes cross-fade over `motion.reducedFade` 140 ms.
    - The visible copies are hidden from screen readers. The container has a fixed `accessibilityLabel` ("Preparing plate III" / "Preparing 4 photos") and is not re-announced on each count.
    - The line stops the moment processing ends; the subtitle then shows the next prompt (or the error line).
- **Captured:**
  - Haptic tap (`feedback.tap()`).
  - The thumbnail swaps to the new plate with a 120 ms opacity change (`ref.motion.control`).
  - The counter numeral swaps in place, with no roll.
  - The title and subtitle swap to the next prompt with no animation and are announced (`accessibilityLiveRegion="polite"`).
  - After plate I the privacy note fades out over 120 ms.
- **Error** (capture or library): the subtitle becomes an error line until the next attempt.
  - Layout: Phosphor `Warning`, regular, `ref.icon.small` 16, in `ref.color.error` #B5564F, then a 4 gap, then the text in `ref.type.meta` with `ref.color.read`. The group is centred and announced politely.
  - Copy: "That plate didn't take. Try again." (≈ 221 including the icon) for a capture error.
  - Copy for library picks follows the failure count: "One photo couldn't be used." or "2 photos couldn't be used." (up to 6; both ≤ 247 with the icon). It replaces today's 2-line string. The photos that worked still join the roll.
  - The error colour is never used on the text itself and is never the signal.
- **3 plates or more** (`MIN_PLATES`, outside retake mode):
  - The thumbnail border changes from 1 pt `ref.color.hairline` to the 2 pt `ref.color.signal` ring over 120 ms.
  - Its a11y label becomes "Continue to the light table, n plates".
  - This is the screen's only signal mark.
- **Roll full (6):**
  - The shutter and Library are disabled at 0.4.
  - The title is "Six plates is a full roll" and the subtitle "Continue to the light table."
  - The counter reads "FULL" over "VI".
  - The thumbnail keeps its ring. Flash, lens and grid stay live because the preview runs.
- **Retake mode** (`?retake=<i>`):
  - The counter label reads "RETAKE" (≈ 50 wide) over that plate's numeral.
  - The title and subtitle show that plate's prompt. Noir: the "Retake." prefix is dropped because the counter carries it, so plate I's detail still fits on one line.
  - The thumbnail shows the plate being replaced in full colour, without a ring.
  - Library picks 1. The privacy note is hidden.
- **No ultra-wide lens** (Android today, older iPhones): the lens segment is hidden. Flash and grid keep their columns, and the row height is unchanged.
- **No flash unit:** the flash shows `LightningSlash` at 0.4 with the a11y label "Flash unavailable".
- **Large text:**
  - The title and subtitle grow without a cap and may wrap to 2 lines each. The header grows downward, the 28 band holds, and `containBox` shrinks the viewfinder. Text never shrinks.
  - The counter label and numeral cap at `maxFontSizeMultiplier` 1.25. "III" (35 pt) is then 3 × (0.6 × 35) + 2 × 2 ≈ 67 wide and the stack 20 + 4 + 42.5 = 66.5 tall, both inside the 70 inner box; "RETAKE" (15 pt) is ≈ 60. The window stays 72 × 72, clear of the shutter ring at x 158.5, and the counter's `accessibilityLabel` carries the full information.
  - The privacy note may take 3–4 lines, still bottom-anchored inside the frame.
  - The lens labels cap at `maxFontSizeMultiplier` 1.25 (15/20). "0.5×" is then 4 × 9 + 3 × 1.2 = 39.6, leaving ≈ 3 on each side of the 46 thumb, and the 20 line fits the 28 thumb. The iOS large-content viewer shows them on long press. Glyph sizes are fixed.
- **Narrow and short screens:** layout comes from the insets, and the viewfinder absorbs the difference.
  - 375 × 667 (safe areas 20 / 0): the header row sits at y 28–72 and the bottom row bottom is held ≥ 20 above the screen edge. The viewfinder fits ≈ 281 × 375, centred at x 47–328.
  - On that viewfinder the privacy note's max width becomes viewfinder width − 92 ≈ 189, so 3 lines.
  - At a 375 width the title area is 229, so plate I's detail wraps to 2 lines.
  - At a 360 width (Android) the bottom-row gaps are 49.
- **Reduced motion:**
  - The bracket settle becomes an opacity fade over `motion.reducedFade` 140 ms with no travel.
  - The shutter press is the colour change only, with no scale.
  - The 120 ms colour and opacity changes stay as they are.
  - The thinking line is static in `ref.color.read`; count changes cross-fade over `motion.reducedFade` 140 ms.
  - Nothing else on this screen moves.

### User notes

> "the photo button has a magnifier glass icon on it."

**How it's honoured:**
- The shutter disk carries Phosphor `MagnifyingGlass` (regular, 28, `ref.color.inverseInk` #0A0A0A) on the white `ref.button.shutter` disk (`ref.color.bright` #F2F2F2). It is the brightest object on the screen and the primary action.
- It fits the detective vocabulary (to photograph a room is to examine it) and echoes the 2.2× press-and-hold loupe in play.
- The painted magnifier PNG (`assets/brand/magnifier*.png`) is not used. It is colourful brand art, and Noir's chrome is monochrome.

**Reference layout kept:** dark ground, a large framed viewfinder, the title and subtitle at the top, a three-slot control row, a round shutter, a counter at bottom-left, and the last shot at bottom-right.
- The flip slot becomes the framing grid.
- The counter becomes a static Roman plate window.
- None of the reference's text, names or glyphs are used.

**Shimmer:** the user's supplied shimmer lives on in the thinking state. The thinking state (`ref.motion.thinking`) runs on real waits only: the darkroom on /capture/develop, and here only the Busy wait (see States).

**Changes from today's `/capture`:**
- The X close becomes a back arrow in a 44 round `ref.button.icon`.
- The mono "PLATE I" stamp becomes the prompt title, and the numeral moves to the counter window.
- The prompt slip becomes the title and subtitle.
- The 40 × 53 plate strip becomes the counter and the last-plate thumbnail.
- The library picker moves from bottom-left to the right header button.
- The next arrow becomes the thumbnail. Its continue cue moves from ≥ 4 plates to ≥ 3 and becomes the signal ring.
- The viewfinder corners tighten to `ref.radius.panel` 6.
- The shutter changes from a 3 pt accent ring with a cream core to a 2 pt white ring with a white disk and the magnifier.
- Flash, lens and grid are new.
- The privacy caption becomes a note on the viewfinder, shown only until plate I.
- The roll-full detail is shortened to "Continue to the light table."
- The "RETAKE PLATE II" stamp becomes the counter's "RETAKE" label.

### Decisions

1. **Flip camera:** removed. Its slot is a framing-grid toggle (`GridNine`, bare; bright when on, meta when off).
2. **0.5× ultra-wide:** offered on every plate wherever an ultra-wide lens is reported (iOS `getAvailableLensesAsync`). The default is 1×, and the segment is hidden otherwise.
3. **Flash:** off / on only, default off.
4. **Counter:** Roman numerals in `ref.type.code` (Geist Mono) in a 72 × 72 `ref.panel` window labelled "PLATE". It shows the plate about to be taken, statically, with no roll.
5. **Brackets:** kept, in `ref.color.bright`, 1.5 stroke, inset 16. They settle with `motion.bracketSettle`. The viewfinder frame radius is 6.
6. **Right header slot:** the library picker. The guide replay lives in 01's How you play sheet.
7. **Privacy line:** an opaque `ref.panel` note on the viewfinder until plate I. Section 04 carries it too.
8. **Shutter position:** all three bottom-row centres are aligned at y 759.7. The shutter keeps its measured centre; the counter and thumbnail sit 3.3 lower than measured.
9. **Plate V detail:** "Optional. Anything still unseen." (one line, ≈ 193). Changing `src/capture/slots.ts` is for the build.
10. **Continue cue:** a 2 pt `ref.color.signal` ring on the thumbnail from 3 plates. It is the screen's one signal mark.
- **Cross-screen:**
  - Palette, type and button shape come from Noir.
  - The header buttons are `ref.button.icon` and the lens control is `ref.button.segment`.
  - Access is checked on 01 before `/capture` opens.
  - The thinking state (`ref.motion.thinking`) runs on real waits only: the darkroom on /capture/develop, and here only the Busy wait (see States).

### Needs you

- **Ultra-wide distortion:** confirm that the generation pipeline (`_shared/perception.ts`, `_shared/geometry.ts`) copes with 0.5× barrel distortion before the lens segment ships.
  - If it doesn't, either limit 0.5× to plate I ("From the doorway") or hide the segment everywhere.
  - Nothing else on the screen changes either way: the centre slot of the control row simply stays empty.

## 03 · Camera permission

Reference: docs/refs/03-camera-permission.png (layout only)

Measured at 2.178 px/pt: 856 × 1854 px above the caption strip = 393 × 852 pt (safe areas 59 / 34). Values in [brackets] are the reference's own geometry; the main value is what ESCAPD uses. None of the reference's colours, copy, phone render, type or animation carries over.

**Where it lives.** This is a route state of `/capture` (app/capture/index.tsx), including `/capture?retake=<i>`. It is not a new route and not a modal. It replaces both full-screen `StateScreen`s there: "Opening the rangefinder" while `useCameraPermissions()` returns `null`, and the pre-prompt whenever it returns not granted. Outside retake mode, /capture also runs 04's guide-seen backstop (session flag, then AsyncStorage `escapd:onboarding:capture-guide`) during Checking. If the guide hasn't been seen, `router.replace('/capture/guide')` runs and no sheet ever renders. 02's rangefinder mounts only once access is granted.

**Hosting.** A custom bottom-anchored view (`src/capture/PermissionSheet.tsx`), not the live `Sheet`. None of `Sheet`'s look is used: no handle, inner rule, Grain, scrim, mono eyebrow, X, or its larger corners. It reuses only `Sheet`'s enter motion (`motion.sheetSpring`: damping 28, stiffness 320, mass 1; a `motion.reducedFade` 140 ms fade under reduced motion) and its move-focus-to-title behaviour. Side padding is `ref.space.xl` 24, giving a 345 column. Bottom padding is the bottom inset + `ref.space.ctaBottom` 4. It can't be dismissed by swipe and has no scrim to tap.

### Feel (Noir)

A single decision, taken in the dark before the rangefinder opens. The top 36% of the screen is flat `ref.color.ground` #050505 with nothing on it but the back arrow. A graphite sheet (`ref.panel`: #0E0E0E, 1 pt `ref.color.hairline` #222222 top edge, top corners 6) holds everything else. Its top 150 pt is a cropped window. In it, one static pool of soft white light falls on a grayscale line drawing of a phone: a dark silhouette whose screen shows the rangefinder's two upper brackets in white over the faint lines of a room corner. Below the crop everything is flat and unlit:
- a white, regular-weight statement title
- a grey paragraph saying the photos stay private
- one white pill
- a quiet grey way out.

Nothing moves except the sheet's rise, 120 ms colour presses and, during a real wait, the thinking line. The status bar stays `light` the whole time, because the screen never turns white. Thinking states (`ref.motion.thinking`) appear only during a real wait of more than ~1 s. On this screen that is Library busy, and Checking only when it runs past ~1 s (see States). A normal permission check and the OS dialog don't qualify.

**Signal on this screen: none.** `ref.color.signal` #C8302B, `ref.color.signalText` #E5484D, `ref.button.signal` and `ref.stamp` are not used. Asking for the camera decides nothing about the case. "Allow the camera" / "Open Settings" is the white `ref.button.primary`. Signal "go" actions: 0 (the limit is 1).

### Layout, top to bottom

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Status bar | y 0–59 (safe-area top), full width | System, `light` content throughout, as set in the root layout. There is no dark-content switch any more. | — |
| Dynamic Island clearance | x 133.5–259.5, y 11–48.3 (hardware) | Keep clear. The reference's arc traced around the island is another app's animation frame and is not used. | — |
| Ground | Full screen, behind everything | `ref.color.ground` #050505, opaque and flat. No haze, no Grain, no camera feed, no background still. It is the same flat ground as 02, the other state of /capture, so no flash appears between them. | — |
| Back control | Box x 21–65, y 67–111 (44 × 44, centre 43, 89): 02's `ref.button.icon` box exactly (left 21, top = safe top + 8). `hitSlop` 2 → 48 × 48 (`ref.hit.comfortable`), y 65–113 | `ref.button.bare`: no fill, no border. Phosphor `ArrowLeft` regular at `ref.icon.control` 24, glyph `ref.color.bright` #F2F2F2 (18.2:1 on ground). Same centre as 02's back button, so the control doesn't jump when the camera opens. | a11y "Close the camera"; "Cancel retake" in retake mode (02's labels) |
| Empty ground | y 111–304 (193) | `ref.color.ground`. Kept empty on purpose: this space is where the quiet comes from. | — |
| Sheet | x 0–393, y 304–852 (548) [ref 387.5–852]. Content-sized and bottom-anchored: it grows upward and its bottom stays fixed. | `ref.panel`: fill `ref.color.panel` #0E0E0E, 1 pt (`ref.border.hairline`) `ref.color.hairline` #222222 along the top edge, following the top corners. Top corners `ref.radius.panel` 6; bottom corners square at the screen edge; the side hairlines fall off-screen. Opaque. No shadow, scrim or grabber. | — |
| Illustration zone | x 0–393, y 304–454 (150, including the sheet's top hairline) [ref 387.5–537.2]. A 1 pt `ref.color.hairline` rule at y 453–454 is the crop edge. | Same `ref.color.panel` fill as the sheet. `overflow: hidden` clips the light pool and the drawing to y 305–453, so no light reaches the text. The rule is what makes the cropped phone read as deliberate. | — |
| Light pool | Centre (194, 398), r 120 (`ref.light.object.radius`); spans y 278–518 before clipping, and only y 305–453 shows | `ref.light.object`: static radial pool (react-native-svg `RadialGradient`), stops 0 rgba(242,242,242,0.07) → 0.5 rgba(242,242,242,0.025) → 1 transparent. Peak ≈ #1E1E1E over the panel, ≈ #151515 at the crop rule, ≈ #101010 at the zone top. It never moves, in any mode. | `accessible={false}` |
| Illustration | Visible ink ≈ 158 × 111: x 115–273, y 342–453 (top 38 below the sheet top), centre x 194, cropped by the rule [ref 158 × 112] | Grayscale line art in react-native-svg (`ref.illustration`), stroke `ref.illustration.stroke` 1.6, round caps and joins, all rotated 14° clockwise (the top edge falls to the right, slope 0.25). **Phone body:** 134 wide unrotated and running below the crop. Top-left corner (the highest point) at (142.7, 342), top-right at (272.7, 374.4). Corners `ref.radius.panel` 6, the same drawing language as 04's phones. Fill `ref.color.panel` so it reads as a dark silhouette in the pool; outline `ref.illustration.mid` #A6A9AD. **Inner screen:** inset 16 on the sides and top (the reference's frame band), corners 6, fill `ref.color.ground` #050505, 1 pt edge in `ref.illustration.context` #303030. **Brackets** (decision 4): the rangefinder's two upper corners, arms 22, inset 14 from the inner-screen edge, `ref.illustration.hero` #F2F2F2. The lower pair falls below the crop. **Room corner** (context): a vertical wall join on the screen's centre line from 44 below the inner top edge down to the crop. Two ceiling lines leave its top, rising outward at 15°, each 30 long and fading to transparent along its length. In unrotated phone coordinates (inner screen from x 16; left bracket corner (30, 30), vertical arm x 30, y 30–52; wall-join top (67, 60)) the left line ends at (38.0, 52.2), 8.0 from the arm's lower end (30, 52) and 8.0 right of the arm; the right line mirrors it (end x 96.0 vs arm x 104). All context lines are `.context` #303030 and fade out over the last `ref.illustration.contextFade` 40 before the crop. No island pill, no logo, no shading. | A room in the viewfinder. `accessible={false}` |
| Title | x 24–369, line boxes y 478–512 and 512–546 (2 × 34). The first box top is `ref.space.xl` 24 below the crop rule (cap top ≈ 30 below it) [ref one line, ink 29 below the panel] | `ref.type.statement`: Geist Regular 30/34, tracking −0.9, `ref.color.bright` #F2F2F2 (17.2:1 on panel), left-aligned. `accessibilityRole="header"`. | "Let ESCAPD use the camera". The space in "the camera" is a non-breaking space (U+00A0), so it sets as "Let ESCAPD use / the camera" (≈ 212 + ≈ 145 wide; unbroken ≈ 364 > 345) and never leaves "camera" alone on line 2. |
| Body | x 24–369, line boxes y 562–682 (5 × 24), `ref.space.lg` 16 below the title box [ref 5 × 22] | `ref.type.body`: Geist Regular 17/24, `ref.color.read` #A6A9AD (8.2:1 on panel), left-aligned, ragged right. At Geist 17 (≈ 8.3 pt per character, 39–43 per line) the copy sets in 5 lines. | "You'll photograph three to six views of one room. Each photo is re-encoded on your phone first, so its location never leaves it. Nothing is sent until you develop the case." |
| Inline notice (only when set) | x 24–369, line box `ref.space.sm` 8 below the body box, 18 per line. The sheet grows upward 26 for the first line and 18 for each further line, and the pill keeps its 28 gap below the notice. | `ref.type.meta`: Geist Regular 13/18. **Progress:** text `ref.color.meta` #8A8D91 (5.8:1). **Error:** Phosphor `Warning` regular at `ref.icon.small` 16 in `ref.color.error` #B5564F (4.1:1, an icon, not text) at x 24–40, centred on the first line. Text in `ref.color.read` at x 48–369. **Thinking** (Library busy): one centred line, see States. | See States. `accessibilityLiveRegion="polite"` |
| Primary pill | x 24–369 (345 × 52), y 710–762, `ref.space.band` 28 below the body box [ref 345 × 63.5, y 747.6–811.1] | `ref.button.primary`: fill `ref.color.bright` #F2F2F2, `ref.radius.pill` 999 (R 26). No border, no shadow. | Label below |
| Pill label | Centred on the pill | `ref.type.button`: Geist Medium 17/22, tracking −0.2, `ref.color.inverseInk` #0A0A0A (17.7:1 on bright) | "Allow the camera" (Default); "Open Settings" (Denied) |
| Quiet button (ESCAPD addition) | y 770–814 (44, `ref.button.quiet.height`), `ref.space.sm` 8 below the pill. Width = label + 2 × 16 (`ref.button.quiet.padX`), centred on x 196.5: ≈ 212 × 44 (x 90–303) for "Choose photos instead" | `ref.button.quiet`: no fill, no border. Label `ref.type.button` in `ref.color.read` (8.2:1), centred. | "Choose photos instead"; "Choose a photo instead" in retake mode; "Go to the light table" when the roll is full |
| Light-table button (3–5 plates, not retake mode, only) | y 770–814 (44), `ref.space.sm` 8 below "Choose photos instead", which moves up to y 718–762. Label + 32 wide, centred on x 196.5: ≈ 212 × 44 (x 90–303). The sheet grows upward 52: everything above shifts up 52 (sheet top 252, zone 252–402, title 426–494, body 510–630, pill 658–710; Denied sheet top 334), still below the y 121 cap. | `ref.button.quiet`, the same as the row above. | "Go to the light table" |
| Bottom inset | y 814–852 (38 = `ref.space.ctaBottom` 4 + 34 safe area) | Sheet fill runs to the screen edge | System home indicator |

Check: 59 + 8 + 44 (back, 67–111) + 193 + 150 (zone, 304–454) + 24 + 68 (title) + 16 + 120 (body) + 28 + 52 (pill) + 8 + 44 (quiet) + 4 + 34 = 852.

Rhythm: 24 side gutter and 345 column; 150 zone; 24 from the crop to the title box; 34 title pitch; 16 between title and body boxes; 24 body pitch; 28 from the body box to the pill; 52 pill; 8 gap; 44 quiet; 38 to the bottom. Against the reference, the sheet stands 83.5 taller (top 304 vs 387.5): +34 for the second title line, +10 for the body pitch, +52 for the quiet button and its gap, −11.5 for the 52 pill, plus about −1 rounding at the bottom.

### Tappable elements

Screen-reader order: back arrow → title → body → notice (when set) → primary pill → quiet button → light-table button (3–5 plates). When the sheet enters, and after any switch to or from Denied, accessibility focus moves to the title (header). Keyboard and switch focus: back arrow → primary pill → quiet button → light-table button (3–5 plates). The sheet, zone, pool, illustration and text are not focusable (`accessible={false}` on the pool and drawing).

| Element | Hit area ≥ 44 | Action in ESCAPD |
|---|---|---|
| Back arrow | 44 × 44 at (43, 89) + `hitSlop` 2 → 48 × 48 | `router.back()`, or `router.replace('/')` (the 01 hub) when there is no history. Retake mode: `router.back()` to `/capture/review`, plate unchanged. The roll stays in memory (`roll.ts`), so there is no confirm. Live in every state, including Checking and Requesting. Never disabled. |
| Android hardware back | System | Same as the back arrow in every state. While the OS permission dialog is open, the dialog handles back itself. Android treats that as a deny that can still ask again, so the screen stays on Default. |
| "Allow the camera" | 345 × 52 | `requestPermission()` shows the OS alert with the app.json string ("ESCAPD uses the camera to photograph your room so it can become a case. Photos are only used to build your case."). **Granted:** see Granted. **Denied, `canAskAgain` false:** switches in place to Denied. **Denied, can still ask (Android first deny):** stays on Default. **Throws:** stays on Default with the error notice. |
| "Open Settings" (Denied) | 345 × 52 | `Linking.openSettings()`. **Build requirement:** an `AppState` listener re-checks on `active` (`getCameraPermissionsAsync()`). If access is now granted, it goes to Granted. If not, it stays on Denied with no notice. Today's code has no such re-check. |
| "Choose photos instead" | ≈ 212 × 44 | `ImagePicker.launchImageLibraryAsync`, multi-select up to 6 minus plates taken (1 in retake mode, labelled "Choose a photo instead"). Each photo goes through `processPhoto` → `addPlate`. If the roll reaches ≥ 3, it pushes `/capture/review` (light table). Retake mode: `replacePlate` → `router.back()` to `/capture/review`. Below 3 plates it stays here and shows the progress notice. |
| "Go to the light table" (3–5 plates, not retake: second quiet button) | ≈ 212 × 44 (label + 32 × 44) | Pushes `/capture/review`. Without it, a player without the camera who backs out of the light table could only get back by picking another photo (cancelling the picker navigates nowhere). |
| "Go to the light table" (roll full: replaces "Choose photos instead" in the same slot) | label + 32 × 44 | Pushes `/capture/review`. |
| Sheet, zone, pool, illustration, text | — | Not tappable. No swipe-to-dismiss: the sheet is this route's state, not a modal. |

### States

- **Checking:** lasts until both `permission !== null` and, outside retake mode, the guide-seen check (session flag, then AsyncStorage `escapd:onboarding:capture-guide`) have resolved. It shows flat `ref.color.ground` #050505 plus the live bare back arrow only. There is no sheet, no camera, no spinner and no white ground (the reference look's flash is gone). If Checking runs past ~1 s, one non-rotating thinking line, "Opening the rangefinder", appears in `ref.type.meta` (Geist Regular 13/18), centred at (196.5, 426), with `ref.motion.thinking.shimmer` (base `ref.color.meta` #8A8D91, highlight `ref.color.bright` #F2F2F2, band 0.8, 2000 ms linear). Its a11y label is the same text. Under reduced motion it is a static `ref.color.read` line. It stops the moment Checking ends.
  - **Guide not seen:** `router.replace('/capture/guide')`. No sheet ever renders.
  - **Guide seen (or retake mode), not granted:** the sheet rises with `motion.sheetSpring`. This is the only path to the sheet.
  - **Granted:** straight to the rangefinder with no sheet. It fades in over `motion.sceneCrossfade` 200 ms while the bare arrow crossfades into 02's `ref.button.icon` at (43, 89), as in Granted (reduced motion: one `motion.reducedFade` 140 ms crossfade). A returning player with access sees only ground and the back arrow until 02 appears.
- **Default** (undetermined, can ask): the Layout table as written.
- **Pressed:** colour changes only, over `ref.motion.control` (120 ms ease-out). There is no opacity change and no scale.
  - Pill fill: `ref.color.bright` #F2F2F2 → `ref.color.brightPressed` #D4D4D4.
  - Quiet label: `ref.color.read` #A6A9AD → `ref.color.bright` (`ref.button.quiet.pressedLabel`).
  - Back glyph: bright → read (`ref.button.bare.pressedGlyph`).
- **Disabled:** `ref.button.disabledOpacity` 0.4 on the whole control. It applies only to the quiet button(s) during Requesting, and to the pill and the quiet button(s) during Library busy. The back arrow is never disabled.
- **Focus:** `ref.focus` is a 2 pt `ref.color.bright` outline at a 2 pt offset that follows the control's shape:
  - pill: a 349 × 56 stadium (`ref.radius.pill`)
  - each quiet button, including the light-table one: a (label + 36) × 48 stadium
  - back arrow: a 48 circle around the 44 box.

  The outline stays visible for as long as the control has focus.
- **Requesting** (after "Allow the camera"): the pill keeps its `ref.color.bright` fill and its "Allow the camera" label, ignores taps and sets `accessibilityState.busy`. No spinner: the OS alert covers the screen until `requestPermission()` resolves. The quiet button(s) are at 0.4 and the back arrow stays live.
- **Granted:** the rangefinder opens at the next untaken plate: plate I "From the doorway", counter I on an empty roll; after library picks, e.g. plate III "The busiest wall", counter III; with 6 plates, 02's Roll full. Retake mode opens the retaken plate's prompt and numeral.
  - The sheet slides out downward with `motion.sheetSpring`, while the rangefinder (mounted only now) fades in over `motion.sceneCrossfade` 200 ms on the same ground.
  - The bare arrow crossfades into 02's `ref.button.icon` (44 round, `ref.color.panel` #0E0E0E fill, 1 pt `ref.color.hairline` #222222) at the same centre (43, 89).
  - Reduced motion: a single `motion.reducedFade` 140 ms crossfade.
- **Denied, can't ask again:** new copy.
  - Title "The camera is off" (`ref.type.statement`, one line, ≈ 250 wide).
  - Body "ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken." (111 characters, 3 lines).
  - The pill reads "Open Settings"; the quiet button is unchanged.
  - The illustration is unchanged: no red, no slash, no blame.
  - Geometry: title 560–594, body 610–682, zone 386–536, sheet top 386 (82 lower than Default); pill and quiet unchanged. The text crossfades over `motion.reducedFade` 140 ms.
- **Height changes** (Denied copy, notice in or out): the sheet top moves with `motion.sheetSpring` and its bottom stays fixed. Under reduced motion the top moves instantly, with the 140 ms text crossfade.
- **Library busy:** after the picker closes, `fromLibrary` runs `processPhoto` one photo at a time on up to 6 picks (ImageManipulator, long edge 1600, JPEG 0.8). That takes several seconds after the OS UI has gone, so it is a Thinking state.
  - Controls: the quiet button(s) keep their labels at `ref.button.disabledOpacity` 0.4, ignore taps and set `accessibilityState.busy`, with no spinner. The pill is also at 0.4. The back arrow stays live.
  - Line: one thinking line in the notice slot (`ref.space.sm` 8 below the body box; the sheet grows upward 26 with `motion.sheetSpring`), in `ref.type.meta` Geist Regular 13/18, centred on x 196.5. It shows real progress: "Re-encoding photo 1 of 4", "Re-encoding photo 2 of 4", and so on, where the last number is the count picked. There is no timed rotation. Each time the count changes it swaps with `ref.motion.thinking`: over swap 150 ms ease-in-out, the old line rises 8 (distance) and fades out, and the new one waits gap 50 ms, then rises in from 8 below. The shimmer is `ref.motion.thinking.shimmer`: base `ref.color.meta` #8A8D91, highlight `ref.color.bright` #F2F2F2, band 0.8 × line width, left to right, 2000 ms linear, repeating. A hidden sizer holds the longest string, so the box never resizes mid-swap.
  - Accessibility: the moving copies are hidden from screen readers. The container has `accessibilityLabel` "Re-encoding your photos" and `accessibilityLiveRegion="polite"`.
  - Reduced motion: a static `ref.color.read` #A6A9AD line, whose text swaps with a `motion.reducedFade` 140 ms crossfade.
  - End: the line stops the moment the loop ends. It gives way to the partial or error notice, the push to `/capture/review`, or `router.back()` in retake mode. For a single photo (retake mode, or one pick), the line shows only if the work is still running after 1 s.
- **Library partial** (< 3 plates): progress notice in `ref.color.meta`: "1 plate on the roll. A case needs at least three." / "2 plates on the roll. A case needs at least three."
- **Library error:** error notice, `Warning` 16 in `ref.color.error` #B5564F plus text in `ref.color.read`: "One of those photos couldn't be used. Try another."
- **Request error** (`requestPermission()` throws): the same error notice, "The camera didn't answer. Try again." The screen stays on Default.
- **Roll ready** (3–5 plates, not retake mode): a second `ref.button.quiet`, "Go to the light table", sits 8 below "Choose photos instead" and pushes `/capture/review`. The sheet is 52 taller (top y 252 in Default, 334 in Denied); see the Layout table. It is last in the screen-reader and focus order.
- **Roll full** (6 plates): one quiet button, which reads "Go to the light table" in place of "Choose photos instead".
- **Retake mode** (`?retake=<i>`): the back arrow's a11y label is "Cancel retake", and the quiet button reads "Choose a photo instead" (it picks 1). Copy and geometry are otherwise identical.
- **Large text:** all text honours system scaling and never shrinks. The sheet grows upward to a cap at y 121 (the back arrow's 48 hit area ends at 113, plus `ref.space.sm` 8). Beyond that, the steps are:
  1. The illustration zone, its pool and the crop rule are removed (decorative). This frees 150, and the title box then sits `ref.space.xl` 24 below the sheet's top hairline.
  2. If the content still doesn't fit, the title, body and notice scroll inside the sheet while the pill and the quiet button(s) stay pinned. The pill grows with its label (min 52), and the label may wrap to 2 centred lines.
- **Narrow and short screens:**
  - 375 × 667 (safe 20 / 0): the column is 327. The title stays 2 lines and the body takes 5–6 lines. With a 0 bottom inset the bottom padding becomes `ref.space.lg` 16, because a 4 pt edge is too tight. The sheet is 526–550 tall (top y 117–141), below the 82 cap (back hit area to y 74, + 8), so the illustration stays.
  - 430-wide phones: the title may fit on one line (column 382), which makes the sheet 34 shorter.
- **Reduced motion:** opacity changes only. The sheet enter, the Denied swap and Granted each become a `motion.reducedFade` 140 ms fade. Control colour changes stay at `ref.motion.control` 120 ms, because they are colour, not movement. The thinking line (Checking past ~1 s, Library busy) is a static `ref.color.read` line whose text swaps with a 140 ms fade. The pool and illustration are static in every mode, and nothing on this screen loops.

### User notes

- User note for this screen: none was given.
- The brief's reference description, verbatim: "white bottom sheet with phone line illustration, bold "camera permission" title, short explanation, black pill "continue" button". How Noir honours it:
  - The bottom sheet stays, but as an opaque graphite `ref.panel` instead of white.
  - The phone line illustration stays and is now true grayscale line work under one `ref.light.object` pool, with ESCAPD's rangefinder brackets and a room corner on its screen.
  - The bold title becomes a regular-weight `ref.type.statement` in bright, because Noir has no heavy display weights. Its weight comes from size and brightness.
  - The short explanation stays at 5 lines.
  - The black pill becomes Noir's white `ref.button.primary`, the high-contrast fill on a dark ground, reading "Allow the camera" in sentence case.
  - The reference offers one action and no way out. ESCAPD keeps its quiet "Choose photos instead" path and a back arrow, so a player who refuses the camera can still go forward or leave.

### Decisions

1. **Case:** sentence case everywhere.
2. **Title copy:** today's "Let ESCAPD use the camera" in `ref.type.statement`, set on two lines with a non-breaking "the camera". Denied copy, written new: "The camera is off" / "ESCAPD can't ask again from here. Turn on Camera for ESCAPD in Settings, or choose photos you've already taken."
3. **Haze:** removed. A static `ref.light.object` pool on the illustration replaces it, clipped to the 150 pt zone so no light falls behind text.
4. **Illustration brackets:** grayscale `ref.illustration.hero` #F2F2F2. The phone outline is `.mid`, the screen edge and room corner are `.context`, and nothing is coloured.
5. **Body:** `ref.type.body` Geist Regular 17/24 in `ref.color.read`, 5 lines. Today's copy plus "Nothing is sent until you develop the case."
6. **Additions:** the back arrow and the quiet button are accepted. The sheet is 548 tall, top y 304 [387.5].
7. **White flash on return visits:** gone. Checking is plain `ref.color.ground` plus the back arrow, the same as 02's canvas.
8. **Settings return:** an `AppState` `active` re-check (`getCameraPermissionsAsync`) is required in the build. This is a build note, not a question.
9. **Surface, fonts, sheet corners, pill size** (first-pass questions): answered by Noir. Panel #0E0E0E on ground #050505; Geist / Geist Mono only; top corners 6; pill 52 with a `ref.type.button` 17/22 label.
10. **Modal or route state:** route state of `/capture`, not dismissable, no scrim (unchanged).

### Needs you

None.

## 04 · First-time photo guide

Reference: docs/refs/04-photo-tutorial.png (step structure only: four beats, a drawing over a title, an instruction and one button). The look is the play screen's: the light table's top bar and heading (app/capture/review.tsx), SceneView's Kodachrome mount and plate label (src/render/SceneView.tsx) and the kit's brass pills. 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`, `motion`), plus `ref.background` (the silk), `ref.button.brass` (through `PillButton scheme="brass"`), `ref.motion.thinking.shimmerWarm` (through `ThinkingStates tone="warm"`), the kit's focus ring and control timing, and the screen's own `ref.layout.guide`. No Geist, no NoirText, no `ref.type` / `ref.color`, no light pool, no oxblood.

Route: `app/capture/guide.tsx` (`/capture/guide`; `?replay=1` when opened from 01's How you play sheet), rendering `src/screens/guide/PhotoGuide.tsx`. It is shown once, before the first camera session.

Files: `PhotoGuide.tsx` (layout, routing, back, swipe, announcements), `CloseButton.tsx` (the live IconButton plus the kit's focus ring), `GuideArt.tsx` (mount, plate, plate label, the large-text sizing `artBox`), `art/` (the four scenes as data: `scenes.ts`, `geometry.ts`, `draw.ts`, `StepArt.tsx`), `GuideText.tsx` (title and body), `StepButton.tsx`, `ReplayErrorLine.tsx`, `stepper.tsx` (the crossfade), `swipe.ts`, `useReplayCheck.ts`, `copy.ts` (every word), `layout.ts`. Tests: `src/screens/guide/__tests__/guide-test.tsx` (behaviour and look) and `art-test.tsx` (drawings and plate sizing).

### Feel

A four-plate briefing pulled from the darkroom file before the first shot. Each step is a warm line drawing set on a film plate, the same walnut Kodachrome mount the case is played on, with its brass plate number stamped underneath. Above it a brass mono stamp says where the player is; below it a Playfair heading and a short Jakarta instruction. One brass pill closes the page. The drawings are bone on soot, receding to taupe, with the viewfinder brackets in brass, as the camera's own brackets once were. Silk and grain lie under everything; nothing glows or moves except the 200 ms crossfade between steps.

**Accent on this screen:** brass only. The stamp, the plate label, the mount's hairline and the drawn viewfinder brackets are `color.accent` #C89D54; steps 1–3's "Next" is the walnut brass secondary (brass hairline edge); step 4's "Open the camera" is the brass primary, the screen's one "go". Never `variant="signal"`.

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
| Status gap | 700–762 (62, `ref.layout.guide.ctaGap`): top 24, status line box 724–742 (18), bottom 20 | Empty except in replay's wait and error | — |
| Step button | x 20–373 (353), y 762–814 (52). Label padX `space.xl` 24. With larger text the pill grows upward; its bottom stays at 814 | `PillButton scheme="brass"`: pill `ref.radius.pill` with `...curve`, no shadow. Steps 1–3 `variant="secondary"`: fill `color.raised` #1E1915, 1 pt `color.hairline` edge, label `color.text` (14.8:1). Step 4 `variant="primary"`: fill `color.accent` #C89D54, no edge, label `color.onAccent` #171411 (7.3:1). Label `type.control` (Plus Jakarta Sans SemiBold 15/20), centred | "Next" on steps 1–3, "Open the camera" on step 4 |
| Bottom | 814–852 (38) = safe bottom 34 + `space.xs` 4, as Pro | Silk | — |

Check: 59 + 48 + 4 + 67 + 386 + 56 + 30 + 4 + 46 + 62 + 52 + 4 + 34 = 852.

**Gutters.** `space.gutter` 20 on both sides for the top bar, title, body, status line and button (the light table's and Pro's gutter). The mount and the stamp are centred on x 196.5.

**Mount arithmetic.** Width = plate + 2 × (1 edge + 6 walnut) = 264 + 14. Height = plate + 34: 2 × 7, the 6 label gap and the 14 label line (`mountChrome` in GuideArt.tsx).

### Steps

The copy paraphrases `src/capture/slots.ts` (plates I–IV) and the light-table checklist, and the camera's title and subtitle then echo it. Only step 1 borrows a composition from the reference: a hand holding a phone in front of its subject. Every object and scene is ESCAPD's own. The drawings are warm line art; the player's own photos never appear here.

| # | Stamp | Plate label | Title | Body | Scene (ESCAPD's own drawing) | Button |
|---|---|---|---|---|---|---|
| 1 | `BEFORE YOU SHOOT  ·  1 OF 4` | `ESCAPD 400  ·  STEP I` | Start at the doorway | One wide plate. Get the floor and two walls in. | A doorway frame (mid). Beyond it a room corner: the wall junction and the floor line along both walls (back). A hand (context, the wrist fading) holds the hero phone in front; its screen redraws the corner (back) between the brass brackets. | Brass secondary "Next" |
| 2 | `BEFORE YOU SHOOT  ·  2 OF 4` | `ESCAPD 400  ·  STEP II` | Work around the room | The far corner, then the busiest wall. Let plates overlap. | A plan of the room outline (back) with three phone plan symbols, 20 × 40, corners 6, walnut-filled, no screen detail: at the doorway (plate I, mid), the far corner (plate II, current: phone and wedge hero) and the busiest wall (plate III, mid). The mid phones' wedges are context, fading over 40. The doorway and far-corner wedges overlap. No brackets. | Brass secondary "Next" |
| 3 | `BEFORE YOU SHOOT  ·  3 OF 4` | `ESCAPD 400  ·  STEP III` | Get one close view | A desk, shelf, or table. Small things make good clues. | Top-down onto a desktop corner (mid; its two edges fade over the last 40). An open notebook and a key lie under the hero phone (back), the notebook's outer pages showing either side. The screen shows the key and the page (back) between the brass brackets, a stroke's width clear of them. No hand. | Brass secondary "Next" |
| 4 | `BEFORE YOU SHOOT  ·  4 OF 4` | `ESCAPD 400  ·  STEP IV` | Keep the case private | No people, mail, or lit screens. Lights on, hold steady. | The hero phone frames a bookshelf and a lit lamp (mid; three ray ticks above the shade, line only); its screen redraws them (mid) between the brass brackets. An envelope and an open laptop with three lit screen lines sit below, outside the frame (back, no fade). | Brass primary "Open the camera" |

### Tappable elements

Screen-reader order: Close → stamp → title → body → button (the mount, drawing and plate label are hidden). Keyboard and switch focus: Close → button. When the screen opens (its route transition ends) and after every step change, accessibility focus goes to the title and the screen announces "Step n of 4" (queued).

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| Close (X) | 48 × 48 visual + `hitSlop` 4 each side = 56 × 56, held inside the top bar by its 4 bottom padding | **First run:** skips the guide. Sets the session flag (`captureGuideSeen = true`), starts the AsyncStorage write `escapd:onboarding:capture-guide` = "1" without awaiting it, then `router.replace({ pathname: '/capture', params })`, carrying the route's params. accessibilityLabel "Skip the guide". **Replay:** sets the same flags, then `router.back()` to the hub (`router.replace('/')` with no history). accessibilityLabel "Close the guide". |
| Next (steps 1–3) | 353 × 52 (taller with large text), the whole pill | Moves to step n + 1. The drawing, plate label, stamp, title and body crossfade; the mount, Close and the button stay put. Taps during the 200 ms transition are ignored. |
| Open the camera (step 4) | 353 × 52 (taller with large text) | Sets the session and storage flags, then `router.replace('/capture')` with the carried params. The opener has already checked access; /capture shows 03 if the camera isn't allowed yet, otherwise 02 at plate I. **Replay:** in order, sets the session flag and starts the storage write, then calls `openCapture({ replace: true, skipGuide: true })` (01's YOUR ROOM check). With access it replaces to `/capture`; without, to `/account?next=back` (guest), `/pro?cap=<n>` (no `custom_rooms` entitlement) or `/capture/develop?from=hub` (monthly cap reached). Whichever route it takes, the guide leaves the stack and back returns to the hub. Pending and failure: Replay wait and Replay error. |
| Horizontal swipe | Full width, y 111–762 (between the top bar and the button) | `usePanGesture` with `activeOffsetX` ±16, `failOffsetY` ±16 (`ref.layout.guide.swipe`). Commits on release when \|dx\| ≥ 56 or \|vx\| ≥ 500 pt/s. Left = next (steps 1–3), right = previous (steps 2–4). The content doesn't track the finger; a committed swipe runs the same crossfade. A left swipe on step 4 and a right swipe on step 1 do nothing. The buttons remain the accessible path. |
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

- **Default:** steps 1–4 as in the tables, the step 1–3 button the brass secondary.
- **Final step:** the button becomes the brass primary. The kit cross-fades fill (`color.raised` #1E1915 → `color.accent` #C89D54) and label (`color.text` → `color.onAccent`) over `ref.motion.control` (120 ms ease-out); the secondary's 1 pt brass edge drops at the switch, and the label text swaps from "Next" to "Open the camera" at its start. The slot already reserves the longer label's height, so nothing above moves. Going back from step 4 reverses it.
- **Pressed:** the pill changes colour over 120 ms ease-out with no opacity or scale: secondary fill to `color.surface` #14110E, primary fill to `color.accentPressed` #DFB66C (onAccent 9.7:1). Close takes the live IconButton's pressed state: opacity 0.75.
- **Focus:** the kit's ring (`ref.focus`: 2 pt #F2F2F2, 2 pt offset) on Close (a 56 circle; composed into the live IconButton in CloseButton.tsx, which draws none of its own) and on the pill (following the pill). Never removed while focused.
- **Transition:** the drawing, plate label, stamp, title and body crossfade over `motion.sceneCrossfade` 200 ms, with no drift and no counter roll. The mount, its walnut and canvas, Close and the button stay still. Brackets appear with their drawing and don't settle or scale.
- **Reduced motion** (`useTheme().reducedMotion`): the crossfade becomes `motion.reducedFade` 140 ms opacity. The button's colour change stays at 120 ms (a colour change, not movement). Nothing else animates.
- **Disabled:** none. Close and the button are always enabled; taps during a transition are ignored rather than shown as disabled.
- **Loading:** none in first-run mode (the opener owns `openCapture()`'s wait, and all art is bundled SVG, drawn on the first frame). Replay has one real wait (below).
- **Replay wait:** on tap, "Open the camera" keeps its brass fill and label, ignores further taps and sets `accessibilityState={{ busy: true, disabled: true }}` (focus stays). If the check runs past 1 s (`ref.layout.guide.thinkingDelay` 1000), one line appears in the status slot: `ThinkingStates tone="warm"`, "Checking the file", no rotation, live `type.caption` (Plus Jakarta Sans Medium 13/18), centred on x 196.5, line box y 724–742, shimmer `ref.motion.thinking.shimmerWarm` (base `color.textSecondary`, highlight `color.text`, band 0.8, 2000 ms linear), accessibilityLabel "Checking access", announced on mount. It unmounts the moment the check returns or navigates. Reduced motion: the still line in `color.textSecondary`.
- **Replay error:** same slot, y 724–742. Phosphor `Warning` 16 (`ref.layout.guide.errorIcon`) in `color.warning` #D4883A (5.3:1; the error red is 2.3:1 on dark, so it is never used here) at x 20, centred on the first caption line and hidden from screen readers; then 8 (`space.sm`); then "Couldn't reach the darkroom. Try again." in `type.caption`, `tone="secondary"` (≈ 265 wide, one line in the 329 left). The row is a polite live region (announced on iOS) but not an accessibility element, so focus stays Close → button. The button returns to idle and stays live; a retry clears the line and re-enters Replay wait. Leaving step 4 (back or swipe) drops a running check.
- **Error:** storage errors are silent. A failed read shows the guide once per session; a failed write shows it again on the next launch. Neither can loop: Close and "Open the camera" set the session flag before leaving, and /capture checks it first. No network calls in first-run mode.
- **Permission denied:** not handled here; 03 handles the camera after the guide. The advice also applies to "Choose photos instead".
- **Large text:** text honours system scaling and never shrinks. Close (48) stays pinned; the stamp's first line stays centred on it and a wrap grows downward (two lines still fit the 48 row). The title, body and pill grow upward from 814: the pill first (minimum 52; the label may wrap within padX 24), then the title and body rise. The band between the top bar and the title gives way in order: the 56 under the mount down to `space.xl` 24, then the 67 above it down to 24, then the plate shrinks evenly (the drawing scales with it, so strokes thin in proportion), keeping 24 clear above and below. The plate label stays at text size and wraps within the plate width; its measured height comes out of the plate. Below a 160 high plate (`ref.layout.guide.plate.minHeight`: scale 0.45, art box ≈ 109 × 121) the whole mount hides. If the block still doesn't fit, the title and body scroll while the button stays pinned (scrolling is enabled only on overflow, so at rest it is no focus stop).
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
6. **Buttons:** steps 1–3 "Next" are `PillButton scheme="brass" variant="secondary"` (walnut, brass edge); step 4 "Open the camera" is `variant="primary"` (brass), the screen's one "go". No oxblood anywhere.
7. **Close control:** the live IconButton (48, transparent, X in `color.text`), as the light table and `/play`, on the right; a 48 spacer on the left keeps the stamp centred.
8. **Illustrations:** four warm line scenes (`ref.layout.guide.line`), each on a film-plate mount: walnut `radius.mount` 30 with a brass hairline around a 3:4 canvas plate at `radius.image` 24 with a rim, and a brass plate label. The light pool is gone. Hero in `color.text`, mid in `color.textSecondary`, back and context in `color.textSecondary` at 0.7 and 0.3, brackets brass.
9. **Plate label:** "ESCAPD 400  ·  STEP I" to "STEP IV", after SceneView's "ESCAPD 400  ·  PLATE I". "STEP", not "PLATE", because step 4 is a rule, not a plate, and plates I–IV already name the photos.
10. **Paywall timing:** access is checked before the guide, in `openCapture()`, so a player without access never sees it on first run (see Entry rule).
11. **Ground, type, gutter, bottom inset:** `color.canvas` + silk + grain; Playfair `narrativeTitle` for the title, Jakarta `body` for the instruction, JetBrains Mono `stamp` for labels; gutter `space.gutter` 20; bottom = safe 34 + `space.xs` 4, the same as Pro.
12. **Errors on dark:** the warning icon in `color.warning` with the message in `color.textSecondary`, never error-red text.

### Needs you

1. **Back and context line tones.** The live palette has no warm grey dimmer than `color.textSecondary`, so back and context lines are `textSecondary` at stroke opacity 0.7 and 0.3. Where two translucent strokes meet (the room corner in step 1, the notebook spine in step 3, the overlapping wedges in step 2) the overlap reads slightly brighter. Accept it, or add an opaque live tone (for example a `textTertiary` #786F63, which is `textSecondary` at 0.7 over the canvas) and the drawings switch to it?
2. **Focus ring colour.** The guide uses the kit's ring, `ref.focus` #F2F2F2 (Noir white), on Close and on the pill. A brass or bone ring would suit this look better; it is a kit change, not a guide one.
3. **Close's pressed state** is the live IconButton's 0.75 opacity (the play screen's pattern), while the pill presses with a colour change. Keep the two, or give the live IconButton a colour press?

## 05 · Pro (test paywall)

Reference: none (no screenshot exists). The look is the play screen's: the light table's top bar and manila slip (app/capture/review.tsx), the case-closed dossier's Playfair title (app/tutorial/complete.tsx), and the kit's brass pills. 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a live token from `src/theme/tokens.ts` (`color`, `type`, `space`, `radius`, `curve`, `hit`), plus `ref.background` (the silk), `ref.button.brass` (through `PillButton scheme="brass"`), the kit's focus ring and control timing, and the screen's own `ref.layout.pro` (`spinnerDelay` 300, `noticeIcon` 18). No Geist, no NoirText, no `ref.type`, no light pool.

Route: `app/pro.tsx` (`/pro`, optional `?cap=<n>`), re-exporting `src/screens/pro/ProScreen.tsx`. `openCapture()` (section 04, Entry rule) pushes it, or replaces with it, when the player has an email account but no `custom_rooms` entitlement. It sits in the root Stack with the same fade as every route; the iOS edge swipe stays on.

Files: `ProScreen.tsx` (layout, Loading indicator, fade), `BenefitSlip.tsx` (the manila slip), `ProNoticeLine.tsx` (error and info lines), `useProFlow.ts` (states, routing, test purchase), `useFocusOnOpen.ts`, `useOverflowScroll.ts`, `copy.ts` (every word). Tests: `src/screens/pro/__tests__/pro-test.tsx`.

### Feel

A case-file cover from the darkroom dossier. A brass mono stamp at the top names the file, then a long stretch of silk and grain. Low on the page sit one Playfair statement and a manila slip, typed in carbon ink, listing what Pro does. Below them come one brass pill (the screen's only "go") and a quiet way out. There is no art, mount, price, countdown, badge, oxblood or decorative motion: the cover says what the player gets and steps aside. In test builds a small mono stamp says plainly that the purchase is a test.

**Accent on this screen:** brass only. "Unlock Pro" (test builds) and "Check again" (test purchases off) are both `PillButton scheme="brass" variant="primary"`: fill `color.accent` #C89D54, label `color.onAccent` #171411 (7.3:1). Never `variant="signal"`.

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
| Test stamp | Centred on x 196.5, line box 684–698 (14). ≈ 100 wide, x ≈ 146–247 | `stamp`, `tone="secondary"` `color.textSecondary` (5.6:1). Not a control. `accessible={false}` and hidden: its words are the pill's hint | `TEST PURCHASE` |
| Gap | 698–710 (12, `space.md`) | — | — |
| Unlock Pro | x 20–373 (353 × 52), y 710–762. Label centred, ≈ 83 wide. With larger text it grows upward; its bottom stays at 762 | `PillButton scheme="brass" variant="primary" spinner`: pill `ref.radius.pill` with `...curve`, fill `color.accent` (`ref.button.brass.primary`), no border or shadow. Label `type.control` (Plus Jakarta Sans SemiBold 15/20) in `color.onAccent` (7.3:1). Padding 16 vertical, 44 each side (room for the in-button indicator) | "Unlock Pro" |
| Gap | 762–770 (8, `space.sm`) | — | — |
| Not now | y 770–814 (44, the kit's quiet height), label + 16 each side ≈ 90 wide, centred (x ≈ 152–242) | `PillButton scheme="brass" variant="quiet"`: no fill or border. Label `type.control` in `color.textSecondary` (`ref.button.brass.quiet`), pressed `color.text` | "Not now" |
| Bottom | 814–852 (38) = safe bottom 34 + `space.xs` 4 | Silk | — |

Check: 59 + 48 + 292 + 76 + 24 + 127 + 32 + 18 + 8 + 14 + 12 + 52 + 8 + 44 + 38 = 852.

**Gutters.** `space.gutter` 20 on both sides for the top bar, statement, slip, notice and pill (the light table's and the case-closed screen's gutter). The test stamp and Not now are centred on x 196.5.

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

Screen-reader order: file stamp → statement (header) → slip heading → 01 → 02 → 03 → notice (when set) → "Unlock Pro" (or "Check again") → "Not now". Each slip line is one element labelled by its sentence (`accessible` on iOS, `screenReaderFocusable` on Android so it is never a keyboard stop); the numerals and the test stamp are hidden. Keyboard and switch focus: the pill → "Not now" (the statement-and-slip ScrollView is scrollable, and so a keyboard stop on Android, only while it overflows). When the screen opens, accessibility focus moves to the statement once the opening transition has ended (at once for a root route).

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| "Unlock Pro" (test build) | 353 × 52 (taller with large text), the whole capsule | Purchasing (States). a11y label "Unlock Pro", hint "Test purchase. Nothing is charged." Ignored while busy. |
| "Check again" (test purchases off) | 353 × 52, the same slot | Re-runs `ensureSession()` + `getMyAccess()` with the in-button indicator. Entitled → Already has access. Not entitled → stays, refreshes line 03's cap and announces "No access on this account yet." It is how a tester continues after access is granted by hand (scripts/grant-test-access.sql). |
| "Not now" | ≈ 90 × 44 | `router.back()`, or `router.replace('/')` (the 01 hub) with no history. Changes nothing. Disabled (0.4) during Purchasing and Check again. |
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
- **Purchasing** (after "Unlock Pro"): the in-button pattern, not a Thinking state (one call plus one RPC, nothing true to rotate).
  - The label stays centred. The kit's `ActivityIndicator` (small, 20 × 20) in the label colour `color.onAccent` sits at x 337–357, y 726–746 (right edge 16 in from the pill's end, vertically centred).
  - The pill keeps its `color.accent` fill at full opacity, ignores taps and sets `accessibilityState={{ busy: true, disabled: true }}`.
  - "Not now" drops to 0.4 and is disabled; system back stays live. Any notice clears.
  - Calls: `currentSession()` (stored, no network; a guest routes as Guest without calling the function), then `grantTestEntitlement()`, then `getMyAccess()`.
- **Success:** `getMyAccess()` reports `has_custom_rooms_entitlement`. `useFeedback().success()` (develop's haptic) and `announceForAccessibility("Pro unlocked.")`, then `openCapture({ replace: true })`: the guide first time, else the camera, or develop's cap state if the allowance is used. /pro leaves the stack, so back returns to the hub. No success screen, stamp or celebration. Loop guard: /pro calls `openCapture` only after it has seen the entitlement itself; a 200 without it is the generic error.
- **Error:** in the notice slot (y 658–676), one line: glyph in `color.warning`, text `caption` in `tone="secondary"`. It fades in over `controlTiming` (opacity) and is announced: on iOS by `announceForAccessibility`, on Android by the always-mounted polite live region on the slot (the line itself is `accessibilityLiveRegion="none"`, because Android speaks only changes inside an existing live region). The pill returns to idle for a retry, "Not now" to full opacity; a retry clears the notice. `color.error` is not used on this screen (2.3:1 on the silk).

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
  - The pill slot holds "Check again", `PillButton scheme="brass" variant="primary" spinner`; its in-button indicator is `color.onAccent`.
  - A failed check puts its error line (glyph + text) in the info line's place, inside an always-mounted polite live region that holds only errors; the info line returns, outside the region (so it is not re-announced), on the next check. Nothing above moves.
- **Pressed:** colour only, over `ref.motion.control` 120 ms ease-out (the kit). Brass primary fill `color.accent` → `color.accentPressed` #DFB66C (label 9.7:1); quiet label `color.textSecondary` → `color.text`. No opacity or scale.
- **Focus:** the kit's ring (2 pt, offset 2, following the pill). ≈ 361 × 60 around the pill (x 16–377, y 706–766), ≈ 98 × 52 around "Not now".
- **Disabled:** only "Not now", during Purchasing and Check again (`ref.button.disabledOpacity` 0.4, the kit).
- **Reduced motion** (`useTheme().reducedMotion`): nothing on this screen moves in any mode. The fades (Default, error lines) are opacity-only and stay. The native indicators keep the platform's behaviour.
- **Large text:** all text honours system scaling and never shrinks.
  - The top bar grows: the stamp wraps inside its 257 column.
  - The bottom-anchored block grows upward into the void, keeping ≥ 24 above the statement. Slip lines grow with their text (a sentence may wrap); numerals stay centred on the first line.
  - The pill grows upward from 762; its label may wrap inside the 44 side padding. "Not now" stays 44 until its own label line passes 44.
  - If the block still doesn't fit, the statement and slip scroll (and only then become a keyboard stop) while the notice, test stamp, pill and "Not now" stay pinned.
- **Narrow screen:** gutters stay 20, so the column is width − 40 (335 at 375, 320 at 360), the slip's inner box column − 32 (303 / 288) and the sentences inner − 24 (279 / 264). The longest line (fallback, ≈ 254) fits at 360; a wrapped line grows its row by 23 and the block rises.

### Decisions

1. **Look:** the play screen's dossier look (user decision): brass stamp, Playfair statement, manila slip, brass pills, over canvas + silk + Grain. Noir's Geist type, dither, ruled index and oxblood signal are gone.
2. **Route and trigger:** `/pro`, pushed or replaced by `openCapture()` with `?cap=<generations_cap>`, only for a missing `custom_rooms` entitlement. Guests go to `/account` first; a reached cap is develop's message.
3. **Top bar without a control:** the light table's bar geometry (48 row, stamp centred between 48 spacers) with no back or close button. "Not now", Android back and the edge swipe are the exits.
4. **Benefits on manila:** three lines on the light table's slip, numerals as hidden ink stamps, sentences in `body` ink (16/23, larger than the light table's `caption` lines, since these are the screen's content). New heading "WHAT PRO OPENS".
5. **Brass, never signal:** both actions are the brass primary; "Not now" is the brass quiet.
6. **Notices on dark:** a `color.warning` glyph plus `caption` text in secondary for every error. No error-coloured text or glyph on the dark ground.
7. **Loading:** the live short-wait pattern, a small `ActivityIndicator` in `color.accent` after 300 ms, on the same ground as Default, so only the content fades in.
8. **Test purchase:** stub today (always "Test purchases are off on this server."); the planned `grant-test-entitlement` function as in Test purchase. Offered only when `EXPO_PUBLIC_TEST_PURCHASES=1`.
9. **Purchasing feedback:** the in-button native indicator, not a Thinking state.
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
| Palette, fonts, button shape | **Hub, guide, Pro (since 2026-10-25):** the play screen's look (brass, Playfair titles, film-plate mounts, mono plate labels) with the silk background and brass pill buttons. **Camera, permission:** Noir (near-black ground, Geist / Geist Mono, white primary pills, one oxblood signal) |
| Where game mode lives | It **is** the hub at `/` and replaces today's title screen (you confirmed) |
| Getting to the camera | One helper, `openCapture()`, checks access first. Guest → `/account?next=back`. No Pro → `/pro`. Monthly limit reached → the darkroom's existing limit message. Access → the photo guide the first time, otherwise the camera. If the check can't run, the hub carries on to the camera (the darkroom checks again before anything is sent) |
| Where red appears | Only on the Noir screens: 02, the ring on the last-photo thumbnail from 3 plates; 03, none. The hub, guide and Pro use brass instead (SOLVED stamp, "Open the camera", "Unlock Pro") |
| Loading | A real wait with something true to say: Thinking states (warm tone on the hub, guide and Pro). A short wait: the dither on Noir screens, a small brass ActivityIndicator on the others. A button's own action: a small spinner with the label kept. Countable progress: a thin bar with a mono count |
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
- **02 · Camera:**
  - Flip camera is replaced by a framing-grid toggle.
  - 0.5× wherever the phone has an ultra-wide lens (default 1×).
  - Flash: off or on.
  - Roman-numeral plate counter in Geist Mono, showing the plate about to be taken.
  - White viewfinder brackets.
  - Library picker at the top right.
  - Privacy note until plate I.
  - The white shutter carries the magnifier icon.
  - The bottom row is centred on one line.
  - Plate V detail: "Optional. Anything still unseen."
- **03 · Camera permission:**
  - A dark graphite sheet, with soft light on a grayscale illustration.
  - Sentence case; title "Let ESCAPD use the camera".
  - New copy for when the camera is off.
  - Body text in Geist 17/24.
  - No white flash for players who already allowed the camera.
- **04 · Photo guide** (the play screen's look):
  - Four steps under the brass stamp "BEFORE YOU SHOOT · n OF 4".
  - Each drawing sits on a walnut film-plate mount labelled "ESCAPD 400 · STEP I" to "STEP IV"; warm line art with brass brackets. No light pool.
  - "Next" is the walnut pill; "Open the camera" the brass pill.
  - Swiping also moves between steps.
  - X skips to the camera and marks the guide seen; on a replay, X returns to the hub.
  - The seen flag is stored on the device. Replay lives in How you play.
- **05 · Pro** (the play screen's look):
  - A case-file cover: brass stamp "CASE FILE · ESCAPD PRO", the statement in Playfair, the three benefits on a manila slip headed "WHAT PRO OPENS".
  - Brass "Unlock Pro" calls the test grant, which is still a stub (Supabase work was out of scope), then carries on to the guide or camera.
  - When test purchases are off, it says plainly that Pro isn't on sale yet and offers "Check again".

## Needs you

1. **The camera and permission screens** still use Noir (white pills, Geist, oxblood ring), between a brass photo guide and a brass light table. Restyle them to the play screen's look too?
2. **Button shape on `/play` and the light table:** they still use the original 8 pt-radius buttons, while the hub, guide and Pro use pills (you asked to keep Noir's pills there). Bring `/play` and the light table onto pills, or keep the two shapes?

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
