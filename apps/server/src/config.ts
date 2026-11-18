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
  /** Empty: no database. Players and match history then live in memory, and ranked play is off in production. */
  databaseUrl: process.env.DATABASE_URL ?? '',
  /** Empty: Google sign-in is off. */
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  matchmaking: {
    /** How often the queue is scanned for a match. */
    scanMs: intEnv('MATCH_SCAN_MS', 1000),
    /** A player first accepts opponents within this many MMR. */
    rangeStart: intEnv('MATCH_RANGE_START', 100),
    /** The range grows by this much every `rangeStepSeconds` of waiting. */
    rangeStep: intEnv('MATCH_RANGE_STEP', 50),
    rangeStepSeconds: intEnv('MATCH_RANGE_STEP_SECONDS', 10),
    /** After waiting this long, empty seats are filled with bots. */
    botFillSeconds: intEnv('MATCH_BOT_FILL_SECONDS', 30),
    acceptSeconds: intEnv('MATCH_ACCEPT_SECONDS', 15),
    draftSeconds: intEnv('MATCH_DRAFT_SECONDS', 30),
  },
  /** Queue bans for leaving a ranked match: first, second and later offences within a day. */
  leaverPenaltyMinutes: [5, 15, 60],
} as const;
