export type Team = 0 | 1;
/** Jungle monsters belong to neither team. */
export const NEUTRAL = 2;
export type Faction = Team | typeof NEUTRAL;
export type Race = 'human' | 'dragon' | 'god' | 'machine';
export type Role = 'fighter' | 'marksman' | 'mage' | 'tank' | 'assassin' | 'support';
export type AbilitySlot = 'Q' | 'W' | 'E' | 'R';
export const ABILITY_SLOTS: readonly AbilitySlot[] = ['Q', 'W', 'E', 'R'];

export interface Vec2 {
  x: number;
  z: number;
}

/** Helper spells every hero carries besides its own four abilities. */
export const SPELL_IDS = ['heal', 'flash'] as const;
export type SpellId = (typeof SPELL_IDS)[number];

export type Command =
  | { t: 'move'; x: number; z: number }
  | { t: 'attack'; targetId: number }
  /** Walk to a point, stopping to fight whatever comes within reach on the way. */
  | { t: 'attackMove'; x: number; z: number }
  | { t: 'cast'; slot: AbilitySlot; x?: number; z?: number; targetId?: number }
  | { t: 'stop' }
  | { t: 'spell'; spell: SpellId; x?: number; z?: number }
  | { t: 'recall' }
  | { t: 'buy'; itemId: string }
  | { t: 'sell'; slotIndex: number }
  | { t: 'levelUp'; slot: AbilitySlot };

/** What an ability is for; bots use it to decide when to cast. */
export type AbilityAi =
  'damage' | 'heal' | 'repair' | 'shield' | 'buff' | 'engage' | 'escape' | 'summon' | 'siege' | 'vent';

export interface AbilityDef {
  id: string;
  name: string;
  /** One line shown to the player. */
  description: string;
  /** Per ability level. */
  cooldownTicks: number[];
  /** Mana spent, or Heat generated. Per ability level. Ignored for heroes with no resource. */
  cost: number[];
  targeting: 'self' | 'unit' | 'point' | 'direction';
  range: number;
  /** Key of the handler in systems/ability. */
  effect: string;
  /** Balance numbers read by the effect handler, each per ability level. */
  params: Record<string, number[]>;
  ai: AbilityAi;
}

/** A dragon's form from a given level on. Bonuses are totals for that form, not increments. */
export interface EvolutionDef {
  level: number;
  /** Body size multiplier: bigger is easier to hit. */
  scale: number;
  hp: number;
  attack: number;
  /** Multiplier on ability damage. */
  abilityMult: number;
  /** Moves in straight lines over walls. */
  flying?: boolean;
}

export interface HeroDef {
  id: string;
  name: string;
  /** Short epithet shown under the name. */
  title: string;
  race: Race;
  role: Role;
  base: {
    hp: number;
    hpPerLevel: number;
    hpRegen: number; // per second
    mana: number;
    manaPerLevel: number;
    manaRegen: number; // per second
    attack: number;
    attackPerLevel: number;
    armor: number;
    moveSpeed: number; // units per second
    attackRange: number;
    attackInterval: number; // ticks
    projectileSpeed: number; // units per second, 0 = melee
  };
  resource: 'mana' | 'none' | 'heat';
  /** Key of the handler in systems/passives, with its balance numbers. */
  passive?: { effect: string; description: string; params: Record<string, number> };
  abilities: Record<AbilitySlot, AbilityDef>;
  evolutions?: EvolutionDef[];
}

export interface ItemStats {
  attack?: number;
  /** Fraction of extra attacks per second, e.g. 0.25. */
  attackSpeed?: number;
  armor?: number;
  hp?: number;
  hpRegen?: number;
  mana?: number;
  manaRegen?: number;
  moveSpeed?: number;
  /** Fraction of basic attack damage returned as health. */
  lifesteal?: number;
  /** Fraction of extra ability damage. */
  abilityDamage?: number;
  /** Fraction taken off cooldowns. */
  cooldownReduction?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  cost: number;
  stats: ItemStats;
}

export type StatusType =
  | 'stun'
  | 'slow'
  | 'shield'
  | 'silence'
  | 'root'
  | 'stealth'
  | 'haste'
  | 'armor'
  | 'attack'
  | 'mark'
  | 'burn'
  | 'stone'
  | 'blind';

export interface Status {
  type: StatusType;
  untilTick: number;
  /**
   * slow/haste: fraction of speed. shield: damage left to absorb. armor: flat armor.
   * attack: fraction of extra attack damage. mark: fraction of extra damage taken.
   * burn: damage per second. stone: fraction of damage ignored.
   */
  value: number;
  /** Who applied it, for kill credit on damage over time. */
  sourceId?: number;
}

export type HeroOrder =
  | { t: 'idle' }
  | { t: 'move' }
  /** `seen`: where the target last was while in sight, to go and look for it there if it slips out of sight. */
  | { t: 'attack'; targetId: number; seen?: Vec2 }
  | { t: 'attackMove'; x: number; z: number };

export interface HeroState {
  defId: string;
  playerId: string;
  isBot: boolean;
  level: number;
  xp: number;
  gold: number;
  skillPoints: number;
  abilityLevels: Record<AbilitySlot, number>;
  /** Tick at which each ability is ready again. */
  readyAt: Record<AbilitySlot, number>;
  /** Tick at which each helper spell is ready again. */
  spellReadyAt: Record<SpellId, number>;
  /** Tick at which the recall in progress brings the hero home; 0 when not recalling. */
  recallAt: number;
  mana: number;
  maxMana: number;
  /** Machines: 0..100. */
  heat: number;
  lastCastTick: number;
  /** Machines: tick at which the current Overload ends, 0 when not overloaded. */
  overloadUntil: number;
  /** Dragons: how many evolutions have happened (0..2). */
  stage: number;
  /** Gods: allied minions currently close by. */
  followers: number;
  /** Bolt-7's fixed cannon mode. */
  siege: boolean;
  items: string[];
  respawnTick: number;
  order: HeroOrder;
  kills: number;
  deaths: number;
  assists: number;
  /** Enemy heroes that damaged this hero recently, for assists. */
  recentAttackers: { id: number; tick: number }[];
  /** Last tick this hero damaged an enemy hero; towers use it to pick targets. */
  lastHeroHitTick: number;
  botRetreating: boolean;
}

export type EntityKind = 'hero' | 'minion' | 'tower' | 'shrine' | 'projectile' | 'monster' | 'zone' | 'trap' | 'turret';
export type ZoneEffect = 'burn' | 'blind';
/** The three ancient relics a team can capture. */
export type RelicType = 'thunder' | 'shield' | 'fury';
export const RELIC_TYPES: readonly RelicType[] = ['thunder', 'shield', 'fury'];

/** ECS entity: a bag of optional components. Systems query by component presence. */
export interface Entity {
  id: number;
  kind: EntityKind;
  team: Faction;
  pos: Vec2;
  radius: number;
  /** Radians, 0 = +z, grows toward +x (same as three.js rotation.y). */
  facing: number;
  dead?: boolean;
  health?: { hp: number; maxHp: number; armor: number };
  statuses?: Status[];
  mover?: { speed: number; path: Vec2[] };
  attacker?: {
    damage: number;
    range: number;
    intervalTicks: number;
    cooldown: number;
    projectileSpeed: number;
    targetId: number | null;
  };
  hero?: HeroState;
  /** 'beast' is the Ancient Beast marching with the wave of the team that slew it. */
  minion?: { type: 'melee' | 'ranged' | 'beast'; laneZ: number };
  /** `focusId`/`focusSince`: the hero it is shooting at and the tick it turned on them, for the damage that builds with every shot. */
  tower?: { tier: 1 | 2; focusId?: number; focusSince?: number };
  shrine?: true;
  projectile?: { sourceId: number; targetId: number; damage: number; speed: number };
  /** 'beast' is the Ancient Beast waiting in its cave (camp -1). */
  monster?: { type: 'big' | 'small' | 'beast'; camp: number; home: Vec2; aggroId: number | null };
  /** An area that keeps affecting units inside it until it expires. */
  zone?: { ownerId: number; effect: ZoneEffect; untilTick: number; everyTicks: number; value: number };
  trap?: { ownerId: number; untilTick: number; damage: number; rootTicks: number; markTicks: number; mark: number };
  turret?: { ownerId: number; untilTick: number };
}

export interface PlayerSetup {
  playerId: string;
  team: Team;
  heroId: string;
  isBot: boolean;
}

export type SimEvent =
  | { t: 'damage'; targetId: number; amount: number; x: number; z: number }
  | { t: 'heal'; targetId: number; amount: number; x: number; z: number }
  | { t: 'attack'; sourceId: number; targetId: number }
  | { t: 'death'; id: number; kind: EntityKind; team: Faction; killerId: number | null; x: number; z: number }
  | { t: 'cast'; casterId: number; slot: AbilitySlot; abilityId: string; x: number; z: number }
  | { t: 'levelUp'; id: number; level: number }
  | { t: 'evolve'; id: number; stage: number }
  | { t: 'overload'; id: number }
  | { t: 'gold'; id: number; amount: number; x: number; z: number }
  | { t: 'respawn'; id: number }
  /** A recall began, finished (the hero is now at its fountain) or was broken off. `x`/`z` is where the hero stood. */
  | { t: 'recall'; id: number; phase: 'start' | 'done' | 'cancel'; x: number; z: number }
  /** A helper spell was used. For Flash, `fromX`/`fromZ` is where the hero left and `x`/`z` where it landed. */
  | { t: 'spell'; casterId: number; spell: SpellId; fromX: number; fromZ: number; x: number; z: number }
  | { t: 'relicSpawn'; pedestal: number; relic: RelicType; x: number; z: number }
  | { t: 'relicCaptured'; team: Team; relic: RelicType }
  | { t: 'relicExpired'; team: Team; relic: RelicType }
  | { t: 'lightning'; x1: number; z1: number; x2: number; z2: number }
  | { t: 'beastSpawn'; x: number; z: number }
  | { t: 'beastSlain'; team: Team | null }
  | { t: 'beastMarch'; team: Team }
  | { t: 'gameOver'; winner: Team };
