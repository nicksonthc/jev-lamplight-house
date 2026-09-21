import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as T from 'three';
import { clock } from '../clock';
import { nudgeTarget, PART_IDS, type PartId } from '../questions';
import { live, useJevStore } from '../useJevStore';
import type { Cottage as CottageModel } from './buildCottage';
import type { Garden } from './buildGarden';
import { jevCopy } from '../copy';

/**
 * The house, the garden, and the pointer.
 *
 * The geometry is built once outside React (`buildCottage`, `buildGarden`) and
 * mounted as two `<primitive>`s. Everything that moves is driven from the one
 * `useFrame` below, which reads the store with `getState()` rather than a
 * selector: a subscription here would re-render the canvas subtree on every
 * tween and there are eleven of them.
 *
 * Hit testing goes through `userData.part`, written on each part's pivot by
 * the builder, so a click on a door panel, a knob or a pane of glass all
 * reach the same switch — and adding a part needs no change here.
 */

/** Walk up from whatever the ray hit to the part that owns it. */
function partOf(object: T.Object3D | null): PartId | null {
  for (let node = object; node; node = node.parent) {
    const id = node.userData?.part as PartId | undefined;
    if (id) return id;
  }
  return null;
}

/**
 * A soft annulus for the hover halo and the nudge ring — a ring rather than a
 * filled blob, because both draw through the wall (a nudge is often about the
 * hearth, which is inside) and a disc there reads as a smear on the plaster
 * while a ring reads as a marker behind it.
 */
function haloTexture(edge: string, glow: string) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.62, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.78, edge);
  gradient.addColorStop(0.88, glow);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

export function Cottage({ cottage, garden }: { cottage: CottageModel; garden: Garden }) {
  const hearthLight = useRef<T.PointLight>(null);
  const lampLight = useRef<T.PointLight>(null);
  const roomLight = useRef<T.PointLight>(null);
  const halo = useRef<T.Sprite>(null);
  const ring = useRef<T.Sprite>(null);

  const language = useJevStore((s) => s.language);
  const hovered = useJevStore((s) => s.hovered);
  const nudge = useJevStore((s) => s.reply?.verdict.nudge.choice ?? null);
  const switches = useJevStore((s) => s.switches);
  const setReady = useJevStore((s) => s.setReady);
  const t = jevCopy[language];

  const sprites = useMemo(
    () => ({
      hover: haloTexture('rgba(255,238,196,0.85)', 'rgba(255,196,104,0.18)'),
      nudge: haloTexture('rgba(190,248,222,0.7)', 'rgba(96,206,168,0.14)'),
    }),
    [],
  );

  useEffect(() => {
    setReady();
    return () => {
      cottage.dispose();
      garden.dispose();
      sprites.hover.dispose();
      sprites.nudge.dispose();
    };
  }, [cottage, garden, sprites, setReady]);

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  const nudgePart = nudge ? (nudgeTarget(nudge, switches)?.part ?? null) : null;

  useFrame(() => {
    const t0 = clock.t;
    for (const id of PART_IDS) cottage.parts[id].apply(live(id, t0), t0);

    const fire = live('hearth', t0);
    const lamp = live('lamp', t0);
    const welcome = live('welcome', t0);

    if (hearthLight.current) {
      // The same three-sine flicker the flames use, so the light and the thing
      // giving it off cannot disagree.
      const flicker = 0.84 + 0.16 * Math.sin(t0 * 7.3) + 0.06 * Math.sin(t0 * 2.1);
      hearthLight.current.intensity = fire * 3.4 * flicker;
    }
    if (lampLight.current) lampLight.current.intensity = lamp * 3.8;
    // The room's own warmth: Jev's welcome score, made into light. Small,
    // because it sits on top of the hearth and the lamp rather than instead
    // of them — a room lit by the score alone would blow out the moment Jev
    // approved of it.
    if (roomLight.current) roomLight.current.intensity = 0.2 + welcome * 1.1;

    if (halo.current) {
      const part = useJevStore.getState().hovered;
      halo.current.visible = part !== null;
      if (part) {
        halo.current.position.copy(cottage.parts[part].anchor);
        const pulse = 1 + 0.05 * Math.sin(t0 * 4);
        halo.current.scale.setScalar(1.15 * pulse);
      }
    }
    if (ring.current) {
      ring.current.visible = nudgePart !== null;
      if (nudgePart) {
        ring.current.position.copy(cottage.parts[nudgePart].anchor);
        // Slower and wider than the hover halo: a suggestion, not a cursor.
        const pulse = 0.85 + 0.25 * (0.5 + 0.5 * Math.sin(t0 * 1.9));
        ring.current.scale.setScalar(1.5 * pulse);
        (ring.current.material as T.SpriteMaterial).opacity = 0.22 + 0.24 * pulse;
      }
    }
  });

  /**
   * The cottage is one `<primitive>` with several hundred meshes under it, and
   * R3F reports a crossing between two of them as an `out` on the first and a
   * `move` on the second — in that order some frames and the other order on
   * others. Clearing the hover straight from `out` therefore drops it at
   * random while the pointer is still on the house. The guard below only
   * clears when no `move` followed in the same native event.
   */
  const lastMove = useRef(0);

  const hover = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    lastMove.current += 1;
    const id = partOf(event.object);
    if (id !== useJevStore.getState().hovered) useJevStore.getState().setHovered(id);
  };

  const leave = () => {
    const at = lastMove.current;
    setTimeout(() => {
      if (lastMove.current === at && useJevStore.getState().hovered) {
        useJevStore.getState().setHovered(null);
      }
    }, 0);
  };

  const press = (event: ThreeEvent<MouseEvent>) => {
    const id = partOf(event.object);
    if (!id) return;
    event.stopPropagation();
    useJevStore.getState().flip(id);
  };

  return (
    <>
      <primitive object={garden.root} />
      <primitive
        object={cottage.root}
        onPointerMove={hover}
        onPointerOut={leave}
        onClick={press}
      />

      <pointLight
        ref={hearthLight}
        position={cottage.anchors.fire.toArray()}
        color="#ff9a45"
        distance={10}
        decay={1.7}
        intensity={0}
      />
      <pointLight
        ref={lampLight}
        position={cottage.anchors.bulb.toArray()}
        color="#ffd6a0"
        distance={9}
        decay={1.5}
        intensity={0}
      />
      <pointLight
        ref={roomLight}
        position={[0.2, 1.9, -0.4]}
        color="#ffe2bb"
        distance={7}
        decay={2}
        intensity={0.2}
      />

      <sprite ref={halo} visible={false} renderOrder={5}>
        <spriteMaterial
          map={sprites.hover}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={T.AdditiveBlending}
          opacity={0.7}
        />
      </sprite>
      <sprite ref={ring} visible={false} renderOrder={4}>
        <spriteMaterial
          map={sprites.nudge}
          transparent
          depthWrite={false}
          depthTest={false}
          blending={T.AdditiveBlending}
          opacity={0.5}
        />
      </sprite>

      {hovered && (
        <Html
          position={cottage.parts[hovered].anchor.toArray()}
          center
          zIndexRange={[20, 0]}
          // The label sits exactly where the visitor is about to click, so
          // both of drei's elements have to be transparent to the pointer or
          // the label eats the click that opens the door. `Html`'s own
          // `pointerEvents` prop only applies in `transform` mode: outside it
          // the inner element takes `style` and the wrapper takes
          // `wrapperClass`, which is why this needs saying twice.
          wrapperClass="pointer-events-none"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            className="panel -translate-y-9 whitespace-nowrap rounded-full px-3 py-1 text-[0.62rem] tracking-[0.18em] text-rice uppercase"
          >
            {t.parts[hovered].name}
          </div>
        </Html>
      )}
    </>
  );
}
