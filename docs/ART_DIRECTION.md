# Escapd art direction: velvet & ink

Who it's for: teenage girls and young women (roughly 13–28) who love a good
mystery, true crime podcasts, Wednesday, cozy-mystery book covers, journaling
and aesthetic Pinterest boards, and who share what they love. The game should
feel like *their* thing: moody, pretty, a little spooky, never grim, never
"gamer" or "admin dashboard".

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
| accent       | `#E9B8A6` rose gold           | `#E8475D` cherry               | `#B8A6F7` lavender    |
| accentInk    | `#2A1620`                     | `#FFF4EE`                      | `#15132E`             |
| glow         | `#FFD9A8` candle              | `#FFE3A3` desk lamp            | `#9FF2D8` spirit mint |
| sweet        | `#F4A7C0` blush               | `#F6D776` sticky-note yellow   | `#F3B6E6` orchid      |
| rim          | `rgba(255,214,230,0.12)`      | `rgba(255,220,205,0.12)`       | `rgba(200,205,255,0.14)` |

Check text contrast (4.5:1 for body text) on every ground; lift a colour
rather than break that. The brass of the magnifier and flashlight art stays:
it reads as an heirloom against every palette.

## Type

- Mode names and titles: a display face with personality (keep each mode's
  display face unless a better-fitting one is available).
- Handwriting for anything *written* in the world: notes, the casebook's
  annotations, the cat's speech. A legible, friendly hand (e.g. Caveat or
  Patrick Hand from @expo-google-fonts).
- UI text stays the clean system / Plus Jakarta Sans sans.

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
