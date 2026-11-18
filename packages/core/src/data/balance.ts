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
  gold: { melee: 22, ranged: 16, beast: 150 },
  xp: { melee: 40, ranged: 30, beast: 150 },
} as const;

export const TOWER = {
  hp: 2900,
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

export const SHRINE = { hp: 4500, armor: 40, radius: 2.5 } as const;

/** The helper spells: the same for every hero, free to cast, on long cooldowns. */
export const SPELLS = {
  heal: {
    cooldownTicks: seconds(75),
    /** Fraction of the hero's own maximum health restored at once. */
    healFraction: 0.2,
  },
  flash: {
    cooldownTicks: seconds(90),
    /** How far the hero jumps, walls or not. */
    range: 6,
  },
} as const;

/** Recall: stand still this long, untouched, to be carried back to the fountain. */
export const RECALL = {
  channelTicks: seconds(5),
} as const;

export const HERO = {
  radius: 0.6,
  /** Multiplies every hero's own health (base, per level and dragon form; not items), so fights last longer. */
  toughness: 1.18,
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

/** Ancient relics: every so often one pedestal lights up; the team that holds it gets a buff. */
export const RELIC = {
  firstTick: seconds(120),
  intervalTicks: seconds(120),
  /** Stand on the pedestal this long, uninterrupted, to capture. */
  captureTicks: seconds(5),
  radius: 2.2,
  buffTicks: seconds(60),
  /** Thunder: hero basic attacks arc to nearby enemies. */
  thunder: { targets: 2, range: 4.5, damagePct: 0.4 },
  /** Shield: damage absorbed by each allied minion and tower. */
  shield: { minion: 150, tower: 600 },
  /** Fury: the team's heroes deal more and take more. */
  fury: { dealt: 1.25, taken: 1.15 },
} as const;

/** The Ancient Beast: slay it in its cave and it marches with your next wave. Meant to end matches. */
export const BEAST = {
  spawnTick: seconds(7 * 60),
  /** After the marching Beast dies, a new one appears in the cave this much later. */
  respawnTicks: seconds(120),
  teamGold: 100,
  wild: { hp: 2800, attack: 60, armor: 25, range: 2.2, intervalTicks: 22, radius: 1.4, xp: 200 },
  march: {
    hp: 4500,
    attack: 140,
    armor: 35,
    range: 2.2,
    intervalTicks: 20,
    radius: 1.4,
    speed: 4.5,
    structureMult: 2.5,
  },
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
  /** Bots use the helper heal below this share of health when an enemy hero is in sight. */
  spellHealBelow: 0.4,
  /** Bots flash toward home below this share of health with an enemy hero this close. */
  spellFlashBelow: 0.2,
  spellFlashWithin: 5,
  /** Heroes that attack from no farther than this are fighters who have to close the distance. */
  meleeReach: 3,
  /** Such a bot flashes onto an enemy hero below this share of health, when it is more than this far out of reach. */
  flashEngageBelow: 0.55,
  flashEngageBeyond: 1.5,
  /** A retreating bot recalls instead of walking when home is farther than this and no enemy hero is in sight. */
  recallBeyond: 28,
  returnAbove: 0.8,
  heroSightRange: 9,
  minionSightRange: 10,
  /** Machines stop casting when the next cast would push Heat past this. */
  heatLimit: 90,
  /** Bots leave the Ancient Beast alone below this level. */
  beastLevel: 6,
} as const;
