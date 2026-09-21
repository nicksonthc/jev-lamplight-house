import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { clock } from '../clock';
import { judgeLocally } from '../localJudge';
import { describeHouse, PART_IDS, type HouseSwitches, type PartId } from '../questions';
import { live as value, useJevStore } from '../useJevStore';
import { live as look } from './look';

/**
 * The read-only handle `scripts/check-jev.mjs` drives the page through.
 *
 * It goes through the same store actions the interface does — `flip`,
 * `receive`, `settle` — so a check cannot prove a behaviour a visitor could
 * not get to. `judge` and `receive` together let the whole scene's reaction
 * be exercised with no network at all, which is what makes the check
 * deterministic when the gateway is unfunded or offline.
 */
export function JevBridge() {
  /**
   * Frames drawn since load. A check can drive the store faster than this
   * scene renders — on SwiftShader a frame can take a second — so without a
   * count to wait on, a test reads a pose from before the switch it just
   * flipped. `JevBridge` is mounted after `Cottage` in `JevScene`, and R3F
   * runs same-priority callbacks in mount order, so a tick here means the
   * parts have already been put where the store says they are.
   */
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
  });

  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as
    | { target: Vector3; update: () => unknown }
    | null;

  useEffect(() => {
    window.jev = {
      renderer: gl,
      scene,
      camera,
      controls,
      store: useJevStore,
      get t() {
        return clock.t;
      },
      get frames() {
        return frames.current;
      },
      seek: (t: number) => {
        clock.t = t;
      },
      settle: () => useJevStore.getState().settle(),
      switches: () => ({ ...useJevStore.getState().switches }),
      flip: (id) => useJevStore.getState().flip(id),
      state: () => describeHouse(useJevStore.getState().switches),
      ask: () => useJevStore.getState().ask(),
      judge: (switches: HouseSwitches) => judgeLocally(switches),
      receive: (reply) => useJevStore.getState().receive(reply),
      value: (id: string) => value(id),
      parts: () =>
        Object.fromEntries(PART_IDS.map((id) => [id, value(id)])) as Record<PartId, number>,
      // Looked up rather than passed in: the cat names itself in the scene
      // graph, and one lookup a call costs nothing outside the frame loop.
      cat: () => ({
        u: value('cat'),
        position: (scene.getObjectByName('cat')?.position.toArray() ?? [0, 0, 0]) as [
          number,
          number,
          number,
        ],
      }),
      // Where a part's anchor lands on screen, in CSS pixels. The check
      // clicks parts by name through this rather than at hard-coded pixels,
      // so re-framing a viewpoint cannot silently turn a click test into a
      // click on the grass.
      screen: (id: PartId) => {
        const model = scene.getObjectByName('cottage');
        const anchor = model?.userData.anchors?.[id] as Vector3 | undefined;
        const point = (anchor ?? new Vector3()).clone().project(camera);
        const rect = gl.domElement.getBoundingClientRect();
        return [
          rect.left + ((point.x + 1) / 2) * rect.width,
          rect.top + ((1 - point.y) / 2) * rect.height,
        ] as [number, number];
      },
      look: () => ({
        fogDensity: look.fogDensity,
        exposure: look.exposure,
        sunIntensity: look.sunIntensity,
        horizon: look.skyHorizon.getHex(),
      }),
    };
    return () => {
      delete window.jev;
    };
  }, [gl, scene, camera, controls]);

  return null;
}
