import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from '../config.js';

const GOOGLE_KEYS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/** Thrown when a Google credential is missing, forged, expired or meant for another app. */
export class InvalidGoogleCredential extends Error {}

export type GoogleVerifier = (credential: string) => Promise<string>;

/**
 * Checks a Google ID token (the "credential" Google Sign-In gives the browser) against Google's
 * public keys and this app's client id. Returns the Google account id ("sub").
 */
export const verifyGoogleCredential: GoogleVerifier = async (credential) => {
  try {
    const { payload } = await jwtVerify(credential, GOOGLE_KEYS, {
      issuer: GOOGLE_ISSUERS,
      audience: config.googleClientId,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('no subject');
    return payload.sub;
  } catch {
    throw new InvalidGoogleCredential('invalid google credential');
  }
};
