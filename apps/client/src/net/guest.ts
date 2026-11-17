import { apiRequest } from '@/api/client';

export interface Guest {
  playerId: string;
  token: string;
}

const STORAGE_KEY = 'tu-toc-guest';
let cached: Guest | null = null;

function stored(): Guest | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const guest = raw as Partial<Guest> | null;
    return typeof guest?.playerId === 'string' && typeof guest.token === 'string' ? (guest as Guest) : null;
  } catch {
    // Storage blocked or corrupted: treated as a first visit.
    return null;
  }
}

/**
 * The visitor's guest identity: created on first use, then kept in the browser so the same player
 * comes back to the same seat. With `renew`, a rejected token is thrown away and replaced.
 */
export async function ensureGuest(renew = false): Promise<Guest> {
  if (!renew) cached ??= stored();
  if (renew || !cached) {
    cached = await apiRequest<Guest>('/v1/guests', { method: 'POST' });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // Storage blocked: the identity lasts for this visit only.
    }
  }
  return cached;
}
