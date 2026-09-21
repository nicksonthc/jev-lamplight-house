import {
  type HouseSwitches,
  type Mood,
  type Nudge,
  type Verdict,
  WELCOME_LEVELS,
} from './questions.ts';

/**
 * The stand-in judge: the same four answers, decided by rules written here.
 *
 * It exists so `/jev` is a working page with no key, no network and no credit
 * on the gateway — and so the scene's reaction to a verdict can be developed
 * and screenshotted without spending anything. It is deliberately *not* dressed
 * up to look like the model: it returns no distributions, because it has none,
 * and the page labels its answers `LOCAL RULES` so nobody mistakes a lookup
 * table for a judgment.
 */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function mood(s: HouseSwitches, open: boolean, weatherIn: boolean): Mood {
  if (weatherIn) return 'draughty';
  if (!s.hearth && !s.lamp && !open && s.curtain) return 'forlorn';
  if (s.hearth && s.lamp && s.kettle && s.gramophone) return 'festive';
  if (open && !s.raining && !s.curtain) return 'bright';
  if (s.hearth || s.lamp) return 'sleepy';
  return 'forlorn';
}

function nudge(s: HouseSwitches, weatherIn: boolean): Nudge {
  // Ordered by what a person in the room would deal with first.
  if (weatherIn) return 'shut-out-the-weather';
  if (s.laundry && s.raining) return 'bring-the-washing-in';
  if (!s.hearth) return 'light-the-fire';
  if (!s.lamp && (s.curtain || s.raining)) return 'turn-up-the-light';
  if (!s.kettle) return 'put-the-kettle-on';
  if (!s.chair) return 'draw-up-the-chair';
  if (!s.raining && !s.window && !s.door) return 'let-some-air-in';
  return 'nothing';
}

export function judgeLocally(s: HouseSwitches): Verdict {
  const open = s.door || s.window || s.attic;
  const weatherIn = s.raining && open;

  const welcome = clamp01(
    (1.0 +
      (s.hearth ? 1.0 : 0) +
      (s.lamp ? 0.5 : 0) +
      (s.kettle ? 0.4 : 0) +
      (s.chair ? 0.4 : 0) +
      (s.gramophone ? 0.3 : 0) +
      (s.door ? 0.4 : 0) -
      (weatherIn ? 0.9 : 0) -
      (s.curtain && !s.raining ? 0.4 : 0)) /
      (WELCOME_LEVELS.length - 1),
  );

  const cat = clamp01(
    (s.door || s.window ? 0.28 : 0.02) +
      (s.hearth ? 0.34 : 0) +
      (s.chair ? 0.12 : 0) +
      (s.lamp ? 0.06 : 0) +
      (s.kettle ? 0.04 : 0) -
      (s.gramophone ? 0.14 : 0) -
      (weatherIn ? 0.18 : 0),
  );

  return {
    mood: { type: 'choice', choice: mood(s, open, weatherIn) },
    welcome: { type: 'score', score: welcome * (WELCOME_LEVELS.length - 1) },
    cat: { type: 'boolean', probability: cat },
    nudge: { type: 'choice', choice: nudge(s, weatherIn) },
  };
}
