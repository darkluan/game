import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import type { Entity } from '@game/core';
import type { GameSession } from '@/lib/session';
import { MODELS, setShadows, useModel } from './models';
import { teamColor } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
/** Model sizes are about 1 unit across; scale them up to the buildings' collision radius. */
const TOWER_SCALE = 3;
const SHRINE_SCALE = 2.4;

function Building({ game, entity }: { game: GameSession; entity: Entity }) {
  const ref = useRef<Group>(null);
  const ally = entity.team === game.hero.team;
  const isTower = entity.kind === 'tower';
  const gltf = useModel(
    isTower ? (ally ? MODELS.towerAlly : MODELS.towerEnemy) : ally ? MODELS.shrineAlly : MODELS.shrineEnemy,
  );
  const model = useMemo(() => {
    const clone = gltf.scene.clone();
    clone.scale.setScalar(isTower ? TOWER_SCALE : SHRINE_SCALE);
    // Each base faces down the lane toward the enemy.
    clone.rotation.y = entity.team === 0 ? Math.PI / 2 : -Math.PI / 2;
    setShadows(clone, true, true);
    return clone;
  }, [gltf, isTower, entity.team]);

  useFrame(() => {
    if (ref.current) ref.current.visible = game.exists(entity.id);
  });

  return (
    <group ref={ref} position={[entity.pos.x, 0, entity.pos.z]}>
      <primitive object={model} />
      {entity.attacker && (
        <mesh rotation={FLAT} position={[0, 0.04, 0]}>
          <ringGeometry args={[entity.attacker.range - 0.08, entity.attacker.range, 64]} />
          <meshBasicMaterial color={teamColor(entity.team, game.hero.team)} transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  );
}

export function Buildings({ game }: { game: GameSession }) {
  return game.buildings().map((b) => <Building key={b.id} game={game} entity={b} />);
}
