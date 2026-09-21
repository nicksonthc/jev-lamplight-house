import { Color } from 'three';
import type { Mood } from '../questions';

/**
 * The look of the day, and there is one of it.
 *
 * The sky dome, the sun, the fog, the exposure and the grass all read *this*
 * module, and `setLook` is its only writer. An effect that kept its own idea of how late it is would disagree
 * with the other four, and the first symptom is a golden sky over cold grass.
 *
 * Jev's `mood` choice picks the target; `easeLook` walks the live values
 * toward it over a couple of seconds, so a verdict arriving is weather
 * turning rather than a cut.
 */
export interface Look {
  skyTop: Color;
  skyHorizon: Color;
  sun: Color;
  sunIntensity: number;
  sky: Color;
  ground: Color;
  hemiIntensity: number;
  fog: Color;
  fogDensity: number;
  exposure: number;
}

const look = (
  skyTop: string,
  skyHorizon: string,
  sun: string,
  sunIntensity: number,
  hemiIntensity: number,
  fog: string,
  fogDensity: number,
  exposure: number,
): Look => ({
  skyTop: new Color(skyTop),
  skyHorizon: new Color(skyHorizon),
  sun: new Color(sun),
  sunIntensity,
  sky: new Color(skyHorizon),
  ground: new Color('#6c7c4a'),
  hemiIntensity,
  fog: new Color(fog),
  fogDensity,
  exposure,
});

/**
 * One look per mood Jev can choose. They are the five answers made visible:
 * the page would be a form with a text field otherwise.
 */
export const LOOKS: Record<Mood, Look> = {
  bright: look('#3f86cc', '#d3e9f6', '#fff4da', 2.7, 1.15, '#dcebf3', 0.0028, 1.04),
  sleepy: look('#79a0c6', '#f4d6ab', '#ffd49c', 2.0, 0.92, '#f0dcc2', 0.0042, 1.0),
  festive: look('#2f4c7c', '#ffc78a', '#ffbe78', 1.8, 0.78, '#e6c6a4', 0.005, 1.1),
  draughty: look('#5a7387', '#b9c7cd', '#ccd6dd', 1.2, 0.95, '#c2cdd4', 0.0075, 0.95),
  forlorn: look('#48566a', '#95a0ac', '#a8b8c4', 1.05, 0.82, '#9fabb5', 0.0068, 0.93),
};

/** Rain is not a mood: it thickens and greys whichever look is current. */
const RAIN_TINT = new Color('#9fb0bb');

const copy = (from: Look): Look => ({
  ...from,
  skyTop: from.skyTop.clone(),
  skyHorizon: from.skyHorizon.clone(),
  sun: from.sun.clone(),
  sky: from.sky.clone(),
  ground: from.ground.clone(),
  fog: from.fog.clone(),
});

export const live = copy(LOOKS.bright);
const target = copy(LOOKS.bright);

/** The only writer of the target look. */
export function setLook(mood: Mood, raining: boolean) {
  const base = LOOKS[mood];
  const wet = raining ? 0.45 : 0;
  target.skyTop.copy(base.skyTop).lerp(RAIN_TINT, wet * 0.7);
  target.skyHorizon.copy(base.skyHorizon).lerp(RAIN_TINT, wet);
  target.sun.copy(base.sun).lerp(RAIN_TINT, wet);
  target.sky.copy(base.sky).lerp(RAIN_TINT, wet);
  target.ground.copy(base.ground).lerp(RAIN_TINT, wet * 0.5);
  target.fog.copy(base.fog).lerp(RAIN_TINT, wet);
  target.sunIntensity = base.sunIntensity * (raining ? 0.45 : 1);
  target.hemiIntensity = base.hemiIntensity * (raining ? 0.85 : 1);
  target.fogDensity = base.fogDensity * (raining ? 2.1 : 1);
  target.exposure = base.exposure * (raining ? 0.94 : 1);
}

/**
 * Walk the live look toward the target. Frame-rate independent: the same
 * fraction of the remaining distance per second however long the frame was.
 */
export function easeLook(dt: number) {
  const k = 1 - Math.exp(-dt / 0.9);
  live.skyTop.lerp(target.skyTop, k);
  live.skyHorizon.lerp(target.skyHorizon, k);
  live.sun.lerp(target.sun, k);
  live.sky.lerp(target.sky, k);
  live.ground.lerp(target.ground, k);
  live.fog.lerp(target.fog, k);
  live.sunIntensity += (target.sunIntensity - live.sunIntensity) * k;
  live.hemiIntensity += (target.hemiIntensity - live.hemiIntensity) * k;
  live.fogDensity += (target.fogDensity - live.fogDensity) * k;
  live.exposure += (target.exposure - live.exposure) * k;
}

/**
 * Jump the live look to the target. The checks call it so a screenshot is
 * taken of a settled sky rather than of one two seconds into clearing.
 */
export function snapLook() {
  live.skyTop.copy(target.skyTop);
  live.skyHorizon.copy(target.skyHorizon);
  live.sun.copy(target.sun);
  live.sky.copy(target.sky);
  live.ground.copy(target.ground);
  live.fog.copy(target.fog);
  live.sunIntensity = target.sunIntensity;
  live.hemiIntensity = target.hemiIntensity;
  live.fogDensity = target.fogDensity;
  live.exposure = target.exposure;
}

/** The sun's direction, shared by the light, the sky's glow and the shadows. */
export const SUN = [16, 21, 13] as const;
