# ESCAPD design spec: Noir

This is ESCAPD's decided visual identity, **Noir**, applied to five screens: game mode (the new hub), camera, camera permission, the first-time photo guide, and the test paywall.

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
- Nothing is built yet.
- The Noir tokens are in `src/theme/tokens.ts` as the `ref` export. Nothing in the app reads them yet, and the live theme above them is unchanged.
- Geist and Geist Mono still need installing (`@expo-google-fonts/geist`, `@expo-google-fonts/geist-mono`) and loading in `app/_layout.tsx` when the build starts.

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

| Token | Radius | Stops (offset: colour) | Resulting grey on ground | Used on |
|---|---|---|---|---|
| `ref.light.hero` | 220 | 0: rgba(242, 242, 242, 0.10) · 0.5: rgba(242, 242, 242, 0.04) · 1: rgba(242, 242, 242, 0) | #1D1D1D at the centre, #0E0E0E at half radius | 01, behind the card fan |
| `ref.light.object` | 120 | 0: rgba(242, 242, 242, 0.07) · 0.5: rgba(242, 242, 242, 0.025) · 1: rgba(242, 242, 242, 0) | #161616 at the centre, #0B0B0B at half radius | 01, under the magnifying glass (centre set in 01); 03, on the illustration; 04, behind each step's illustration |

- **Build.** Use one react-native-svg `<Svg>`, absolutely positioned under the content with `pointerEvents="none"`. Inside it, a `<Rect>` is filled with a `<RadialGradient>`: `gradientUnits="userSpaceOnUse"`, `cx`/`cy` at the screen's centre point and `r` = the token's radius, using the token's stops.
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

## 01 · Game mode selection

Reference: docs/refs/01-game-mode.png (layout only)

*Geometry measured from the reference at 2.389 px/pt (939 px ÷ 393 pt) and kept wherever Noir allows. 393 × 852 pt, safe areas 59 top / 34 bottom, all values in pt. Every style is a Noir `ref.*` token from `src/theme/tokens.ts`. Live `motion.*` is cited only for the sheet rise and the reduced-motion fade. Geist and Geist Mono are not installed yet (`@expo-google-fonts/geist`, `@expo-google-fonts/geist-mono`). Playfair does not appear on this screen. This screen is the hub at `/`.*

### Feel (Noir)

Three case files dealt on a dark desk under a lamp, with a brass reading glass laid above them. The ground is the black silk background still (`ref.background.asset`, peak #262626) over `ref.color.ground` #050505. A static pool of soft white light (`ref.light.hero`) sits behind the lower half of the fan and spills onto the desk below it, so the opaque graphite files read as dark shapes outlined by 1 pt hairlines against lit ground. A smaller pool (`ref.light.object`) lights the glass from behind and shows through its lens. There is one bright statement ("Choose a case") and one grey reading line, both on the silk, outside both pools. Each file carries a mono tab label, a mono status note and a fine grayscale line drawing. Until the player has solved their own case, the only colour is the painted brass of the glass, a temporary exception to grayscale brand art (a Noir render of it is a later experiment). After that, a single oxblood SOLVED stamp sits in the corner of that file. Nothing moves unless something is happening: a control changes colour when pressed, the How you play sheet rises, a small native indicator turns on a card while it opens, and a Thinking-state shimmer (`ref.motion.thinking.shimmer`) crosses DEVELOPING while the player's room is being built. The glass is the one exception. Press and drag it and it leans toward the finger, with a glint across its lens. Let go and it settles flat. It is the screen's only decorative motion, and it never moves on its own. The voice is terse, procedural and case-file.

### Layout, top to bottom

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Status bar | y 0–59 (safe top 59) | System, light content | — |
| Ground | Full screen | `ref.color.ground` #050505 under the background still `ref.background.asset` (black silk warp, peak `ref.background.peak` #262626), full screen, `contentFit="cover"` (Global tokens, Backgrounds). The only gradients drawn in the app are the two light pools, which sit on the still | — |
| Light pool, glass | Centre (211.1, 188), radius 120 (`ref.light.object.radius`). Drawn only in the band between the divider and the title: a `Rect` x 0–393, y 124–308, which it lights across x 91.1–331.1 | `ref.light.object`: rgba(242,242,242,0.07) at 0 → rgba(242,242,242,0.025) at 0.5 → rgba(242,242,242,0) at 1. Static: it does not tilt with the glass. A second react-native-svg `RadialGradient` (userSpaceOnUse) in the same full-screen Svg as the fan pool, under all content, `pointerEvents="none"`. **Centre rule:** x = the lens centre (glass box left + 78.6); y = the lens centre (194.4 here), raised to title top − 120 whenever the lens centre sits below that line, so the pool ends exactly at the title's top edge: y 188 on this screen, 6.4 above the lens centre. Neither pool reaches the title or subtitle: this one stops at y 308, and the fan pool starts at y 364. The core (≈#161616) sits behind the lens, whose painted glass is partly transparent (alpha ≈ 0.6, range 0.50–0.96), so the light shows through it. The handle tip, 109.9 from the centre, runs out to the pool's edge. At the divider the band's top edge is ≈#0B0B0B against #050505 above it, and the 1 pt #222222 hairline hides the step, so the header stays flat. Dropped with the glass (States) | — |
| Light pool, fan | Centre (196.5, 584), radius 220 (`ref.light.hero.radius`): reaches y 364–804; the screen clips its sides | `ref.light.hero`: rgba(242,242,242,0.10) at 0 → rgba(242,242,242,0.04) at 0.5 → rgba(242,242,242,0) at 1. Static. Built as a react-native-svg `RadialGradient` (userSpaceOnUse) on a full-screen `Rect` under all content, `pointerEvents="none"`. **Centre rule:** x on the fan's axis, y = subtitle bottom + 220, so the pool ends exactly at the subtitle's bottom edge and the title and subtitle stay on flat ground. The opaque cards hide its core. It shows as lit floor beside and below the fan: ≈#181818 at y 620, back to ground by y 804. If stepping shows on an OLED panel, add the existing `Grain` at 4 % over the ground only (never over panels) | — |
| Header, left slot | x 16–60, y 67–111 (44 × 44) | Empty spacer, not focusable. Today's title screen has no account entry | — |
| Header mark | Centred on x 196.5; 66.3 × 14 at x 163.4–229.6, y 82–96 (centre y 89, level with the right button) | `Wordmark` at height 14 (stroke 8/60 × 14 = 1.9), tint `ref.color.bright` #F2F2F2. The D's lit edge is hard-coded to the live theme today; set it to `ref.color.bright` too (Wordmark needs an edge-colour prop). `accessibilityRole="image"`, label "ESCAPD" | ESCAPD wordmark |
| Header, right button | x 333–377, y 67–111, centre (355, 89): safe top + 8 (`ref.space.sm`), `ref.space.lg` 16 from the right edge | `ref.button.icon`: 44 round (`ref.radius.pill` 999), fill `ref.color.panel` #0E0E0E, 1 pt `ref.color.hairline` #222222, glyph `ref.color.bright` #F2F2F2 | Phosphor `Question` regular at `ref.icon.header` 20 in `ref.color.bright` (export `QuestionIcon` from icons.ts, `phosphor-react-native/src/icons/Question`): a help mark for How you play, not a settings glyph |
| Divider | y 123, 1 pt (`ref.border.hairline`), x 16–377; `ref.space.md` 12 below the buttons | Flat `ref.color.hairline` #222222, no fade | — |
| Glass spacer, top | y 124–152 (28); flex 7 | Ground and the glass pool | — |
| Magnifying glass | Box 128 × 128 at x 132.5–260.5, y 152–280, centred on x 196.5 (centre y 216). The PNG has transparent margins, so the painted ink is 104.4 × 118.8 at x 144.4–248.8, y 156.6–275.4. That is 0.093–0.908 of the box width and 0.036–0.964 of its height, and leaves 32.6 clear below the divider and 32.6 clear above the title's line box. **Lens** (the glass inside the brass rim, measured on the 1024 master: centre (629, 339) px, radius 258 px, fit residual ≤ 3 px): centre (0.614, 0.331) of the box, radius 0.252 of the box side. In pt that is (78.6, 42.4) r 32.3 box-local, (211.1, 194.4) on screen, spanning x 178.8–243.4, y 162.1–226.7. The brass rim's outer radius is 0.292 (37.4). The handle runs to the lower left. At full tilt in any direction, the projected ink stays inside its 128 box: at most 60.6 from the box centre on either axis, against a half-box of 64 | `assets/brand/magnifier-1024.png`, unchanged, in an expo-image `Image` at 128 × 128, `contentFit="contain"`. The 96 pt set (96 / 192 / 288 px) is too small: 128 pt at @3x needs 384 px. expo-image downsamples the master to the display size (`allowDownscaling`, default true). Full colour, unfiltered: the painted brass is the one temporary exception to grayscale brand art (decisions.md, user answer 1). It is not a signal. No shadow, no halo, no outline; its light is the glass pool. Two layers: a non-transforming outer wrapper View (the drag surface, see Tappable) and, inside it, a 128 × 128 `Animated.View` that tilts (`ref.motion.tilt`), holding the image and, above it, a 128 × 128 react-native-svg glare layer clipped to the lens circle. Hidden from accessibility: `accessible={false}`, `accessibilityElementsHidden`, `importantForAccessibility="no-hide-descendants"` | The brass reading glass (decorative) |
| Glass spacer, bottom | y 280–308 (28); flex 7 | Ground and the glass pool, which ends at y 308 | — |
| Title | Line box y 308–336, centred, ≈140 wide | `ref.type.title` (Geist Regular 22/28, −0.45), `ref.color.bright` #F2F2F2, `accessibilityRole="header"` | **"Choose a case"** |
| Subtitle | Line box y 340–364, `ref.space.xs` 4 below the title | `ref.type.body` (Geist Regular 17/24), `ref.color.read` #A6A9AD. Fixed line. It does not change with any setting | **"Three files on the desk."** |
| Fan container | y 392–618 (226), `ref.space.band` 28 below the subtitle | — | 3 cards. Visual extent x 20.5–372.5, y 392–616.2 |
| Card, centre | x 135.5–257.5, y 392–601, 122 × 209, 0°, top of the stack (`zIndex`) | `ref.gameCard` (122 × 209, radius 6) in `ref.panel` | **YOUR ROOM** |
| Card, left | Centre (91.5, 506.5); unrotated box x 30.5–152.5, y 402–611 (10 lower than the centre card); `rotate: -6deg` (`ref.gameCard.fanTilt` 6) about its centre; under the centre card. Visual left edge x 20.5 (the radius 6 top-left corner) | Same | **THE STUDY** |
| Card, right | Centre (301.5, 506.5); unrotated box x 240.5–362.5, y 402–611; `rotate: 6deg`; mirror of the left card; visual right edge x 372.5 | Same | **YOUR CASE** |
| Card material | Each card | `ref.panel`: fill `ref.color.panel` #0E0E0E, 1 pt `ref.color.hairline` #222222 on all four sides, radius `ref.radius.panel` 6. Opaque: the centre card's hairline is what separates it from the side cards beneath. No shadow, no gradient, no translucency | — |
| Tag (in card) | Card-local line box y 16–32 (`ref.gameCard.tagInset` 16), centred. All three tags are 9 glyphs × (7.2 + 1.2) = **75.6** wide, so 23.2 from each card edge | `ref.type.label` (Geist Mono Medium 12/16, +1.2, uppercase), `ref.color.meta` #8A8D91. Plain text, no outline | THE STUDY · YOUR ROOM · YOUR CASE |
| State note (in card) | Card-local line box y 38–56 (6 below the tag), centred, max width 90 (122 − 2 × 16), one line. Width = glyphs × (7.8 + 0.6) = 8.4 per glyph | `ref.type.note` (Geist Mono Regular 13/18, +0.6, uppercase), `ref.color.read` #A6A9AD | Study: UNSEAL 50.4 / CONTINUE 67.2 / REPLAY 50.4. Room: PHOTOGRAPH 84.0 (the longest). Case: OPEN 33.6 / CONTINUE 67.2 / REPLAY 50.4 / DEVELOPING 84.0 / SEE WHY 58.8 / NONE YET 67.2 / OFFLINE 58.8 / TRY LATER 75.6. Busy keeps the note (States) |
| Line art (in card) | 48 × 48, centred, centre at card-local y 113 (89–137, 54 % of the height, as in the reference) | react-native-svg line drawing in `ref.illustration`: stroke 1.6, round caps and joins, no fill. Primary lines `ref.illustration.hero` #F2F2F2, secondary lines `ref.illustration.mid` #A6A9AD. Static, no gradient, no halo. Rotates with its card | Study: arched door (primary) with a keyhole (secondary). Room: four viewfinder corner brackets (primary) around a room corner drawn as one vertical and two diverging floor lines (secondary). Case: case folder with a tab (primary) and a seal circle (secondary). All three still need drawing |
| SOLVED stamp (YOUR CASE only) | Card-local x 40–106, y 169–193 (right and bottom insets 16); 66 × 24; screen centre ≈(305.4, 583.8) | `ref.stamp`: height 24, padX 8, radius 6, fill `ref.color.signal` #C8302B; label `ref.type.label` in `ref.color.bright` #F2F2F2 (4.8:1). Upright on its card, so it carries the card's +6°. Static, appears without animation | **SOLVED**. Shown only when the latest session on the player's newest own case is completed |
| Lower spacer | y 618–818 (200); flex 50 | Ground and the fan pool | The error notice overlays this space (States) |
| Error notice (when shown) | x 20–373 (353 wide, `ref.space.edge` 20 sides), top y 642 (`ref.space.xl` 24 below the fan container). 50 tall for one line, 74 for two (bottom ≤ 716) | `ref.panel` (#0E0E0E, 1 pt #222222, radius 6), padding 12 vertical × 16 horizontal. Icon `ref.icon.small` 16 in `ref.color.error` #B5564F, top-aligned to the first line, then 8 gap, then text `ref.type.body` in `ref.color.read`. Positioned absolutely, so the layout never shifts | See States |
| Safe bottom | y 818–852 | — | — |
| **How you play sheet** (over everything) | Scrim full screen. Sheet x 0–393, y 591–852 (261 tall) | Scrim `ref.color.scrim` rgba(5,5,5,0.72). Sheet `ref.panel` fill #0E0E0E, 1 pt `ref.color.hairline` #222222 top edge, top corners radius 6, bottom running off the screen, no handle. Rises with `motion.sheetSpring` (damping 28, stiffness 320, mass 1) and leaves with the live Sheet's 200 ms slide. The scrim fades over `ref.motion.control` 120 ms | — |
| Sheet: header row | y 603–647 (sheet top + 12) | Title at x 20, line box y 611–639: `ref.type.title`, `ref.color.bright`, `accessibilityRole="header"`. Close at x 329–373 (centre x 351, 20 from the right edge, on the sheet's content inset): `ref.button.icon` (44 round), X glyph at `ref.icon.header` 20 in `ref.color.bright` | **"How you play"** · Phosphor `X` |
| Sheet: Show interactives row | y 663–725 (16 below the header) | Text column x 20–245 (225): label `ref.type.headline` (Geist Medium 17/22) in `ref.color.bright`, y 663–685; 4 gap; description `ref.type.meta` (Geist 13/18) in `ref.color.meta`, two lines, y 689–725. Control at x 261–373, y 676–712: `ref.button.segment` 112 × 36, radius 999, fill #0E0E0E, 1 pt #222222. Two 56-wide halves. Thumb `ref.button.segment.thumbFill` #303030, inset 3 (50 × 30, radius 999). Labels `ref.type.label`, active `ref.color.bright`, inactive `ref.color.meta` | **"Show interactives"** / "Keep the marks on objects you can use visible." (the same copy as Case options) · OFF \| ON |
| Sheet: rule | y 737, 1 pt, x 20–373 (12 below the row) | `ref.color.hairline` #222222 | — |
| Sheet: guide button | x 20–373, y 750–802 (12 below the rule), 353 × 52 | `ref.button.secondary`: radius 999, fill #0E0E0E, 1 pt `ref.color.hairline2` #303030 (the border carries it on the same-colour sheet), label `ref.type.button` (Geist Medium 17/22) in `ref.color.bright` | **"How to photograph a room"** |
| Sheet: bottom | y 802–852: `ref.space.lg` 16 + safe bottom 34 | — | — |

**Totals on 852:** status bar and safe top 0–59; header buttons 67–111; divider 123; glass spacer 124–152; glass 152–280; glass spacer 280–308; title 308–336; gap 4; subtitle 340–364; gap 28; fan 392–618; lower spacer 618–818; safe bottom 818–852. A flex column runs between the divider and the safe bottom (124–818, 694 tall). It holds the glass (128) and the hero block (28 + 4 + 24 + 28 + 226 = 310), and splits the remaining 256 among three spacers at weights 7 : 7 : 50: above the glass, between the glass and the title, and below the fan (28 : 28 : 200 on this screen). The glass is centred in the 184 band between the divider and the title, with 28 on each side. Without the glass (States: large text and short screens), the column falls back to two spacers at weights 23 : 25 around the hero block. On this screen that would be 184 : 200, which puts the title and fan exactly where they are with the glass. The sheet runs 591 + 12 + 44 + 16 + 62 + 12 + 1 + 12 + 52 + 16 + 34 = 852.

**Content centres on screen:** Centre card: tag (196.5, 416), note (196.5, 439), line art (196.5, 505). Left card: tag (83.1, 426.4), note (85.5, 449.3), line art (92.4, 515.0). The right card mirrors it: (309.9, 426.4), (307.5, 449.3), (300.6, 515.0).

**Side-card clearance:** The centre card covers each side card's inner strip, 5.8 wide at the top and 27.7 at the bottom (17 unrotated). Measured from the centre card's edge, the clearances are:
- every tag: ≥ 14.1
- the longest side note (DEVELOPING, 84): 7.3
- NONE YET / CONTINUE (67.2): 15.7
- line art: 16.8
- SOLVED stamp: 13.9

The stamp sits at the right inset because a centred stamp would clear by only 1.9.

### Tappable elements

| Element | Hit area ≥ 44 | Action in ESCAPD |
|---|---|---|
| How you play button | 44 + `hitSlop` 2 = 48 × 48 (`ref.hit.comfortable`), x 331–379, y 65–113 | Opens the How you play sheet. a11y: role button, label "How you play" |
| Magnifying glass (a drag surface, not an action) | The outer wrapper, 128 × 128 at x 132.5–260.5, y 152–280, no `hitSlop`. It overlaps nothing tappable: the How you play hit area ends at y 113, 39 above, and the cards start at y 392, 112 below with only the title and subtitle between | **No action:** no tap handler, no navigation, no haptic, no role, not focusable, hidden from screen readers (Layout). Press-and-drag tilts it with `ref.motion.tilt`:<br>• **Gesture:** react-native-gesture-handler `Gesture.Pan().minDistance(0).shouldCancelWhenOutside(false)` on the wrapper, which never transforms, so the tilting image can't slide out from under the finger. `onBegin` (touch-down) and `onUpdate` read the finger as px = x ÷ 128, py = y ÷ 128 in the wrapper, clamped to 0–1, so a drag that leaves the box holds the edge value. The gesture claims only touches that start inside the box, so it never takes a tap from a card or the header.<br>• **Tilt:** rotateY = (px − 0.5) × `ref.motion.tilt.max` 32 and rotateX = (0.5 − py) × 32, in degrees, so ±16°. Transform `[{ perspective: ref.motion.tilt.perspective 1000 }, { rotateX }, { rotateY }]` on the inner view (perspective first, as React Native requires), about the box centre. The side under the finger dips away from the viewer; check the sign on both platforms. Each update re-targets `withTiming(target, { duration: ref.motion.tilt.follow.duration 400, easing: Easing.bezier(0.22, 1, 0.36, 1) })`.<br>• **Glare:** `ref.motion.tilt.glare`, the token's three white radial layers (radius 95 / 200 / 360 with its stops and offsets), centred at the finger (px × 128, py × 128 in the box) inside a react-native-svg `ClipPath` circle at (78.6, 42.4) r 32.3: the glass only, never the brass. Plain white alpha, because React Native has no blend modes. The glare centre follows the finger directly. The group's opacity fades 0 → `glare.opacity` 0.32 over `glare.fade` 300 ms from touch-down. The glare layer is inside the tilting view, so the clip tilts with the lens.<br>• **Release** (`onFinalize`, which also covers a cancel): rotateX and rotateY go to 0 over `ref.motion.tilt.return.duration` 1000 ms with the same bezier, and the glare fades to 0 over 300 ms.<br>• **Off:** the gesture is disabled (`enabled(false)`) while the How you play sheet is open (its scrim covers the glass anyway) and under reduced motion. When the screen loses focus (a card navigates away), the glass is set flat and the glare cleared, with no animation |
| THE STUDY card | Exposed face ≈105 × 209. The centre card takes 5.8–27.7 of its inner side, and touches in the overlap go to the centre card | `ensureSession()` (card busy, see States), then `router.push('/tutorial')`, which resumes through start_or_resume_session. The note comes from `getLatestSession(TUTORIAL_ROOM_ID)`: none or abandoned UNSEAL (as today's title screen), active CONTINUE, completed REPLAY. a11y uses today's labels: "The Study. Unseal the first case." / "…Continue the first case." / "…Replay the first case." A failure shows the error notice |
| YOUR ROOM card | Full 122 × 209 (on top) | **Access check first** (card busy, see States): `openCapture()`, the shared helper in section 04's entry rule (push). It runs `ensureSession()`, then `getMyAccess()`, and routes:<br>• `is_anonymous` (guest) → `/account?next=back`, because the server requires an email account. The account screen returns here and the player taps again.<br>• No `has_custom_rooms_entitlement` → `/pro`, the test paywall (decisions.md, user answer 5; no section yet). After its test purchase, /pro continues with `openCapture({ replace: true })`.<br>• Entitled but `can_generate` false (monthly cap reached) → `/capture/develop?from=hub` with no roomId, which shows develop's existing cap state. Develop still needs this hub-entry param: with it, the cap state's button reads "Back" and calls `router.back()` to the hub directly beneath. Without it, the button is "Back to the title" calling `router.replace('/')`, which would stack a second hub.<br>• Access → `/capture/guide` the first time (`escapd:onboarding:capture-guide` ≠ "1" and no session flag), otherwise `/capture`.<br>• If the check can't run (offline or a server error), `openCapture()` rejects without navigating and the card continues to `/capture`. Its backstop flag check still sends a first-timer to the guide, and `/capture/develop` checks access again before anything is sent.<br>a11y "Your room. Photograph a room." |
| YOUR CASE card | Exposed face ≈105 × 209 | State from `getLatestCustomRoom()` (drafts skipped, see Case status) and, for a ready room, `getLatestSession(room.id)`.<br>• Ready → `/play/<id>`, where start_or_resume_session resumes an active run or starts a fresh one. The note is OPEN (no session, or the latest session abandoned after "Restart this case"), CONTINUE (active) or REPLAY plus the SOLVED stamp (completed).<br>• Queued or generating: DEVELOPING → `/capture/develop?roomId=<id>`.<br>• Failed: SEE WHY → the same route.<br>• No room (or only a draft), or no session: disabled (States).<br>a11y: one element, label "Your case." plus the state from the Case status table, e.g. "Your case. Developing." or "Your case. Solved. Replay the case." The note's SVG text is hidden from accessibility. The label updates when the state changes |
| Sheet scrim | Everything above the sheet (y 0–591) | Closes the sheet. Not focusable |
| Sheet Close | 44 + `hitSlop` 2 = 48 × 48, x 327–375, y 601–649 | Closes the sheet; focus returns to the How you play button. a11y "Close" |
| Show interactives segment | 112 × 36 + `hitSlop` 4 top and bottom = 112 × 44; each half 56 × 44 | Tapping a half sets `hotspotAssist` through `usePreferences().setHotspotAssist`: the same AsyncStorage key, `escapd:pref:hotspot-assist`, that Case options uses. It is one a11y element: role switch, label "Show interactives", `accessibilityState.checked` |
| How to photograph a room | 353 × 52 | Closes the sheet, then pushes the guide in replay mode (`/capture/guide?replay=1`; section 04). Replay never clears the seen flag; closing or finishing it sets the flag (section 04). Its final camera action runs the same `openCapture()` check as YOUR ROOM |
| Android back | — | Sheet open → closes it (returns true). A card busy → consumed (returns true) until navigation or the notice. Otherwise not handled: the system leaves the app, because this is the root |
| Not tappable | — | Wordmark, divider, both light pools, title, subtitle, tags, notes, line art, stamp, notice. Each card is a single button; its children are not separately focusable. The glass takes drags only (its own row) |
| Focus order | — | Screen reader: ESCAPD (image) → How you play → "Choose a case" (header) → subtitle → THE STUDY → YOUR ROOM → YOUR CASE → notice. The glass is skipped by screen readers, keyboard and switch control. Render the cards in that order and stack the centre card with `zIndex`, not render order. Keyboard: How you play → THE STUDY → YOUR ROOM → YOUR CASE. With the sheet open: title → Close → Show interactives → How to photograph a room, trapped (`accessibilityViewIsModal`; on Android, `importantForAccessibility="no-hide-descendants"` on the screen behind). Opening the sheet moves focus to its title |

### States

- **Appear:** The cards don't animate in; the old 380 ms fan-out is removed, because Noir keeps `motion.bracketSettle` for the viewfinder brackets. The glass arrives at rest, flat and without glare. The screen arrives with the root Stack's fade after the splash.
- **Loading (focus fetch):** The screen renders at once with defaults: THE STUDY UNSEAL, YOUR ROOM PHOTOGRAPH. YOUR CASE keeps its 18 pt note line blank and ignores taps until the fetch resolves. It is not dimmed, so nothing flashes. No spinner. For screen readers and switch users it is not silent: `accessibilityState={{ busy: true, disabled: true }}` and label "Your case. Loading." until the fetch resolves, then the resolved label and state (Case status).
  - The fetch runs in `useFocusEffect`, and only if `currentSession()` exists: never create a guest just to label a card. It calls `getLatestSession(TUTORIAL_ROOM_ID)` and `getLatestCustomRoom()` in parallel, then `getLatestSession(room.id)` for a ready room.
  - With no session, YOUR CASE goes straight to NONE YET.
- **Developing (YOUR CASE queued or generating):** The DEVELOPING note is a one-line Thinking state with no rotation, on `ref.motion.thinking.shimmer` (duration 2000, linear, band 0.8, base #8A8D91, highlight #F2F2F2). One word is truthful for both queued and generating (the job reports no sub-stage), and the 90-wide note can't hold the rotating lines, which stay on `/capture/develop`. So there is no swap and no hidden sizer: one fixed 84-wide line.
  - Look: base `ref.color.meta` #8A8D91, highlight `ref.color.bright` #F2F2F2, band 0.8 × 84 = 67.2.
  - Movement: the band's centre runs from x −84 to +168 (−W to 2W, as in the user's CSS: a 400 % background with stops at 40 / 50 / 60 %), left to right, over 2000 ms linear, and repeats while the room develops.
  - Build: one react-native-svg `<Text>` (Geist Mono 13, +0.6, uppercase, 84 × 18) filled by a `<LinearGradient>` (userSpaceOnUse; stops meta / bright / meta at 0 / 0.5 / 1; x1 = c − 33.6, x2 = c + 33.6, pad). Reanimated `useAnimatedProps` drives c; no new dependency. The SVG text is `accessibilityElementsHidden` and `importantForAccessibility="no"`: the card is one a11y element, so the status lives in the card's label, "Your case. Developing." The shimmer is never announced.
  - Refresh: while the line shows and the screen has focus, follow the room with `watchRoom(id)` plus a 5 s poll (as `/capture/develop` does), and stop when the screen loses focus. Ready → OPEN; failed → SEE WHY. The shimmer stops and the note changes colour over `ref.motion.control` 120 ms ease-out.
  - Announce: when `watchRoom` or the poll flips the state to ready or failed, call `AccessibilityInfo.announceForAccessibility`: "Your case is ready." or "Your case didn't develop. Open it to see why." At the same moment the card label becomes the OPEN or SEE WHY label (Case status). Only flips seen while the hub is open announce; the first fetch on focus does not.
- **Pressed:**
  - Card: fill → `ref.color.panelPressed` #161616 and border → `ref.color.hairline2` #303030 over `ref.motion.control` 120 ms ease-out, back on release. Selection haptic on press-in (expo-haptics, only when `haptics_enabled`). No scale, no opacity change.
  - Icon buttons: fill → `ref.button.icon.pressedFill` #161616.
  - Guide button: fill → `ref.button.secondary.pressedFill` #161616.
  - Segment: the thumb fill moves to the new half as a 120 ms colour change, with no slide.
- **Busy (after tapping THE STUDY or YOUR ROOM):** THE STUDY's `ensureSession()` (an anonymous sign-up for a new player) and YOUR ROOM's `openCapture()` (`ensureSession()`, `getMyAccess()`, then the seen-flag read) are network round trips that often pass 1 s on cellular, so the card uses decisions.md's in-button pattern (Loading indicators).
  - Tag and note stay unchanged (UNSEAL / CONTINUE / REPLAY, PHOTOGRAPH). A small native `ActivityIndicator` (20 × 20) in the tag colour `ref.color.meta` #8A8D91 is added, centred on card-local x 61, y 170–190: the stamp band, empty on THE STUDY and YOUR ROOM. It rotates with its card; on THE STUDY it clears the centre card by ≥ 25. Nothing else is replaced.
  - The tapped card stays at full opacity, ignores taps and sets `accessibilityState={{ busy: true, disabled: true }}`. The other two cards and the How you play button go to `ref.button.disabledOpacity` 0.4 and are disabled until navigation or the notice.
- **Disabled (no own case, only a draft, or no session):** The YOUR CASE card is at 0.4 as one layer (`needsOffscreenAlphaCompositing` on Android). Note NONE YET, `accessibilityState.disabled`, hint "Photograph a room first."
- **Case status:**

  | Case status | Note | Stamp | Card a11y label |
  |---|---|---|---|
  | Ready, never played | OPEN | — | "Your case. Open the case." |
  | Ready, latest session abandoned ("Restart this case") | OPEN | — | "Your case. Open the case." |
  | Ready, in progress | CONTINUE | — | "Your case. Continue the case." |
  | Ready, solved | REPLAY | SOLVED | "Your case. Solved. Replay the case." |
  | Queued or generating | DEVELOPING (Thinking-state shimmer) | — | "Your case. Developing." |
  | Failed | SEE WHY (never blames the player) | — | "Your case. It didn't develop. See why." |
  | No room (or a draft, below) | NONE YET | — | "Your case. None yet." + hint "Photograph a room first." |

  - **Drafts:** `rooms.status` also has `draft`: a room `developPlates` created whose upload or generation request never finished (app killed or network dropped mid-send). `getLatestCustomRoom()` returns the newest custom room of any status, so a newer draft would hide an older ready case. The YOUR CASE fetch skips drafts: add `.neq('status', 'draft')` to the custom-room query (build change; the hub is its only caller). A draft that still comes back maps to No room.
  - **Abandoned sessions:** an abandoned latest session maps to OPEN on YOUR CASE and UNSEAL on THE STUDY, as today's title screen does.
- **Error (THE STUDY only):** The notice panel shows "You're offline. Connect to begin." (Phosphor `WifiSlash`) or "Couldn't start the case. Try again in a moment." (Phosphor `Warning`). The icon is in `ref.color.error` #B5564F; the text is `ref.color.read` #A6A9AD. It appears as an opacity change over `ref.motion.control`, is announced (`accessibilityLiveRegion="polite"` plus `announceForAccessibility`), and stays until the next card tap or the next focus. This is today's inline-error pattern; the Toast is not used here. The card returns to idle and the layout does not move.
- **Fetch failure:** YOUR CASE shows OFFLINE (network error) or TRY LATER (other errors) at 0.4, disabled, and refetches on the next focus. THE STUDY and YOUR ROOM stay enabled with their defaults.
- **Focus:** `ref.focus`: a 2 pt `ref.color.bright` outline at a 2 pt offset that follows the control.
  - Cards: drawn in one overlay above the fan, not by the card. The side cards sit under the centre card, so the inner side of their own outline (the 5.8–27.7 strip) would be hidden beneath it. Overlay: an absolutely positioned View with the focused card's box (122 × 209), centre and `rotate`, transparent, `borderRadius` `ref.radius.panel` 6, with RN outline props (RN 0.88, new architecture) `outlineWidth` 2, `outlineOffset` 2, `outlineColor` #F2F2F2 from `ref.focus`. The ring (outer 130 × 217) follows the card's corners with no new radius. `pointerEvents="none"`, `accessible={false}`, `zIndex` above the centre card, shown only while that card has keyboard or switch focus. The cards are not restacked on focus. The fan container must not set `overflow: hidden`.
  - Icon buttons, segment and guide button: radius 999.
  - It shows while the control has keyboard or switch focus (Pressable focus events). VoiceOver and TalkBack draw their own cursor.
- **Permission:** None here. Camera permission is section 03, at `/capture`.
- **Large text / narrow screens:** The fan needs fontScale ≤ 1.0 and width ≥ 375. Its visual width is 352, so the side margin is (width − 352) ÷ 2: 11.5 at 375, 25 at 402, 44 at 440.
  - **Why:** The 84-wide notes (PHOTOGRAPH, DEVELOPING) pass the 90 max width at fontScale 1.07.
  - **When it stacks:** from the first larger text step (iOS 1.12, Android 1.15), or when the screen is under 375 wide.
  - **Stacked cards:** three upright `ref.panel` cards, width = screen − 2 × `ref.space.edge` 20 (353 at 393, 320 at 360), with a 16 gap (`ref.space.lg`). Order: THE STUDY, YOUR ROOM, YOUR CASE.
  - **Inside a stacked card:** padding 16. The tag, then 6, then the note, then the SOLVED stamp 8 below the note, all left-aligned in a text column ≤ 257 wide. The 48 line art is right-aligned at a 16 inset and vertically centred. Height hugs the content, minimum 96. No tilt.
  - **Pool:** The fan pool keeps its centre rule (subtitle bottom + 220) and scrolls with the column. The column scrolls when it overflows.
  - **The glass goes first:** When the cards stack, the glass and its pool are not rendered and nothing takes their place. A drag surface inside a scrolling column would fight the scroll. The glass is an image, so text size never scales it.
  - **Short screens (fanned layout):** The glass is dropped before anything else changes. It needs a column (divider bottom to safe bottom) of at least 658, so that the 7 : 7 : 50 spacers keep ≥ 24 (`ref.space.xl`) above and below it: 128 + 310 + a free share of ≥ 219.4. Below 658, the glass and its pool are not rendered and the column returns to 23 : 25 around the hero block. Examples: 852 has a 694 column (spacers 28); 375 × 812 has 663 (spacers 24.6), so it keeps the glass; 375 × 667 has 582, so it drops the glass. The check reads the window height and safe areas on layout and is never animated.
  - **Title and subtitle:** They wrap; nothing shrinks. The wordmark stays at 14.
  - **Sheet:** Rows wrap. The sheet stops at 64 % of the screen height and scrolls.
- **Reduced motion:**
  - DEVELOPING is a static line in `ref.color.read` #A6A9AD.
  - The sheet fades in and out over `motion.reducedFade` 140 ms instead of rising.
  - The glass is a still image: no tilt, no glare, and the gesture is disabled (`enabled(false)`). It keeps its place and its pool, so nothing shifts. If reduced motion turns on mid-drag, the glass is set flat with no animation.
  - The 120 ms colour changes stay, since they don't move anything.
  - Nothing else on this screen moves, apart from the native busy `ActivityIndicator`, which keeps the platform's behaviour.

### User notes

> "3 cards instead of 2."

Applied. The reference deals two cards: 186.9 × 319.6, ±5°, centres 146.9 apart. ESCAPD deals three into the same horizontal band (visual x 20.5–372.5; the reference spans 19.25–373.75):
- Size: 122 × 209, keeping the reference's 0.584 aspect.
- Placement: the centre card is upright and on top. The side cards are tilted ±6° and sit 10 lower. They overlap by 17.
- Order: left to right reads as a sequence: learn (THE STUDY) → photograph (YOUR ROOM) → play (YOUR CASE). These map one-to-one onto the three things today's title screen offers.

This geometry is designed, not measured. None of the reference's content is used: its header text and emoji, card labels, icons, title, difficulty word, colours and card material are all replaced by ESCAPD's own Noir equivalents.

### Decisions

1. **Route:** The screen is the hub at `/` and replaces today's title screen (confirmed, user answer 4). That screen's stamp, wordmark cartridge, tagline and stacked buttons go; "Photograph another room" is now the YOUR ROOM card.
2. **Subtitle:** A fixed line, "Three files on the desk.", in `ref.type.body` / `ref.color.read`. The assist level lives only in the How you play sheet.
3. **How you play sheet:** Built as a `ref.panel` that rises with `motion.sheetSpring`, top radius 6, over a `ref.color.scrim` scrim. It holds Show interactives (`hotspotAssist`) and How to photograph a room (guide replay).
4. **YOUR CASE with no room:** Disabled at 0.4 with the mono note NONE YET.
5. **Chevron and close disc:** Both removed, because this is the root. Android back leaves the app.
6. **Icon halo:** None. The icons are grayscale `ref.illustration` line art with a static `ref.light.hero` pool behind the fan. The pool sits on the fan's axis at y 584 (subtitle bottom + 220), not at the fan's centre (y ≈505), so it never lies behind the title or subtitle. The glass pool (decision 14) ends at the title's top edge.
7. **Header mark:** The ESCAPD wordmark in `ref.color.bright`. The brass magnifier is not in the header; it is the hero object below the divider (decision 14).
8. **Tag fit:** Plain `ref.type.label` text in `ref.color.meta`, no outline. All three tags are 75.6 wide and clear the centre card by ≥ 14.1.
9. **Palette, type, buttons:** Noir throughout: ground / panel / hairline, Geist and Geist Mono, pill icon buttons.
10. **Card material and radius:** Opaque `ref.panel`, radius 6.
11. **Signal:** The SOLVED stamp on YOUR CASE is the only signal element on this screen, and it appears only after the player solves their own case. There is no `ref.button.signal`, so the screen has zero signal "go" actions (the limit is one). The brass of the glass is not a signal.
12. **Pro check:** YOUR ROOM runs `openCapture()` (section 04) before the guide or camera. Guests go to `/account?next=back`, because the server requires an email account. Players without the `custom_rooms` entitlement go to the test paywall `/pro`. Players at the monthly cap go to develop's existing cap state (`/capture/develop?from=hub`). Players with access go to the photo guide the first time, otherwise the camera.
13. **Guide replay:** It lives in this screen's How you play sheet.
14. **Hero object:** The painted brass magnifying glass (`assets/brand/magnifier-1024.png`, unchanged) sits centred in the band between the divider and the title. Its box is 128 × 128 at y 152–280 (ink ≈ 104 × 119, ≈120 tall), with 28 of box clearance (32.6 to the ink) on each side. The spacers are 7 : 7 : 50, so the title and fan keep their positions. Its brass is the one temporary exception to grayscale brand art (user answer 1). A static `ref.light.object` pool sits on its lens at (211.1, 188), r 120, drawn only within y 124–308, so neither pool lies behind the title or subtitle. The glass and its pool are the first thing dropped when the cards stack or the column is under 658.
15. **Tilt:** The glass leans toward a press-and-drag (`ref.motion.tilt`: ±16°, perspective 1000, follow 400 ms and return 1000 ms on `Easing.bezier(0.22, 1, 0.36, 1)`), tracked on a non-transforming 128 × 128 wrapper. Glare is clipped to the lens: centre (0.614, 0.331), radius 0.252 of the box, which is (78.6, 42.4) r 32.3 in pt (user answer 2). It is decorative: no action, hidden from screen readers, not focusable, and it takes no taps from the cards or header. It is a still image under reduced motion. It is the screen's only decorative motion.

### Needs you

None.

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

## 04 · First-time photo tutorial

Reference: docs/refs/04-photo-tutorial.png (layout only)

Measured at 2.038 px/pt: the image is 801 × 2003 px, and the screen is its top 1735 px (393 × 851.3 pt, a 393 × 852 device with safe areas 59 / 34). The caption strip below y 1735 px is excluded. Bracketed values are the reference's own geometry; the main value is what ESCAPD uses. None of the reference's colours, copy, objects or icons carry over.

New route: `app/capture/guide.tsx` (`/capture/guide`; `?replay=1` when opened from 01's How you play sheet). It is shown once, before the first camera session.

### Feel (Noir)

This is a four-beat briefing, read in an unlit room before the first plate. A small grayscale line drawing sits in one static pool of soft white light in a large near-black field. The words and the single button sit in the bottom third on flat ground. There is no shadow, texture or decorative motion. Hierarchy comes from brightness alone: the hero lines and the title are bright, the context lines and the instruction are grey, and the step count is mono in meta. The screen stays monochrome for three steps. On step 4 the button turns oxblood, like a stamp on the file, as the camera is about to open.

**Signal on this screen:** step 4's "Open the camera" (`ref.button.signal`, fill `ref.color.signal` #C8302B) and nothing else. Steps 1–3 carry no signal. The stamp is meta, and the illustration brackets are bright. So there is at most one signal "go" action, and only on step 4.

### Layout, top to bottom

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | `ref.color.ground` #050505 under the background still `ref.background.asset` (black silk, peak #262626). The illustration pools sit on it, and the text block sits on it outside the pools. Opening the camera (flat ground) is a `motion.sceneCrossfade`. | — |
| Status bar | y 0–59 (safe-area top) | System, light content (already set in the root layout) | — |
| Gap | 59–71 (12) | Ground | — |
| Close | x 315–359, y 71–115 (44 × 44, centre 337, 93). Top = safe top + 12, right inset 34. The measured centre is kept and the size goes from 50 to 44 [ref Ø 50.4 incl. rim, centre (336.0, 93.6)] | `ref.button.icon`: circle `ref.radius.pill` 999, fill `ref.color.panel` #0E0E0E, 1 pt (`ref.border.hairline`) `ref.color.hairline` #222222. No shadow. | Phosphor `X`, regular, `ref.icon.header` 20, `ref.color.bright` #F2F2F2 |
| Step stamp | x 38, line box y 85–101 (16, centred on the Close centre y 93). Max w 262 (ends at 300, 15 clear of Close). Text width ≈ 226 (27 chars × 8.4 − 1.2) | `ref.type.label`: Geist Mono Medium 12/16, +1.2, uppercase, `ref.color.meta` #8A8D91. Plain text with no pill and no outline. | `BEFORE YOU SHOOT  ·  1 OF 4` |
| Top void | 115–266 (151) [ref 147 from the disc rim] | Empty ground. Keep it empty: it gives the screen its quiet. | — |
| Light pool | Centre (196.5, 399), radius 120, so it spans x 76.5–316.5, y 279–519. It ends 101 above the title. | `ref.light.object`: static radial pool, white at 0.07 → 0.025 → 0. It is drawn behind the art, never behind text, identical on all four steps, and it never moves or animates. | — |
| Illustration art box | x 76.5–316.5 (240 w), y 266–532 (266 h), visual centre (196.5, 399). Ink no wider than 170 [ref ink 131 × 265.4, centre 4.4 left of screen centre] | Grayscale line art in react-native-svg (`ref.illustration`): stroke 1.6, round caps and joins. Depth comes only from stroke brightness. **Hero:** `ref.illustration.hero` #F2F2F2. **Mid:** `.mid` #A6A9AD. **Back:** `.back` #8A8D91. **Context** (hands, view wedges): `.context` #303030, fading linearly to transparent over its last `.contextFade` 40 pt. **Fills:** foreground device bodies are opaque `ref.color.panel` #0E0E0E with the inner screen in `ref.color.ground` #050505, so they hide the lines behind them and read as dark silhouettes against the pool. On steps 1, 3 and 4 the inner screen redraws the framed subject (see Steps). Context is only for hands and view wedges; scene objects are never context. There is no shading. **Hero phone** (steps 1, 3, 4): about 70 × 137 with corners `ref.radius.panel` 6. The inner screen is inset 13 at the sides, 24.5 at the top and 27 at the bottom (about 44 × 85.5), with corners radius 6 and a 1 pt `.context` edge. These echo 02's radius-6 viewfinder. **Brackets** (steps 1, 3, 4): four L-shapes in `.hero` #F2F2F2, arms 9, stroke 1.6, corners inset 4 from the inner-screen edge (the 6 corner's 45° point is 1.8 in, so they clear it). They are 02's viewfinder brackets at illustration scale, and they are static. | One scene per step (see Steps) |
| Gap | 532–620 (88). The text block is bottom-anchored, so this gap absorbs any growth. [ref 57.9 to a 2-line title's ink] | Ground | — |
| Title | x 38, max w 317, line box 620–648 (one line) | `ref.type.title`: Geist Regular 22/28, −0.45, `ref.color.bright`, left-aligned, accessibilityRole header | Step title (≤ 24 characters, one line at 317) |
| Gap | 648–652 (`ref.space.xs` 4) | — | — |
| Body | x 38, max w 317, line boxes 652–676 and 676–700 | `ref.type.body`: Geist Regular 17/24, `ref.color.read` #A6A9AD, left-aligned, at most 2 lines (≤ 70 characters at 317) | Step instruction |
| Gap | 700–762 (62). The last baseline is ≈ 695, so baseline to button top ≈ 67 [ref 67.7–69.1] | — | — |
| Step button | x 38–355 (317 w), y 762–814 (52), centred. Label padX `ref.space.xl` 24. With larger text the capsule grows upward and its bottom stays at 814 [ref outer 318.4 × 53.5, centre (196.3, 787.8)] | Steps 1–3: `ref.button.primary`: pill 999, fill `ref.color.bright` #F2F2F2, label `ref.color.inverseInk` #0A0A0A. Step 4: `ref.button.signal`: fill `ref.color.signal` #C8302B, label `ref.color.bright` #F2F2F2. No border, no shadow. Label `ref.type.button`: Geist Medium 17/22, −0.2, centred. | "Next" on steps 1–3, "Open the camera" on step 4 |
| Bottom inset | 814–852 (38) = safe bottom 34 + `ref.space.ctaBottom` 4 [ref 36.7–37.7] | Ground | — |

Check: 59 + 12 + 44 + 151 + 266 + 88 + 28 + 4 + 48 + 62 + 52 + 38 = 852.

**Gutters.** `ref.space.reading` 38 on both sides for the stamp, the text and the button [ref 37.8–39.3]. Close sits off the gutter at right inset 34, as measured.

### Steps

The copy paraphrases `src/capture/slots.ts` (plates I–IV) and the light-table checklist, and the camera's title and subtitle then echo it. Only step 1 borrows a composition from the reference: a hand holding a phone in front of its subject. Every object and scene is ESCAPD's own. All art is grayscale; the player's own photos never appear here.

| # | Stamp | Title | Body | Scene (ESCAPD's own drawing) | Button |
|---|---|---|---|---|---|
| 1 | `BEFORE YOU SHOOT  ·  1 OF 4` | Start at the doorway | One wide plate. Get the floor and two walls in. | A doorway frame (mid). Beyond it, a room corner: a floor line and two wall planes (back). A hand (context, fading) holds the hero phone in front, and its brackets frame the corner. The screen redraws the framed subject inside the 44 × 85.5 inner screen, clipped to its radius-6 corners: the floor line and the wall junction in `back` #8A8D91. The hero brackets at inset 4 sit on top. | `ref.button.primary` "Next" |
| 2 | `BEFORE YOU SHOOT  ·  2 OF 4` | Work around the room | The far corner, then the busiest wall. Let plates overlap. | A plan view of the room outline (back) with three phone plan symbols, each 20 × 40, radius 6, with no screen detail, at the doorway, the far corner and the busiest wall. The far-corner phone (plate II, current) and its wedge are `hero` #F2F2F2. The doorway phone (plate I, already taken) and the busiest-wall phone (plate III) are `mid` #A6A9AD, with their wedges in `context` #303030 fading over 40. The doorway and far-corner wedges overlap visibly. No brackets. | `ref.button.primary` "Next" |
| 3 | `BEFORE YOU SHOOT  ·  3 OF 4` | Get one close view | A desk, shelf, or table. Small things make good clues. | Top-down onto a desktop. The hero phone is face-on, flat and close above a desktop corner (mid; its two edges fade over the last 40 so the ink stays within 170). A key and an open notebook lie beneath it (back), with the notebook's outer pages showing on either side of the phone. Its screen shows the key and the page between the brackets. There is no hand and nothing standing behind the phone. | `ref.button.primary` "Next" |
| 4 | `BEFORE YOU SHOOT  ·  4 OF 4` | Keep the case private | No people, mail, or lit screens. Lights on, hold steady. | The hero phone frames a bookshelf and a lamp (`mid` #A6A9AD). The lamp is marked lit by three short ray ticks (line work only, no fill). The screen redraws the framed subject inside the 44 × 85.5 inner screen, clipped to its radius-6 corners: the bookshelf and the lamp with its three ray ticks in `mid` #A6A9AD. The hero brackets at inset 4 sit on top. An envelope and an open laptop, including the laptop's three short horizontal screen lines that show it is lit, sit outside the brackets and below the framed bookshelf and lamp, in `back` #8A8D91 with no fade. | `ref.button.signal` "Open the camera" |

### Tappable elements

Screen-reader order: Close → stamp → title → body → button. Keyboard and switch focus: Close → button. When the screen opens and after every step change, accessibility focus goes to the title, and the screen announces "Step n of 4".

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| Close (X) | 44 × 44 visual + `hitSlop` 2 on each side = 48 × 48 (`ref.hit.comfortable`) | **First run:** skips the guide. It sets the session flag (module-level `captureGuideSeen = true`), starts the AsyncStorage write `escapd:onboarding:capture-guide` = "1" without awaiting it, then calls `router.replace('/capture')`, carrying any params. accessibilityLabel "Skip the guide". **Replay:** sets the same flags and calls `router.back()` to the hub. accessibilityLabel "Close the guide". |
| Next (steps 1–3) | 317 × 52 (taller with large text), the whole capsule | Moves to step n + 1. The art, stamp and text crossfade; the button and the pool stay put. Taps during the 200 ms transition are ignored. |
| Open the camera (step 4) | 317 × 52 (taller with large text) | Sets the session and storage flags, then `router.replace('/capture')`. The opener has already checked access. /capture then shows 03 if the camera isn't allowed yet; otherwise it shows 02 at plate I ("From the doorway", counter I). **Replay:** in order, sets the session flag and starts the storage write, then calls `openCapture({ replace: true, skipGuide: true })` (the same access check as 01's YOUR ROOM). With access it runs `router.replace('/capture')`. Without access it runs `router.replace('/account?next=back')` (guest), `router.replace('/pro')` (no `custom_rooms` entitlement) or `router.replace('/capture/develop?from=hub')` (monthly cap reached: develop's cap state). Whichever route it takes, the guide leaves the stack and back returns to the hub. Pending and failure: see Replay wait and Replay error. |
| Horizontal swipe | Full width, y 115–762 (between the header and the button) | `usePanGesture` (react-native-gesture-handler 3.3; `Gesture.Pan` is deprecated, and `SceneView.tsx` already uses the hook) with `activeOffsetX` ±16, `failOffsetY` ±16. It commits on release when \|dx\| ≥ 56 or \|vx\| ≥ 500 pt/s. Left = next (steps 1–3), right = previous (steps 2–4). The content doesn't track the finger; a committed swipe runs the same crossfade as the buttons. A left swipe on step 4 does nothing, because only the button opens the camera. A right swipe on step 1 does nothing. The buttons remain the accessible path. |
| iOS swipe-back | System left edge | Enabled on step 1 only (`navigation.setOptions({ gestureEnabled: step === 0 })`). It leaves to the opener and does not set the flag. On steps 2–4 the edge is disabled so a right swipe means previous step. |
| Android hardware back | — | On step 2 or later: back to the previous step with the same crossfade. On step 1: `router.back()` to the opener (`router.replace('/')` when there is no history). It does not set the flag. |
| Stamp, light pool, illustration, title, body | — | Not tappable. The pool and the illustration are `accessible={false}`; the text carries the instruction. The stamp's accessibilityLabel is "Before you shoot. Step 1 of 4". |

**Entry rule.** Four places call one helper, `openCapture({ replace?: boolean, skipGuide?: boolean })` in `src/capture`: 01's YOUR ROOM, /tutorial/complete's "Photograph your room", guide replay's step 4 and the test paywall `/pro`. `replace` makes every navigation below a `router.replace` instead of a `router.push`; `skipGuide` skips step 2 and goes straight to `/capture`. 01 calls `openCapture()` (push). /tutorial/complete calls `openCapture({ replace: true })`, keeping today's `router.replace('/capture')` back behaviour. Guide replay step 4 calls `openCapture({ replace: true, skipGuide: true })`. `/pro` (decisions.md, user answer 5; no section yet) calls `openCapture({ replace: true })` after its test purchase, so the player continues to the guide (first time) or the camera, and /pro leaves the stack. Every caller sits directly on the hub, so back from wherever `openCapture()` lands returns to the hub.
1. **Access check:** `ensureSession()`, then `get_my_access`, checked in this order:
   - **Guest** (`is_anonymous`): `/account?next=back`. The server requires an email account. The account screen returns to the hub, and the player taps again.
   - **No `custom_rooms` entitlement** (`has_custom_rooms_entitlement` false): `/pro`, the test paywall.
   - **Monthly cap reached** (entitled, `can_generate` false): `/capture/develop?from=hub` with no roomId. Develop repeats its own check and shows its existing cap state. `from=hub` makes that state's button "Back", calling `router.back()`, instead of "Back to the title" calling `router.replace('/')`, which would stack a second hub.
   - **Check can't run** (offline or a server error): `openCapture()` navigates nowhere and rejects. 01 and /tutorial/complete then continue to `/capture`, where the backstop below still shows the guide to a first-timer and develop checks access again before anything is sent. Guide replay shows Replay error instead.
2. **Seen flag**, with access (skipped when `skipGuide`). If the session flag is set, it goes to `/capture`. Otherwise it reads `escapd:onboarding:capture-guide`: "1" sets the session flag and goes to `/capture`; any other value, or a failed read, goes to `/capture/guide`.

/capture without `?retake` keeps the same flag check as a backstop for any other way in, and renders only bare `ref.color.ground` until the check resolves. Retake mode never shows the guide, and the guide never asks for camera permission.

### States

- **Default:** steps 1–4 as in the tables, with the step 1–3 button in `ref.button.primary`.
- **Final step:** the button becomes `ref.button.signal`. Fill (#F2F2F2 → #C8302B) and label colour (#0A0A0A → #F2F2F2) change over `ref.motion.control` (120 ms ease-out), and the label text swaps from "Next" to "Open the camera" at the start of that change. Going back from step 4 reverses it.
- **Pressed:** each control changes colour over `ref.motion.control` 120 ms ease-out. Primary fill goes to `ref.color.brightPressed` #D4D4D4. Signal fill goes to `ref.color.signalPressed` #A82823. Close fill goes to `ref.color.panelPressed` #161616. There is no opacity change and no scale.
- **Focus:** `ref.focus` on Close and the step button: a 2 pt `ref.color.bright` outline, 2 pt offset, following the shape (a 52 circle on Close, a pill on the button). It is never removed while focused.
- **Transition:** the art, stamp, title and body crossfade over `motion.sceneCrossfade` 200 ms, with no drift and no counter roll on the stamp. The pool, Close and the button stay still. The brackets appear with their art and don't settle or scale.
- **Reduced motion:** the step crossfade becomes `motion.reducedFade` 140 ms opacity. The button's colour change stays at `ref.motion.control` 120 ms because it is a colour change, not movement. Nothing else animates.
- **Disabled:** none. Close and the button are always enabled. Taps during a transition are ignored rather than shown as disabled (which would be `ref.button.disabledOpacity` 0.4).
- **Loading:** none in first-run mode. `openCapture()` runs `ensureSession()`, the access check and the flag read before navigating, and the opener owns that wait (01's busy card). All art is bundled SVG, so the guide renders on its first frame. Replay mode has one real wait, the access check on step 4 (see Replay wait). The `ref.motion.thinking` status line is used only there.
- **Replay wait:** on tap, "Open the camera" keeps the `ref.button.signal` fill `ref.color.signal` #C8302B and its label, ignores further taps and sets `accessibilityState={{ busy: true }}`. If the check takes more than 1 s, one `ref.motion.thinking` line appears: a single line "Checking the file", no rotation, shimmer `ref.motion.thinking.shimmer` (base `ref.color.meta` #8A8D91, highlight `ref.color.bright` #F2F2F2, band 0.8, 2000 ms linear), `ref.type.meta` Geist Regular 13/18, centred at x 196.5, line box y 724–742 in the 700–762 gap, accessibilityLabel "Checking access". It stops as soon as the call returns. Reduced motion: the static line in `ref.color.read` #A6A9AD.
- **Replay error:** same slot (y 724–742). Phosphor `Warning` `ref.icon.small` 16 in `ref.color.error` #B5564F at x 38, then 8 pt, then "Couldn't reach the darkroom. Try again." in `ref.type.meta`, `ref.color.read` #A6A9AD (≈ 250 wide, one line). The button returns to its idle state and stays live for a retry; a retry clears the line and re-enters Replay wait.
- **Error:** storage errors are silent (`.catch(() => {})`, as in preferences.tsx). A failed read shows the guide once per session. A failed write shows it again on the next launch. Neither can loop, because Close and "Open the camera" set the session flag before leaving, and /capture checks it first. The screen makes no network calls in first-run mode; in replay, a failed access check is the Replay error above.
- **Permission denied:** not handled here. The guide is about framing, so it still shows when the camera is denied, and its advice also applies to "Choose photos instead". Section 03 handles the camera after the guide.
- **Large text:** all text honours system scaling and never shrinks. The text block and the button grow upward from 814: the capsule grows (minimum 52, and the label may wrap to 2 centred lines within padX 24), then the title and body rise. Close (44) and the stamp stay pinned at the top, and the stamp wraps downward if needed. The art box shrinks evenly, keeping at least 24 clear above and below; the pool radius scales with it (120 × box height / 266). Both hide below a 120 high box. If the block still doesn't fit, the title and body region scrolls while the button stays pinned.
- **Narrow screen:** the gutters stay 38 and the column is width − 76 (299 at 375, 284 at 360). The body may take 3 lines, and the block grows upward as above. The art box (240) and the pool stay centred. The stamp's max width is width − 131. It fits on one line down to 357 wide and wraps to 2 lines (to y 117) below that.
- **Replay:** the layout is identical. Only the Close behaviour and the step 4 access check differ (see Tappable elements, Replay wait and Replay error).

### User notes

> "taking photos step by step short tutorial for first onboarding."

How the note is honoured:
- **Step by step:** four steps, one idea each, with a mono "n OF 4" stamp so the player always knows where they are. Next and swipe both move forward and back.
- **Short:** each step has one title of three or four words and an instruction of two lines or fewer. Nothing scrolls on a 393 × 852 device at the default text size, and the X skips the whole guide at any step.
- **First onboarding:** the guide appears only before the first camera session, after the access check, gated by a per-device flag. It never appears in retake mode or after the flag is set; replay is opt-in from 01's How you play sheet.
- **Taking photos:** the content is the real plate plan (doorway, far corner, busiest wall, close view) plus the privacy rules, so what the guide teaches is what the camera then asks for.

### Decisions

1. **Close (X):** skips the guide, opens the camera and marks the guide seen. In replay it returns to the hub, which follows from decisions 1 and 4.
2. **Step count:** four steps, with the stamp `BEFORE YOU SHOOT  ·  n OF 4` in `ref.type.label`, `ref.color.meta`.
3. **Seen flag:** per device in AsyncStorage `escapd:onboarding:capture-guide`, plus the in-memory session flag. No migration.
4. **Replay:** "How to photograph a room" in 01's How you play sheet opens `/capture/guide?replay=1`. The camera's right header slot stays the library picker.
5. **Swipe:** horizontal swipe also moves between steps, and the buttons stay.
6. **Buttons:** steps 1–3 "Next" are `ref.button.primary` (white). Step 4 "Open the camera" is `ref.button.signal`, the screen's one signal action.
7. **Close control:** `ref.button.icon`: 44 round, `ref.panel` fill with a hairline, X in bright. It replaces the measured light-grey disc and has no rim highlights.
8. **Illustrations:** four grayscale line scenes (`ref.illustration`), each with a static `ref.light.object` pool behind it and the text block kept flat. Drawing the SVGs is a build to-do, not a question.
9. **Paywall timing:** access is checked before the guide, in `openCapture()`, so a player without access never sees it on first run. Guests go to `/account?next=back`, because the server requires an email account. Players without the `custom_rooms` entitlement go to the test paywall `/pro`, which continues through `openCapture()` after its test purchase. Players at the monthly cap go to develop's cap state (`/capture/develop?from=hub`).
10. **Palette, fonts, background, gutter, bottom inset** (formerly open): Noir ground #050505, Geist and Geist Mono, gutter 38 (`ref.space.reading`), bottom = safe 34 + `ref.space.ctaBottom` 4.

### Needs you

None.

## 05 · Pro (test paywall)

Reference: none. There is no reference screenshot for this screen. The geometry borrows from two other sections: 04's reading column (gutter `ref.space.reading` 38, a 317 column, the mono label at 04's stamp position) and 03's stack of a pill over a quiet button (pill bottom at 762, quiet button at 770–814). 393 × 852 pt, safe areas 59 / 34, all values in pt. Every style is a Noir `ref.*` token from `src/theme/tokens.ts`.

New route: `app/pro.tsx` (`/pro`, optional `?cap=<n>`). It is pushed by `openCapture()` (section 04, Entry rule) when the player has an email account but no `custom_rooms` entitlement. It sits in the root Stack with the same fade as every route.

### Feel (Noir)

A case-file cover sheet. A mono file label sits at the top, then a long, quiet stretch of flat near-black. Lower down come one bright statement and a short typed index of what Pro does, each line ruled off by a hairline like a form. Below that is one oxblood action, the stamp that opens the file, and a quiet way out. There is no art, light pool, price theatre, countdown, badge or decorative motion: the screen says what the player gets and steps aside. In test builds a small mono note says plainly that the purchase is a test.

**Signal on this screen:** "Unlock Pro" (`ref.button.signal`, fill `ref.color.signal` #C8302B), in test builds only. When test purchases are off there is no signal: the action is a white "Check again".

### Layout, top to bottom

Default, test build (`EXPO_PUBLIC_TEST_PURCHASES=1`). The block from the statement down is bottom-anchored, so it grows upward into the void.

| Element | Position & size (pt) | Style | ESCAPD content |
|---|---|---|---|
| Screen | 393 × 852, full bleed | `ref.color.ground` #050505 under the background still `ref.background.asset` (black silk, peak #262626), as on 01 and 04. There is no light pool (nothing on this screen is an object) and no Grain. | — |
| Status bar | y 0–59 (safe-area top) | System, light content | — |
| Gap | 59–85 (26) | Ground | — |
| File label | x 38, line box 85–101 (16, 04's stamp position), max w 317. Text ≈ 200 wide (24 characters × 8.4 − 1.2), so x 38–238 | `ref.type.label`: Geist Mono Medium 12/16, +1.2, uppercase, `ref.color.meta` #8A8D91 (6.1:1). Plain text with no pill and no outline. a11y label "Case file. ESCAPD Pro." | `CASE FILE  ·  ESCAPD PRO` |
| Top void | 101–354 (253) | Empty ground. It absorbs growth from large text. | — |
| Statement | x 38, w 317, line boxes 354–388 and 388–422 (2 × 34) | `ref.type.statement`: Geist Regular 30/34, −0.9, `ref.color.bright` #F2F2F2 (18.2:1), left-aligned, `accessibilityRole="header"` | "Open a file on your own room." Both spaces in "your own room." are non-breaking (U+00A0), so it sets as "Open a file on / your own room." (≈ 203 + ≈ 203 wide at ≈ 14.5 per character) |
| Gap | 422–450 (28, `ref.space.band`) | — | — |
| Benefit index | x 38–355 (317), y 450–622 (172): 4 rules and 3 rows of 56 | Rules: 1 pt (`ref.border.hairline`) in `ref.color.hairline` #222222, full 317 width, at y 450, 507, 564 and 621. Rows are 56 tall (16 + 24 + 16): 451–507, 508–564 and 565–621. Rules are decorative (1.3:1). | — |
| Row numeral | x 38–53.6 (15.6), line boxes 471–487, 528–544, 585–601 (each 4 below its text box top, so the 16 box centres on the 24 line) | `ref.type.label`, `ref.color.meta`. Hidden from screen readers. | `01` · `02` · `03` |
| Row text | x 70–355 (285, which is 32 = `ref.space.xxl` in from the gutter), line boxes 467–491, 524–548, 581–605 | `ref.type.body`: Geist Regular 17/24, `ref.color.read` #A6A9AD (8.6:1), left-aligned. One line at default size: ≤ 33 characters at ≈ 8.3 per character fits in 285 | 01 "Your room becomes the case." (≈ 224)<br>02 "The clues hide in your things." (≈ 249)<br>03 "Up to {generations_cap} new cases a month.", which reads "Up to 20 new cases a month." today (≈ 224). When the cap is unknown: "A monthly allowance of new cases." (≈ 274) |
| Gap | 622–654 (32, `ref.space.xxl`) | — | — |
| Notice slot | x 38–355, line box 654–672 (18). Always reserved, so the layout never moves when a notice appears. Empty in Default | **Error:** Phosphor icon at `ref.icon.small` 16 in `ref.color.error` #B5564F (an icon, not text) at x 38–54, y 655–671. Then 8 (`ref.space.sm`), then text at x 62–355 (293) in `ref.type.meta` Geist Regular 13/18, `ref.color.read` (8.6:1). One line only: ≤ 45 characters at ≈ 6.4 per character. `accessibilityLiveRegion="polite"` | See States |
| Gap | 672–680 (8) | — | — |
| Test note | Centred on x 196.5, line box 680–698 (18). Text ≈ 108 wide (13 × 8.4 − 0.6), so x ≈ 142–251. Subtract the 0.6 trailing tracking when centring | `ref.type.note`: Geist Mono Regular 13/18, +0.6, uppercase, `ref.color.meta` (6.1:1). Not a control. `accessible={false}`, because its words are the button's hint | `TEST PURCHASE` |
| Gap | 698–710 (12, `ref.space.md`) | — | — |
| Unlock Pro | x 38–355 (317 × 52), y 710–762, centred. With larger text the capsule grows upward and its bottom stays at 762 | `ref.button.signal`: pill `ref.radius.pill` 999 with `...ref.curve`, fill `ref.color.signal` #C8302B, no border and no shadow. Label `ref.type.button` (Geist Medium 17/22, −0.2) in `ref.color.bright` (4.8:1), centred. The label's padX is 44 on both sides, reserving room for the in-button indicator (Global tokens, Loading indicators) | "Unlock Pro" |
| Gap | 762–770 (8) | — | — |
| Not now | y 770–814 (44, `ref.button.quiet.height`), width = label + 2 × 16, so ≈ 92 × 44, centred (x ≈ 150–243) | `ref.button.quiet`: no fill and no border. Label `ref.type.button` in `ref.color.read`, pressed `ref.color.bright` | "Not now" |
| Bottom inset | 814–852 (38) = safe bottom 34 + `ref.space.ctaBottom` 4 | Ground | — |

Check: 59 + 26 + 16 + 253 + 68 + 28 + 172 + 32 + 18 + 8 + 18 + 12 + 52 + 8 + 44 + 38 = 852.

**Gutters.** `ref.space.reading` 38 on both sides for the label, statement, index, notice and pill. The test note and Not now are centred on x 196.5.

**No header control.** "Not now", Android back and the iOS edge swipe are the exits. A top-left arrow would duplicate "Not now", and a close X would compete with the one signal action.

**Copy, and what it's grounded in**

| Slot | Copy | Grounded in |
|---|---|---|
| File label | CASE FILE  ·  ESCAPD PRO | The product name in today's develop copy ("Your own rooms are part of ESCAPD Pro"). Same eyebrow pattern as 04's stamp |
| Statement | Open a file on your own room. | The thing Pro unlocks: the `custom_rooms` entitlement, the only entitlement key |
| 01 | Your room becomes the case. | 3–6 plates of one room (`min_photos_per_room` 3, `max_photos_per_room` 6) become a playable case. It echoes today's tagline, "Your room becomes the mystery." |
| 02 | The clues hide in your things. | The darkroom "finds the objects, chooses what to hide, and writes the case" (today's develop copy). One of 7 hand-authored templates is fitted to the objects in the plates (`_shared/templates.ts`) |
| 03 | Up to {generations_cap} new cases a month. | `get_my_access().generations_cap`: `generation_cap_per_window` 20 over `generation_window_days` 30, a rolling window. Only queued, running and succeeded jobs count (`private.generations_used`), so failed developments are free. "A month" matches today's cap copy ("every case this month allows"). It is read from the server, never hard-coded, so it stays true if the config changes |
| Test note | TEST PURCHASE | Test builds only |
| Signal | Unlock Pro | — |
| Quiet | Not now | — |

### Tappable elements

Screen-reader order: file label → statement (header) → 01 → 02 → 03 → notice (when set) → "Unlock Pro" (or "Check again") → "Not now". Each benefit row is one element whose label is its sentence; the numeral is hidden. Keyboard and switch focus: "Unlock Pro" → "Not now". When the screen opens, accessibility focus moves to the statement.

| Element | Hit area ≥ 44 | Action |
|---|---|---|
| "Unlock Pro" (test build) | 317 × 52 (taller with large text), the whole capsule | Goes to Purchasing (States). a11y label "Unlock Pro", hint "Test purchase. Nothing is charged." Ignored while Purchasing. |
| "Check again" (test purchases off) | 317 × 52, the same slot | Re-runs `getMyAccess()` with the in-button indicator. If the account now has the entitlement, it goes to Already has access. If not, it stays and announces "No access on this account yet." It is how a tester continues after access is granted by hand (scripts/grant-test-access.sql). |
| "Not now" | ≈ 92 × 44 | `router.back()`, or `router.replace('/')` (the 01 hub) when there is no history. It changes nothing. Disabled (0.4) during Purchasing and Check again. |
| Android hardware back | System | Same as "Not now", in every state, including Purchasing. If the player leaves mid-purchase, the server still completes the grant, but /pro drops its continuation (guard on a mounted/focused ref, so a late result never navigates). The next YOUR ROOM tap then goes straight through. |
| iOS edge swipe | System left edge | Enabled. Same as Android back. |
| File label, statement, rows, rules, test note | — | Not tappable. |

**Entry rule (changes `openCapture()` in section 04).** Step 1, the access check (`ensureSession()` then `getMyAccess()`), now routes:
1. `is_anonymous` → `/account?next=back`, unchanged. The server requires an email account: `request_room_generation` refuses guests, and so does this screen's Edge Function.
2. No `has_custom_rooms_entitlement` → `/pro?cap=<generations_cap>` (push, or replace when `replace` is set). This is new; until now it went to `/capture/develop`.
3. `can_generate` false with the entitlement (the cap is reached) → `/capture/develop` with no roomId, unchanged. `useDevelopment` runs `get_my_access` before it looks at the plates, so it lands on its existing cap state: "You've developed every case this month allows" / "Your allowance comes back over the next few days…" with "Back to the title". **The cap is that screen's message, not this one.** /pro is only for the missing entitlement.
4. Otherwise → step 2 (the seen flag: guide or camera), unchanged. If the check can't run (offline or a server error), the existing rule applies: continue to `/capture`, and `/capture/develop` checks again before anything is sent.

The same routing applies to 01's YOUR ROOM card, `/tutorial/complete`'s "Photograph your room" and the guide replay's step 4, because all three call `openCapture()`. The develop screen keeps its own entitlement state ("Your own rooms are part of ESCAPD Pro") for a player whose access lapses between the camera and the darkroom. It does not link to /pro, because /pro continues to the guide or camera, which is wrong for a player whose plates are waiting on the light table.

### Test purchase: `grant-test-entitlement`

A new test-only Edge Function, `supabase/functions/grant-test-entitlement/index.ts`. It does by API exactly what `scripts/grant-test-access.sql` does by hand, for the caller only.

| Step | Behaviour |
|---|---|
| 1. Gate | If `env("ESCAPD_TEST_PURCHASES", false) !== "1"`, it returns 403 `{ error: "test_purchases_off" }`. This is checked first, before auth, so a project without the secret does nothing at all. |
| 2. Caller | `requireUser(req)` from `_shared/supabase.ts` verifies the bearer session JWT with the Auth server (`admin().auth.getUser(token)`), exactly as `delete-account` and `merge-guest` do. A missing or invalid token gets 401 `unauthorized`. `supabase/config.toml` gets `[functions.grant-test-entitlement] verify_jwt = false`, like the other five, because verification happens inside the function. |
| 3. Guests | If `user.is_anonymous`, it returns 403 `account_required`. This matches `get_my_access` (`can_generate` needs a full account) and the SQL script ("guests can't develop rooms"). |
| 4. Write | A service-role upsert into `public.entitlements` of `{ user_id: user.id, entitlement_key: "custom_rooms", provider: "manual", status: "active", expires_at: null }`, with `onConflict: "user_id,entitlement_key,provider"`. This is the script's `insert … on conflict (user_id, entitlement_key, provider) do update set status = 'active', expires_at = null, updated_at = now()`; the `entitlements_updated_at` trigger sets `updated_at`. The user id comes only from the verified token, and the request body is ignored. The function is idempotent. Clients can't write this table themselves (RLS allows `select` of their own rows only), which is why a function is needed. |
| 5. Reply | 200 `{ granted: true }`. A database error is logged and returns 500 `internal_error`. Like the other functions it goes through `handler()`: POST only, with CORS and uniform error JSON. |

**Client.**
- `grantTestEntitlement()` goes in `src/lib/escapd-api.ts`, as `supabase.functions.invoke("grant-test-entitlement", { body: {} })`, next to `deleteAccount()`. On a `FunctionsHttpError`, it reads `await error.context.json()` to get the `error` code for the message.
- The screen offers the test path only when `process.env.EXPO_PUBLIC_TEST_PURCHASES === "1"`. The value is inlined at build time. Set it in the EAS `development` and `preview` environments and in local `.env`, never in `production`. Add a commented line for it to `.env.example`, and add `ESCAPD_TEST_PURCHASES` to that file's server-secrets block.

**Both flags are needed, and only the secret protects anything.** The client flag decides what the screen offers. `EXPO_PUBLIC_*` values ship in the binary, and the function's URL is public, so while the secret is set any signed-in email account on that project can grant itself Pro. Set it with `npx supabase secrets set ESCAPD_TEST_PURCHASES=1` only on a project whose users are testers. Unset it, or never deploy the function, on any project that serves store builds.

**Undo.** The "Undo" statement at the bottom of scripts/grant-test-access.sql revokes a `manual` row. It works the same for rows this function wrote.

**Later: real purchases.** RevenueCat replaces this path:
- `react-native-purchases` is not installed yet. The app calls `Purchases.logIn(<supabase user id>)` (the convention in docs/BACKEND.md) and runs a store purchase on "Unlock Pro".
- `revenuecat-webhook` writes a `provider 'revenuecat'` row. Rows are unique per provider, so it sits alongside any manual row.
- The client then re-checks `get_my_access` until the entitlement shows.
- The screen gains a price in place of the TEST PURCHASE note, a Restore purchases action and the store-required terms and privacy links.
- The function and both flags are then deleted.

### States

- **Default:** as in Layout. In a test build the action is the signal "Unlock Pro" with the TEST PURCHASE note. When opened from `openCapture()` with `?cap=`, it renders on the first frame with no second access check, because openCapture has just made one.
- **Loading** (opened without `?cap`, e.g. a deep link or a restored route): flat `ref.color.ground` only. After 300 ms the dither (`ref.motion.dither`: 24 × 24, 4 × 4 `ref.color.bright` cells, opacity 0.1 ↔ 1 over 1000 ms in Bayer order) appears, centred at (196.5, 426) in the box x 184.5–208.5, y 414–438, until `getMyAccess()` returns. A faster check shows nothing. a11y: role progressbar, label "Loading". When the result arrives, it routes as Guest or Already has access, or shows Default (with `generations_cap` from the result). Default fades in over `ref.motion.control` 120 ms (opacity), and the dither unmounts. If the check fails, it shows Default with row 03's fallback line ("A monthly allowance of new cases."). The server re-checks everything when the player taps, so nothing is lost.
- **Purchasing** (after "Unlock Pro"): the in-button pattern from Loading indicators. This is the button's own action, usually one function call plus one RPC, and there is nothing true to rotate through, so it is not a Thinking state.
  - The label "Unlock Pro" stays centred. A native `ActivityIndicator` (small, 20 × 20) in `ref.color.bright` #F2F2F2 sits at x 319–339, y 726–746 (right edge 16 in from the pill's end, vertically centred).
  - The pill keeps its `ref.color.signal` fill at full opacity, ignores taps and sets `accessibilityState={{ busy: true, disabled: true }}`.
  - "Not now" goes to `ref.button.disabledOpacity` 0.4 and is disabled. System back stays live (see Tappable elements). Any notice clears.
  - The calls, in order: `grantTestEntitlement()`, then `getMyAccess()`.
- **Success:** `getMyAccess()` reports `has_custom_rooms_entitlement`. Then:
  - `useFeedback().success()` (the haptic develop already uses) and `AccessibilityInfo.announceForAccessibility("Pro unlocked.")`;
  - then `openCapture({ replace: true })`. Its check now passes and it continues exactly as openCapture would. On the first time it goes to `/capture/guide`, otherwise to `/capture`. If this account has already used its allowance, it goes to `/capture/develop` (the cap state). `replace` takes /pro off the stack, so back from the guide or camera returns to the hub.
  - There is no success screen, stamp or celebration; the camera, or the guide, is the reward.
  - Loop guard: /pro calls `openCapture` only after it has seen the entitlement itself. If the function returned 200 but the entitlement is still missing, /pro shows the generic error instead, so it can never replace itself with /pro.
- **Error:** in the notice slot (y 654–672). The icon is `ref.color.error` #B5564F and the text `ref.color.read`. The notice fades in over `ref.motion.control` and is announced (`accessibilityLiveRegion="polite"` on Android, `announceForAccessibility` on iOS). The pill returns to idle and stays live for a retry, "Not now" returns to full opacity, and a retry clears the notice.

  | Cause | Icon | Text |
  |---|---|---|
  | Offline (`isNetworkError`) | Phosphor `WifiSlash` | "You're offline. Connect and try again." (≈ 243 wide) |
  | 403 `test_purchases_off` (client flag on, server secret off) | Phosphor `Warning` | "Test purchases are off on this server." (≈ 243) |
  | 403 `account_required` | — | No notice: routes as Guest |
  | 401, 5xx, entitlement still missing, anything else | Phosphor `Warning` | "Couldn't unlock Pro. Try again." (≈ 198) |

- **Already has access:** whenever a check on this screen finds `has_custom_rooms_entitlement`, the player skips straight through with `openCapture({ replace: true })`, with no haptic or announcement. The checks are Loading, the re-check on `AppState` → `active` (for example, after a tester's access was granted by hand while the app was in the background) and "Check again". With `?cap=`, the first frame is Default, and the skip happens only if a later check finds access.
- **Guest:** `openCapture()` sends guests to `/account?next=back` before they ever reach /pro. If a check on this screen still finds `is_anonymous` (a deep link, a signed-out session) or the function answers `account_required`, the screen runs `router.replace({ pathname: "/account", params: { next: "back" } })`. After confirming, /account goes back to the hub and the player taps YOUR ROOM again (01's existing behaviour). /pro never calls the function for a guest.
- **Test purchases off** (`EXPO_PUBLIC_TEST_PURCHASES` is not "1"; for now this includes every production build). The screen states honestly that purchases aren't available yet.
  - No signal pill and no TEST PURCHASE note.
  - The notice slot and the test-note slot together (y 654–698) hold an info line, bottom-aligned at 698 (2 lines, y 662–698), at x 38, w 317, in `ref.type.meta`, `ref.color.read`, with no icon (it's information, not an error): "Pro isn't on sale yet. If you're testing, ask for access, then check again." (≈ 75 characters, 2 lines).
  - The pill slot holds `ref.button.primary` "Check again" (white, label `ref.color.inverseInk`; it is not a purchase, so it is not signal). Its in-button indicator is in `ref.color.inverseInk` #0A0A0A.
  - Nothing above moves.
  - If "Check again" fails, the error line takes the info's place (one line, y 680–698), and the info returns on the next check.
  - This replaces develop's "Pro isn't on sale in this test build" placeholder on the hub path.
- **Pressed:** each control changes colour over `ref.motion.control`, 120 ms ease-out. The signal fill goes to `ref.color.signalPressed` #A82823 (label 6.3:1), the primary fill ("Check again") to `ref.color.brightPressed` #D4D4D4, and the quiet label to `ref.color.bright`. No opacity change and no scale.
- **Focus:** `ref.focus` (2 pt `ref.color.bright`, offset 2, radius 999 with `...ref.curve`). The ring is 325 × 60 around the pill (x 34–359, y 706–766) and ≈ 100 × 52 around "Not now".
- **Disabled:** only "Not now", during Purchasing and Check again (0.4).
- **Reduced motion:** the Loading dither is the static checkerboard. The 120 ms fade-ins (Default, notices) stay, because they are opacity changes, not movement. The native indicator keeps the platform's behaviour. Nothing on this screen moves in any mode.
- **Large text:** all text honours system scaling and never shrinks.
  - The bottom-anchored block grows upward into the void, which keeps at least 24 above the statement.
  - Rows grow with their text (32 + the text height; a sentence may wrap to 2 lines).
  - The pill grows upward from 762, and its label may wrap to 2 centred lines within padX 44.
  - The file label stays pinned at the top.
  - If the block still doesn't fit, the statement and index scroll while the notice, test note, pill and "Not now" stay pinned (as in 04).
- **Narrow screen:** the gutters stay 38, so the column is width − 76 (299 at 375, 284 at 360) and row text is column − 32 (267 / 252). Row 02 (≈ 249) is tight at 360 and may wrap; its row then grows 24 and the block rises.

### Decisions

1. **Route:** `/pro` (`app/pro.tsx`), pushed or replaced by `openCapture()` with `?cap=<generations_cap>`. No reference screenshot exists. The geometry comes from 04's reading column and 03's pill-over-quiet stack.
2. **When it shows:** only when the access check finds no `custom_rooms` entitlement. Guests go to `/account` first. A reached cap is develop's message ("You've developed every case this month allows"), never this screen's.
3. **Layout:** a case-file cover sheet: mono file label, statement, a three-row ruled index, the test note, one pill and a quiet "Not now". Flat ground, with no art, light pool or header control. The notice slot is always reserved, so nothing jumps.
4. **Copy:** as in the Copy table. Every benefit line states something the app really does. The cap is read from `get_my_access`, never hard-coded.
5. **Signal:** "Unlock Pro" is the screen's one signal action, in test builds only. With test purchases off the action is a white "Check again", and there is no signal.
6. **Test purchase:** the new `grant-test-entitlement` Edge Function upserts the caller's `manual` / `custom_rooms` / `active` / no-expiry row, exactly as scripts/grant-test-access.sql does. It authenticates like `delete-account` and `merge-guest` (`requireUser`, `verify_jwt = false`), and refuses unless the secret `ESCAPD_TEST_PURCHASES=1` is set. It also refuses guests. The client offers it only when `EXPO_PUBLIC_TEST_PURCHASES=1`.
7. **Purchasing feedback:** the in-button native indicator (the button's own action, under 1–2 s, nothing true to rotate), not a Thinking state.
8. **After success:** `openCapture({ replace: true })`, so the guide (first time) or the camera, or develop's cap state if the allowance is used. /pro leaves the stack.
9. **Test purchases off:** an honest "isn't on sale yet" line plus "Check again". No fake purchase button.
10. **Later:** a RevenueCat purchase replaces the test path. The function and both flags are deleted, and the screen gains a price, Restore purchases and terms and privacy links.

### Needs you

1. **Where test purchases may run.** The secret is the only real gate. While `ESCAPD_TEST_PURCHASES=1` is set on a Supabase project, any signed-in email account on it can give itself Pro. Proposed: set it only on a project whose users are testers, and set `EXPO_PUBLIC_TEST_PURCHASES=1` only in the EAS `development` and `preview` environments. If your one Supabase project will also serve store builds, the secret has to be removed (or the function left undeployed) before release. Please confirm which project and which build profiles.

## Decisions

Every question left open by the first draft, and how Noir or your answers settled it. Each screen section has the full reasoning under its own "Decisions".

### Across screens

| Question | Decision |
|---|---|
| Palette, fonts, button shape | Noir: near-black ground, Geist / Geist Mono / Playfair (case titles and the escape only), white primary pills, one oxblood signal |
| Where game mode lives | It **is** the hub at `/` and replaces today's title screen (you confirmed) |
| Getting to the camera | One helper, `openCapture()`, checks access first. Guest → `/account?next=back`. No Pro → `/pro`. Monthly limit reached → the darkroom's existing limit message. Access → the photo guide the first time, otherwise the camera. If the check can't run, the hub carries on to the camera (the darkroom checks again before anything is sent) |
| Where red appears | 01: the SOLVED stamp. 02: the ring on the last-photo thumbnail from 3 plates. 03: none. 04: "Open the camera". 05: "Unlock Pro". Never more than one "go" button per screen |
| Loading | A real wait with something true to say: Thinking states. A short wait: the dither. A button's own action: a small spinner with the label kept. Countable progress: a thin bar with a mono count |
| The painted magnifying glass | Kept as it is for now (your answer): the one exception to grayscale brand art, used only as 01's hero object. A Noir version comes later |
| Tilt | Allowed as the one pointer effect (your answer): the 01 glass only |
| Backgrounds | Your choice: the black-and-white warp from your shader library, as one pre-rendered still (black silk, peak #262626), on 01, 04 and 05. 02 and 03 (the camera route) stay flat |
| Paywall | `/pro` with a test purchase that grants access and lets you through (your answer) |

### Per screen

- **01 · Game mode:**
  - Subtitle "Three files on the desk."
  - The right button opens "How you play": Show interactives (an off/on control) and "How to photograph a room".
  - No back or close button.
  - Cards are graphite panels with mono tags, line icons with no glow, and a soft light behind the fan.
  - YOUR CASE with no room is dimmed and shows "NONE YET".
  - ESCAPD wordmark in the header.
  - The brass glass sits above the title and tilts.
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
- **04 · Photo guide:**
  - Four steps under the label "BEFORE YOU SHOOT · n OF 4".
  - "Next" is white; "Open the camera" is red.
  - Swiping also moves between steps.
  - X skips to the camera and marks the guide seen; on a replay, X returns to the hub.
  - The seen flag is stored on the device.
  - Replay lives in How you play.
  - Grayscale line art.
- **05 · Pro:**
  - A case-file cover sheet with three benefit lines.
  - Red "Unlock Pro" calls a test-only server function that grants access, then carries on to the guide or camera.
  - When test purchases are off, it says plainly that Pro isn't on sale yet.

## Needs you

Nothing right now. Your last answers settled these:

1. **Background:** the black-and-white warp. It's spec'd as the black silk version at the brightest level that keeps all text readable (Global tokens, Backgrounds). If you want it bolder, the brighter and true black-and-white versions are in `F:/escapd-tools/bg-shaders/compare-bw.html`.
2. **Test purchases:** no release is planned, so one Supabase project with `ESCAPD_TEST_PURCHASES=1` is fine for now. Turning it off is on the pre-release list (Build notes).
3. **Guests and test purchases:** skipped for now. Guests still add an email before the paywall, as the server requires.
4. **The 0.5× lens:** check that room generation copes with ultra-wide distortion before the lens control ships (Build notes).

## Build notes

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
