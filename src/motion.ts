import { clock } from './clock';

/**
 * A value on its way somewhere: where it started, where it is going, and when
 * it set off. Reading it is a closed form of the clock, so a door half open is
 * the same door at the same `t` however the frames fell — and nothing on this
 * page accumulates per frame.
 */
export interface Tween {
  from: number;
  to: number;
  at: number;
  seconds: number;
  /** `swing` overshoots a little and settles, the way a hinge does. */
  ease: 'smooth' | 'swing';
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// A hinge carries weight past its stop and comes back; a curtain or a light
// just arrives. The overshoot is small — a door that bounces reads as a toy.
const EASES = {
  smooth: (x: number) => x * x * (3 - 2 * x),
  swing: (x: number) => {
    const c = 1.42;
    const u = x - 1;
    return 1 + (c + 1) * u * u * u + c * u * u;
  },
} as const;

export function tweenValue(tween: Tween, t = clock.t): number {
  const x = clamp01((t - tween.at) / tween.seconds);
  return tween.from + (tween.to - tween.from) * EASES[tween.ease](x);
}

/** A new tween to `to`, leaving from wherever `previous` had got to. */
export function tweenTo(
  to: number,
  previous: Tween | undefined,
  seconds = 0.65,
  ease: Tween['ease'] = 'smooth',
): Tween {
  return {
    from: previous ? tweenValue(previous) : to,
    to,
    at: clock.t,
    seconds,
    ease,
  };
}

export const settled = (to: number): Tween => ({
  from: to,
  to,
  at: 0,
  seconds: 1,
  ease: 'smooth',
});
