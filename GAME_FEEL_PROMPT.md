# Escapd: make it feel like a game, not a productivity app

> Run this AFTER MODES_PROMPT.md. Skip sections 3 and 7 below (the home screen and intro are defined by MODES_PROMPT.md). Apply everything else across all three modes, using each mode's palette and its own case-closed moment.

The current UI is clean and premium. Keep that quality. The problem is that it reads like a polished SaaS app: quiet sheets, pills, tidy cards, neutral copy, and taps that do nothing physical. Make it feel like a noir detective game you *play*. Work on branch `redesign-noir` and commit after each step below so each one can be undone.

Keep: brass + ink palette, Playfair case titles, mono plate labels, film-plate framing, silk background. Never: green/mint, Outfit/Inter, rounded-card SaaS dashboards (that's build-a-player).

## 1. Every tap answers back ("juice")
- expo-haptics and reanimated are already installed. Give every meaningful action a physical response:
  - press-in squash on buttons
  - a light tick on hotspot tap
  - a heavy thud and shake on a wrong code
  - a success pattern on solve
- When the player picks up an item, it flies from the hotspot into the inventory tray, with a small bounce when it lands.
- The code pad feels mechanical: digits roll, wrong codes rattle the pad, and a correct code plays a lock/latch animation before the scene changes.
- Respect Reduce Motion (keep the haptics, drop the big movement). Hold 60fps on a mid-range phone.

## 2. Sound
- Add `expo-audio`. Sounds: soft room tone on the play screen, paper/shutter/typewriter UI clicks, lock clunk, wrong-code buzz, case-solved sting.
- Use only CC0 or self-generated audio. List each file and its license in `docs/AUDIO.md`.
- Add a sound on/off toggle (persisted). Respect the iOS silent switch. Keep files small.

## 3. Hub = the detective's desk, not a list
- Present cases as physical objects: case folders or polaroids on a desk or corkboard, each with a stamp for its state (OPEN / IN PROGRESS / CLOSED), the room's own photo clipped on, and the case title typed on a label.
- Add a detective identity bar at the top: rank (e.g. Rookie → Gumshoe → Inspector → Chief) with a small progress bar, cases closed, best time.
  - Compute these from real completed sessions only. Never show fake numbers.
- Make "New case" (photograph a room) feel like the primary game action, e.g. "Open a new case", not a form button.

## 4. Diegetic play screen
- Inventory = an evidence tray / satchel. Clues = notes, polaroids, torn paper, rendered as objects rather than generic sheets.
- Hints = "Ask the informant": a small character line in noir voice. Keep the existing hint/cooldown logic.
- Optional case clock in the header (off by default; a setting turns it on). Hotspots get a subtle flashlight/glint pulse when idle too long.

## 5. A real victory moment
- Case closed: a rubber stamp slams CASE CLOSED onto the case file (with haptic and sound), then the stats land one by one: time, hints used, wrong codes.
- Then a 1–3 magnifier rating, XP into the rank bar, and the "next case" call to action.
- This screen should be the most satisfying 3 seconds in the app. Make it shareable later (leave a hook, don't build sharing now).

## 6. Voice
- Rewrite UI copy in a short, dry noir narrator voice. Examples:
  - "Get started" → "Take the case"
  - "Loading" → "Developing the prints…"
  - errors → "The trail went cold. Try again."
- Keep it brief and readable; don't overdo puns. Legal and billing copy stays plain.

## 7. Cold open
- First launch only: a 2–3 second skippable intro. Lights flicker on over the desk, the Escapd wordmark is stamped on, then the tutorial case "The Study" is handed to the player.

## Rules
- Don't change backend calls, the puzzle schema, or game logic. This is presentation only. Keep existing tests passing and add tests for the new rank/stats derivation.
- Fonts must be free (Google Fonts). If you add a typewriter face for game moments, keep Playfair for titles.
- Use the screenshot harness: after each step, screenshot hub, play, code pad, inventory and case-closed, and compare against this brief.
- When done, give me a short summary of what changed per step, anything you skipped, and the exact command to run it on my phone.
