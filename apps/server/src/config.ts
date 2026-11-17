/** The only place that reads process.env. */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

export const config = {
  port: intEnv('PORT', 2567),
  isProduction: process.env.NODE_ENV === 'production',
} as const;
