/** Canvas colours. three.js cannot read CSS variables, so the team colours mirror the tokens in index.css. */
export const COLORS = {
  sky: '#0b1016',
  outside: '#16211a',
  ground: '#2f4a34',
  lane: '#75654a',
  wall: '#565c66',
  ally: '#4aa3ff',
  enemy: '#ff5a4a',
  self: '#ffd166',
  hp: '#3fbf5f',
  barBack: '#10151c',
  gold: '#f2c94c',
  neutral: '#e8eef5',
  steel: '#c9d2dc',
  stun: '#ffe066',
} as const;

export const teamColor = (team: number, playerTeam: number): string =>
  team === playerTeam ? COLORS.ally : COLORS.enemy;

/** Multiplied into a model's texture so both teams can share one model. */
export const TEAM_TINT = { ally: '#9cc8ff', enemy: '#ff9a8c' } as const;

export const teamTint = (team: number, playerTeam: number): string =>
  team === playerTeam ? TEAM_TINT.ally : TEAM_TINT.enemy;
