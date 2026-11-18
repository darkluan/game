import {
  BoxGeometry,
  BufferAttribute,
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { COLORS } from './palette';

/**
 * The battlefield's scenery and buildings, in the look of ancient Egypt, built in code with no
 * model files: pyramids and dunes on the horizon, date palms, mud-brick houses, temple gates,
 * obelisks, tents and jars. Every prop is one mesh painted by vertex, so many copies of it can be
 * drawn in a single call. Props are built about one unit across, like the model files they replace,
 * and scaled up where they are placed.
 */

const SAND = '#d8b676';
const SAND_DARK = '#b08a50';
const STONE = '#e6d3a4';
const STONE_DARK = '#bfa16a';
const BRICK = '#c99a5e';
const BRICK_DARK = '#9a7040';
const GOLD = '#f2c94c';
const TRUNK = '#8a6638';
const TRUNK_DARK = '#6a4c28';
const FROND = '#4f9a4a';
const FROND_DARK = '#356f36';
const CLAY = '#b8623a';
const CLOTH = '#f1e4c2';
const SHADE = '#3a2a1a';
const DATES = '#c9742c';

type Triple = [number, number, number];
const UP = Math.PI / 2;
const holder = new Object3D();

/** One painted piece of a prop: a shape, moved into place and given a colour on every vertex. */
function piece(
  geometry: BufferGeometry,
  color: string,
  position: Triple = [0, 0, 0],
  rotation: Triple = [0, 0, 0],
  scale: Triple = [1, 1, 1],
): BufferGeometry {
  const made = geometry.toNonIndexed();
  holder.position.set(...position);
  holder.rotation.set(...rotation);
  holder.scale.set(...scale);
  holder.updateMatrix();
  made.applyMatrix4(holder.matrix);
  const paint = new Color(color);
  const colors = new Float32Array(made.attributes.position.count * 3);
  for (let i = 0; i < colors.length; i += 3) paint.toArray(colors, i);
  made.setAttribute('color', new BufferAttribute(colors, 3));
  made.deleteAttribute('uv');
  return made;
}

/** All the pieces of a prop as one mesh. */
function prop(pieces: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(pieces, false);
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const tube = (top: number, bottom: number, h: number, sides = 8) => new CylinderGeometry(top, bottom, h, sides);
const cone = (r: number, h: number, sides = 4) => new ConeGeometry(r, h, sides);
const ball = (r: number) => new SphereGeometry(r, 10, 7);
/** A four-sided shape turned so a flat face, not a corner, looks down the z axis. */
const SQUARE: Triple = [0, Math.PI / 4, 0];

/** A date palm: a leaning ringed trunk, a crown of drooping fronds, a cluster of dates under it. */
function palmPieces(height: number, lean: number, at: Triple = [0, 0, 0], fronds = 8): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const rings = 5;
  const step = height / rings;
  let x = 0;
  for (let i = 0; i < rings; i++) {
    const tilt = lean * (i / rings);
    out.push(
      piece(
        tube(0.034 - i * 0.003, 0.042 - i * 0.003, step * 1.08, 6),
        i % 2 ? TRUNK_DARK : TRUNK,
        [at[0] + x, at[1] + (i + 0.5) * step, at[2]],
        [0, 0, -tilt],
      ),
    );
    x += Math.sin(tilt) * step;
  }
  const crown: Triple = [at[0] + x, at[1] + height, at[2]];
  for (let k = 0; k < fronds; k++) {
    const a = (k / fronds) * Math.PI * 2 + 0.3;
    const droop = 1.15 + (k % 2) * 0.3;
    const reach = 0.2;
    out.push(
      piece(
        cone(0.06, 0.46, 4),
        k % 2 ? FROND_DARK : FROND,
        [crown[0] + Math.cos(a) * reach, crown[1] - (k % 2) * 0.06, crown[2] + Math.sin(a) * reach],
        [0, -a, -droop],
        [1, 1, 0.22],
      ),
    );
  }
  out.push(piece(ball(0.045), FROND_DARK, crown));
  for (let k = 0; k < 3; k++)
    out.push(
      piece(ball(0.022), DATES, [
        crown[0] + Math.cos(k * 2.1) * 0.04,
        crown[1] - 0.06,
        crown[2] + Math.sin(k * 2.1) * 0.04,
      ]),
    );
  return out;
}

/** A pyramid in courses: each one a little smaller than the one it stands on. */
function steppedPieces(width: number, height: number, courses: number, color: string, dark: string): BufferGeometry[] {
  const out: BufferGeometry[] = [];
  const rise = height / courses;
  for (let i = 0; i < courses; i++) {
    const w = width * (1 - i / (courses + 0.6));
    out.push(piece(box(w, rise, w), i % 2 ? dark : color, [0, (i + 0.5) * rise, 0]));
  }
  return out;
}

/** A dune: a long low swell of sand, a ridge along its top. */
function dunePieces(width: number, height: number): BufferGeometry[] {
  return [
    piece(ball(0.5), SAND, [0, 0, 0], [0, 0, 0], [width, height * 2, width * 0.6]),
    piece(
      ball(0.5),
      SAND_DARK,
      [width * 0.22, -0.01, width * 0.14],
      [0, 0.5, 0],
      [width * 0.7, height * 1.5, width * 0.42],
    ),
  ];
}

/** A house of mud brick: flat roof with a low wall round it, a dark door, a window, and an awning in the side's colour. */
function housePieces(team: string, tall: boolean): BufferGeometry[] {
  const h = tall ? 0.62 : 0.42;
  const out = [
    piece(box(0.8, h, 0.66), BRICK, [0, h / 2, 0]),
    piece(box(0.86, 0.06, 0.72), BRICK_DARK, [0, h + 0.03, 0]),
    piece(box(0.16, 0.24, 0.02), SHADE, [-0.12, 0.12, 0.335]),
    piece(box(0.12, 0.1, 0.02), SHADE, [0.2, h * 0.62, 0.335]),
    piece(box(0.34, 0.02, 0.2), team, [-0.12, 0.3, 0.43], [0.35, 0, 0]),
    piece(tube(0.035, 0.05, 0.1, 6), CLAY, [0.26, h + 0.11, -0.16]),
    piece(tube(0.03, 0.045, 0.08, 6), CLAY, [0.14, h + 0.1, -0.22]),
  ];
  for (const x of [-0.26, 0.02]) out.push(piece(tube(0.008, 0.008, 0.3, 4), TRUNK_DARK, [x, 0.15, 0.52]));
  if (tall) {
    out.push(piece(ball(0.2), STONE, [-0.14, h + 0.05, -0.06], [0, 0, 0], [1, 0.75, 1]));
    out.push(piece(box(0.3, 0.2, 0.3), BRICK, [-0.14, h + 0.02, -0.06]));
  } else {
    out.push(piece(box(0.3, 0.26, 0.28), BRICK, [0.2, h + 0.13, 0.12]));
    out.push(piece(box(0.34, 0.04, 0.32), BRICK_DARK, [0.2, h + 0.27, 0.12]));
  }
  return out;
}

/** An obelisk on a stepped foot: a tall tapering shaft banded in the side's colour, a point of gold. */
function obeliskPieces(team: string, height = 1.5): BufferGeometry[] {
  return [
    piece(box(0.5, 0.08, 0.5), STONE_DARK, [0, 0.04, 0]),
    piece(box(0.38, 0.1, 0.38), STONE, [0, 0.13, 0]),
    piece(tube(0.09, 0.15, height, 4), STONE, [0, 0.18 + height / 2, 0], SQUARE),
    piece(tube(0.146, 0.152, 0.07, 4), team, [0, 0.3, 0], SQUARE),
    piece(tube(0.108, 0.114, 0.05, 4), team, [0, 0.18 + height * 0.72, 0], SQUARE),
    piece(cone(0.092, 0.2, 4), GOLD, [0, 0.28 + height, 0], SQUARE),
  ];
}

/** A temple gate: two sloping towers with a doorway between, banners in the side's colour, a row of columns before it. */
function templePieces(team: string): BufferGeometry[] {
  const out: BufferGeometry[] = [piece(box(1.3, 0.06, 0.9), STONE_DARK, [0, 0.03, 0])];
  for (const side of [-1, 1]) {
    out.push(piece(tube(0.26, 0.34, 0.8, 4), STONE, [side * 0.38, 0.46, -0.1], SQUARE, [1, 1, 0.6]));
    out.push(piece(box(0.4, 0.05, 0.26), STONE_DARK, [side * 0.38, 0.88, -0.1]));
    out.push(piece(box(0.1, 0.42, 0.012), team, [side * 0.38, 0.52, 0.062]));
    out.push(piece(tube(0.006, 0.006, 0.5, 4), TRUNK_DARK, [side * 0.38, 1.12, -0.1]));
    out.push(piece(box(0.14, 0.09, 0.006), team, [side * 0.38 + 0.07, 1.3, -0.1]));
    for (const z of [0.22, 0.36]) {
      out.push(piece(tube(0.035, 0.04, 0.4, 8), STONE, [side * 0.2, 0.26, z]));
      out.push(piece(tube(0.055, 0.035, 0.05, 8), GOLD, [side * 0.2, 0.48, z]));
    }
  }
  out.push(piece(box(0.3, 0.42, 0.3), STONE_DARK, [0, 0.27, -0.1]));
  out.push(piece(box(0.18, 0.34, 0.02), SHADE, [0, 0.23, 0.052]));
  out.push(piece(box(0.44, 0.07, 0.34), STONE, [0, 0.52, -0.1]));
  out.push(piece(ball(0.05), GOLD, [0, 0.6, -0.1], [0, 0, 0], [1.6, 0.5, 0.4]));
  return out;
}

/** A desert tent: a canopy in broad stripes on four poles. */
function tentPieces(): BufferGeometry[] {
  const out = [
    piece(cone(0.5, 0.3, 4), CLOTH, [0, 0.45, 0], SQUARE),
    piece(cone(0.36, 0.22, 4), CLAY, [0, 0.5, 0], SQUARE),
    piece(box(0.5, 0.012, 0.36), CLAY, [0, 0.012, 0]),
    piece(tube(0.03, 0.045, 0.09, 6), CLAY, [0.16, 0.06, 0.08]),
  ];
  for (const x of [-0.33, 0.33])
    for (const z of [-0.33, 0.33]) out.push(piece(tube(0.01, 0.01, 0.3, 4), TRUNK_DARK, [x, 0.15, z]));
  return out;
}

/** A banner on a pole, a gold finial above the cloth. */
function bannerPieces(team: string): BufferGeometry[] {
  return [
    piece(tube(0.008, 0.01, 0.56, 5), TRUNK_DARK, [0, 0.28, 0]),
    piece(box(0.012, 0.26, 0.14), team, [0, 0.4, 0.08]),
    piece(cone(0.04, 0.07, 3), team, [0, 0.235, 0.08], [Math.PI, 0, 0], [0.2, 1, 1.75]),
    piece(ball(0.018), GOLD, [0, 0.575, 0]),
  ];
}

/** Blocks of quarried sandstone, tumbled together. */
function blockPieces(size: number): BufferGeometry[] {
  return [
    piece(box(size, size * 0.6, size * 0.8), STONE, [0, size * 0.3, 0], [0, 0.3, 0]),
    piece(box(size * 0.6, size * 0.5, size * 0.6), STONE_DARK, [size * 0.5, size * 0.25, size * 0.3], [0.1, 0.9, 0]),
    piece(
      box(size * 0.5, size * 0.4, size * 0.5),
      SAND_DARK,
      [-size * 0.35, size * 0.55, -size * 0.1],
      [0.3, 0.5, 0.2],
    ),
  ];
}

/** Every scenery prop by the name the layout places it under; the same names the old model files had. */
export function buildProps(): Record<string, BufferGeometry> {
  const ally = COLORS.ally;
  const enemy = COLORS.enemy;
  const made: Record<string, BufferGeometry> = {
    rock: prop(blockPieces(0.24)),
    rockSingleA: prop(blockPieces(0.2)),
    rockSingleB: prop([
      piece(box(0.26, 0.12, 0.2), STONE_DARK, [0, 0.06, 0], [0, 0.4, 0]),
      piece(box(0.14, 0.1, 0.12), STONE, [0.04, 0.16, 0.02], [0, 1, 0.2]),
    ]),
    // The horizon: one smooth pyramid capped in gold, one stepped, one great dune.
    mountainAGrassTrees: prop([
      piece(cone(0.95, 1.15, 4), STONE, [0, 0.575, 0], SQUARE),
      piece(cone(0.2, 0.245, 4), GOLD, [0, 1.03, 0], SQUARE),
      piece(box(1.5, 0.05, 1.5), SAND_DARK, [0, 0.025, 0]),
    ]),
    mountainBGrassTrees: prop([
      ...steppedPieces(1.5, 0.95, 6, STONE, STONE_DARK),
      piece(box(0.22, 0.2, 0.22), GOLD, [0, 1.03, 0]),
    ]),
    mountainCGrass: prop([...dunePieces(1.9, 0.28), piece(cone(0.42, 0.5, 4), STONE_DARK, [-0.5, 0.33, -0.2], SQUARE)]),
    hillsATrees: prop([
      ...dunePieces(1.5, 0.16),
      ...palmPieces(0.6, 0.5, [-0.3, 0.1, 0.1]),
      ...palmPieces(0.45, -0.4, [0.25, 0.08, -0.1], 7),
    ]),
    // Ruins on a dune: columns standing, one fallen.
    hillsBTrees: prop([
      ...dunePieces(1.5, 0.15),
      piece(tube(0.05, 0.055, 0.5, 8), STONE, [-0.28, 0.36, 0]),
      piece(tube(0.07, 0.05, 0.05, 8), STONE_DARK, [-0.28, 0.63, 0]),
      piece(tube(0.05, 0.055, 0.3, 8), STONE, [0.05, 0.26, 0.1]),
      piece(tube(0.05, 0.05, 0.42, 8), STONE_DARK, [0.36, 0.14, -0.05], [UP, 0.5, 0]),
    ]),
    hillsC: prop(dunePieces(1.6, 0.18)),
    treeA: prop(palmPieces(1, 0.55)),
    treeB: prop(palmPieces(0.8, -0.35, [0, 0, 0], 7)),
    treesALarge: prop([
      ...palmPieces(1.05, 0.5, [-0.25, 0, 0]),
      ...palmPieces(0.8, -0.4, [0.25, 0, 0.2], 7),
      ...palmPieces(0.9, 0.2, [0.05, 0, -0.3]),
    ]),
    treesBLarge: prop([
      ...palmPieces(0.95, -0.5, [0.25, 0, 0]),
      ...palmPieces(0.75, 0.4, [-0.25, 0, 0.15], 7),
      ...palmPieces(1.1, -0.15, [0, 0, -0.28]),
    ]),
    homeAAlly: prop(housePieces(ally, false)),
    homeAEnemy: prop(housePieces(enemy, false)),
    homeBAlly: prop(housePieces(ally, true)),
    homeBEnemy: prop(housePieces(enemy, true)),
    windmillAlly: prop(obeliskPieces(ally)),
    windmillEnemy: prop(obeliskPieces(enemy)),
    barracksAlly: prop(templePieces(ally)),
    barracksEnemy: prop(templePieces(enemy)),
    flagBlue: prop(bannerPieces(ally)),
    flagRed: prop(bannerPieces(enemy)),
    tent: prop(tentPieces()),
    // A length of low wall, a cap stone at each end.
    fenceStoneStraight: prop([
      piece(box(1.15, 0.2, 0.14), BRICK, [0, 0.1, 0]),
      piece(box(1.2, 0.04, 0.18), BRICK_DARK, [0, 0.22, 0]),
      piece(box(0.16, 0.3, 0.2), STONE, [-0.56, 0.15, 0]),
      piece(box(0.16, 0.3, 0.2), STONE, [0.56, 0.15, 0]),
    ]),
    // A tall clay jar, and a small one beside it.
    barrel: prop([
      piece(tube(0.06, 0.035, 0.12, 8), CLAY, [0, 0.06, 0]),
      piece(tube(0.035, 0.06, 0.07, 8), CLAY, [0, 0.155, 0]),
      piece(tube(0.045, 0.035, 0.025, 8), STONE_DARK, [0, 0.2, 0]),
    ]),
    crateABig: prop([
      piece(box(0.2, 0.16, 0.2), TRUNK, [0, 0.08, 0]),
      piece(box(0.21, 0.02, 0.21), TRUNK_DARK, [0, 0.16, 0]),
      piece(box(0.21, 0.02, 0.03), CLOTH, [0, 0.09, 0.09]),
    ]),
    // A stand of spears and a round shield.
    weaponrack: prop([
      piece(box(0.3, 0.02, 0.06), TRUNK_DARK, [0, 0.14, 0]),
      piece(tube(0.006, 0.006, 0.4, 4), TRUNK, [-0.1, 0.2, 0], [0.12, 0, 0]),
      piece(tube(0.006, 0.006, 0.4, 4), TRUNK, [0, 0.2, 0], [0.12, 0, 0]),
      piece(cone(0.016, 0.06, 4), STONE, [-0.1, 0.42, 0.026]),
      piece(cone(0.016, 0.06, 4), STONE, [0, 0.42, 0.026]),
      piece(tube(0.07, 0.07, 0.012, 12), GOLD, [0.1, 0.1, 0.03], [UP - 0.2, 0, 0]),
    ]),
    // A reed of papyrus, for the thickets units hide in.
    reed: prop([
      piece(tube(0.01, 0.014, 1, 4), FROND, [0, 0.5, 0]),
      piece(cone(0.1, 0.22, 6), FROND_DARK, [0, 1.05, 0], [Math.PI, 0, 0]),
      piece(ball(0.045), GOLD, [0, 1.12, 0], [0, 0, 0], [1, 0.6, 1]),
    ]),
  };
  return made;
}

/** A defence tower: an obelisk on a broad stepped foot, banded in its side's colour. Its point is drawn apart, so it can glow. */
export function towerGeometry(team: string): BufferGeometry {
  return prop([
    piece(tube(2.1, 2.3, 0.4, 8), STONE_DARK, [0, 0.2, 0]),
    piece(tube(1.6, 1.85, 0.4, 8), STONE, [0, 0.6, 0]),
    piece(box(1.9, 0.7, 1.9), STONE_DARK, [0, 1.15, 0]),
    piece(box(1.6, 0.16, 1.6), team, [0, 1.58, 0]),
    piece(tube(0.62, 0.95, 4.2, 4), STONE, [0, 3.76, 0], SQUARE),
    piece(tube(0.86, 0.9, 0.22, 4), team, [0, 2.4, 0], SQUARE),
    piece(tube(0.7, 0.73, 0.18, 4), team, [0, 4.9, 0], SQUARE),
    piece(box(0.5, 0.5, 0.04), GOLD, [0, 3.6, 0.6]),
    piece(box(0.04, 0.5, 0.5), GOLD, [0.6, 3.6, 0]),
    piece(box(0.5, 0.5, 0.04), GOLD, [0, 3.6, -0.6]),
    piece(box(0.04, 0.5, 0.5), GOLD, [-0.6, 3.6, 0]),
  ]);
}

/** A shrine: a stepped pyramid with a stair up its face and a small temple on top, where its light burns. */
export function shrineGeometry(team: string): BufferGeometry {
  const out = steppedPieces(6.6, 4.4, 4, STONE, STONE_DARK);
  // The stair, facing down the lane (+z here; the building is turned where it is placed).
  for (let i = 0; i < 8; i++)
    out.push(piece(box(1.5, 0.55, 0.5), i % 2 ? SAND_DARK : SAND, [0, 0.28 + i * 0.55, 3.2 - i * 0.36]));
  for (const side of [-1, 1]) {
    out.push(piece(box(0.3, 4.5, 3.2), STONE_DARK, [side * 0.9, 2.2, 1.9], [0.62, 0, 0]));
    out.push(piece(tube(0.22, 0.26, 1.7, 8), STONE, [side * 0.95, 5.3, 0.7]));
    out.push(piece(tube(0.34, 0.22, 0.2, 8), GOLD, [side * 0.95, 6.2, 0.7]));
    out.push(piece(tube(0.22, 0.26, 1.7, 8), STONE, [side * 0.95, 5.3, -0.7]));
    out.push(piece(box(0.16, 2.2, 0.03), team, [side * 2.3, 2.6, 3.32 - 1.1]));
  }
  out.push(piece(box(2.9, 0.3, 2.3), STONE_DARK, [0, 6.4, 0]));
  out.push(piece(box(3.2, 0.2, 2.6), team, [0, 6.65, 0]));
  out.push(piece(box(2.6, 0.2, 2), STONE, [0, 4.5, 0]));
  return prop(out);
}

/** One material for every painted prop. */
export function propMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, flatShading: true });
}
