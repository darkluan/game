import { randomInt } from 'node:crypto';
import { type Client, matchMaker, Room, ServerError } from 'colyseus';
import { cleanNickname, type LobbyState, ROOM_CODE_LENGTH, TEAM_SIZE } from '@game/core';
import { verifyGuest } from '../auth/guest.js';
import { createLogger } from '../logger.js';
import { LobbyRoster } from './lobbyRoster.js';
import { INTERNAL_KEY, matchOverChannel, type MatchOptions } from './MatchRoom.js';

const logger = createLogger('LobbyRoom');

/** No 0/O, 1/I/L: codes get read aloud and typed by hand. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

interface Auth {
  playerId: string;
}

/**
 * A private room behind a share link. Its room id is the 5-character code in the link, so
 * "join by id" is "open the link". The host starts a match; while it runs the lobby stays alive
 * so the link keeps working for players who dropped and come back.
 */
export class LobbyRoom extends Room {
  maxClients = TEAM_SIZE * 2;
  maxMessagesPerSecond = 20;

  private readonly roster = new LobbyRoster();
  /** The connection currently speaking for each player. */
  private readonly clientOf = new Map<string, Client>();
  private matchRoomId: string | null = null;

  async onCreate(): Promise<void> {
    let code = randomCode();
    while (await matchMaker.getRoomById(code)) code = randomCode();
    this.roomId = code;
    await this.setPrivate(true);

    this.onMessage('team', (client: Client, team: unknown) => {
      const { playerId } = client.auth as Auth;
      if (this.matchRoomId === null && this.roster.setTeam(playerId, team as 0 | 1)) this.broadcastState();
    });
    this.onMessage('start', (client: Client) => {
      const { playerId } = client.auth as Auth;
      if (this.matchRoomId !== null || !this.roster.isHost(playerId)) return;
      void this.startMatch();
    });
    this.presence.subscribe(matchOverChannel(code), () => this.onMatchOver());
    logger.log('lobby created', { code });
  }

  onAuth(_client: Client, options: { token?: unknown } | undefined): Auth {
    const playerId = verifyGuest(options?.token);
    if (!playerId) throw new ServerError(401, 'invalid_token');
    return { playerId };
  }

  onJoin(client: Client, options: { nickname?: unknown } | undefined, auth: Auth): void {
    const nickname = cleanNickname(options?.nickname) || 'Khách';
    if (!this.roster.add(auth.playerId, nickname)) throw new ServerError(409, 'lobby_full');
    // The same player in a second tab takes over; the first tab is dropped.
    this.clientOf.get(auth.playerId)?.leave(4001);
    this.clientOf.set(auth.playerId, client);
    this.broadcastState();
  }

  /** The connection was lost without the player choosing to leave (closed tab, network drop). */
  onDrop(client: Client): void {
    this.removePlayer(client);
  }

  onLeave(client: Client): void {
    this.removePlayer(client);
  }

  private removePlayer(client: Client): void {
    const { playerId } = client.auth as Auth;
    // A replaced tab leaving must not remove the player its replacement now speaks for.
    if (this.clientOf.get(playerId) !== client) return;
    this.clientOf.delete(playerId);
    this.roster.remove(playerId);
    this.broadcastState();
  }

  onDispose(): void {
    this.presence.unsubscribe(matchOverChannel(this.roomId));
  }

  private broadcastState(): void {
    const state: LobbyState = { code: this.roomId, players: this.roster.list(), matchRoomId: this.matchRoomId };
    this.broadcast('lobby', state);
  }

  private async startMatch(): Promise<void> {
    const options: MatchOptions = {
      internalKey: INTERNAL_KEY,
      code: this.roomId,
      players: this.roster.list().map(({ playerId, nickname, team }) => ({ playerId, nickname, team })),
    };
    // Players leave the lobby to join the match; it must outlive them so the link still works.
    this.autoDispose = false;
    try {
      const room = await matchMaker.createRoom('match', options);
      this.matchRoomId = room.roomId;
      logger.log('match started', { code: this.roomId, matchRoomId: room.roomId, players: options.players.length });
    } catch (err) {
      this.autoDispose = true;
      logger.error('could not start match', err, { code: this.roomId });
    }
    this.broadcastState();
  }

  private onMatchOver(): void {
    if (this.matchRoomId === null) return;
    this.matchRoomId = null;
    this.autoDispose = true;
    logger.log('match over', { code: this.roomId });
    if (this.clients.length === 0) void this.disconnect();
    else this.broadcastState();
  }
}
