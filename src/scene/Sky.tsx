import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { clock } from '../clock';
import { live, SUN } from './look';
import { mats, random } from './palette';

/**
 * A gradient dome and a handful of fat cumulus.
 *
 * The dome's two colours are the live look's, so the sky turning is the same
 * event as the fog and the sun turning — one state, eased in one place. The
 * clouds are geometry rather than noise because this scene is a picture-book
 * one: five or six clusters of spheres, drifting on a closed form of the
 * clock so a paused frame is a repeatable frame.
 */

const RADIUS = 300;
const DRIFT = 0.35; // m/s, which is about a minute to cross the sky

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uHorizon;
  uniform vec3 uSunTint;
  uniform vec3 uSun;
  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    // The exponent lifts the horizon band clear of the ground plane: a linear
    // ramp puts the pale half of the gradient below the grass, where nobody
    // sees it, and leaves the zenith washed out.
    float h = clamp(dir.y * 1.15 + 0.06, 0., 1.);
    vec3 colour = mix(uHorizon, uTop, pow(h, 0.62));

    float s = max(dot(dir, normalize(uSun)), 0.);
    colour += uSunTint * (pow(s, 260.) * 2.2 + pow(s, 9.) * 0.18);

    gl_FragColor = vec4(colour, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Sky() {
  const camera = useThree((s) => s.camera);
  const dome = useRef<T.Mesh>(null);
  const clouds = useRef<T.Group>(null);

  const { geometry, material } = useMemo(() => {
    return {
      geometry: new T.SphereGeometry(RADIUS, 32, 20),
      material: new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        // Fog would fade the sky into its own horizon colour, twice over.
        fog: false,
        uniforms: {
          uTop: { value: live.skyTop.clone() },
          uHorizon: { value: live.skyHorizon.clone() },
          uSunTint: { value: live.sun.clone() },
          uSun: { value: new T.Vector3(...SUN) },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      }),
    };
  }, []);

  // One cluster of spheres per cloud, laid out once from a fixed seed.
  const cumulus = useMemo(() => {
    const rand = random(31415);
    const group = new T.Group();
    group.name = 'clouds';
    for (let i = 0; i < 11; i++) {
      const cloud = new T.Group();
      // Low and far: the camera looks slightly down and the lens is 42°, so a
      // deck at sixty metres up sits above the top of every frame on the page.
      cloud.position.set(-230 + i * 46 + rand() * 24, 26 + rand() * 22, -95 - rand() * 175);
      const scale = 0.85 + rand() * 1.1;
      cloud.scale.setScalar(scale);
      for (let j = 0; j < 6; j++) {
        const puff = new T.Mesh(new T.SphereGeometry(8 + rand() * 7, 12, 9), mats.cloud);
        puff.position.set((j - 2.5) * 9 + rand() * 5, rand() * 7 - 1, rand() * 10 - 5);
        puff.scale.set(1, 0.62 + rand() * 0.25, 0.9);
        puff.castShadow = false;
        puff.receiveShadow = false;
        cloud.add(puff);
      }
      group.add(cloud);
    }
    return group;
  }, []);

  useEffect(() => {
    const geometries: T.BufferGeometry[] = [];
    cumulus.traverse((node) => {
      const mesh = node as T.Mesh;
      if (mesh.isMesh) geometries.push(mesh.geometry);
    });
    return () => {
      geometry.dispose();
      material.dispose();
      for (const g of geometries) g.dispose();
    };
  }, [geometry, material, cumulus]);

  useFrame(() => {
    const uniforms = material.uniforms;
    uniforms.uTop.value.copy(live.skyTop);
    uniforms.uHorizon.value.copy(live.skyHorizon);
    uniforms.uSunTint.value.copy(live.sun);
    dome.current?.position.copy(camera.position);

    // Closed form: each cloud's drift is its start plus the clock, wrapped.
    if (!clouds.current) return;
    clouds.current.children.forEach((cloud, i) => {
      const span = 506;
      const start = -230 + i * 46;
      cloud.position.x = ((start + clock.t * DRIFT + 253) % span) - 253;
    });
    // The cloud deck belongs to the sky, not to the garden, so it rides the
    // camera in Z only — moving it in Y would push it through the dome.
    clouds.current.position.z = camera.position.z;
    clouds.current.position.x = camera.position.x;
  });

  return (
    <>
      <mesh
        ref={dome}
        name="sky-dome"
        args={[geometry, material]}
        frustumCulled={false}
        renderOrder={-1}
      />
      <primitive ref={clouds} object={cumulus} />
    </>
  );
}
