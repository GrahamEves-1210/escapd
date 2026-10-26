// Haptic and sound feedback that follows the player's settings. Clues never
// depend on either alone; this only reinforces what the screen already shows.
// Haptics follow haptics_enabled and sound follows sound_enabled, separately:
// either can be off without touching the other.
//
// One small vocabulary for the whole app (docs/DESIGN.md, Global tokens:
// Haptics), so the same kind of moment always feels and sounds the same:
// - tick: a selection moving (a code wheel digit, a photo page settling, a
//   toggle, a segment, a step in the guide). The lightest. Silent.
// - press: a button, chip or card pressed in. A very quiet felt click.
// - thud: a firm, physical moment (an item landing, a lock giving way). A
//   soft knock on wood.
// - success / warning / error: an outcome the screen also states. Silent:
//   the moments below carry their own sounds.
// The game's own moments (GAME_FEEL_PROMPT.md), each one named so a screen
// asks for the moment, not a vibration, and each has its own sound
// (src/game/sound.ts, docs/AUDIO.md):
// - paper: a clue, note or sheet opening. As light as press; a page turning.
// - pickup: an item landing in the evidence tray. A thud; the item dropping in.
// - wrongCode: a wrong code or accusation. A heavy thud, then the error buzz;
//   the handle rattling, then an old buzzer.
// - unlock: a correct code; the lock's bolt, then its latch a beat later.
// - stamp: a rubber stamp slamming down (CASE CLOSED, GUILTY). Heavy.
// - solved: the case solved. The success pattern, then two closing taps; a
//   short noir sting on the same beats.
// - shutter: the camera taking a photo. A thud and a mechanical shutter.
// - typewriter: text typing itself out in a game moment. Sound only, no
//   haptic: a short run of keys.
import { useEffect, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { usePreferences } from "./preferences";
import { playSound, preloadSounds, type SoundName } from "./sound";

/** The beats of the patterns, in ms after the first. The sounds are cut to the same beats. */
const PATTERN = { wrongCode: 90, latch: 110, solved: [260, 400] } as const;

export function useFeedback() {
  const { haptics_enabled, sound_enabled } = usePreferences();
  useEffect(() => {
    // Load the effects before the first cue needs one.
    if (sound_enabled) preloadSounds();
  }, [sound_enabled]);
  return useMemo(() => {
    const run = (fn: () => Promise<void>) => {
      if (!haptics_enabled) return;
      // A platform without haptics (the web) may throw or reject; neither may reach the screen.
      try {
        fn().catch(() => {});
      } catch {}
    };
    const sound = (name: SoundName) => {
      if (sound_enabled) playSound(name);
    };
    const tick = () => run(() => Haptics.selectionAsync());
    const impact = (style: Haptics.ImpactFeedbackStyle) => run(() => Haptics.impactAsync(style));
    // A later beat of a pattern; skipped if haptics were off when it started.
    const later = (ms: number, fn: () => void) => {
      if (haptics_enabled) setTimeout(fn, ms);
    };
    return {
      tick,
      /** The older name for tick, kept for existing callers. */
      tap: tick,
      press: () => {
        run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
        sound("press");
      },
      thud: () => {
        run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
        sound("knock");
      },
      success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
      error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
      paper: () => {
        impact(Haptics.ImpactFeedbackStyle.Light);
        sound("paper");
      },
      pickup: () => {
        impact(Haptics.ImpactFeedbackStyle.Medium);
        sound("pickup");
      },
      wrongCode: () => {
        impact(Haptics.ImpactFeedbackStyle.Heavy);
        later(PATTERN.wrongCode, () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)));
        sound("wrongCode");
      },
      unlock: () => {
        impact(Haptics.ImpactFeedbackStyle.Medium);
        later(PATTERN.latch, () => impact(Haptics.ImpactFeedbackStyle.Light));
        sound("unlock");
      },
      stamp: () => {
        impact(Haptics.ImpactFeedbackStyle.Heavy);
        sound("stamp");
      },
      solved: () => {
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        later(PATTERN.solved[0], () => impact(Haptics.ImpactFeedbackStyle.Light));
        later(PATTERN.solved[1], () => impact(Haptics.ImpactFeedbackStyle.Medium));
        sound("solved");
      },
      shutter: () => {
        impact(Haptics.ImpactFeedbackStyle.Medium);
        sound("shutter");
      },
      typewriter: () => sound("typewriter"),
    };
  }, [haptics_enabled, sound_enabled]);
}

export type Feedback = ReturnType<typeof useFeedback>;
