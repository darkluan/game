import { seconds, SHOP } from '../data/balance.js';
import type { Race } from '../types.js';

/** The base mechanic of each race, as numbers the shared systems read. */
export interface RaceDef {
  id: Race;
  name: string;
  /** One line shown to the player. */
  description: string;
  itemSlots: number;
  /** Fraction taken off shop prices. */
  shopDiscount: number;
  respawnMult: number;
  /** Multiplier on the hero's own health regeneration (items and the fountain still heal). */
  hpRegenMult: number;
}

export const RACES: Record<Race, RaceDef> = {
  human: {
    id: 'human',
    name: 'Người',
    description: 'Mang được 5 món đồ thay vì 4 và mua rẻ hơn 10%.',
    itemSlots: SHOP.slots + 1,
    shopDiscount: 0.1,
    respawnMult: 1,
    hpRegenMult: 1,
  },
  dragon: {
    id: 'dragon',
    name: 'Rồng',
    description: 'Chiêu không tốn gì. Tiến hóa ở cấp 5 và 9: to hơn, khỏe hơn, chiêu mạnh hơn.',
    itemSlots: SHOP.slots,
    shopDiscount: 0,
    respawnMult: 1,
    hpRegenMult: 1,
  },
  god: {
    id: 'god',
    name: 'Thần',
    description: 'Mạnh hơn khi có lính phe mình ở gần. Hồi sinh lâu hơn 50%.',
    itemSlots: SHOP.slots,
    shopDiscount: 0,
    respawnMult: 1.5,
    hpRegenMult: 1,
  },
  machine: {
    id: 'machine',
    name: 'Người máy',
    description:
      'Chiêu sinh Nhiệt thay vì tốn mana. Nhiệt trên 50 chiêu mạnh hơn, chạm 100 thì Quá tải. Không tự hồi máu.',
    itemSlots: SHOP.slots,
    shopDiscount: 0,
    respawnMult: 1,
    hpRegenMult: 0,
  },
};

export function raceOf(race: Race): RaceDef {
  return RACES[race];
}

/** Gods grow stronger with allied minions ("followers") close by. */
export const FOLLOWERS = {
  range: 8,
  max: 5,
  attackPerFollower: 0.04,
  armorPerFollower: 3,
} as const;

/** The machine race's Heat gauge. */
export const HEAT = {
  max: 100,
  decayPerSecond: 14,
  /** Heat only starts to fall this long after the last cast. */
  decayDelayTicks: seconds(1.5),
  /** Casting above this much Heat deals bonus ability damage. */
  bonusThreshold: 50,
  bonusMult: 1.25,
  overloadTicks: seconds(3),
  overloadSlow: 0.4,
} as const;
