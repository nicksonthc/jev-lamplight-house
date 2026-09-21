import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { htmlLang } from './copy';
import { useJevStore } from './useJevStore';
import { JevScene } from './scene/JevScene';
import { VIEWS } from './scene/Camera';
import { JevChrome } from './ui/JevChrome';
import { Reading } from './ui/Reading';
import { Response } from './ui/Response';
import { Switchboard } from './ui/Switchboard';
import { TitleCard } from './ui/TitleCard';

/**
 * A cottage with eleven things you can work, and an evaluation model reading
 * the room each time you work one.
 *
 * One fixed full-bleed canvas with the interface floating over it, and no
 * path between the two except the store.
 */

// Hoisted: R3F re-applies the camera props whenever this object's identity
// changes, and a fresh `position` would snap the camera back on any re-render.
const CAMERA = {
  fov: 42,
  // 0.08 so standing in the parlour does not clip the wall open at eye height.
  near: 0.08,
  far: 700,
  position: VIEWS.garden.position,
};

const DPR: [number, number] = [1, 1.75];

const GL = {
  antialias: true,
  powerPreference: 'high-performance' as const,
  preserveDrawingBuffer: true,
  outputColorSpace: SRGBColorSpace,
  toneMapping: ACESFilmicToneMapping,
  toneMappingExposure: 1,
};

export function App() {
  const language = useJevStore((s) => s.language);
  useEffect(() => {
    document.documentElement.lang = htmlLang(language);
  }, [language]);

  return (
    <>
      <div className="fixed inset-0 -z-10">
        <Canvas
          shadows
          dpr={DPR}
          camera={CAMERA}
          gl={GL}
          onCreated={({ gl }) => {
            gl.shadowMap.type = PCFSoftShadowMap;
          }}
        >
          <JevScene />
        </Canvas>
      </div>

      <JevChrome />

      {/* Bottom left, out of the right column's way: the reading is short and
          belongs beside the switches, where the response is long and is read
          once in a while. It also fills the dead half of the frame. */}
      <div className="pointer-events-none fixed bottom-0 left-0 z-10 flex max-h-[calc(100vh-14rem)] flex-col justify-end p-5 pb-16 sm:p-7 sm:pb-20">
        <div className="pointer-events-auto overflow-y-auto">
          <Response />
        </div>
      </div>

      <div className="pointer-events-none fixed top-0 right-0 z-10 flex max-h-screen w-[min(21rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto p-4 sm:p-5">
        <Switchboard />
        <Reading />
      </div>

      <TitleCard />
    </>
  );
}
