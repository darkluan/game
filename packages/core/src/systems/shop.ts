import { HERO, SHOP } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { dist } from '../math.js';
import { raceOf } from '../races/index.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { HeroDef } from '../types.js';

/** What a hero of this race pays for an item. */
export function itemPrice(def: HeroDef, itemId: string): number {
  return Math.round((ITEMS[itemId]?.cost ?? 0) * (1 - raceOf(def.race).shopDiscount));
}

/** The shop is open at the hero's own fountain, and while waiting to respawn. */
export function canShop(sim: Sim, h: HeroEntity): boolean {
  return h.dead === true || dist(h.pos, sim.map.fountains[h.team]) <= HERO.fountainRadius;
}

export function buyItem(sim: Sim, h: HeroEntity, itemId: unknown): boolean {
  if (typeof itemId !== 'string' || !Object.hasOwn(ITEMS, itemId) || !canShop(sim, h)) return false;
  const def = sim.heroDef(h.hero.defId);
  const price = itemPrice(def, itemId);
  if (h.hero.items.length >= raceOf(def.race).itemSlots || h.hero.gold < price) return false;
  h.hero.gold -= price;
  h.hero.items.push(itemId);
  return true;
}

export function sellItem(sim: Sim, h: HeroEntity, slotIndex: unknown): boolean {
  if (typeof slotIndex !== 'number' || !Number.isInteger(slotIndex) || !canShop(sim, h)) return false;
  const itemId = h.hero.items[slotIndex];
  if (itemId === undefined) return false;
  h.hero.items.splice(slotIndex, 1);
  h.hero.gold += Math.floor(itemPrice(sim.heroDef(h.hero.defId), itemId) * SHOP.sellRefund);
  return true;
}
