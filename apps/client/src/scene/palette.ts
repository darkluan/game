import { HEROES } from '@game/core';

/** Canvas colours. three.js cannot read CSS variables, so the team colours mirror the tokens in index.css. */
export const COLORS = {
  sky: '#0b1016',
  // Egypt: sand under everything, a lane paved in pale limestone, walls of quarried sandstone.
  outside: '#9a7a4a',
  ground: '#b08f5c',
  lane: '#d6c193',
  kerb: '#8a6c44',
  wall: '#a8875a',
  ally: '#4aa3ff',
  enemy: '#ff5a4a',
  self: '#ffd166',
  hp: '#3fbf5f',
  barBack: '#10151c',
  gold: '#f2c94c',
  neutral: '#e8eef5',
  steel: '#c9d2dc',
  stun: '#ffe066',
  human: '#4aa3ff',
  dragon: '#ff5a4a',
  god: '#f2c94c',
  machine: '#3fbf5f',
  heal: '#7be08f',
  monster: '#b79a5a',
  bush: '#5f8f3a',
  burn: '#ff7a1a',
  blind: '#2a1140',
  stone: '#8b8f96',
  stealth: '#7a4bd0',
} as const;

export const teamColor = (team: number, playerTeam: number): string =>
  team === playerTeam ? COLORS.ally : COLORS.enemy;

/** Multiplied into a model's texture so both teams can share one model. */
export const TEAM_TINT = { ally: '#9cc8ff', enemy: '#ff9a8c' } as const;

export const teamTint = (team: number, playerTeam: number): string =>
  team === playerTeam ? TEAM_TINT.ally : TEAM_TINT.enemy;

/** The colour of a hero's race. */
export const heroColor = (heroId: string): string => COLORS[HEROES[heroId]?.race ?? 'human'];
