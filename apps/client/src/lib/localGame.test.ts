import { describe, expect, it } from 'vitest';
import { TICK_RATE } from '@game/core';
import { LocalGame } from './localGame';

const TICK = 1 / TICK_RATE;

describe('LocalGame', () => {
  it('runs whole ticks only and keeps the remainder for interpolation', () => {
    const game = new LocalGame(1);
    expect(game.update(TICK * 0.5)).toBe(false);
    expect(game.sim.tick).toBe(0);
    expect(game.update(TICK * 2)).toBe(true);
    expect(game.sim.tick).toBe(2);
    expect(game.alpha).toBeCloseTo(0.5);
  });

  it('does not fast-forward after a long stall', () => {
    const game = new LocalGame(1);
    game.update(60);
    expect(game.sim.tick).toBeLessThanOrEqual(5);
  });

  it('interpolates a moving unit between its last two tick positions', () => {
    const game = new LocalGame(1);
    game.send({ t: 'move', x: 0, z: 0 });
    game.update(TICK * 3.5);
    const now = game.hero.pos.x;
    const shown = game.renderPos(game.hero, { x: 0, z: 0 }).x;
    expect(shown).toBeLessThan(now);
    expect(shown).toBeGreaterThan(now - game.hero.mover.speed * TICK);
  });

  it('reports the player hero in the hud', () => {
    const game = new LocalGame(1);
    game.send({ t: 'levelUp', slot: 'Q' });
    game.update(TICK);
    const hud = game.hud();
    expect(hud.abilities.find((a) => a.slot === 'Q')).toMatchObject({ level: 1, usable: true, canLevelUp: false });
    expect(hud.abilities.find((a) => a.slot === 'R')).toMatchObject({ level: 0, usable: false });
    expect(hud.scores).toHaveLength(6);
    expect(hud.winner).toBeNull();
  });
});
