import { xpToNext } from './data/balance.js';
import type { HeroEntity, Sim } from './sim/Sim.js';
import { ABILITY_SLOTS, type EntityKind, type SimEvent, type Team } from './types.js';

/**
 * What the server sends to clients and what clients send back. Shared by server and client so the
 * two cannot drift apart. Wire objects use short keys because one goes out every tick.
 */

export const FLAG_DEAD = 1;
export const FLAG_STUN = 2;
export const FLAG_SHIELD = 4;
/** Can be attacked right now (alive and not protected by a standing tower). */
export const FLAG_TARGETABLE = 8;

/** One entity as every client sees it. */
export interface EntitySnap {
  id: number;
  k: EntityKind;
  t: Team;
  x: number;
  z: number;
  /** Facing, radians. */
  f: number;
  r: number;
  hp?: number;
  mhp?: number;
  /** Bit set of FLAG_*. */
  fl: number;
  /** Minions only. */
  mt?: 'melee' | 'ranged';
  /** Attack range, towers only (drawn as a ring). */
  ar?: number;
  /** Heroes only: hero definition id, level and kills / deaths / assists. */
  hd?: string;
  lv?: number;
  kda?: [number, number, number];
}

/** The receiving player's own hero: what only they should see. */
export interface YouSnap {
  id: number;
  mana: number;
  maxMana: number;
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

/** The part of a snapshot that is the same for every player. */
export function snapshotOf(sim: Sim): Snapshot {
  const entities: EntitySnap[] = [];
  for (const e of sim.world.entities) {
    let flags = 0;
    if (e.dead) flags |= FLAG_DEAD;
    if (sim.hasStatus(e, 'stun')) flags |= FLAG_STUN;
    if (sim.hasStatus(e, 'shield')) flags |= FLAG_SHIELD;
    if (sim.isTargetable(e)) flags |= FLAG_TARGETABLE;
    const snap: EntitySnap = {
      id: e.id,
      k: e.kind,
      t: e.team,
      x: round2(e.pos.x),
      z: round2(e.pos.z),
      f: round2(e.facing),
      r: e.radius,
      fl: flags,
    };
    if (e.health) {
      snap.hp = Math.ceil(e.health.hp);
      snap.mhp = e.health.maxHp;
    }
    if (e.minion) snap.mt = e.minion.type;
    if (e.tower && e.attacker) snap.ar = e.attacker.range;
    if (e.hero) {
      snap.hd = e.hero.defId;
      snap.lv = e.hero.level;
      snap.kda = [e.hero.kills, e.hero.deaths, e.hero.assists];
    }
    entities.push(snap);
  }
  return { tick: sim.tick, winner: sim.winner, entities, events: sim.events };
}

export function youSnapshotOf(sim: Sim, h: HeroEntity): YouSnap {
  const hero = h.hero;
  return {
    id: h.id,
    mana: Math.floor(hero.mana),
    maxMana: hero.maxMana,
    xp: round2(hero.xp / xpToNext(hero.level)),
    gold: Math.floor(hero.gold),
    skillPoints: hero.skillPoints,
    levels: ABILITY_SLOTS.map((slot) => hero.abilityLevels[slot]),
    cooldowns: ABILITY_SLOTS.map((slot) => sim.cooldownLeft(h, slot)),
    respawn: h.dead ? Math.max(0, hero.respawnTick - sim.tick) : 0,
    shield: Math.ceil(h.statuses.reduce((sum, s) => (s.type === 'shield' ? sum + s.value : sum), 0)),
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
