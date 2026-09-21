import { useEffect, useRef, type ComponentRef } from 'react';
import { useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import gsap from 'gsap';
import { useJevStore, type ViewName } from '../useJevStore';

type Controls = ComponentRef<typeof OrbitControls>;

/**
 * Orbit controls and three places to stand. The rig is the only thing on this
 * page that writes the camera — grabbing the scene mid-flight kills the tween
 * so the pointer never has to fight it, the same contract `CameraRig` keeps on
 * the village page.
 */

export const VIEWS: Record<ViewName, { position: [number, number, number]; target: [number, number, number] }> = {
  // Far enough back for the whole gable, the roof and the washing line.
  garden: { position: [9.4, 5.4, 16.2], target: [0, 2.7, 0.6] },
  // Off the path, close enough for the door, the flower box and the step.
  // All three targets are aimed a little right of their subject, so the house
  // sits left of centre and the panels down the right edge cover grass.
  porch: { position: [3.7, 2.4, 11.9], target: [-0.6, 1.55, 2.4] },
  // Inside by the window, looking across the rug to the fire, with the chair
  // to the left of the sight line rather than across it.
  parlour: { position: [2.6, 1.76, 2.0], target: [-0.35, 1.0, -2.25] },
};

const FLIGHT = { duration: 1.6, ease: 'power3.inOut' } as const;

// The scene can legitimately render a frame slower than half a second on a
// software renderer, and a camera flight that freezes is worse than one that
// skips, so let the tweens advance on wall-clock time.
gsap.ticker.lagSmoothing(0);

export function Camera() {
  const controls = useRef<Controls>(null);
  const camera = useThree((s) => s.camera);
  const view = useJevStore((s) => s.view);
  const nonce = useJevStore((s) => s.cameraNonce);
  const flown = useRef(false);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const { position, target } = VIEWS[view];

    if (!flown.current) {
      flown.current = true;
      camera.position.set(...position);
      orbit.target.set(...target);
      orbit.update();
      return;
    }

    gsap.killTweensOf([camera.position, orbit.target]);
    const tweens = [
      gsap.to(camera.position, { x: position[0], y: position[1], z: position[2], ...FLIGHT }),
      gsap.to(orbit.target, { x: target[0], y: target[1], z: target[2], ...FLIGHT }),
    ];
    const interrupt = () => tweens.forEach((tween) => tween.kill());
    orbit.addEventListener('start', interrupt);
    return () => {
      orbit.removeEventListener('start', interrupt);
      interrupt();
    };
  }, [view, nonce, camera]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={1.4}
      maxDistance={48}
      // Just shy of level, so the camera never drops through the grass.
      maxPolarAngle={Math.PI * 0.495}
      target={VIEWS.garden.target}
    />
  );
}
