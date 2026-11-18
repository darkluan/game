import { readdir, readFile } from 'node:fs/promises';
import type pg from 'pg';
import { createLogger } from '../logger.js';

const logger = createLogger('migrate');
const MIGRATIONS_DIR = new URL('../../migrations/', import.meta.url);
/** Arbitrary constant: the advisory lock that lets only one server instance migrate at a time. */
const LOCK_KEY = 7_204_101;

/**
 * Applies the SQL files in /migrations that this database has not seen yet, in name order, each in
 * its own transaction. Shipped files are never edited: a change is a new file.
 */
export async function migrate(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_KEY]);
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const applied = new Set(
      (await client.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    for (const name of files) {
      if (applied.has(name)) continue;
      const sql = await readFile(new URL(name, MIGRATIONS_DIR), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        logger.log('applied migration', { name });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY]).catch(() => undefined);
    client.release();
  }
}
