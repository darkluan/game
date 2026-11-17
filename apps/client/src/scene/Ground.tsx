import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { Vec2 } from '@game/core';
import type { GameSession } from '@/lib/session';
import { COLORS, teamColor } from './palette';

const ZONES = 16;
const SUMMONS = 14;
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** Burning ground and darkness: discs sized to the area they affect. */
export function Zones({ game }: { game: GameSession }) {
  const meshes = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const zones = game.zones();
    for (let i = 0; i < ZONES; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const zone = zones[i];
      mesh.visible = zone !== undefined && !zone.dead;
      if (!zone) continue;
      const burn = zone.zone?.effect === 'burn';
      mesh.position.set(zone.pos.x, burn ? 0.05 : 0.09, zone.pos.z);
      mesh.scale.setScalar(zone.radius);
      const material = mesh.material as MeshBasicMaterial;
      material.color.set(burn ? COLORS.burn : COLORS.blind);
      // Fire flickers; darkness sits still and heavy.
      material.opacity = burn ? 0.35 + 0.15 * Math.sin(game.clock * 14 + i) : 0.82;
    }
  });

  return Array.from({ length: ZONES }, (_, i) => (
    <mesh key={i} ref={(m) => void (meshes.current[i] = m)} rotation={FLAT} visible={false}>
      <circleGeometry args={[1, 40]} />
      <meshBasicMaterial transparent depthWrite={false} />
    </mesh>
  ));
}

/** Turrets and traps, drawn from a fixed pool of simple shapes. */
export function Summons({ game }: { game: GameSession }) {
  const groups = useRef<(Group | null)[]>([]);
  const pos = useRef<Vec2>({ x: 0, z: 0 });

  useFrame(() => {
    const summons = game.summons();
    for (let i = 0; i < SUMMONS; i++) {
      const group = groups.current[i];
      if (!group) continue;
      const summon = summons[i];
      group.visible = summon !== undefined && !summon.dead;
      if (!summon) continue;
      const p = game.renderPos(summon, pos.current);
      group.position.set(p.x, 0, p.z);
      group.rotation.y = summon.facing;
      const [turret, trap] = group.children;
      turret.visible = summon.kind === 'turret';
      trap.visible = summon.kind === 'trap';
      const color = teamColor(summon.team, game.hero.team);
      group.traverse((o) => {
        const material = (o as Mesh).material as MeshBasicMaterial | undefined;
        if (material?.name === 'team') material.color.set(color);
      });
    }
  });

  return Array.from({ length: SUMMONS }, (_, i) => (
    <group key={i} ref={(g) => void (groups.current[i] = g)} visible={false}>
      <group>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.6, 0.9, 8]} />
          <meshStandardMaterial color={COLORS.steel} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.05, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 1, 8]} />
          <meshStandardMaterial name="team" />
        </mesh>
        <mesh position={[0, 1.05, 0]}>
          <sphereGeometry args={[0.32, 10, 10]} />
          <meshStandardMaterial name="team" />
        </mesh>
      </group>
      <group>
        <mesh rotation={FLAT} position={[0, 0.06, 0]}>
          <ringGeometry args={[0.35, 0.6, 8]} />
          <meshBasicMaterial name="team" />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <coneGeometry args={[0.18, 0.3, 6]} />
          <meshStandardMaterial color={COLORS.steel} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </group>
  ));
}
