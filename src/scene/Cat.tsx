import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { clock } from '../clock';
import { live } from '../useJevStore';
import { ball, cylinder, disposeTree, mats } from './palette';

/**
 * The cat is Jev's boolean, walking.
 *
 * `cat` comes back as P(true) — not a yes — so the obvious rendering is a
 * threshold and a cat that teleports. Instead the probability is a distance
 * along the path the garden hands over: on the wall at nothing, on the path
 * at a maybe, on the doorstep around a half, curled on the rug at a
 * confident yes. A model that is 0.55 sure looks 0.55 sure.
 *
 * Its whole motion is a closed form of the probability and the clock, like
 * everything else on this page.
 */

const smoothstep = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

export function Cat({ path }: { path: T.CatmullRomCurve3 }) {
  const group = useRef<T.Group>(null);

  const cat = useMemo(() => {
    const root = new T.Group();
    root.name = 'cat';
    // Built at a comfortable working size and then taken down to a cat: the
    // numbers below are easier to read as tenths of a metre than as sixths.
    root.scale.setScalar(0.82);

    const body = ball(root, 'cat-body', 0.22, [0, 0.27, 0], mats.cat, [1.05, 0.95, 1.9], 14);
    const head = ball(root, 'cat-head', 0.145, [0, 0.38, 0.3], mats.cat, [1, 0.95, 0.95], 14);
    ball(root, 'cat-muzzle', 0.075, [0, 0.34, 0.41], mats.catPale, [1.1, 0.8, 0.8], 10);
    for (const side of [-1, 1]) {
      const ear = cylinder(root, 'cat-ear', 0.001, 0.062, 0.12, [side * 0.082, 0.5, 0.29], mats.cat, undefined, 6);
      ear.rotation.z = side * 0.24;
      ball(root, 'cat-eye', 0.022, [side * 0.06, 0.41, 0.41], mats.catPale, [1, 1, 0.6], 8);
    }

    // Leg and paw in one group, so tucking the legs under a curled cat takes
    // the paws with them — four white blobs left floating on the rug was the
    // first version of this.
    const legs: T.Object3D[] = [];
    for (const [dx, dz] of [[-0.11, 0.17], [0.11, 0.17], [-0.12, -0.16], [0.12, -0.16]] as const) {
      const leg = new T.Group();
      leg.position.set(dx, 0, dz);
      root.add(leg);
      legs.push(leg);
      cylinder(leg, 'cat-leg', 0.038, 0.045, 0.28, [0, 0.14, 0], mats.cat, undefined, 6);
      ball(leg, 'cat-paw', 0.05, [0, 0.04, 0], mats.catPale, [1, 0.7, 1.2], 8);
    }

    // The tail is its own chain so it can wrap the body when the cat settles.
    const tail = new T.Group();
    tail.position.set(0, 0.31, -0.37);
    root.add(tail);
    const joints: T.Object3D[] = [];
    let link: T.Object3D = tail;
    for (let i = 0; i < 6; i++) {
      const joint = new T.Group();
      joint.position.set(0, 0, -0.1);
      link.add(joint);
      ball(joint, 'cat-tail', 0.05 - i * 0.005, [0, 0, -0.05], mats.cat, [1, 1, 1], 8);
      joints.push(joint);
      link = joint;
    }

    return { root, body, head, legs, joints, tail };
  }, []);

  useEffect(() => () => disposeTree(cat.root), [cat]);

  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const t = clock.t;
    // Below 0.12 the cat has not been persuaded at all; above 0.92 it is in.
    const u = smoothstep(0.12, 0.92, live('cat', t));
    const at = path.getPointAt(u);
    node.position.copy(at);

    const tangent = path.getTangentAt(Math.min(0.999, Math.max(0.001, u)));
    const facing = Math.atan2(tangent.x, tangent.z);
    // Sitting at either end it faces the house; in between it faces its walk.
    const settled = Math.min(smoothstep(0.1, 0.0, u) + smoothstep(0.86, 1, u), 1);
    node.rotation.y = facing * (1 - settled) + Math.PI * settled * (u > 0.5 ? 0.35 : 1);

    const walking = 1 - settled;
    // A bob and a sway, only while there are legs moving under it.
    node.position.y += walking * Math.abs(Math.sin(t * 7)) * 0.035;
    node.rotation.z = walking * Math.sin(t * 7) * 0.05;
    cat.legs.forEach((leg, i) => {
      leg.rotation.x = walking * Math.sin(t * 7 + (i % 2) * Math.PI) * 0.5;
    });

    // Curled on the rug: rounder and lower, legs folded under, the head laid
    // against the flank and the tail brought round the front of it.
    const curl = smoothstep(0.88, 1, u);
    cat.body.scale.set(1.05 + curl * 0.35, 0.95 - curl * 0.22, 1.9 - curl * 0.62);
    cat.body.position.y = 0.27 - curl * 0.07;
    cat.head.position.set(curl * 0.21, 0.38 - curl * 0.14, 0.3 - curl * 0.19);
    cat.head.rotation.y = curl * 1.5;
    cat.head.rotation.z = curl * 0.3;
    for (const leg of cat.legs) {
      leg.visible = curl < 0.8;
      leg.scale.setScalar(1 - curl);
    }

    // The tail lies on the rug when the cat is down, not out behind it.
    cat.tail.position.set(0, 0.31 - curl * 0.14, -0.37 + curl * 0.1);
    cat.joints.forEach((joint, i) => {
      // A slow flick when sitting, a tight wrap when curled — each joint turns
      // the same amount again, so six of them close most of a circle — and a
      // counter-sway while walking.
      const flick = Math.sin(t * 1.6 + i * 0.5) * 0.12 * settled;
      joint.rotation.y = flick + curl * 0.62 + walking * Math.sin(t * 7 - i * 0.6) * 0.07;
      // Never negative: a per-joint lift accumulates over six links and
      // stands the whole tail up in the air.
      joint.rotation.x = (1 - curl) * 0.16;
    });
  });

  return <primitive ref={group} object={cat.root} />;
}
