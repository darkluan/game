import type { ItemDef, ItemStats, Role } from '../types.js';

const list: ItemDef[] = [
  { id: 'iron_sword', name: 'Kiếm sắt', cost: 300, stats: { attack: 12 } },
  { id: 'great_blade', name: 'Đại đao', cost: 750, stats: { attack: 30 } },
  { id: 'swift_bow', name: 'Cung thần tốc', cost: 650, stats: { attackSpeed: 0.25 } },
  { id: 'blood_axe', name: 'Rìu hút máu', cost: 800, stats: { attack: 18, lifesteal: 0.12 } },
  { id: 'war_hammer', name: 'Búa chiến', cost: 950, stats: { attack: 22, hp: 220 } },
  { id: 'leather_armor', name: 'Giáp da', cost: 300, stats: { armor: 12 } },
  { id: 'steel_armor', name: 'Giáp thép', cost: 700, stats: { armor: 28 } },
  { id: 'strength_belt', name: 'Đai lực sĩ', cost: 350, stats: { hp: 180 } },
  { id: 'giant_heart', name: 'Tim khổng lồ', cost: 850, stats: { hp: 420, hpRegen: 4 } },
  { id: 'regen_core', name: 'Lõi tái tạo', cost: 500, stats: { hpRegen: 7 } },
  { id: 'swift_boots', name: 'Giày nhanh', cost: 300, stats: { moveSpeed: 0.7 } },
  { id: 'mana_gem', name: 'Ngọc mana', cost: 300, stats: { mana: 150, manaRegen: 2 } },
  { id: 'spell_book', name: 'Sách phép', cost: 450, stats: { abilityDamage: 0.12 } },
  { id: 'ancient_staff', name: 'Trượng cổ', cost: 900, stats: { abilityDamage: 0.28, mana: 100 } },
  { id: 'hourglass', name: 'Đồng hồ cát', cost: 600, stats: { cooldownReduction: 0.15 } },
  { id: 'guardian_plate', name: 'Giáp hộ vệ', cost: 950, stats: { armor: 22, hp: 260 } },
  { id: 'storm_blade', name: 'Kiếm bão', cost: 950, stats: { attack: 20, attackSpeed: 0.2 } },
  { id: 'phoenix_feather', name: 'Lông phượng', cost: 750, stats: { hp: 200, hpRegen: 6, moveSpeed: 0.3 } },
  { id: 'arcane_orb', name: 'Cầu bí thuật', cost: 850, stats: { abilityDamage: 0.18, cooldownReduction: 0.1 } },
  { id: 'wind_cloak', name: 'Áo choàng gió', cost: 600, stats: { moveSpeed: 0.5, armor: 10, attackSpeed: 0.1 } },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((item) => [item.id, item]));
export const ITEM_LIST: readonly ItemDef[] = list;

/** Sum of the stats of a bag of items. Every field is present, 0 when no item gives it. */
export function itemTotals(itemIds: readonly string[]): Required<ItemStats> {
  const total: Required<ItemStats> = {
    attack: 0,
    attackSpeed: 0,
    armor: 0,
    hp: 0,
    hpRegen: 0,
    mana: 0,
    manaRegen: 0,
    moveSpeed: 0,
    lifesteal: 0,
    abilityDamage: 0,
    cooldownReduction: 0,
  };
  for (const id of itemIds) {
    const stats = ITEMS[id]?.stats ?? {};
    for (const key of Object.keys(stats) as (keyof ItemStats)[]) total[key] += stats[key] ?? 0;
  }
  return total;
}

/** What bots buy, in order, by role. */
export const BOT_BUILDS: Record<Role, string[]> = {
  fighter: ['iron_sword', 'swift_boots', 'strength_belt', 'war_hammer', 'steel_armor'],
  marksman: ['iron_sword', 'swift_boots', 'swift_bow', 'blood_axe', 'great_blade'],
  mage: ['spell_book', 'swift_boots', 'strength_belt', 'ancient_staff', 'hourglass'],
  tank: ['leather_armor', 'swift_boots', 'strength_belt', 'giant_heart', 'steel_armor'],
  assassin: ['iron_sword', 'swift_boots', 'great_blade', 'blood_axe', 'hourglass'],
  support: ['spell_book', 'swift_boots', 'strength_belt', 'hourglass', 'giant_heart'],
};

/**
 * What the shop recommends to a player, per hero, in the order to buy it. Nothing is ever traded
 * up, so each build is exactly as long as the hero's bag: five items for a human, four for the rest.
 * Bots keep buying by role (above), so changing a build here does not change how they play.
 */
export const HERO_BUILDS: Record<string, string[]> = {
  // Humans: five slots.
  // A bruiser who dives in: speed to reach the fight, then damage that also keeps him standing.
  kael: ['swift_boots', 'war_hammer', 'blood_axe', 'guardian_plate', 'great_blade'],
  // All her damage is her bow: faster shots first, then harder ones that heal her.
  lyra: ['swift_bow', 'swift_boots', 'storm_blade', 'blood_axe', 'great_blade'],
  // Spells and nothing else: power, then more casts.
  mira: ['spell_book', 'swift_boots', 'ancient_staff', 'arcane_orb', 'hourglass'],
  // She is there to keep casting for the team: mana, shorter cooldowns, and enough health to stay near the fight.
  elna: ['mana_gem', 'swift_boots', 'hourglass', 'arcane_orb', 'giant_heart'],

  // Dragons: no mana to spend, so nothing that gives it early.
  ignar: ['spell_book', 'swift_boots', 'arcane_orb', 'ancient_staff'],
  baru: ['swift_boots', 'giant_heart', 'guardian_plate', 'steel_armor'],
  zerak: ['swift_boots', 'war_hammer', 'blood_axe', 'guardian_plate'],
  nyx: ['swift_bow', 'swift_boots', 'storm_blade', 'blood_axe'],

  // Gods.
  sola: ['mana_gem', 'swift_boots', 'hourglass', 'arcane_orb'],
  vesper: ['swift_boots', 'great_blade', 'blood_axe', 'hourglass'],
  orun: ['swift_boots', 'giant_heart', 'guardian_plate', 'regen_core'],
  aeris: ['spell_book', 'swift_boots', 'ancient_staff', 'hourglass'],

  // Machines: Heat, not mana.
  // He fights planted in cannon mode: no boots, everything into the gun.
  bolt7: ['swift_bow', 'storm_blade', 'blood_axe', 'great_blade'],
  mekka: ['spell_book', 'swift_boots', 'hourglass', 'giant_heart'],
  raze3: ['swift_boots', 'great_blade', 'storm_blade', 'blood_axe'],
  titan9: ['swift_boots', 'guardian_plate', 'giant_heart', 'phoenix_feather'],
};

/** The build the shop recommends for a hero: its own, or its role's when it has none yet. */
export function recommendedBuild(heroId: string, role: Role): readonly string[] {
  return HERO_BUILDS[heroId] ?? BOT_BUILDS[role];
}
