/** Every balance number lives here, in heroes.ts, items.ts or races/. All values are starting points to tune by playtest. */

export const TICK_RATE = 20;
export const seconds = (s: number): number => Math.round(s * TICK_RATE);

export const MAX_LEVEL = 12;
export const ULT_UNLOCK_LEVELS = [4, 8, 12];
export const xpToNext = (level: number): number => 50 + 40 * level;

export const MINION = {
  waveIntervalTicks: seconds(20),
  firstWaveTick: seconds(5),
  meleePerWave: 3,
  rangedPerWave: 2,
  aggroRange: 8,
  speed: 4.5,
  melee: { hp: 320, attack: 14, armor: 10, range: 1.4, intervalTicks: 20, projectileSpeed: 0, radius: 0.5 },
  ranged: { hp: 200, attack: 22, armor: 0, range: 6.5, intervalTicks: 24, projectileSpeed: 16, radius: 0.45 },
  gold: { melee: 22, ranged: 16 },
  xp: { melee: 40, ranged: 30 },
} as const;

export const TOWER = {
  hp: 2200,
  armor: 40,
  attack: 95,
  range: 9,
  intervalTicks: 20,
  projectileSpeed: 22,
  radius: 1.5,
  /** A hero that hit an allied hero this recently becomes the tower's priority. */
  heroAggroTicks: seconds(2),
  goldPerEnemyHero: 120,
} as const;

export const SHRINE = { hp: 3500, armor: 40, radius: 2.5 } as const;

export const HERO = {
  radius: 0.6,
  /** Idle heroes pick a fight with enemies this far beyond their attack range. */
  idleAcquireBonus: 3,
  respawnBaseTicks: seconds(5),
  respawnPerLevelTicks: seconds(2),
  passiveGoldPerSecond: 2,
  killGold: 200,
  assistGold: 60,
  assistWindowTicks: seconds(10),
  killXpBase: 100,
  killXpPerLevel: 20,
  xpShareRange: 14,
  fountainRadius: 6,
  /** Fraction of max hp / mana restored per second at the own fountain. */
  fountainRegen: 0.12,
  maxCooldownReduction: 0.4,
} as const;

export const SHOP = {
  /** Items in the bag for every race except human (see races/). */
  slots: 4,
  /** Fraction of the price paid back when selling. */
  sellRefund: 0.5,
} as const;

export const JUNGLE = {
  firstSpawnTick: seconds(15),
  respawnTicks: seconds(60),
  /** Monsters give up and walk home when dragged this far from their camp. */
  leash: 9,
  speed: 5,
  /** Fraction of max hp regained per second while walking home. */
  homeRegen: 0.25,
  big: { hp: 900, attack: 40, armor: 15, range: 1.7, intervalTicks: 24, radius: 0.9, gold: 60, xp: 90 },
  small: { hp: 350, attack: 18, armor: 5, range: 1.4, intervalTicks: 22, radius: 0.5, gold: 20, xp: 35 },
} as const;

export const VISION = {
  /** A stealthed or trapped-in-bush enemy this close is seen anyway. */
  revealRange: 3,
  /** How far a blinded hero can see enemies. */
  blindRange: 4,
  /** Traps are invisible to enemies farther than this. */
  trapRevealRange: 2,
} as const;

export const BOT = {
  thinkTicks: 5,
  retreatBelow: 0.3,
  returnAbove: 0.8,
  heroSightRange: 9,
  minionSightRange: 10,
  /** Machines stop casting when the next cast would push Heat past this. */
  heatLimit: 90,
} as const;
