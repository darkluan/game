import { HEROES, type Race, synergyOf } from '@game/core';
import type { RosterHero } from './session';

/** The race synergy a hero benefits from, as the scene marks it on that hero. */
export type SynergyMark = { kind: 'pair'; race: Race } | { kind: 'speed' };

/**
 * The synergy each hero in the match benefits from, by hero id. The roster is public, so this covers
 * the enemy team too. A pair only strengthens the two heroes of the shared race.
 */
export function synergyMarks(roster: readonly RosterHero[]): Map<number, SynergyMark> {
  const marks = new Map<number, SynergyMark>();
  for (const team of new Set(roster.map((r) => r.team))) {
    const members = roster.flatMap((r) => {
      const race = HEROES[r.defId]?.race;
      return r.team === team && race ? [{ id: r.id, race }] : [];
    });
    const synergy = synergyOf(members.map((m) => m.race));
    for (const m of members) {
      if (synergy.race === m.race) marks.set(m.id, { kind: 'pair', race: m.race });
      else if (synergy.speed) marks.set(m.id, { kind: 'speed' });
    }
  }
  return marks;
}
