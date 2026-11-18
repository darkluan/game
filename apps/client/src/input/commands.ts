import type { AbilitySlot, SpellId, Vec2 } from '@game/core';
import type { GameSession } from '@/lib/session';

/** Click on the ground: attack the enemy under the cursor, else walk there. */
export function clickGround(game: GameSession, at: Vec2): void {
  const enemy = game.pickEnemy(at);
  if (enemy) {
    game.send({ t: 'attack', targetId: enemy.id });
    game.addFx({
      kind: 'ring',
      x: enemy.pos.x,
      z: enemy.pos.z,
      radius: enemy.radius + 0.6,
      color: 'enemy',
      duration: 0.3,
    });
  } else {
    game.send({ t: 'move', x: at.x, z: at.z });
    game.addFx({ kind: 'ring', x: at.x, z: at.z, radius: 0.7, color: 'neutral', duration: 0.3 });
  }
}

/**
 * Quick cast: aim at the cursor. Without a cursor aim (HUD button) or without an enemy under it,
 * unit-targeted abilities fall back to the nearest enemy in range.
 */
export function castSlot(game: GameSession, slot: AbilitySlot, aim: Vec2 | null): void {
  const def = game.ability(slot);
  if (def.targeting === 'self') {
    game.send({ t: 'cast', slot });
    return;
  }
  if (def.targeting === 'unit') {
    const target = (aim && game.pickEnemy(aim, 1.5)) ?? game.nearestEnemy(def.range);
    if (target) game.send({ t: 'cast', slot, targetId: target.id });
    return;
  }
  const hero = game.hero;
  const point = aim ??
    game.nearestEnemy(def.range + 2)?.pos ?? {
      x: hero.pos.x + Math.sin(hero.facing) * def.range,
      z: hero.pos.z + Math.cos(hero.facing) * def.range,
    };
  game.send({ t: 'cast', slot, x: point.x, z: point.z });
}

/**
 * A helper spell. Flash goes toward the cursor; without one (a HUD button, a phone) the server sends
 * the hero straight ahead, the way it is facing.
 */
export function castSpell(game: GameSession, spell: SpellId | 'recall', aim: Vec2 | null): void {
  if (spell === 'recall') game.send({ t: 'recall' });
  else if (spell === 'flash' && aim) game.send({ t: 'spell', spell, x: aim.x, z: aim.z });
  else game.send({ t: 'spell', spell });
}

/** How far ahead of the hero a joystick push aims; long enough that the hero never arrives between updates. */
const STICK_REACH = 5;

/** Touch joystick: walk in a direction (a unit vector on the ground). */
export function moveInDirection(game: GameSession, dir: Vec2): void {
  const { pos } = game.hero;
  game.send({ t: 'move', x: pos.x + dir.x * STICK_REACH, z: pos.z + dir.z * STICK_REACH });
}

/** Touch attack button: go for the nearest enemy hero if one is close, otherwise the nearest enemy of any kind. */
export function attackNearest(game: GameSession, range: number): void {
  const heroPos = game.hero.pos;
  const near = (kind: 'hero' | 'any') =>
    game
      .units()
      .filter((e) => e.team !== game.hero.team && !e.dead && (kind === 'any' || e.kind === 'hero'))
      .map((e) => ({ e, d: Math.hypot(e.pos.x - heroPos.x, e.pos.z - heroPos.z) }))
      .filter(({ d }) => d <= range)
      .sort((a, b) => a.d - b.d)[0]?.e;
  // pickEnemy applies the "can this be attacked" rules (e.g. towers protected by the one in front).
  const target = [near('hero'), near('any')].flatMap((e) => (e ? (game.pickEnemy(e.pos, 0.5) ?? []) : []))[0];
  if (target) game.send({ t: 'attack', targetId: target.id });
}
