import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { GameSession, MinionView, MonsterView } from '@/lib/session';
import { Actor, MELEE_MINION_RIG, RANGED_MINION_RIG } from './Actor';
import { ActorPool } from './ActorPool';
import { MODELS, useModel } from './models';
import { COLORS, teamTint } from './palette';

/** The marching Ancient Beast is a minion too, just a very big one. */
const MINION_SCALE = { melee: 0.58, ranged: 0.58, beast: 1.7 } as const;
const MONSTER_SCALE = { big: 1.15, small: 0.62, beast: 2 } as const;
/** The Ancient Beast in its cave. */
const BEAST_TINT = '#c0392b';

/** Animated lane minions (high graphics). Low graphics draws them as instanced shapes instead. */
export function Minions({ game }: { game: GameSession }) {
  const melee = useModel(MODELS.minionMelee);
  const ranged = useModel(MODELS.minionRanged);
  const pool = useMemo(
    () =>
      new ActorPool<MinionView>(
        (m) => `${m.minion.type}:${m.team}`,
        (m) =>
          new Actor(
            m.minion.type === 'ranged' ? ranged : melee,
            m.minion.type === 'ranged' ? RANGED_MINION_RIG : MELEE_MINION_RIG,
            {
              scale: MINION_SCALE[m.minion.type],
              tint: teamTint(m.team, game.hero.team),
              castShadow: m.minion.type === 'beast',
            },
          ),
      ),
    [melee, ranged, game],
  );
  useFrame((_, delta) => pool.update(game, game.minions(), delta));
  return <primitive object={pool.group} />;
}

/** Jungle monsters: the lane minion's model, larger and in the jungle's own colour. */
export function Monsters({ game }: { game: GameSession }) {
  const model = useModel(MODELS.minionMelee);
  const pool = useMemo(
    () =>
      new ActorPool<MonsterView>(
        (m) => m.monster.type,
        (m) =>
          new Actor(model, MELEE_MINION_RIG, {
            scale: MONSTER_SCALE[m.monster.type],
            tint: m.monster.type === 'beast' ? BEAST_TINT : COLORS.monster,
            castShadow: m.monster.type !== 'small',
          }),
      ),
    [model],
  );
  useFrame((_, delta) => pool.update(game, game.monsters(), delta));
  return <primitive object={pool.group} />;
}
