import type { AbilitySlot, SpellId, Vec2 } from '@game/core';
import type { GameSession, ViewEntity } from '@/lib/session';

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

/** Where a cast of this ability would go right now: on the hero itself, at one enemy (none, if there is none in reach), or at a point. */
export type CastAim = { on: 'self' } | { on: 'unit'; target: ViewEntity | null } | { on: 'point'; point: Vec2 };

/**
 * Quick cast: aim at the cursor. Without a cursor aim (HUD button) or without an enemy under it,
 * unit-targeted abilities fall back to the nearest enemy in range. The drawing of where a held
 * ability would land asks the same question, so what is shown is what is cast.
 */
export function aimOf(game: GameSession, slot: AbilitySlot, aim: Vec2 | null): CastAim {
  const def = game.ability(slot);
  if (def.targeting === 'self') return { on: 'self' };
  if (def.targeting === 'unit')
    return { on: 'unit', target: (aim && game.pickEnemy(aim, 1.5)) ?? game.nearestEnemy(def.range) };
  const hero = game.hero;
  const point = aim ??
    game.nearestEnemy(def.range + 2)?.pos ?? {
      x: hero.pos.x + Math.sin(hero.facing) * def.range,
      z: hero.pos.z + Math.cos(hero.facing) * def.range,
    };
  return { on: 'point', point };
}

export function castSlot(game: GameSession, slot: AbilitySlot, aim: Vec2 | null): void {
  const where = aimOf(game, slot, aim);
  if (where.on === 'self') game.send({ t: 'cast', slot });
  else if (where.on === 'unit') {
    if (where.target) game.send({ t: 'cast', slot, targetId: where.target.id });
  } else game.send({ t: 'cast', slot, x: where.point.x, z: where.point.z });
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

/**
 * Touch joystick: walk in a direction (a unit vector on the ground).
 *
 * The point to walk to is measured from where the hero is drawn, not from where the server last
 * said it was. Online the drawn hero runs ahead of the server's by the delay of the connection; on a
 * slow one that is most of the stick's reach, and a point measured from the server's hero would lie
 * just in front of the drawn one, or behind it: the hero would stop every few steps, or turn back.
 */
const stickFrom: Vec2 = { x: 0, z: 0 };
export function moveInDirection(game: GameSession, dir: Vec2): void {
  const pos = game.renderPos(game.hero, stickFrom);
  game.send({ t: 'move', x: pos.x + dir.x * STICK_REACH, z: pos.z + dir.z * STICK_REACH });
}

/**
 * Letting go of the joystick: stop where the hero is drawn. Online that is ahead of where the
 * server has it, so a plain order to stop would halt the server's hero short and the drawn one
 * would slide back to it; an order to walk to the drawn spot brings the server's hero up to it
 * instead, and nothing is seen to move.
 */
export function haltHere(game: GameSession): void {
  const pos = game.renderPos(game.hero, stickFrom);
  game.send({ t: 'move', x: pos.x, z: pos.z });
}

/** The A key: walk to a point, fighting whatever comes within reach on the way. */
export function attackMove(game: GameSession, at: Vec2): void {
  game.send({ t: 'attackMove', x: at.x, z: at.z });
  game.addFx({ kind: 'ring', x: at.x, z: at.z, radius: 0.9, color: 'enemy', inward: true, duration: 0.35 });
}

/**
 * Touch attack button: an enemy hero within reach comes first, the weakest of them if there are
 * several, as a player would choose; with no hero near, the nearest enemy of any kind.
 */
export function attackNearest(game: GameSession, range: number): void {
  const heroPos = game.hero.pos;
  const near = (kind: 'hero' | 'any') =>
    game
      .units()
      .filter((e) => e.team !== game.hero.team && !e.dead && (kind === 'any' || e.kind === 'hero'))
      .map((e) => ({ e, d: Math.hypot(e.pos.x - heroPos.x, e.pos.z - heroPos.z) }))
      .filter(({ d }) => d <= range)
      .sort(
        (a, b) =>
          (kind === 'hero' ? a.e.health.hp / a.e.health.maxHp - b.e.health.hp / b.e.health.maxHp : 0) || a.d - b.d,
      )[0]?.e;
  // pickEnemy applies the "can this be attacked" rules (e.g. towers protected by the one in front).
  const target = [near('hero'), near('any')].flatMap((e) => (e ? (game.pickEnemy(e.pos, 0.5) ?? []) : []))[0];
  if (target) game.send({ t: 'attack', targetId: target.id });
}
