# Escapd art direction: velvet & ink

Who it's for: teenage girls and young women (roughly 13–28) who love a good
mystery, true crime podcasts, Wednesday, cozy-mystery book covers, journaling
and aesthetic Pinterest boards, and who share what they love. The game should
feel like *their* thing: moody, pretty, a little spooky, never grim, never
"gamer" or "admin dashboard".

## The core: mystery-book core

Lean all the way into the cozy-mystery bookshelf of a millennial woman who
reads (BookTok / bookstagram): illustrated cozy-mystery covers with a cat on
them, Agatha Christie reissues with gold-foil titles, Only Murders in the
Building, Knives Out cable-knit, a reading nook with a candle, tea in a nice
mug, a bookmark ribbon, a library card, pressed flowers, an annotated
paperback with sticky tabs.
- Each mode is a book in a series: its card is the cover (illustrated, a
  framed title in a lovely display face, gold-foil touches, "A Detective Noir
  Mystery" / "A True Crime Club Mystery" / "A Moonlit Mystery" as the series
  line).
- Screens borrow book furniture: chapter headings ("Chapter One"), drop caps,
  ornamental rules and fleurons, bookmark ribbons, library-card stamps, page
  numbers, foil-stamped seals, deckled paper edges.
- The casebook is her annotated reading journal; case closed is the last page
  (or the book on her shelf / a library card stamped "Solved").
- Warm and cozy first, spooky second: candlelight, florals, tea, rain on the
  window, the cat curled up.

## Four pillars

1. **Moody, but warm.** Every room is dark, lit like candlelight. Grounds are
   deep jewel tones (plum, oxblood, midnight teal), never flat neutral grey.
   Light is warm and soft: glows, not hard edges.
2. **Made by hand.** The black cat's inky, hand-drawn line is the house style.
   Frames, doodles, icons and marks look drawn with the same pen. The casebook
   is a scrapbook journal: polaroids, washi tape, handwritten notes, pressed
   flowers, red string, stickers.
3. **Spooky-cute.** The cat is a companion with feelings. Small delights
   everywhere: sparkles, little hearts, a sticker earned, a wobble when
   something's wrong. Never gore, never cruelty, never a jump scare.
4. **Worth sharing.** Case closed is a collectible: a polaroid / sticker card
   with the case's name and her stats that looks good as a screenshot.

## Palettes

Each mode keeps the game's dark rooms but moves off grey into its own jewel
tone, with one soft "glow" colour for light and one "sweet" colour for delight
(hearts, stickers, the cat's marks).

| token        | Detective Noir: "Velvet Noir" | Crime Scene: "True Crime Club" | Paranormal: "Moonlit" |
|--------------|-------------------------------|--------------------------------|-----------------------|
| ground       | `#18121D` midnight plum       | `#1C0F12` oxblood night        | `#10122A` deep indigo |
| surface      | `#241A2B`                     | `#2A161B`                      | `#191C38`             |
| raised       | `#32253A`                     | `#3A1F25`                      | `#252949`             |
| ink          | `#F8EEF1` warm white          | `#FBEFE8` cream                | `#EEF0FF` moon white  |
| inkMuted     | `#BFAFC0`                     | `#CDB3AC`                      | `#ABB0D6`             |
| accent       | `#E9B8A6` rose gold           | `#C83D50` cherry ¹             | `#B8A6F7` lavender    |
| accentInk    | `#2A1620`                     | `#FFF4EE`                      | `#15132E`             |
| stamp        | `#E9B8A6` rose gold           | `#EB6174` cherry, lifted ¹     | `#B8A6F7` lavender    |
| glow         | `#FFD9A8` candle              | `#FFE3A3` desk lamp            | `#9FF2D8` spirit mint |
| sweet        | `#F4A7C0` blush               | `#F6D776` sticky-note yellow   | `#F3B6E6` orchid      |
| foil         | `#D9B26A` gold foil           | `#D9B26A`                      | `#D9B26A`             |
| rim          | `rgba(255,214,230,0.12)`      | `rgba(255,220,205,0.12)`       | `rgba(200,205,255,0.14)` |

¹ Cherry was `#E8475D`; its cream label read at only 3.5:1, so the fill is one
shade deeper (4.6:1), and the stamp (cherry as text) is the same hue lifted to
4.6:1 on `raised`. Crime Scene's police-tape `detail` is the sticky-note yellow.

**Gold foil** (`foil`, one gold for the whole series, 7:1 or more on every
ground): foil-stamped titles, seals, ornamental rules and fleurons, a
bookmark's tip.

**The shell** (home, settings, the guide, Pro, capture outside a mode) is the
bookshelf the three books sit on, velvet plum: ground `#130D18`, surface
`#1E1525`, raised `#2C2034`, ink `#FBF1F4`, inkMuted `#C6B3C8`, accent `#F2B8C9`
blush on `#2A1220`, rim `rgba(255,214,230,0.12)`, glow candle, sweet blush,
foil gold. These are `ref.color` (void, ground, raised, textPrimary,
textSecondary, rim): every reference grey is retinted into this family.

All live in `src/theme/tokens.ts` (`modeThemes`, `shellTheme`, `ref.color`);
src/theme/__tests__/modeThemes-test.ts checks every text role (ink, inkMuted,
stamp, glow, sweet, foil) at 4.5:1 on ground, surface and raised, and that no
ground is a neutral grey. Check text contrast (4.5:1 for body text) on every
ground; lift a colour rather than break that. The brass of the magnifier and
flashlight art stays: it reads as an heirloom against every palette.

## Type

- Mode names and titles: book-cover faces, each mode a book in a series
  (`theme.display`):
  - Detective Noir: Playfair Display Black, capitals (kept: a classic
    Christie-reissue title).
  - Crime Scene: **Fraunces Black**, capitals (was Archivo Black, a grotesk
    that read as a poster, not a book).
  - Paranormal: **Fraunces SemiBold Italic**, title case (was Crimson Text
    italic capitals).
- Other book-cover titles (a case's name, "Chapter One", "Solved"):
  `ref.font.cover` (Fraunces Bold), with `ref.type.cover`; series lines
  ("A Moonlit Mystery") in `ref.font.coverItalic` (Fraunces Medium Italic),
  `ref.type.series`.
- Handwriting for anything *written* in the world: notes, the casebook's
  annotations, the cat's speech. **Patrick Hand** (`ref.font.hand`,
  `theme.hand`, `ref.type.hand` 18/24 and `ref.type.handSmall` 15/20, never
  smaller): it stays legible at 15 pt, where Caveat's small, narrow x-height
  needs about 1.25 x the size to read as well.
- UI text stays the clean system / Plus Jakarta Sans sans.
- Packages: `@expo-google-fonts/fraunces` and `@expo-google-fonts/patrick-hand`
  (loaded in app/_layout.tsx). Run `npm install` after pulling.

## Shapes & surfaces

- Rounder, softer: sheets and cards ~24 radius, pills fully round.
- No stark grey hairlines: use the mode's `rim` (a tinted glow edge).
- Paper is warm cream with a faint grain; photos sit in polaroid frames.
- Shadows are soft and coloured by the ground, not black.
- Motion has weight: things lift, lean as they move, settle on a spring
  (see the drag feel), and the cat moves at 12 fps like stop motion.

## Don'ts

Flat greys; corporate icon sets where a drawn mark would do; gore; aggressive
reds as a background (cherry is an accent); cluttered text; tiny low-contrast
labels; anything that looks like a settings page inside the game.
