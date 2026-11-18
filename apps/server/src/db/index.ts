import pg from 'pg';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { MemoryStore } from './memoryStore.js';
import { migrate } from './migrate.js';
import { PgStore } from './pgStore.js';
import type { Store } from './store.js';

const logger = createLogger('db');
let store: Store = new MemoryStore();

/** The store the server is using. In-memory until `initStore` has connected to a database. */
export function getStore(): Store {
  return store;
}

/** For tests: swap the store. */
export function setStore(next: Store): void {
  store = next;
}

/** Connects to PostgreSQL and applies migrations when DATABASE_URL is set; otherwise stays in memory. */
export async function initStore(): Promise<Store> {
  if (!config.databaseUrl) {
    logger.warn('DATABASE_URL is not set: players and match history are kept in memory only');
    return store;
  }
  const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
  pool.on('error', (err) => logger.error('idle database connection failed', err));
  await migrate(pool);
  store = new PgStore(pool);
  logger.log('database ready');
  return store;
}

/** Ranked play needs ratings that survive a restart, so production requires a real database for it. */
export function rankedAvailable(): boolean {
  return store.persistent || !config.isProduction;
}
