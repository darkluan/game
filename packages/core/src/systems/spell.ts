import { HERO, RECALL, SPELLS } from '../data/balance.js';
import { dist } from '../math.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { SpellId, Vec2 } from '../types.js';

/** Ticks until a helper spell is ready again. */
export function spellCooldownLeft(sim: Sim, caster: HeroEntity, spell: SpellId): number {
  return Math.max(0, caster.hero.spellReadyAt[spell] - sim.tick);
}

/**
 * Uses a helper spell. They cost nothing and silence does not stop them; only death, a stun or
 * being turned to stone does. Flash jumps toward `aim`, or straight ahead when no aim is given.
 */
export function castSpell(sim: Sim, caster: HeroEntity, spell: SpellId, aim: Vec2 | null): boolean {
  if (caster.dead || sim.cannotAct(caster) || spellCooldownLeft(sim, caster, spell) > 0) return false;
  const from = { x: caster.pos.x, z: caster.pos.z };
  if (spell === 'heal') {
    // Nothing to mend: keep the spell for when it is needed.
    if (sim.heal(caster, caster.health.maxHp * SPELLS.heal.healFraction) <= 0) return false;
  } else {
    const dx = aim ? aim.x - from.x : Math.sin(caster.facing);
    const dz = aim ? aim.z - from.z : Math.cos(caster.facing);
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) return false;
    const reach = aim ? Math.min(length, SPELLS.flash.range) : SPELLS.flash.range;
    const landing = sim.nav.nearestWalkable({ x: from.x + (dx / length) * reach, z: from.z + (dz / length) * reach });
    caster.pos.x = landing.x;
    caster.pos.z = landing.z;
    caster.mover.path = [];
    caster.hero.order = { t: 'idle' };
  }
  caster.hero.spellReadyAt[spell] = sim.tick + SPELLS[spell].cooldownTicks;
  sim.emit({ t: 'spell', casterId: caster.id, spell, fromX: from.x, fromZ: from.z, x: caster.pos.x, z: caster.pos.z });
  return true;
}

/** Starts the channel that carries the hero home. Pointless, so refused, when already at the fountain. */
export function startRecall(sim: Sim, caster: HeroEntity): boolean {
  if (caster.dead || sim.cannotAct(caster) || caster.hero.recallAt > 0) return false;
  if (dist(caster.pos, sim.map.fountains[caster.team]) <= HERO.fountainRadius) return false;
  caster.mover.path = [];
  caster.attacker.targetId = null;
  caster.hero.order = { t: 'idle' };
  caster.hero.recallAt = sim.tick + RECALL.channelTicks;
  sim.emit({ t: 'recall', id: caster.id, phase: 'start', x: caster.pos.x, z: caster.pos.z });
  return true;
}

/** Finishes the recalls whose time has come, and breaks off those of heroes that can no longer channel. */
export function recallSystem(sim: Sim): void {
  for (const h of sim.q.heroes) {
    if (h.hero.recallAt === 0) continue;
    if (h.dead || sim.cannotAct(h)) {
      sim.cancelRecall(h);
    } else if (sim.tick >= h.hero.recallAt) {
      const fountain = sim.map.fountains[h.team];
      h.hero.recallAt = 0;
      sim.emit({ t: 'recall', id: h.id, phase: 'done', x: h.pos.x, z: h.pos.z });
      h.pos.x = fountain.x;
      h.pos.z = fountain.z;
    }
  }
}
