import { HEROES } from '@game/core';

const counts = new Map<string, number>();
for (const hero of Object.values(HEROES)) counts.set(hero.race, (counts.get(hero.race) ?? 0) + 1);

/** How many heroes the fullest race has: the hero pickers lay every race out in a row this wide. */
export const MOST_IN_A_RACE = Math.max(...counts.values());
