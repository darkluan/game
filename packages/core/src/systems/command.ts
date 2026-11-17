import type { HeroEntity, Sim } from '../sim/Sim.js';
import { ABILITY_SLOTS, type Command } from '../types.js';
import { castAbility, levelUpAbility } from './ability.js';
import { pathFor } from './movement.js';
import { buyItem, sellItem } from './shop.js';

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
      hero.mover.path = pathFor(sim, hero, { x: cmd.x, z: cmd.z });
      hero.hero.order = hero.mover.path.length > 0 ? { t: 'move' } : { t: 'idle' };
      return true;
    }
    case 'attack': {
      if (hero.dead || !finite(cmd.targetId)) return false;
      const target = sim.get(cmd.targetId);
      if (!target || target.team === hero.team || !sim.isTargetable(target) || !sim.canSee(hero, target)) return false;
      hero.hero.order = { t: 'attack', targetId: target.id };
      return true;
    }
    case 'cast': {
      if (!ABILITY_SLOTS.includes(cmd.slot)) return false;
      if (cmd.x !== undefined && !finite(cmd.x)) return false;
      if (cmd.z !== undefined && !finite(cmd.z)) return false;
      if (cmd.targetId !== undefined && !finite(cmd.targetId)) return false;
      return castAbility(sim, hero, cmd);
    }
    case 'stop': {
      if (hero.dead) return false;
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
