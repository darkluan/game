import { randomBytes, randomInt } from 'node:crypto';
import { type Client, Room, ServerError } from 'colyseus';
import {
  type Command,
  HERO_IDS,
  heroSnapshot,
  type MatchWelcome,
  type PlayerSetup,
  type RosterEntry,
  Sim,
  type Team,
  TEAM_SIZE,
  teamSnapshot,
  TICK_RATE,
} from '@game/core';
import { verifyGuest } from '../auth/guest.js';
import { createLogger } from '../logger.js';

const logger = createLogger('MatchRoom');

/**
 * Only this server may create match rooms. Clients can ask the matchmaker to create any room type,
 * so creation requires a key that never leaves the process.
 */
export const INTERNAL_KEY = randomBytes(24).toString('hex');

export const matchOverChannel = (code: string): string => `match-over:${code}`;

export interface MatchOptions {
  internalKey: string;
  /** Lobby the match was started from. */
  code: string;
  players: { playerId: string; nickname: string; team: Team; heroId: string }[];
}

interface Auth {
  playerId: string;
}

const TICK_MS = 1000 / TICK_RATE;
/** After a stall, catch up at most this many ticks at once. */
const MAX_CATCH_UP_TICKS = 5;
/** How long the room lingers after the match is decided, so everyone sees the result. */
const AFTER_MATCH_MS = 30_000;
/**
 * A bot takes over a hero only after its player has been gone this long, so the moment between the
 * match starting and the player's connection arriving, or a brief network blip, changes nothing.
 */
const BOT_TAKEOVER_TICKS = TICK_RATE * 5;
/** A match nobody is connected to is abandoned after this long. */
const EMPTY_TIMEOUT_TICKS = TICK_RATE * 60;

/** Runs one match: owns the Sim, applies player commands and sends every client a snapshot per tick. */
export class MatchRoom extends Room {
  maxClients = TEAM_SIZE * 2;
  maxMessagesPerSecond = 60;
  autoDispose = false;

  private sim!: Sim;
  private code = '';
  private roster: RosterEntry[] = [];
  private readonly humans = new Set<string>();
  /** The connection currently controlling each human player's hero. */
  private readonly clientOf = new Map<string, Client>();
  /** Ticks each human player has been without a connection. */
  private readonly absentTicks = new Map<string, number>();
  private accumulator = 0;
  private emptyTicks = 0;
  private finished = false;

  async onCreate(options: MatchOptions): Promise<void> {
    if (options?.internalKey !== INTERNAL_KEY) throw new ServerError(403, 'forbidden');
    await this.setPrivate(true);
    this.code = options.code;

    const players: PlayerSetup[] = [];
    const nicknames = new Map<string, string>();
    for (const team of [0, 1] as const) {
      const humans = options.players.filter((p) => p.team === team).slice(0, TEAM_SIZE);
      const taken = new Set<string>();
      for (const p of humans) {
        const heroId =
          HERO_IDS.includes(p.heroId) && !taken.has(p.heroId) ? p.heroId : HERO_IDS.find((id) => !taken.has(id))!;
        taken.add(heroId);
        players.push({ playerId: p.playerId, team, heroId, isBot: false });
        nicknames.set(p.playerId, p.nickname);
        this.humans.add(p.playerId);
      }
      // Empty seats are filled with bots playing heroes the team does not have yet.
      for (let i = humans.length; i < TEAM_SIZE; i++) {
        const free = HERO_IDS.filter((id) => !taken.has(id));
        const heroId = free[randomInt(free.length)];
        taken.add(heroId);
        players.push({ playerId: `bot:${team}:${i}`, team, heroId, isBot: true });
      }
    }
    this.sim = new Sim({ seed: randomInt(2 ** 32), players });
    this.roster = players.map((p) => ({
      heroId: this.sim.heroOf(p.playerId)!.id,
      heroDefId: p.heroId,
      nickname: nicknames.get(p.playerId) ?? 'Bot',
      isBot: p.isBot,
      team: p.team,
    }));
    for (const playerId of this.humans) this.absentTicks.set(playerId, 0);

    this.onMessage('cmd', (client: Client, cmd: Command) => {
      // The sim validates the command itself; nothing about its shape is trusted here.
      this.sim.command((client.auth as Auth).playerId, cmd);
    });
    this.setSimulationInterval((deltaMs) => this.advance(deltaMs), TICK_MS);
    logger.log('match created', { roomId: this.roomId, code: this.code, humans: this.humans.size });
  }

  onAuth(_client: Client, options: { token?: unknown } | undefined): Auth {
    const playerId = verifyGuest(options?.token);
    if (!playerId) throw new ServerError(401, 'invalid_token');
    if (!this.humans.has(playerId)) throw new ServerError(403, 'not_in_match');
    return { playerId };
  }

  onJoin(client: Client, _options: unknown, auth: Auth): void {
    // Rejoining from another tab or after a drop takes the hero back; the old connection is closed.
    this.clientOf.get(auth.playerId)?.leave(4001);
    this.clientOf.set(auth.playerId, client);
    this.absentTicks.delete(auth.playerId);
    this.sim.setBot(auth.playerId, false);
    const welcome: MatchWelcome = { heroId: this.sim.heroOf(auth.playerId)!.id, roster: this.roster, code: this.code };
    client.send('welcome', welcome);
    logger.log('player joined', { roomId: this.roomId, sessionId: client.sessionId });
  }

  /** The connection was lost without the player choosing to leave (closed tab, network drop). */
  onDrop(client: Client): void {
    this.markAbsent(client);
  }

  onLeave(client: Client): void {
    this.markAbsent(client);
  }

  /**
   * The player is gone for now. Their hero waits, then a bot takes it over. They come back by joining
   * again with their token (the room link does that), not through a reconnection window.
   */
  private markAbsent(client: Client): void {
    const { playerId } = client.auth as Auth;
    // A replaced connection going away must not unseat the one that replaced it.
    if (this.clientOf.get(playerId) !== client) return;
    this.clientOf.delete(playerId);
    this.absentTicks.set(playerId, 0);
    logger.log('player left', { roomId: this.roomId, sessionId: client.sessionId });
  }

  onDispose(): void {
    // Also covers a match that was abandoned or crashed: the lobby must always be released.
    this.presence.publish(matchOverChannel(this.code), this.roomId);
  }

  private advance(deltaMs: number): void {
    if (this.finished) return;
    this.accumulator = Math.min(this.accumulator + deltaMs, TICK_MS * MAX_CATCH_UP_TICKS);
    while (this.accumulator >= TICK_MS && !this.finished) {
      this.accumulator -= TICK_MS;
      this.tick();
    }
  }

  private tick(): void {
    for (const [playerId, ticks] of this.absentTicks) {
      this.absentTicks.set(playerId, ticks + 1);
      if (ticks + 1 === BOT_TAKEOVER_TICKS) this.sim.setBot(playerId, true);
    }
    this.sim.step();
    // One snapshot per team: each side only receives what it can see.
    const views = [teamSnapshot(this.sim, 0), teamSnapshot(this.sim, 1)];
    for (const [playerId, client] of this.clientOf) {
      const hero = this.sim.heroOf(playerId);
      if (hero) client.send('s', heroSnapshot(this.sim, hero, views[hero.team]));
    }

    if (this.sim.winner !== null) {
      this.finished = true;
      logger.log('match decided', { roomId: this.roomId, winner: this.sim.winner, ticks: this.sim.tick });
      this.presence.publish(matchOverChannel(this.code), this.roomId);
      this.clock.setTimeout(() => void this.disconnect(), AFTER_MATCH_MS);
      return;
    }
    this.emptyTicks = this.clientOf.size === 0 ? this.emptyTicks + 1 : 0;
    if (this.emptyTicks >= EMPTY_TIMEOUT_TICKS) {
      this.finished = true;
      logger.log('match abandoned', { roomId: this.roomId });
      void this.disconnect();
    }
  }
}
