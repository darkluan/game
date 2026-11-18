import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { HeroShowcase } from './HeroShowcase';
import { COLORS, heroColor } from './palette';

/** A small see-through window showing one hero, for screens with no room to show it in the backdrop. */
export default function HeroStage({
  heroId,
  distance = 5.8,
}: {
  heroId: string;
  /** How far back the camera stands: farther for a stage that must fit the biggest heroes whole. */
  distance?: number;
}) {
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return (
    <Canvas
      camera={{ fov: 30, near: 0.1, far: 50, position: [0, 1.9, distance] }}
      dpr={[1, 1.5]}
      frameloop={still ? 'demand' : 'always'}
      onCreated={({ camera }) => camera.lookAt(0, 1.2, 0)}
      fallback={null}
    >
      <hemisphereLight args={['#dfeaff', '#3a4a35', 1.7]} />
      <directionalLight position={[-3, 5, 6]} intensity={2.6} />
      <pointLight position={[1.5, 2, -2]} color={heroColor(heroId)} intensity={30} distance={10} />
      <pointLight position={[0, 4, -1]} color={COLORS.self} intensity={12} distance={10} />
      <Suspense fallback={null}>
        <HeroShowcase key={heroId} heroId={heroId} pulseReach={0.7} />
      </Suspense>
    </Canvas>
  );
}
