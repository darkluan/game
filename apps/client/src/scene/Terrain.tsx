import { useLayoutEffect, useMemo, useRef } from 'react';
import { type BufferGeometry, type InstancedMesh, type Material, Object3D } from 'three';
import { type MapDef, Rng } from '@game/core';
import { Bases } from './Base';
import { buildProps, propMaterial } from './egypt';
import { COLORS } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

export interface Placement {
  x: number;
  z: number;
  scale: number;
  turn: number;
}

/** Many copies of one prop in a single draw call. */
export function Props({
  geometry,
  material,
  items,
  castShadow,
}: {
  geometry: BufferGeometry;
  material: Material;
  items: Placement[];
  castShadow: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new Object3D();
    items.forEach((item, i) => {
      dummy.position.set(item.x, 0, item.z);
      dummy.rotation.set(0, item.turn, 0);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);

  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />;
}

/** The name of a prop; see buildProps for what each one is. */
type ModelKey = string;

type Layout = Partial<Record<ModelKey, Placement[]>>;

/** How far a tree must stay from anything built, so nothing grows through a roof. */
const CLEARING = 5.5;

/**
 * Where everything decorative stands. All of it is outside the playable rectangle: something on the
 * map would look like an obstacle without being one. The far side of the field (-z, the top of the
 * screen) carries the tall things; the near side stays low so it never hides the fight.
 */
function layoutScenery(map: MapDef, playerTeam: number): Layout {
  // Fixed seed: the scenery looks the same every match.
  const rng = new Rng(20260);
  const layout: Layout = {};
  const built: { x: number; z: number }[] = [];
  const put = (model: ModelKey, x: number, z: number, scale: number, turn = 0, solid = true) => {
    (layout[model] ??= []).push({ x, z, scale, turn });
    if (solid) built.push({ x, z });
  };
  const far = -map.halfDepth;
  const near = map.halfDepth;

  // Blocks of sandstone heaped over every wall.
  for (const o of map.obstacles) {
    const count = Math.round((o.w * o.d) / 2.2);
    for (let i = 0; i < count; i++) {
      put(
        'rock',
        o.x + rng.range(-o.w / 2 + 0.6, o.w / 2 - 0.6),
        o.z + rng.range(-o.d / 2 + 0.4, o.d / 2 - 0.4),
        rng.range(6, 10),
        rng.range(0, Math.PI * 2),
        false,
      );
    }
  }

  // Pyramids and great dunes along the far side, with lower dunes, palms and ruins at their feet.
  const peaks: ModelKey[] = ['mountainAGrassTrees', 'mountainBGrassTrees', 'mountainCGrass'];
  for (let x = -map.halfWidth - 24, i = 0; x <= map.halfWidth + 24; x += 15, i++)
    put(peaks[i % 3], x + rng.range(-2, 2), far - 22 + rng.range(-3, 3), rng.range(9, 12), rng.range(0, Math.PI * 2));
  const hills: ModelKey[] = ['hillsATrees', 'hillsBTrees', 'hillsC'];
  for (let x = -26, i = 0; x <= 26; x += 13, i++)
    put(hills[i % 3], x + rng.range(-2, 2), far - 10 + rng.range(-2, 2), rng.range(5.5, 7), rng.range(0, Math.PI * 2));

  for (const team of [0, 1] as const) {
    const side = team === 0 ? -1 : 1;
    const ally = team === playerTeam;
    const at = (x: number) => side * x;
    // Buildings face the field.
    const facing = side < 0 ? Math.PI / 2 : -Math.PI / 2;

    // A village of mud-brick houses on the far side, behind a low wall, an obelisk standing over it.
    put(ally ? 'homeAAlly' : 'homeAEnemy', at(53), far - 5.5, 5, 0);
    put(ally ? 'homeBAlly' : 'homeBEnemy', at(45.5), far - 7.5, 5, 0.3 * side);
    put(ally ? 'homeAAlly' : 'homeAEnemy', at(48), far - 13, 5, -0.4 * side);
    put(ally ? 'windmillAlly' : 'windmillEnemy', at(37), far - 7, 6, 0);
    put(('trees' + (team === 0 ? 'ALarge' : 'BLarge')) as ModelKey, at(57), far - 14, 5);
    for (let i = 0; i < 6; i++) put('fenceStoneStraight', at(34 + i * 4.7), far - 3, 4, Math.PI / 2, false);
    put('barrel', at(41.5), far - 4, 5);
    put('crateABig', at(42.8), far - 4.4, 5, 0.5);

    // The temple and the army's camp behind the base.
    put(ally ? 'barracksAlly' : 'barracksEnemy', at(map.halfWidth + 10), -12, 5, facing);
    // The one on the near side stands farther back and smaller, clear of the view of the fountain.
    put(ally ? 'barracksAlly' : 'barracksEnemy', at(map.halfWidth + 15), 13, 4, facing);
    put('tent', at(map.halfWidth + 6), -19, 6, facing);
    put('tent', at(map.halfWidth + 5), 19, 6, facing);
    put('tent', at(map.halfWidth + 12), 0, 6, facing);
    put('weaponrack', at(map.halfWidth + 3.2), -8.6, 6, facing);
    put('barrel', at(map.halfWidth + 3), 8.4, 5);
    put('barrel', at(map.halfWidth + 4.2), 9.3, 5);
    put('crateABig', at(map.halfWidth + 3.4), 10.2, 5, 0.4);
    for (const z of [-22, -11, 0, 11, 22])
      put(
        peaks[(z + 22) % 3],
        at(map.halfWidth + 26 + rng.range(-2, 2)),
        z,
        rng.range(9, 11),
        rng.range(0, Math.PI * 2),
      );

    // Banners at the towers and the shrine.
    const flag: ModelKey = ally ? 'flagBlue' : 'flagRed';
    for (const tower of map.towers.filter((t) => t.team === team))
      for (const z of [-3.4, 3.4]) put(flag, tower.pos.x, tower.pos.z + z, 9, facing, false);
    for (const z of [-5, 5]) put(flag, map.shrines[team].x + side * 2, z, 11, facing, false);

    // The near side: only low things.
    put('tent', at(50), near + 8, 5, Math.PI);
    put('tent', at(43), near + 10, 5, Math.PI + 0.4 * side);
    put('barrel', at(46.5), near + 7, 5);
    for (let i = 0; i < 4; i++) put('fenceStoneStraight', at(40 + i * 4.7), near + 3.2, 4, Math.PI / 2, false);
  }

  // Palms wherever nothing else stands: thick near the water at the two bases, thin out in the sand.
  const margin = 20;
  for (let i = 0; i < 300; i++) {
    const x = rng.range(-map.halfWidth - margin, map.halfWidth + margin);
    const z = rng.range(-map.halfDepth - margin, map.halfDepth + 12);
    if (Math.abs(x) < map.halfWidth + 1.5 && Math.abs(z) < map.halfDepth + 2.5) continue;
    if (built.some((b) => Math.hypot(b.x - x, b.z - z) < CLEARING)) continue;
    // Trees on the near side are kept small, for the same reason nothing tall stands there.
    const scale = z > 0 ? rng.range(3.5, 5) : rng.range(4.5, 7.5);
    put(i % 2 === 0 ? 'treeA' : 'treeB', x, z, scale, rng.range(0, Math.PI * 2), false);
  }
  // Loose blocks along the edges of the field.
  for (let i = 0; i < 36; i++) {
    const x = rng.range(-map.halfWidth, map.halfWidth);
    const z = (i % 2 ? far : near) + (i % 2 ? -1 : 1) * rng.range(1, 2.4);
    put(i % 3 ? 'rockSingleA' : 'rockSingleB', x, z, rng.range(3, 5.5), rng.range(0, Math.PI * 2), false);
  }
  return layout;
}

/** Small or flat things are not worth a place in the shadow map. */
const NO_SHADOW = new Set<ModelKey>(['rockSingleA', 'rockSingleB', 'barrel', 'crateABig', 'hillsC']);

/** Papyrus standing in every thicket. */
function reedBeds(map: MapDef): Placement[] {
  const rng = new Rng(777);
  return map.bushes.flatMap((b) =>
    Array.from({ length: Math.round(b.w * b.d * 1.6) }, () => ({
      x: b.x + rng.range(-b.w / 2 + 0.2, b.w / 2 - 0.2),
      z: b.z + rng.range(-b.d / 2 + 0.2, b.d / 2 - 0.2),
      scale: rng.range(0.9, 1.5),
      turn: rng.range(0, Math.PI * 2),
    })),
  );
}

/** The decorative props around the battlefield, and the reeds in its thickets. */
function Scenery({ map, playerTeam }: { map: MapDef; playerTeam: number }) {
  const layout = useMemo(() => layoutScenery(map, playerTeam), [map, playerTeam]);
  const reeds = useMemo(() => reedBeds(map), [map]);
  const props = useMemo(() => buildProps(), []);
  const material = useMemo(() => propMaterial(), []);
  return (
    <>
      {Object.keys(layout).map((key) =>
        props[key] ? (
          <Props
            key={key}
            geometry={props[key]}
            material={material}
            items={layout[key]!}
            castShadow={!NO_SHADOW.has(key)}
          />
        ) : null,
      )}
      <Props geometry={props.reed} material={material} items={reeds} castShadow={false} />
    </>
  );
}

/** Static map: sand, the paved lane, the bases and walls. `detailed` adds the decorative props. */
export function Terrain({ map, playerTeam, detailed }: { map: MapDef; playerTeam: number; detailed: boolean }) {
  const laneLength = map.shrines[1].x - map.shrines[0].x + 16;
  return (
    <group>
      <mesh rotation={FLAT} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[map.halfWidth * 6, map.halfDepth * 8]} />
        <meshStandardMaterial color={COLORS.outside} />
      </mesh>
      <mesh rotation={FLAT} receiveShadow>
        <planeGeometry args={[map.halfWidth * 2, map.halfDepth * 2]} />
        <meshStandardMaterial color={COLORS.ground} />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[laneLength, 12]} />
        <meshStandardMaterial color={COLORS.lane} />
      </mesh>
      {/* Kerbs along both edges of the lane. */}
      {[-6.2, 6.2].map((z) => (
        <mesh key={z} position={[0, 0.06, z]} receiveShadow>
          <boxGeometry args={[laneLength, 0.12, 0.45]} />
          <meshStandardMaterial color={COLORS.kerb} />
        </mesh>
      ))}
      <Bases map={map} playerTeam={playerTeam} lit={detailed} />
      {/* The box is the real blocked area. With detail on it is a low base under the rocks. */}
      {map.obstacles.map((o, i) => (
        <mesh key={i} position={[o.x, detailed ? 0.3 : 1, o.z]} receiveShadow>
          <boxGeometry args={[o.w, detailed ? 0.6 : 2, o.d]} />
          <meshStandardMaterial color={COLORS.wall} />
        </mesh>
      ))}
      {/* Papyrus thickets: units inside are hidden from enemies outside. */}
      {map.bushes.map((b, i) => (
        <mesh key={i} position={[b.x, 0.55, b.z]}>
          <boxGeometry args={[b.w, 1.1, b.d]} />
          <meshStandardMaterial color={COLORS.bush} transparent opacity={0.55} depthWrite={false} />
        </mesh>
      ))}
      {map.camps.map((camp, i) => (
        <mesh key={i} rotation={FLAT} position={[camp.pos.x, 0.02, camp.pos.z + 0.4]}>
          <ringGeometry args={[3.2, 3.5, 40]} />
          <meshBasicMaterial color={COLORS.monster} transparent opacity={0.35} />
        </mesh>
      ))}
      {detailed && <Scenery map={map} playerTeam={playerTeam} />}
    </group>
  );
}
