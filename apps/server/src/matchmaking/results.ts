import { randomUUID } from 'node:crypto';
import type { Team } from '@game/core';
import { config } from '../config.js';
import type { MatchRecord, Store } from '../db/store.js';
import { BOT_MATCH_FACTOR, mmrOf, rateMatch, type Rating } from './rating.js';

export interface FinishedPlayer {
  playerId: string;
  team: Team;
  heroId: string;
  kills: number;
  deaths: number;
  assists: number;
  /** Was gone when the match ended, with a bot playing their hero. */
  leftEarly: boolean;
}

export interface FinishedMatch {
  mode: 'private' | 'ranked';
  startedAt: Date;
  durationS: number;
  winner: Team;
  /** Seats per team, to know how many were bots. */
  teamSize: number;
  players: FinishedPlayer[];
}

export interface PlayerOutcome {
  mmrBefore: number;
  mmrAfter: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Bans a player who left a ranked match from the queue: longer for each offence within a day. */
export async function penalizeLeaver(store: Store, playerId: string, now = new Date()): Promise<Date> {
  const earlier = await store.countPenaltiesSince(playerId, new Date(now.getTime() - DAY_MS));
  const steps = config.leaverPenaltyMinutes;
  const until = new Date(now.getTime() + steps[Math.min(earlier, steps.length - 1)] * 60_000);
  await store.addPenalty(playerId, 'left_match', until);
  return until;
}

/**
 * Saves a finished match. A ranked match also moves every player's rating (by less when bots took
 * part) and bans the players who left. Returns each player's MMR before and after.
 */
export async function recordMatch(store: Store, match: FinishedMatch): Promise<Map<string, PlayerOutcome>> {
  const ratings = new Map<string, Rating>();
  for (const p of match.players) {
    const { mu, sigma } = await store.ensurePlayer(p.playerId);
    ratings.set(p.playerId, { mu, sigma });
  }
  const hadBots = match.players.length < match.teamSize * 2;
  const after = new Map(ratings);

  if (match.mode === 'ranked' && match.players.length > 0) {
    // A bot is rated as the average human of the match, so it neither helps nor hurts the estimate.
    const all = [...ratings.values()];
    const bot: Rating = {
      mu: all.reduce((sum, r) => sum + r.mu, 0) / all.length,
      sigma: all.reduce((sum, r) => sum + r.sigma, 0) / all.length,
    };
    const teams = ([0, 1] as const).map((team) => {
      const humans = match.players.filter((p) => p.team === team);
      const bots = Array.from({ length: Math.max(0, match.teamSize - humans.length) }, () => bot);
      return { humans, ratings: [...humans.map((p) => ratings.get(p.playerId)!), ...bots] };
    });
    const rated = rateMatch([teams[0].ratings, teams[1].ratings], match.winner, hadBots ? BOT_MATCH_FACTOR : 1);
    teams.forEach((team, t) => team.humans.forEach((p, i) => after.set(p.playerId, rated[t][i])));
  }

  const record: MatchRecord = {
    id: randomUUID(),
    mode: match.mode,
    startedAt: match.startedAt,
    durationS: match.durationS,
    winnerTeam: match.winner,
    hadBots,
    players: match.players.map((p) => ({ ...p, before: ratings.get(p.playerId)!, after: after.get(p.playerId)! })),
  };
  await store.saveMatch(record);
  if (match.mode === 'ranked') {
    for (const p of match.players) if (p.leftEarly) await penalizeLeaver(store, p.playerId);
  }
  return new Map(
    match.players.map((p) => [
      p.playerId,
      { mmrBefore: mmrOf(ratings.get(p.playerId)!), mmrAfter: mmrOf(after.get(p.playerId)!) },
    ]),
  );
}
