import pg from 'pg';
import { DEFAULT_RATING } from '../matchmaking/rating.js';
import type { MatchRecord, MatchSummary, PlayerRecord, Store } from './store.js';

interface PlayerRow {
  id: string;
  google_id: string | null;
  nickname: string;
  mu: number;
  sigma: number;
  games_played: number;
}

const PLAYER_COLUMNS = 'id, google_id, nickname, mu, sigma, games_played';

const toPlayer = (row: PlayerRow): PlayerRecord => ({
  id: row.id,
  googleId: row.google_id,
  nickname: row.nickname,
  mu: row.mu,
  sigma: row.sigma,
  gamesPlayed: row.games_played,
});

/** PostgreSQL store. Every query is parameterised; request values never reach the SQL text. */
export class PgStore implements Store {
  readonly persistent = true;

  constructor(readonly pool: pg.Pool) {}

  async ensurePlayer(id: string): Promise<PlayerRecord> {
    // The no-op update makes RETURNING give the row whether it was just inserted or already there.
    const result = await this.pool.query<PlayerRow>(
      `INSERT INTO players (id, mu, sigma) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       RETURNING ${PLAYER_COLUMNS}`,
      [id, DEFAULT_RATING.mu, DEFAULT_RATING.sigma],
    );
    return toPlayer(result.rows[0]);
  }

  async getPlayer(id: string): Promise<PlayerRecord | null> {
    const result = await this.pool.query<PlayerRow>(`SELECT ${PLAYER_COLUMNS} FROM players WHERE id = $1`, [id]);
    return result.rows[0] ? toPlayer(result.rows[0]) : null;
  }

  async setNickname(id: string, nickname: string): Promise<void> {
    await this.pool.query('UPDATE players SET nickname = $2 WHERE id = $1', [id, nickname]);
  }

  async findByGoogleId(googleId: string): Promise<PlayerRecord | null> {
    const result = await this.pool.query<PlayerRow>(`SELECT ${PLAYER_COLUMNS} FROM players WHERE google_id = $1`, [
      googleId,
    ]);
    return result.rows[0] ? toPlayer(result.rows[0]) : null;
  }

  async linkGoogle(id: string, googleId: string): Promise<void> {
    // The unique index on google_id rejects an account that already belongs to another player.
    await this.pool.query('UPDATE players SET google_id = $2 WHERE id = $1', [id, googleId]);
  }

  async saveMatch(match: MatchRecord): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'INSERT INTO matches (id, mode, started_at, duration_s, winner_team, had_bots) VALUES ($1, $2, $3, $4, $5, $6)',
        [match.id, match.mode, match.startedAt, match.durationS, match.winnerTeam, match.hadBots],
      );
      for (const p of match.players) {
        await client.query(
          `INSERT INTO match_players
             (match_id, player_id, team, hero_id, kills, deaths, assists, mu_before, mu_after, left_early)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [match.id, p.playerId, p.team, p.heroId, p.kills, p.deaths, p.assists, p.before.mu, p.after.mu, p.leftEarly],
        );
        if (match.mode === 'ranked') {
          await client.query('UPDATE players SET mu = $2, sigma = $3, games_played = games_played + 1 WHERE id = $1', [
            p.playerId,
            p.after.mu,
            p.after.sigma,
          ]);
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async listMatches(playerId: string, page: number, limit: number): Promise<{ data: MatchSummary[]; total: number }> {
    const [rows, count] = await Promise.all([
      this.pool.query<{
        match_id: string;
        mode: 'private' | 'ranked';
        started_at: Date;
        duration_s: number;
        won: boolean;
        hero_id: string;
        kills: number;
        deaths: number;
        assists: number;
        mu_before: number;
        mu_after: number;
      }>(
        `SELECT m.id AS match_id, m.mode, m.started_at, m.duration_s, (m.winner_team = mp.team) AS won,
                mp.hero_id, mp.kills, mp.deaths, mp.assists, mp.mu_before, mp.mu_after
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
         WHERE mp.player_id = $1
         ORDER BY m.started_at DESC, m.id DESC
         LIMIT $2 OFFSET $3`,
        [playerId, limit, (page - 1) * limit],
      ),
      this.pool.query<{ total: string }>('SELECT count(*) AS total FROM match_players WHERE player_id = $1', [
        playerId,
      ]),
    ]);
    const data = rows.rows.map((r) => ({
      matchId: r.match_id,
      mode: r.mode,
      startedAt: r.started_at,
      durationS: r.duration_s,
      won: r.won,
      heroId: r.hero_id,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      muBefore: r.mu_before,
      muAfter: r.mu_after,
    }));
    return { data, total: Number(count.rows[0].total) };
  }

  async addPenalty(playerId: string, reason: string, until: Date): Promise<void> {
    await this.pool.query('INSERT INTO penalties (player_id, reason, until) VALUES ($1, $2, $3)', [
      playerId,
      reason,
      until,
    ]);
  }

  async penaltyUntil(playerId: string, now: Date): Promise<Date | null> {
    const result = await this.pool.query<{ until: Date | null }>(
      'SELECT max(until) AS until FROM penalties WHERE player_id = $1 AND until > $2',
      [playerId, now],
    );
    return result.rows[0]?.until ?? null;
  }

  async countPenaltiesSince(playerId: string, since: Date): Promise<number> {
    const result = await this.pool.query<{ total: string }>(
      'SELECT count(*) AS total FROM penalties WHERE player_id = $1 AND created_at >= $2',
      [playerId, since],
    );
    return Number(result.rows[0].total);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
