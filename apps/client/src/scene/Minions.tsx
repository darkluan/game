import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { GameSession, MinionView, MonsterView } from '@/lib/session';
import { Actor, MELEE_MINION_RIG, RANGED_MINION_RIG } from './Actor';
import { ActorPool } from './ActorPool';
import { Creature } from './Creature';
import { MODELS, useModel } from './models';
import { teamColor, teamTint } from './palette';

/** The marching Ancient Beast is a minion too, just a very big one. */
const BEAST_SCALE = 1.25;
/** The skeletons against their size in the model file: a soldier stands a little under a hero's shoulder. */
const SOLDIER_SCALE = 0.7;
/** The eyes of the Ancient Beast in its cave burn red; a tamed one marching for a team has that team's colour. */
const WILD_EYES = '#ff4a2a';

/** Lane soldiers (high graphics): skeleton fighters, skeleton mages behind them, tinted in their side's colour. Low graphics draws plain shapes instead. */
export function Minions({ game }: { game: GameSession }) {
  const melee = useModel(MODELS.minionMelee);
  const ranged = useModel(MODELS.minionRanged);
  const pool = useMemo(
    () =>
      new ActorPool<MinionView>(
        (m) => `${m.minion.type}:${m.team}`,
        (m) => {
          const color = teamColor(m.team, game.hero.team);
          if (m.minion.type === 'beast') return new Creature('sphinx', color, BEAST_SCALE, true);
          const mage = m.minion.type === 'ranged';
          return new Actor(mage ? ranged : melee, mage ? RANGED_MINION_RIG : MELEE_MINION_RIG, {
            scale: SOLDIER_SCALE,
            tint: teamTint(m.team, game.hero.team),
            castShadow: false,
          });
        },
      ),
    [melee, ranged, game],
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
