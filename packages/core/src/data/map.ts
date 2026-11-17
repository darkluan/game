import type { Team, Vec2 } from '../types.js';

/** Axis-aligned rectangle. x/z is the centre, w/d the full size. */
export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}
export type RectObstacle = Rect;

export interface CampDef {
  pos: Vec2;
  monsters: { type: 'big' | 'small'; dx: number; dz: number }[];
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
  obstacles: Rect[];
  /** Tall grass: units inside are hidden from enemies outside it. */
  bushes: Rect[];
  /** Jungle camps: two on each side of the lane. */
  camps: CampDef[];
}

const mirror = (rects: Rect[]): Rect[] =>
  rects.flatMap((r) => [r, { ...r, z: -r.z }]).flatMap((r) => (r.x === 0 ? [r] : [r, { ...r, x: -r.x }]));

const CAMP_MONSTERS: CampDef['monsters'] = [
  { type: 'big', dx: 0, dz: 0 },
  { type: 'small', dx: -1.8, dz: 1.2 },
  { type: 'small', dx: 1.8, dz: 1.2 },
];

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
  bushes: mirror([
    // In the gaps of the lane walls, and at the middle jungle entrance.
    { x: 21, z: 8, w: 6, d: 3 },
    { x: 0, z: 12, w: 8, d: 4 },
  ]),
  camps: [
    { x: -31, z: 15 },
    { x: 31, z: 15 },
    { x: -31, z: -15 },
    { x: 31, z: -15 },
  ].map((pos) => ({ pos, monsters: CAMP_MONSTERS })),
};

/** Index of the bush containing the point, or -1. */
export function bushAt(map: MapDef, p: Vec2): number {
  return map.bushes.findIndex((b) => Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.z - b.z) <= b.d / 2);
}
