import type {
  AbilityDef,
  AbilitySlot,
  Command,
  Entity,
  HeroEntity,
  MapDef,
  StatusType,
  Team,
  UnitEntity,
  Vec2,
} from '@game/core';

export interface AbilityHud {
  slot: AbilitySlot;
  name: string;
  level: number;
  cost: number;
  cooldownLeft: number; // seconds
  cooldownFraction: number; // 1 = just cast, 0 = ready
  canLevelUp: boolean;
  usable: boolean;
}

export interface HeroScore {
  id: number;
  name: string;
  team: Team;
  isPlayer: boolean;
  level: number;
  kills: number;
  deaths: number;
  assists: number;
}

/** Everything the HUD shows, rebuilt once per tick. */
export interface HudState {
  timeSeconds: number;
  heroName: string;
  team: Team;
  hp: number;
  maxHp: number;
  shield: number;
  mana: number;
  maxMana: number;
  level: number;
  xpFraction: number;
  gold: number;
  skillPoints: number;
  dead: boolean;
  respawnSeconds: number;
  stunned: boolean;
  abilities: AbilityHud[];
  scores: HeroScore[];
  winner: Team | null;
}

export type FxColor = 'ally' | 'enemy' | 'gold' | 'neutral';

/** One-shot visual; the scene draws it and the session expires it. */
export interface Fx {
  kind: 'ring' | 'disc' | 'line' | 'text';
  x: number;
  z: number;
  /** ring/disc: radius. line: width. */
  radius: number;
  /** line only: the far end. */
  x2?: number;
  z2?: number;
  color: FxColor;
  text?: string;
  bornAt: number; // seconds on the session clock
  duration: number;
}

/** The latest attack or cast of a unit, so the scene can play the matching animation once. */
export interface ActorAction {
  kind: 'attack' | AbilitySlot;
  at: number; // seconds on the session clock
}

export type SoundCue =
  | 'hit'
  | 'tower'
  | 'castQ'
  | 'castW'
  | 'castE'
  | 'castR'
  | 'heroDeath'
  | 'structureDown'
  | 'gold'
  | 'levelUp'
  | 'matchStart'
  | 'victory'
  | 'defeat';

export type MinionEntity = Entity & Required<Pick<Entity, 'minion' | 'health' | 'attacker'>>;

/**
 * What the scene, HUD and input need from a running match. The offline game implements it on top of a
 * local Sim; the online game (phase 2) will implement it on top of server state, with no scene changes.
 */
export interface GameSession {
  /** Identifies the match; the scene remounts when it changes. */
  readonly seed: number;
  readonly map: MapDef;
  /** The player's own hero. */
  readonly hero: HeroEntity;
  /** Ground point under the mouse. */
  readonly cursor: Vec2;
  /** Seconds of game time including the partial tick, for animating. */
  readonly clock: number;
  readonly fx: readonly Fx[];
  /** The camera shakes until the clock passes this. */
  readonly shakeUntil: number;

  /** Advance by real elapsed seconds. Returns true when game state changed. */
  update(deltaSeconds: number): boolean;
  send(cmd: Command): void;
  setCursor(x: number, z: number): void;
  addFx(fx: Omit<Fx, 'bornAt'>): void;
  hud(): HudState;

  heroes(): readonly HeroEntity[];
  minions(): Iterable<MinionEntity>;
  projectiles(): Iterable<Entity>;
  units(): Iterable<UnitEntity>;
  /** Towers and shrines present at the start of the match. */
  buildings(): readonly Entity[];
  exists(id: number): boolean;
  hasStatus(e: Entity, type: StatusType): boolean;
  ability(slot: AbilitySlot): AbilityDef;

  /** Interpolated position of an entity for this frame. */
  renderPos(e: Entity, out: Vec2): Vec2;
  isMoving(e: Entity): boolean;
  lastAction(id: number): ActorAction | undefined;
  /** The enemy closest to a ground point, within a forgiving click distance. */
  pickEnemy(at: Vec2, slack?: number): Entity | null;
  /** The enemy closest to the player's hero within range. */
  nearestEnemy(range: number): Entity | null;
}
