import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { GameSession } from '@/lib/session';
import { MinionPool } from './MinionPool';
import { MODELS, useModel } from './models';

/** Animated minion models (high graphics). Low graphics draws them as instanced shapes instead. */
export function Minions({ game }: { game: GameSession }) {
  const melee = useModel(MODELS.minionMelee);
  const ranged = useModel(MODELS.minionRanged);
  const pool = useMemo(() => new MinionPool(melee, ranged), [melee, ranged]);
  useFrame((_, delta) => pool.update(game, delta));
  return <primitive object={pool.group} />;
}
