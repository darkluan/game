import { defineRoom, defineServer, WebSocketTransport } from 'colyseus';
import { issueGuest } from './auth/guest.js';
import { LobbyRoom } from './rooms/LobbyRoom.js';
import { MatchRoom } from './rooms/MatchRoom.js';
import { PingRoom } from './rooms/PingRoom.js';

/** The game server, not yet listening. */
export function createGameServer() {
  return defineServer({
    rooms: {
      ping: defineRoom(PingRoom),
      lobby: defineRoom(LobbyRoom),
      match: defineRoom(MatchRoom),
    },
    greet: false,
    // A closed tab or dead connection is noticed within about 3 seconds instead of the default 9,
    // so a bot can stand in for a dropped player sooner.
    transport: new WebSocketTransport({ pingInterval: 1000, pingMaxRetries: 2 }),
    express: (app) => {
      app.get('/healthcheck', (_req, res) => {
        res.json(true);
      });
      // A new guest identity. Takes no input: the token is the only thing the client needs to keep.
      app.post('/v1/guests', (_req, res) => {
        res.status(201).json(issueGuest());
      });
    },
  });
}
