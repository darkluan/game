import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { HERO, type Vec2 } from '@game/core';
import type { GameSession, RosterHero } from '@/lib/session';
import { useHeroActors } from './heroActors';
import { HERO_MODELS } from './heroModels';
import { COLORS, teamColor } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const TURN_RATE = 14; // radians of catch-up per second per radian of error
/** How long the death animation stays on screen before the body disappears. */
const CORPSE_SECONDS = 1.6;

function HeroModel({ game, entry }: { game: GameSession; entry: RosterHero }) {
  const base = HERO_MODELS[entry.defId] ?? HERO_MODELS.kael;
  // A dragon has a different model for each evolution; everyone else has just the one.
  const looks = useMemo(() => [base, ...(base.stages ?? [])], [base]);
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const aura = useRef<Mesh>(null);
  const stun = useRef<Mesh>(null);
  const local = useRef({ pos: { x: 0, z: 0 } as Vec2, diedAt: -1 });
  const isPlayer = entry.id === game.hero.id;
  const ringColor = isPlayer ? COLORS.self : teamColor(entry.team, game.hero.team);
  const actors = useHeroActors(looks, true);

  useEffect(() => {
    const parent = body.current;
    for (const actor of actors) parent?.add(actor.root);
    return () => {
      for (const actor of actors) parent?.remove(actor.root);
    };
  }, [actors]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const state = local.current;
    // Undefined while the hero is out of the player's sight.
    const hero = game.find(entry.id);
    const dead = hero?.dead === true;
    if (dead && state.diedAt < 0) state.diedAt = game.clock;
    if (!dead) state.diedAt = -1;
    g.visible = hero !== undefined && (!dead || game.clock - state.diedAt < CORPSE_SECONDS);
    if (!hero) return;
    if (!dead) {
      // A dead hero's position already jumped to where it will respawn; keep the body where it fell.
      const p = game.renderPos(hero, state.pos);
      g.position.set(p.x, 0, p.z);
      // Turn the short way round toward the hero's facing.
      const diff = Math.atan2(Math.sin(hero.facing - g.rotation.y), Math.cos(hero.facing - g.rotation.y));
      g.rotation.y += diff * Math.min(1, delta * TURN_RATE);
      // A hero that grows without changing model is simply scaled up.
      body.current?.scale.setScalar(looks.length > 1 ? 1 : hero.radius / HERO.radius);
    }
    // Only the model of the current form is shown and animated.
    const form = Math.min(hero.hero?.stage ?? 0, actors.length - 1);
    actors.forEach((actor, i) => {
      actor.root.visible = i === form;
    });
    actors[form].update(delta, game.clock, { dead, moving: game.isMoving(hero), action: game.lastAction(hero.id) });

    const stealth = game.hasStatus(hero, 'stealth');
    if (ring.current) (ring.current.material as MeshBasicMaterial).color.set(stealth ? COLORS.stealth : ringColor);
    const stone = game.hasStatus(hero, 'stone');
    if (aura.current) {
      aura.current.visible = !dead && (stone || game.hasStatus(hero, 'shield'));
      const material = aura.current.material as MeshBasicMaterial;
      material.color.set(stone ? COLORS.stone : COLORS.ally);
      material.opacity = stone ? 0.7 : 0.25;
      aura.current.scale.setScalar(hero.radius / HERO.radius);
    }
    if (stun.current) {
      stun.current.visible = !dead && (game.hasStatus(hero, 'stun') || game.hasStatus(hero, 'silence'));
      stun.current.position.y = 2.9 * (hero.radius / HERO.radius);
      stun.current.rotation.z += delta * 6;
    }
  });

  return (
    <group ref={group} visible={false}>
      <mesh ref={ring} rotation={FLAT} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color={ringColor} />
      </mesh>
      <group ref={body} />
      <mesh ref={aura} position={[0, 1.1, 0]} visible={false}>
        <sphereGeometry args={[1.4, 20, 16]} />
        <meshBasicMaterial transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh ref={stun} position={[0, 2.9, 0]} rotation={FLAT} visible={false}>
        <torusGeometry args={[0.4, 0.07, 6, 5]} />
        <meshBasicMaterial color={COLORS.stun} />
      </mesh>
    </group>
  );
}

export function Heroes({ game }: { game: GameSession }) {
  // One model per hero in the match, shown only while the player can see that hero.
  return game.roster().map((entry) => <HeroModel key={entry.id} game={game} entry={entry} />);
}
