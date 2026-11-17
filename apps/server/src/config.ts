/** The only place that reads process.env. */

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

function tokenSecret(): string {
  const secret = process.env.TOKEN_SECRET ?? '';
  if (secret.length >= 32) return secret;
  // Guest tokens are only as trustworthy as this secret, so production must set a real one.
  if (isProduction) throw new Error('TOKEN_SECRET must be set to at least 32 characters in production');
  return 'dev-only-secret-not-for-production-use';
}

/** Comma-separated list of exact origins, e.g. "https://a.example,https://b.example". */
function listEnv(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export const config = {
  port: intEnv('PORT', 2567),
  isProduction,
  tokenSecret: tokenSecret(),
  corsAllowedOrigins: listEnv('CORS_ALLOWED_ORIGINS'),
} as const;
