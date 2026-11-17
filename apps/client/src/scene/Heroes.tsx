import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import type { Vec2 } from '@game/core';
import type { GameSession, ViewEntity } from '@/lib/session';
import { Actor, KNIGHT_HIDDEN, KNIGHT_RIG } from './Actor';
import { MODELS, useModel } from './models';
import { COLORS, teamColor, teamTint } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const TURN_RATE = 14; // radians of catch-up per second per radian of error
/** How long the death animation stays on screen before the body disappears. */
const CORPSE_SECONDS = 1.6;

function HeroModel({ game, hero }: { game: GameSession; hero: ViewEntity }) {
  const gltf = useModel(MODELS.knight);
  const group = useRef<Group>(null);
  const body = useRef<Group>(null);
  const shield = useRef<Mesh>(null);
  const stun = useRef<Mesh>(null);
  const local = useRef({ pos: { x: 0, z: 0 } as Vec2, diedAt: -1 });
  const isPlayer = hero === game.hero;
  const actor = useMemo(
    () =>
      new Actor(gltf, KNIGHT_RIG, {
        scale: 0.95,
        hide: KNIGHT_HIDDEN,
        castShadow: true,
        tint: isPlayer ? undefined : teamTint(hero.team, game.hero.team),
      }),
    [gltf, hero, game, isPlayer],
  );

  useEffect(() => {
    const parent = body.current;
    parent?.add(actor.root);
    return () => void parent?.remove(actor.root);
  }, [actor]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const state = local.current;
    const dead = hero.dead === true;
    if (dead && state.diedAt < 0) state.diedAt = game.clock;
    if (!dead) state.diedAt = -1;
    g.visible = !dead || game.clock - state.diedAt < CORPSE_SECONDS;
    if (!dead) {
      // A dead hero's position already jumped to where it will respawn; keep the body where it fell.
      const p = game.renderPos(hero, state.pos);
      g.position.set(p.x, 0, p.z);
      // Turn the short way round toward the sim's facing.
      const diff = Math.atan2(Math.sin(hero.facing - g.rotation.y), Math.cos(hero.facing - g.rotation.y));
      g.rotation.y += diff * Math.min(1, delta * TURN_RATE);
    }
    actor.update(delta, game.clock, { dead, moving: game.isMoving(hero), action: game.lastAction(hero.id) });
    if (shield.current) shield.current.visible = !dead && game.hasStatus(hero, 'shield');
    if (stun.current) {
      stun.current.visible = !dead && game.hasStatus(hero, 'stun');
      stun.current.rotation.z += delta * 6;
    }
  });

  return (
    <group ref={group}>
      <mesh rotation={FLAT} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.8, 1, 32]} />
        <meshBasicMaterial color={isPlayer ? COLORS.self : teamColor(hero.team, game.hero.team)} />
      </mesh>
      <group ref={body} />
      <mesh ref={shield} position={[0, 1.1, 0]} visible={false}>
        <sphereGeometry args={[1.4, 20, 16]} />
        <meshBasicMaterial color={COLORS.ally} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <mesh ref={stun} position={[0, 2.9, 0]} rotation={FLAT} visible={false}>
        <torusGeometry args={[0.4, 0.07, 6, 5]} />
        <meshBasicMaterial color={COLORS.stun} />
      </mesh>
    </group>
  );
}

export function Heroes({ game }: { game: GameSession }) {
  // Heroes are created with the match and never removed, only hidden while dead.
  return game.heroes().map((h) => <HeroModel key={h.id} game={game} hero={h} />);
}
