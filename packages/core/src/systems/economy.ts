import { BEAST, HERO, JUNGLE, MAX_LEVEL, MINION, TICK_RATE, TOWER, xpToNext } from '../data/balance.js';
import { itemTotals } from '../data/items.js';
import { dist } from '../math.js';
import { FOLLOWERS, HEAT, raceOf, SYNERGY } from '../races/index.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { Entity } from '../types.js';
import { onBeastSlain, onMarchingBeastDeath } from './beast.js';
import { bonusKillGold } from './passives.js';
import { recomputeStats } from './stats.js';

const TURRET_GOLD = 30;

function giveGold(sim: Sim, hero: Entity, amount: number, at: Entity): void {
  if (!hero.hero || amount <= 0) return;
  hero.hero.gold += amount;
  sim.emit({ t: 'gold', id: hero.id, amount, x: at.pos.x, z: at.pos.z });
}

export function grantXp(sim: Sim, h: HeroEntity, amount: number): void {
  const hero = h.hero;
  if (hero.level >= MAX_LEVEL) return;
  hero.xp += amount;
  while (hero.level < MAX_LEVEL && hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    hero.skillPoints++;
    sim.emit({ t: 'levelUp', id: h.id, level: hero.level });
  }
  if (hero.level >= MAX_LEVEL) hero.xp = 0;
  recomputeStats(sim, h);
}

/** Split xp between the enemy heroes standing near the unit that died. */
function shareXp(sim: Sim, victim: Entity, amount: number): void {
  const near = sim.q.heroes.entities.filter(
    (h) => h.team !== victim.team && !h.dead && dist(h.pos, victim.pos) <= HERO.xpShareRange,
  );
  for (const h of near) grantXp(sim, h, amount / near.length);
}

/** `killer` is already the hero to credit when a summon made the kill. */
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
    if (victim.minion.type === 'beast') onMarchingBeastDeath(sim);
    if (killer?.hero) giveGold(sim, killer, MINION.gold[victim.minion.type], victim);
    shareXp(sim, victim, MINION.xp[victim.minion.type]);
  } else if (victim.monster?.type === 'beast') {
    onBeastSlain(sim, killer);
    // The whole team is paid, so the hunt is worth leaving the lane for.
    for (const h of sim.q.heroes) if (h.team === killer?.team) giveGold(sim, h, BEAST.teamGold, victim);
    shareXp(sim, victim, BEAST.wild.xp);
  } else if (victim.monster) {
    const type = victim.monster.type;
    const camp = sim.camps[victim.monster.camp];
    camp.alive--;
    if (camp.alive <= 0) camp.respawnAt = sim.tick + JUNGLE.respawnTicks;
    if (killer?.hero) giveGold(sim, killer, JUNGLE[type].gold, victim);
    shareXp(sim, victim, JUNGLE[type].xp);
  } else if (victim.turret) {
    if (killer?.hero) giveGold(sim, killer, TURRET_GOLD, victim);
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
        giveGold(sim, attacker, HERO.killGold + bonusKillGold(sim, attacker), victim);
      } else {
        attacker.hero.assists++;
        giveGold(sim, attacker, HERO.assistGold, victim);
      }
    }
    shareXp(sim, victim, HERO.killXpBase + HERO.killXpPerLevel * hero.level);
    hero.deaths++;
    hero.recentAttackers = [];
    hero.order = { t: 'idle' };
    hero.siege = false;
    hero.heat = 0;
    hero.overloadUntil = 0;
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

/** Per hero, every tick: respawn, stats, the race mechanic, regeneration and gold over time. */
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

    if (def.race === 'god') {
      let followers = 0;
      for (const m of sim.q.minions) {
        if (m.team === h.team && !m.dead && dist(m.pos, h.pos) <= FOLLOWERS.range) followers++;
      }
      hero.followers = Math.min(FOLLOWERS.max, followers);
    }
    recomputeStats(sim, h);

    if (def.resource === 'heat') {
      if (hero.overloadUntil > 0 && sim.tick >= hero.overloadUntil) {
        hero.overloadUntil = 0;
        hero.heat = 0;
      } else if (hero.overloadUntil === 0 && sim.tick - hero.lastCastTick > HEAT.decayDelayTicks) {
        const faster = sim.synergy[h.team].race === 'machine' ? SYNERGY.machineDecayMult : 1;
        hero.heat = Math.max(0, hero.heat - (HEAT.decayPerSecond * faster) / TICK_RATE);
      }
    }

    const items = itemTotals(hero.items);
    const atFountain = dist(h.pos, sim.map.fountains[h.team]) <= HERO.fountainRadius;
    const hpRate =
      def.base.hpRegen * raceOf(def.race).hpRegenMult +
      items.hpRegen +
      (atFountain ? h.health.maxHp * HERO.fountainRegen : 0);
    const manaRate = def.base.manaRegen + items.manaRegen + (atFountain ? hero.maxMana * HERO.fountainRegen : 0);
    h.health.hp = Math.min(h.health.maxHp, h.health.hp + hpRate / TICK_RATE);
    hero.mana = Math.min(hero.maxMana, hero.mana + manaRate / TICK_RATE);
    if (sim.tick % TICK_RATE === 0) hero.gold += HERO.passiveGoldPerSecond;
  }
}
