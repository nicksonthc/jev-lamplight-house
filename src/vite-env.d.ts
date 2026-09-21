/// <reference types="vite/client" />

import type { Camera, Scene, Vector3, WebGLRenderer } from 'three';
import type { SwitchId, useJevStore } from './useJevStore';
import type { HouseState, HouseSwitches, JevReply, PartId, Verdict } from './questions';

declare global {
  interface Window {
    /**
     * The read-only handle `scripts/check-jev.mjs` drives the page through. It
     * goes through the same store actions the interface does, so a check
     * cannot prove a behaviour a visitor could not get to — and `judge` plus
     * `receive` let the scene's whole reaction to a verdict be exercised with
     * no network, which is what keeps the check deterministic when the gateway
     * is unreachable.
     */
    jev?: {
      renderer: WebGLRenderer;
      scene: Scene;
      camera: Camera;
      controls: { target: Vector3; update: () => unknown } | null;
      store: typeof useJevStore;
      readonly t: number;
      /** Frames drawn since load; wait on it before reading a pose. */
      readonly frames: number;
      seek: (t: number) => void;
      /** Put every tween at its destination and snap the eased look. */
      settle: () => void;
      switches: () => HouseSwitches;
      flip: (id: SwitchId) => void;
      /** Exactly what is posted to `/api/jev`. */
      state: () => HouseState;
      ask: () => Promise<JevReply | null>;
      /** The local rule judge, called directly — no endpoint, no model. */
      judge: (switches: HouseSwitches) => Verdict;
      /** Hand the page a verdict as though it had come back from the model. */
      receive: (reply: JevReply) => void;
      /** One animated scalar: a part id, or `welcome` / `cat` / `raining`. */
      value: (id: string) => number;
      parts: () => Record<PartId, number>;
      cat: () => { u: number; position: [number, number, number] };
      /** Where a part's anchor lands on screen, in CSS pixels. */
      screen: (id: PartId) => [number, number];
      look: () => {
        fogDensity: number;
        exposure: number;
        sunIntensity: number;
        horizon: number;
      };
    };
  }
}

export {};
