import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, type InstancedMesh, Object3D, Vector3 } from 'three';
import type { Vec2 } from '@game/core';
import type { GameSession } from '@/lib/session';
import { COLORS, teamColor } from './palette';

const MAX_MINIONS = 160;
const MAX_PROJECTILES = 160;
const MAX_BARS = 220;

/**
 * Projectiles always, and with `simpleMinions` (low graphics) the minions too as plain shapes:
 * one draw call per shape however many there are.
 */
export function Swarm({ game, simpleMinions }: { game: GameSession; simpleMinions: boolean }) {
  const melee = useRef<InstancedMesh>(null);
  const ranged = useRef<InstancedMesh>(null);
  const shots = useRef<InstancedMesh>(null);
  const scratch = useMemo(() => ({ dummy: new Object3D(), color: new Color(), pos: { x: 0, z: 0 } as Vec2 }), []);

  useFrame(() => {
    const { dummy, color, pos } = scratch;
    const counts = { melee: 0, ranged: 0 };
    for (const m of simpleMinions ? game.minions() : []) {
      const mesh = (m.minion.type === 'melee' ? melee : ranged).current;
      if (!mesh || m.dead || counts[m.minion.type] >= MAX_MINIONS) continue;
      const p = game.renderPos(m, pos);
      dummy.position.set(p.x, m.minion.type === 'melee' ? 0.5 : 0.6, p.z);
      dummy.rotation.set(0, m.facing, 0);
      dummy.updateMatrix();
      const i = counts[m.minion.type]++;
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

    const mesh = shots.current;
    if (!mesh) return;
    let n = 0;
    dummy.rotation.set(0, 0, 0);
    for (const s of game.projectiles()) {
      if (s.dead || n >= MAX_PROJECTILES) continue;
      const p = game.renderPos(s, pos);
      dummy.position.set(p.x, 1.2, p.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, color.set(teamColor(s.team, game.hero.team)));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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
      <instancedMesh ref={shots} args={[undefined, undefined, MAX_PROJECTILES]} frustumCulled={false}>
        <sphereGeometry args={[0.22, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
    </>
  );
}

const BAR: Record<string, { y: number; w: number; h: number }> = {
  hero: { y: 3, w: 1.9, h: 0.26 },
  minion: { y: 1.6, w: 1, h: 0.14 },
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
      const bar = BAR[e.kind];
      if (!bar || e.dead || n >= MAX_BARS) continue;
      const p = game.renderPos(e, pos);
      const pct = Math.max(0, Math.min(1, e.health.hp / e.health.maxHp));
      dummy.position.set(p.x, bar.y, p.z);
      dummy.scale.set(bar.w + 0.08, bar.h + 0.08, 1);
      dummy.updateMatrix();
      b.setMatrixAt(n, dummy.matrix);
      // Shrink the fill and shift it so it stays anchored to the bar's left edge.
      dummy.position.addScaledVector(right, (-bar.w * (1 - pct)) / 2);
      dummy.scale.set(Math.max(0.001, bar.w * pct), bar.h, 1);
      dummy.updateMatrix();
      f.setMatrixAt(n, dummy.matrix);
      f.setColorAt(n, color.set(e === game.hero ? COLORS.hp : teamColor(e.team, game.hero.team)));
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
