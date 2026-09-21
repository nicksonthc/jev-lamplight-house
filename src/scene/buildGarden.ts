import * as T from 'three';
import { ball, box, cylinder, disposeTree, instances, mats, random } from './palette';

/**
 * The ground the cottage stands on: a green swell, a stepping-stone path up
 * to the door, a low wall with a gate in it, three trees and the scatter in
 * between.
 *
 * Everything here is seeded from one generator, so the garden is the same
 * garden on every reload and a screenshot check has something stable to
 * compare. It is also entirely static — nothing in the garden answers to Jev
 * except the cat, and the cat is its own component walking the curve this
 * module returns.
 */

const GATE = { x0: -3.9, x1: -2.1 };
const FENCE_Z = 10.4;
const WALL_H = 0.82;

export interface Garden {
  root: T.Group;
  /** Wall → path → doorstep → hearthrug: the whole of the cat's argument. */
  catPath: T.CatmullRomCurve3;
  dispose: () => void;
}

export function buildGarden(): Garden {
  const root = new T.Group();
  root.name = 'garden';
  const rand = random(19880416);

  ground(root);
  path(root);
  gardenWall(root);
  for (const [x, z, s] of [
    [-9.8, 3.2, 1.0],
    [9.2, -3.6, 0.78],
    [-8.4, -6.8, 0.66],
  ] as const) {
    tree(root, x, z, s, rand);
  }
  scatter(root, rand);
  hills(root);

  return {
    root,
    catPath: new T.CatmullRomCurve3(
      [
        new T.Vector3(-4.8, WALL_H + 0.16, FENCE_Z),
        new T.Vector3(-3.0, 0.2, 6.2),
        new T.Vector3(-1.7, 0.26, 2.9),
        new T.Vector3(-0.55, 0.28, -1.0),
      ],
      false,
      'catmullrom',
      0.4,
    ),
    dispose: () => disposeTree(root),
  };
}

function ground(root: T.Group) {
  const plane = new T.PlaneGeometry(220, 220, 72, 72);
  const position = plane.attributes.position as T.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i); // still the plane's own Y; becomes -Z below
    const r = Math.hypot(x, y);
    // Flat under the house and out to the wall, then a swell that grows with
    // distance — a knoll under the cottage would leave its plinth in the air.
    const ease = Math.min(1, Math.max(0, (r - 14) / 26));
    const swell =
      Math.sin(x * 0.055) * Math.cos(y * 0.047) * 2.2 + Math.sin((x + y) * 0.021) * 3.4;
    position.setZ(i, swell * ease);
  }
  plane.computeVertexNormals();
  const mesh = new T.Mesh(plane, mats.grass);
  mesh.name = 'ground';
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  root.add(mesh);
}

function path(root: T.Group) {
  const stone = new T.CylinderGeometry(0.42, 0.42, 0.1, 10);
  const steps: { p: [number, number, number]; s: [number, number, number]; r: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const u = i / 10;
    steps.push({
      p: [-1.75 - u * 1.3 + Math.sin(i * 1.7) * 0.18, 0.05, 3.3 + u * 7.2],
      s: [1 + (i % 3) * 0.08, 1, 0.86 + (i % 2) * 0.12],
      r: i * 0.7,
    });
  }
  instances(root, 'path', stone, mats.stone, steps);
}

function gardenWall(root: T.Group) {
  for (const [x0, x1] of [
    [-13, GATE.x0],
    [GATE.x1, 13],
  ]) {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    box(root, 'garden-wall', [w, WALL_H, 0.44], [cx, WALL_H / 2, FENCE_Z], mats.stone);
    box(root, 'wall-coping', [w + 0.1, 0.12, 0.56], [cx, WALL_H + 0.06, FENCE_Z], mats.stoneDark);
  }
  for (const x of [GATE.x0, GATE.x1]) {
    box(root, 'gate-post', [0.34, 1.35, 0.34], [x, 0.67, FENCE_Z], mats.stoneDark);
    ball(root, 'gate-ball', 0.17, [x, 1.42, FENCE_Z], mats.stoneDark, [1, 0.85, 1], 12);
  }
  // A picket gate, standing open — it is not one of the eleven things.
  const gate = new T.Group();
  gate.position.set(GATE.x0 + 0.17, 0, FENCE_Z);
  gate.rotation.y = -0.9;
  root.add(gate);
  for (let i = 0; i < 6; i++) {
    box(gate, 'picket', [0.09, 0.9, 0.04], [0.16 + i * 0.28, 0.5, 0], mats.joinery);
  }
  for (const y of [0.28, 0.76]) {
    box(gate, 'gate-rail', [1.6, 0.08, 0.03], [0.86, y, 0], mats.joinery);
  }
}

function tree(root: T.Group, x: number, z: number, scale: number, rand: () => number) {
  const group = new T.Group();
  group.name = 'tree';
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  group.rotation.y = rand() * Math.PI;
  root.add(group);

  cylinder(group, 'trunk', 0.26, 0.46, 3.4, [0, 1.7, 0], mats.trunk, undefined, 10);
  for (const [dx, dy, dz, r] of [
    [0, 4.1, 0, 2.1],
    [-1.5, 3.4, 0.6, 1.5],
    [1.4, 3.6, -0.5, 1.6],
    [0.4, 5.1, 0.9, 1.4],
    [-0.7, 4.8, -1.1, 1.3],
  ] as const) {
    // Two tones between the crowns: one flat green sphere reads as a balloon.
    ball(group, 'crown', r, [dx, dy, dz], rand() > 0.5 ? mats.leaf : mats.leafLight, [
      1,
      0.86,
      1,
    ], 14);
  }
  // A branch or two showing through, so the crown has something to sit on.
  cylinder(group, 'limb', 0.1, 0.16, 1.8, [-0.8, 3.1, 0.3], mats.trunk, [0, 0, 0.7], 6);
}

function scatter(root: T.Group, rand: () => number) {
  const bush = new T.SphereGeometry(0.55, 10, 8);
  const bushes: { p: [number, number, number]; s: [number, number, number]; r: number }[] = [];
  const tufts: { p: [number, number, number]; s: number }[] = [];
  const blooms: { p: [number, number, number]; s: number }[] = [];

  for (let i = 0; i < 160; i++) {
    const angle = rand() * Math.PI * 2;
    const radius = 5 + rand() * 26;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // Keep the house, the path and the doorstep clear.
    if (Math.abs(x) < 4.4 && Math.abs(z) < 4.4) continue;
    if (Math.abs(z - FENCE_Z) < 1.2) continue;
    if (i % 5 === 0) {
      bushes.push({ p: [x, 0.3 + rand() * 0.2, z], s: [1, 0.72 + rand() * 0.3, 1], r: rand() * 3 });
    } else if (i % 5 === 1) {
      blooms.push({ p: [x, 0.16, z], s: 0.7 + rand() * 0.5 });
    } else {
      tufts.push({ p: [x, 0.1, z], s: 0.6 + rand() * 0.8 });
    }
  }

  instances(root, 'bushes', bush, mats.leaf, bushes);
  instances(root, 'tufts', new T.ConeGeometry(0.3, 0.5, 5), mats.grassDeep, tufts);
  const petal = new T.SphereGeometry(0.11, 6, 5);
  instances(root, 'wildflowers', petal, mats.petal, blooms.filter((_, i) => i % 2 === 0));
  instances(root, 'wildflowers-gold', petal, mats.petalGold, blooms.filter((_, i) => i % 2 === 1));
}

function hills(root: T.Group) {
  // Far enough out to sit under the fog rather than be looked at.
  for (const [x, z, rx, ry] of [
    [-58, -74, 46, 15],
    [34, -86, 58, 19],
    [92, -40, 40, 13],
    [-96, -20, 36, 11],
  ] as const) {
    const hill = ball(root, 'hill', 1, [x, -2, z], mats.grassDeep, [rx, ry, rx * 0.7], 20);
    hill.castShadow = false;
    hill.receiveShadow = false;
  }
}
