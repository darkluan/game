import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, type InstancedMesh, Object3D, Vector3 } from 'three';
import { HERO, NEUTRAL, type Vec2 } from '@game/core';
import type { GameSession } from '@/lib/session';
import { COLORS, teamColor } from './palette';

const MAX_MINIONS = 160;
const MAX_BARS = 220;

/**
 * With `simpleMinions` (low graphics), the minions as plain shapes: one draw call per shape however
 * many there are. What flies between units is drawn in Shots.
 */
export function Swarm({ game, simpleMinions }: { game: GameSession; simpleMinions: boolean }) {
  const melee = useRef<InstancedMesh>(null);
  const ranged = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => ({ dummy: new Object3D(), color: new Color(), pos: { x: 0, z: 0 } as Vec2 }), []);

  useFrame(() => {
    const { dummy, color, pos } = scratch;
    const counts = { melee: 0, ranged: 0 };
    for (const m of simpleMinions ? game.minions() : []) {
      // The marching Ancient Beast is drawn as an oversized melee minion.
      const shape = m.minion.type === 'ranged' ? 'ranged' : 'melee';
      const size = m.minion.type === 'beast' ? 3 : 1;
      const mesh = (shape === 'melee' ? melee : ranged).current;
      if (!mesh || m.dead || counts[shape] >= MAX_MINIONS) continue;
      const p = game.renderPos(m, pos);
      dummy.position.set(p.x, (shape === 'melee' ? 0.5 : 0.6) * size, p.z);
      dummy.rotation.set(0, m.facing, 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      const i = counts[shape]++;
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, color.set(teamColor(m.team, game.hero.team)));
    }
    for (const [mesh, count] of [
      [melee.current, counts.melee],
      [ranged.current, counts.ranged],
    ] as const) {
      if (!mesh) continue;
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={melee} args={[undefined, undefined, MAX_MINIONS]} frustumCulled={false}>
        <boxGeometry args={[0.8, 1, 0.8]} />
        <meshStandardMaterial />
      </instancedMesh>
      <instancedMesh ref={ranged} args={[undefined, undefined, MAX_MINIONS]} frustumCulled={false}>
        <coneGeometry args={[0.45, 1.2, 8]} />
        <meshStandardMaterial />
      </instancedMesh>
    </>
  );
}

const BEAST_BAR = { y: 5.2, w: 3.6, h: 0.32 };
const BAR: Record<string, { y: number; w: number; h: number }> = {
  hero: { y: 3, w: 1.9, h: 0.26 },
  minion: { y: 1.6, w: 1, h: 0.14 },
  monster: { y: 2.2, w: 1.5, h: 0.18 },
  turret: { y: 1.9, w: 1.1, h: 0.14 },
  tower: { y: 7.6, w: 3.2, h: 0.3 },
  shrine: { y: 10.4, w: 4.4, h: 0.34 },
};

/** Health bars for every unit: camera-facing quads, drawn as two instanced meshes. */
export function HealthBars({ game }: { game: GameSession }) {
  const back = useRef<InstancedMesh>(null);
  const fill = useRef<InstancedMesh>(null);
  const scratch = useMemo(
    () => ({ dummy: new Object3D(), color: new Color(), right: new Vector3(), pos: { x: 0, z: 0 } as Vec2 }),
    [],
  );

  useFrame(({ camera }) => {
    const b = back.current;
    const f = fill.current;
    if (!b || !f) return;
    const { dummy, color, right, pos } = scratch;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    dummy.quaternion.copy(camera.quaternion);
    let n = 0;
    for (const e of game.units()) {
      const beast = e.monster?.type === 'beast' || e.minion?.type === 'beast';
      const bar = beast ? BEAST_BAR : BAR[e.kind];
      if (!bar || e.dead || n >= MAX_BARS) continue;
      const p = game.renderPos(e, pos);
      const pct = Math.max(0, Math.min(1, e.health.hp / e.health.maxHp));
      // Bars sit above the model: higher for an evolved dragon or a big monster.
      const lift = e.kind === 'hero' ? e.radius / HERO.radius : e.monster?.type === 'big' ? 1.6 : 1;
      dummy.position.set(p.x, bar.y * lift, p.z);
      dummy.scale.set(bar.w + 0.08, bar.h + 0.08, 1);
      dummy.updateMatrix();
      b.setMatrixAt(n, dummy.matrix);
      // Shrink the fill and shift it so it stays anchored to the bar's left edge.
      dummy.position.addScaledVector(right, (-bar.w * (1 - pct)) / 2);
      dummy.scale.set(Math.max(0.001, bar.w * pct), bar.h, 1);
      dummy.updateMatrix();
      f.setMatrixAt(n, dummy.matrix);
      const tone =
        e.id === game.hero.id ? COLORS.hp : e.team === NEUTRAL ? COLORS.monster : teamColor(e.team, game.hero.team);
      f.setColorAt(n, color.set(tone));
      n++;
    }
    b.count = n;
    f.count = n;
    b.instanceMatrix.needsUpdate = true;
    f.instanceMatrix.needsUpdate = true;
    if (f.instanceColor) f.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={back} args={[undefined, undefined, MAX_BARS]} frustumCulled={false} renderOrder={10}>
        <planeGeometry />
        <meshBasicMaterial color={COLORS.barBack} depthTest={false} transparent />
      </instancedMesh>
      <instancedMesh ref={fill} args={[undefined, undefined, MAX_BARS]} frustumCulled={false} renderOrder={11}>
        <planeGeometry />
        <meshBasicMaterial depthTest={false} transparent />
      </instancedMesh>
    </>
  );
}
