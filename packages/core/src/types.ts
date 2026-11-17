export type Team = 0 | 1;
export type Race = 'human' | 'dragon' | 'god' | 'machine';
export type Role = 'fighter' | 'marksman' | 'mage' | 'tank' | 'assassin' | 'support';
export type AbilitySlot = 'Q' | 'W' | 'E' | 'R';
export const ABILITY_SLOTS: readonly AbilitySlot[] = ['Q', 'W', 'E', 'R'];

export interface Vec2 {
  x: number;
  z: number;
}

export type Command =
  | { t: 'move'; x: number; z: number }
  | { t: 'attack'; targetId: number }
  | { t: 'cast'; slot: AbilitySlot; x?: number; z?: number; targetId?: number }
  | { t: 'stop' }
  | { t: 'buy'; itemId: string }
  | { t: 'sell'; slotIndex: number }
  | { t: 'levelUp'; slot: AbilitySlot };

export interface AbilityDef {
  id: string;
  name: string;
  /** Per ability level. */
  cooldownTicks: number[];
  /** Mana spent, or Heat generated. Per ability level. */
  cost: number[];
  targeting: 'self' | 'unit' | 'point' | 'direction';
  range: number;
  /** Key of the handler in systems/ability. */
  effect: string;
  /** Balance numbers read by the effect handler, each per ability level. */
  params: Record<string, number[]>;
}

export interface EvolutionDef {
  level: number;
  scale: number;
}

export interface HeroDef {
  id: string;
  name: string;
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
  passive?: { effect: string; params: Record<string, number> };
  abilities: Record<AbilitySlot, AbilityDef>;
  evolutions?: EvolutionDef[];
}

export type StatusType = 'stun' | 'slow' | 'shield';

export interface Status {
  type: StatusType;
  untilTick: number;
  /** slow: fraction of speed removed (0..1). shield: damage left to absorb. */
  value: number;
}

export type HeroOrder = { t: 'idle' } | { t: 'move' } | { t: 'attack'; targetId: number };

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
  mana: number;
  maxMana: number;
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

export type EntityKind = 'hero' | 'minion' | 'tower' | 'shrine' | 'projectile';

/** ECS entity: a bag of optional components. Systems query by component presence. */
export interface Entity {
  id: number;
  kind: EntityKind;
  team: Team;
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
  minion?: { type: 'melee' | 'ranged'; laneZ: number };
  tower?: { tier: 1 | 2 };
  shrine?: true;
  projectile?: { sourceId: number; targetId: number; damage: number; speed: number };
}

export interface PlayerSetup {
  playerId: string;
  team: Team;
  heroId: string;
  isBot: boolean;
}

export type SimEvent =
  | { t: 'damage'; targetId: number; amount: number; x: number; z: number }
  | { t: 'attack'; sourceId: number; targetId: number }
  | { t: 'death'; id: number; kind: EntityKind; team: Team; killerId: number | null; x: number; z: number }
  | { t: 'cast'; casterId: number; slot: AbilitySlot; abilityId: string; x: number; z: number }
  | { t: 'levelUp'; id: number; level: number }
  | { t: 'gold'; id: number; amount: number; x: number; z: number }
  | { t: 'respawn'; id: number }
  | { t: 'gameOver'; winner: Team };
