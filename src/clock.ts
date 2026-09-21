/**
 * The scene time for `/jev`, a module ref rather than store state for the same
 * reason `src/scene/clock.ts` is one: the sky, the fire, the steam and every
 * opening door read it every frame, and a store subscription would re-render
 * the canvas subtree sixty times a second.
 *
 * One `<SceneClock />` mounted first in `JevScene` advances it. Everything
 * that moves on this page is a closed form of `t` — the doors and windows
 * through the tweens in `motion.ts`, the fire and the weather through their
 * own sines — so a frame is reproducible from the clock alone.
 */
export const clock = { t: 0 };

/** Frames longer than a third of a second are a stall, not elapsed time. */
export const advanceClock = (dt: number) => {
  clock.t += Math.min(dt, 1 / 3);
};
