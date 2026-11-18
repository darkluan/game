import type { Team } from '@game/core';
import type { Rating } from '../matchmaking/rating.js';

export interface PlayerRecord extends Rating {
  id: string;
  googleId: string | null;
  nickname: string;
  gamesPlayed: number;
}

export interface MatchPlayerRecord {
  playerId: string;
  team: Team;
  heroId: string;
  kills: number;
  deaths: number;
  assists: number;
  /** The player's rating going in, and coming out (equal when the match is not rated). */
  before: Rating;
  after: Rating;
  leftEarly: boolean;
}

export interface MatchRecord {
  id: string;
  mode: 'private' | 'ranked';
  startedAt: Date;
  durationS: number;
  winnerTeam: Team;
  hadBots: boolean;
  players: MatchPlayerRecord[];
}

/** One line of a player's history. */
export interface MatchSummary {
  matchId: string;
  mode: 'private' | 'ranked';
  startedAt: Date;
  durationS: number;
  won: boolean;
  heroId: string;
  kills: number;
  deaths: number;
  assists: number;
  muBefore: number;
  muAfter: number;
}

/** Where players, match history and penalties are kept. */
export interface Store {
  /** False when nothing survives a restart (the in-memory store). */
  readonly persistent: boolean;
  /** The player with this id, created with a starting rating when new. */
  ensurePlayer(id: string): Promise<PlayerRecord>;
  getPlayer(id: string): Promise<PlayerRecord | null>;
  setNickname(id: string, nickname: string): Promise<void>;
  findByGoogleId(googleId: string): Promise<PlayerRecord | null>;
  /** Attach a Google account to a player. Fails if that account already belongs to someone else. */
  linkGoogle(id: string, googleId: string): Promise<void>;
  /** Save a finished match and, for a ranked one, each player's new rating: all or nothing. */
  saveMatch(match: MatchRecord): Promise<void>;
  listMatches(playerId: string, page: number, limit: number): Promise<{ data: MatchSummary[]; total: number }>;
  addPenalty(playerId: string, reason: string, until: Date): Promise<void>;
  /** When the player's current queue ban ends, or null when there is none. */
  penaltyUntil(playerId: string, now: Date): Promise<Date | null>;
  countPenaltiesSince(playerId: string, since: Date): Promise<number>;
  close(): Promise<void>;
}
