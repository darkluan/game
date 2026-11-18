import type {
  AbilityDef,
  AbilitySlot,
  Command,
  EntityKind,
  Faction,
  MapDef,
  Race,
  RelicType,
  StatusType,
  Team,
  Vec2,
  ZoneEffect,
} from '@game/core';

export interface AbilityHud {
  slot: AbilitySlot;
  name: string;
  description: string;
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
  heroName: string;
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
  heroDefId: string;
  heroName: string;
  race: Race;
  team: Team;
  hp: number;
  maxHp: number;
  shield: number;
  resource: 'mana' | 'heat' | 'none';
  mana: number;
  maxMana: number;
  heat: number;
  /** Seconds of Overload left, 0 when not overloaded. */
  overloadSeconds: number;
  /** Dragons: evolutions so far. */
  stage: number;
  /** Gods: allied minions close by. */
  followers: number;
  level: number;
  xpFraction: number;
  gold: number;
  skillPoints: number;
  dead: boolean;
  respawnSeconds: number;
  /** Labels of the conditions the hero is under, for display. */
  conditions: string[];
  abilities: AbilityHud[];
  items: string[];
  itemSlots: number;
  canShop: boolean;
  /** The lit relic pedestal, if any. `mine` is whether the player's team is the one capturing. */
  relic: { type: RelicType; capturing: 'mine' | 'enemy' | null; progress: number } | null;
  /** Relic buffs in effect, the player's team first. */
  buffs: { type: RelicType; mine: boolean; seconds: number }[];
  /** Recent events worth telling the player about, oldest first. */
  announcements: Announcement[];
  scores: HeroScore[];
  winner: Team | null;
}

export interface Announcement {
  id: number;
  text: string;
  /** Good news for the player's team, bad news, or neither. */
  tone: 'good' | 'bad' | 'neutral';
  at: number; // seconds on the session clock
}

/** Match-wide state that is not an entity. */
export interface WorldView {
  relic: { pedestal: number; type: RelicType; team: Team | null; progress: number } | null;
  buffs: ({ relic: RelicType; left: number } | null)[];
}

export type FxColor = 'ally' | 'enemy' | 'gold' | 'neutral' | 'heal';

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

/**
 * An entity as the scene needs it. The offline game hands out the sim's own entities, which have
 * these fields and more; the online game builds these from server snapshots.
 */
export interface ViewEntity {
  id: number;
  kind: EntityKind;
  team: Faction;
  pos: Vec2;
  radius: number;
  /** Radians, 0 = +z, grows toward +x. */
  facing: number;
  dead?: boolean;
  health?: { hp: number; maxHp: number };
  minion?: { type: 'melee' | 'ranged' | 'beast' };
  monster?: { type: 'big' | 'small' | 'beast' };
  zone?: { effect: ZoneEffect };
  attacker?: { range: number };
  hero?: { defId: string; stage: number };
}
export type UnitView = ViewEntity & Required<Pick<ViewEntity, 'health'>>;
export type MinionView = UnitView & Required<Pick<ViewEntity, 'minion'>>;
export type MonsterView = UnitView & Required<Pick<ViewEntity, 'monster'>>;

/** A hero taking part in the match. The list never changes, even while a hero is out of sight. */
export interface RosterHero {
  id: number;
  team: Team;
  defId: string;
}

/**
 * What the scene, HUD and input need from a running match. The offline game implements it on top of a
 * local Sim; the online game implements it on top of server snapshots.
 * Every list holds only what the player can currently see.
 */
export interface GameSession {
  /** Identifies the match; the scene remounts when it changes. */
  readonly seed: number;
  readonly map: MapDef;
  /** The player's own hero. */
  readonly hero: ViewEntity;
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

  roster(): readonly RosterHero[];
  /** The relic in play and the teams' relic buffs. */
  world(): WorldView;
  /** The entity with this id, when it exists and the player can see it. */
  find(id: number): ViewEntity | undefined;
  heroes(): readonly ViewEntity[];
  minions(): readonly MinionView[];
  monsters(): readonly MonsterView[];
  projectiles(): readonly ViewEntity[];
  /** Fire and darkness on the ground. */
  zones(): readonly ViewEntity[];
  /** Turrets and traps. */
  summons(): readonly ViewEntity[];
  units(): readonly UnitView[];
  /** Towers and shrines present when the scene was built. */
  buildings(): readonly ViewEntity[];
  exists(id: number): boolean;
  hasStatus(e: ViewEntity, type: StatusType): boolean;
  /** Bolt-7's fixed cannon form. */
  isSiege(e: ViewEntity): boolean;
  ability(slot: AbilitySlot): AbilityDef;

  /** Interpolated position of an entity for this frame. */
  renderPos(e: ViewEntity, out: Vec2): Vec2;
  isMoving(e: ViewEntity): boolean;
  lastAction(id: number): ActorAction | undefined;
  /** The enemy closest to a ground point, within a forgiving click distance. */
  pickEnemy(at: Vec2, slack?: number): ViewEntity | null;
  /** The enemy closest to the player's hero within range. */
  nearestEnemy(range: number): ViewEntity | null;
}
