/** Every balance number lives here or in heroes.ts. All values are starting points to tune by playtest. */

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
} as const;

export const BOT = {
  thinkTicks: 5,
  retreatBelow: 0.3,
  returnAbove: 0.8,
  heroSightRange: 8,
  minionSightRange: 10,
} as const;
