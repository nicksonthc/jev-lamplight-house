import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { advanceClock } from '../clock';
import { Atmosphere } from './Atmosphere';
import { Camera } from './Camera';
import { Cat } from './Cat';
import { Cottage } from './Cottage';
import { JevBridge } from './JevBridge';
import { Emissions } from './Emissions';
import { Rain } from './Rain';
import { Sky } from './Sky';
import { buildCottage } from './buildCottage';
import { buildGarden } from './buildGarden';

/**
 * Everything inside the canvas.
 *
 * `<SceneClock />` is mounted **first** on purpose: R3F runs same-priority
 * frame callbacks in mount order and every priority here is 0, so the clock
 * advances before anything reads it and no two components disagree about
 * what time this frame is.
 *
 * The cottage and the garden are built here rather than inside `Cottage` so
 * the cat has the path and the emissions have the chimney, the horn and the
 * kettle without either component reaching into the other.
 */

function SceneClock() {
  useFrame((_, dt) => advanceClock(dt));
  return null;
}

export function JevScene() {
  const world = useMemo(() => ({ cottage: buildCottage(), garden: buildGarden() }), []);

  return (
    <>
      <SceneClock />
      <Atmosphere />
      <Sky />
      <Cottage cottage={world.cottage} garden={world.garden} />
      <Cat path={world.garden.catPath} />
      <JevBridge />
      <Emissions
        chimney={world.cottage.anchors.chimney}
        horn={world.cottage.anchors.horn}
        kettle={world.cottage.kettle}
      />
      <Rain />
      <Camera />
      <EffectComposer multisampling={4}>
        {/* High threshold: only the fire, the bulb and the sun's disc bloom.
            Lower and the cream plaster smears in full daylight. */}
        <Bloom mipmapBlur intensity={0.32} luminanceThreshold={0.9} luminanceSmoothing={0.22} />
        <Vignette offset={0.3} darkness={0.42} />
      </EffectComposer>
    </>
  );
}
