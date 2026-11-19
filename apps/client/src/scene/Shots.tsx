import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  type Group,
  type InstancedMesh,
  type Mesh,
  Object3D,
  Quaternion,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';
import type { Vec2 } from '@game/core';
import { aimOf } from '@/input/commands';
import { STRIKE_SECONDS } from '@/lib/baseSession';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { COLORS, teamColor } from './palette';

/**
 * Everything that flies from one unit at another, and the mark on what the player is attacking.
 * A shot is a comet: a hot white heart in a halo of its side's colour, trailing lights that fade
 * behind it. A tower throws no shot at all but lightning, from its point to its target. Each of
 * these is one draw call however many are in the air.
 */

const MAX_SHOTS = 160;
/** How many lights trail behind a shot, and how far apart in frames. */
const TRAIL = 4;
const MAX_GLOWS = MAX_SHOTS * (TRAIL + 1) + 48;
/** A stroke of lightning is this many pieces end to end, with one short fork off its middle. */
const PIECES = 8;
const FORK = 3;
const MAX_PIECES = 16 * (PIECES + FORK);
/** How often the lightning takes a new path, in seconds: this is what makes it flicker. */
const FLICKER = 0.055;
const SHOT_HEIGHT = 1.2;
const UP = new Vector3(0, 1, 0);

/** A soft round light, bright at the heart and gone at the rim. */
function glowPicture(): Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.3, 'rgba(255,255,255,0.5)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  const picture = new CanvasTexture(canvas);
  picture.colorSpace = SRGBColorSpace;
  return picture;
}

/** A number from 0 to 1 that is always the same for the same three inputs: the lightning's dice. */
function dice(a: number, b: number, c: number): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function Shots({ game }: { game: GameSession }) {
  const hearts = useRef<InstancedMesh>(null);
  const glows = useRef<InstancedMesh>(null);
  const arcs = useRef<InstancedMesh>(null);
  const cores = useRef<InstancedMesh>(null);
  const picture = useMemo(() => glowPicture(), []);
  const scratch = useMemo(
    () => ({
      dummy: new Object3D(),
      color: new Color(),
      pos: { x: 0, z: 0 } as Vec2,
      from: new Vector3(),
      to: new Vector3(),
      along: new Vector3(),
      side: new Vector3(),
      turn: new Quaternion(),
    }),
    [],
  );
  /** Where each shot has been lately, newest first, by its id; and a count of frames, to tell which shots are gone. */
  const memory = useRef({ trails: new Map<number, { points: number[]; seen: number }>(), frame: 0 });

  useFrame(({ camera }) => {
    const { dummy, color, pos, from, to, along, side, turn } = scratch;
    const { trails } = memory.current;
    const frame = ++memory.current.frame;
    const heartMesh = hearts.current;
    const glowMesh = glows.current;
    const arcMesh = arcs.current;
    const coreMesh = cores.current;
    if (!heartMesh || !glowMesh || !arcMesh || !coreMesh) return;
    let heartCount = 0;
    let glowCount = 0;

    /** A light that always faces the camera. `strength` dims it: on a black-is-nothing blend, darker is fainter. */
    const light = (x: number, y: number, z: number, size: number, tint: string, strength: number) => {
      if (glowCount >= MAX_GLOWS) return;
      dummy.position.set(x, y, z);
      dummy.quaternion.copy(camera.quaternion);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      glowMesh.setMatrixAt(glowCount, dummy.matrix);
      glowMesh.setColorAt(glowCount, color.set(tint).multiplyScalar(strength));
      glowCount++;
    };

    for (const shot of game.projectiles()) {
      if (shot.dead || heartCount >= MAX_SHOTS) continue;
      const p = game.renderPos(shot, pos);
      const tint = teamColor(shot.team, game.hero.team);
      let trail = trails.get(shot.id);
      if (!trail) {
        trail = { points: [], seen: frame };
        trails.set(shot.id, trail);
      }
      trail.seen = frame;
      trail.points.unshift(p.x, p.z);
      trail.points.length = Math.min(trail.points.length, TRAIL * 4);
      dummy.position.set(p.x, SHOT_HEIGHT, p.z);
      dummy.quaternion.identity();
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      heartMesh.setMatrixAt(heartCount, dummy.matrix);
      // Nearly white, with a breath of its side's colour.
      heartMesh.setColorAt(heartCount, color.set(tint).lerp(WHITE, 0.75));
      heartCount++;
      light(p.x, SHOT_HEIGHT, p.z, 1.5, tint, 1);
      // Every other remembered place, so the tail has length even at a high frame rate.
      for (let i = 1; i <= TRAIL; i++) {
        const at = i * 4;
        if (at + 1 >= trail.points.length) break;
        light(trail.points[at], SHOT_HEIGHT, trail.points[at + 1], 1.2 - i * 0.2, tint, 0.7 - i * 0.14);
      }
    }
    // Forget the shots that have landed.
    if (frame % 30 === 0) for (const [id, trail] of trails) if (frame - trail.seen > 2) trails.delete(id);

    let pieceCount = 0;
    const piece = (thick: number, tint: string, strength: number) => {
      if (pieceCount >= MAX_PIECES) return;
      along.subVectors(to, from);
      const length = along.length();
      dummy.position.copy(from).addScaledVector(along, 0.5);
      dummy.quaternion.copy(turn.setFromUnitVectors(UP, along.normalize()));
      dummy.scale.set(thick, length, thick);
      dummy.updateMatrix();
      arcMesh.setMatrixAt(pieceCount, dummy.matrix);
      arcMesh.setColorAt(pieceCount, color.set(tint).multiplyScalar(strength));
      dummy.scale.set(thick * 0.34, length, thick * 0.34);
      dummy.updateMatrix();
      coreMesh.setMatrixAt(pieceCount, dummy.matrix);
      coreMesh.setColorAt(pieceCount, color.set('#ffffff').multiplyScalar(strength));
      pieceCount++;
    };
    for (const strike of game.strikes) {
      const age = (game.clock - strike.at) / STRIKE_SECONDS;
      if (age < 0 || age >= 1) continue;
      const tint = COLORS[strike.color as keyof typeof COLORS] ?? COLORS.neutral;
      // Bright at once, then dying away; and thinner as it dies.
      const strength = 1 - age * age;
      const thick = 0.3 * (1 - age * 0.6);
      const flick = Math.floor((game.clock - strike.at) / FLICKER);
      const span = Math.hypot(strike.x2 - strike.x, strike.y2 - strike.y, strike.z2 - strike.z);
      side.set(strike.z2 - strike.z, 0, strike.x - strike.x2).normalize();
      /** A point on the stroke, thrown off its straight line, most in the middle and not at all at the ends. */
      const point = (out: Vector3, t: number, key: number) => {
        const sway = Math.sin(Math.PI * t) * span * 0.07;
        out.set(
          strike.x + (strike.x2 - strike.x) * t,
          strike.y + (strike.y2 - strike.y) * t + (dice(strike.at, flick, key + 50) - 0.5) * sway * 2,
          strike.z + (strike.z2 - strike.z) * t,
        );
        return out.addScaledVector(side, (dice(strike.at, flick, key) - 0.5) * sway * 2);
      };
      for (let i = 0; i < PIECES; i++) {
        point(from, i / PIECES, i);
        point(to, (i + 1) / PIECES, i + 1);
        piece(thick, tint, strength);
      }
      // The fork: off the middle, out to one side and down, shorter and fainter.
      point(to, 0.5, PIECES / 2);
      for (let i = 0; i < FORK; i++) {
        from.copy(to);
        to.addScaledVector(side, (dice(strike.at, flick, 90 + i) - 0.3) * span * 0.1);
        to.setY(to.y - span * 0.07);
        piece(thick * 0.6, tint, strength * 0.7);
      }
      light(strike.x, strike.y, strike.z, 4.5 * strength, tint, strength);
      light(strike.x2, strike.y2, strike.z2, 3.2 * strength, tint, strength);
    }

    heartMesh.count = heartCount;
    glowMesh.count = glowCount;
    arcMesh.count = coreMesh.count = pieceCount;
    for (const mesh of [heartMesh, glowMesh, arcMesh, coreMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={hearts} args={[undefined, undefined, MAX_SHOTS]} frustumCulled={false}>
        <sphereGeometry args={[0.16, 8, 8]} />
        <meshBasicMaterial />
      </instancedMesh>
      <instancedMesh ref={glows} args={[undefined, undefined, MAX_GLOWS]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={picture} transparent depthWrite={false} blending={AdditiveBlending} />
      </instancedMesh>
      <instancedMesh ref={arcs} args={[undefined, undefined, MAX_PIECES]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 5, 1, true]} />
        <meshBasicMaterial transparent opacity={0.75} depthWrite={false} blending={AdditiveBlending} />
      </instancedMesh>
      <instancedMesh ref={cores} args={[undefined, undefined, MAX_PIECES]} frustumCulled={false}>
        <cylinderGeometry args={[0.5, 0.5, 1, 5, 1, true]} />
        <meshBasicMaterial transparent depthWrite={false} blending={AdditiveBlending} />
      </instancedMesh>
    </>
  );
}

const WHITE = new Color('#ffffff');
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/**
 * The mark on what the player has told their hero to attack: a ring on the ground under it that
 * turns and breathes, with four points closing in. Shown while that target is alive and in sight.
 */
export function TargetMark({ game }: { game: GameSession }) {
  const mark = useRef<Group>(null);
  const pos = useMemo(() => ({ x: 0, z: 0 }) as Vec2, []);
  useFrame(() => {
    const group = mark.current;
    if (!group) return;
    const target = game.focus();
    group.visible = target !== undefined;
    if (!target) return;
    const p = game.renderPos(target, pos);
    group.position.set(p.x, 0.24, p.z);
    group.rotation.y = game.clock * 1.6;
    group.scale.setScalar((target.radius + 0.75) * (1 + Math.sin(game.clock * 6) * 0.05));
  });
  return (
    <group ref={mark} visible={false}>
      <mesh rotation={FLAT}>
        <ringGeometry args={[0.86, 1, 40]} />
        <meshBasicMaterial color={COLORS.enemy} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh rotation={FLAT}>
        <ringGeometry args={[0.68, 0.72, 40]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 1.22, 0, Math.cos(a) * 1.22]} rotation={[Math.PI / 2, 0, a]}>
            <coneGeometry args={[0.13, 0.34, 3]} />
            <meshBasicMaterial color={COLORS.enemy} />
          </mesh>
        );
      })}
    </group>
  );
}

/** How wide a shot down a line is drawn when the ability does not say. */
const DEFAULT_WIDTH = 1.2;
const AIM_COLOR = '#fff4c8';
/** How thick the hard lines of the drawing are. */
const EDGE = 0.09;
/** Clear of the paving of a base, which stands a little proud of the ground. */
const AIM_LIFT = 0.25;

/**
 * Where the ability the player is holding would land, drawn on the ground before it is cast: a
 * thin ring at its reach, and inside that a strip for one thrown along a line, a disc for one that
 * falls on an area or bursts round the hero, or a line to the enemy it would pick. With no enemy in
 * reach for an ability that needs one, only the ring shows, which says as much.
 */
export function AimPreview({ game }: { game: GameSession }) {
  const reach = useRef<Mesh>(null);
  const strip = useRef<Mesh>(null);
  const edges = useRef<(Mesh | null)[]>([]);
  const area = useRef<Mesh>(null);
  const rim = useRef<Mesh>(null);
  const pos = useMemo(() => ({ x: 0, z: 0 }) as Vec2, []);
  useFrame(() => {
    const parts = [reach.current, strip.current, area.current, rim.current];
    if (parts.some((part) => !part)) return;
    const [reachMesh, stripMesh, areaMesh, rimMesh] = parts as Mesh[];
    for (const part of parts as Mesh[]) part.visible = false;
    for (const edge of edges.current) if (edge) edge.visible = false;
    const slot = useGameStore.getState().aimSlot;
    if (!slot) return;
    const def = game.ability(slot);
    const hero = game.renderPos(game.hero, pos);
    const [hx, hz] = [hero.x, hero.z];
    const radius = def.params.radius?.[0];
    if (def.range > 0) {
      reachMesh.visible = true;
      reachMesh.position.set(hx, AIM_LIFT, hz);
      reachMesh.scale.setScalar(def.range);
    }
    const disc = (x: number, z: number, size: number) => {
      for (const part of [areaMesh, rimMesh]) {
        part.visible = true;
        part.position.set(x, AIM_LIFT + 0.01, z);
        part.scale.setScalar(size);
      }
    };
    const line = (x: number, z: number, width: number, length?: number) => {
      const [dx, dz] = [x - hx, z - hz];
      const far = Math.hypot(dx, dz) || 1;
      const long = length ?? far;
      stripMesh.visible = true;
      stripMesh.position.set(hx + (dx / far) * long * 0.5, AIM_LIFT + 0.005, hz + (dz / far) * long * 0.5);
      stripMesh.rotation.set(-Math.PI / 2, 0, Math.atan2(dx, dz) + Math.PI);
      stripMesh.scale.set(width, long, 1);
      // A hard line down each side and across the far end: the pale fill alone is lost on pale ground.
      const [ax, az] = [dx / far, dz / far];
      edges.current.forEach((edge, i) => {
        if (!edge) return;
        edge.visible = true;
        edge.rotation.copy(stripMesh.rotation);
        if (i < 2) {
          const off = (i ? 1 : -1) * width * 0.5;
          edge.position.set(hx + ax * long * 0.5 + az * off, AIM_LIFT + 0.01, hz + az * long * 0.5 - ax * off);
          edge.scale.set(EDGE, long, 1);
        } else {
          edge.position.set(hx + ax * long, AIM_LIFT + 0.01, hz + az * long);
          edge.scale.set(width, EDGE, 1);
        }
      });
    };
    const where = aimOf(game, slot, null);
    if (where.on === 'self') disc(hx, hz, radius ?? game.hero.radius + 0.8);
    else if (where.on === 'unit') {
      if (!where.target) return;
      line(where.target.pos.x, where.target.pos.z, 0.25);
      disc(where.target.pos.x, where.target.pos.z, where.target.radius + 0.6);
    } else if (def.targeting === 'direction')
      line(where.point.x, where.point.z, def.params.width?.[0] ?? DEFAULT_WIDTH, def.range);
    else {
      // It cannot fall farther off than it reaches.
      const [dx, dz] = [where.point.x - hx, where.point.z - hz];
      const far = Math.hypot(dx, dz) || 1;
      const short = Math.min(1, def.range / far);
      disc(hx + dx * short, hz + dz * short, radius ?? 1);
    }
  });
  return (
    <>
      <mesh ref={reach} rotation={FLAT} visible={false}>
        <ringGeometry args={[0.985, 1, 72]} />
        <meshBasicMaterial color={AIM_COLOR} transparent opacity={0.75} depthWrite={false} />
      </mesh>
      <mesh ref={strip} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(mesh) => void (edges.current[i] = mesh)} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={AIM_COLOR} transparent opacity={0.9} depthWrite={false} />
        </mesh>
      ))}
      <mesh ref={area} rotation={FLAT} visible={false}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.26} depthWrite={false} />
      </mesh>
      <mesh ref={rim} rotation={FLAT} visible={false}>
        <ringGeometry args={[0.95, 1, 48]} />
        <meshBasicMaterial color={AIM_COLOR} transparent opacity={0.8} depthWrite={false} />
      </mesh>
    </>
  );
}
