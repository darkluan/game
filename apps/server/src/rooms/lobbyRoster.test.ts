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

  it('gives every teammate a different hero and refuses a duplicate pick', () => {
    const roster = filled(6);
    for (const team of [0, 1]) {
      const heroes = roster
        .list()
        .filter((p) => p.team === team)
        .map((p) => p.heroId);
      expect(new Set(heroes).size).toBe(3);
    }
    const [p0, , p2] = roster.list();
    expect(roster.setHero('p0', p2.heroId)).toBe(false); // p2 is a teammate
    expect(roster.setHero('p0', 'mekka')).toBe(true);
    expect(roster.setHero('p1', 'mekka')).toBe(true); // other team may mirror
    expect(roster.setHero('p0', 'not-a-hero')).toBe(false);
    expect(roster.setHero('p0', 7)).toBe(false);
    expect(roster.list()[0].heroId).toBe('mekka');
    expect(p0.heroId).not.toBe('mekka');
  });

  it('swaps a clashing hero when a player changes team', () => {
    const roster = filled(2);
    roster.setHero('p0', 'sola');
    roster.setHero('p1', 'sola');
    expect(roster.setTeam('p1', 0)).toBe(true);
    const [a, b] = roster.list();
    expect(a.heroId).toBe('sola');
    expect(b.heroId).not.toBe('sola');
  });
});
