import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { BufferGeometry, Group, Material, Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { RELIC, type RelicType } from '@game/core';
import type { GameSession } from '@/lib/session';
import { altarGeometry, lairGeometry, LAIR_BRAZIERS, propMaterial } from './egypt';
import { COLORS, teamColor } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const IDLE = '#6f7682';
/** How high a relic floats over its altar. */
const ORB_HEIGHT = 2.9;

const RELIC_COLORS: Record<RelicType, string> = { thunder: '#ffe14d', shield: '#5cc8ff', fury: '#ff5a3c' };

/** A relic's altar. Dark until its turn; then it glows in the relic's colour and shows the capture filling up. */
function Pedestal({
  game,
  index,
  geometry,
  material,
}: {
  game: GameSession;
  index: number;
  geometry: BufferGeometry;
  material: Material;
}) {
  const at = game.map.pedestals[index];
  const orb = useRef<Mesh>(null);
  const zone = useRef<Mesh>(null);
  const fill = useRef<Mesh>(null);

  useFrame(() => {
    const relic = game.world().relic;
    const lit = relic?.pedestal === index ? relic : null;
    if (orb.current) {
      orb.current.visible = lit !== null;
      orb.current.position.y = ORB_HEIGHT + Math.sin(game.clock * 2.5) * 0.25;
      orb.current.rotation.y = game.clock * 1.5;
      if (lit) {
        const material = orb.current.material as MeshStandardMaterial;
        material.color.set(RELIC_COLORS[lit.type]);
        material.emissive.set(RELIC_COLORS[lit.type]);
      }
    }
    if (zone.current) {
      const material = zone.current.material as MeshBasicMaterial;
      material.color.set(lit ? RELIC_COLORS[lit.type] : IDLE);
      material.opacity = lit ? 0.55 + 0.25 * Math.sin(game.clock * 5) : 0.25;
    }
    if (fill.current) {
      // A disc that grows from the centre to the edge of the pedestal as the capture completes.
      const progress = lit && lit.team !== null ? lit.progress : 0;
      fill.current.visible = progress > 0;
      fill.current.scale.setScalar(Math.max(0.001, progress) * RELIC.radius);
      if (lit && lit.team !== null)
        (fill.current.material as MeshBasicMaterial).color.set(teamColor(lit.team, game.hero.team));
    }
  });

  return (
    <group position={[at.x, 0, at.z]}>
      <mesh geometry={geometry} material={material} receiveShadow castShadow />
      <mesh ref={zone} rotation={FLAT} position={[0, 0.04, 0]}>
        <ringGeometry args={[RELIC.radius - 0.15, RELIC.radius, 48]} />
        <meshBasicMaterial transparent depthWrite={false} />
      </mesh>
      <mesh ref={fill} rotation={FLAT} position={[0, 0.05, 0]} visible={false}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={orb} position={[0, ORB_HEIGHT, 0]} visible={false}>
        <octahedronGeometry args={[0.7]} />
        <meshStandardMaterial emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

/** The relic altars, and the ruined forecourt the Ancient Beast keeps, a fire burning either side of the way in. */
export function Objectives({ game }: { game: GameSession }) {
  const cave = game.map.beastCave;
  const altar = useMemo(() => altarGeometry(), []);
  const lair = useMemo(() => lairGeometry(), []);
  const material = useMemo(() => propMaterial(), []);
  const flames = useRef<Group>(null);

  useFrame(() => {
    // The fires gutter, each to its own beat.
    flames.current?.children.forEach((flame, i) => {
      flame.scale.y = 1 + 0.22 * Math.sin(game.clock * 9 + i * 2.1) + 0.1 * Math.sin(game.clock * 23 + i);
    });
  });

  return (
    <>
      {game.map.pedestals.map((_, i) => (
        <Pedestal key={i} game={game} index={i} geometry={altar} material={material} />
      ))}
      <group position={[cave.x, 0, cave.z]}>
        <mesh geometry={lair} material={material} receiveShadow castShadow />
        <mesh rotation={FLAT} position={[0, 0.03, 0]}>
          <ringGeometry args={[4.2, 4.6, 48]} />
          <meshBasicMaterial color={COLORS.enemy} transparent opacity={0.3} />
        </mesh>
        <group ref={flames}>
          {LAIR_BRAZIERS.map(([x, y, z], i) => (
            <mesh key={i} position={[x, y + 0.3, z]}>
              <coneGeometry args={[0.34, 0.9, 6]} />
              <meshStandardMaterial color="#ffd27a" emissive="#ff5a1c" emissiveIntensity={2.2} flatShading />
            </mesh>
          ))}
        </group>
      </group>
    </>
  );
}
