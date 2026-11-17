import { defineRoom, defineServer } from 'colyseus';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { PingRoom } from './rooms/PingRoom.js';

const logger = createLogger('server');

const server = defineServer({
  rooms: { ping: defineRoom(PingRoom) },
  greet: false,
  express: (app) => {
    app.get('/healthcheck', (_req, res) => {
      res.json(true);
    });
  },
});

server
  .listen(config.port)
  .then(() => logger.log('listening', { port: config.port }))
  .catch((err: unknown) => {
    logger.error('failed to start', err);
    process.exit(1);
  });
