import { BOT, SPELLS, TOWER } from '../data/balance.js';
import { BOT_BUILDS } from '../data/items.js';
import { dist } from '../math.js';
import type { HeroEntity, Sim, UnitEntity } from '../sim/Sim.js';
import { ABILITY_SLOTS, type AbilityDef, type AbilitySlot, type Command, type Vec2 } from '../types.js';
import { castBlocker } from './ability.js';
import { attackDamageOf } from './combat.js';
import { applyCommand } from './command.js';
import { canShop } from './shop.js';

const SKILL_PRIORITY = ['R', 'Q', 'E', 'W'] as const;
/** How many enemy minions make an area ability worth spending on a wave. */
const WAVE_CLEAR_COUNT = 3;

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
function rallyPoint(sim: Sim, h: HeroEntity): Vec2 {
  const dir = h.team === 0 ? 1 : -1;
  let front = -Infinity;
  for (const m of sim.q.minions) if (m.team === h.team && !m.dead) front = Math.max(front, m.pos.x * dir);
  if (front === -Infinity) {
    for (const t of sim.q.towers) if (t.team === h.team && !t.dead) front = Math.max(front, t.pos.x * dir);
  }
  if (front === -Infinity) front = sim.map.shrines[h.team].x * dir + 4;
  return { x: (front - 2) * dir, z: ((h.id % 3) - 1) * 2.5 };
}

/** One bot's turn to think. Bots act only through the commands a player could send. */
class BotBrain {
  private readonly def;
  private readonly hero;
  private readonly enemyHero: UnitEntity | null;

  constructor(
    private readonly sim: Sim,
    private readonly h: HeroEntity,
  ) {
    this.hero = h.hero;
    this.def = sim.heroDef(h.hero.defId);
    this.enemyHero = sim.nearestEnemy(h, BOT.heroSightRange, (e) => e.hero !== undefined);
  }

  private issue(cmd: Command): boolean {
    return applyCommand(this.sim, this.h, cmd);
  }

  private abilities(...kinds: AbilityDef['ai'][]): [AbilitySlot, AbilityDef][] {
    return ABILITY_SLOTS.map((slot) => [slot, this.def.abilities[slot]] as [AbilitySlot, AbilityDef]).filter(([, a]) =>
      kinds.includes(a.ai),
    );
  }

  /** Cast if possible. Machines hold back when the cast would overheat them. */
  private cast(slot: AbilitySlot, aim?: UnitEntity | Vec2): boolean {
    const ability = this.def.abilities[slot];
    if (castBlocker(this.sim, this.h, slot) !== null) return false;
    const cost = ability.cost[this.hero.abilityLevels[slot] - 1];
    if (this.def.resource === 'heat' && cost > 0 && this.hero.heat + cost > BOT.heatLimit) return false;
    const point = aim && ('pos' in aim ? aim.pos : aim);
    const reach = point ? dist(this.h.pos, point) - (aim && 'pos' in aim ? aim.radius : 0) : 0;
    if (ability.targeting === 'self') {
      // A blast around the caster is wasted unless the one it is meant for stands inside it.
      const radius = ability.params.radius?.[this.hero.abilityLevels[slot] - 1];
      if (point && radius !== undefined && reach > radius) return false;
      return this.issue({ t: 'cast', slot });
    }
    if (!aim || !point) return false;
    if (reach > ability.range) return false;
    if (ability.targeting === 'unit') return 'pos' in aim && this.issue({ t: 'cast', slot, targetId: aim.id });
    return this.issue({ t: 'cast', slot, x: point.x, z: point.z });
  }

  private siegeOff(): void {
    if (this.hero.siege) for (const [slot] of this.abilities('siege')) this.cast(slot);
  }

  private moveTo(point: Vec2): void {
    this.siegeOff();
    this.issue({ t: 'move', x: point.x, z: point.z });
  }

  private upkeep(): void {
    for (const slot of SKILL_PRIORITY) while (this.hero.skillPoints > 0 && this.issue({ t: 'levelUp', slot })) continue;
    if (canShop(this.sim, this.h)) {
      const next = BOT_BUILDS[this.def.role].find((id) => !this.hero.items.includes(id));
      if (next) this.issue({ t: 'buy', itemId: next });
    }
  }

  /** Heals, repairs and Heat venting: useful whatever else is going on. */
  private support(): void {
    const { sim, h } = this;
    for (const [slot, ability] of this.abilities('heal', 'repair', 'vent')) {
      const allies = sim.alliesWithin(h.team, h.pos, ability.range);
      if (ability.ai === 'heal') {
        const threshold = slot === 'R' ? 0.4 : 0.6;
        if (allies.some((e) => e.hero && hpPct(e) < threshold)) this.cast(slot);
      } else if (ability.ai === 'repair') {
        if (allies.some((e) => (e.tower || e.turret) && hpPct(e) < 0.8)) this.cast(slot);
      } else {
        const radius = ability.params.radius?.[0] ?? 3;
        const crowded = sim.enemiesWithin(h.team, h.pos, radius).length > 0;
        if (this.hero.heat >= 85 || (this.hero.heat >= 60 && crowded)) this.cast(slot);
      }
    }
  }

  private fight(enemy: UnitEntity): void {
    const { h } = this;
    const gap = dist(h.pos, enemy.pos);
    for (const [slot, ability] of this.abilities('damage', 'engage', 'summon', 'buff', 'shield', 'siege')) {
      if (ability.ai === 'shield') {
        if (gap <= 6 && hpPct(h) < 0.55) this.cast(slot);
      } else if (ability.ai === 'buff') {
        this.cast(slot);
      } else if (ability.ai === 'siege') {
        const reach = h.attacker.range + (this.hero.siege ? 0 : (ability.params.range?.[0] ?? 0));
        if (!this.hero.siege && gap <= reach - 0.5 && gap > 3.5) this.cast(slot);
        else if (this.hero.siege && gap > reach + 1) this.cast(slot);
      } else if (ability.ai === 'engage') {
        if (hpPct(h) > 0.5 || hpPct(enemy) < 0.3) this.cast(slot, enemy);
      } else {
        this.cast(slot, enemy);
      }
    }
    this.issue({ t: 'attack', targetId: enemy.id });
  }

  /** Last-hit when possible, otherwise push; spend area abilities on full waves. */
  private farm(): boolean {
    const { sim, h } = this;
    const minions = sim.enemiesWithin(h.team, h.pos, BOT.minionSightRange).filter((e) => e.minion && sim.canSee(h, e));
    const hit = attackDamageOf(sim, h) * 0.85;
    const killable = minions
      .filter((m) => m.health.hp <= hit)
      .sort((a, b) => dist(a.pos, h.pos) - dist(b.pos, h.pos))[0];
    const minion = killable ?? sim.nearestEnemy(h, BOT.minionSightRange, (e) => e.kind === 'minion');
    const structure = sim.nearestEnemy(
      h,
      BOT.minionSightRange,
      (e) => e.kind === 'tower' || e.kind === 'shrine' || e.kind === 'turret',
    );
    const target = minion ?? (structure && !towerThreatens(sim, h, structure) ? structure : null);
    if (!target) return false;

    const rich = this.def.resource !== 'mana' || this.hero.mana > this.hero.maxMana * 0.6;
    if (rich && minions.length >= WAVE_CLEAR_COUNT) {
      for (const [slot, ability] of this.abilities('damage')) {
        if (slot !== 'R' && ability.targeting !== 'unit') this.cast(slot, minion ?? minions[0]);
      }
    }
    for (const [slot, ability] of this.abilities('siege')) {
      const reach = h.attacker.range + (this.hero.siege ? 0 : (ability.params.range?.[0] ?? 0));
      if (!this.hero.siege && sim.inRange(h, target, reach - 0.5)) this.cast(slot);
      else if (this.hero.siege && !sim.inRange(h, target, reach)) this.cast(slot);
    }
    this.issue({ t: 'attack', targetId: target.id });
    return true;
  }

  /**
   * Map objectives. One bot per team (by id) goes to stand on a lit relic pedestal; the other two
   * hunt the Ancient Beast once they are strong enough. Returns true when the bot is busy with one.
   */
  private objective(): boolean {
    const { sim, h } = this;
    const runner = h.id % 3 === 0;
    const relic = sim.relic;
    if (relic && runner && hpPct(h) > 0.5) {
      const at = sim.map.pedestals[relic.pedestal];
      if (dist(h.pos, at) > 1) this.moveTo(at);
      else if (this.hero.order.t !== 'idle') this.issue({ t: 'stop' });
      return true;
    }
    const beast = sim.q.monsters.entities.find((m) => m.monster.type === 'beast' && !m.dead);
    if (!beast || runner || this.hero.level < BOT.beastLevel) return false;
    // Start the hunt healthy; once the Beast is engaged, stay until the usual retreat threshold.
    const engaged = beast.monster.aggroId !== null && sim.get(beast.monster.aggroId)?.team === h.team;
    if (hpPct(h) < 0.6 && !engaged) return false;
    this.siegeOff();
    this.issue({ t: 'attack', targetId: beast.id });
    return true;
  }

  think(): void {
    const { sim, h, hero, enemyHero } = this;
    this.upkeep();
    if (h.dead) return;
    this.support();

    if (hero.botRetreating && hpPct(h) >= BOT.returnAbove) hero.botRetreating = false;
    if (!hero.botRetreating && hpPct(h) < BOT.retreatBelow) hero.botRetreating = true;
    // The helper heal: when hurt in a fight, not while strolling home with nobody near.
    if (enemyHero && hpPct(h) < BOT.spellHealBelow) this.issue({ t: 'spell', spell: 'heal' });
    if (hero.botRetreating) {
      const fountain = sim.map.fountains[h.team];
      // A long way from home with nobody chasing: recall rather than walk. Any order would break it off.
      if (!enemyHero) {
        if (hero.recallAt > 0) return;
        if (dist(h.pos, fountain) > BOT.recallBeyond && this.issue({ t: 'recall' })) return;
      }
      // Nearly dead with an enemy on its heels: jump for home.
      if (enemyHero && hpPct(h) < BOT.spellFlashBelow && dist(h.pos, enemyHero.pos) <= BOT.spellFlashWithin) {
        this.issue({ t: 'spell', spell: 'flash', x: fountain.x, z: fountain.z });
      }
      if (enemyHero && dist(h.pos, enemyHero.pos) <= 7) {
        for (const [slot, ability] of this.abilities('escape', 'shield')) {
          this.cast(slot, ability.targeting === 'self' ? undefined : fountain);
        }
      }
      this.moveTo(fountain);
      return;
    }
    if (towerThreatens(sim, h, h)) {
      const dir = h.team === 0 ? 1 : -1;
      this.moveTo({ x: h.pos.x - dir * 6, z: h.pos.z });
      return;
    }
    if (enemyHero && (!towerThreatens(sim, h, enemyHero) || hpPct(enemyHero) < 0.25)) {
      // A fighter who must get close jumps onto a wounded enemy that is just out of reach, as a player would.
      const gap = dist(h.pos, enemyHero.pos) - h.attacker.range;
      if (
        h.attacker.range <= BOT.meleeReach &&
        gap > BOT.flashEngageBeyond &&
        gap <= SPELLS.flash.range &&
        hpPct(enemyHero) < BOT.flashEngageBelow &&
        hpPct(h) > hpPct(enemyHero)
      ) {
        this.issue({ t: 'spell', spell: 'flash', x: enemyHero.pos.x, z: enemyHero.pos.z });
      }
      this.fight(enemyHero);
      return;
    }
    if (this.objective()) return;
    if (!this.farm()) this.moveTo(rallyPoint(sim, h));
  }
}

/** Bots decide a few times a second and act through the same commands as players. */
export function aiSystem(sim: Sim): void {
  for (const h of sim.q.heroes) {
    if (h.hero.isBot && (sim.tick + h.id) % BOT.thinkTicks === 0) new BotBrain(sim, h).think();
  }
}
