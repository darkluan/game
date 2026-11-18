import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { AdditiveBlending, type Mesh, type MeshStandardMaterial } from 'three';
import type { MapDef } from '@game/core';
import { COLORS } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
const STONE = '#7d838c';
const STONE_DARK = '#5a606a';
/** Matches HERO.fountainRadius: the paved circle is exactly where standing heals. */
const FOUNTAIN_RADIUS = 6;
const RUNES = 6;

/** The healing fountain: a paved circle with a basin of glowing water and a crystal turning above it. */
function Fountain({ x, z, color, lit }: { x: number; z: number; color: string; lit: boolean }) {
  const crystal = useRef<Mesh>(null);
  const water = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (crystal.current) {
      crystal.current.rotation.y = t * 0.9;
      crystal.current.position.y = 2.3 + Math.sin(t * 1.6) * 0.18;
    }
    if (water.current)
      (water.current.material as MeshStandardMaterial).emissiveIntensity = 0.45 + Math.sin(t * 2.2) * 0.15;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[FOUNTAIN_RADIUS + 0.4, FOUNTAIN_RADIUS + 0.7, 0.12, 40]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      {/* The edge of the healing area, inlaid in the team's colour. */}
      <mesh rotation={FLAT} position={[0, 0.13, 0]}>
        <ringGeometry args={[FOUNTAIN_RADIUS - 0.35, FOUNTAIN_RADIUS, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.13, 0]}>
        <ringGeometry args={[3.5, 3.62, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      {Array.from({ length: RUNES }, (_, i) => {
        const a = (i / RUNES) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 4.7, 0.45, Math.cos(a) * 4.7]} rotation={[0, a, 0]} castShadow>
            <boxGeometry args={[0.55, 0.9, 0.35]} />
            <meshStandardMaterial color={STONE_DARK} emissive={color} emissiveIntensity={0.35} />
          </mesh>
        );
      })}
      {/* The basin wall, the water in it and the pedestal the crystal floats over. */}
      <mesh rotation={FLAT} position={[0, 0.34, 0]} castShadow>
        <torusGeometry args={[2.6, 0.3, 8, 28]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      <mesh ref={water} rotation={FLAT} position={[0, 0.42, 0]}>
        <circleGeometry args={[2.55, 32]} />
        <meshStandardMaterial color="#2c7fb8" emissive={color} emissiveIntensity={0.45} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 0.8, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.6, 1.2, 8]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
      <mesh ref={crystal} position={[0, 2.3, 0]}>
        <octahedronGeometry args={[0.75]} />
        <meshStandardMaterial color="#ffffff" emissive={color} emissiveIntensity={1.6} flatShading />
      </mesh>
      {/* A soft shaft of light rising from the water. */}
      <mesh position={[0, 3.6, 0]}>
        <cylinderGeometry args={[0.5, 2.3, 6.4, 20, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.07} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {lit && <pointLight color={color} intensity={14} distance={14} position={[0, 3, 0]} />}
    </group>
  );
}

/** A stepped stone footing with a ring in the team's colour, for a tower or a shrine to stand on. */
function Plinth({ x, z, radius, color }: { x: number; z: number; radius: number; color: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI / 8, 0]}>
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <cylinderGeometry args={[radius + 0.7, radius + 1, 0.14, 8]} />
        <meshStandardMaterial color={STONE_DARK} />
      </mesh>
      <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[radius, radius + 0.25, 0.26, 8]} />
        <meshStandardMaterial color={STONE} />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.34, 0]}>
        <ringGeometry args={[radius - 0.45, radius - 0.2, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      {/* Four short posts at the corners. */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (radius + 0.3), 0.5, Math.cos(a) * (radius + 0.3)]} castShadow>
            <cylinderGeometry args={[0.16, 0.22, 0.9, 6]} />
            <meshStandardMaterial color={STONE_DARK} emissive={color} emissiveIntensity={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

/**
 * Everything built on each team's ground: the paved base from the map's edge to past the shrine,
 * the healing fountain, and the footings of the towers and the shrine. `lit` adds the fountain's glow light.
 */
export function Bases({ map, playerTeam, lit }: { map: MapDef; playerTeam: number; lit: boolean }) {
  const colorOf = (team: number) => (team === playerTeam ? COLORS.ally : COLORS.enemy);
  return (
    <>
      {map.shrines.map((shrine, team) => {
        const side = Math.sign(shrine.x);
        // From a little in front of the shrine out to the edge of the map.
        const inner = Math.abs(shrine.x) - 7;
        const width = map.halfWidth - inner;
        const centre = side * (inner + width / 2);
        return (
          <group key={team}>
            <mesh rotation={FLAT} position={[centre, 0.02, 0]} receiveShadow>
              <planeGeometry args={[width, 15]} />
              <meshStandardMaterial color="#666c76" />
            </mesh>
            {[-7.5, 7.5].map((edge) => (
              <mesh key={edge} position={[centre, 0.1, edge]} receiveShadow>
                <boxGeometry args={[width, 0.2, 0.5]} />
                <meshStandardMaterial color={STONE_DARK} />
              </mesh>
            ))}
            <mesh rotation={FLAT} position={[side * (inner + 0.25), 0.03, 0]}>
              <planeGeometry args={[0.5, 15]} />
              <meshBasicMaterial color={colorOf(team)} transparent opacity={0.6} />
            </mesh>
            <Plinth x={shrine.x} z={shrine.z} radius={3.6} color={colorOf(team)} />
            <Fountain x={map.fountains[team].x} z={map.fountains[team].z} color={colorOf(team)} lit={lit} />
          </group>
        );
      })}
      {map.towers.map((tower, i) => (
        <Plinth key={i} x={tower.pos.x} z={tower.pos.z} radius={2.3} color={colorOf(tower.team)} />
      ))}
    </>
  );
}
