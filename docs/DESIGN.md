# ESCAPD design spec: the reference look

> **Direction change (2026-10-25, round 3).** You re-sent the four reference screenshots and asked for them to be followed as closely as possible: colours, type, icons, layout, shadows, gradients, corner radii, layering. **The hub, camera, camera permission, photo guide and Pro now copy their references' look as well as their layout.** The light table (`/capture/review`) takes its layout and details from a fifth reference (Vestiaire Collective's Photos screen). As you asked, it doesn't copy that screen's colours: it uses the camera's dark palette, since it opens straight from the camera. After that you pointed out that the in-game screen and the loading screens were still brass, so they were moved over too: the player and Case closed (08), the darkroom (06) and the shared loading and error screen. Only the account screens (`/account`) still use the round-2 look.
>
> **Round 4 (your feedback on the rebuilt app).** The darkroom metaphor is gone from everything players see: photos, not plates; "Photos", not the light table; "Building your case", not the darkroom; Arabic numerals. The hub header is just the ESCAPD logo, and its chip opens a real Settings sheet. The photo guide shows before every new room. In a case, the photo strip and Explore as list are gone: the photo is full-bleed and swipes edge to edge between views, and the code wheels slide. The review screen's tips are a plain list, with a reassuring privacy line that doesn't mention AI. Bottom sheets slide with no bounce and have 40 pt corners. Haptics run through the whole app. What was reversed from round 2 is listed under **Decisions → Reversed in round 3**.

| # | Screen | Route | Layout and look reference | Your note |
|---|---|---|---|---|
| 01 | Home, the three mode cards | `/` | [Opal, game mode](refs/01-game-mode.png) (header only since the modes) | Round 6: "the three cards should have some overlap … but vertical"; no case list. |
| 02 | Camera | `/capture` | [Once, camera](refs/02-camera.png) | "the photo button has a magnifier glass icon on it." |
| 03 | Camera permission | `/capture` (before access) | [pushr, permission sheet](refs/03-camera-permission.png) | none |
| 04 | First-time photo guide | `/capture/guide` | [Apple Health, how-to steps](refs/04-photo-tutorial.png) | "taking photos step by step short tutorial for first onboarding." |
| 05 | Pro (test paywall) | `/pro` | none: built on 03's sheet | none |
| 06 | Building your case (the build wait), and the shared loading and error screen | `/capture/develop`; `StateScreen` everywhere | none: derived from 02, the modes and case closed | Round 8: "way more premium and fun … no leave room thing"; "increase size of the magic rotating text" |
| 07 | Light table | `/capture/review` | [Vestiaire Collective, Photos](refs/07-light-table.png) | "you dont have to port over the colors but everything else." |
| 08 | In-game player and Case closed | `/tutorial`, `/play/[roomId]`, `/tutorial/complete` | none: derived from 02, 01 and 07 | "the showing photos actual in game screen and loading screen hasnt been changed to match the new premium look" |

**Where things come from.**
- **Measured from the references:** layout, sizes, type sizes and weights, colours (01–05), gradients, rims, glows, corner radii and layering. Each screen section gives the measurements next to the values used.
- **Never copied:** the other apps' names, logos, copy and icons. Text is ESCAPD's; icons are Phosphor or drawn for ESCAPD.
- **Effects you supplied as web code:** Thinking states, rebuilt for React Native (kit `ThinkingStates`), used under the drifting glass while a case builds. The tilt and the shader background are no longer used.

**Source of truth.** `src/theme/tokens.ts`. The live theme at the top of the file (`color`, `type`, `space`, `radius`, `curve`, `motion`, `hit`) is the round-2 brass look, now used only by the account screens and the live `Button` / `IconButton` / `Sheet` / `Text` components they import. The `ref` export is the reference look. Screen code uses tokens only: no colour, size or font literals. Each screen's own geometry lives in `ref.layout.<screen>`.

**Base:** iPhone 393 × 852 pt, safe areas 59 top and 34 bottom. Tap targets are at least 44 pt, text contrast at least 4.5:1, and reduced motion is respected everywhere.

**Contents:** Global tokens · 01 Home · 02 Camera · 03 Camera permission · 04 Photo guide · 05 Pro · 06 Building your case · 07 Review (Photos) · 08 In-game player · Decisions · Needs you · Build notes · Screens with no layout reference yet

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
- **Thinking states** (`thinking`): a line holds, exits up as the next rises in, and a highlight band about 0.8× the line's width sweeps it. It runs only during a real wait. Under reduced motion the lines swap with a fade and nothing moves. Sizes: `meta`, `body`, `tag`, and (round 8) `status`, Medium 22/28, the build wait's feature line; a caller may pass its own sweep `colors` (a mode's muted ink to its stamp colour) and a longer `hold`.
- **The room while a case builds:** its drift, drag, torch beam and ready moment are in `ref.layout.develop` (06 · Motion).
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

**The game's own moments** (GAME_FEEL, see "Game feel" below). Each is named for the moment, not the vibration, and also plays its sound when Sound is on:

| Call | Feel | Used for |
|---|---|---|
| `paper` | light impact | a clue note or sheet opening |
| `pickup` | medium impact | an item landing in the evidence tray |
| `wrongCode` | heavy impact, then the error buzz 90 ms later | a wrong code or accusation |
| `unlock` | medium (the bolt), then light 110 ms later (the latch) | a correct code |
| `stamp` | heavy impact | CASE CLOSED, GUILTY |
| `solved` | success, then light at 260 ms and medium at 400 ms | the case solved |
| `shutter` | medium impact | the camera's shutter (was `thud`) |
| `typewriter` | none (sound only) | the informant's new tip |

A pattern's later beats are skipped if haptics were off when it started.

There is one haptic per moment, never stacked, and only on discrete events. Under Jest, `jest/setup.js` mocks the module with every key, and mocks expo-audio.

### Focus and accessibility

- **Focus ring:** every focusable control draws the brass ring (2 pt, 2 pt out) in its own shape (kit `FocusRing` / `useFocusRing`). On the web it shows only for keyboard focus (`:focus-visible`), so a tap or click never leaves it on.
- **Decorative layers** (glows, haze, art) are hidden from screen readers and never take touches.

### Kit (`src/components/noir`)

`PillButton`, `DarkSheet` (the bottom sheet from the hub, used by the player), `FocusRing` / `useFocusRing` / `focusRingStyle`, `FloorGlow`, `LightPool(s)`, `PaperHaze`, `ThinkingStates`, `GlyphStack`, `gradientStops` / `gradientLine`, `trackingPad`, `useShowAfter` and the motion helpers. `BackgroundStill` (the silk) was removed; its asset stays in `assets/backgrounds`.

## 01 · Home (the mode cards at /)

Round 6 (MODES_PROMPT.md Part 2, the user's round 6 note). Home is the shell: the reference look's black ground, Opal's header (the ESCAPD logo centred, the Settings chip at the right) and the faint divider, then a deck of three mode cards, DETECTIVE NOIR, CRIME SCENE and PARANORMAL, each solid and in its own mode's palette. There is no case list anywhere: a card's tap goes into the mode (Entering a mode, below). The old Opal fan (THE STUDY, YOUR ROOM, YOUR CASE, the glass cards and the floor glow) is gone.

Route: `app/index.tsx` (`/`) re-exports `src/screens/hub/HubScreen.tsx`. Files in `src/screens/hub/`: `HubScreen.tsx` (header, divider, the deck, a card's tap, the notice, the two sheets, focus return, Android back), `ModeCard.tsx` (one card), `deck.ts` (the deck's geometry, pure), `caseStatus.ts` (The Study's entry, a case to go back to, where Continue goes, labels and notice copy, pure), `useHubData.ts` (`loadHub`, `fetchHub` and the focus fetch), `ResumeSheet.tsx` (the continue prompt), `SettingsSheet.tsx`, `HubNotice.tsx`, `Chip.tsx`, and the covers in `art/` (Modes · Mode art). The prompt's words are in `src/screens/mode/copy.ts`. Tests: `src/screens/hub/__tests__/hub-test.tsx`, `caseStatus-test.ts`, `art/__tests__/bake-test.tsx`.

Tokens: `ref` throughout (`ref.button.chip`, `ref.gradient.divider`, `ref.type`, `ref.space`, `ref.radius`, `ref.curve`, `ref.focus`, `ref.motion.sheetRise / sheetFall`), the mode themes (`modeThemes`), and home's own `ref.layout.hub`: `header` { top 12, logo 14 }, `chipRing`, `sliders`, `noticeIcon` 16, `sheet`, `settings`, and `modes`:

| Token | Value | What |
|---|---|---|
| `top` / `edge` / `foot` | 16 / 16 / 12 | the deck's first card under the divider, from the screen's sides, the last card above the safe bottom |
| `deck.cover` | 0.36 | each card covers the foot of the card above by 36 % of a card's height |
| `deck.peek` | 40 | at least this much of a card's art shows under its words before the next card |
| `deck.tilt` | 2.5°, −2°, 2° | each card turned about its centre, alternating |
| `deck.shadow` | `0 −10 24` black 62 % | each card's shadow, cast up onto the card it covers |
| `deck.edge` | white 0 → 16 % → 0 | a line of light along each card's top edge, inside its rim, between its corners |
| `minHeight` | 168 | no card is shorter |
| `radius` / `rim` / `pad` | 20 / 1 / 18 | continuous corners, the rim in the mode's `rim`, the words' padding |
| `plate` / `fade` / `fadeStops` | 0.72 / 56 / 0 → 0.38 → 0.72 | the mode's ground behind the words, fading down to clear under them |
| `tag` | padX 10, padY 4, gap 8 | the busy capsule beside the tagline while a card's tap works |
| `glow` | | paranormal's soft glow (round 9: noir's brass rule over the name is removed) |
| `type.tagline` / `type.tag` | 17/22 Medium / 13/16 Semibold | |
| `pressScale` | 0.98 | the kit's squash |

### Feel

Three case files dealt down a dark desk. Each card is solid and lit by its own cover art, lies over the foot of the card above it and is turned a couple of degrees the other way, so the deck reads as physical cards, not a list. Where a card lies over another it casts a soft shadow up onto it, and a faint line of light catches its top edge. The names sit at the top of each card, the part nothing covers, in each mode's display face. Nothing moves until a card is pressed.

### Layout, top to bottom

| Element | Position and size (pt) | Style |
|---|---|---|
| Ground | full screen | `ref.color.void`. No glow, no grain |
| Header | chip row at safe top + 12 (discs 36 in 48 hit boxes, 16 from the edges); the divider 16 under the discs | Opal's header as before: the left slot empty (home is the root), the ESCAPD logo centred as the screen's header (round 8: `assets/brand/wordmark.png`, cut from the user's brand art: cream letters, the A's keyhole lit amber, its soft glow keyed onto clear so it sits on the black; 40 pt tall including the glow, `ref.layout.hub.header.logo` / `logoAspect`), the Settings chip (sliders glyph) at the right |
| Deck | a scroll view from the divider to the screen's foot; content `top` 16 under the divider, `edge` 16 from the sides, `foot` 12 + the safe bottom at the end | Three cards in reading order, later cards on top (tree order; no zIndex) |
| Card size | card = column / (1 + 2 × (1 − cover)), at least the tallest card's words + `peek` divided by (1 − cover), at least 168. Each card after the first starts `overlap` = round(card × 0.36) above the previous card's foot | 375 × 667 (column 554): cards 242, overlap 87, 155 of each upper card showing; 393 × 852: 292 / 105 / 187; 430 × 932: 327 / 118 / 209. All three fit with no scrolling at the default text size |
| Card face | the card's full size, turned `tilt` | the mode's drawn cover full bleed (`ModeCover`, baked at the card's real size); 1 pt rim in the mode's `rim`; corners 20, continuous; the `deck.shadow` and the top `deck.edge` |
| Words | top of the card, padded 18 | the mode's name in its display face (`theme.display`) in `ink`; the tagline (17/22) in `ink`; beside it, only while the card's tap works, a busy capsule (the mode's `ground`, 1 pt `rim`, a small spinner in `ink`). No status tag: the continue prompt says when there's a case to go back to. A plate of the mode's ground at 72 % behind them, fading down to clear over 56 pt below them (the mode's ink stays 4.5:1 over even a white picture) |
| Notice | over the last card's foot, centred | the dark capsule (States: Error) |

Large text: the words grow; the cards grow with them (the same share covered) so every name and tagline stays in the part no card covers, and the deck scrolls. The tag wraps under the tagline when they don't fit on one line.

### Entering a mode

A card's tap, one at a time (`HubScreen.openMode`):

1. **First time.** Noir runs The Study (`ensureSession()`, then `/tutorial`) while it has never been played (no tutorial session, or the last one abandoned). Crime scene and paranormal show their one-screen intro (`/mode/intro/<genre>`, once per device, `introSeen.ts`), whose button ("Take the case", "Step inside") starts the mode's first case with `openCapture({ genre, replace: true })`.
2. **A case to go back to:** the continue prompt (below).
3. **Otherwise:** a new case straight away, `openCapture({ genre })`: a guest to `/account?next=back`, no Pro to `/pro`, the monthly cap to the build wait's cap state, otherwise the guide, then the camera, the photos and the build. The server picks the story. If the access check can't run, the card carries on to `/capture`, whose backstop shows the guide and whose build checks access again.

**A case to go back to** (`caseStatus.ts`, from existing API functions only: `getLatestSession(TUTORIAL_ROOM_ID)` and `listMyRooms()` in parallel, then `getLatestSession(roomId)` for each mode's newest room when it is ready, three at most): the mode's newest sent room (`listMyRooms` is newest first and never lists drafts) when it is still building (queued or generating), or ready and its latest session not completed (never played, in progress, or abandoned by Restart this case). A completed or failed newest room means none, even if an older room is still open. These are the old case files' OPEN, IN PROGRESS and BUILDING; CLOSED and DIDN'T BUILD count as none. Noir also counts The Study while it is part-way through (its session active) when the player has no case of their own there.

**Data:** fetched on every focus, and only with a stored session (a guest is never made just to label the cards). A tap uses this focus's result once it has landed; until then the card goes busy and waits for it; if that fetch failed it asks once more. A failure shows the notice.

### The continue prompt (`ResumeSheet.tsx`)

The kit's `DarkSheet` over home, in the mode's colours: it is wrapped in a `ModeScope` (`src/game/mode.ts`), so the sheet, its Close chip and its pills read the mode while home itself stays the shell and the store is left alone.

| Element | Style | Content |
|---|---|---|
| Sheet | the mode's `surface`, a 1 pt `rim`, top corners 40, black 55 % scrim; slides up on `sheetRise`, away on `sheetFall` | |
| Title | the mode's display face (`titleStyle="display"`) in `ink`, header role | the mode's name |
| Line | `ref.type.subtitle` in `inkMuted` | in the mode's voice (`RESUME_COPY`): noir "You've still got a case open." (building: "Your next case is still coming together."; The Study: "The Study is still waiting for you."), crime scene "You have an open case on file." ("Your scene is still being processed."), paranormal "Something is still waiting for you." ("Something is still taking shape.") |
| Continue | the photo guide's pill (`ModePill` ghost: 52 tall, full capsule, headline label) in the mode's `accent` / `accentInk` | resumes it: `/play/<id>`; a building case opens the build wait (`/capture/develop?roomId=<id>`, the mode set first so it takes the mode's look); The Study opens `/tutorial`. The sheet goes as the route opens |
| Start a new case | the guide's ghost pill (`OutlinePill`: the mode's `ground` fill, 1 pt `rim`, `ink` label; pressed `raised`) | `openCapture({ genre })`, as a first new case; busy (spinner, Continue disabled) while it checks access; then the sheet goes. `/capture` if the check can't run |

Close, the scrim and Android back close it and return screen-reader focus to the card that opened it once it has gone.

### Settings sheet

Opened from the sliders chip. Round 6 added the Replay The Study row. Since then the sheet has been tightened so every row fits with no scroll on an iPhone SE (375 × 667, 20 pt safe top) at the default text size, even with Replay The Study: the sheet may grow to 8 pt under the safe top, rows are at least 48 tall, every detail is one short line, the sections sit 16 apart, and the version moved from an About section to the sheet's grey meta line. Large text scrolls.

| Element | Position and size (pt) | Style | Content |
|---|---|---|---|
| **Settings sheet** (over everything) | Scrim full screen. The kit's `DarkSheet`, its `maxHeight` the window less the safe top less 8 (`settings.top`), so on an iPhone SE at the default size it holds every row without scrolling (about 621 tall: its top at y 42 on 667 with no safe area, y 227 on 852). Large text scrolls | The kit's dark sheet: fill `ref.color.ground`, top corners `ref.radius.bottomSheet` 40, a 1 pt rim, black 55 % scrim; slides up on `ref.motion.sheetRise` with no spring and away on `sheetFall`; Close (the kit's chip) concentric with the corner | — |
| Sheet: header | Title on the 24 gutter; Close's disc centred on the 40 corner's centre of curvature | Title `ref.type.headline`, `accessibilityRole="header"`. The grey meta line under the title is the app's version ("Version 0.1.0"); a save that fails shows its note there instead (announced) | **"Settings"** · Version · X |
| Sheet: sections | Content padX 24, sections 16 apart (`settings.section`); each a Bold 14/20 heading (`settings.heading`, `textPrimary`, header role) 8 (`settings.headingGap`) above its group | The review screen's list style: a group is a `ref.color.raised` panel (`settings.fill`) with 8 corners (`settings.radius`, continuous); rows at least 48 tall (`settings.rowHeight`) with 6 above and below their words (`settings.padY`): a row with a detail is 52, one without 48. 16 in (`settings.pad`), label and control 12 apart (`settings.gap`), split by 1 pt `ref.color.rim` lines inset 16 from the left. Label `ref.type.body` white; a one-line detail `ref.type.meta` grey 2 under it (`settings.detailGap`; at most 34 characters, `settings.detailMax`, so it stays one line beside a switch at 375 wide); a value `ref.type.body` grey on the right; a navigation row ends in Phosphor `CaretRight` 15 grey. Pressed rows at 0.75 (proposal) | Gameplay · Accessibility · Account |
| Sheet: rows | Gameplay: Show interactives, Case clock, Sound and Music (side by side in one row), Haptics, and Replay The Study once The Study is solved. Accessibility: Reduce motion. Account: Add your email (a guest or no session) or Email (signed in, plain value); ESCAPD Pro | Switch rows: the row is the switch (a white track, black thumb when on). Sound and Music are the two halves of one 48 row (each half its own switch, at least 48 tall and about 163 wide on an iPhone SE, a 1 pt rim line between them inset 6 top and bottom), with no detail line, so the sheet still fits an SE with the Music switch added; Sound saves `sound_enabled`, Music `music_enabled`, both as Haptics does. Navigation rows end in a CaretRight and give `press` | Details (each also the row's hint): "Keep marks on things you can use.", "Your time on a case, as you play.", "A light tap as you press or find.", "The first case, from the top." (Replay The Study: it closes the sheet and opens `/tutorial`), "Fades in place of slides." Hints only (no detail line): Sound "Room tone and the click of locks.", Music "A theme for each mode." |

### Tappable elements

| Element | Hit area | Action |
|---|---|---|
| Settings chip | the 48 box | opens Settings (`press`); disabled while a card is busy |
| A mode card | the card's own visible face: where a card lies over another, the tap goes to the card on top, as it looks. Each card's centre is always on its own uncovered part (overlap < half a card) | Entering a mode. One button, "Detective Noir. Solve the case." (no status). `press` on press-in; sinks to 0.98 (none under reduced motion) |
| Prompt: Continue, Start a new case, Close | 52 pills, the 48 chip | as above |
| Settings rows | at least 48 tall (Sound and Music: each half of their shared row) | Show interactives, Case clock, Sound, Music, Haptics; Replay The Study (once solved: closes the sheet, `/tutorial`); Reduce motion; Add your email or the email; ESCAPD Pro (the version is the sheet's meta line) |
| Android back | | a busy card swallows it; the prompt or Settings closes; otherwise the system leaves the app |
| Focus order | | ESCAPD → Settings → the three cards in deck order → the notice. A sheet traps VoiceOver and hides home from TalkBack; its title takes focus once it has risen |

### States

- **Loading:** the cards show at once, without tags.
- **In progress:** no tag on the card (the user: "no in progress pill on cards"); the continue prompt is where it shows.
- **Busy (a card's tap waiting on the network):** a small `ActivityIndicator` in the mode's ink takes the tag's place; the card ignores taps and reads busy. The other cards are shaded with black at 55 % (never made see-through, so the card beneath stays hidden) and disabled, and the chip is disabled.
- **Error:** the notice capsule, "You're offline. Connect to begin." (WifiSlash) or "Couldn't start the case. Try again in a moment." (Warning). It fades in, is announced, and stays until the next tap or focus.
- **Focus:** the brass ring round the focused card (turned with it).
- **Reduced motion:** no squash; sheets cross-fade.

### Decisions

1. **Words at the top** (round 6): with each card lying over the foot of the one above, the top is the only part of an upper card that always shows, so the name, tagline and tag moved there from the foot.
2. **The tilt alternates** with the first card turned clockwise, so the next card's edge drops away under the first card's words; the 40 pt peek covers the second card's few points of lean.
3. **Dimmed is shaded, not faded,** so an overlapped card never shows through.
4. **The Study:** the first noir tap runs it. Part-played, it is noir's case to go back to (Continue resumes it) unless the player has a case of their own there; once solved it can be replayed from its case closed and from Settings → Replay The Study.
5. **No Pro lock on the prompt:** Start a new case goes through `openCapture`, which sends a player without Pro to `/pro`.

### Needs you

1. The tilt (2–2.5°), the cover share (36 %) and the shadow's weight are first values; say if the deck should lean more or less.
2. Covers are composed with their focus centre-right; on the two upper cards the lower third is covered, so the detective's coat and crime scene's floor sit partly under the next card.

## 02 · Camera

Reference: docs/refs/02-camera.png (Once), measured at 2.165 px/pt on a 393 × 852 pt screen (safe areas 59 / 34); the Mobbin footer from y 1843 px is not part of the design. This round matches it as closely as the platform allows: the flat ground, the square header buttons, the serif title over a grey meta line, the big rounded black viewfinder, the control row with its segmented zoom, the italic counter, the glowing shutter and the framed last photo. ESCAPD keeps its own copy, its Roman plate numerals, its glyphs and every behaviour. Every value is a `ref` token from `src/theme/tokens.ts` (`ref.color`, `ref.type`, `ref.space`, `ref.radius`, `ref.button.square / bare / segment / shutter / thumbnail`, `ref.gradient.shutterDisk / shutterDiskPressed`, `ref.effect.shutterGlow`, `ref.motion`, `ref.hit`, `ref.focus`) plus the screen's own `ref.layout.camera`. No silk, grain, mount, plate label, brackets, Playfair, mono stamp, brass or oxblood.

This section covers `/capture` and `/capture?retake=<i>` once camera permission is granted; everything before that belongs to 03. Route: `app/capture/index.tsx` (the shell over 02 and 03) renders `src/capture/ui/Rangefinder.tsx` after a grant; the props contract is `src/capture/ui/types.ts`.

Files in `src/capture/ui/rangefinder/`: `Header.tsx` (back, prompt, library, error line, thinking line), `SquareButton.tsx` (Once's 44 square), `Viewfinder.tsx` (the well, feed, framing grid, privacy note, and the fitting rule `viewfinderLayout`), `ControlRow.tsx`, `BareToggle.tsx` (Once's bare glyph, as a switch), `LensSegment.tsx`, `PlateCounter.tsx` (the odometer), `Shutter.tsx`, `LastPlate.tsx`, `Dimmable.tsx` (eased disabled opacity), `copy.ts` (every word), `useLenses.ts` (the lens list and the 0.5× default), `TurnDial.tsx` and `useTurnTracking.ts` (the 360's turn dial and its motion tracking; the maths in `src/capture/turn.ts`). Tests: `src/capture/ui/rangefinder/__tests__/rangefinder-test.tsx` (behaviour, hit areas, focus rings, the look, tokens only), `turnDial-test.tsx` (the dial, live and static) and `src/capture/__tests__/turn-test.ts` (the plan per lens, the lens default, the turn maths). `Brackets.tsx` is gone.

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
| Title | Prompt column x 73–320 (247 = 393 − 2 × 21 − 2 × 44 − 2 × `space.sm` 8), centred on x 196.5. Line box y 70–92 (`layout.camera.promptTop` 3 below the buttons' top) [ref baseline 87.0; render cap top 74.0, baseline 87.0] | `ref.type.serifTitle`: Roboto Serif Regular 17/22, letterSpacing 0, `textPrimary`, centred | The photo's turn prompt (`src/capture/slots.ts`, the 360, generated from the plan's stops): 1× (6): "Start here" · "Turn right a little" · "Keep turning" · "Halfway round" · "Nearly round" · "Last turn"; 0.5× (5, no stop straight behind): "Start here" · "Turn right a little" · "Keep turning" · "Nearly round" · "Last turn"; only while the photo follows the one the player just took here. Out of turn (retake mode, an open slot, a removed last photo, a camera opened on photos already taken, after library picks): the view's name, by its stop ("Front right" on 1×, "Right" on 0.5×). Every photo in the plan taken: "All the way round". All one line on 393 |
| Meta line | Line box y 95–111 (`layout.camera.metaGap` 3 under the title): 3 + title 22 + 3 + meta 16 = 44, the buttons' height [ref ink 97.9–108.1, baseline 107.8; render ink 98.0–107.7] | `ref.type.meta`: system Regular 13/16, `textSecondary` #949494 [ref #8C8C8C–#929292], centred. A second line grows the header downward and the viewfinder shrinks | The photo's detail: "Stand in the middle. Face any wall." · "Keep part of the last photo in view." (the turns between: photos 2, 3 and 5 of 6; 2, 3 and 4 of 5) · "You're facing away from photo 1." (the halfway stop, 1× only) · "After this one, you're back at the start." Retake mode: "From the middle, aim between photos 2 and 4." (the stops either side, round the circle: photo 1 sits between the last and 2). All taken: "Review your photos." The error line or the thinking line replaces it (States) |
| Library | x 328–372, y 67–111, centre (350, 89) [ref 327.4–372.2] | The same `SquareButton` | Phosphor `Images`, bold 18, `textPrimary` (in Once's QR slot) |
| Viewfinder area | x 14–379, y 140–626.7: flex 1, marginX `ref.space.plate` 14, marginTop `band.viewfinder` 29 − 2, marginBottom `band.controls` 29.7 − 4 | — | — |
| Viewfinder | x 14–379, y 140–626.7 (365 × 486.7, exactly 3:4, `frameAspect` 0.75) [ref 14.2–378.9 × 140.0–626.6; render 14–379 × 140–626.7]. `viewfinderLayout` = `containBox(area, 0.75)`, so a short screen shrinks it (centred) before any text does | One well: `ref.color.void`, `ref.radius.viewfinder` 40 continuous, overflow hidden. No border, shadow or overlay: a hard edge on the ground | `CameraView` `facing="back"`, `mode="picture"`, `ratio` "4:3" (`feedRatio`), `flash`, `selectedLens`. Black until frames arrive |
| Framing grid (when on) | Thirds, edge to edge in the well: x 135.7 and 257.3, y 302.2 and 464.4 | 1 pt (`grid.line`) `textPrimary` lines at `grid.opacity` 0.4, above the feed and under the note, hidden from accessibility; shows and hides over `ref.motion.control` | Rule of thirds. Off by default |
| Turn dial | Top-centred in the well, `turn.inset` 16 below its top (y 156); about 132 × 40 at 393 ("Photo 2 of 5"): `turn.padLeft` 4, the 32 dial (`turn.dial`), `turn.gap` 8, the line, `turn.padRight` 12, `turn.padY` 4 | The privacy note's see-through black pill (void at `note.fillOpacity` 0.6, `ref.radius.round`, continuous); the line in `ref.type.meta` `textPrimary`. The dial (react-native-svg): a `turn.ringWidth` 1 `textTertiary` ring `turn.ring` 4 in from its edge; a stop per photo in the roll's plan on it (`RollPlan.stops`), photo 1 at the top and the rest clockwise: 5 72° apart on 0.5×, 6 60° apart on 1×, re-spaced after a lens switch mid-roll (Decision 19): taken photos `textPrimary` dots (r `turn.taken` 2.75), the next a `textPrimary` ring (r `turn.target` 3.25, line `turn.targetLine` 1.5, void inside; filled white once the turn is far enough), the rest `textSecondary` dots (r `turn.rest` 1.5). While the phone's motion is tracked, a `turn.arc` 2 white arc (round caps) runs along the ring from the last stop toward the next. Neutral in every mode, as the privacy note | "Photo 2 of 5" (the photo about to be taken, which is the first open slot; the retaken one in retake mode), counted against the plan; all taken: "5 of 5 taken" ("6 of 6 taken" on 1×). Always shown, retake mode included. Out of turn the target ring marks that slot's own place round the circle and there is no arc |
| Lens note | Stacked over the privacy note, `space.sm` 8 above it (alone: in its place) | As the privacy note | "On 1.0 the photos only just meet. Switch to 0.5 to overlap them." Only on 1.0 where the phone reports 0.5, the plan's neighbours only just meet (under `MIN_OVERLAP`), the camera live and the roll not full; fades out over `ref.motion.control` when the player switches back |
| Privacy note | Bottom-centred in the well, its foot `note.inset` 16 above the well's (y 610.7); one line at 393: about 296 × 32 (padding `note.padX` 12 / `note.padY` 8), max width 333 (well − 2 × 16) | A black pill in Once's void: an absolute fill of `void` at `note.fillOpacity` 0.6 so the feed still reads through it, `ref.radius.round`, continuous. Text `ref.type.meta` in `textPrimary`, centred; Android `textBreakStrategy="balanced"`, iOS `lineBreakStrategyIOS="standard"` | "Keep people, mail, and lit screens out of frame." Until plate I is taken, never in retake mode; fades out over `ref.motion.control` |
| Control row | Box y 652.4–700.4 (48 = the glyphs' and halves' hit height), centre 676.4; space-between with paddingLeft 19 and paddingRight 21.4: the glyph boxes centred `layout.camera.controlColumns` 43 from the left edge and 45.4 from the right (x 347.6, Once's flip glyph, not the library's 350). The lens slot is an absolute fill (pointerEvents box-none), so the segment stays on the screen's centre | — | Flash · lens · grid |
| Flash | Box x 19–67, centre (43, 676.4) [ref glyph centre (43.4, 676.1)] | `BareToggle` = `ref.button.bare`: no container; glyph at `layout.camera.controlIcon` 22, `bare.glyph` `textPrimary` | Phosphor `LightningSlash` fill (off, the default) / `Lightning` fill (on): Once's filled bolt [ref 17.5 × 20.3; ours about 15 × 20] |
| Lens track | x 146.5–246.5, y 656.4–696.4 (100 × 40) [ref 146.5–246.7 × 656.3–696.5; render 656.3–695.7] | `ref.button.segment`: fill `void`, radius 16 continuous | Only when the phone reports an ultra-wide lens (iOS), after `onCameraReady`; it fades in |
| Lens thumb | 45 × 32, inset `segment.inset` 4: left x 150.5–195.5 or right x 197.5–242.5, y 660.4–692.4 [ref right 197.7–242.6 × 660.4–692.2] | `segment.thumbFill` `ref.color.thumb` #1B1B1B [ref #1A1A1A–#1B1B1B], `segment.thumbRadius` 12 continuous. Slides between its stops over `ref.motion.segmentSlide` (200 ms ease-out) | Under the chosen lens. Default 0.5 (the ultra-wide, the 360's lens) wherever the phone reports one |
| Lens labels | Centred on the thumb stops, x 173 and 220, y 676.4 [ref 173.9 and 221.2] | `ref.type.label`: system Semibold 13/16, the same size in both states; `segment.active` `textPrimary` on the thumb, `segment.inactive` `textTertiary` off it. The chosen one is followed by Phosphor `X` bold at `lensMark.size` 11.5 (7.2 of ink), `lensMark.gap` 3 after the digits, in `textPrimary` [ref "×" 7.5 × 7.7, 5 after the "0"] | "0.5" · "1.0", the chosen one with its xmark: "1.0 ×" |
| Grid | Box x 323.6–371.6, centre (347.6, 676.4) [ref flip glyph (347.7, 676.6); render glyph centre 348.0] | As Flash | Phosphor `GridNine` regular (off) / fill (on), in Once's flip slot |
| Bottom row | Box y 716.2–796.6 (80.4 = the shutter's 75 + room for its 2.7 drop above it), every child centred on y 756.4; marginTop `band.bottom` 24 − 4 − 4.2; padX `edge` 21; justify space-between, so the gaps are 65.5 and 65.5 [ref 64.7 and 65.9] | — | Counter · shutter · last plate |
| Plate counter | x 21–94, y 730.2–782.7 (`counter.width` 73 × `counter.height` 52.5) [ref 21.2–94.4 × 730.2–782.7] | `void` pill, `ref.radius.nested` 20 continuous, clipping a strip of the plan's numerals (1–5 on 0.5×, 1–6 on 1×) in `ref.type.counter` (Crimson Text Italic 29/34, +1.75, a leading pad of one step on iOS and the web so the glyphs centre), `counter.gap` 4 apart on top of the 1.75 trailing tracking and the 1.75 leading pad, so the ink sits about 7 apart [ref 7.4 / 6.4; render 6.6 / 6.7]. The strip is placed from the numerals' measured boxes so the current one is centred, nudged `counter.dx` 0.8 right (the italic's slant) and `counter.dy` 1.4 down [ref "34" ink 747.7–765.7, centre x 59.3; render "III" 747.7–766.0, centre x 60.0]. Current `textPrimary`; neighbours `textDim` #3F3F3F, evenly, cut by the pill's edges | The photo about to be taken: "1" … the plan's last. Photo 1 has no left neighbour (its right one, "2", fits inside the pill); the last and a full roll have no right one. Retake mode: the retaken photo alone |
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
| Privacy note, lens note | Not tappable | Plain text, read in focus order. |
| Flash | 48 × 48: x 19–67, y 652.4–700.4 | Toggles `flash` "off" / "on" for the camera session. Role `switch`, label "Flash", `checked`. |
| Lens "0.5" | 50 × 48: x 146.5–196.5 | iOS: `selectedLens` = the ultra-wide from `getAvailableLensesAsync()`. The default once the list reports it (`lensFor`), until the player picks 1.0. Role `radio`, "Ultra-wide lens", `selected`; large-content viewer "0.5" / "0.5 ×". |
| Lens "1.0" | 50 × 48: x 196.5–246.5 | The main lens (`selectedLens` unset): the feed starts on it until the lens list arrives, and it is the only lens without an ultra-wide. Role `radio`, "Main lens". The halves form a `radiogroup` "Lens". |
| Grid | 48 × 48: x 323.6–371.6, y 652.4–700.4 | Shows or hides the framing grid for the session. Role `switch`, "Framing grid", `checked`. |
| Shutter | The 75 box | `takePictureAsync({ quality: 0.92, exif: false })` → `feedback.tap()` → `processPhoto` → `addPlate`; the counter rolls, the thumbnail and the prompt advance. Retake: `replacePlate(i)` → `router.back()`. a11y "Take photo 3, Keep turning" (retake "Retake photo 2, Right"; all taken "Take a photo"). |
| Last-plate thumbnail | 72 × 72 | Pushes `/capture/review`. a11y "Open the light table, 2 plates"; from 3 plates "Continue to the light table, 3 plates". Disabled before plate I and while busy. Retake: "Cancel retake", calls `onClose`. |
| Plate counter | Not tappable | a11y "Next: photo 3. 2 of 5 photos taken." · "5 of 5 photos taken. That's all the way round." · "Retaking photo 2." (counted against the plan: 5 on 0.5×, 6 on 1×) |

**Focus order (VoiceOver / TalkBack):** Back → header (title and meta as one element, role `header`, polite live region) → Library → lens note, privacy note (while shown) → Flash → Ultra-wide lens → Main lens → Framing grid → plate counter → Shutter → Last plate. Focus moves to the header once the rangefinder has faded in (`motion.sceneCrossfade` 200 ms). On iOS, which has no live regions, a new prompt, error or status is announced once with `announceForAccessibility`.

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
- **Roll full (the plan's count: 5 on 0.5×, 6 on 1×):** shutter and Library at 0.4; the success haptic plays as the last photo fills it. Title "All the way round", meta "Review your photos.". The counter shows the last numeral with no right neighbour. The thumbnail keeps its ring; Flash, lens and Grid stay live (the preview runs).
- **Retake mode** (`?retake=<i>`): the counter shows that plate's numeral alone (neighbours hidden); the prompt places that plate by its neighbours (below); the thumbnail shows the plate being replaced, without a ring; Library picks 1; no privacy note.
- **No ultra-wide lens** (Android, older iPhones, the web): the centre slot is empty; Flash and Grid keep their columns and the row its height. The 360 then runs on 1× (`rollPlan("main")`): 6 stops 60° apart, whose photos only just meet, so the turn prompts' "Keep part of the last photo in view." becomes "Start where the last photo ended." There is no lens note (nothing to switch to).
- **1.0 chosen where the phone has 0.5:** as above, plus the lens note on the feed. Switching lens mid-turn keeps the turn already made; the words, the count, the dial's stops and the note change at once (Decision 19).
- **Out of turn** (the user: "when you delete one it goes back 1 too many on the slot"): the turn prompts and the live turn only work from the photo before, where the player stood a moment ago. So they apply only while the next photo is the slot right after the one the player just took with this camera, and that photo is still kept. Otherwise the next photo is placed by its neighbours round the circle (`placePrompt`, `src/capture/slots.ts`), naming only photos that exist: "Back right" / "From the middle, aim between photos 2 and 4." · "Behind" / "From the middle, face photo 3's view, then turn right a little." · "Start" / "From the middle, face photo 2's view, then turn left a little." The dial is static, its target ring on that slot's own place. Cases: a removed middle photo (its open slot is next); a removed last photo (that slot again: the player is standing at its place, so a turn on from there would put it a stop late); a removed photo 1; the slot after a filled hole (the player is at the hole's place, not the photo before); a camera opened on photos already taken; library picks. Taking the photo before in turn brings the turn prompts and the live turn back.
- **Turning** (between photos taken in turn: not before photo 1, out of turn, in retake mode, while busy or once every photo in the plan is taken): where the phone's motion can be read (`useTurnTracking`, expo-sensors DeviceMotion; iOS and Android, no permission), the turn dial's arc follows the turn from the last stop toward the next. The turn is counted from the moment the last photo's shutter fired, including the busy wait while it is prepared (the arc shows once the wait ends, with the turn made during it). At 95 % of the turn (`TURN_REACHED`, 68° of 72 on 0.5×, 57° of 60 on 1×; a re-spaced turn is measured from the stop before) the next stop fills, `feedback.tick()` plays once (straight away if the player already turned that far during the wait) and screen readers hear "Far enough. Take the photo." Each shutter starts the turn again; a lens switch doesn't. **No live tracking** (the web, no sensor, a sensor that won't start or sends no rotation, any error): the dial is static, the stops and the count only. **Reduced motion:** the arc steps in quarters of the turn instead of following it (no sweep); nothing on the dial animates in any case.
- **Large text:** title and meta grow uncapped and wrap; the header grows downward and `containBox` shrinks the viewfinder (centred). Text never shrinks. The counter's numerals cap at `counter.maxFontScale` 1.25 (the strip is placed from measured boxes, so it stays centred; the a11y label carries the sentence); the lens labels cap at `lensMaxFontScale` 1.25. Glyph sizes are fixed.
- **Narrow and short screens:** the viewfinder absorbs the difference. 375 × 667 (safe 20 / 0): the well is about 281 × 375, centred; the bottom row sits 21.4 above the screen edge. The privacy note's max width follows the well (well − 32), so it takes two lines on wells under about 328 wide, as there.
- **Reduced motion** (`useTheme().reducedMotion`): the counter does not travel (the strip jumps halfway, unseen) and the two numerals cross-fade over `motion.reducedFade` 140 ms; the lens thumb fades out and back in under the new half over 140 ms instead of sliding; the shutter press is the gradient change only, no scale; 120 ms opacity and colour changes stay; the thinking line is still.

### User notes

> "you need to follow the formatting and design as closely as you possibly can. pay attention to the colors, typography, icons, layout, and small details like shadows gradients border radius background z stacks, how things are being laid out."

Applied. Every element is placed, sized and coloured from the measured reference (brackets above): the ground, the 44 squares with their faint rim, the serif title and meta baselines, the 365 × 486.7 well at radius 40, the 100 × 40 track and 45 × 32 thumb, the 73 × 52.5 counter pill and its italic numerals, the 75 ring, 67 gradient disk, top bevel and upward glow, and the 72 / 64 frame and image. Z-order follows the reference: the glow under the ring, the disk over it, the glass over the disk; the thumb under the labels; the image under its rim.

> "the photo button has a magnifier glass icon on it."

Applied: Phosphor `MagnifyingGlass` in the reference's white icon style (regular, 28, stroke 1.75), centred on the disk, scaling with it on press.

> "the photo tracker breaks when you delete one it like goes back 1 too many on the slot. they aren't lining up properly like i feel like its optimized for 1x instead of .5x maybe it should change based on that."

Applied. Removing a photo no longer restarts the turn from wherever the phone points: the turn prompts and the live dial only run from the photo the player just took, and anything else is placed by its neighbours, statically (States, "Out of turn"). The turn is now counted from the shutter, through the busy wait, so photos stop drifting wider apart than 60°. The plan follows the lens live; 0.5× is 6 × 60° with a third overlapping; 1× keeps the full circle, says its photos only just meet and points to 0.5 (Decisions 16 and 18). *Superseded by the next note: 0.5× is now 5 × 72°.*

> "the photos are still too close i think we only need 5 or even 4 with 0.5x 6 with 1x."

Applied: 0.5× now takes 5 photos 72° apart, neighbours sharing about 20° (a fifth); 1× keeps 6 at 60°. 4 on 0.5× (90° apart) would only just touch at its 92° view, with nothing shared to stitch, so 5 is the recommendation; 4 is one number away (`TARGET_OVERLAP` 0.2 → 0 in `src/capture/turn.ts`). Every count follows the plan: the dial's stops, "Photo n of N", the turn prompts and slot names, the counter, the camera's full state and its success haptic, the review screen's "n of N taken" and "Add a photo", the library's room. A lens switch mid-roll keeps the photos taken and re-spaces the rest (Decisions 16 and 19).

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
15. **The 360 (the user's call):** "would it be best for just a 360 view of photos no taking photos of various spots?" The player stands in the middle and turns right a little between photos until back at the start, so the photos go all the way round. Each photo is still a slot with its own prompt, so retakes, open slots, flags and the minimum of 3 work as before.
16. **Shot count and turn per lens** (`src/capture/turn.ts`, `rollPlan` / `turnPlan`): the fewest photos that go round with neighbours sharing `TARGET_OVERLAP` (a fifth; it was a third until the user found 6 on 0.5× "still too close"), held to the limits (`MIN_PLATES` 3, `MAX_PLATES` 6; the backend's `max_photos_per_room` is 6 and the storage trigger refuses a 7th). Horizontal views with the phone upright and the 3:4 frame: ultra-wide 92° (Apple's 120° diagonal, 13 mm equivalent: the short side is 0.6 of the diagonal), main 55° (24–26 mm). 0.5×: 5 photos, 72° apart, about 20° (a fifth) overlapping: enough to stitch the loop, without the near-duplicates of 6. (4 at 90° would share only 2°: neighbours just touch, nothing to stitch on, and the turn prompts would word it edge to edge as on 1×. It is one number away: `TARGET_OVERLAP` 0 gives 4.) 1×: would need 9 at 40°; held to 6 it is 60°, so neighbours only just meet (about 5° of gap). The plan follows the lens in use, live (`useRollPlan(lenses.choice)`, recomputed on every switch, and on the ultra-wide being reported after mount). The plan's count is the roll's target: the camera is full there, and `MAX_PLATES` 6 stays only the server's cap. Neighbours sharing under `MIN_OVERLAP` (a tenth) "only just meet": the turn prompts then say "Start where the last photo ended." instead of asking for overlap. The trade-off on 1×: a smaller turn (37° keeps a third) would line neighbours up but six photos would then stop about two thirds of the way round, and the photos are shown as a loop round the room (06's panorama, the play screen's looping photos), whose seam would jump. So 1× keeps the full circle and says plainly that its photos only just meet ("Start where the last photo ended.") and, where the phone has 0.5, points to it (the lens note). With a higher limit the 1× plan grows on its own.
17. **0.5× by default where the phone has it** (the user: "not every phone has 0.5x although that should be the default if they have it"): `lensFor` picks the ultra-wide once expo-camera reports it (iOS's lens list, read at `onCameraReady`), until the player picks 1.0. Android (expo-camera 58 has no lens list there and `zoom` can't go below 1×), iPhones without an ultra-wide and the web stay on 1× with no segment. Until an iPhone's list is read (`useLenses().settled`) the camera plans for the roll's lens, or on a new roll the ultra-wide most iPhones have, so the count doesn't change from 6 to 5 as the camera starts; a phone without one re-plans for 1× once it says so. A camera reopened mid-roll starts on the roll's lens (the player's 1.0 included).
18. **Turn tracking:** DeviceMotion's rotation rate taken along gravity (so tilt doesn't matter), integrated per sample from the sensor's own timestamps, with a 2°/s deadband against drift and tremor and stalls over 0.25 s dropped. Units checked against expo-sensors 58's native code (and pinned by `turn-test`): `rotationRate` is deg/s on both platforms (iOS converts CoreMotion's rad/s with `radiansToDegrees`, alpha = z, beta = y, gamma = x; Android the gyroscope's with `Math.toDegrees`, alpha = x, beta = y, gamma = z) and timestamps are seconds (CoreMotion's; the gyroscope's ns / 1e9), as `turn.ts` assumes. The sensor runs while the camera is live (outside retake mode, until the roll is full), so the turn made between the shutter and the end of the busy wait is counted: before, tracking stopped while busy and restarted after it, so a player who turned as the shutter sounded (most do) turned that much more than 60° per photo, and neighbours stopped lining up. The turn restarts only at a shutter (`resetKey` is the shot), never on a lens switch (the step is read live) or on a photo being removed (which used to restart it from wherever the phone pointed, and could even bring back a stale "far enough" when the key came round again). Either way round counts (the platforms' axis signs differ). expo-sensors' config plugin is set to `motionPermission: false`: DeviceMotion needs no permission, so no motion prompt and no `NSMotionUsageDescription`.
19. **Switching lens mid-roll** (`src/capture/roll.ts` holds the roll's plan and lens; `switchLens` in `turn.ts`): the photos already taken keep their stops, and the rest of the circle, from the last slot in use back round to photo 1, is shared evenly between as many more photos as the new lens needs for `TARGET_OVERLAP`, held to the limits. So the count never drops below the photos taken, and the dial's stops still to take re-space. 3 taken on 0.5× (0, 72, 144) then 1×: 3 more at 198, 252, 306 (54 apart, 6 in all). 1 taken: the new lens's own even circle. Every stop already taken (a full roll): nothing changes; the photos already go round. Removed photos keep their stops (a hole is refilled where it was). An empty roll starts the new lens's even circle; `clearPlates` also forgets the lens. Photos in before any camera said which lens (library picks) weren't taken on stops, so the first lens reported gives its even circle if it holds them (`firstLens`). The turn in progress is kept across a switch and measured against the new gap to the target. Kept simple on purpose: the stops are the plan's, not measured headings, so a switch back and forth after a photo can settle on 6 (162° left after 4 photos still needs 2 more on 0.5×).

### Needs you

1. **Ultra-wide distortion:** 0.5× is now the default wherever the phone has it. Confirm on device that the generation pipeline copes with its barrel distortion; if not, hide the segment (`useLenses` returns `ultraWide: null`) and the 360 runs on 1× (6 photos that just meet).
2. **No flash unit:** expo-camera 58 gives no flash-availability signal, so the toggle stays live on a phone without a flash.
3. **Rounded preview on Android:** the well clips the `CameraView` at radius 40 with `overflow: hidden`; some Android preview surfaces ignore rounded clipping. Check on device.
4. **Shutter glow on device:** the glow is RN's `boxShadow` (new architecture). The web render matches the reference's profile; check iOS and Android draw it the same.
5. **Lens keyboard stops:** each lens half is its own keyboard stop (0.5 then 1.0) with one ring round the track. Keep, or make the radiogroup a single stop.
6. **Foundation tokens:** `ref.button.square.border` (`rimFaint`) and `ref.button.square.icon` / `ref.icon.control` don't match the measurements on this screen; 02 overrides them in `ref.layout.camera` (`squareRim`, `headerIcon`, `controlIcon`). Fold them into `ref.button` if 03's back control should match.
7. **Turn tracking on device:** check the dial's arc against a real 72° (0.5×) and 60° (1×) turn on an iPhone and an Android phone (the deadband and the 95 % threshold are tuned on paper), that the light tick lands as the stop fills, and that a turn started as the shutter sounds now counts. Also check that five 0.5× photos (about 20° shared) stitch and close the loop with the first; if they don't, raise `TARGET_OVERLAP` (a third gives 6). If they stitch with room to spare, 0 gives 4.
8. **Lens note wording:** "On 1.0 the photos only just meet. Switch to 0.5 to overlap them." Keep, shorten, or show it only before photo 1.

## 03 · Camera permission

Reference: docs/refs/03-camera-permission.png (pushr, "camera permission"), measured at 2.178 px/pt on a 393 × 852 pt screen (safe areas 59 / 34); the Mobbin footer from y 1854 px is not part of the design. This round matches it as closely as the platform allows: the white ground with the soft, cool grey haze behind the status bar, the full-bleed white sheet rising from below with 16 pt continuous top corners, the light grey illustration panel holding a heavy black phone outline turned in perspective (lit inner wall, dark outer wall, gloss lines, island) and cropped by the panel's foot, the wide black lowercase title, the grey system-font body, the 64 pt black pill with its white semibold label, and the spacing, colours and radii as measured. ESCAPD keeps its own copy (only the case changes), adds its quiet "choose photos instead" path in the reference's grey under the pill, and keeps every state and behaviour. There is no back control, as in the reference: leaving is the system's back.

This section describes the shell. Inside a mode the screen is the mode's dark sheet, with no haze, light status-bar glyphs, the mode's accent pill and a 0.75 press: see [Capture flow inside a mode](#capture-flow-inside-a-mode).

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
| Haze | Core #D4D4D6 at about (229, 110–150), cut off by the screen's top (≈ #F0 at y 0), white by y ≈ 288; left edge #FE at x 0, right #FA at x 390 | The kit's `PaperHaze` (`ref.gradient.haze`, fitted on this screen and shared with 05): a react-native-svg `RadialGradient` in `ambientCore` with `stopOpacity` stops, circle centre (screen centre + 12.4, 153.5), r 218, focal point (screen centre + 38.8, 113.5), so it falls off faster to the right and down; then a paper `LinearGradient` (stopOpacity 0 → 1) over y 250.7–287.5. Fitted to the reference: rms 1.7 grey levels (measured x 228: y 18 #EA/#E9, 83 #D6/#D6, 175 #D8/#D7, 229 #E6/#E5, 266 #F5/#F6, 285 #FE/#FF). Static under both motion settings, shell only (none inside a mode), hidden from accessibility | Decorative "unfocused room" |
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
| Illustration | Art box x 76.5–316.5 (240, `ref.layout.guide.art.width`), y 266–532 (266, `art.height`), centred on the screen. Ink about 131–158 wide, no wider than `art.inkMax` 170 [ref ink 131 × 265 at x 126.6–257.6; render step 1 x 124–257, y 269–529] | Line art in react-native-svg, round caps and joins, `ref.icon.illustrationStroke` 1.75 (the reference's lines integrate to 1.75–1.9). Depth from brightness only, and only a subject's outline takes its depth's ink: detail inside it is a step dimmer (back, ridge or print), as the reference's cap ridges and label lines are. **Inks:** hero `ref.color.textPrimary` #FFFFFF (the phone taking the shot); mid `lineMid` #DDDDDD (the main object's silhouette); back `lineBack` #7F7F7F (the object behind, and the main object's inner detail); context `lineContext` #555555 (the hand, an envelope, every view ray). **Thin** (`ink.thin` 1): the phone's bezel (`lineBack`, 1.3 inside the outline at corners 9.2, `phone.bezel`: the reference's darker shoulder inside its white edge), the phone's inner screen edge, a vertical gradient `lineContext` → `ink.screenBottom` #323232 [ref #555555 → #323232], and `ink.ridge` #3C3C3C details inside dark shapes. **Print** on a lit panel: `ink.text` #A8A8A8 (first line), `ink.textDim` #585858. **Fades:** context lines that run off the bottom (and step 2's walls) fade from their ink at art y `ink.fade.from` 170 to nothing at `ink.fade.to` 266 (measured on the reference's palm line: 77 at y 172, 33 at 224, 7 at 256, 0 at 266; its fingers don't fade); steps 1 and 2's view rays fade over their last `ink.endFade` 40. Every fade is a gradient with plain hex stops and separate `stopOpacity`. **Fills** (opaque, so a shape hides what is behind it): `void` #000000; `device` = `ref.gradient.deviceFill` (180°: #424242, #343434 at 0.13, #1E1E1E at 0.28, #0C0C0C at 0.42, #000000 from 0.56, as measured) inside every phone; `fill.panel` (235°: #6B6B6B → #000000 at 0.75, the reference's bottle label) on lit faces; `fill.tag` (180°: #474747 → #0D0D0D, its box label) on small labels, books and pictures. **Overlap:** back objects tuck 8–10 behind the mid one, as the reference's box behind its bottle. **Hero phone** (steps 1, 3, 4, at art (95, 108), the reference's place): `ref.layout.guide.phone` 70 × 137, corners 10.5; inner screen inset 13 / 24.5 / 27 (44 × 85.5), corners 10. **Hand** (steps 1, 4): thumb pad and palm edge to the left of the phone and the wrist under it (fading down), the index finger hooked round the top of the right edge (behind the phone), and three fingertips over the right edge: void-filled lobes about 14 wide, wide at the top right and tapering down, each tucked under the one above, at x 162–179 / 161–176 / 163–180 and y 180–209 / 203–230 / 217–244, so together they hide the phone's edge from y 181 to 242. No brackets, no brass. | One scene per step (see Steps) |
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

The copy teaches the 360 in `src/capture/slots.ts` (stand in the middle, turn right a little between photos, all the way round; the camera's prompts and turn dial echo it) and the review screen's tips. Every object is ESCAPD's own. Steps 1 and 2 are plans of the room from above; steps 3 and 4 borrow the reference's composition (the hero phone held in front at the lower right, objects behind it). Each step's pill is the same ghost pill, "Next" or "Open the camera".

| # | Title | Body | Scene (ESCAPD's own drawing) | Pill |
|---|---|---|---|---|
| 1 | Stand in the middle | Face any wall and take the first photo. | A plan of the room (back): walls with their thickness (double line, 5 apart) fading toward the near wall, the doorway a gap in it, a shelf (`tag`, ridge books) on the right wall and a table with a lamp in the far left corner. On a context ring in the middle (the spot), the phone held out a little (hero plan phone, device fill) faces the far wall, its view a lit wedge (device fill) out to the walls; the view's two rays (context) fade over their last 40. Views are the ultra-wide's 90° | Next |
| 2 | Turn right, shoot again | Turn a little. Keep part of the last photo in view. | The same plan one turn later: the first photo's phone (back) and its rays still in place, the phone turned 72° right (hero, its view lit: 0.5×'s turn, 5 photos round), so the two 90° views share about a fifth, and a small clockwise arrow (context) round the spot | Next |
| 3 | All the way round | The camera shows each turn until you're back at the start. | The hero phone held in front (as step 4, the hand behind and the fingertips over its right edge) shows the camera's turn dial on its screen: a ring (back) with 0.5×'s five stops, four lit (`panel` dots, mid), the fifth a dark ring (`tag`), the turn toward it a mid arc, and a `textDim` line for "Photo 5 of 5". Behind the phone a large clockwise arrow (back, Ø 152) goes round with the same five stops on it (`tag` discs), its head arriving back at the start. The copy names no count: the camera's plan sets it (5 on 0.5×, 6 on 1×) | Next |
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

> Round 7: "would it be best for just a 360 view of photos no taking photos of various spots?" Applied: steps 1 to 3 now teach the 360 (stand in the middle, turn right a little with overlap, all the way round), step 4 keeps people and private things out with the lights on; steps 1 to 3 redrawn. Layout, pill, Close and haptics unchanged.

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
3. **Steps 1 and 2 are plans, not the reference's composition.** The 360 reads best from above (the spot in the middle, the turn, the overlapping views), so both are diagrams; step 3 returns to the held phone, showing the camera's own turn dial. Keep, or redraw step 1 as a held-phone scene?

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

## 06 · Building your case (the build wait)

Reference: none. Its frame is 02 Camera's viewfinder and square button, its type the modes' display faces, its foot the photo guide's pill, and its ready moment case closed's stamp (Game feel 5). Values are in pt, on 393 × 852 (safe areas 59 / 34).

**Round 8 (2026-10-26), the user:** "work on making the generating room way more premium and fun, its cluttered with useless stuff like no leave room thing and it just looks slop", then "increase size of the magic rotating text on that screen too". The screen was rebuilt around one idea: **the wait is the show.** Gone: the stamp pill (SENDING PHOTOS, BUILDING, IN THE QUEUE, SECOND TRY), the body paragraph, the strip of tiny numbered tiles, the painted glass, the elapsed clock and the "Leave it building" button. What is left during the wait: the player's own room turning slowly in a viewfinder frame under a torch beam, one title, one status line (now 22 pt, the feature line), and a small square close in the header. `useDevelopment`'s state logic and the route are unchanged; internal names (`/capture/develop`, `useDevelopment`, `darkroom-root`, `ref.layout.develop`, `darkroom-test.tsx`) stay.

Route: `app/capture/develop.tsx` (`/capture/develop`, optional `?roomId=<id>` from home's Continue). It routes each stage: the wait and ready go to `BuildWait`, everything else to the shared `StateScreen`.

Files in `src/screens/develop/`:
- `BuildWait.tsx`: the screen during the wait and at ready: the header's close, the room, the title, the status line, the stamp and the foot; the room tone, the typewriter cue, Android back and the ready cues.
- `RoomPanorama.tsx`: the room. The photos as a looping row of tiles, the drift and the drag, the torch beam, the lights coming up; the Reduce Motion still and the no-photos cover.
- `copy.ts`: the title, the status lines per stage and per mode, the ready line and the stamp's word.

Removed: `PlateStrip.tsx`, `DarkroomGlass.tsx`, `DarkroomHero.tsx`, and their tokens (`develop.plate`, `.veil`, `.glass`, `.stage`, `.clock`, the old `.gap` and `.drift`). The painted magnifier (`assets/brand/magnifier*.png`) is no longer drawn anywhere; the files are kept (see Needs you).

Tests: `src/screens/develop/__tests__/darkroom-test.tsx` (52). The words per stage and mode; the loop's arithmetic; no old clutter; the live region; the line's rotation and size; the drift, the drag (it pauses the drift, follows the finger, coasts, rests and drifts again) and the settle; the baked photos and the no-photos cover with `?roomId`; Reduce Motion; the close (label, home, `press`), Android back, nothing while sending; ready's cue order (`stamp`, then `success`, then the pill) and Open the case (`thud`); send ticks; the typewriter's rules; the room tone; every StateScreen path (account, Pro, limit, error, retry, privacy flags, whole-set note, no photos); the plain-language sweep; the mode's colours and the shell.

Tokens: `ref.layout.develop` (below), `ref.type.status` (new: Medium 22/28), the kit's `ThinkingStates` (new: the `status` variant and its `colors` and `hold` props), `ref.button.square`, `ref.radius.viewfinder`, `ref.layout.play.stamp` and `.complete.slam` (the stamp and its nudge), `ref.layout.review.tile.bake`, `ref.layout.state` (the foot).

### Feel

A loading screen from a good game, not a form. You stand in the middle of your own room in the dark and someone turns slowly with a torch: your photos (5 on 0.5×, 6 on 1×; however many were taken) run side by side round the 360, the beam wandering over them, faintly brass in noir, blood red in a crime scene, cold pale blue in paranormal. You can grab the room and turn it yourself; let go and it carries on. Under it, one title in the mode's own face and one living line that says, plainly, what is happening. When the case is ready the room slows to a stop, the lights stutter on, CASE READY slams down onto the room and it jolts, and "Open the case" fades in at the foot.

Nothing on screen claims progress it doesn't have. The server reports only queued and running, so there is no bar, no percentage, no fake find or marker in the room; the running lines rotate through what building does, with no order.

### Layout, top to bottom

| Element | Size and spacing | Style | Tokens |
|---|---|---|---|
| Ground | Full bleed, flat | The capture palette's `page`: #101010 in the shell, the mode's `surface` | `palette.page` |
| Close | 02's 44 square (14 corners, 1 pt rim, 48 hit), 21 from the left, 8 below the safe top. Not shown while the photos send | Phosphor X, bold 18, in `ink` on `raised` (the camera's `SquareButton`) | `develop.header` { edge 21, top 8 } |
| Column | Under the header (16 to the room), between the screen's edges at 20; centred vertically in what's left above the foot | — | `develop.header.below`, `ref.space.edge` |
| Room (frame) | Full column width (353 on 393, 335 on 375); as tall as fits, 220 to 440 (440 on 393 × 852, about 380 on an SE) | 02's viewfinder: corners 40 continuous, the `well` colour, a 1 pt `rim` drawn over the photos | `develop.frame` { minHeight 220, maxHeight 440, rim 1 }, `ref.radius.viewfinder` |
| Tiles | As tall as the frame, 0.56 × its height wide (a centre crop of each 3 : 4 photo: neighbours in a 360 overlap, so the crop trims the repeats and about 1.5 photos show at once), 2 apart in the well's colour; drawn round the loop with enough copies that it never shows a gap | `TreatedImage`, `cover`, the mode's bake at 720 (07's bakes, reused) | `develop.tile` { aspect 0.56, gap 2 } |
| Torch beam | A veil three frames wide and tall over the room: the `well` colour at 0.84, with a soft pool of light 0.52 × the frame's width in radius (the veil at 0 in its centre, × 0.12 at 0.38 of the radius, × 0.75 at 0.78, full at the edge), tinted at its centre with the mode's `stamp` at 0.18 (none in the shell) | react-native-svg radial gradients, moved by transform only | `develop.beam` |
| Title | 28 under the room, one line at 375 in every mode | The mode's display face (`theme.display`: Playfair Display Black, Archivo Black, Crimson Text SemiBold Italic, in capitals; Roboto Serif in the shell) at the mode's size: noir 26, crime scene 21 (its wide tracking), paranormal 30, shell 26; line height × 1.22; `ink`; role header | `develop.gap.title`, `develop.titleSize` |
| Status line | 10 under the title, the column's width, one line at 375 for every line it shows | The kit's `ThinkingStates`, `status` variant: system Medium 22/28 (was 17 under the glass, and 13 before that). Its sweep runs from `inkMuted` up to the mode's `stamp` colour (to `ink` in the shell) and back; still and Reduce Motion in `inkMuted`. At large accessibility sizes it falls back to plain text and wraps, centred | `develop.gap.status`, `ref.type.status`, `develop.status.hold` |
| Stamp (ready) | Centred on the room, the large stamp: Archivo Black 34/40, tracked 4, a 4 pt frame, tilted −6° | `Stamp` (`src/render/Stamp.tsx`) in the mode's `stamp` colour (white in the shell). Hidden from screen readers (the title says it) | `play.stamp`, `play.type.stampLarge` |
| Foot | Kept all along so nothing moves when the pill comes: 16, the guide's 52 pill, `ctaBottom` 4 over the safe bottom, in the reading column (38 in). Empty during the wait | `StateActions` with `ModePill variant="ghost"`: the shell's hairline pill, or the mode's `accent` with `accentInk` | `ref.layout.state.footer`, `ref.button.ghost` |

### Motion

All on the UI thread, transforms and opacity only. The drift and the beam share one frame callback (`useFrameCallback`) that moves two shared values; nothing re-renders per frame. The callback stops once ready has settled. Photos are baked once (07's size) and never per frame.

| Motion | Values | Tokens |
|---|---|---|
| Drift | 24 pt/s to the left (photo 1, then 2: clockwise, as taken), so a turn of six photos at 440 tall takes about 62 s (five, about 52 s; the loop is just the photos taken); it wraps round the loop with no jump. It eases up from rest over 1600 ms (ease-in-out) | `develop.drift` { speed 24, rampIn 1600 } |
| Drag | A horizontal drag (8 pt dead zone, 16 pt vertical hands it back) takes the room at once: the drift stops and the room follows the finger 1 : 1. Let go and it coasts (decay, deceleration 0.996, from the fling), rests 900 ms, then eases back to 24 pt/s over 1600 ms | `develop.drift` { resume 900, deceleration 0.996 } |
| Beam | The pool's centre wanders ±0.3 × the frame's width on a 9000 ms sine and ±0.16 × its height on a 6400 ms sine, so its path never quite repeats | `develop.beam` { x, y, periodX, periodY } |
| Ready: settle | The drift eases to rest over 1200 ms (ease-out cubic) | `drift.settle` |
| Ready: lights on | The veil catches to 0.25 in 80 ms, stutters back to 0.7 in 90 ms, then lifts to 0 over 700 ms (ease-out) | `beam.flicker` [0.25, 80, 0.7, 90], `beam.lightsOn` 700 |
| Ready: stamp | 700 ms after ready, it falls from 2.2× over 220 ms, overshoots to 0.93, settles over 140 ms, its ink spreading (1.22×, from 0.45, over 420 ms); `stamp` fires on impact and the room jolts (5 pt down, 3 pt shake, 50 ms steps) | `develop.ready.stampDelay`, `play.stamp`, `play.complete.slam` |
| Ready: title and line | "Your case is ready" and its line fade in over 240 ms | `ref.motion.treatment` |
| Ready: pill | 180 ms after impact `success`; the pill fades in over 320 ms from impact | `develop.ready` { success 180, pillFade 320 } |
| Status line | Each running line holds 3200 ms; the swap is the kit's (the old line rises 8 and fades over 150, the new one 50 behind it); the sweep crosses the line every 2000 ms. A new photo count swaps the same way | `develop.status.hold`, `ref.motion.thinking` |
| **Reduce Motion** | No drift, no wandering beam, no drag. One photo at a time fills the frame and cross-fades to the next (hold 4000, fade 900); the pool stays still in the middle. The lights simply fade (700). The stamp is just there (no fall, no jolt); `stamp` then `success` 180 ms later still fire, and the pill is there at once. The status line is plain text swapping with a 140 ms fade | `develop.still` { hold 4000, fade 900 } |

### Copy, before → after (round 8)

| Where | Before | After |
|---|---|---|
| Sending: stamp / title / body | SENDING PHOTOS / Sending your photos / Photo 2 of 6. Keep the app open until they're all sent. | — / Building your case / — |
| Sending: line | Sending photo 2 of 6 | Sending photo 2 of 6 (unchanged, factual) |
| Queued: stamp / title / body | IN THE QUEUE / Your case is next / You can leave this screen. It keeps building, and you'll find it on the home screen. | — / Building your case / — |
| Queued: line | Waiting to start | Your case is next |
| Running: stamp / body | BUILDING / Finding the objects, choosing what to hide, and writing the case. This usually takes a minute or two. | — / — |
| Running: lines (shell) | Finding the objects · Choosing what to hide · Writing the case | unchanged |
| Running: lines (noir) | (as the shell) | Going over every object · Choosing what to hide · Writing the case |
| Running: lines (crime scene) | (as the shell) | Logging every object · Choosing what to hide · Writing up the case |
| Running: lines (paranormal) | (as the shell) | Searching every corner · Choosing what to hide · Writing the case |
| Running: what screen readers hear | Building your case | Building your case: finding the objects, choosing what to hide and writing the case |
| Retry: stamp / title / body / line | SECOND TRY / Trying again / The first try didn't finish, so it's starting again. You don't need to do anything. / Trying again | — / Building your case / — / Trying again |
| Ready: stamp | CASE READY (a tag pill) | CASE READY (slammed onto the room) |
| Ready: title / body | Your case is ready / Everything you need is somewhere in your photos. | Your case is ready / It's all in your photos |
| Elapsed clock | 3 min | — (gone) |
| Waiting button | Leave it building | — (gone). The header's square close: "Leave. Your case keeps building." (at ready: "Back to home") |
| Open the case | Open the case | unchanged |

Every StateScreen string (One moment, the account, Pro, limit, failure and error copy) is unchanged; see round 4 below.

### Tappable elements, haptics and sound

Haptics use the shared vocabulary in `src/game/feedback.ts`, one per moment, never on mount or per frame.

| Element / moment | When | Action | Haptic / sound |
|---|---|---|---|
| **Close** (square X, testID `build-close`) | queued, running, retry, ready | `router.replace("/")`: home; the case keeps building and home's Continue reopens this screen with `?roomId` | `press` |
| Android back | the same | the same (returns true) | — |
| (nothing) | sending | No close and no back handler of ours: the photos must all go first (as before) | — |
| The room | the wait | Drag to turn it (above). Not a button; hidden from screen readers | — |
| A photo finishes sending | the count steps up | — | `tick` (never on mount or when resuming mid-send) |
| The status changes meaning | queued, building, trying again | — | `typewriter` (sound only), never on mount, never for a photo count or a rotating line, at most once every 4 s (`TYPEWRITER_GAP`) |
| The stamp lands | ready | — | `stamp` (heavy, with its sound) |
| Then | 180 ms later | — | `success` (not `solved`: the case isn't solved yet) |
| **Open the case** (the guide's pill, testID `open-case`) | once the stamp has landed | Clears the photos, `router.replace("/play/<roomId>")` | `thud` on press-in |
| The case failed | `failed` | StateScreen | `warning` (calm, never `error`) |
| Room tone | while the wait or ready is on screen and has focus | `useRoomTone(true)`: the mode's 16 s loop at the play screen's lowered level, fading in over 1.6 s; it hands straight on to the play screen's own tone when the case opens | — |

### States

| Stage | What shows |
|---|---|
| `checking` | StateScreen loading: the thinking line "One moment" alone |
| `account` | "Keep your cases on an account" · Add your email · Back to your photos |
| `access` (entitlement) | "Your own rooms are part of ESCAPD Pro" · Try again · Back to your photos |
| `access` (cap) | "You've built every case this month allows" · Back to home |
| `sending` | The room turning, "Building your case", "Sending photo n of total". No close. A tick per photo sent |
| `waiting` queued | The room, the title, "Your case is next", the close |
| `waiting` running | The room, the title, the mode's three lines rotating, the close |
| `waiting` retry | The room, the title, "Trying again", the close |
| `ready` | The room settles and lights up, CASE READY slams, "Your case is ready", "It's all in your photos", then Open the case. The close says "Back to home" |
| no photos on this phone (followed from home after the app restarted) | Inside a mode, its drawn cover (`ModeCover`) fills the frame under the wandering beam; in the shell, the empty well. Everything else as above |
| `failed` | StateScreen with the failure copy: Retake photos / Take the photos again / Try again / Back to home, plus Back to home (quiet) unless "later". Warning haptic |
| `error` | "The case didn't go through" + the error line · Try again · Back to your photos |

### Accessibility

- The room (photos, beam, cover) and the stamp are hidden from screen readers.
- The status line is one polite live region, read by its fixed label: "Sending photo 2 of 6", "Your case is next", "Trying again", or the running label above. Rotations are never announced. At ready, "It's all in your photos" is the polite region and the title is a header.
- The close is labelled "Leave. Your case keeps building." ("Back to home" at ready), 48 hit, with the brass focus ring. Open the case is the screen's one primary.
- The status line keeps 4.5:1: its base and still colour is the mode's `inkMuted`; the sweep only brightens it. A test walks every stage for the old words (plate, develop, darkroom, light table, title screen, roll, film, AI).
- The title fits one line at 375 at the default size; at large text the title and the line wrap, centred.

### Copy, before → after (round 4, kept for the StateScreen states)

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
| Too few objects | …The plates need at least four clear objects: … develop again. | Not enough to build a case from / The photos need at least four clear objects, like a desk, a shelf, a cabinet, or a lamp. Add a close view or two and build again. **Round 7 (the 360):** "…Turn the lights on and retake from the middle of the room, or add a close photo of a busy desk or shelf." |
| Unreadable photo | A plate didn't come through / …and develop again. | A photo didn't come through / One of the photos couldn't be read. Retake it, or choose a different photo, and build again. |
| Invalid case | The case didn't hold together / These plates… four clear plates… | The case didn't come together / These photos didn't give the puzzle enough to work with. Try four clear photos from different corners. **Round 7:** "…Try six clear photos, turning all the way round the room." **Round 9:** "…Try clear photos, turning all the way round the room." |
| Blocked | These plates couldn't be developed / Retake them without people, private documents, or screens. | These photos couldn't be used / Try again with photos that don't show people, private documents, or screens. |
| Transient | The darkroom is busy / Developing didn't finish… Your plates are safe… | That took longer than it should / Your case didn't finish building this time. Your photos are safe. Try again in a minute. |
| Our side | The darkroom is closed / Something on our side stopped this case from developing. | Your case couldn't be built right now / Something on our side stopped it. Your photos are safe. Try again later. |
| Errors | …Your plates are safe… / Couldn't reach the darkroom… / Your plates were cleared… Photograph the room again. / …never sent. Photograph the room again. | You're offline. Your photos are safe. Connect and try again. / Couldn't connect to ESCAPD. Your photos are safe. Try again. / Your photos were cleared when the app closed. Take them again. / This case was never sent. Take the photos again. |
| Photo numbers on the strip | I, II, III… | 1, 2, 3… |

Unchanged: "Keep your cases on an account", "Add your email", "Your own rooms are part of ESCAPD Pro", "Try again", "The case didn't go through", "Trying again", "Open the case", "Elapsed n min".

### StateScreen (`src/components/StateScreen.tsx`, shared)

Used by the player (loading, offline, unsupported, not ready, error, update needed), the build wait, and `/account/confirmed`.

**Its props are unchanged** (`title`, `body`, `icon`, `primary`, `secondary`, `loading`). It also exports:
- `StateActions`, the pinned foot (the build wait's foot reuses it, so `src/screens/develop/ModeState.tsx` is gone)
- `StateAction` = Action + optional `testID` + optional `haptic` (`"press"` by default, `"thud"`, or `false`)

| Element | Spec | Tokens |
|---|---|---|
| Ground | Flat `ground` in the shell; inside a mode, the mode's surface (the capture flow's page). The safe top as padding | `ref.color.ground`, `useModeTheme` |
| Column | Centred vertically, 32 from the edges, text centred | `state.textInset` |
| Icon (if given) | The caller's glyph centred in a 72 well with a 1 pt `rimFaint` rim (the theme's ground: `void` in the shell); 20 to the title | `state.well`, `state.gap.title` |
| Title / body | `ref.type.title` in ink / `ref.type.subtitle` in muted ink (white and grey in the shell), 8 apart | `state.gap.body` |
| Loading | No spinner. Kit `ThinkingStates` with the title as its one line (body size), labelled with the title; a body, if any, 8 below | — |
| Foot | **The photo guide's foot (round 6):** 16, the primary pill, 8, the quiet secondary, then `ref.space.ctaBottom` over the safe bottom, in the guide's reading column | `state.footer` { pad 16, gap 8 } |
| Primary | **Round 6:** the guide's pill (`ModePill variant="ghost"`): in the shell the dark hairline pill; inside a mode filled with the mode's accent, exactly as the guide's "Next". `press` haptic on press-in unless the action asks for `thud` or none. Replaces 07's white bar (`state.bar` is removed) | `ModePill`, `ref.button.ghost` |
| Secondary | `ModePill variant="quiet" ground="dark"`, full width: a white quiet label in the shell, the mode's ink inside a mode; `press` haptic | `ref.button.quiet` |

Accessibility: when not loading, the icon, title and body form one polite live region. When loading, the thinking line is the only one.

### Decisions

- **One visual, one title, one line (round 8).** The stamp pill, the body, the tile strip, the glass and the clock each restated something; together they read as a form. The room is the only picture, the title the only heading and the line the only status.
- **The room is the player's own 360,** side by side round the loop, so the wait shows them their room becoming a case, not a generic spinner. Tiles crop the photos' overlapping sides so the row reads as one room, not a row of postcards.
- **A torch, not a scanner.** A wandering pool of light fits all three modes (the detective's torch, the investigator's flashlight, the ghost hunt) and claims nothing; a scan line or markers would suggest progress or finds we can't vouch for.
- **A toy, not a progress bar:** drag to look round, and it carries on by itself after.
- **The way out is quiet:** the camera's square close in the header replaces the "Leave it building" button. It isn't offered while the photos send (as before, they must all go first).
- **The status line is the feature line (the user: "increase size of the magic rotating text").** 22 pt Medium, title-adjacent, with the kit's sweep kept and now in the mode's colours; every line is 24 characters or fewer so it stays on one line at 375.
- **The title keeps one wording through the whole wait** ("Building your case"); the line carries the stage. The display face makes it the mode's.
- **Light voice on the running lines only.** The counts, the queue and "Trying again" stay plain; no darkroom or film words; AI never mentioned.
- **Ready is a reward:** lights on, CASE READY slammed (the victory screen's own stamp), `stamp` then `success` (not `solved`, which belongs to a solved case), and only then the pill. Its space is kept from the start so nothing jumps.
- **Sound:** the room tone plays quietly from the wait, so the room already sounds like the case when it opens; `typewriter` marks a change of status, not every line, so a two-minute wait isn't a typing loop.
- **Kept:** "One moment" for the access check, the calm failure titles and "Your photos are safe", "Back to your photos", the guide's pill for Open the case with `thud`, and the send tick's rules.

### Shots

Taken on the web build (Chromium, 2×) with Supabase mocked and six sample photos in the capture store, in `/tmp/claude-0/-home-user-escapd/17b70037-fc42-5c44-8d58-80a4e3449f5e/scratchpad/buildwait/`:
- `contact-393x852.png` and `contact-375x667.png`: noir, crime scene and paranormal, each sending, queued, running (two frames 2.6 s apart), ready mid-slam and ready settled
- `contact-extras.png`: a drag in progress, and Reduce Motion (running, the next photo, ready)
- one PNG per stage, mode and size (`<mode>-<size>-<n>-<stage>.png`), the shell (`shell-393x852-*`), and the old screen (`before-*`, `before-contact.png`)

The harness is `buildwait/shoot.js`: it swaps `useDevelopment` for a store the script drives, fills the capture store and patches react-native-web's missing `sendAccessibilityEvent`.

### Needs you

- **Feel it on a phone:** the drift speed (24 pt/s), the beam's darkness (0.84) and the drag's coast are tuned on the web build.
- **The 720 bake** (07's, reused so nothing new bakes) is a little soft on a 3× phone at 440 pt tall; a bigger bake would mean baking every photo again as the wait starts.
- **The painted magnifier** (`assets/brand/magnifier*.png`) is no longer used; delete it if nothing else will want it.
- **Typewriter and room tone volumes** follow `src/game/sound.ts`; check them on a device.
- **The StateScreen states still have no glyph;** one per state can be passed through `icon`.

## 07 · Review screen ("Photos", formerly the light table)

> **Round 6 (current): one capture flow.** "Your photos" now speaks the language of the camera (02) before it and the photo guide (04) after it, so the three capture screens read as one flow. **Where this round and the round 3/4 tables below disagree, this round wins.** The Vestiaire reference (07) still sets the order of the page: a header, the photos, a retake hint, "Add a photo", tips and one pinned action. It no longer sets the measurements. Tokens: `ref.layout.review` (round 6) in `src/theme/tokens.ts`. Code: `src/screens/review/LightTable.tsx` and its parts.
>
> **Round 7: the 360.** The photos are one turn round the room (02, 04). Tile names, labels and open-slot labels use each photo's view ("Photo 2, Front right"; "Take photo 2, Front right. This photo is open."); the camera's retake prompt names the view and where to aim ("Front right" / "From the middle, aim between photos 1 and 3."). Tips: "Keep people out of the shot." · "Tuck away mail, documents, and screens." · "Turn the lights on and hold steady." → "Stand in the middle and turn all the way round." · "Keep people, mail, and screens out of the shot." · "Turn the lights on and hold steady." Whole-set notes: too few objects "…Add a close view of a desk, shelf, or table, then build again." → "…Turn the lights on and retake from the middle of the room. If a photo is open, use it for a close view of a busy desk or shelf."; didn't come together "…Clear photos from different corners help." → "…Six clear photos, all the way round the room, help."
>
> | Element, top to bottom | Round 6 | Tokens |
> |---|---|---|
> | Header | The camera's own: a 44 square back button ("Back to the camera"), the serif title "Your photos" over the grey meta line "4 of 5 taken" (read as "4 of 5 photos taken"), counted against the roll's plan (`useRollPlan`: 5 on 0.5×, 6 on 1× or before any camera has said which lens). Replaces the centred "Photos" nav row and the Bold 18 heading | `ref.layout.camera` edge, top, promptTop, metaGap; `COPY.count` / `countSpoken` |
> | Fades | The column scrolls under the header and the foot through soft fades of the page colour (`PageFade`): `gap.top` 29 under the header, `footer.fade` 32 over the foot | `gap.top`, `footer.fade` |
> | Whole-set note | Only when a build sent the player back with `?issue=…`: a calm raised note at the camera's nested corners, `issue.pad` 18, in `ref.type.subtitle`. No glyph, not amber. Four messages: too few objects, didn't come together, couldn't use, photo missing | `issue`, `gap.issue` 20, `COPY.issues` |
> | Lead | "Retake anything dark or blurred. Together they should go all the way round." (round 7; was "Retake anything dark, blurred, or too close to read the room.") in `ref.type.subtitle`, at `ref.space.edge` | `gap.lead` 24 |
> | Photos | The camera's last-photo thumbnail grown into **3:4 tiles** (the shot as the viewfinder framed it), **two to a row**, 13 apart with 24 between rows (about 170 × 227 on 393). Each tile is the photo at the thumbnail's inner radius inside its near-black frame, with a 1 pt faint rim. 10 under each tile: the numeral in the counter's Crimson Text Italic 22 and, 8 after it on the same baseline, its name ("From the doorway"). Was: 3 square tiles to a row with "1 · From the doorway" labels above | `grid` { columns 2, gap 13, rowGap 24, labelGap 10, numeralGap 8 }, `ref.button.thumbnail`, `type.numeral` |
> | Remove | A bold white × 14 on a 30 disc of the palette's well at 60 %, 8 in from the photo's corner, on a 44 hit area. Replaces the thin × with a halo | `tile.remove` |
> | Flagged photo | A 2 pt amber ring on the frame's outer edge (where the camera draws its ring), and its reason under the name in Medium 15: "Someone's in this shot", "Mail, a document, or a screen is readable", etc. Was a single "Retake this one" | `tile.flaggedRing`, `type.reason`, `COPY.reasons`, `warning` |
> | Open slot | A removed photo leaves its slot: the tile's shape in a 1.5 dashed tertiary-grey border, with the camera glyph over "Take this photo". Tapping it takes that photo | `tile.open`, `COPY.openTile` |
> | Retake hint | The tap glyph beside "Tap a photo to retake it", 22 under the grid, the glyph 8 from the text, muted ink | `note`, `gap.hint` |
> | Add a photo | The guide's ghost pill (52 tall, the ghost button's hairline, in the palette's well), the camera glyph 10 from the label; 18 under the hint (24 under the lead with no photos); gone once the plan's count is in (5 on 0.5×, 6 on 1×), back when a photo is removed | `add`, `gap.add`, `ref.button.ghost` |
> | Before you build | The guide's step title, 44 under the pill. Tips are a plain list: a 30 raised disc holding the numeral in the counter's italic, the tip in Regular 17, 12 after the disc, tips 14 apart. Then the privacy line in Regular 15, 22 under the tips | `section`, `tips`, `type.tip`, `type.tipNumber`, `type.note` |
> | Foot | The guide's foot, pinned: 12 of padding, then the helper line (Regular 15, 12 above the pill) when the case can't build yet, then "Build the case" as the mode's primary pill in the reading column, `ref.space.ctaBottom` over the safe area. Replaces the white 48 bar with 2 pt corners | `footer` { pad 12, helperGap 12 }, `ModePill` |
>
> **Inside a mode**, every colour comes from the capture palette (`src/capture/ui/palette.ts`): the ground, raised discs and notes, ink, muted ink and lit numerals; "Build the case" is the mode's primary pill; every photo shows in the mode's baked treatment (`tile.bake` 720 px on the long edge, one bake shared by the tiles, the camera's last photo and the build wait's strip). The flagged amber stays in every mode.
>
> **Haptics** are unchanged from round 4 (`press` on tiles, ×s and open slots; `thud` on a live "Build the case").

> **Round 4 (2026-10-25), the user's feedback:** "before you develop shouldnt have the scrolling 3 things jsut list them vertically, no see all button and the warning should be less threatening and dont mention AI. I also think we should drop the light table dark room thing its not very self explanatory. the step by step thing should show before you make a room every time." Plus "add some haptics too". What changed here:
> - **Plain language** (the round 4 glossary): title "Photos", heading "Your photos", "Add a photo", "Tap a photo to retake it", labels "2 · Front right" (round 7: each tile named by where it looks from the middle of the 360, from its stop in the roll's plan: Start, Front right, Back right, Behind, Back left, Front left on 1×; Start, Right, Back right, Back left, Left on 0.5×; Arabic numerals), "Retake photo 2" / "Remove photo 2", "Build the case". No plate, roll, light table, darkroom, develop, AI or "never".
> - **"Before you build"**: the three checks as friendly tips in a plain vertical list; no sideways cards, no "See all".
> - **The privacy line** reassures instead of warning: "Your photos are only used to build your case. No one else sees them.", with no lock glyph.
> - **Softer blocked states:** a flagged photo says "Retake this one" (still amber, still a 2 pt amber rim); the helpers read "Retake the marked photos, then build the case." and "Take at least 3 photos to build the case."
> - **Haptics** (`useFeedback`): `press` as a tile (retake) or a × (remove) is pressed in; `thud` as the live "Build the case" bar is pressed in (the commit); nothing on the disabled bar.
> - Everything else below is unchanged from round 3 unless a row says "Round 4".

Reference: docs/refs/07-light-table.png (a resale app's "Photos" screen), 1179 × 2676 px = 393 pt at 3 px/pt. The screen is the top 852 pt; the grey "curated by Mobbin" bar (from y 852) and the app's tab bar (y 768.7 to 852) are not part of the design, because ESCAPD has no tab bar. This round matches the reference's layout, type sizes and weights, shapes, sizes, spacing and icon style as measured. It does not copy its colours: the user said "you dont have to port over the colors but everything else". Each colour role maps to the camera screen's dark palette in `ref`. ESCAPD keeps its own copy, its plate prompts and every behaviour the screen had. No names, copy or logo come from the reference app.

Route: `app/capture/review.tsx` (`/capture/review`, optional `?flag=0,2`) reads `flag` and renders `src/screens/review/LightTable.tsx`. Files in `src/screens/review/`:
- `copy.ts` holds every word.
- `ReviewHeader.tsx` is Back and the title.
- `AddPlateButton.tsx` is "Add a photo" (round 6: the guide's ghost pill).
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
- **Round 7, the 360** (supersedes the prompts above): camera titles "From the doorway" · "Opposite corner" · "The busiest wall" · "A close view" · "Another angle" · "Last photo" → "Start here" · "Turn right a little" · "Keep turning" · "Halfway round" · "Nearly round" · "Last turn"; details "Wide. Include the floor and two walls." · "Overlap the first photo." · "The wall with the most objects." · "A desk, shelf, or table." · "Optional. Anything still unseen." · "Optional. One more overlap." → "Stand in the middle. Face any wall." · "Keep part of the last photo in view." (2, 3, 5) · "You're facing away from photo 1." · "After this one, you're back at the start."; review tile names → "Start" · "Front right" · "Back right" · "Behind" · "Back left" · "Front left"; guide steps "Start at the doorway" / "Work around the room" / "Get one close view" → "Stand in the middle" / "Turn right, shoot again" / "All the way round"; permission body "You'll take 3 to 6 photos of one room." → "You'll take up to 6 photos, turning round one room."
- **Round 9, 5 on 0.5×** (the user: "the photos are still too close i think we only need 5 or even 4 with 0.5x 6 with 1x."): the roll's count follows the lens (5 on 0.5×, 6 on 1×), so no copy names a fixed 6. Camera: "6 photos is the most a case takes" → "All the way round" (meta "Review your photos." kept); counter label "6 of 6 photos taken. That's the most a case takes." → "5 of 5 photos taken. That's all the way round." ("6 of 6" on 1×); "Photo 2 of 6" → "Photo 2 of 5" on 0.5×. 0.5×'s prompts: "Start here" · "Turn right a little" · "Keep turning" · "Nearly round" · "Last turn" (no "Halfway round": no stop is straight behind); tile names "Start" · "Right" · "Back right" · "Back left" · "Left". Review: "4 of 6 taken" → "4 of 5 taken" on 0.5×; whole-set note "…Six clear photos, all the way round the room, help." → "…Clear photos, turning all the way round the room, help." Build failure: "…Try six clear photos, turning all the way round the room." → "…Try clear photos, turning all the way round the room." Permission body kept: "You'll take up to 6 photos, turning round one room." (6 is the cap on either lens). Guide copy unchanged (it never named a count); its art shows 0.5×'s five stops.
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

> **Round 7 (current): the photos loop, and a thumbnail wheel replaces the page dots.** Your note: "photos should loop around with another swipe, have the photo small at bottom instead of the generic dots … a wheel where it shows the one you are on in the middle and the one on the left and right and they animate swipe like a wheel quickly along with the swipes." Swiping past the last view brings the first in from the right, and before the first comes the last, with no snap-back; the accessibility actions and the wheel's taps wrap too. The page dots are gone: at the photo's foot a small drum of thumbnails (the photos in the mode's treatment) shows the view in view in the middle and its neighbours either side, turned away, and it turns with the finger on the pager's own swipe position. Details in "Swiping photo to photo" below; tokens `ref.layout.play.wheel`; tests `src/render/__tests__/scenePager-test.tsx`.
>
> **Round 6: the photo guide's buttons in play.** 07's white bar (`WhiteBar`) and the outlined pill are gone from the player, its sheets, the code pad, the worktable, the suspects and accuse screens and Case closed. Every strong action is now the photo guide's pill (`ModePill variant="ghost"`: the mode's accent inside a mode, as the guide's "Next"; busy shows a small spinner), and every quiet action is `ModePill variant="quiet"`. The pinned band is the guide's foot: its reading column, the pill, then the quiet pills `ref.space.sm` apart. `ref.layout.play.bar` and `.outline` are removed; `type.action` (Semibold 16) is now only the keypad's Clear key. Haptics are unchanged. Where the tables below say "white bar" or "outlined pill", read "the guide's pill" and "a quiet pill".

Reference: none. Derived from the rebuilt screens so that a player moving from the camera or the hub into a case feels no change of app: 02 Camera (Once) for the chrome (the flat `ground`, Once's 44 pt square header buttons, the Roboto Serif title over a grey meta line, near-black wells, white glyphs whose shape shows state, the italic numerals), 01's How you play sheet for every sheet (the kit's `DarkSheet`), 07 Light table for cards, hint rows, the outlined pill and the white bar, and the shared StateScreen for loading and errors. Round 4 (your feedback): no Explore as list, no photo strip, the photo full bleed and swiped photo to photo with no gap, a sliding code picker, plain words (no "plate"), and haptics. 393 × 852 pt, safe areas 59 / 34, values in pt. Room photos keep their full colour.

Routes: `app/tutorial/index.tsx` (The Study, with coach marks) and `app/play/[roomId].tsx` (your own room; the tutorial's id redirects to `/tutorial`) both render `src/render/Player.tsx`; `app/tutorial/complete.tsx` is Case closed.

Files in `src/render/`: `Player.tsx` (states, header, tray, failure line, code sheet, Case options, all game wiring), `ScenePager.tsx` (the looping swipe between views and the thumbnail wheel), `SceneView.tsx` (one view: the full-bleed fit, pinch, pan, loupe, Use-mode ring), `HotspotLayer.tsx` (brackets, seal, trace, thread, reading order), `InventoryBar.tsx` (tray, Use card, worktable), `ItemIcon.tsx`, `CodePad.tsx`, `CodeWheel.tsx` (new: the sliding digit picker), `ResultSheet.tsx`, `CoachCard.tsx`, `Toast.tsx`, `parts.tsx` (`SquareButton`, `WhiteBar`, `OutlinePill`, `QuietToggle`, `RingPressable`, `Card`, `NoticeLine`), `geometry.ts` (plus `fillWidthFit`, `freeMargin`). Deleted: `ExploreList.tsx`, `SceneStrip.tsx`. Kit: `src/components/noir/DarkSheet.tsx`. Tests: `src/render/__tests__/Player-test.tsx` (the whole Study through submit_action, the look, the pager, reading order, haptics, the code wheels, tokens only), `scenePager-test.tsx` (the loop, the wheel, Reduce Motion), `complete-test.tsx`, `geometry-test.ts`.

Tokens: `ref.color`, `ref.type` (`serifTitle`, `headline`, `meta`, `body`, `subtitle`, `tag`, `title`), `ref.space`, `ref.radius` (`bottomSheet`, `square`, `nested`, `knob`, `tag`, `round`), `ref.curve`, `ref.button.square / chip / quiet / ghost / disabledOpacity`, `ref.icon.chip`, `ref.focus` (via the kit), `ref.motion.counterRoll / sheetRise / sheetFall`, `ref.layout.hub.sheet` and `hub.chipRing` (the sheet is the hub's, shared through `DarkSheet`), the live `motion` timings, `z` and `hit`, and the player's own `ref.layout.play`. No live colour, type, font, radius or space; no Grain, walnut, brass (the focus ring excepted), manila, Playfair, Jakarta, mono stamps, oxblood or amber.

### Feel

The camera, turned round: the room you photographed is now the room you search, and it fills the screen. The same flat near-black ground and two-tone square buttons, a serif case name over a quiet grey "View 1 of 3", then the photo edge to edge, square at the sides, in full colour. Swipe it and the next photo slides in touching it, following the finger and settling without a bounce. Everything the game draws over the photo is white or grey: thin corner brackets on a faint black halo, grey brackets and a small check once an object is spent, heavier white ones where something just appeared, and a small wheel of thumbnails at the photo's foot that turns as you swipe. Under it, a tip card and a row of square item buttons over black wells. Sheets slide up as the hub's does. One white bar is the strong action wherever there is one. Nothing glows; the only colour is the room.

**Accent:** none. Brass only in the focus ring.

### Layout, top to bottom (player)

| Element | Position & size | Style | Content |
|---|---|---|---|
| Screen | full bleed | `ref.color.ground` | — |
| Header row | squares y 67–111 (44, 48 hit; the slop inside the row), padX `play.edge` 21 | 02's row: one square each side, the title column between | Back · title · Case options |
| Squares | 44 × 44, 48 hit | `ref.button.square`: `raised`, radius 14 continuous, 1 pt `play.squareRim` #232323; Phosphor bold 18 (`play.headerIcon`) white | ArrowLeft · DotsThree |
| Title | line box from y 70 (`promptTop` 3), centred, one line | `ref.type.serifTitle` (Roboto Serif 17/22), `textPrimary`, role header | The case title |
| Meta | `metaGap` 3 under the title | `ref.type.meta`, `textSecondary`; hidden from screen readers (the photo's label and the thumbnail wheel say it) | "View 1 of 3" |
| Photo area | from `band.photo` 12 under the squares to the tray; full width; `ScenePager` | Pages one screen wide in a row, no gap | — |
| Photo (each page) | Fills the width (3:4 on 393: 524 tall), centred in the area; square edges | `SceneView`, `fillWidthFit`: when the area is shorter than the photo, cropped evenly top and bottom only while each side loses no more than the hotspot-free margin and `photo.maxCrop` 10 % (so no hotspot is ever cut); otherwise contained (narrower, uncropped). Hotspot rects stay fractions of the image box, so geometry is exact either way. Use mode: a 1.5 white ring inside its edge (`photo.armed`) | The room photo, full colour |
| Hotspot brackets | the hotspot's rect | 10 arms, 1.5 inset, 4 side ticks (`play.brackets`); white 1.5 over a void halo 4 wide at 0.55; idle 0.42, bright under Show interactives, Use mode, a coach mark or a reveal. Solved: grey + a 16 void disc with a white Check 10 (`play.seal`). Just revealed: white 2.5 (`brackets.iris`). Solve flash: a 2 white outline. Reveal thread: dashed white on a halo | — |
| Thumbnail wheel | centred, `wheel.inset` 8 above the photo's foot; the control 124 × 56 (`span` × `slot`) | A drum seen from the front: the view in view 36 × 48 (3:4) in the middle, fully lit; each neighbour 38° further round a 64 pt drum (39 pt to the side), turned away 23° (0.6 of that, perspective 320), at 0.76 and under void at 0.5; one further at 0.58, fading out between 1 and 1.6 views off centre. Radius 10 continuous (02's last photo, scaled), a 1 pt edge in the mode's rim, a soft shadow `0 3 10` black 0.55. A view with something new: a 7 pt white dot ringed in void on the corner. Hidden with one view | The views' photos in the mode's treatment (baked once at 144 on the long edge) |
| Loupe | 136 circle | 4 `well` ring, 1 `rimFaint` inner rim, 2.2× | — |
| Toast | top of the photo area, 12 down | 02's privacy note: void pill at 0.6, meta white | "That doesn't work here." etc. |
| Tray | `band.tray` 12 under the photo area; rows `band.row` 12 apart; `band.foot` 8 above the safe bottom | `ground` | notice, items |
| Notice slot | edge 20 | Coach: 07's card, white Lightbulb 18, Regular 14/20 white. Hidden while an item is chosen (the Use card or the worktable takes its place; the coach's target hotspot stays highlighted). Failure: the card with 02's error line, an outlined "Try again" and a quiet "Dismiss" | — |
| Use card (one item chosen) | edge 20 | 07's card: name Bold 16, description 14 grey, the instruction in meta grey, quiet "Cancel" | "Select an object in the room to use this artifact." |
| Worktable (two chosen) | edge 20 | 07's card: two void sockets (glyph, "Slot A" grey, name white) with a grey Plus; quiet "Cancel" and the white bar "Close clasp" | — |
| Items | one row, 4 tiles across (81.75 × 72 on 393, min 76), 8 apart | 02's square button: glyph 22 over the name (meta, 2 lines). Chosen: a 1.5 white ring and the glyph's fill weight. Empty places: void wells; no items: one void well with "Items you find appear here." | — |

On 393 × 852 the photo is full width in every state shot (start, Use mode, worktable, toast, assist, reveal): the coach gives way to the Use card and the worktable, the tray is 72, and the crop takes up the rest within the hotspot-free margin.

### Swiping photo to photo (`ScenePager`)

- A pan from the gesture-handler hook API (`testID` `scene-swipe`) drives the pages; it wins after 12 pt sideways (`pager.activeOffset`) and fails after 12 pt vertically, one finger only.
- **The loop.** One shared value, the pager's position, counts views round the loop without wrapping (0, 1, 2, 3 … is view 1, 2, 3, 1 … of 3). Each mounted page sits (its slot − position) screen widths from the middle, so past the last view the first is simply the next slot to the right, already mounted and touching it: there is no jump or rewind at the seam. Only the slot in view and one each side are mounted (keyed by slot, so a page that arrives keeps its state); with two views the slots either side both show the other view, as a loop of two does. With one view nothing loops: the page follows at 0.3 (`edgeResistance`) and returns.
- It follows the finger, at most one page either way.
- On release it projects 0.2 s of velocity, snaps to the nearest page (one at most), and settles on an ease-out with no overshoot (`pager.easing` [0.25, 1, 0.5, 1], initial slope 4), its duration matched to the release speed within 180–380 ms. No spring. The view in view is reported (wrapped) as the swipe is released, so "View n of N" and the wheel's value change then.
- Hotspots, gestures and the photo's accessibility belong to the view in view only, and its brackets settle in as it arrives.
- Zoomed in, the pager stands down (the pan moves the photo). The loupe's press-and-hold blocks the swipe (`pagerGesture`): a swipe waits for the hold to fail, which it does as soon as the finger moves, and a held loupe is never swiped away.
- A hotspot's press-in waits 120 ms (`hotspotPressDelay`), so a swipe that starts on one doesn't press it; a quick tap still does.
- **The thumbnail wheel** (`ref.layout.play.wheel`) sits on the photo's foot in place of the page dots. Its five slots (far left, left, current, right, far right, round the loop: on view 1 of 3 the left one is view 3) each take their place from the same shared position as the pages: at d = slot − position views off centre a thumbnail is d × 38° round a 64 pt drum, so 64 · sin(d × 38°) to the side, turned 0.6 × d × 38° about its vertical axis (`tilt`: enough to read as a drum, little enough to stay legible), scaled 1 → 0.76 → 0.58 over d = 0, 1, 2, dimmed by void at 0.5 × |d| (up to 0.5) and faded out between |d| 1 and 1.6. All on the UI thread (one `useAnimatedStyle` per thumbnail, no re-render per frame), so the drum turns with the finger and settles with the page on the same curve. Each photo is the mode's treatment through `TreatedImage` with `maxEdge` 144: one small bake per photo, cached, never per frame.
- Tapping a neighbour goes to it: the 44 pt strips either side of the middle thumbnail are the targets (left: previous, right: next, round the loop); a tap on the middle thumbnail passes through to the photo.
- The wheel is the pager's one accessible control: role adjustable, label "View", value "1 of 3" (plus "Something new on view 2" when there is), increment / decrement, which wrap (next from the last is the first). The thumbnails and tap strips aren't read on their own. A page settling on a new view gives a `tick`.
- Reduced motion: the pages don't follow the finger; a swipe past 40 pt or 500 pt/s changes the view with a quick cross-fade (`motion.reducedFade`), and the position jumps while the photo is faded out, so the wheel doesn't turn: it just updates.

### Sheets (kit `DarkSheet`)

`ground` fill, 40 top corners (`ref.radius.bottomSheet`), a 1 pt `rim`, black 55 % scrim (clear for the result, so the scene stays visible), Close as 01's 36 chip; slides up on `ref.motion.sheetRise` and away on `sheetFall`, no spring; cross-fades under reduced motion; focus to the title; VoiceOver trapped. New: `scrollEnabled`, held off while a code wheel is dragged.

- **Result** (58 %): title in `serifTitle`; the message on 07's card (body 16/23 white; the description 14 grey); "Added to your items" (Bold 14) with item rows; a reveal hint row with Eye 18: white "Something new is within reach." in this view, grey "Something changed on another view." in another; the white bar "Pocket artifact" / "Continue".
- **Code** (90 %): title `serifTitle`, meta the hotspot's name; the prompt 14 grey; the wheels (below); fixed slots / free field / keypad as before; the message row (02's error line); the white bar "Test combination" / "Try code" (no press haptic: the outcome gives one); "Check your items" quiet toggle.
- **Case options** (64 %): the Show interactives row (the hub's switch, a `tick` when flipped) and a quiet "Restart this case" (the system confirm follows). Explore as list is gone.

### The code wheels (`CodeWheel`)

Each wheel is a vertical picker in a 64 × 132 void well (radius 20, 02's counter pill): three 44 rows; the digit in view in the middle row in 02's italic (`play.type.digit`, Crimson Text Italic 29/34) white, the neighbours above (one less) and below (one more) in `textDim`, as the counter's. Drag it up or down to roll the digits (after 4 pt): it follows the finger, then snaps to the nearest digit on the pager's no-overshoot curve, projecting 0.12 s of velocity, 140–420 ms; 9 rolls to 0. Tapping a neighbour steps to it. A light `tick` per digit that passes the middle. Screen readers: one adjustable element per wheel, "Digit 1", value "4", increment / decrement. Keyboard: the neighbours are focusable, each with the brass ring just inside the well. A wrong code resets the wheels (rolling back quietly, no ticks), shakes them and shows the error line. Reduced motion: the drag steps a digit at a time and there is no momentum. The caret steppers are gone.

### Layout (Case closed)

Unchanged from round 3: `ground`; a centred column (inset 24): 01's tag pill "CASE CLOSED", "The Study" in Roboto Serif 30/36, the server's message (body white) and the exit line (subtitle grey), two 07 stat cards (Time, Hints used), "The next case is your own room." in 14 grey; the pinned band: the white bar "Photograph your room", quiet "Back to start", quiet "Replay The Study". Copy checked for the old metaphor: none. (Superseded by Game feel · 5: the band is now the guide's pill "Start a new case", quiet "Back to Detective Noir", which goes home, and quiet "Replay The Study". Its measurements now follow Game feel · 5, **One screen**.)

### Haptics (`useFeedback`)

| Moment | Haptic |
|---|---|
| A page settling on a new view (swipe, wheel tap or accessibility action) | tick |
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
- the other views are one adjustable control away (the thumbnail wheel: swipe up or down, round the loop), and the photo's label says which view this is ("View 2 of 3");
- hidden hotspots stay absent until revealed, as before.

### Tappable elements

| Element | Hit | Action |
|---|---|---|
| Back | 48 | `onExit` |
| Case options | 48 | opens Case options |
| Hotspot | its rect, grown to 48 | inspect / use the chosen item / open the code pad |
| Photo | — | swipe to the next or previous view, round the loop; pinch, pan when zoomed, double tap, press-and-hold loupe |
| Thumbnail wheel | 44 × 56 strips either side of the middle thumbnail | left: previous view; right: next (round the loop); the middle passes the tap to the photo |
| Item tile | ~82 × 72 | toggles the item |
| Cancel / Close clasp | 48 | leave Use / combine mode; send combine |
| Try again / Dismiss | 44 / 48 | retry the failed action; dismiss |
| Code wheel | 64 × 132 (neighbours 64 × 44) | drag to roll; tap a neighbour to step |
| Sheet Close / scrim | 48 / outside | close; focus returns to the hotspot |

Focus order: Back → title → Case options → the photo → its hotspots in reading order → thumbnail wheel → notice → items.

### States

Loading, offline, can't open, isn't ready, didn't open, needs an update: the shared StateScreen. Ready; mid-swipe (two photos edge to edge); Show interactives on; a coach mark; Use mode (ring on the photo and the tile, Use card, no coach); worktable (no coach; busy: the bar's spinner); result found / quiet / revealed here / elsewhere; code: idle, mid-drag, set, wrong, failed send, solved; a failed request; a toast; completing (chrome fades, photo pulls back, swiping off, then Case closed). Reduced motion: no finger-following or momentum, cross-fades instead.

### Copy before → after

- "Plate I of III" (header) → "View 1 of 3"
- Photo label "Plate 1 of 3" → "View 1 of 3"
- "Something changed on another plate." → "Something changed on another view."
- Coach: "The room has more than one view. Tap the second view below." → "The room has more than one view. Swipe to see the next one." (`src/tutorial/coach.ts`, text only)
- Strip labels "Plate I, view 1 of 3" → the page dots (round 7: the thumbnail wheel): "View", "1 of 3"
- Code wheels "Increase / Decrease digit 1, currently 0" → "Digit 1", value "0"
- Worktable heading "Worktable" removed (the sockets and Close clasp say it)
- Explore as list, its rows and its header button: removed

### Decisions

1. **Full bleed with a safe crop.** The photo fills the width; when space is short it is cropped evenly top and bottom only into the margin no hotspot reaches (and at most 10 % a side), so nothing important is cut; beyond that it is contained. In every state on 393 × 852 it stays full width.
2. **The coach gives way** to the Use card and the worktable, so the photo keeps its height; the coach's target stays highlighted on the photo.
3. **A thumbnail wheel** on the photo's foot (round 7; round 4 had page dots): the position cue, the "something new" mark, and the adjustable accessibility control in one place, now showing the neighbours themselves and turning with the swipe.
4. **Only the view in view has hotspots**; neighbours are the photo alone, and their brackets settle in on arrival.
5. **Header:** one square each side now that Explore as list is gone; the title column is wider (247 on 393).
6. **Code wheels** reuse the camera counter's look (italic white digit, dim neighbours) and the pager's settle curve.
7. **The loupe blocks the swipe** (gesture `block`) and fails on movement, so a held loupe never pages and a swipe never shows the loupe.
8. **Lock opening:** one `success` from the outcome; no press on Test combination.
9. **The worktable heading** was dropped to save its 32 pt.

### Needs you

1. **The thumbnail wheel over the photo's foot** takes two 44 × 56 tap strips either side of the bottom centre (124 pt across in all; the middle thumbnail passes taps through); a small hotspot exactly there would be harder to tap. Alternative: the wheel under the photo (costs about 64 pt of photo).
2. **Reading order** uses React Native's `experimental_accessibilityOrder`; check it on device (VoiceOver and TalkBack).
3. **Crop limit:** 10 % a side at most; a room with hotspots at the very top or bottom contains instead (narrower, with side bands) in tight states.
4. **Native switch** (Case options): 51 × 31 on iOS, under 44, as in the hub.
5. **Shared tokens:** none added. New geometry is in `ref.layout.play` (`pager`, `wheel` (round 7, replacing `dots`), `code.wheel`, `hotspotPressDelay`, `cueRing`; `photo.maxCrop`); `plates`, `gap`, `armedGap` and `code.caret` were removed.

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
| Home: "just the escapd logo" | The ESCAPD logo from the brand art (round 8), large and centred. No magnifier, no "Case files" |
| Case screen: no photos at the bottom, taller, "no side bars", swipe "with 0 margins" | Full-bleed photo pager, square-edged with 0 gap, follow-the-finger with a no-overshoot settle, page dots on the photo's foot (round 7: the photos loop and a thumbnail wheel replaces the dots), "View 1 of 3" |
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
- **08 · Thumbnail wheel:** its tap strips (two 44 × 56 strips either side of the photo's bottom centre) could make a tiny hotspot right there harder to tap. The alternative is the wheel under the photo, which costs about 64 pt of photo height.
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
- account management
- the case intro
- the countdown after a wrong code
- cancelling a development

## Brand (round 8)

The user's brand art (a lit doorway in a purple rounded square, a cat peering round the door, and ESCAPD in cream with the A's keyhole lit amber) is cut into the app's assets by `scripts/brand/make.py` (the source image isn't kept in the repo):
- **App icon** (`assets/icon.png`, 1024): the art inside the rounded square, cropped clear of its rim and corners, so it fills the icon and the platform's own mask rounds it.
- **Android adaptive icon:** `android-icon-background.png` is the art's edge purple (#2F121F); `android-icon-foreground.png` is the art at 70 % in the middle, feathered into that purple so no square edge shows inside the launcher's circle or squircle; `android-icon-monochrome.png` is the lit doorway as the shape (the door and cat cut out of it), for themed icons.
- **Splash** (`assets/splash-icon.png`): the rounded icon with its orange glow, the dark page keyed to clear and the glow faded out before the crop's edge, on the existing #090807.
- **Logo** (`assets/brand/wordmark.png`): ESCAPD with its glow, the dark page keyed to clear (alpha from the brightest channel, the colour un-blended from black), on home's header. The old drawn `Wordmark` component is removed.

## Modes

Three modes (MODES_PROMPT.md, Part 2): Detective Noir, Crime Scene and Paranormal. The shell (home, Pro, account) keeps the reference look above. The screens inside a mode take that mode's theme: its first-time intro, the capture flow it opened (guide, camera, review, build wait), and the player with its case-closed screen. Round 6 removed the mode's own screen (the case list): a mode card goes straight into the mode (01 · Entering a mode).

### Themes and the active mode

- **Tokens:** `modeThemes[genre]` in `src/theme/tokens.ts` holds the only mode colours. Each theme has `ground`, `surface`, `raised`, `ink`, `inkMuted`, `accent` (a fill), `accentInk`, `stamp` (text in the mode's colour), `rim`, `glow` (paranormal) and `detail` (crime scene's police-tape yellow, tiny accents only), plus `display`, `name`, `tagline` and `treatment`. `shellTheme` is the reference look with no treatment.
- **Contrast:** `ink`, `inkMuted` and `stamp` reach 4.5:1 or more on `ground`, `surface` and `raised`, and `accentInk` on `accent` (`src/theme/__tests__/modeThemes-test.ts`). Crime scene's red fill (#A3201F) is too dark for text, so red text uses `stamp` (#E2524C).
- **Display faces** (Google Fonts, loaded in `app/_layout.tsx`, `ref.font.*Display`): Playfair Display Black, Archivo Black and Crimson Text SemiBold Italic, all set in capitals.
- **The active mode** is `src/game/mode.ts` (`useMode`, `setMode`, `useModeTheme`; null is the shell). It is set on focus by `useModeOnFocus` (home passes null, a mode's intro its genre), by the player from `definition.genre` (absent means noir), by `openCapture({ genre })`, which also keeps the genre with the roll, so `developPlates` creates the room in it, and by home's Continue before it opens a building case's wait. `<ModeScope genre>` shows one mode inside a part of the shell without setting the store: home's continue prompt is one, over home.

### Photo treatment

- **Baked once:** every photo inside a mode is shown through `TreatedImage` (`src/components/noir`): the /play pager and loupe, review tiles, the build wait's turning room, the camera's last photo and home's mode cards. `treatPhoto.ts` bakes each photo once per mode on an offscreen Skia surface (`@shopify/react-native-skia` 2.14.0), at its own size up to 1600 on the long edge. The order is the mode's colour matrix over its toe (each channel keeps the brighter of the two, so a hard contrast never crushes the darkest tones to one black), then paranormal's glow (the graded photo at quarter size, blurred and screened back over it), then grain (a tile of fractal noise, overlaid), then a radial vignette. It is encoded to JPEG and cached by (photo, mode, size): on native in the cache directory, on the web as a data URL in memory. Bakes run one at a time.
- **Cache files** are named for the recipe (`ref.treatment` and every mode's treatment) and the photo: its `cacheKey`, its uri (a signed URL without its token), or a bundled asset's content hash, so The Study's art bakes once, not every launch. A photo with no lasting identity (a data: or content: uri) gets a name for this launch. The first write of each launch deletes every other launch's and recipe's files.
- **Never per frame:** pan, zoom and the loupe move an ordinary image, so the treatment costs nothing while they run.
- **Showing it:** the original shows until the bake is ready, then the treatment fades in over it (`ref.motion.treatment`, 240 ms; instant under reduced motion). Once the treatment covers it, the original unmounts, so a settled photo is one decoded image. A photo baked before shows treated at once, with no original under it. `original` mounts the original again, waits for it to load, then fades the treatment away: paranormal's case closed snaps to full colour.
- **The looks** (`modeThemes[genre].treatment`, settings in `ref.treatment`):
  - noir is grey, hard contrast, heavy grain and a deep vignette; its toe holds black at 9/255 and keeps the shadows' steps;
  - crime scene is nearly grey, with a harsh contrast and red pushed into the shadows: black is (23, 0, 0), and the shadows keep their steps in red;
  - paranormal is a cool blue-green with lifted blacks (no toe needed), a soft glow and light grain.
- **Shadows are tested** (`modeThemes-test.ts`, with Skia's clamping): in every mode, black, 0.05 and 0.12 grey come out distinct and above black, so an object on a dark floor stays visible.
- **Policy reversal:** this replaces `Grain.tsx`'s "never over a room photo" rule. Grain over a room photo is now part of the baked mode treatment, and only there. The live `Grain` overlay still never sits on a photo.
- **Web:** Skia runs on CanvasKit. The root layout waits for it (`useSkiaReady`, next to the font gate), and `public/canvaskit.wasm` is copied there by `postinstall` (`setup-skia-web public`). Native ships Skia in the binary and never waits. If CanvasKit fails to load, photos show untreated.
- **Tests:** `jest/skia-mock.js` stands in for Skia and records what a bake draws.

### Mode art (home's covers)

Each mode has its own illustrated cover, drawn in code with Skia from that mode's theme colours. It uses no photographs.

**When it shows:** always, on home's mode cards and the mode intro's banner. No card or banner ever shows a photo: not the player's own room, not The Study's (round 6, the user: illustrated art, not their pictures). The Study's photo stays in the tutorial only.

**The covers** (`src/screens/hub/art/`):
- **Detective Noir** (`noir.ts`, round 9): a detective's desk from above in one hard pool of lamp light. An open manila case file holds a typed REPORT OF INVESTIGATION (a hotel-room case, set in the grotesk at 10x and scaled down so small type keeps its spacing), a paper-clipped polaroid of a doorway left ajar (a nod to the brand's lit door), and a brass magnifier lying over the report, its lens enlarging a line of type and the whorls of a fingerprint the rest of the page shows only faintly. Monochrome with brass only on the magnifier's rim and the clip; the top left stays dark for the card's words. Replaces the venetian-blind-and-fedora cover the user called generic.
- **Crime Scene** (`crimeScene.ts`): a dark room at night, in one-point perspective. Through an open door, a hall is lit harsh pale from a far window and washed blood red. Crossed police tape over the doorway reads "CRIME SCENE · DO NOT CROSS". The beam falls across the floorboards onto a chalk outline and three yellow evidence markers numbered 1 to 3. No blood, body, weapon or gore, and yellow is only a detail.
- **Paranormal** (`paranormal.ts`): an old oval mirror hung askew on damp trellis wallpaper. In it is a pale, featureless woman who isn't in the room; her cold light is the only real light. Below it are a console table with a drawer pulled out, a candle burning pale blue with smoke curling toward the glass, an empty balloon-back chair, floor mist and drifting motes. Eerie, not demonic: no symbols. Every pixel stays between 180° and 215° in hue, never mint.

**Composition rules for all three:** the top left (where the name, tagline and tag now sit) and the bottom left stay dark and calm; the focus sits centre-right. Every colour comes from `modeThemes[genre]` via the kit's `tone()` and `mix()`, never a literal. Sizes scale with the cover's height (each has a design height of 260). Randomness is a fixed seed per mode (`draw.ts` `SEEDS`), so a cover is the same every time.

**Overlays on the card:** paranormal's glow sits over its cover (noir's brass rule is removed, round 9). Crime scene has no overlay: its cover tapes off its own door (the corner tape strip is gone).

**Baking** (`bake.ts`, `ModeCover.tsx`):
- **Once per mode and size:** each cover is drawn once per mode, pixel size and scale, and kept in memory for the launch (12 entries, oldest dropped). A request for a key already baking shares that bake; a failed bake isn't kept, so the next request retries.
- **Never in a render:** a frame asks for its cover from an effect after layout. Bakes run one at a time, each in its own idle slot (`requestIdleCallback`, 500 ms at most), so the screen paints first with each frame in its mode's `surface` colour.
- **Showing it:** the cover fades in over `ref.motion.treatment` (instant under Reduce Motion; no fade if it was already baked). On a resize the old cover stays until the new one is ready. It is decorative and hidden from screen readers.
- **Size and surfaces:** baked at the frame's real size times the screen's pixel ratio, capped at 2× on the web, where CanvasKit may fall back to software WebGL. Native uses Skia's GPU offscreen surface and falls back to raster (`offscreen.ts`). The web shares one WebGL context for every bake (`offscreen.web.ts`), because Skia's own web offscreen opens a context per surface and browsers drop the oldest after about 16.
- **Lazy Skia:** Skia is required inside the bake. Without it (the web before CanvasKit loads), the frame keeps its surface colour.
- **Font:** the police tape is set in Archivo ExtraBold (`@expo-google-fonts/archivo`). If the font fails or takes more than 3 s, the cover draws without the tape's words.
- **Cost:** in a CPU-only headless renderer, a cover takes about 0.8 to 1.3 s; on the web build in this sandbox (software WebGL), about 2 to 2.7 s at 3×. Neither a real GPU nor a phone has been measured yet.

**Tests:** `src/screens/hub/art/__tests__/bake-test.tsx` (it bakes once, at the right size, retries a failure, fades or doesn't, and keeps the old cover on a resize); hub-test and mode-test check that every card and the intro's banner draw the cover and that no photo or tape strip shows anywhere.

### Needs you (mode art)

- Check the cover bake time on a real phone and in a desktop browser with hardware WebGL.
- Crime scene's chalk outline: keep it, or drop it if it reads as a body? Removing it is one block (step 7 in `crimeScene.ts`).
- Crime scene's doorway is strongly red against the otherwise grey image; say if it should be more desaturated.
- On the deck's upper cards the next card covers the cover's lower third (crime scene's floor and markers, the detective's coat); the tape words are too small to read below about 200 pt of card height.
- On the intro's wide, short banner (about 393 × 200), crime scene's door ends up small in the top right.

### Inside a mode, round 6 (no case list)

The user's round 6 note: no case list and no saved titles; tapping a mode resumes the case you have or starts a new one. So:
- **Removed:** the mode screen `/mode/<genre>` (`app/mode/[genre].tsx`, `ModeScreen.tsx`) and its pieces: the case files and their rubber stamps (`CaseFileRow.tsx`, `Stamp`), `useModeCases.ts`, `caseQueries.ts`, `caseFiles.ts` (its intro words moved to `src/screens/mode/copy.ts`, `MODE_INTRO`), the light table's bar (`ModeBar`) with its Pro lock, `TextButton`, `STUDY_ART` (`art.ts`), the noir list's "The first case" entry, home's case counts, and their tokens (`ref.layout.mode.file / stamp / bar / empty`, `ref.layout.hub.modes.chip / gap / tape / artEdge`).
- **Kept:** the first-time intro, `/mode/intro/<genre>` (`ModeIntro.tsx`), for crime scene and paranormal: the banner of the mode's cover with the camera's back square (`parts.tsx`: `BackSquare`, `ModeHeader`, `ModeBanner`, `FootShade`), the kicker, the name and tagline, three steps, and its start button, now the photo guide's pill in the mode's accent (`ModePill` ghost) pinned in the guide's reading column, `ref.space.ctaBottom` above the safe bottom. Start remembers the intro and runs `openCapture({ genre, replace: true })` (busy with the pill's spinner while access is checked; `/capture` if the check can't run), so back from the guide returns home. Noir has no intro; a noir param goes home.
- **Entering a mode** (first time, the continue prompt, or a new case at once) is home's: 01 · Entering a mode.
- **Words:** `src/screens/mode/copy.ts`: `MODE_INTRO` (the intros) and `RESUME_COPY` / `RESUME_ACTIONS` (the prompt), in each mode's voice.
- **Tests:** `src/screens/mode/__tests__/mode-test.tsx` (the intro), `src/screens/hub/__tests__/hub-test.tsx` and `caseStatus-test.ts` (entering a mode).

### Motion: one exception

The "no ambient animation" rule has one exception: paranormal's effect overlays (flicker, apparition, moved, cold, whisper) animate while their hotspot is visible on the active page. They use Reanimated on the UI thread, with opacity and transform only, and are static under reduced motion.

### Capture flow inside a mode

The photo guide (04), camera permission (03), camera (02), review screen (07) and build wait (06) that a mode opens with `openCapture({ genre })`. In the shell they look exactly as sections 02 to 07 describe. Inside a mode they take its theme. Every one of them reads its colours by role from `useCapturePalette()` (`src/capture/ui/palette.ts`), never from `ref.color` directly, so one map decides the tint:

| Role | Where | In a mode |
|---|---|---|
| `page` | the camera, review and build-wait ground | `surface` |
| `well` | the guide's ground and every well: the empty viewfinder, the counter pill, the zoom track | `ground` |
| `raised`, `ink`, `inkMuted`, `rim` | square buttons, the zoom thumb, notes, loading tiles; text; 1 pt edges | the mode's own roles |
| `primary` / `onPrimary` | 03's pill, 04's step button, 07's build pill, 06's pill (round 6: all the guide's pill) | `accent` / `accentInk` |
| `stamp`, `lit`, `cue` | 06's CASE READY stamp, its status line's sweep and its torch beam's tint, the counter's current numeral, the camera's way-on ring | `stamp` |

- **Permission (03):** pushr's white paper becomes the mode's dark sheet. The mode's `ground` sits behind a `surface` sheet with a `raised` panel, and the phone is drawn in `ground` and lit in `inkMuted`. The title is in `ink`, and the body and notices in `inkMuted`. There is no haze: `PaperHaze` belongs to the shell's paper only. The status bar's glyphs are light (`app/capture/index.tsx`), and the thinking line uses the kit's dark ground. Section 03's paper, haze, black pill and pressed fill describe the shell.
- **Guide (04):** the mode's `ground`, `ink` and `inkMuted`. The close disc is a light `inkMuted` disc with a `ground` X, and the step button is the mode's primary. The line drawings keep their greys.
- **Photos:** the camera's last photo, the review tiles and the build wait's turning room bake at one size, `ref.layout.review.tile.bake` (720 px on the long edge), so one bake per photo serves all three. Each photo shows as taken, then its treatment fades in (`TreatedImage`). The live camera feed is never treated, so you frame the real room.
- **Pressed:** inside a mode the pills (`ModePill`: 03's pill and quiet ways out, 04's step button, the build wait's Open the case) press to 0.75 opacity (`ref.button.square.pressedOpacity`), because the kit's colour step (`raised` → `raisedPressed`) has no mode tokens. Squares, bare glyphs, the thumbnail and the bars press as they do in the shell.
- **Calm states:** the build wait's One moment, account and access asks, and failures are the shared `StateScreen`, which reads the mode itself (round 6; `DevelopStateScreen` and `src/screens/develop/ModeState.tsx` are gone). Inside a mode it uses the mode's `surface`, `ink` and `inkMuted`, with the guide's pill in the mode's accent.
- **The same in every mode:**
  - the warning amber (`ref.layout.review.warning`, #D4883A) on a marked photo's rim, its reason and the footer's helper, so a problem never changes colour;
  - the instrument greys: the shutter disk, the × halo and the framing grid;
  - the brass focus ring;
- **Tests:** `src/capture/ui/__tests__/palette-test.ts`, plus each screen's "inside a mode" block.

## Game feel (GAME_FEEL_PROMPT.md)

The brief: keep the premium quality, but make Escapd feel like a noir detective game you *play*, not a productivity app. Sections 3 (hub as a desk) and 7 (cold open) were replaced by MODES_PROMPT (the three mode cards and the per-mode intros). The user excluded rank and XP from section 5. Everything below applies in all three modes, in each mode's palette (`useModeTheme()`).

### 1. Every tap answers back

- **Press squash** (`src/components/noir/squash.tsx`: `usePressSquash`, `SquashPressable`, a drop-in `Pressable`). Every button sinks while pressed: pills, buttons, square header buttons, keypad keys, tray items and the guide's close button go to 0.96; large panels (mode cards, photo tiles) go to 0.98. Press-in takes 90 ms, easing out. Release is a spring (damping 22, stiffness 420, mass 0.6) with a trace of overshoot that settles in about 220 ms. A pressed opacity or fill still applies on top. There's no squash while a button is busy. Tokens: `ref.motion.juice.press`. Settings rows don't squash, because list rows that scale read oddly.
- **Hotspots:** pressing one in gives a `tick`, and the outcome brings its own haptic.
- **Item pickup** (`src/render/PickupFlight.tsx`): a granted item stays out of the tray until the player taps "Pocket artifact" or closes the clue (the sheet covers the tray). It then flies from the object to its slot on an arc and bounces as it lands, with `pickup`. Positions are measured once; if they can't be measured within 160 ms, the item simply lands. A combined item lands without a flight. Tokens: `ref.layout.play.pickup`.
- **The code pad** (`CodePad.tsx`, `CodeWheel.tsx`):
  - A padlock in the mode's colour sits above the code.
  - Each wheel stop overshoots by 0.08 of a row and seats back over 90 ms, like a mechanical click, with one `tick` per digit.
  - **Wrong code:** the pad rattles for 300 ms (8 pt at the first swing, decaying), the shackle tugs, and `wrongCode` fires.
  - **Correct code:** the shackle lifts 9 pt and swings open 24°, a ring in the mode's accent lights round the code, and `unlock` fires. After 620 ms the flow continues: CodePad returns `{ kind: "solved", proceed }` and the Player runs `proceed`, so the result sheet and the scene change wait for the latch.
  - Tokens: `ref.motion.juice.rattle` / `.latch`, `ref.layout.play.codePad`.
- **Reduce Motion:** nothing scales, flies, shakes or slides, and every haptic stays. A wrong code dips the pad to 0.45 opacity. A correct code cross-fades to an open lock and continues after 140 ms. A pickup fades into its slot.

### 2. Sound

Docs: `docs/AUDIO.md` lists every file, what it's for, how it's made, its licence, size and duration.
- **Engine:** `src/game/sound.ts` preloads the effects once, replays them from the start and never throws; it's silent on the web.
- **Silent switch:** the audio session is `playsInSilentMode: false` with `mixWithOthers`. Sounds follow the iOS silent switch, and on Android they don't play when the ringer is on silent or vibrate. The player's own music keeps playing at full volume, with no ducking. The app's music shares this session, so it plays alongside the player's own audio rather than pausing for it (the trade-off: a game's score usually gives way to another app's; mixing keeps one session for effects and music, and the player can turn Music off).
- **Settings:** Settings → Sound saves the server's `sound_enabled`, Settings → Music `music_enabled` (one row, two switches). Sound, music and haptics are independent of each other: Sound covers the effects and the room tone, Music only the music.
- **The sounds:** 13 files in `assets/audio/`, about 340 KB in all, all synthesized by `scripts/audio/generate.mjs` (Node plus ffmpeg, deterministic). There's no third-party audio.
  - Effects: press (very quiet), thud (a knock), paper, shutter, typewriter, unlock, wrong code, pickup, stamp, and the solved sting (3.3 s, timed to its haptic beats).
  - `tick`, `success`, `warning` and `error` are silent, so the app never clicks constantly.
- **Room tone:** `useRoomTone(active)`, mounted by `/play/[roomId]` and `/tutorial`. It loops 16 s per mode: noir rain and hum, crime scene a tense beating hum, paranormal a cold wind and pad. It fades in over 1.6 s, crossfades when the mode changes, and fades out over 0.7 s on blur, in the background, when sound is turned off or on unmount.
- **Music:** `useMusic()` (`src/game/useMusic.ts`, the player in `src/game/music.ts`), mounted once in `app/_layout.tsx` so it follows the active mode (`useMode()`) across every screen. The shell (home, Pro, account) and Detective Noir (its intro, capture flow, build wait and play screen) play the main theme; Crime Scene plays `crime.m4a` (the user's jazz), Paranormal `paranormal.mp3`. Each track's `trim` evens its loudness to the theme's. One looping track at a time, at 0.35 (`MUSIC.level`), under the effects (0.45 to 0.95; the press click 0.22) and over the room tone. A mode change crossfades over 1.2 s; moving between the shell and noir keeps the theme playing without a restart; a track coming back after another mode's starts from its top. Music off, or the app going inactive, fades out over 0.5 s; the background pauses it at once; it resumes where it was. While music plays the room tone drops to half its level (`MUSIC.roomTone` 0.5, over 1.2 s), so rain or a hum doesn't muddy it. It starts at app start (the ambient session needs no gesture on iOS or Android) and is silent on the web or when a load fails. Every level and fade is in `sound.ts` (`EFFECTS`, `TONES`, `MUSIC`).
- **Not yet checked on a device:** the loudness balance and how the low end comes through a phone speaker (volumes live in `sound.ts`). expo-audio restarts the loop by seeking back, which may leave a gap of a few milliseconds. The music files are 4 s silent placeholders until the user's tracks land (`docs/AUDIO.md`); set each track's `trim` once they do.

### 4. The play screen as objects

- **Evidence tray** (`InventoryBar.tsx`, `materials.ts`): a leather tray with a dashed stitched seam and an EVIDENCE label in the mono plate face. Items sit in felt wells as tags: a string hole, the glyph, and the name in Courier Prime. Each mode has its own leather: noir dark brown with brass stitching, crime scene oxblood with bone stitching, paranormal cold blue. Selection, Use, the worktable and combining work exactly as before. Tokens: `ref.layout.play.evidence`.
- **Clues as objects** (`ClueObjects.tsx`): the server's text is typed on a torn, lined note. A clue from an object in the room also gets a polaroid of that object, cropped from the room photo in the mode's treatment, and a pocketed item shows as its evidence tag. Paper and ink are per mode; text contrast is 14:1, small print about 6:1. `paper` fires as the clue opens, 260 ms late after a solve so it doesn't land on top of the success haptic. At large text sizes the polaroid stacks above the note. Tokens: `ref.layout.play.clue`.
- **Ask the informant** (`Informant.tsx`, `informantLadder.ts`):
  - **Where:** a matchbook button in the tray's top edge, hidden when hints are off.
  - **The sheet:** a backlit silhouette, and each tip on a paper slip under a byline ("Word on the street"), with the server's text verbatim in quotes. Opening it is free and shows the tips already given; only its button asks for the next one, with `typewriter`.
  - **Per mode:** the informant (fedora), the beat cop (peaked cap) or the medium (veil).
  - **New client call:** the app had no hint UI before. This calls the server's existing `use_hint` RPC, with no backend change, so a hint counts toward `hints_used` and the case-closed rating. The wrong-code cooldown is unchanged.
  - Tokens: `ref.layout.play.informant`.
- **Case clock** (`CaseClock.tsx`): Settings → Case clock (local, off by default). The time since the session's `started_at`, in the mono face, next to "View n of 3". It ticks once a second and only the clock re-renders. A case resumed days later shows the whole span.
- **Idle glint** (`idle.ts`, `HotspotLayer.tsx`): after 20 s with no touch, a soft light pulses twice over objects in the current view that are visible, unsolved and not yet tapped, then waits for the next idle spell. It never touches hidden objects, so it reveals no more than Show interactives does, and it pauses while a sheet is open or a request is in flight. Under Reduce Motion it's a still, faint light. Peak 0.5 (`ref.layout.play.glint`); it's subtle on bright objects.
- **Fonts:** Courier Prime (Google Fonts, `@expo-google-fonts/courier-prime`) is the typewriter face for game moments; Playfair stays for titles.

### 4a. Taken objects leave the room

The user's idea: "take objects and they'd physically disappear from the room, max 1 per room … show what's behind it". A first version, on the device and free (no image model, no server change), so it works on every room, old ones included. Presentation only: the engine and the definition don't change.

- **Which object** (`src/game/removal.ts`, pure). At most one per room: a hotspot that isn't hidden or haunted, whose only puzzle is an `inspect` (no `use_item`, `code` or `accuse` on it, so taking it can't break later play), whose `object_label` names a small portable thing (whole words, any case: book, vase, mug, jar, bottle, box, candle, figurine, bowl, bag, cushion, hat, camera, trophy, globe, remote, and qualified ones such as desk lamp, alarm clock, picture frame, potted plant; "large", "floor", "fuse" and the like rule a label out), whose box is 1–15% of the photo and at least 2% in from every edge, and which no other hotspot reaches into (one that holds it whole, the desk under the mug, is fine). Then the photo decides: the ring 6–12% of the box round it, on the treated photo's pixels, must be plain (luminance spread round a fitted plane at most 18 of 255, so a lit wall's gradient passes and a shelf of books doesn't). The plainest ring wins, then the box nearest 4% of the photo, then the id.
- **The fill** (`src/game/inpaint.ts`, pure TypeScript over RGBA). The box plus 15% each side is read from the treated photo, at most 384 px on the long edge. The hole (the box plus 6%) is filled by push-pull: a pyramid of weighted averages down to one pixel, then back up, each level blended in where its own pixels are missing and relaxed with a few Gauss-Seidel sweeps, so a large hole's middle meets its border instead of sinking to the mean. Grain matched to the ring's own (at most 10 of 255) goes over it, and the alpha feathers off over 8% of the box past the hole. About 30–50 ms for a 384 px region.
- **When** (`src/render/removalPatch.ts`). Once per room and mode, after the scene is up, in idle moments; the patch is a PNG data URI kept in memory, keyed by the mode and each candidate's photo and box. Anything that fails means no removal: the object stays.
- **In play** (`src/render/RemovalLayer.tsx`). While the object's inspect is solved, its patch sits on the stage (`SceneView`'s `backdrop`, so it pans and zooms with the photo, shows on its own page whichever is in view, and in the loupe). It comes in as the clue is pocketed, together with the pickup's flight: a 600 ms fade (`ref.layout.play.removal.fade`); under Reduce Motion it is simply gone. A resumed case shows the room as it was left. The object's target stays mounted for the flight to measure, but has no brackets, takes no touch and isn't read out. No new sound. The thumbnail wheel, the clue's polaroid and paranormal's case closed (its original colours) still show the object.
- Tests: `src/game/__tests__/removal-test.ts`, `inpaint-test.ts`, `src/render/__tests__/removal-test.tsx`.

### 5. The victory moment

`CaseClosed.tsx`, `victory.ts` (pure: stats, rating, timeline), `slam.ts`, `MagnifierRating.tsx`, `Stamp.tsx`.
- **Reversal:** this replaces case closed's earlier "celebrates observation, not speed: no ranking, no stars" rule. The rating is still about observation, not speed.
- **The stamp:**
  - Noir: CASE CLOSED slams onto a case folder with the title in Playfair on a paper label.
  - Crime scene: GUILTY slams again onto the accused's card.
  - Paranormal: the room snaps from tinted to full colour, "The presence is gone." drops onto it with a `thud` (on the player's see-through pill, `play.gone`; onto the page when there is no room to show), then CASE CLOSED slams.
  - CASE CLOSED and GUILTY are medium stamps here, sized to the card: Archivo Black 28/32, tracked 3 (`play.type.stampMedium`), in the large stamp's 4 pt frame. The accusation's reveal keeps the 34 pt large stamp.
  - **Every slam** falls from 2.2×, overshoots to 0.93, settles over 140 ms and spreads its ink (the frame grows to 1.22× while fading from 0.45 over 420 ms). It fires `stamp` on impact and nudges the card 5 pt with a 3 pt shake. Stamp glyphs use the mode's `stamp` colour.
- **Then the stats, one by one, with a `tick` each.** All three are real numbers from the `game_sessions` row the route already loads:
  - time, `completed_at − started_at`;
  - hints used, `hints_used`;
  - wrong codes, `wrong_answer_count` (labelled "Wrong answers" in crime scene, where wrong accusations share the counter).
  - A missing field is left out; with no session there are no stats and no rating.
- **Then the rating:** 1–3 magnifiers fill in, a `tick` each, then `solved`. The row reads "Observation" and, to screen readers, "Rating: N of 3 magnifiers". The rule (`magnifierRating`):

  | Rating | When |
  |---|---|
  | 3 | no hints and no wrong answers |
  | 2 | at most 1 hint and at most 2 wrong answers |
  | 1 | otherwise |
  | none | either number missing |

  Time never counts.
- **Then the actions fade in** (round 6): "Start a new case", the photo guide's pill in the mode's accent, which runs `openCapture({ genre, replace: true })` (a new case in the same mode; a player without Pro goes to `/pro`); then quiet "Back to <mode>", which now goes home (`router.dismissTo("/")`: there is no mode screen), and quiet "Replay the case" (The Study: "Replay The Study"). The Study's band keeps "The next case is your own room." over them.
- **One screen.** Case closed fits with no scroll at the default text size on an iPhone SE (375 × 667, 20 pt safe top, no bottom inset) and up, in every mode and The Study, with all three stats and the rating (tokens `play.complete`):
  - The actions stay pinned at the foot as before (the guide's 52 pill, two 48 quiet pills, `ref.space.sm` apart, The Study's closing line over them); the band starts 12 above its pill (`actions.pad`).
  - The column above is 24 in from the sides (`inset`) and 12 from the top and from the actions (`pad`). Its parts sit 8 apart (`gap.head`; the exit line 4 under the message, `gap.exit`); the stats and the rating sit 12 further down (`gap.card`).
  - The case takes the column's spare height, from its compact size up to a maximum: noir's folder (12 padding, a 12 tab, the title in Playfair 24/30 on a label with 6 above and below; up to 220, `folder.max`), crime scene's accused card (12 above and below its words; up to 260, `accused.max`), paranormal's room (from 96, `photo.min`, up to the column's width at 2 : 1). What's left over is shared above and below the card, so on a tall phone the column sits centred.
  - CASE CLOSED keeps 8 clear above and below (`stamp.room`) for its 6° tilt.
  - The stats are a compact row of 07's cards (10 above and below, 8 at the sides, `stat`): the value (the mode's display face, 20/24) over its label (meta), centred.
  - The rating is one line: "Observation", then the three magnifiers (28 across, 12 apart) 12 after it.
  - The SE budgets (from the tokens, with two lines of message; `complete-test.tsx`, "fits one screen"): The Study 596 of 667, noir 568, crime scene 650 (a one-line name and a two-line alibi), paranormal 624.
  - Large accessibility text may scroll; the column's ScrollView takes over.
- **Timeline (ms after mount):**

  | Beat | Noir / crime scene | Paranormal |
  |---|---|---|
  | Card in | 0–220 | 0–220 (colour snap at 360) |
  | Gone line lands | — | 700 |
  | Stamp lands (`stamp`) | 640 | 1120 |
  | Message | 640 | 1120 |
  | Stats | 940 / 1120 / 1300 | 1420 / 1600 / 1780 |
  | Magnifiers | 1540 / 1760 / 1980 | 2020 / 2240 / 2460 |
  | `solved` | 2140 | 2620 |
  | Actions | 2300 | 2780 |

  If the session arrives late, the stats start when it does; after 1200 ms, `solved` and the actions go ahead without it.
- **Reduce Motion:** no fall, nudge or stagger. The stamp fades in by 140 ms (with `stamp`), the stats by 200, the rating appears filled at 320, and `solved` and the actions come at 420.
- **Share hook:** the stamp, title, message, stats and rating are one `View` (`testID="case-card"`, `collapsable={false}`) held in a ref, and `onShare?: (card) => void` is declared but unused. Sharing isn't built.
- **Open questions:** there's no tap-to-skip, and the actions can be pressed while they're still fading in.

### 6. Voice

A short, dry voice per mode, only where the player is playing: noir is a hard-boiled narrator, crime scene is clipped police procedural, and paranormal is hushed and eerie (never demonic). Shared lines use noir's voice.
- **Where the words live:**
  - `src/render/voice.ts`: `playVoice(genre)` for each mode's play-screen lines, `PLAY_COPY` for the shared ones and `failedLine()`;
  - `MODE_INTRO` and `RESUME_COPY` in `src/screens/mode/copy.ts` (the intros and home's continue prompt);
  - `src/render/accuse.ts`;
  - `WRONG_LABEL` in `victory.ts`.
  - The quiet "nothing new here" lines moved from `selectors.ts` into each voice.
- **Still plain** (round 4: "drop the light table dark room thing its not very self explanatory"):
  - the capture flow (guide, camera, permission, Your photos, the build wait);
  - Pro, billing, account, settings and home;
  - offline lines (only the offline screen's title is in voice);
  - the app-update and not-ready states;
  - hotspot, view and digit accessibility labels, and tutorial coach marks.
- **Never rewritten:** server text (clues, hints, case names, messages). The app's lines are only fallbacks for when the server sends none.
- **No darkroom or film words.** GAME_FEEL's "Developing the prints…" became "Pulling the case file…".

**Before → after (the main lines; noir / crime scene / paranormal where they differ; the mode screen's list, empty, error and The Study lines went with the screen in round 6):**

| Where | Before | After |
|---|---|---|
| Intro kicker / button | How this mode works / Start | Crime scene: Briefing / Take the case · Paranormal: Before you go in / Step inside |
| Player loading | Opening the case | Pulling the case file… / Securing the scene… / The room is waking… |
| Player offline title | You're offline | The line's dead / No signal / Contact lost |
| Player error title | The case didn't open | The trail went cold / Scene unavailable / The room went quiet |
| Item on the wrong object | That doesn't work here. | No dice. / No match. / Nothing stirs. |
| Items that don't combine | These don't fit together. | Those two don't fit. / Those don't match up. / They won't join. |
| Wrong code (no server line) | Nothing happens. | Wrong number. / Wrong code. / Wrong code. Nothing stirs. |
| Request failed | That didn't go through. Try again. | The trail went cold. Try again. / Request failed. Try again. / Something interfered. Try again. |
| Nothing new: locked / spent / plain | This does not open yet. / Nothing else here. / Nothing stands out. | Noir: It won't budge. Not yet. / Picked clean. / Nothing worth a second look. (crime scene and paranormal in their own voice) |
| Clue sheet button | Pocket artifact / Continue | Pocket it / Bag it / Take it · Move on / Proceed / Go on |
| Items heading | Added to your items | In your pocket / Logged as evidence / You take it with you |
| Alibi broken | {name}'s alibi doesn't hold up. | Alibi broken: {name}. |
| Combine button | Close clasp | Fit together |
| Empty tray | Items you find appear here. | What you find goes here. / Bagged evidence goes here. / What you take goes here. |
| Code pad items | Check your items | Check your evidence |
| Accuse title / submit | Make your accusation / Make the accusation | Name the killer / Make the arrest |
| Wrong accusation | That doesn't add up. | The charge won't stick. |
| Case closed hints stat | Hints used | Tips taken |
| Case closed wrong stat | Wrong codes / Wrong answers / Wrong codes | Wrong codes / Wrong calls / Missteps |
| Case closed actions | New case / Play this case again | Start a new case / Replay the case (round 6: "Next case" became "Start a new case") |
| Continue prompt (round 6, new) | — | You've still got a case open. / You have an open case on file. / Something is still waiting for you. (building: Your next case is still coming together. / Your scene is still being processed. / Something is still taking shape.) |

### Tests

- `squash-test.tsx` and `codePad-test.tsx`: the squash and Reduce Motion, `wrongCode`, the latch, and `proceed` (at most 150 ms under Reduce Motion).
- `sound-test.tsx`: sound only when `sound_enabled`, independent of haptics, silent failures, and the room tone's lifecycle.
- `music-test.tsx`: the track per mode, the theme kept (no restart) between the shell and noir, the crossfade, `music_enabled`, background and foreground, the room tone lowered under music, the `isLoaded` seek guard, and silence on a failed load.
- `diegetic-test.tsx` and `playScreen-test.tsx`: the hotspot tick, pickup landing, the informant's text verbatim with the cooldown unchanged, the clock hidden by default and ticking when on, and the glint only after idle and only on discoverable objects.
- `Player-test.tsx`: the result sheet appears only after `proceed`.
- `victory-test.ts` and `complete-test.tsx`: the rating, stats only when data exists, the cue order (`stamp`, ticks, `solved`, actions) and the Reduce Motion path.

### Sheets close before they unmount

`DarkSheet`'s Close, its scrim, and anything inside that asks through `useSheetClose()` or a function `footer`'s `close` now slide the sheet away while it's still mounted, then call `onClose`. Before, a sheet only animated out on unmount, and the removed view lost its stacking on the way down, so the evidence tray and the header drew over the falling sheet. Details:
- the slide is `ref.motion.sheetFall`, or a fade over `motion.reducedFade` under Reduce Motion;
- a second press doesn't restart it, and touches pass through while it falls;
- a sheet unmounted mid-slide never calls `onClose` late;
- a caller that unmounts a sheet directly (one sheet swapped for another, home's Android back) still gets the old exit animation;
- home bumps the Settings sheet's and the continue prompt's keys on every open, so a tap while one is still falling opens a fresh one, and focus returns to the chip (or the card) a margin after the sheet has gone.

Tests: `src/components/noir/__tests__/darkSheet-test.tsx`. The play tests wait for the sheet to leave (`continueResult`).

### Web notes

`AccessibilityInfo.sendAccessibilityEvent` doesn't exist on react-native-web. DarkSheet, the Player and CodePad now call it only on native.
