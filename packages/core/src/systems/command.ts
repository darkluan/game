import type { HeroEntity, Sim } from '../sim/Sim.js';
import { ABILITY_SLOTS, type Command, SPELL_IDS } from '../types.js';
import { castAbility, levelUpAbility } from './ability.js';
import { pathFor } from './movement.js';
import { buyItem, sellItem } from './shop.js';
import { castSpell, startRecall } from './spell.js';

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

/**
 * Validates one command and applies it. Commands come from the network, so nothing about their
 * shape is trusted. Returns false when the command was rejected.
 */
export function applyCommand(sim: Sim, hero: HeroEntity, cmd: Command): boolean {
  if (typeof cmd !== 'object' || cmd === null) return false;
  switch (cmd.t) {
    case 'levelUp':
      return ABILITY_SLOTS.includes(cmd.slot) && levelUpAbility(sim, hero, cmd.slot);
    case 'move': {
      if (hero.dead || !finite(cmd.x) || !finite(cmd.z)) return false;
      sim.cancelRecall(hero);
      hero.mover.path = pathFor(sim, hero, { x: cmd.x, z: cmd.z });
      hero.hero.order = hero.mover.path.length > 0 ? { t: 'move' } : { t: 'idle' };
      return true;
    }
    case 'attack': {
      if (hero.dead || !finite(cmd.targetId)) return false;
      const target = sim.get(cmd.targetId);
      if (!target || target.team === hero.team || !sim.isTargetable(target) || !sim.canSee(hero, target)) return false;
      sim.cancelRecall(hero);
      hero.hero.order = { t: 'attack', targetId: target.id };
      return true;
    }
    case 'attackMove': {
      if (hero.dead || !finite(cmd.x) || !finite(cmd.z)) return false;
      sim.cancelRecall(hero);
      const to = sim.nav.nearestWalkable({ x: cmd.x, z: cmd.z });
      hero.mover.path = [];
      hero.hero.order = { t: 'attackMove', x: to.x, z: to.z };
      return true;
    }
    case 'cast': {
      if (!ABILITY_SLOTS.includes(cmd.slot)) return false;
      if (cmd.x !== undefined && !finite(cmd.x)) return false;
      if (cmd.z !== undefined && !finite(cmd.z)) return false;
      if (cmd.targetId !== undefined && !finite(cmd.targetId)) return false;
      if (!castAbility(sim, hero, cmd)) return false;
      sim.cancelRecall(hero);
      return true;
    }
    case 'spell': {
      if (!SPELL_IDS.includes(cmd.spell)) return false;
      const aimed = cmd.x !== undefined || cmd.z !== undefined;
      if (aimed && (!finite(cmd.x) || !finite(cmd.z))) return false;
      if (!castSpell(sim, hero, cmd.spell, aimed ? { x: cmd.x as number, z: cmd.z as number } : null)) return false;
      // Mending while channelling is fine; jumping away is not standing still.
      if (cmd.spell === 'flash') sim.cancelRecall(hero);
      return true;
    }
    case 'recall': {
      return startRecall(sim, hero);
    }
    case 'stop': {
      if (hero.dead) return false;
      sim.cancelRecall(hero);
      hero.mover.path = [];
      hero.attacker.targetId = null;
      hero.hero.order = { t: 'idle' };
      return true;
    }
    case 'buy':
      return buyItem(sim, hero, cmd.itemId);
    case 'sell':
      return sellItem(sim, hero, cmd.slotIndex);
    default:
      return false;
  }
}
