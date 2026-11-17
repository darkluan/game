import { describe, expect, it } from 'vitest';
import { LobbyRoster } from './lobbyRoster.js';

function filled(n: number): LobbyRoster {
  const roster = new LobbyRoster();
  for (let i = 0; i < n; i++) roster.add(`p${i}`, `Player ${i}`);
  return roster;
}

describe('LobbyRoster', () => {
  it('alternates teams as players join', () => {
    expect(
      filled(4)
        .list()
        .map((p) => p.team),
    ).toEqual([0, 1, 0, 1]);
  });

  it('makes the first player the host and passes it on when they leave', () => {
    const roster = filled(3);
    expect(roster.isHost('p0')).toBe(true);
    roster.remove('p0');
    expect(roster.list()[0]).toMatchObject({ playerId: 'p1', isHost: true });
    expect(roster.isHost('p0')).toBe(false);
  });

  it('holds at most three players per team', () => {
    const roster = filled(6);
    expect(roster.add('p6', 'Late')).toBe(false);
    expect(roster.size).toBe(6);
    expect(roster.setTeam('p0', 1)).toBe(false); // team 1 already has three
  });

  it('lets a player switch to a team with room', () => {
    const roster = filled(2);
    expect(roster.setTeam('p1', 0)).toBe(true);
    expect(roster.list().map((p) => p.team)).toEqual([0, 0]);
    expect(roster.setTeam('p1', 2 as never)).toBe(false);
    expect(roster.setTeam('ghost', 0)).toBe(false);
  });

  it('keeps the seat of a player who joins again', () => {
    const roster = filled(2);
    roster.add('p1', 'Renamed');
    expect(roster.size).toBe(2);
    expect(roster.list()[1]).toMatchObject({ nickname: 'Renamed', team: 1 });
  });
});
