import { HERO, MAX_LEVEL, MINION, TICK_RATE, TOWER, xpToNext } from '../data/balance.js';
import { dist } from '../math.js';
import { raceOf } from '../races/index.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { Entity } from '../types.js';

function giveGold(sim: Sim, hero: Entity, amount: number, at: Entity): void {
  if (!hero.hero) return;
  hero.hero.gold += amount;
  sim.emit({ t: 'gold', id: hero.id, amount, x: at.pos.x, z: at.pos.z });
}

export function grantXp(sim: Sim, h: HeroEntity, amount: number): void {
  const hero = h.hero;
  if (hero.level >= MAX_LEVEL) return;
  hero.xp += amount;
  const def = sim.heroDef(hero.defId);
  while (hero.level < MAX_LEVEL && hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    hero.skillPoints++;
    h.health.maxHp += def.base.hpPerLevel;
    hero.maxMana += def.base.manaPerLevel;
    h.attacker.damage += def.base.attackPerLevel;
    if (!h.dead) {
      h.health.hp += def.base.hpPerLevel;
      hero.mana += def.base.manaPerLevel;
    }
    sim.emit({ t: 'levelUp', id: h.id, level: hero.level });
  }
  if (hero.level >= MAX_LEVEL) hero.xp = 0;
}

/** Split xp between the enemy heroes standing near the unit that died. */
function shareXp(sim: Sim, victim: Entity, amount: number): void {
  const near = sim.q.heroes.entities.filter(
    (h) => h.team !== victim.team && !h.dead && dist(h.pos, victim.pos) <= HERO.xpShareRange,
  );
  for (const h of near) grantXp(sim, h, amount / near.length);
}

export function onDeath(sim: Sim, victim: Entity, killer: Entity | null): void {
  sim.emit({
    t: 'death',
    id: victim.id,
    kind: victim.kind,
    team: victim.team,
    killerId: killer?.id ?? null,
    x: victim.pos.x,
    z: victim.pos.z,
  });

  if (victim.minion) {
    if (killer?.hero) giveGold(sim, killer, MINION.gold[victim.minion.type], victim);
    shareXp(sim, victim, MINION.xp[victim.minion.type]);
  } else if (victim.tower) {
    for (const h of sim.q.heroes) if (h.team !== victim.team) giveGold(sim, h, TOWER.goldPerEnemyHero, victim);
  } else if (victim.shrine) {
    sim.winner = victim.team === 0 ? 1 : 0;
    sim.emit({ t: 'gameOver', winner: sim.winner });
  } else if (victim.hero) {
    const hero = victim.hero;
    const recent = hero.recentAttackers.filter((a) => sim.tick - a.tick <= HERO.assistWindowTicks);
    // A minion or tower kill is credited to the last hero that hit the victim.
    const creditId = killer?.hero ? killer.id : recent[recent.length - 1]?.id;
    for (const a of recent) {
      const attacker = sim.get(a.id);
      if (!attacker?.hero) continue;
      if (a.id === creditId) {
        attacker.hero.kills++;
        giveGold(sim, attacker, HERO.killGold, victim);
      } else {
        attacker.hero.assists++;
        giveGold(sim, attacker, HERO.assistGold, victim);
      }
    }
    shareXp(sim, victim, HERO.killXpBase + HERO.killXpPerLevel * hero.level);
    hero.deaths++;
    hero.recentAttackers = [];
    hero.order = { t: 'idle' };
    hero.respawnTick =
      sim.tick +
      Math.round(
        (HERO.respawnBaseTicks + HERO.respawnPerLevelTicks * hero.level) *
          raceOf(sim.heroDef(hero.defId).race).respawnMult,
      );
    if (victim.mover) victim.mover.path = [];
    if (victim.attacker) victim.attacker.targetId = null;
    victim.statuses = [];
  }
}

/** Respawn, regeneration, fountain healing and gold over time. */
export function heroUpkeepSystem(sim: Sim): void {
  for (const h of sim.q.heroes) {
    const hero = h.hero;
    const def = sim.heroDef(hero.defId);
    if (h.dead) {
      if (sim.tick < hero.respawnTick) continue;
      const fountain = sim.map.fountains[h.team];
      h.dead = false;
      h.pos.x = fountain.x;
      h.pos.z = fountain.z;
      h.health.hp = h.health.maxHp;
      hero.mana = hero.maxMana;
      sim.emit({ t: 'respawn', id: h.id });
    }
    const atFountain = dist(h.pos, sim.map.fountains[h.team]) <= HERO.fountainRadius;
    const hpRate =
      def.base.hpRegen * raceOf(def.race).hpRegenMult + (atFountain ? h.health.maxHp * HERO.fountainRegen : 0);
    const manaRate = def.base.manaRegen + (atFountain ? hero.maxMana * HERO.fountainRegen : 0);
    h.health.hp = Math.min(h.health.maxHp, h.health.hp + hpRate / TICK_RATE);
    hero.mana = Math.min(hero.maxMana, hero.mana + manaRate / TICK_RATE);
    if (sim.tick % TICK_RATE === 0) hero.gold += HERO.passiveGoldPerSecond;
  }
}
