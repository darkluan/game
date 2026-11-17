import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import { type DirectionalLight, Plane, Vector3 } from 'three';
import type { Vec2 } from '@game/core';
import { InputController } from '@/input/InputController';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import type { Graphics } from '@/store/settingsStore';
import { Buildings } from './Buildings';
import { Effects } from './Effects';
import { Heroes } from './Heroes';
import { HealthBars, Swarm } from './Instanced';
import { Minions } from './Minions';
import { COLORS } from './palette';
import { Terrain } from './Terrain';

const CAMERA_OFFSET = new Vector3(0, 34, 24);
const SUN_OFFSET = new Vector3(18, 40, 12);
const SHAKE = 0.35;
/** Half-size of the square around the hero that gets shadows. */
const SHADOW_REACH = 42;

/** Runs the game, follows the hero with the camera and sun, and tracks the ground point under the mouse. */
function GameLoop({ game, shadows }: { game: GameSession; shadows: boolean }) {
  const setHud = useGameStore((s) => s.setHud);
  const sun = useRef<DirectionalLight>(null);
  const scratch = useMemo(
    () => ({ ground: new Plane(new Vector3(0, 1, 0), 0), hit: new Vector3(), pos: { x: 0, z: 0 } as Vec2 }),
    [],
  );

  // Negative priority: runs before every other useFrame, so they all draw the same tick.
  useFrame(({ camera, raycaster, pointer }, delta) => {
    if (game.update(delta)) setHud(game.hud());
    const p = game.renderPos(game.hero, scratch.pos);
    camera.position.set(p.x + CAMERA_OFFSET.x, CAMERA_OFFSET.y, p.z + CAMERA_OFFSET.z);
    camera.lookAt(p.x, 0, p.z);
    camera.updateMatrixWorld();
    // Aim the mouse with the steady camera, then shake only what is drawn.
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(scratch.ground, scratch.hit)) game.setCursor(scratch.hit.x, scratch.hit.z);
    if (game.clock < game.shakeUntil) {
      camera.position.x += (Math.random() - 0.5) * SHAKE;
      camera.position.z += (Math.random() - 0.5) * SHAKE;
    }
    const light = sun.current;
    if (light) {
      light.position.set(p.x + SUN_OFFSET.x, SUN_OFFSET.y, p.z + SUN_OFFSET.z);
      light.target.position.set(p.x, 0, p.z);
      light.target.updateMatrixWorld();
    }
  }, -1);

  return (
    <directionalLight
      ref={sun}
      intensity={2.2}
      castShadow={shadows}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-SHADOW_REACH}
      shadow-camera-right={SHADOW_REACH}
      shadow-camera-top={SHADOW_REACH}
      shadow-camera-bottom={-SHADOW_REACH}
      shadow-camera-far={120}
      shadow-bias={-0.0004}
    />
  );
}

export default function GameScene({ game, graphics }: { game: GameSession; graphics: Graphics }) {
  const high = graphics === 'high';
  return (
    <Canvas
      camera={{ fov: 38, near: 1, far: 300 }}
      dpr={high ? [1, 2] : 1}
      shadows={high ? 'percentage' : false}
      gl={{ antialias: high }}
    >
      <color attach="background" args={[COLORS.sky]} />
      <hemisphereLight args={['#dfeaff', '#3a4a35', 1.3]} />
      <GameLoop game={game} shadows={high} />
      <InputController game={game} />
      {/* Models load in the background; the match is already running underneath. */}
      <Suspense fallback={null}>
        <Terrain map={game.map} playerTeam={game.hero.team} detailed={high} />
        <Buildings game={game} />
        <Heroes game={game} />
        {high && <Minions game={game} />}
      </Suspense>
      <Swarm game={game} simpleMinions={!high} />
      <HealthBars game={game} />
      <Effects game={game} />
    </Canvas>
  );
}
