import { useLayoutEffect, useMemo, useRef } from 'react';
import { type InstancedMesh, Object3D } from 'three';
import { type MapDef, Rng } from '@game/core';
import { firstMesh, MODELS, useModel } from './models';
import { COLORS } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

interface Placement {
  x: number;
  z: number;
  scale: number;
  turn: number;
}

/** Many copies of one prop model in a single draw call. */
function Props({ model, items, castShadow }: { model: string; items: Placement[]; castShadow: boolean }) {
  const gltf = useModel(model);
  const source = useMemo(() => firstMesh(gltf.scene), [gltf]);
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

  return (
    <instancedMesh
      ref={ref}
      args={[source.geometry, source.material, items.length]}
      castShadow={castShadow}
      receiveShadow
    />
  );
}

/** Rocks heaped over every wall, and a forest around the outside of the map. Purely decorative. */
function Scenery({ map }: { map: MapDef }) {
  const { rocks, treesA, treesB } = useMemo(() => {
    // Fixed seed: the scenery looks the same every match.
    const rng = new Rng(20260);
    const rocks: Placement[] = [];
    for (const o of map.obstacles) {
      const count = Math.round((o.w * o.d) / 2.2);
      for (let i = 0; i < count; i++) {
        rocks.push({
          x: o.x + rng.range(-o.w / 2 + 0.6, o.w / 2 - 0.6),
          z: o.z + rng.range(-o.d / 2 + 0.4, o.d / 2 - 0.4),
          scale: rng.range(6, 10),
          turn: rng.range(0, Math.PI * 2),
        });
      }
    }
    const treesA: Placement[] = [];
    const treesB: Placement[] = [];
    const margin = 16;
    for (let i = 0; i < 420; i++) {
      const x = rng.range(-map.halfWidth - margin, map.halfWidth + margin);
      const z = rng.range(-map.halfDepth - margin, map.halfDepth + margin);
      // Only outside the playable rectangle: a tree on the map would look like an obstacle but not be one.
      if (Math.abs(x) < map.halfWidth + 1.5 && Math.abs(z) < map.halfDepth + 1.5) continue;
      (i % 2 === 0 ? treesA : treesB).push({ x, z, scale: rng.range(4.5, 7.5), turn: rng.range(0, Math.PI * 2) });
    }
    return { rocks, treesA, treesB };
  }, [map]);

  return (
    <>
      <Props model={MODELS.rock} items={rocks} castShadow />
      <Props model={MODELS.treeA} items={treesA} castShadow={false} />
      <Props model={MODELS.treeB} items={treesB} castShadow={false} />
    </>
  );
}

/** Static map: ground, the lane, fountains and walls. `detailed` adds the decorative models. */
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
      {map.fountains.map((f, team) => (
        <mesh key={team} rotation={FLAT} position={[f.x, 0.02, f.z]}>
          <circleGeometry args={[6, 40]} />
          <meshStandardMaterial color={team === playerTeam ? COLORS.ally : COLORS.enemy} transparent opacity={0.35} />
        </mesh>
      ))}
      {/* The box is the real blocked area. With detail on it is a low base under the rocks. */}
      {map.obstacles.map((o, i) => (
        <mesh key={i} position={[o.x, detailed ? 0.3 : 1, o.z]} receiveShadow>
          <boxGeometry args={[o.w, detailed ? 0.6 : 2, o.d]} />
          <meshStandardMaterial color={COLORS.wall} />
        </mesh>
      ))}
      {detailed && <Scenery map={map} />}
    </group>
  );
}
