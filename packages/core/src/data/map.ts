import type { Team, Vec2 } from '../types.js';

/** Axis-aligned wall or rock. x/z is the centre, w/d the full size. */
export interface RectObstacle {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface MapDef {
  halfWidth: number;
  halfDepth: number;
  /** Indexed by team. */
  fountains: [Vec2, Vec2];
  shrines: [Vec2, Vec2];
  minionSpawns: [Vec2, Vec2];
  towers: { team: Team; tier: 1 | 2; pos: Vec2 }[];
  /** z offsets minions keep while marching, melee then ranged. */
  laneOffsets: { melee: number[]; ranged: number[] };
  obstacles: RectObstacle[];
}

const mirror = (rects: RectObstacle[]): RectObstacle[] =>
  rects.flatMap((r) => [r, { ...r, z: -r.z }]).flatMap((r) => (r.x === 0 ? [r] : [r, { ...r, x: -r.x }]));

/** One lane along the x axis. Team 0 on the left (-x), team 1 on the right (+x). */
export const MAP: MapDef = {
  halfWidth: 60,
  halfDepth: 24,
  fountains: [
    { x: -56, z: 0 },
    { x: 56, z: 0 },
  ],
  shrines: [
    { x: -48, z: 0 },
    { x: 48, z: 0 },
  ],
  minionSpawns: [
    { x: -43, z: 0 },
    { x: 43, z: 0 },
  ],
  towers: [
    { team: 0, tier: 2, pos: { x: -32, z: 0 } },
    { team: 0, tier: 1, pos: { x: -14, z: 0 } },
    { team: 1, tier: 2, pos: { x: 32, z: 0 } },
    { team: 1, tier: 1, pos: { x: 14, z: 0 } },
  ],
  laneOffsets: { melee: [-3, 0, 3], ranged: [-2, 2] },
  obstacles: mirror([
    // Walls between lane and jungle, with gaps to enter the jungle.
    { x: 31, z: 8, w: 14, d: 2 },
    { x: 11, z: 8, w: 14, d: 2 },
    // Jungle rocks.
    { x: 20, z: 16, w: 6, d: 4 },
    { x: 0, z: 18, w: 8, d: 3 },
  ]),
};
