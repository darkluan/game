import { HERO, SHOP } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { dist } from '../math.js';
import { raceOf, SYNERGY, type TeamSynergy } from '../races/index.js';
import type { HeroEntity, Sim } from '../sim/Sim.js';
import type { HeroDef } from '../types.js';

/** The fraction a hero gets off shop prices: its race's discount, raised by the human pair synergy. */
export function discountOf(def: HeroDef, synergy: TeamSynergy): number {
  const base = raceOf(def.race).shopDiscount;
  return def.race === 'human' && synergy.race === 'human' ? Math.max(base, SYNERGY.humanDiscount) : base;
}

/** What an item costs at a given discount. */
export function itemPrice(itemId: string, discount: number): number {
  return Math.round((ITEMS[itemId]?.cost ?? 0) * (1 - discount));
}

/** The shop is open at the hero's own fountain, and while waiting to respawn. */
export function canShop(sim: Sim, h: HeroEntity): boolean {
  return h.dead === true || dist(h.pos, sim.map.fountains[h.team]) <= HERO.fountainRadius;
}

export function buyItem(sim: Sim, h: HeroEntity, itemId: unknown): boolean {
  if (typeof itemId !== 'string' || !Object.hasOwn(ITEMS, itemId) || !canShop(sim, h)) return false;
  const def = sim.heroDef(h.hero.defId);
  const price = itemPrice(itemId, discountOf(def, sim.synergy[h.team]));
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
  const discount = discountOf(sim.heroDef(h.hero.defId), sim.synergy[h.team]);
  h.hero.gold += Math.floor(itemPrice(itemId, discount) * SHOP.sellRefund);
  return true;
}
