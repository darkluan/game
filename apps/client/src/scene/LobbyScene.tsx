import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, DoubleSide, type Group, PerspectiveCamera, type Points, Vector2 } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Rng } from '@game/core';
import type { Graphics } from '@/store/settingsStore';
import { HeroShowcase } from './HeroShowcase';
import { MODELS, useModel } from './models';
import { COLORS, heroColor } from './palette';
import { type Placement, Props } from './Terrain';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const EMBLEM_Y = 11;
const CAMERA_DISTANCE = 36;
/** On wide screens the menu sits on the left, so the scene is framed to the right of centre. */
const WIDE_ASPECT = 1.25;
const WIDE_SHIFT = 9;
/** With a hero on show the menu takes both sides and the scene shows between them. */
const CENTRE_SHIFT = 1.5;

/** The chosen hero stands on the path in front of the emblem, close enough to the camera to read clearly. */
const HERO_Z = 8;
const HERO_SCALE = 3.4;

/** One blade per race, laid out like the favicon: god up, dragon right, machine down, human left. */
const ARMS = [
  { color: COLORS.god, turn: 0 },
  { color: COLORS.dragon, turn: -Math.PI / 2 },
  { color: COLORS.machine, turn: Math.PI },
  { color: COLORS.human, turn: Math.PI / 2 },
] as const;

/** The four-race star, floating over the path between the two bases. */
function Emblem() {
  const star = useRef<Group>(null);
  const ringA = useRef<Group>(null);
  const ringB = useRef<Group>(null);
  const time = useRef(0);

  useFrame((_, delta) => {
    time.current += delta;
    const t = time.current;
    if (star.current) {
      star.current.position.y = EMBLEM_Y + Math.sin(t * 0.8) * 0.35;
      star.current.rotation.y = Math.sin(t * 0.35) * 0.6;
    }
    if (ringA.current) ringA.current.rotation.z = t * 0.25;
    if (ringB.current) ringB.current.rotation.z = -t * 0.18;
  });

  return (
    <group ref={star} position={[0, EMBLEM_Y, 0]}>
      {ARMS.map((arm) => (
        <group key={arm.color} rotation={[0, 0, arm.turn]}>
          {/* A four-sided cone squashed flat: a blade with a ridge down the middle. */}
          <mesh position={[0, 3.3, 0]} scale={[1, 1, 0.45]}>
            <coneGeometry args={[1.3, 5.4, 4]} />
            <meshStandardMaterial
              color={arm.color}
              emissive={arm.color}
              emissiveIntensity={0.4}
              roughness={0.3}
              metalness={0.25}
              flatShading
            />
          </mesh>
        </group>
      ))}
      <mesh scale={[1, 1, 0.6]}>
        <octahedronGeometry args={[1.5]} />
        <meshStandardMaterial color={COLORS.neutral} emissive={COLORS.neutral} emissiveIntensity={1.1} flatShading />
      </mesh>
      <group ref={ringA}>
        <mesh>
          <torusGeometry args={[7.4, 0.05, 8, 96, Math.PI * 1.6]} />
          <meshBasicMaterial color={COLORS.god} />
        </mesh>
      </group>
      <group ref={ringB} rotation={[0.5, 0.3, 0]}>
        <mesh>
          <torusGeometry args={[8.6, 0.035, 8, 96, Math.PI * 1.2]} />
          <meshBasicMaterial color={COLORS.steel} transparent opacity={0.6} />
        </mesh>
      </group>
      <pointLight color={COLORS.self} intensity={260} distance={60} />
    </group>
  );
}

/** A soft column of light under the emblem and the glowing circle it stands on. */
function Beacon() {
  return (
    <group>
      <mesh position={[0, EMBLEM_Y / 2, 0]}>
        <cylinderGeometry args={[0.5, 2.6, EMBLEM_Y, 32, 1, true]} />
        <meshBasicMaterial
          color={COLORS.god}
          transparent
          opacity={0.05}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.04, 0]}>
        <ringGeometry args={[2.7, 3, 64]} />
        <meshBasicMaterial color={COLORS.god} />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.03, 0]}>
        <ringGeometry args={[4.6, 4.7, 64]} />
        <meshBasicMaterial color={COLORS.god} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

function Castle({ model, x, turn }: { model: string; x: number; turn: number }) {
  const gltf = useModel(model);
  const clone = useMemo(() => gltf.scene.clone(), [gltf]);
  return <primitive object={clone} position={[x, 0, -13]} scale={5.2} rotation={[0, turn, 0]} />;
}

/** The two bases flanking the path, each lit in its team colour. */
function Bases() {
  return (
    <>
      <Castle model={MODELS.shrineAlly} x={-13} turn={Math.PI / 5} />
      <Castle model={MODELS.shrineEnemy} x={13} turn={-Math.PI / 5} />
    </>
  );
}

function Forest() {
  const { treesA, treesB, rocks } = useMemo(() => {
    // Fixed seed: the lobby looks the same on every visit.
    const rng = new Rng(4104);
    const treesA: Placement[] = [];
    const treesB: Placement[] = [];
    const rocks: Placement[] = [];
    for (let i = 0; i < 260; i++) {
      const x = rng.range(-70, 70);
      const z = rng.range(-75, -4);
      // Keep the path and the two bases clear.
      if (Math.abs(x) < 7 || (Math.abs(x) < 22 && z > -24)) continue;
      const item = { x, z, scale: rng.range(4, 7), turn: rng.range(0, Math.PI * 2) };
      if (i % 9 === 0) rocks.push({ ...item, scale: rng.range(5, 9) });
      else (i % 2 === 0 ? treesA : treesB).push(item);
    }
    return { treesA, treesB, rocks };
  }, []);
  return (
    <>
      <Props model={MODELS.treeA} items={treesA} castShadow={false} />
      <Props model={MODELS.treeB} items={treesB} castShadow={false} />
      <Props model={MODELS.rock} items={rocks} castShadow={false} />
    </>
  );
}

/** The hero being picked, life-size on the path in front of the emblem. */
function Hero({ heroId, size }: { heroId: string; size: number }) {
  return (
    <group position={[0, 0, HERO_Z]}>
      <group scale={HERO_SCALE * size}>
        <HeroShowcase key={heroId} heroId={heroId} />
      </group>
      {/* A soft key light from the camera side and a race-coloured rim from behind. */}
      <pointLight position={[-3, 7, 9]} color={COLORS.neutral} intensity={230} distance={30} />
      <pointLight position={[3, 5, -4]} color={heroColor(heroId)} intensity={220} distance={24} />
    </group>
  );
}

/** Sparks drifting up through the scene. */
function Embers({ count }: { count: number }) {
  const ref = useRef<Points>(null);
  const { positions, speeds } = useMemo(() => {
    const rng = new Rng(77);
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rng.range(-40, 40);
      positions[i * 3 + 1] = rng.range(0, 30);
      positions[i * 3 + 2] = rng.range(-30, 24);
      speeds[i] = rng.range(0.4, 1.6);
    }
    return { positions, speeds };
  }, [count]);

  useFrame((_, delta) => {
    const attribute = ref.current?.geometry.getAttribute('position');
    if (!attribute) return;
    const array = attribute.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const y = array[i * 3 + 1] + speeds[i] * delta;
      array[i * 3 + 1] = y > 30 ? 0 : y;
    }
    attribute.needsUpdate = true;
  });

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={COLORS.self}
        size={0.16}
        transparent
        opacity={0.85}
        blending={AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

/** Slow side-to-side drift. */
function CameraRig({ centred }: { centred: boolean }) {
  const time = useRef(0);
  useFrame(({ camera, size }, delta) => {
    time.current += delta;
    const wide = size.width / size.height > WIDE_ASPECT;
    const shift = !wide ? 0 : centred ? CENTRE_SHIFT : WIDE_SHIFT;
    // The hero stands close to the camera, so a big swing would slide it under the menu.
    const angle = Math.sin(time.current * 0.12) * (centred ? 0.08 : 0.22);
    camera.position.set(Math.sin(angle) * CAMERA_DISTANCE - shift, 11, Math.cos(angle) * CAMERA_DISTANCE);
    camera.lookAt(-shift, 7.5, 0);
    // A tall screen needs a wider lens to fit the rings.
    const fov = size.width < size.height ? 62 : 40;
    if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

/** Draws the scene through a bloom pass so the bright parts glow. */
function Bloom() {
  const { gl, scene, camera, size } = useThree();
  const composer = useMemo(() => {
    const made = new EffectComposer(gl);
    made.addPass(new RenderPass(scene, camera));
    made.addPass(new UnrealBloomPass(new Vector2(1, 1), 0.6, 0.7, 0.72));
    made.addPass(new OutputPass());
    return made;
  }, [gl, scene, camera]);

  useEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
  }, [composer, gl, size]);
  useEffect(() => () => composer.dispose(), [composer]);

  // A positive priority hands the drawing over to this component.
  useFrame(() => composer.render(), 1);
  return null;
}

/**
 * The living backdrop behind the lobby screens. It takes no input: the menu is drawn over it.
 * `heroId` puts that hero on show in the middle of the scene.
 */
export default function LobbyScene({
  graphics,
  heroId,
  heroSize = 1,
}: {
  graphics: Graphics;
  heroId?: string;
  /** Shrinks the hero on show, for a screen that leaves it less room than the home screen does. */
  heroSize?: number;
}) {
  const high = graphics === 'high';
  const [still] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  return (
    <Canvas
      camera={{ fov: 40, near: 1, far: 220, position: [0, 11, CAMERA_DISTANCE] }}
      dpr={high ? [1, 1.5] : 1}
      gl={{ antialias: high }}
      frameloop={still ? 'demand' : 'always'}
      fallback={null}
    >
      <color attach="background" args={[COLORS.sky]} />
      <fog attach="fog" args={[COLORS.sky, 34, 105]} />
      <hemisphereLight args={['#dfeaff', '#3a4a35', 0.3]} />
      <directionalLight position={[-10, 30, -20]} color="#9cc8ff" intensity={0.7} />
      <pointLight position={[-11, 8, -3]} color={COLORS.ally} intensity={320} distance={50} />
      <pointLight position={[11, 8, -3]} color={COLORS.enemy} intensity={320} distance={50} />
      <CameraRig centred={heroId !== undefined} />
      <mesh rotation={FLAT} position={[0, -0.05, 0]}>
        <circleGeometry args={[130, 48]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      <mesh rotation={FLAT}>
        <planeGeometry args={[9, 150]} />
        <meshStandardMaterial color={COLORS.lane} />
      </mesh>
      <Emblem />
      <Beacon />
      <Embers count={high ? 420 : 160} />
      {/* Models arrive a moment later; the emblem and lights are already up. */}
      <Suspense fallback={null}>
        <Bases />
        {high && <Forest />}
      </Suspense>
      <Suspense fallback={null}>{heroId && <Hero heroId={heroId} size={heroSize} />}</Suspense>
      {high && <Bloom />}
    </Canvas>
  );
}
