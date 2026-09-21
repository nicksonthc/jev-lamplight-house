import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { clock } from '../clock';
import { live } from '../useJevStore';
import { random } from './palette';

/**
 * The shower, when the visitor turns it on.
 *
 * Every drop is a closed form: its column is fixed, and its height is the
 * clock times a terminal speed, wrapped — so the rain has no state, seeks
 * exactly, and costs one matrix write per drop per frame. The whole field is
 * one instanced draw.
 *
 * It is sized for the volume the camera can be in rather than for the world:
 * the column follows the camera in X and Z, which is invisible at this drop
 * length and keeps the count at a thousand instead of a hundred thousand.
 */

const COUNT = 1100;
const SPAN = 26; // the box the drops fall through, a side
const TOP = 16;
const SPEED = 9.5; // m/s, a fair shower rather than a monsoon
const LEAN = 0.16; // the wind, as a fraction of the fall

export function Rain() {
  const mesh = useRef<T.InstancedMesh>(null);

  const { geometry, material, seeds } = useMemo(() => {
    const rand = random(90210);
    // A thin tapered streak reads as a drop at speed; a sphere reads as hail.
    const geometry = new T.CylinderGeometry(0.008, 0.02, 0.42, 4);
    geometry.rotateZ(LEAN);
    const material = new T.MeshBasicMaterial({
      color: '#cfe0e8',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const seeds = Array.from({ length: COUNT }, () => ({
      x: (rand() - 0.5) * SPAN,
      z: (rand() - 0.5) * SPAN,
      phase: rand(),
      length: 0.7 + rand() * 0.8,
    }));
    return { geometry, material, seeds };
  }, []);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const matrix = useMemo(() => new T.Matrix4(), []);
  const scale = useMemo(() => new T.Vector3(), []);
  const position = useMemo(() => new T.Vector3(), []);
  const quaternion = useMemo(() => new T.Quaternion(), []);

  useFrame((state) => {
    const node = mesh.current;
    if (!node) return;
    const wet = live('raining', clock.t);
    material.opacity = 0.5 * wet;
    node.visible = wet > 0.01;
    if (!node.visible) return;

    const camera = state.camera.position;
    const t = clock.t;
    for (let i = 0; i < COUNT; i++) {
      const seed = seeds[i];
      const fall = (seed.phase + (t * SPEED) / TOP) % 1;
      const y = TOP * (1 - fall);
      position.set(camera.x + seed.x + y * LEAN, y, camera.z + seed.z);
      scale.set(1, seed.length, 1);
      node.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    node.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, COUNT]}
      frustumCulled={false}
      visible={false}
    />
  );
}
