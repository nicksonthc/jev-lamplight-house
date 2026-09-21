import * as T from 'three';

/**
 * The scene's surfaces: warm cream, terracotta, painted joinery, a lot of
 * green. Separate from the interface palette in `src/index.css`, which is the
 * lacquer-and-rice-paper treatment the floating panels use, so neither can
 * quietly restyle the other.
 *
 * Everything is a plain standard material with a shared procedural grain for
 * bump. No textures ship with the page.
 */

/** A seeded LCG, so the scatter in the garden is the same every reload. */
export function random(seed = 20260920) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const rng = random(7);
const data = new Uint8Array(96 * 96 * 4);
for (let i = 0; i < data.length; i += 4) {
  const v = 140 + rng() * 90;
  data[i] = data[i + 1] = data[i + 2] = v;
  data[i + 3] = 255;
}
export const grain = new T.DataTexture(data, 96, 96);
grain.wrapS = grain.wrapT = T.RepeatWrapping;
grain.repeat.set(4, 4);
grain.needsUpdate = true;

const surface = (color: string, roughness: number, bumpScale = 0.03) =>
  new T.MeshStandardMaterial({ color, roughness, bumpMap: grain, bumpScale });

const flat = (color: string, roughness: number) =>
  new T.MeshStandardMaterial({ color, roughness });

export const mats = {
  plaster: surface('#f3e3c4', 0.93, 0.045),
  plasterShade: surface('#e4cfa8', 0.95, 0.045),
  timber: surface('#6d4630', 0.88),
  timberDark: surface('#472e21', 0.9),
  joinery: flat('#f8f0dc', 0.72),
  tile: surface('#c05f43', 0.82, 0.04),
  tileDeep: surface('#9d4830', 0.84, 0.04),
  stone: surface('#a1988a', 0.92, 0.05),
  brick: surface('#a3705b', 0.9, 0.045),
  stoneDark: surface('#7d7568', 0.94, 0.05),
  door: flat('#2f7d6a', 0.68),
  shutter: flat('#40718d', 0.7),
  brass: new T.MeshStandardMaterial({ color: '#c9a44c', roughness: 0.34, metalness: 0.85 }),
  iron: new T.MeshStandardMaterial({ color: '#4c4842', roughness: 0.42, metalness: 0.65 }),
  cloth: flat('#f6f2e6', 0.95),
  curtain: flat('#e5b7a2', 0.96),
  rug: surface('#96503f', 0.95),
  cushion: flat('#cf8a5c', 0.92),
  floorboard: surface('#6f4c31', 0.88),
  interior: surface('#d9c5a4', 0.96),
  ceiling: surface('#c2a985', 0.96),
  soot: flat('#2b241f', 0.98),
  firebrick: surface('#43302a', 0.96, 0.05),
  basket: surface('#9a7c4e', 0.94),
  grass: surface('#7ba641', 0.98, 0.02),
  grassDeep: flat('#58862f', 0.98),
  earth: surface('#9c7a54', 0.96, 0.05),
  trunk: surface('#6a4a35', 0.94),
  leaf: flat('#4e8f3d', 0.9),
  leafLight: flat('#75b24c', 0.9),
  // A little emissive of its own: cloud lit only by a low sun reads as
  // smoke, and this sky is never meant to be threatening.
  cloud: new T.MeshStandardMaterial({ color: '#fffaf2', roughness: 1, emissive: '#fff3e2', emissiveIntensity: 0.4 }),
  cat: flat('#4a4238', 0.95),
  catPale: flat('#e8e0d2', 0.95),
  petal: flat('#f2a0b6', 0.9),
  petalGold: flat('#f5c95c', 0.9),
};

/**
 * What the rain darkens, with the dry colour kept beside the wet one.
 * `Atmosphere` is the only thing that writes these — see the note there.
 */
export const WET: [material: T.MeshStandardMaterial, dry: T.Color, soaked: T.Color][] = (
  [
    [mats.grass, '#4e6d2b'],
    [mats.grassDeep, '#3b5a20'],
    [mats.stone, '#6f685d'],
    [mats.stoneDark, '#544f47'],
    [mats.earth, '#634d34'],
    [mats.tile, '#8b4430'],
    [mats.tileDeep, '#6f3322'],
  ] as const
).map(([material, soaked]) => [material, material.color.clone(), new T.Color(soaked)]);

/** Window glass: enough of a sheen to read as glass, cheap enough to stack. */
export const glassMaterial = new T.MeshStandardMaterial({
  color: '#bcdce4',
  roughness: 0.08,
  metalness: 0,
  transparent: true,
  opacity: 0.34,
  side: T.DoubleSide,
});

/** Anything that gives off light: the fire, the bulb, the lamp's paper. */
export const emissive = (color: string, intensity: number) =>
  new T.MeshStandardMaterial({
    color,
    emissive: new T.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.6,
  });

const unitBox = new T.BoxGeometry(1, 1, 1);

export function box(
  parent: T.Object3D,
  name: string,
  size: [number, number, number],
  position: [number, number, number],
  material: T.Material,
  rotation?: [number, number, number],
) {
  const mesh = new T.Mesh(unitBox, material);
  mesh.name = name;
  mesh.scale.set(...size);
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(
  parent: T.Object3D,
  name: string,
  radiusTop: number,
  radiusBottom: number,
  height: number,
  position: [number, number, number],
  material: T.Material,
  rotation?: [number, number, number],
  segments = 14,
) {
  const mesh = new T.Mesh(
    new T.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function ball(
  parent: T.Object3D,
  name: string,
  radius: number,
  position: [number, number, number],
  material: T.Material,
  scale: [number, number, number] = [1, 1, 1],
  segments = 16,
) {
  const mesh = new T.Mesh(new T.SphereGeometry(radius, segments, segments * 0.7), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/**
 * A wall as a flat shape with holes punched in it, extruded to thickness.
 * Cheaper to read than the six boxes it would take to fence each opening, and
 * it cannot drift out of line with the window that goes in the hole.
 */
export function wall(
  parent: T.Object3D,
  name: string,
  shape: T.Shape,
  depth: number,
  position: [number, number, number],
  material: T.Material,
  rotation?: [number, number, number],
) {
  const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 24 });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  if (rotation) mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function rect(x0: number, y0: number, x1: number, y1: number): T.Path {
  const path = new T.Path();
  path.moveTo(x0, y0);
  path.lineTo(x1, y0);
  path.lineTo(x1, y1);
  path.lineTo(x0, y1);
  path.closePath();
  return path;
}

export function disc(cx: number, cy: number, r: number): T.Path {
  const path = new T.Path();
  path.absarc(cx, cy, r, 0, Math.PI * 2, false);
  return path;
}

export function instances(
  parent: T.Object3D,
  name: string,
  geometry: T.BufferGeometry,
  material: T.Material,
  transforms: { p: [number, number, number]; s?: number | [number, number, number]; r?: number }[],
) {
  const mesh = new T.InstancedMesh(geometry, material, transforms.length);
  mesh.name = name;
  const matrix = new T.Matrix4();
  const quaternion = new T.Quaternion();
  const scale = new T.Vector3();
  const position = new T.Vector3();
  transforms.forEach((t, i) => {
    position.set(...t.p);
    quaternion.setFromAxisAngle(new T.Vector3(0, 1, 0), t.r ?? 0);
    const s = t.s ?? 1;
    scale.set(...(typeof s === 'number' ? ([s, s, s] as [number, number, number]) : s));
    mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Free every geometry and material a built subtree owns. */
export function disposeTree(root: T.Object3D) {
  const shared = new Set<T.Material>(Object.values(mats));
  shared.add(glassMaterial);
  root.traverse((node) => {
    const mesh = node as T.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry !== unitBox) mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!shared.has(material as T.Material)) (material as T.Material).dispose();
    }
  });
}
