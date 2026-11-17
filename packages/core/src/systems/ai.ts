import { BOT, TOWER } from '../data/balance.js';
import { dist } from '../math.js';
import type { HeroEntity, Sim, UnitEntity } from '../sim/Sim.js';
import { ABILITY_SLOTS, type Command } from '../types.js';
import { applyCommand } from './command.js';

const SKILL_PRIORITY = ['R', 'Q', 'E', 'W'] as const;

function hpPct(e: UnitEntity): number {
  return e.health.hp / e.health.maxHp;
}

/** True when an enemy tower can shoot `at` and no allied minion is there to take the shots. */
function towerThreatens(sim: Sim, h: HeroEntity, at: UnitEntity): boolean {
  for (const t of sim.q.towers) {
    if (t.team === h.team || t.dead || dist(t.pos, at.pos) > TOWER.range + 1) continue;
    const covered = sim.q.minions.entities.some(
      (m) => m.team === h.team && !m.dead && dist(m.pos, t.pos) <= TOWER.range,
    );
    if (!covered) return true;
  }
  return false;
}

/** Where a bot with nothing to fight waits: just behind its front minion, else at its outer tower. */
function rallyPoint(sim: Sim, h: HeroEntity): { x: number; z: number } {
  const dir = h.team === 0 ? 1 : -1;
  let front = -Infinity;
  for (const m of sim.q.minions) if (m.team === h.team && !m.dead) front = Math.max(front, m.pos.x * dir);
  if (front === -Infinity) {
    for (const t of sim.q.towers) if (t.team === h.team && !t.dead) front = Math.max(front, t.pos.x * dir);
  }
  if (front === -Infinity) front = sim.map.shrines[h.team].x * dir + 4;
  return { x: (front - 2) * dir, z: ((h.id % 3) - 1) * 2.5 };
}

function think(sim: Sim, h: HeroEntity): void {
  const hero = h.hero;
  const issue = (cmd: Command) => applyCommand(sim, h, cmd);
  for (const slot of SKILL_PRIORITY) while (hero.skillPoints > 0 && issue({ t: 'levelUp', slot })) continue;
  if (h.dead) return;

  const enemyHero = sim.nearestEnemy(h, BOT.heroSightRange, (e) => e.hero !== undefined);
  if (enemyHero && hpPct(h) < 0.6) issue({ t: 'cast', slot: 'W' });

  if (hero.botRetreating && hpPct(h) >= BOT.returnAbove) hero.botRetreating = false;
  if (!hero.botRetreating && hpPct(h) < BOT.retreatBelow) hero.botRetreating = true;
  if (hero.botRetreating) {
    issue({ t: 'move', ...sim.map.fountains[h.team] });
    return;
  }
  if (towerThreatens(sim, h, h)) {
    const dir = h.team === 0 ? 1 : -1;
    issue({ t: 'move', x: h.pos.x - dir * 6, z: h.pos.z });
    return;
  }

  if (enemyHero && (!towerThreatens(sim, h, enemyHero) || hpPct(enemyHero) < 0.25)) {
    const aim = { x: enemyHero.pos.x, z: enemyHero.pos.z, targetId: enemyHero.id };
    // Try every ability on the target; castAbility rejects the ones out of range or on cooldown.
    for (const slot of ABILITY_SLOTS) {
      const def = sim.heroDef(hero.defId).abilities[slot];
      if (def.targeting !== 'self' && dist(h.pos, enemyHero.pos) <= def.range + 1) issue({ t: 'cast', slot, ...aim });
    }
    issue({ t: 'attack', targetId: enemyHero.id });
    return;
  }

  const minion = sim.nearestEnemy(h, BOT.minionSightRange, (e) => e.kind === 'minion');
  const structure = sim.nearestEnemy(h, BOT.minionSightRange, (e) => e.kind === 'tower' || e.kind === 'shrine');
  const target = minion ?? (structure && !towerThreatens(sim, h, structure) ? structure : null);
  if (target) issue({ t: 'attack', targetId: target.id });
  else issue({ t: 'move', ...rallyPoint(sim, h) });
}

/** Bots decide a few times a second and act through the same commands as players. */
export function aiSystem(sim: Sim): void {
  for (const h of sim.q.heroes) {
    if (h.hero.isBot && (sim.tick + h.id) % BOT.thinkTicks === 0) think(sim, h);
  }
}
