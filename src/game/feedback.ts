// Haptic and sound feedback that follows the player's settings. Clues never
// depend on either alone; this only reinforces what the screen already shows.
// Haptics follow haptics_enabled and sound follows sound_enabled, separately:
// either can be off without touching the other.
//
// The game is felt more than heard. Every cue has its haptic; only a few have
// a sound, where something physical happens in the world and the player
// earned it (src/game/sound.ts, docs/AUDIO.md). No button, tap, selection,
// arrival or outcome makes a sound; nothing sounds because a screen opened.
//
// One small vocabulary for the whole app (docs/DESIGN.md, Global tokens:
// Haptics), so the same kind of moment always feels the same:
// - tick (tap): a selection moving (a code wheel digit, a photo page settling,
//   a toggle, a segment). The lightest.
// - press: a button, chip or card pressed in. A light impact.
// - thud: a firm, physical moment (an item landing, building a case). Medium.
// - success / warning / error: an outcome the screen also states.
// The game's own moments, each named so a screen asks for the moment, not a
// vibration. Those with a sound say so; the sound is quiet, short and on the
// haptic's beat. A cue with a sound takes `audible` (default true): false
// keeps its haptic and leaves it silent, for the same moment where a sound
// would be one too many (a stamp on every solved step, the brief's letter).
// - paper: a page turned, a clue found. Light; with sound, a page lifted,
//   swung over and laid down.
// - pickup: an item found and kept. Medium.
// - wrongCode: a wrong code or accusation. Heavy, then the error pattern.
// - unlock: a lock giving way. Medium, then light at the latch (110 ms); with
//   sound, the bolt's clack and the latch dropping on the same beats.
// - stamp: a rubber stamp pressed down (CASE CLOSED, GUILTY). Heavy; with
//   sound, a dull rubber thump on a wooden desk.
// - solved: the case solved. The success pattern, then two closing taps.
// - drawer: a drawer pulled open. Light as it goes, medium at the stop
//   (170 ms); with sound, wood sliding and its knock at the stop.
// - cloth: a cloth lifted off something. Light.
// - snap: an item used on something and fitting. Medium.
// - detent: a lock or code wheel stepping one place. The tick.
// - uvSwitch: the UV light turned on. Light.
// - lensUp / lensDown: the magnifier lifted (the tick) and set down (light).
// - purr: the cat, rubbed. Light.
// - paperFold: a sheet folded over and creased. The tick, a light tap at the
//   crease (160 ms).
// - waxCrack: an envelope's wax seal cracked open. Light.
// - stringOff: an envelope's string unwound: the tick, and again as the
//   second and third turns come free (240 and 370 ms).
// - musicNote(i): a tooth of the music box's comb plucked, i = 0..5 from low to
//   high (C5 D5 E5 G5 A5 C6). The tick and the tooth's note (the box is an
//   instrument: its notes are what it says); notes ring out over each other.
//   Pass false as the second argument when the box plays by itself (no touch,
//   so no haptic). An index outside 0..5 does nothing.
// - doorOut: the noir ending's door opened onto the rainy street. Medium; with
//   sound, its latch, a brief creak and the rain coming in (1.8 s).
// - candleOut: the paranormal ending's candle going out. A light tap on the
//   puff, 450 ms in; with sound, the flutter, the puff, the wick's hiss.
// - shutter: the camera taking a photo. Medium; with sound, the shutter.
// - mugBreak, pencilRub, typewriter: once sound only; now nothing at all.
import { useEffect, useMemo } from "react";
import * as Haptics from "expo-haptics";
import { usePreferences } from "./preferences";
import { MUSIC_NOTES, playSound, preloadSounds, type SoundName } from "./sound";

/** The beats of the patterns, in ms after the first. The sounds are cut to the same beats. */
const PATTERN = { wrongCode: 90, latch: 110, solved: [260, 400], drawer: 170, crease: 160, string: [240, 370], puff: 450 } as const;

export function useFeedback() {
  const { haptics_enabled, sound_enabled } = usePreferences();
  useEffect(() => {
    // Load the effects before the first cue needs one (loading plays nothing).
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
    const sound = (name: SoundName, audible = true) => {
      if (sound_enabled && audible) playSound(name);
    };
    const tick = () => run(() => Haptics.selectionAsync());
    const impact = (style: Haptics.ImpactFeedbackStyle) => run(() => Haptics.impactAsync(style));
    const light = () => impact(Haptics.ImpactFeedbackStyle.Light);
    const medium = () => impact(Haptics.ImpactFeedbackStyle.Medium);
    const heavy = () => impact(Haptics.ImpactFeedbackStyle.Heavy);
    // A later beat of a pattern; skipped if haptics were off when it started.
    const later = (ms: number, fn: () => void) => {
      if (haptics_enabled) setTimeout(fn, ms);
    };
    const nothing = () => {};
    return {
      tick,
      /** The older name for tick, kept for existing callers. */
      tap: tick,
      press: light,
      thud: medium,
      success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
      warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
      error: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
      paper: (audible = true) => {
        light();
        sound("paper", audible);
      },
      pickup: medium,
      wrongCode: () => {
        heavy();
        later(PATTERN.wrongCode, () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)));
      },
      unlock: (audible = true) => {
        medium();
        later(PATTERN.latch, light);
        sound("unlock", audible);
      },
      stamp: (audible = true) => {
        heavy();
        sound("stamp", audible);
      },
      solved: () => {
        run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
        later(PATTERN.solved[0], light);
        later(PATTERN.solved[1], medium);
      },
      shutter: () => {
        medium();
        sound("shutter");
      },
      typewriter: nothing,
      drawer: () => {
        light();
        later(PATTERN.drawer, medium);
        sound("drawer");
      },
      cloth: light,
      snap: medium,
      detent: tick,
      uvSwitch: light,
      lensUp: tick,
      lensDown: light,
      purr: light,
      mugBreak: nothing,
      pencilRub: nothing,
      paperFold: () => {
        tick();
        later(PATTERN.crease, light);
      },
      musicNote: (index: number, touched = true) => {
        // Not one of the six teeth (out of range, a fraction, NaN): nothing.
        const name = MUSIC_NOTES[index];
        if (!name) return;
        if (touched) tick();
        sound(name);
      },
      waxCrack: light,
      stringOff: () => {
        tick();
        for (const ms of PATTERN.string) later(ms, tick);
      },
      doorOut: () => {
        medium();
        sound("doorOut");
      },
      candleOut: () => {
        later(PATTERN.puff, light);
        sound("candleOut");
      },
    };
  }, [haptics_enabled, sound_enabled]);
}

export type Feedback = ReturnType<typeof useFeedback>;
