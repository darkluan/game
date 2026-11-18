import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { GameSession, ViewEntity } from '@/lib/session';
import { propMaterial, shrineGeometry, towerGeometry } from './egypt';
import { teamColor } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/**
 * A tower or a shrine, built in code: an obelisk on a stepped foot, or a stepped pyramid with a
 * temple on its top. The part that burns (the obelisk's point, the temple's flame) is drawn apart
 * in the side's colour so it glows.
 */
function Building({ game, entity }: { game: GameSession; entity: ViewEntity }) {
  const ref = useRef<Group>(null);
  const isTower = entity.kind === 'tower';
  const color = teamColor(entity.team, game.hero.team);
  const geometry = useMemo(() => (isTower ? towerGeometry(color) : shrineGeometry(color)), [isTower, color]);
  const material = useMemo(() => propMaterial(), []);

  useFrame(() => {
    if (ref.current) ref.current.visible = game.exists(entity.id);
  });

  return (
    <group ref={ref} position={[entity.pos.x, 0, entity.pos.z]}>
      {/* Each base faces down the lane toward the enemy. */}
      <group rotation={[0, entity.team === 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
        {isTower ? (
          <mesh position={[0, 6.3, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[0.63, 0.95, 4]} />
            <meshStandardMaterial color="#fff6d8" emissive={color} emissiveIntensity={1.8} flatShading />
          </mesh>
        ) : (
          <mesh position={[0, 5.4, 0]}>
            <octahedronGeometry args={[0.7]} />
            <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={2} flatShading />
          </mesh>
        )}
      </group>
      {entity.attacker && (
        <mesh rotation={FLAT} position={[0, 0.04, 0]}>
          <ringGeometry args={[entity.attacker.range - 0.08, entity.attacker.range, 64]} />
          <meshBasicMaterial color={color} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

export function Buildings({ game }: { game: GameSession }) {
  return game.buildings().map((b) => <Building key={b.id} game={game} entity={b} />);
}
