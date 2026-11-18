import { DEFAULT_RATING } from '../matchmaking/rating.js';
import type { MatchRecord, MatchSummary, PlayerRecord, Store } from './store.js';

/** Keeps everything in memory. For development and tests: all of it is lost when the server stops. */
export class MemoryStore implements Store {
  readonly persistent = false;
  private readonly players = new Map<string, PlayerRecord>();
  private readonly matches: MatchRecord[] = [];
  private readonly penalties: { playerId: string; reason: string; until: Date; createdAt: Date }[] = [];

  async ensurePlayer(id: string): Promise<PlayerRecord> {
    let player = this.players.get(id);
    if (!player) {
      player = { id, googleId: null, nickname: '', gamesPlayed: 0, ...DEFAULT_RATING };
      this.players.set(id, player);
    }
    return { ...player };
  }

  async getPlayer(id: string): Promise<PlayerRecord | null> {
    const player = this.players.get(id);
    return player ? { ...player } : null;
  }

  async setNickname(id: string, nickname: string): Promise<void> {
    const player = this.players.get(id);
    if (player) player.nickname = nickname;
  }

  async findByGoogleId(googleId: string): Promise<PlayerRecord | null> {
    for (const player of this.players.values()) if (player.googleId === googleId) return { ...player };
    return null;
  }

  async linkGoogle(id: string, googleId: string): Promise<void> {
    const owner = await this.findByGoogleId(googleId);
    if (owner && owner.id !== id) throw new Error('google account already linked');
    const player = this.players.get(id);
    if (player) player.googleId = googleId;
  }

  async saveMatch(match: MatchRecord): Promise<void> {
    this.matches.push(match);
    if (match.mode !== 'ranked') return;
    for (const p of match.players) {
      const player = this.players.get(p.playerId);
      if (!player) continue;
      player.mu = p.after.mu;
      player.sigma = p.after.sigma;
      player.gamesPlayed++;
    }
  }

  async listMatches(playerId: string, page: number, limit: number): Promise<{ data: MatchSummary[]; total: number }> {
    const mine = this.matches
      .flatMap((m) => m.players.filter((p) => p.playerId === playerId).map((p) => ({ m, p })))
      .sort((a, b) => b.m.startedAt.getTime() - a.m.startedAt.getTime() || b.m.id.localeCompare(a.m.id));
    const data = mine.slice((page - 1) * limit, page * limit).map(({ m, p }) => ({
      matchId: m.id,
      mode: m.mode,
      startedAt: m.startedAt,
      durationS: m.durationS,
      won: m.winnerTeam === p.team,
      heroId: p.heroId,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      muBefore: p.before.mu,
      muAfter: p.after.mu,
    }));
    return { data, total: mine.length };
  }

  async addPenalty(playerId: string, reason: string, until: Date): Promise<void> {
    this.penalties.push({ playerId, reason, until, createdAt: new Date() });
  }

  async penaltyUntil(playerId: string, now: Date): Promise<Date | null> {
    const active = this.penalties.filter((p) => p.playerId === playerId && p.until > now).map((p) => p.until.getTime());
    return active.length > 0 ? new Date(Math.max(...active)) : null;
  }

  async countPenaltiesSince(playerId: string, since: Date): Promise<number> {
    return this.penalties.filter((p) => p.playerId === playerId && p.createdAt >= since).length;
  }

  async close(): Promise<void> {}
}
