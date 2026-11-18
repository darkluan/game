import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { GameSession, MinionView, MonsterView } from '@/lib/session';
import { ActorPool } from './ActorPool';
import { Creature } from './Creature';
import { teamColor } from './palette';

/** The marching Ancient Beast is a minion too, just a very big one. */
const BEAST_SCALE = 1.25;
/** The eyes of the Ancient Beast in its cave burn red; a tamed one marching for a team has that team's colour. */
const WILD_EYES = '#ff4a2a';

/** Lane soldiers (high graphics): mummies with sickle swords, jackal-headed guards behind them. Low graphics draws plain shapes instead. */
export function Minions({ game }: { game: GameSession }) {
  const pool = useMemo(
    () =>
      new ActorPool<MinionView>(
        (m) => `${m.minion.type}:${m.team}`,
        (m) => {
          const color = teamColor(m.team, game.hero.team);
          if (m.minion.type === 'beast') return new Creature('sphinx', color, BEAST_SCALE, true);
          return new Creature(m.minion.type === 'ranged' ? 'jackal' : 'mummy', color, 1, false);
        },
      ),
    [game],
  );
  useFrame((_, delta) => pool.update(game, game.minions(), delta));
  return <primitive object={pool.group} />;
}

/** The wild: scarabs, the scorpions that lead them, and the sphinx in its cave. */
export function Monsters({ game }: { game: GameSession }) {
  const pool = useMemo(
    () =>
      new ActorPool<MonsterView>(
        (m) => m.monster.type,
        (m) =>
          m.monster.type === 'beast'
            ? new Creature('sphinx', WILD_EYES, 1.5, true)
            : m.monster.type === 'big'
              ? new Creature('scorpion', WILD_EYES, 1.15, true)
              : new Creature('scarab', WILD_EYES, 0.9, false),
      ),
    [],
  );
  useFrame((_, delta) => pool.update(game, game.monsters(), delta));
  return <primitive object={pool.group} />;
}
