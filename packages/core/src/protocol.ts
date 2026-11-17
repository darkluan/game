import { xpToNext } from './data/balance.js';
import type { HeroEntity, Sim } from './sim/Sim.js';
import { canShop } from './systems/shop.js';
import {
  ABILITY_SLOTS,
  type Entity,
  type EntityKind,
  type Faction,
  type SimEvent,
  type StatusType,
  type Team,
  type ZoneEffect,
} from './types.js';

/**
 * What the server sends to clients and what clients send back. Shared by server and client so the
 * two cannot drift apart. Wire objects use short keys because one goes out every tick.
 */

export const FLAG_DEAD = 1;
/** Can be attacked right now (alive and not protected by a standing tower). */
export const FLAG_TARGETABLE = 2;
/** Bolt-7's fixed cannon form. */
export const FLAG_SIEGE = 4;
/** One bit per status an entity can be under. */
export const STATUS_FLAGS: Record<StatusType, number> = {
  stun: 8,
  shield: 16,
  silence: 32,
  stealth: 64,
  slow: 128,
  stone: 256,
  mark: 512,
  burn: 1024,
  root: 2048,
  blind: 4096,
  haste: 8192,
  armor: 16384,
  attack: 32768,
};

/** One entity as a client sees it. */
export interface EntitySnap {
  id: number;
  k: EntityKind;
  t: Faction;
  x: number;
  z: number;
  /** Facing, radians. */
  f: number;
  r: number;
  hp?: number;
  mhp?: number;
  /** Bit set of FLAG_* and STATUS_FLAGS. */
  fl: number;
  /** Minions only. */
  mt?: 'melee' | 'ranged';
  /** Jungle monsters only. */
  mo?: 'big' | 'small';
  /** Attack range, towers and turrets only (drawn as a ring). */
  ar?: number;
  /** Zones only: what the area does. */
  ze?: ZoneEffect;
  /** Heroes only: hero definition id, level, dragon stage and kills / deaths / assists. */
  hd?: string;
  lv?: number;
  st?: number;
  kda?: [number, number, number];
}

/** The receiving player's own hero: what only they should see. */
export interface YouSnap {
  id: number;
  mana: number;
  maxMana: number;
  /** Machines: 0..100. */
  heat: number;
  /** Machines: ticks of Overload left, 0 when not overloaded. */
  overload: number;
  /** Gods: allied minions close by. */
  followers: number;
  /** Progress to the next level, 0..1. */
  xp: number;
  gold: number;
  skillPoints: number;
  /** Per ability, in Q W E R order. */
  levels: number[];
  /** Ticks until each ability is ready again. */
  cooldowns: number[];
  /** Ticks until respawn, 0 when alive. */
  respawn: number;
  shield: number;
  items: string[];
  /** The shop is open (at the fountain, or waiting to respawn). */
  canShop: boolean;
}

export interface Snapshot {
  tick: number;
  winner: Team | null;
  entities: EntitySnap[];
  /** What happened during this tick, for effects and sound. */
  events: SimEvent[];
  you?: YouSnap;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function flagsOf(sim: Sim, e: Entity): number {
  let flags = 0;
  if (e.dead) flags |= FLAG_DEAD;
  if (sim.isTargetable(e)) flags |= FLAG_TARGETABLE;
  if (e.hero?.siege) flags |= FLAG_SIEGE;
  for (const s of e.statuses ?? []) flags |= STATUS_FLAGS[s.type];
  return flags;
}

function entitySnap(sim: Sim, e: Entity): EntitySnap {
  const snap: EntitySnap = {
    id: e.id,
    k: e.kind,
    t: e.team,
    x: round2(e.pos.x),
    z: round2(e.pos.z),
    f: round2(e.facing),
    r: round2(e.radius),
    fl: flagsOf(sim, e),
  };
  if (e.health) {
    snap.hp = Math.ceil(e.health.hp);
    snap.mhp = e.health.maxHp;
  }
  if (e.minion) snap.mt = e.minion.type;
  if (e.monster) snap.mo = e.monster.type;
  if ((e.tower || e.turret) && e.attacker) snap.ar = e.attacker.range;
  if (e.zone) snap.ze = e.zone.effect;
  if (e.hero) {
    snap.hd = e.hero.defId;
    snap.lv = e.hero.level;
    snap.st = e.hero.stage;
    snap.kda = [e.hero.kills, e.hero.deaths, e.hero.assists];
  }
  return snap;
}

/** The entity an event is about, when hiding that entity should hide the event too. */
function eventSubject(event: SimEvent): number | null {
  switch (event.t) {
    case 'damage':
    case 'heal':
      return event.targetId;
    case 'attack':
      return event.sourceId;
    case 'cast':
      return event.casterId;
    default:
      return null;
  }
}

/**
 * The match as `see` allows: pass a test that says whether an entity is visible to the receiver.
 * Without one, everything is included (tests, tools).
 */
export function snapshotOf(sim: Sim, see: (e: Entity) => boolean = () => true): Snapshot {
  const shown = new Set<number>();
  const entities: EntitySnap[] = [];
  for (const e of sim.world.entities) {
    if (!see(e)) continue;
    shown.add(e.id);
    entities.push(entitySnap(sim, e));
  }
  const events = sim.events.filter((event) => {
    const subject = eventSubject(event);
    return subject === null || shown.has(subject) || sim.get(subject) === undefined;
  });
  return { tick: sim.tick, winner: sim.winner, entities, events };
}

/** What everyone on a team sees: enemies hidden in bushes or stealth are left out. */
export function teamSnapshot(sim: Sim, team: Team): Snapshot {
  return snapshotOf(sim, (e) => sim.isVisibleTo(e, team));
}

/** The snapshot for one player: their team's view, narrowed when they are blinded, plus their own state. */
export function heroSnapshot(sim: Sim, h: HeroEntity, team: Snapshot): Snapshot {
  const base = sim.hasStatus(h, 'blind') ? snapshotOf(sim, (e) => sim.canSee(h, e)) : team;
  return { ...base, you: youSnapshotOf(sim, h) };
}

export function youSnapshotOf(sim: Sim, h: HeroEntity): YouSnap {
  const hero = h.hero;
  return {
    id: h.id,
    mana: Math.floor(hero.mana),
    maxMana: hero.maxMana,
    heat: Math.round(hero.heat),
    overload: Math.max(0, hero.overloadUntil - sim.tick),
    followers: hero.followers,
    xp: round2(hero.xp / xpToNext(hero.level)),
    gold: Math.floor(hero.gold),
    skillPoints: hero.skillPoints,
    levels: ABILITY_SLOTS.map((slot) => hero.abilityLevels[slot]),
    cooldowns: ABILITY_SLOTS.map((slot) => sim.cooldownLeft(h, slot)),
    respawn: h.dead ? Math.max(0, hero.respawnTick - sim.tick) : 0,
    shield: Math.ceil(sim.statusSum(h, 'shield')),
    items: [...hero.items],
    canShop: canShop(sim, h),
  };
}

// ---- lobby and match messages ----

export const TEAM_SIZE = 3;
export const ROOM_CODE_LENGTH = 5;
export const NICKNAME_MAX_LENGTH = 16;

export interface LobbyPlayer {
  playerId: string;
  nickname: string;
  team: Team;
  /** The hero this player picked. */
  heroId: string;
  isHost: boolean;
}

/** Sent by the lobby to everyone whenever it changes. */
export interface LobbyState {
  code: string;
  players: LobbyPlayer[];
  /** Set while a match started from this lobby is running: the room to join. */
  matchRoomId: string | null;
}

/** Who controls each hero in a match. Sent once when a client joins the match. */
export interface RosterEntry {
  /** Entity id of the hero. */
  heroId: number;
  /** Which hero it is (a key of HEROES). */
  heroDefId: string;
  nickname: string;
  isBot: boolean;
  team: Team;
}

export interface MatchWelcome {
  /** Entity id of the receiving player's hero. */
  heroId: number;
  roster: RosterEntry[];
  /** The lobby to go back to after the match. */
  code: string;
}

/** Trim and bound a nickname typed by a player. Empty when nothing usable is left. */
export function cleanNickname(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  // Drop control characters (code points below space, and DEL).
  const printable = [...raw].filter((ch) => ch >= ' ' && ch !== '\u007f').join('');
  return printable.trim().slice(0, NICKNAME_MAX_LENGTH);
}
