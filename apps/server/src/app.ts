import { defineRoom, defineServer, matchMaker, WebSocketTransport } from 'colyseus';
import { type GoogleVerifier, verifyGoogleCredential } from './auth/google.js';
import { config } from './config.js';
import { corsHeadersFor } from './cors.js';
import { registerRoutes } from './http/routes.js';
import { LobbyRoom } from './rooms/LobbyRoom.js';
import { MatchRoom } from './rooms/MatchRoom.js';
import { PingRoom } from './rooms/PingRoom.js';
import { QueueRoom } from './rooms/QueueRoom.js';

/** The game server, not yet listening. */
export function createGameServer(verifyGoogle: GoogleVerifier = verifyGoogleCredential) {
  // Colyseus answers every HTTP route (matchmaking and ours) with these headers.
  matchMaker.controller.getCorsHeaders = (headers) =>
    corsHeadersFor(headers.get('origin'), config.corsAllowedOrigins, config.isProduction);
  return defineServer({
    rooms: {
      ping: defineRoom(PingRoom),
      lobby: defineRoom(LobbyRoom),
      match: defineRoom(MatchRoom),
      queue: defineRoom(QueueRoom),
    },
    greet: false,
    // A closed tab or dead connection is noticed within about 3 seconds instead of the default 9,
    // so a bot can stand in for a dropped player sooner.
    transport: new WebSocketTransport({ pingInterval: 1000, pingMaxRetries: 2 }),
    express: (app) => registerRoutes(app, verifyGoogle),
  });
}
