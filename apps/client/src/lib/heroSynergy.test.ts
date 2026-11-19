import { describe, expect, it } from 'vitest';
import { synergyMarks } from './heroSynergy';
import type { RosterHero } from './session';

const roster = (...teams: string[][]): RosterHero[] =>
  teams.flatMap((ids, team) => ids.map((defId, i) => ({ id: team * 10 + i, team: team as 0 | 1, defId })));

describe('synergyMarks', () => {
  it('marks only the two heroes that share a race', () => {
    const marks = synergyMarks(roster(['ignar', 'baru', 'kael']));
    expect(marks.get(0)).toEqual({ kind: 'pair', race: 'dragon' });
    expect(marks.get(1)).toEqual({ kind: 'pair', race: 'dragon' });
    expect(marks.has(2)).toBe(false);
  });

  it('marks the whole team when its three races differ', () => {
    const marks = synergyMarks(roster(['kael', 'ignar', 'sola']));
    expect([...marks.values()]).toEqual([{ kind: 'speed' }, { kind: 'speed' }, { kind: 'speed' }]);
  });

  it('works each team out on its own', () => {
    const marks = synergyMarks(roster(['kael', 'ignar', 'sola'], ['bolt7', 'mekka', 'lyra']));
    expect(marks.get(0)).toEqual({ kind: 'speed' });
    expect(marks.get(10)).toEqual({ kind: 'pair', race: 'machine' });
    expect(marks.has(12)).toBe(false);
  });

  it('marks nobody in a team too small for a synergy', () => {
    expect(synergyMarks(roster(['kael'], ['ignar'])).size).toBe(0);
  });
});
