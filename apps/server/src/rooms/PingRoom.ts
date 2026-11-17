import { type Client, Room } from 'colyseus';
import { TICK_RATE } from '@game/core';
import { createLogger } from '../logger.js';

const logger = createLogger('PingRoom');

/** Phase 0 connectivity check: clients join, send "ping", get "pong". Replaced by MatchRoom in phase 2. */
export class PingRoom extends Room {
  maxClients = 16;

  onCreate(): void {
    this.onMessage('ping', (client: Client) => {
      client.send('pong', { serverTime: Date.now(), tickRate: TICK_RATE, clients: this.clients.length });
    });
  }

  onJoin(client: Client): void {
    logger.log('client joined', { roomId: this.roomId, sessionId: client.sessionId });
  }

  onLeave(client: Client): void {
    logger.log('client left', { roomId: this.roomId, sessionId: client.sessionId });
  }
}
