import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import { RELIC, type RelicType } from '@game/core';
import type { GameSession } from '@/lib/session';
import { COLORS, teamColor } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const IDLE = '#6f7682';

const RELIC_COLORS: Record<RelicType, string> = { thunder: '#ffe14d', shield: '#5cc8ff', fury: '#ff5a3c' };

/** A relic pedestal. Dark until its turn; then it glows in the relic's colour and shows the capture filling up. */
function Pedestal({ game, index }: { game: GameSession; index: number }) {
  const at = game.map.pedestals[index];
  const orb = useRef<Mesh>(null);
  const zone = useRef<Mesh>(null);
  const fill = useRef<Mesh>(null);

  useFrame(() => {
    const relic = game.world().relic;
    const lit = relic?.pedestal === index ? relic : null;
    if (orb.current) {
      orb.current.visible = lit !== null;
      orb.current.position.y = 2.4 + Math.sin(game.clock * 2.5) * 0.25;
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
      <mesh position={[0, 0.35, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1, 1.3, 0.7, 8]} />
        <meshStandardMaterial color={COLORS.wall} />
      </mesh>
      <mesh ref={zone} rotation={FLAT} position={[0, 0.04, 0]}>
        <ringGeometry args={[RELIC.radius - 0.15, RELIC.radius, 48]} />
        <meshBasicMaterial transparent depthWrite={false} />
      </mesh>
      <mesh ref={fill} rotation={FLAT} position={[0, 0.05, 0]} visible={false}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial transparent opacity={0.4} depthWrite={false} />
      </mesh>
      <mesh ref={orb} position={[0, 2.4, 0]} visible={false}>
        <octahedronGeometry args={[0.7]} />
        <meshStandardMaterial emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

/** The relic pedestals and the mark of the Ancient Beast's cave. */
export function Objectives({ game }: { game: GameSession }) {
  const cave = game.map.beastCave;
  return (
    <>
      {game.map.pedestals.map((_, i) => (
        <Pedestal key={i} game={game} index={i} />
      ))}
      <mesh rotation={FLAT} position={[cave.x, 0.03, cave.z]}>
        <ringGeometry args={[4.2, 4.6, 48]} />
        <meshBasicMaterial color={COLORS.enemy} transparent opacity={0.3} />
      </mesh>
    </>
  );
}
