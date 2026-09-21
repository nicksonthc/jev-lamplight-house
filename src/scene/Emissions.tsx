import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { clock } from '../clock';
import { live } from '../useJevStore';
import { random } from './palette';

/**
 * The small moving things the switches produce: smoke off the chimney, steam
 * off the kettle, notes out of the gramophone horn, and the motes that hang
 * in the light on a fine day.
 *
 * Every one is a closed form of `clock.t` and its own index — phase, height,
 * size and fade all read off one wrapped fraction — so nothing here holds
 * state between frames and a paused scene is a still that can be reproduced.
 * A puff that integrated its own velocity would be the one thing on the page
 * that a seek could not put back.
 */

const fract = (v: number) => v - Math.floor(v);

function puffMaterial(color: string, opacity: number) {
  return new T.MeshStandardMaterial({
    color,
    emissive: new T.Color(color),
    emissiveIntensity: 0.15,
    transparent: true,
    opacity,
    depthWrite: false,
    roughness: 1,
  });
}

export function Emissions({
  chimney,
  horn,
  kettle,
}: {
  chimney: T.Vector3;
  horn: T.Vector3;
  kettle: T.Object3D;
}) {
  const smoke = useRef<T.Group>(null);
  const steam = useRef<T.Group>(null);
  const notes = useRef<T.Group>(null);
  const motes = useRef<T.InstancedMesh>(null);

  const kit = useMemo(() => {
    const rand = random(5150);
    const smokeMat = puffMaterial('#d8d2c8', 0.5);
    const steamMat = puffMaterial('#f2f6f5', 0.5);
    const noteMat = new T.MeshStandardMaterial({
      color: '#f4d99a',
      emissive: new T.Color('#f4d99a'),
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const moteMat = new T.MeshBasicMaterial({
      color: '#fff3d2',
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: T.AdditiveBlending,
    });

    const sphere = new T.SphereGeometry(1, 9, 7);
    const build = (count: number, material: T.Material) => {
      const group = new T.Group();
      for (let i = 0; i < count; i++) {
        const puff = new T.Mesh(sphere, material);
        puff.userData.seed = rand();
        puff.castShadow = false;
        puff.frustumCulled = false;
        group.add(puff);
      }
      return group;
    };

    // A quaver: the head and the stem, which is all it needs to read at 2 m.
    const note = new T.Group();
    const noteGeom = new T.SphereGeometry(0.05, 8, 6);
    const stemGeom = new T.BoxGeometry(0.014, 0.16, 0.014);
    const notesGroup = new T.Group();
    for (let i = 0; i < 6; i++) {
      const glyph = note.clone();
      const head = new T.Mesh(noteGeom, noteMat);
      head.scale.set(1.3, 1, 1);
      const stem = new T.Mesh(stemGeom, noteMat);
      stem.position.set(0.05, 0.09, 0);
      glyph.add(head, stem);
      glyph.userData.seed = rand();
      glyph.frustumCulled = false;
      notesGroup.add(glyph);
    }

    const moteGeom = new T.SphereGeometry(0.011, 5, 4);
    const moteMesh = new T.InstancedMesh(moteGeom, moteMat, 120);
    moteMesh.frustumCulled = false;
    const moteSeeds = Array.from({ length: 120 }, () => ({
      x: -5 + rand() * 10,
      y: rand(),
      z: -1 + rand() * 9,
      s: rand(),
    }));

    return {
      smoke: build(26, smokeMat),
      steam: build(8, steamMat),
      notes: notesGroup,
      moteMesh,
      moteSeeds,
      dispose: () => {
        sphere.dispose();
        noteGeom.dispose();
        stemGeom.dispose();
        moteGeom.dispose();
        smokeMat.dispose();
        steamMat.dispose();
        noteMat.dispose();
        moteMat.dispose();
      },
    };
  }, []);

  useEffect(() => kit.dispose, [kit]);

  const matrix = useMemo(() => new T.Matrix4(), []);
  const spot = useMemo(() => new T.Vector3(), []);

  useFrame(() => {
    const t = clock.t;
    const fire = live('hearth', t);
    const kettleOn = live('kettle', t);
    const music = live('gramophone', t);
    const raining = live('raining', t);

    // Smoke: a column that leans with height, thinning as it goes.
    if (smoke.current) {
      smoke.current.visible = fire > 0.02;
      smoke.current.children.forEach((puff, i) => {
        const seed = puff.userData.seed as number;
        const phase = fract(t * 0.1 + i / smoke.current!.children.length + seed * 0.03);
        const h = phase * 7.0;
        puff.position.set(
          chimney.x + Math.sin(phase * 3 + seed * 6) * (0.4 + phase * 1.9),
          chimney.y + 0.4 + h,
          chimney.z + Math.cos(phase * 2.4 + seed * 6) * (0.3 + phase * 1.4),
        );
        const size = (0.18 + phase * 0.72) * (0.8 + seed * 0.45) * Math.min(1, (1 - phase) * 3.2) * fire;
        puff.scale.setScalar(size);
        (puff as T.Mesh).visible = phase < 0.96;
      });
      const material = (kit.smoke.children[0] as T.Mesh).material as T.MeshStandardMaterial;
      material.opacity = 0.2 * fire;
    }

    // Steam wants a kettle on a *lit* fire; a cold kettle on a cold hob does
    // nothing, and steaming anyway is the kind of detail that gives a scene
    // away.
    if (steam.current) {
      const strength = Math.min(fire, kettleOn);
      steam.current.visible = strength > 0.05;
      kettle.getWorldPosition(spot);
      steam.current.children.forEach((puff, i) => {
        const seed = puff.userData.seed as number;
        const phase = fract(t * 0.5 + i / steam.current!.children.length);
        puff.position.set(
          spot.x + 0.15 + Math.sin(phase * 5 + seed * 6) * (0.05 + phase * 0.22),
          spot.y + 0.32 + phase * 1.1,
          spot.z + Math.cos(phase * 4 + seed * 6) * (0.04 + phase * 0.18),
        );
        puff.scale.setScalar((0.05 + phase * 0.2) * (1 - phase) * 1.7 * strength);
      });
      const material = (kit.steam.children[0] as T.Mesh).material as T.MeshStandardMaterial;
      material.opacity = 0.24 * strength * (1 - phaseFade(t));
    }

    if (notes.current) {
      notes.current.visible = music > 0.05;
      notes.current.children.forEach((glyph, i) => {
        const seed = glyph.userData.seed as number;
        const phase = fract(t * 0.28 + i / notes.current!.children.length);
        glyph.position.set(
          horn.x + Math.sin(phase * 6 + seed * 6) * 0.35,
          horn.y + phase * 1.5,
          horn.z + 0.2 + phase * 0.5 + Math.cos(phase * 4 + seed * 6) * 0.2,
        );
        glyph.rotation.z = Math.sin(phase * 7 + seed * 5) * 0.4;
        const fade = Math.sin(phase * Math.PI);
        glyph.scale.setScalar(fade * music);
      });
    }

    // Motes only hang in the air on a fine day; rain washes them out.
    if (motes.current) {
      const clarity = 1 - raining;
      motes.current.visible = clarity > 0.05;
      kit.moteSeeds.forEach((seed, i) => {
        const phase = fract(seed.y + t * 0.016 + seed.s * 0.2);
        matrix.makeTranslation(
          seed.x + Math.sin(t * 0.17 + seed.s * 9) * 0.7,
          0.4 + phase * 4.2,
          seed.z + Math.cos(t * 0.13 + seed.s * 7) * 0.7,
        );
        motes.current!.setMatrixAt(i, matrix);
      });
      motes.current.instanceMatrix.needsUpdate = true;
      (motes.current.material as T.MeshBasicMaterial).opacity = 0.16 * clarity;
    }
  });

  return (
    <>
      <primitive ref={smoke} object={kit.smoke} />
      <primitive ref={steam} object={kit.steam} />
      <primitive ref={notes} object={kit.notes} />
      <primitive ref={motes} object={kit.moteMesh} />
    </>
  );
}

/** Steam thins as the kettle settles, then builds again — it is not a jet. */
const phaseFade = (t: number) => 0.25 + 0.25 * Math.sin(t * 0.7);
