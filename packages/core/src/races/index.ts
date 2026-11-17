import type { Race } from '../types.js';
import { human } from './human.js';

/** The base mechanic of a race, as numbers the shared systems read. */
export interface RaceDef {
  id: Race;
  itemSlots: number;
  /** Fraction taken off shop prices. */
  shopDiscount: number;
  respawnMult: number;
  hpRegenMult: number;
}

// Dragon, god and machine arrive in phase 3 (PLAN.md); until then only human heroes exist.
const RACES: Partial<Record<Race, RaceDef>> = { human };

export function raceOf(race: Race): RaceDef {
  const def = RACES[race];
  if (!def) throw new Error(`Race not implemented: ${race}`);
  return def;
}
