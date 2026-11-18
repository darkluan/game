import type { Profile } from '@game/core';
import { apiRequest } from '@/api/client';

export interface ServerConfig {
  /** Ranked matchmaking is available on this server. */
  ranked: boolean;
  /** Set when Google sign-in is configured. */
  googleClientId: string | null;
}

const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const fetchServerConfig = (): Promise<ServerConfig> => apiRequest('/v1/config');

export const fetchProfile = (token: string): Promise<Profile> => apiRequest('/v1/me', { headers: bearer(token) });

/** Exchanges the credential Google Sign-In gave the browser for the account it belongs to. */
export const signInWithGoogle = (token: string, credential: string): Promise<{ token: string; profile: Profile }> =>
  apiRequest('/v1/auth/google', {
    method: 'POST',
    headers: { ...bearer(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ credential }),
  });
