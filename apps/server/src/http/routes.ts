import express, { type Application, type Request, type RequestHandler, type Response } from 'express';
import type { Profile } from '@game/core';
import { type GoogleVerifier, InvalidGoogleCredential } from '../auth/google.js';
import { issueGuest, tokenFor, verifyGuest } from '../auth/guest.js';
import { config } from '../config.js';
import { getStore, rankedAvailable } from '../db/index.js';
import type { PlayerRecord } from '../db/store.js';
import { createLogger } from '../logger.js';
import { mmrOf } from '../matchmaking/rating.js';

const logger = createLogger('http');
const MAX_PAGE_SIZE = 50;

function sendError(req: Request, res: Response, status: number, message: string, reason?: string): void {
  res.status(status).json({ code: status, timestamp: new Date().toISOString(), path: req.path, message, reason });
}

/** Runs a handler; anything it throws becomes a generic 500 with the detail in the log only. */
const safely =
  (handler: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res) => {
    handler(req, res).catch((err: unknown) => {
      logger.error('request failed', err, { path: req.path });
      if (!res.headersSent) sendError(req, res, 500, 'Internal server error');
    });
  };

/** The player a request's bearer token proves, or null after answering 401. */
function authenticate(req: Request, res: Response): string | null {
  const header = req.get('authorization') ?? '';
  const playerId = header.startsWith('Bearer ') ? verifyGuest(header.slice(7)) : null;
  if (!playerId) {
    res.set('WWW-Authenticate', 'Bearer error="invalid_token"');
    sendError(req, res, 401, 'Invalid or missing token', 'invalid_token');
  }
  return playerId;
}

export async function profileOf(player: PlayerRecord): Promise<Profile> {
  const penalty = await getStore().penaltyUntil(player.id, new Date());
  return {
    playerId: player.id,
    nickname: player.nickname,
    mmr: mmrOf(player),
    gamesPlayed: player.gamesPlayed,
    google: player.googleId !== null,
    penaltyUntil: penalty ? penalty.toISOString() : null,
  };
}

function intQuery(value: unknown, fallback: number, max: number): number {
  const n = typeof value === 'string' ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
}

export function registerRoutes(app: Application, verifyGoogle: GoogleVerifier): void {
  const json = express.json({ limit: '10kb' });

  app.get('/healthcheck', (_req, res) => {
    res.json(true);
  });

  /** What this server offers, so the client knows which buttons to show. */
  app.get('/v1/config', (_req, res) => {
    res.json({ ranked: rankedAvailable(), googleClientId: config.googleClientId || null });
  });

  /** A new guest identity. Takes no input: the token is the only thing the client needs to keep. */
  app.post(
    '/v1/guests',
    safely(async (_req, res) => {
      const guest = issueGuest();
      await getStore().ensurePlayer(guest.playerId);
      res.status(201).json(guest);
    }),
  );

  app.get(
    '/v1/me',
    safely(async (req, res) => {
      const playerId = authenticate(req, res);
      if (!playerId) return;
      res.json(await profileOf(await getStore().ensurePlayer(playerId)));
    }),
  );

  app.get(
    '/v1/me/matches',
    safely(async (req, res) => {
      const playerId = authenticate(req, res);
      if (!playerId) return;
      const page = intQuery(req.query.page, 1, 100_000);
      const limit = intQuery(req.query.limit, 20, MAX_PAGE_SIZE);
      const { data, total } = await getStore().listMatches(playerId, page, limit);
      res.json({ data, total, page, limit, totalPages: Math.ceil(total / limit) });
    }),
  );

  /**
   * Sign in with Google. The first time, the Google account is attached to the calling guest; after
   * that, signing in anywhere returns the token of the account it is attached to.
   */
  app.post(
    '/v1/auth/google',
    json,
    safely(async (req, res) => {
      const playerId = authenticate(req, res);
      if (!playerId) return;
      if (!config.googleClientId)
        return sendError(req, res, 503, 'Google sign-in is not configured', 'google_disabled');
      const credential: unknown = (req.body as { credential?: unknown } | undefined)?.credential;
      if (typeof credential !== 'string' || credential.length === 0 || credential.length > 4096) {
        return sendError(req, res, 400, 'credential is required', 'invalid_credential');
      }
      let googleId: string;
      try {
        googleId = await verifyGoogle(credential);
      } catch (err) {
        if (err instanceof InvalidGoogleCredential)
          return sendError(req, res, 401, 'Google sign-in failed', 'invalid_credential');
        throw err;
      }
      const store = getStore();
      let player = await store.findByGoogleId(googleId);
      if (!player) {
        const current = await store.ensurePlayer(playerId);
        // This guest already belongs to another Google account: start that account afresh instead of taking it over.
        const target = current.googleId === null ? current : await store.ensurePlayer(issueGuest().playerId);
        await store.linkGoogle(target.id, googleId);
        player = { ...target, googleId };
      }
      res.json({ token: tokenFor(player.id), profile: await profileOf(player) });
    }),
  );
}
