import { createGameServer } from './app.js';
import { config } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('server');

createGameServer()
  .listen(config.port)
  .then(() => logger.log('listening', { port: config.port }))
  .catch((err: unknown) => {
    logger.error('failed to start', err);
    process.exit(1);
  });
