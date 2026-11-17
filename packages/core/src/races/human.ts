import type { RaceDef } from './index.js';

/** Người: no innate power, wins through items. One extra slot and a shop discount. */
export const human: RaceDef = {
  id: 'human',
  itemSlots: 5,
  shopDiscount: 0.1,
  respawnMult: 1,
  hpRegenMult: 1,
};
