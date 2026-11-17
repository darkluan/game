import type { AbilitySlot, Vec2 } from '@game/core';
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
