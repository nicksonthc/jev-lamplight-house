import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, type DirectionalLight, type FogExp2, type HemisphereLight } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { easeLook, live, SUN } from './look';
import { live as tween } from '../useJevStore';
import { WET } from './palette';

/**
 * The only writer of the fog, the background, the exposure and the two lights
 * on this page.
 *
 * `easeLook` walks the live look toward whatever `setLook` last targeted, and
 * everything that the look touches is pushed from here — so a mood arriving
 * from Jev changes the sky, the sun, the fog and the exposure in one frame's
 * worth of the same easing, instead of five components each deciding when
 * they have caught up.
 *
 * `welcome` is the one thing layered on top: Jev's score warms the daylight a
 * little, because a house judged inviting should look it from the garden and
 * not only in the panel.
 */
export function Atmosphere() {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const fog = useRef<FogExp2>(null);
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);

  useEffect(() => {
    sun.current?.target.position.set(0, 1.5, 0);
    sun.current?.target.updateMatrixWorld();
  }, []);

  // A room probe. The kettle, the trivet, the curtain rail and the gramophone
  // horn are metals, and a metal with no environment to reflect renders as a
  // flat dark shape — the kettle simply disappears into the fireplace.
  // Generated once from the renderer, so it lives outside the React tree.
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = pmrem.fromScene(room, 0.06);
    scene.environment = target.texture;
    scene.environmentIntensity = 0.3;
    room.dispose();
    pmrem.dispose();
    return () => {
      scene.environment = null;
      target.dispose();
    };
  }, [gl, scene]);

  useFrame((_, dt) => {
    easeLook(dt);
    const welcome = tween('welcome');

    // Wet ground belongs with the rest of the look: one writer, so the grass
    // cannot still be sunlit while the fog and the sun have gone over to
    // rain. The dry colours are kept on the material itself (`WET`) rather
    // than re-read from the token, so this is idempotent per frame.
    const wet = tween('raining');
    for (const [material, dry, soaked] of WET) material.color.copy(dry).lerp(soaked, wet);

    if (fog.current) {
      fog.current.color.copy(live.fog);
      fog.current.density = live.fogDensity;
    }
    scene.background = live.fog;
    gl.toneMappingExposure = live.exposure * (0.96 + welcome * 0.1);

    if (sun.current) {
      sun.current.color.copy(live.sun);
      sun.current.intensity = live.sunIntensity * (0.85 + welcome * 0.3);
    }
    if (hemi.current) {
      hemi.current.color.copy(live.sky);
      hemi.current.groundColor.copy(live.ground);
      hemi.current.intensity = live.hemiIntensity;
    }
  });

  return (
    <>
      <fogExp2 ref={fog} attach="fog" args={[live.fog.getHex(), live.fogDensity]} />
      <hemisphereLight ref={hemi} name="sky-fill" intensity={live.hemiIntensity} />
      <directionalLight
        ref={sun}
        name="sun"
        position={SUN}
        intensity={live.sunIntensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-normalBias={0.04}
        shadow-radius={3}
      />
    </>
  );
}
