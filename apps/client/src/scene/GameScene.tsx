import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import { type DirectionalLight, Plane, Vector3 } from 'three';
import type { Vec2 } from '@game/core';
import { useTouchLayout } from '@/hooks/useTouchLayout';
import { InputController } from '@/input/InputController';
import { SlowFrameDetector } from '@/lib/frameRate';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { type Graphics, useSettingsStore } from '@/store/settingsStore';
import { Buildings } from './Buildings';
import { Effects } from './Effects';
import { Heroes } from './Heroes';
import { HealthBars, Swarm } from './Instanced';
import { HeroNames } from './HeroNames';
import { Summons, Zones } from './Ground';
import { Minions, Monsters } from './Minions';
import { Objectives } from './Objectives';
import { AimPreview, Shots, TargetMark } from './Shots';
import { COLORS } from './palette';
import { Terrain } from './Terrain';

const CAMERA_OFFSET = new Vector3(0, 34, 24);
/**
 * A phone's screen is small: its camera stands this much nearer, so heroes and soldiers are drawn a
 * quarter larger. No nearer than this: the longest reach in the game is 12, and from here the ground
 * shows 18 up the screen, 25 to either side and 11 down it, part of which the controls cover.
 */
const TOUCH_CAMERA_NEARNESS = 0.8;
const SUN_OFFSET = new Vector3(18, 40, 12);
const SHAKE = 0.35;
/** Below this average frame rate, high graphics switches itself to low. */
const MIN_FPS_FOR_HIGH = 28;
/** Half-size of the square around the hero that gets shadows. */
const SHADOW_REACH = 42;

/** Runs the game, follows the hero with the camera and sun, and tracks the ground point under the mouse. */
function GameLoop({ game, shadows, touch }: { game: GameSession; shadows: boolean; touch: boolean }) {
  const setHud = useGameStore((s) => s.setHud);
  const lowerGraphics = useSettingsStore((s) => s.lowerGraphics);
  // Only high graphics has anything to give up when frames are slow.
  const slow = useMemo(() => (shadows ? new SlowFrameDetector(MIN_FPS_FOR_HIGH) : null), [shadows]);
  const sun = useRef<DirectionalLight>(null);
  const offset = useMemo(() => CAMERA_OFFSET.clone().multiplyScalar(touch ? TOUCH_CAMERA_NEARNESS : 1), [touch]);
  const scratch = useMemo(
    () => ({ ground: new Plane(new Vector3(0, 1, 0), 0), hit: new Vector3(), pos: { x: 0, z: 0 } as Vec2 }),
    [],
  );

  // Negative priority: runs before every other useFrame, so they all draw the same tick.
  useFrame(({ camera, raycaster, pointer }, delta) => {
    if (game.update(delta)) setHud(game.hud());
    if (slow?.frame(delta)) lowerGraphics();
    // The camera follows the hero, unless the player is holding the minimap on some other place.
    const p = useGameStore.getState().peek ?? game.renderPos(game.hero, scratch.pos);
    camera.position.set(p.x + offset.x, offset.y, p.z + offset.z);
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
      // A phone's screen is small: a quarter of the shadow detail looks the same and costs far less.
      shadow-mapSize={touch ? [1024, 1024] : [2048, 2048]}
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
  const touch = useTouchLayout();
  const high = graphics === 'high';
  return (
    <Canvas
      camera={{ fov: 38, near: 1, far: 300 }}
      // Low still draws sharper than one pixel per point: on a phone that would look smeared.
      dpr={high ? [1, touch ? 1.75 : 2] : [1, 1.5]}
      shadows={high ? 'percentage' : false}
      gl={{ antialias: high }}
    >
      <color attach="background" args={[COLORS.sky]} />
      <hemisphereLight args={['#dfeaff', '#3a4a35', 1.3]} />
      <GameLoop game={game} shadows={high} touch={touch} />
      <InputController game={game} touch={touch} />
      {/* Models load in the background; the match is already running underneath. */}
      <Suspense fallback={null}>
        <Terrain map={game.map} playerTeam={game.hero.team} detailed={high} />
        <Buildings game={game} />
        <Heroes game={game} />
        {high && <Minions game={game} />}
        <Monsters game={game} />
      </Suspense>
      <Objectives game={game} />
      <Zones game={game} />
      <Summons game={game} />
      <Swarm game={game} simpleMinions={!high} />
      <Shots game={game} />
      <TargetMark game={game} />
      <AimPreview game={game} />
      <HealthBars game={game} />
      <HeroNames game={game} />
      <Effects game={game} />
    </Canvas>
  );
}
