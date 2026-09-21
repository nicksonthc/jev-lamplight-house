import * as T from 'three';
import type { PartId } from '../questions';
import {
  ball,
  box,
  cylinder,
  disc,
  disposeTree,
  emissive,
  glassMaterial,
  instances,
  mats,
  rect,
  wall,
} from './palette';

/**
 * The cottage, in plain Three.js.
 *
 * Imperative for the reason `buildVillage.ts` is: this is a few hundred
 * primitives that never change shape, and a fibre per plank would buy nothing.
 * What *is* expressed as data is the eleven things the visitor can work — each
 * one a pivot group with its own `apply(v, t)`, written beside the geometry it
 * moves, so a hinge cannot end up rotating about a point three files away.
 *
 * Frame: metres, Y up, the front of the house facing +Z, the ridge running
 * along Z so the gable — and the round attic window in it — faces the garden.
 * The numbers below are the building; change one and say why.
 */

const HALF_X = 3.2; // side walls
const HALF_Z = 2.4; // front wall at +Z, back wall at -Z
const WALL_T = 0.24;
const EAVE = 4.3; // where the wall stops and the roof takes over
const APEX = 6.5; // the ridge
const FLOOR = 0.2; // interior floor, one plinth above the grass
const CEIL = 2.95; // ground-floor ceiling, which is the upper floor
/** Top of the trivet over the fire, and so where the kettle's foot sits. */
const TRIVET = 0.34;
/** Depth into the recess for the fire, and for the trivet in front of it. */
const FIRE_Z = -0.26;
const KETTLE_Z = -0.13;
/** The hearth, its breast and the flue above it all stand on this line. */
const HEARTH_X = -1.25;
/** The fireplace opening: the breast is built around exactly this. */
const FIRE_W = 1.18;
const FIRE_H = 1.1;

/** The openings in the front wall, and so the parts that fill them. */
const DOORWAY = { x0: -2.3, x1: -1.1, y0: 0, y1: 2.45 };
const CASEMENT = { x0: 0.55, x1: 2.65, y0: 1.3, y1: 2.9 };
const UPPER = { x0: -2.05, x1: -0.65, y0: 3.35, y1: 4.15 };
const OCULUS = { x: 0, y: 5.3, r: 0.58 };

/** A roof slope, ridge to eave, with the overhang already in it. */
const EAVE_X = HALF_X + 0.35;
const EAVE_Y = EAVE - 0.25;
const SLOPE = Math.hypot(EAVE_X, APEX - EAVE_Y);
const PITCH = Math.atan2(APEX - EAVE_Y, EAVE_X);
const ROOF_Z = HALF_Z * 2 + 1.2;

export interface PartHandle {
  /** The group the part hangs off; carries `userData.part` for hit testing. */
  pivot: T.Object3D;
  /**
   * Where the hover halo sits, in the cottage's own frame — a point **on**
   * the part rather than beside it, so a ray to the anchor lands on the thing
   * it marks. (The floating label lifts itself clear in CSS.) An anchor set
   * prettily off to one side means the halo rings the plaster next to the
   * window, and a check that clicks it clicks the wall.
   */
  anchor: T.Vector3;
  /** Put the part at `v` (0 shut / off, 1 open / lit) at scene time `t`. */
  apply: (v: number, t: number) => void;
}

export interface Cottage {
  root: T.Group;
  parts: Record<PartId, PartHandle>;
  /** Points other things in the scene need: smoke, steam, light, the cat. */
  anchors: {
    fire: T.Vector3;
    bulb: T.Vector3;
    chimney: T.Vector3;
    horn: T.Vector3;
    rug: T.Vector3;
  };
  /** Where the kettle is right now — the steam has to follow it. */
  kettle: T.Object3D;
  dispose: () => void;
}

const lerp = (a: number, b: number, v: number) => a + (b - a) * v;

/** A group that carries a part id, so a raycast hit can be traced back to it. */
function pivotFor(parent: T.Object3D, id: PartId, at: [number, number, number]) {
  const group = new T.Group();
  group.name = `part:${id}`;
  group.position.set(...at);
  group.userData.part = id;
  parent.add(group);
  return group;
}

export function buildCottage(): Cottage {
  const root = new T.Group();
  root.name = 'cottage';
  const parts = {} as Record<PartId, PartHandle>;

  shell(root);
  roof(root);
  porch(root);
  interior(root);

  door(root, parts);
  casement(root, parts);
  curtain(root, parts);
  shutters(root, parts);
  oculus(root, parts);
  armchair(root, parts);
  hearth(root, parts);
  const kettle = kettleOnTheHob(root, parts);
  lamp(root, parts);
  laundry(root, parts);
  gramophone(root, parts);

  // Hung on the root so `JevBridge` can look a part's anchor up by name
  // without the bridge having to be handed the whole cottage.
  root.userData.anchors = Object.fromEntries(
    Object.entries(parts).map(([id, part]) => [id, part.anchor]),
  );

  return {
    root,
    parts,
    anchors: {
      fire: new T.Vector3(HEARTH_X, FLOOR + 0.42, -HALF_Z + 0.68 + FIRE_Z),
      // Just under the shade's rim, not inside it: a point light in the cone
      // lights its own paper from the wrong side and the shade reads as a
      // white hole in the ceiling.
      bulb: new T.Vector3(-0.1, CEIL - 0.78, -0.95),
      chimney: new T.Vector3(HEARTH_X, 7.4, -HALF_Z + 0.34),
      horn: new T.Vector3(2.32, FLOOR + 1.42, 1.28),
      rug: new T.Vector3(-0.55, FLOOR + 0.05, -1.0),
    },
    kettle,
    dispose: () => disposeTree(root),
  };
}

/* ---------------------------------------------------------------- the shell */

function shell(root: T.Group) {
  // A stone plinth, a hand's breadth proud of the walls, so the plaster never
  // meets the wet grass.
  box(root, 'plinth', [HALF_X * 2 + 0.24, FLOOR, HALF_Z * 2 + 0.24], [0, FLOOR / 2, 0], mats.stone);

  const front = new T.Shape();
  front.moveTo(-HALF_X, 0);
  front.lineTo(HALF_X, 0);
  front.lineTo(HALF_X, EAVE);
  front.lineTo(-HALF_X, EAVE);
  front.closePath();
  front.holes.push(
    rect(DOORWAY.x0, DOORWAY.y0, DOORWAY.x1, DOORWAY.y1),
    rect(CASEMENT.x0, CASEMENT.y0, CASEMENT.x1, CASEMENT.y1),
    rect(UPPER.x0, UPPER.y0, UPPER.x1, UPPER.y1),
  );
  wall(root, 'front-wall', front, WALL_T, [0, 0, HALF_Z - WALL_T], mats.plaster);

  const back = new T.Shape();
  back.moveTo(-HALF_X, 0);
  back.lineTo(HALF_X, 0);
  back.lineTo(HALF_X, EAVE);
  back.lineTo(-HALF_X, EAVE);
  back.closePath();
  wall(root, 'back-wall', back, WALL_T, [0, 0, -HALF_Z], mats.plaster);

  for (const side of [-1, 1]) {
    box(
      root,
      `side-wall${side}`,
      [WALL_T, EAVE, HALF_Z * 2],
      [side * (HALF_X - WALL_T / 2), EAVE / 2, 0],
      mats.plaster,
    );
  }

  // The gables. The front one carries the round attic window as a hole, so
  // the opening and the leaf that fills it are cut from the same numbers.
  const gable = (holed: boolean) => {
    const shape = new T.Shape();
    shape.moveTo(-HALF_X, EAVE - 0.02);
    shape.lineTo(HALF_X, EAVE - 0.02);
    shape.lineTo(0, APEX);
    shape.closePath();
    if (holed) shape.holes.push(disc(OCULUS.x, OCULUS.y, OCULUS.r));
    return shape;
  };
  wall(root, 'front-gable', gable(true), WALL_T, [0, 0, HALF_Z - WALL_T], mats.plaster);
  wall(root, 'back-gable', gable(false), WALL_T, [0, 0, -HALF_Z], mats.plaster);

  // Timber framing, laid on the plaster rather than through it.
  const z = HALF_Z + 0.02;
  for (const side of [-1, 1]) {
    box(root, `post${side}`, [0.22, EAVE, 0.08], [side * (HALF_X - 0.11), EAVE / 2, z], mats.timber);
  }
  box(root, 'rail', [HALF_X * 2, 0.2, 0.08], [0, CEIL + 0.1, z], mats.timber);
  box(root, 'sill-band', [HALF_X * 2, 0.14, 0.08], [0, EAVE - 0.07, z], mats.timber);
  for (const side of [-1, 1]) {
    // Two braces, angled the way a timber frame's are, for the eye only.
    box(
      root,
      `brace${side}`,
      [1.5, 0.15, 0.07],
      [side * 2.25, CEIL + 0.75, z],
      mats.timber,
      [0, 0, side * 0.72],
    );
  }

  // The flower box under the casement, and what is in it.
  box(root, 'flower-box', [2.24, 0.34, 0.3], [1.6, CASEMENT.y0 - 0.2, HALF_Z + 0.14], mats.timber);
  const bloom = new T.SphereGeometry(0.09, 8, 6);
  const spots: { p: [number, number, number]; s: number }[] = [];
  for (let i = 0; i < 16; i++) {
    spots.push({
      p: [
        0.56 + (i % 8) * 0.3,
        CASEMENT.y0 - 0.02 + (i % 3) * 0.05,
        HALF_Z + 0.06 + Math.floor(i / 8) * 0.14,
      ],
      s: 0.8 + (i % 4) * 0.16,
    });
  }
  instances(root, 'blooms', bloom, mats.petal, spots.filter((_, i) => i % 2 === 0));
  instances(root, 'blooms-gold', bloom, mats.petalGold, spots.filter((_, i) => i % 2 === 1));

  // The chimney, in line with the fireplace rather than beside it: a breast
  // up through the room in the same brick as the surround, then a narrower
  // stone stack out through the slope. Built at the hearth's own x, because a
  // flue that misses its fire is the sort of thing nobody sees in the model
  // and everybody sees in the parlour view.
  // Built round the opening rather than across it: a solid breast would bury
  // the firebox, the trivet and the kettle inside 0.68 m of plaster, and the
  // parlour view would show a black rectangle with a light coming out of it.
  box(root, 'breast-head', [2.16, EAVE - FIRE_H, 0.68], [HEARTH_X, FIRE_H + (EAVE - FIRE_H) / 2, -HALF_Z + 0.34], mats.plaster);
  for (const side of [-1, 1]) {
    box(root, 'breast-pier', [0.49, FIRE_H, 0.68], [HEARTH_X + side * 0.835, FIRE_H / 2, -HALF_Z + 0.34], mats.plaster);
  }
  box(root, 'chimney-stack', [0.92, 3.3, 0.82], [HEARTH_X, EAVE + 1.4, -HALF_Z + 0.34], mats.stone);
  box(root, 'chimney-cap', [1.12, 0.18, 1.02], [HEARTH_X, 7.14, -HALF_Z + 0.34], mats.stoneDark);
  for (const dx of [-0.21, 0.21]) {
    cylinder(root, 'chimney-pot', 0.15, 0.17, 0.42, [HEARTH_X + dx, 7.42, -HALF_Z + 0.34], mats.tileDeep);
  }

  // Ivy up the right-hand corner, which is what the blank half of the facade
  // is for. Laid out from the wall's own corner so it cannot drift off it.
  const leaf = new T.SphereGeometry(0.17, 7, 6);
  const vine: { p: [number, number, number]; s: [number, number, number]; r: number }[] = [];
  for (let i = 0; i < 46; i++) {
    const climb = i / 45;
    const sway = Math.sin(i * 1.9) * 0.55 + Math.sin(i * 0.7) * 0.35;
    vine.push({
      p: [HALF_X - 0.35 - Math.abs(sway) * 0.9, 0.25 + climb * (EAVE - 0.4), HALF_Z + 0.06],
      s: [0.7 + (i % 3) * 0.24, 0.6 + (i % 4) * 0.18, 0.5],
      r: i * 0.6,
    });
  }
  instances(root, 'ivy', leaf, mats.leaf, vine.filter((_, i) => i % 3 !== 0));
  instances(root, 'ivy-light', leaf, mats.leafLight, vine.filter((_, i) => i % 3 === 0));

  // A doorstep, which is also where the cat stops to think about it.
  box(root, 'doorstep', [1.66, 0.18, 0.74], [-1.7, 0.09, HALF_Z + 0.34], mats.stone);
}

/* ----------------------------------------------------------------- the roof */

function roof(root: T.Group) {
  for (const side of [-1, 1]) {
    const slab = new T.Group();
    slab.name = `roof${side}`;
    slab.position.set((side * EAVE_X) / 2, (APEX + EAVE_Y) / 2, 0);
    slab.rotation.z = -side * PITCH;
    root.add(slab);

    box(slab, 'deck', [SLOPE, 0.18, ROOF_Z], [0, 0, 0], mats.tileDeep);

    // Pantiles: half-round ribs running down the slope, two tones alternating
    // so the roof reads as tile and not as a painted ramp.
    const rib = new T.CylinderGeometry(0.11, 0.11, SLOPE, 8, 1, false, 0, Math.PI);
    rib.rotateZ(Math.PI / 2);
    const rows: { p: [number, number, number] }[] = [];
    const step = 0.26;
    for (let z = -ROOF_Z / 2 + step / 2; z < ROOF_Z / 2; z += step) rows.push({ p: [0, 0.09, z] });
    instances(slab, 'pantiles', rib, mats.tile, rows.filter((_, i) => i % 2 === 0));
    instances(slab, 'pantiles-deep', rib, mats.tileDeep, rows.filter((_, i) => i % 2 === 1));

    // A bargeboard along the front edge of the overhang.
    box(slab, 'bargeboard', [SLOPE, 0.28, 0.08], [0, -0.04, ROOF_Z / 2 - 0.04], mats.joinery);
  }

  cylinder(root, 'ridge', 0.17, 0.17, ROOF_Z, [0, APEX + 0.04, 0], mats.tileDeep, [
    Math.PI / 2,
    0,
    0,
  ]);
}

function porch(root: T.Group) {
  const x = -1.7;
  const front = HALF_Z + 1.35;
  for (const dx of [-0.85, 0.85]) {
    cylinder(root, 'porch-post', 0.09, 0.11, 2.6, [x + dx, 1.3, front - 0.15], mats.timber);
  }
  const canopy = new T.Group();
  // Pushed back to meet the wall: the rotation lifts the rear edge, so a
  // canopy centred on its own depth leaves a finger of daylight behind it.
  canopy.position.set(x, 2.74, HALF_Z + 0.52);
  canopy.rotation.x = 0.3;
  root.add(canopy);
  box(canopy, 'porch-deck', [2.3, 0.12, 1.5], [0, 0, 0], mats.tileDeep);
  const rib = new T.CylinderGeometry(0.08, 0.08, 1.5, 8, 1, false, 0, Math.PI);
  rib.rotateX(Math.PI / 2);
  const rows: { p: [number, number, number] }[] = [];
  for (let dx = -1.05; dx <= 1.05; dx += 0.24) rows.push({ p: [dx, 0.06, 0] });
  instances(canopy, 'porch-tiles', rib, mats.tile, rows);
}

/* ------------------------------------------------------------- the interior */

function interior(root: T.Group) {
  box(root, 'floor', [HALF_X * 2 - 0.3, 0.06, HALF_Z * 2 - 0.3], [0, FLOOR - 0.03, 0], mats.floorboard);
  box(root, 'ceiling', [HALF_X * 2 - 0.3, 0.14, HALF_Z * 2 - 0.3], [0, CEIL, 0], mats.ceiling);
  // Beams across the ceiling, which is most of what you see from the door.
  for (const z of [-1.5, -0.5, 0.5, 1.5]) {
    box(root, 'beam', [HALF_X * 2 - 0.4, 0.16, 0.16], [0, CEIL - 0.15, z], mats.timber);
  }

  box(root, 'rug', [2.3, 0.04, 1.7], [-0.55, FLOOR + 0.02, -1.0], mats.rug);
  box(root, 'rug-field', [1.96, 0.02, 1.36], [-0.55, FLOOR + 0.05, -1.0], mats.cushion);

  // The round table by the window, where the kettle lives when it is off.
  cylinder(root, 'table-top', 0.52, 0.52, 0.07, [1.35, FLOOR + 0.72, -1.75], mats.timber);
  cylinder(root, 'table-stem', 0.1, 0.16, 0.72, [1.35, FLOOR + 0.36, -1.75], mats.timber);

  // A shelf on the right-hand wall with three pots on it.
  box(root, 'shelf', [0.3, 0.06, 1.6], [HALF_X - 0.4, FLOOR + 1.6, -0.6], mats.timber);
  for (const [i, z] of [-1.1, -0.6, -0.1].entries()) {
    cylinder(
      root,
      'pot',
      0.1 + i * 0.015,
      0.12,
      0.22 + i * 0.04,
      [HALF_X - 0.4, FLOOR + 1.74 + i * 0.02, z],
      i === 1 ? mats.tileDeep : mats.plasterShade,
    );
  }

  // A picture on the back wall, because an empty wall reads as a box.
  box(root, 'picture-frame', [0.72, 0.56, 0.05], [1.3, FLOOR + 1.75, -HALF_Z + 0.2], mats.timber);
  box(root, 'picture', [0.6, 0.44, 0.02], [1.3, FLOOR + 1.75, -HALF_Z + 0.24], mats.plasterShade);
}

/* -------------------------------------------------------------- the parts */

function door(root: T.Group, parts: Record<PartId, PartHandle>) {
  // Hinged on the left jamb and opening outward, so the leaf clears the step.
  const pivot = pivotFor(root, 'door', [DOORWAY.x0, 0, HALF_Z + 0.02]);
  const w = DOORWAY.x1 - DOORWAY.x0;
  const h = DOORWAY.y1 - DOORWAY.y0;
  box(pivot, 'door-leaf', [w, h, 0.08], [w / 2, h / 2, 0], mats.door);
  for (const y of [h * 0.28, h * 0.72]) {
    box(pivot, 'door-panel', [w - 0.26, h * 0.3, 0.03], [w / 2, y, 0.05], mats.joinery);
  }
  ball(pivot, 'door-knob', 0.055, [w - 0.16, h * 0.46, 0.09], mats.brass);
  // A pane in the top of the door, so the room shows through a shut door.
  box(pivot, 'door-light', [w - 0.34, 0.34, 0.02], [w / 2, h - 0.34, 0.03], glassMaterial);

  box(root, 'door-frame-l', [0.12, DOORWAY.y1 + 0.1, 0.16], [DOORWAY.x0 - 0.06, (DOORWAY.y1 + 0.1) / 2, HALF_Z], mats.joinery);
  box(root, 'door-frame-r', [0.12, DOORWAY.y1 + 0.1, 0.16], [DOORWAY.x1 + 0.06, (DOORWAY.y1 + 0.1) / 2, HALF_Z], mats.joinery);
  box(root, 'door-head', [w + 0.24, 0.14, 0.16], [(DOORWAY.x0 + DOORWAY.x1) / 2, DOORWAY.y1 + 0.07, HALF_Z], mats.joinery);

  parts.door = {
    pivot,
    // Left of the leaf's middle: from the garden the near porch post lines
    // up almost exactly with its centre.
    anchor: new T.Vector3(DOORWAY.x0 + 0.35, 1.45, HALF_Z + 0.1),
    apply: (v) => {
      pivot.rotation.y = -1.85 * v;
    },
  };
}

function casement(root: T.Group, parts: Record<PartId, PartHandle>) {
  const w = (CASEMENT.x1 - CASEMENT.x0) / 2;
  const h = CASEMENT.y1 - CASEMENT.y0;
  const group = pivotFor(root, 'window', [0, 0, 0]);
  const leaves: T.Group[] = [];

  for (const side of [-1, 1] as const) {
    const hinge = new T.Group();
    hinge.position.set(side < 0 ? CASEMENT.x0 : CASEMENT.x1, CASEMENT.y0, HALF_Z + 0.02);
    group.add(hinge);
    leaves.push(hinge);
    const cx = (side < 0 ? 1 : -1) * (w / 2);
    box(hinge, 'sash', [w, h, 0.05], [cx, h / 2, 0], mats.joinery);
    box(hinge, 'pane', [w - 0.14, h - 0.14, 0.02], [cx, h / 2, 0.02], glassMaterial);
    // A glazing bar each way: the muntins are what make it a cottage window.
    box(hinge, 'muntin-v', [0.045, h - 0.12, 0.04], [cx, h / 2, 0.02], mats.joinery);
    box(hinge, 'muntin-h', [w - 0.12, 0.045, 0.04], [cx, h / 2, 0.02], mats.joinery);
  }

  box(root, 'window-sill', [CASEMENT.x1 - CASEMENT.x0 + 0.3, 0.12, 0.28], [(CASEMENT.x0 + CASEMENT.x1) / 2, CASEMENT.y0 - 0.06, HALF_Z], mats.joinery);
  box(root, 'window-head', [CASEMENT.x1 - CASEMENT.x0 + 0.3, 0.12, 0.24], [(CASEMENT.x0 + CASEMENT.x1) / 2, CASEMENT.y1 + 0.06, HALF_Z], mats.joinery);

  parts.window = {
    pivot: group,
    anchor: new T.Vector3((CASEMENT.x0 + CASEMENT.x1) / 2, (CASEMENT.y0 + CASEMENT.y1) / 2, HALF_Z + 0.06),
    apply: (v) => {
      leaves[0].rotation.y = -1.5 * v;
      leaves[1].rotation.y = 1.5 * v;
    },
  };
}

function curtain(root: T.Group, parts: Record<PartId, PartHandle>) {
  // Gathers to the right-hand jamb, inside the wall, in front of the glass.
  const pivot = pivotFor(root, 'curtain', [CASEMENT.x1, CASEMENT.y1 - 0.04, HALF_Z - WALL_T - 0.08]);
  const span = CASEMENT.x1 - CASEMENT.x0 + 0.12;
  const h = CASEMENT.y1 - CASEMENT.y0 + 0.1;
  const folds = 9;
  for (let i = 0; i < folds; i++) {
    const x = -span * ((i + 0.5) / folds);
    box(pivot, 'fold', [span / folds - 0.01, h, 0.05 + (i % 2) * 0.03], [x, -h / 2, 0], mats.curtain);
  }
  cylinder(root, 'curtain-rail', 0.025, 0.025, span + 0.2, [(CASEMENT.x0 + CASEMENT.x1) / 2, CASEMENT.y1 + 0.02, HALF_Z - WALL_T - 0.08], mats.iron, [0, 0, Math.PI / 2]);

  parts.curtain = {
    pivot,
    anchor: new T.Vector3(CASEMENT.x0 + 0.35, (CASEMENT.y0 + CASEMENT.y1) / 2, HALF_Z - WALL_T - 0.1),
    // 1 is drawn across, 0 is gathered at the jamb — never fully gone, because
    // a curtain that vanishes reads as a bug.
    apply: (v) => {
      pivot.scale.x = 0.15 + 0.85 * v;
    },
  };
}

function shutters(root: T.Group, parts: Record<PartId, PartHandle>) {
  const group = pivotFor(root, 'shutters', [0, 0, 0]);
  const w = (UPPER.x1 - UPPER.x0) / 2 + 0.05;
  const h = UPPER.y1 - UPPER.y0 + 0.1;
  const leaves: T.Group[] = [];

  for (const side of [-1, 1] as const) {
    const hinge = new T.Group();
    hinge.position.set(side < 0 ? UPPER.x0 - 0.05 : UPPER.x1 + 0.05, UPPER.y0 - 0.05, HALF_Z + 0.06);
    group.add(hinge);
    leaves.push(hinge);
    const cx = (side < 0 ? 1 : -1) * (w / 2);
    box(hinge, 'shutter', [w, h, 0.05], [cx, h / 2, 0], mats.shutter);
    for (let i = 0; i < 4; i++) {
      box(hinge, 'louvre', [w - 0.08, 0.04, 0.03], [cx, 0.16 + i * 0.22, 0.03], mats.joinery);
    }
    // The heart cut into the shutter, which is the whole reason for shutters.
    box(hinge, 'heart', [0.12, 0.12, 0.06], [cx, h - 0.2, 0], mats.timberDark, [0, 0, Math.PI / 4]);
  }

  // The window behind them, which is glass and does not move.
  box(root, 'upper-sash', [UPPER.x1 - UPPER.x0, UPPER.y1 - UPPER.y0, 0.05], [(UPPER.x0 + UPPER.x1) / 2, (UPPER.y0 + UPPER.y1) / 2, HALF_Z - 0.12], mats.joinery);
  box(root, 'upper-pane', [UPPER.x1 - UPPER.x0 - 0.14, UPPER.y1 - UPPER.y0 - 0.14, 0.02], [(UPPER.x0 + UPPER.x1) / 2, (UPPER.y0 + UPPER.y1) / 2, HALF_Z - 0.09], glassMaterial);

  parts.shutters = {
    pivot: group,
    anchor: new T.Vector3((UPPER.x0 + UPPER.x1) / 2, (UPPER.y0 + UPPER.y1) / 2, HALF_Z + 0.08),
    apply: (v) => {
      leaves[0].rotation.y = -2.3 * v;
      leaves[1].rotation.y = 2.3 * v;
    },
  };
}

function oculus(root: T.Group, parts: Record<PartId, PartHandle>) {
  // Top hung: the pivot sits on the head of the opening and the leaf swings
  // its foot out into the garden, the way an attic light actually opens.
  const pivot = pivotFor(root, 'attic', [OCULUS.x, OCULUS.y + OCULUS.r, HALF_Z + 0.02]);
  cylinder(pivot, 'oculus-leaf', OCULUS.r - 0.03, OCULUS.r - 0.03, 0.05, [0, -OCULUS.r, 0], glassMaterial, [Math.PI / 2, 0, 0], 24);
  const ring = new T.Mesh(new T.TorusGeometry(OCULUS.r - 0.02, 0.05, 8, 28), mats.joinery);
  ring.position.set(0, -OCULUS.r, 0);
  ring.castShadow = true;
  pivot.add(ring);
  for (const angle of [0, Math.PI / 2]) {
    box(pivot, 'oculus-bar', [OCULUS.r * 2 - 0.06, 0.05, 0.05], [0, -OCULUS.r, 0], mats.joinery, [0, 0, angle]);
  }

  // The gable hole would otherwise look straight through to the underside of
  // the far roof slope, which is tile red. A dark panel a half metre back
  // reads as the attic it is supposed to be.
  cylinder(root, 'attic-dark', OCULUS.r, OCULUS.r, 0.04, [OCULUS.x, OCULUS.y, HALF_Z - WALL_T - 0.45], mats.soot, [Math.PI / 2, 0, 0], 24);

  parts.attic = {
    pivot,
    anchor: new T.Vector3(OCULUS.x, OCULUS.y, HALF_Z + 0.06),
    apply: (v) => {
      pivot.rotation.x = -0.62 * v;
    },
  };
}

function armchair(root: T.Group, parts: Record<PartId, PartHandle>) {
  const pivot = pivotFor(root, 'chair', [0, FLOOR, 0]);
  box(pivot, 'seat', [0.78, 0.16, 0.72], [0, 0.42, 0], mats.cushion);
  ball(pivot, 'seat-cushion', 0.3, [0, 0.53, 0.02], mats.rug, [1.25, 0.32, 1.1], 12);
  box(pivot, 'back', [0.78, 0.66, 0.16], [0, 0.84, -0.36], mats.cushion);
  ball(pivot, 'back-cushion', 0.3, [0, 0.8, -0.26], mats.rug, [1.2, 0.85, 0.28], 12);
  for (const side of [-1, 1]) {
    box(pivot, 'arm', [0.14, 0.22, 0.72], [side * 0.39, 0.59, 0], mats.cushion);
    ball(pivot, 'arm-roll', 0.11, [side * 0.39, 0.7, 0], mats.cushion, [1, 1, 3.2], 10);
  }
  for (const [dx, dz] of [[-0.32, -0.29], [0.32, -0.29], [-0.32, 0.29], [0.32, 0.29]]) {
    cylinder(pivot, 'chair-leg', 0.05, 0.045, 0.34, [dx, 0.17, dz], mats.timber, undefined, 8);
  }

  // Two places, and the chair is only ever on its way between them. The
  // fireside seat is off to the hearth's own side rather than square in
  // front of it, so the parlour view looks past the chair into the fire
  // instead of at the back of it.
  const stowed = { x: 2.45, z: -0.85, ry: -Math.PI / 2 };
  const fireside = { x: -2.15, z: -0.75, ry: 2.61 };

  parts.chair = {
    pivot,
    anchor: new T.Vector3(0, FLOOR + 0.75, -0.6),
    apply: (v) => {
      pivot.position.set(lerp(stowed.x, fireside.x, v), FLOOR, lerp(stowed.z, fireside.z, v));
      pivot.rotation.y = lerp(stowed.ry, fireside.ry, v);
    },
  };
}

function hearth(root: T.Group, parts: Record<PartId, PartHandle>) {
  const x = HEARTH_X;
  const z = -HALF_Z + 0.68;
  const pivot = pivotFor(root, 'hearth', [x, FLOOR, z]);

  // The surround does not move, but it belongs to the fire for the pointer:
  // clicking the fireplace is how you light it.
  box(pivot, 'surround-l', [0.3, FIRE_H + 0.3, 0.5], [-(FIRE_W / 2 + 0.15), (FIRE_H + 0.3) / 2, 0.12], mats.brick);
  box(pivot, 'surround-r', [0.3, FIRE_H + 0.3, 0.5], [FIRE_W / 2 + 0.15, (FIRE_H + 0.3) / 2, 0.12], mats.brick);
  box(pivot, 'lintel', [FIRE_W + 0.6, 0.3, 0.5], [0, FIRE_H + 0.15, 0.12], mats.brick);

  // The recess itself: five panels round an open front, in dark warm brick.
  // A solid block here is what made the fire invisible the first time.
  box(pivot, 'recess-back', [FIRE_W, FIRE_H, 0.05], [0, FIRE_H / 2, -0.42], mats.soot);
  for (const side of [-1, 1]) {
    box(pivot, 'recess-side', [0.05, FIRE_H, 0.44], [side * (FIRE_W / 2 + 0.02), FIRE_H / 2, -0.22], mats.firebrick);
  }
  box(pivot, 'recess-top', [FIRE_W, 0.05, 0.44], [0, FIRE_H, -0.22], mats.firebrick);
  box(pivot, 'recess-floor', [FIRE_W, 0.04, 0.44], [0, 0.02, -0.22], mats.firebrick);

  box(pivot, 'mantel', [2.18, 0.13, 0.44], [0, FIRE_H + 0.35, 0.18], mats.timber);
  // Two books and a jug on the mantel, so the shelf reads as lived on.
  box(pivot, 'book', [0.1, 0.2, 0.15], [-0.6, FIRE_H + 0.52, 0.16], mats.shutter, [0, 0, 0.12]);
  box(pivot, 'book', [0.08, 0.18, 0.14], [-0.5, FIRE_H + 0.51, 0.16], mats.door);
  cylinder(pivot, 'jug', 0.07, 0.09, 0.2, [0.62, FIRE_H + 0.52, 0.16], mats.plasterShade, undefined, 10);
  // Dark warm brick, not soot black: a pure black box swallows the fire's
  // own light and the hearth reads as a doorway with a flame stuck on it.
  box(pivot, 'hearthstone', [2.0, 0.06, 0.62], [0, 0.03, 0.42], mats.stoneDark);

  for (const [i, dx] of [-0.26, 0, 0.26].entries()) {
    cylinder(pivot, 'log', 0.08, 0.09, 0.86, [dx, 0.12 + (i % 2) * 0.09, FIRE_Z - 0.06], mats.timberDark, [0, 0, Math.PI / 2], 8);
  }

  // A trivet over the logs. The kettle's lit position is measured off its top
  // rather than guessed, so the kettle stands on something instead of hanging
  // in the smoke.
  for (const angle of [0, 2.1, 4.2]) {
    cylinder(pivot, 'trivet-leg', 0.018, 0.022, TRIVET - 0.04, [Math.sin(angle) * 0.17, (TRIVET - 0.04) / 2, KETTLE_Z + Math.cos(angle) * 0.17], mats.iron, undefined, 6);
  }
  const trivetRing = new T.Mesh(new T.TorusGeometry(0.17, 0.018, 6, 18), mats.iron);
  trivetRing.position.set(0, TRIVET - 0.02, KETTLE_Z);
  trivetRing.rotation.x = Math.PI / 2;
  pivot.add(trivetRing);

  // The flames: three cones whose height is the answer and whose flicker is a
  // closed form of the clock, so a paused frame is a repeatable frame.
  // Five tongues standing on the ember bed and set back behind the trivet, so
  // the kettle is licked by the fire rather than hidden inside it. Each is a
  // six-sided cone that turns as it burns: a cone seen head on is a triangle,
  // and three static triangles is what a fire must not look like.
  const flameMat = emissive('#ff8f31', 1.7);
  const coreMat = emissive('#ffe6a8', 2.3);
  flameMat.transparent = coreMat.transparent = true;
  flameMat.opacity = 0.88;
  coreMat.opacity = 0.9;
  flameMat.depthWrite = coreMat.depthWrite = false;
  const flames = (
    [
      [-0.4, 0.5, FIRE_Z - 0.04, 0.15, flameMat],
      [-0.2, 0.68, FIRE_Z + 0.03, 0.18, flameMat],
      [0.02, 0.8, FIRE_Z - 0.02, 0.2, coreMat],
      [0.24, 0.66, FIRE_Z + 0.02, 0.17, flameMat],
      [0.41, 0.46, FIRE_Z + 0.06, 0.14, coreMat],
    ] as const
  ).map(([dx, h, dz, r, material]) =>
    cylinder(pivot, 'flame', 0.0, r, h, [dx, 0.06 + h / 2, dz], material, undefined, 6),
  );
  for (const flame of flames) flame.castShadow = false;

  // A bed of embers: without it the flames float over a dark floor.
  const emberMat = emissive('#ff6a23', 1.4);
  const embers = box(pivot, 'embers', [0.9, 0.06, 0.34], [0, 0.05, FIRE_Z], emberMat);
  embers.castShadow = false;

  // The log basket, always there, off to the side of the opening.
  const basket = new T.Group();
  basket.position.set(1.34, 0, 0.34);
  pivot.add(basket);
  cylinder(basket, 'basket', 0.26, 0.22, 0.34, [0, 0.17, 0], mats.basket, undefined, 12);
  for (const [i, dx] of [-0.08, 0.06, 0].entries()) {
    cylinder(basket, 'firewood', 0.05, 0.055, 0.5, [dx, 0.36 + i * 0.05, 0], mats.timberDark, [0.2, i * 0.5, Math.PI / 2], 7);
  }

  parts.hearth = {
    pivot,
    anchor: new T.Vector3(x, FLOOR + 0.5, z + 0.1),
    apply: (v, t) => {
      flames.forEach((flame, i) => {
        // Two sines at unrelated rates: the fire never repeats within a
        // glance, and never needs a frame's history to know its height.
        const flicker =
          0.82 + 0.18 * Math.sin(t * (7.3 + i * 1.7) + i) + 0.08 * Math.sin(t * (2.1 + i));
        flame.visible = v > 0.01;
        flame.scale.set(v * flicker * 0.9, v * flicker, v * flicker * 0.9);
        flame.rotation.y = t * (0.9 + i * 0.35);
        flame.rotation.z = Math.sin(t * (3.1 + i)) * 0.08;
      });
      flameMat.emissiveIntensity = 1.7 * v;
      coreMat.emissiveIntensity = 2.3 * v;
      emberMat.emissiveIntensity = 1.4 * v * (0.8 + 0.2 * Math.sin(t * 1.4));
      embers.visible = v > 0.01;
    },
  };
}

function kettleOnTheHob(root: T.Group, parts: Record<PartId, PartHandle>) {
  const pivot = pivotFor(root, 'kettle', [0, 0, 0]);
  ball(pivot, 'kettle-body', 0.17, [0, 0.15, 0], mats.iron, [1, 0.85, 1], 14);
  cylinder(pivot, 'kettle-neck', 0.07, 0.09, 0.08, [0, 0.29, 0], mats.iron, undefined, 10);
  cylinder(pivot, 'kettle-spout', 0.025, 0.05, 0.22, [0.17, 0.2, 0], mats.iron, [0, 0, -0.9], 8);
  const handle = new T.Mesh(new T.TorusGeometry(0.15, 0.02, 6, 16, Math.PI), mats.iron);
  handle.position.set(0, 0.3, 0);
  handle.rotation.y = Math.PI / 2;
  pivot.add(handle);

  const table: [number, number, number] = [1.35, FLOOR + 0.76, -1.75];
  const hob: [number, number, number] = [HEARTH_X, FLOOR + TRIVET, -HALF_Z + 0.68 + KETTLE_Z];

  parts.kettle = {
    pivot,
    anchor: new T.Vector3(0, FLOOR + 0.9, -1.2),
    apply: (v, t) => {
      pivot.position.set(
        lerp(table[0], hob[0], v),
        // A hand lifts it over the hearthstone rather than dragging it there.
        lerp(table[1], hob[1], v) + Math.sin(Math.PI * v) * 0.3,
        lerp(table[2], hob[2], v),
      );
      pivot.rotation.z = Math.sin(Math.PI * v) * 0.22 + (v > 0.9 ? Math.sin(t * 9) * 0.006 : 0);
    },
  };
  return pivot;
}

function lamp(root: T.Group, parts: Record<PartId, PartHandle>) {
  const pivot = pivotFor(root, 'lamp', [-0.1, CEIL - 0.08, -0.95]);
  cylinder(pivot, 'flex', 0.015, 0.015, 0.36, [0, -0.18, 0], mats.iron, undefined, 6);
  const shadeMat = emissive('#f6dfae', 0.0);
  shadeMat.side = T.DoubleSide;
  const shade = new T.Mesh(new T.ConeGeometry(0.34, 0.3, 20, 1, true), shadeMat);
  shade.position.set(0, -0.5, 0);
  shade.rotation.x = Math.PI;
  pivot.add(shade);
  const bulbMat = emissive('#ffdda1', 0.0);
  const bulb = ball(pivot, 'bulb', 0.07, [0, -0.54, 0], bulbMat, [1, 1, 1], 10);
  bulb.castShadow = false;

  parts.lamp = {
    pivot,
    anchor: new T.Vector3(-0.1, CEIL - 0.55, -0.95),
    apply: (v, t) => {
      // Tungsten does not switch, it warms — and then it barely breathes.
      const glow = v * (0.97 + 0.03 * Math.sin(t * 2.7));
      bulbMat.emissiveIntensity = 2.4 * glow;
      shadeMat.emissiveIntensity = 0.3 * glow;
      shadeMat.color.setHex(0xf6dfae);
    },
  };
}

function laundry(root: T.Group, parts: Record<PartId, PartHandle>) {
  const from = new T.Vector3(HALF_X + 0.1, 3.0, 1.7);
  const to = new T.Vector3(6.6, 2.4, 1.1);
  const pivot = pivotFor(root, 'laundry', [0, 0, 0]);

  cylinder(root, 'laundry-post', 0.08, 0.1, 2.5, [to.x, 1.25, to.z], mats.timber, undefined, 8);
  box(root, 'laundry-arm', [0.7, 0.08, 0.08], [to.x, 2.4, to.z], mats.timber);

  const line = new T.Mesh(
    new T.CylinderGeometry(0.012, 0.012, from.distanceTo(to), 5),
    mats.iron,
  );
  line.position.copy(from).add(to).multiplyScalar(0.5);
  line.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  pivot.add(line);

  // Each cloth hangs off a peg group at the line, so growing it from nothing
  // to full drop is a scale about the peg rather than about the cloth's own
  // middle — washing does not unfurl upward.
  const pegs: T.Group[] = [];
  const colours = [mats.cloth, mats.curtain, mats.cloth, mats.shutter];
  for (let i = 0; i < 4; i++) {
    const at = from.clone().lerp(to, 0.2 + i * 0.2);
    const peg = new T.Group();
    peg.position.copy(at);
    peg.userData.phase = i * 1.3;
    pivot.add(peg);
    pegs.push(peg);
    box(peg, 'washing', [0.46, 0.62, 0.03], [0, -0.33, 0], colours[i]);
  }

  parts.laundry = {
    pivot,
    anchor: new T.Vector3(from.x + (to.x - from.x) * 0.4, 2.4, from.z + (to.z - from.z) * 0.4),
    apply: (v, t) => {
      pivot.visible = v > 0.01;
      for (const peg of pegs) {
        const phase = peg.userData.phase as number;
        peg.scale.set(1, v, 1);
        peg.rotation.z = v * 0.16 * Math.sin(t * 1.9 + phase);
        peg.rotation.x = v * 0.1 * Math.sin(t * 1.3 + phase * 1.7);
      }
    },
  };
}

function gramophone(root: T.Group, parts: Record<PartId, PartHandle>) {
  const x = 2.25;
  const z = 1.0;
  const pivot = pivotFor(root, 'gramophone', [x, FLOOR, z]);
  box(pivot, 'cabinet', [0.74, 0.78, 0.52], [0, 0.39, 0], mats.timber);
  box(pivot, 'case', [0.6, 0.18, 0.44], [0, 0.87, 0], mats.timberDark);
  const platter = cylinder(pivot, 'platter', 0.19, 0.19, 0.03, [0, 0.98, 0], mats.soot, undefined, 20);
  const horn = new T.Mesh(new T.ConeGeometry(0.3, 0.52, 18, 1, true), mats.brass);
  horn.position.set(0.07, 1.22, 0.28);
  horn.rotation.set(-0.85, 0, -0.25);
  horn.castShadow = true;
  pivot.add(horn);
  cylinder(pivot, 'tone-arm', 0.02, 0.02, 0.3, [-0.02, 1.04, 0.1], mats.brass, [0.5, 0, 0.4], 6);

  parts.gramophone = {
    pivot,
    anchor: new T.Vector3(x, FLOOR + 1.1, z + 0.2),
    apply: (v, t) => {
      // 78 rpm is 8.17 rad/s; slowed to something a 30 fps capture can read.
      platter.rotation.y = v * t * 3.2;
    },
  };
}
