import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  type Mesh,
  type MeshBasicMaterial,
  Vector3,
} from 'three';
import type { Fx, FxShape, GameSession } from '@/lib/session';
import { COLORS } from './palette';

/** How many of each shape can be on screen at once; extra ones are simply not drawn. */
const POOL: Record<FxShape, number> = {
  ring: 40,
  disc: 20,
  line: 16,
  pillar: 20,
  burst: 20,
  cone: 4,
  bolt: 20,
  slash: 10,
};
const SHAPES = Object.keys(POOL) as FxShape[];
const TEXTS = 8;
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
/** Light-like shapes add to what is behind them, so they glow instead of covering the ground. */
const GLOWING = new Set<FxShape>(['pillar', 'burst', 'cone', 'bolt', 'slash']);
const PILLAR_HEIGHT = 7;
/** Half the angle of a cone, and of a slash's arc. */
const CONE_HALF = 0.42;
const SLASH_HALF = 1.1;

/** A flat mesh's local +y axis lies along the ground; this turns it to point at `angle` (0 = +z, toward +x). */
const groundTurn = (angle: number): number => -Math.atan2(Math.sin(angle), -Math.cos(angle));

/** A star of thin spikes, radius 1, in the xy plane. */
function burstGeometry(): BufferGeometry {
  const spikes = 10;
  const points: number[] = [];
  for (let i = 0; i < spikes; i++) {
    const a = (i / spikes) * Math.PI * 2;
    // Every other spike is shorter, which reads as a flash, not a gear.
    const reach = i % 2 ? 0.62 : 1;
    for (const [angle, radius] of [
      [a - 0.11, 0.16],
      [a + 0.11, 0.16],
      [a, reach],
    ])
      points.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
  }
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
}

/** A jagged strip one unit long along y and about one unit wide, centred on the origin. */
function boltGeometry(): BufferGeometry {
  const offsets = [0, 0.32, -0.28, 0.4, -0.12, 0.3, -0.4, 0.18, 0];
  const half = 0.07;
  const points: number[] = [];
  for (let i = 0; i < offsets.length - 1; i++) {
    const y1 = i / (offsets.length - 1) - 0.5;
    const y2 = (i + 1) / (offsets.length - 1) - 0.5;
    const x1 = offsets[i];
    const x2 = offsets[i + 1];
    points.push(x1 - half, y1, 0, x1 + half, y1, 0, x2 + half, y2, 0);
    points.push(x1 - half, y1, 0, x2 + half, y2, 0, x2 - half, y2, 0);
  }
  return new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
}

function place(mesh: Mesh, fx: Fx & { kind: FxShape }, age: number): void {
  const material = mesh.material as MeshBasicMaterial;
  material.color.set(fx.color in COLORS ? COLORS[fx.color as keyof typeof COLORS] : fx.color);
  mesh.visible = true;
  const fade = 1 - age;
  switch (fx.kind) {
    case 'ring':
      mesh.position.set(fx.x, 0.07, fx.z);
      mesh.scale.setScalar(fx.radius * (fx.inward ? 1 - 0.8 * age : 0.35 + 0.65 * age));
      // A closing ring gathers: it brightens as it tightens, the opposite of one spreading out.
      material.opacity = fx.inward ? Math.min(1, age * 2.5) : fade;
      return;
    case 'disc':
      mesh.position.set(fx.x, 0.06, fx.z);
      mesh.scale.setScalar(fx.radius * (0.6 + 0.4 * age));
      material.opacity = 0.55 * fade;
      return;
    case 'line':
    case 'bolt': {
      // Between two points on the ground. The flat mesh's local y axis runs along the ground.
      const dx = (fx.x2 ?? fx.x) - fx.x;
      const dz = (fx.z2 ?? fx.z) - fx.z;
      mesh.position.set(fx.x + dx / 2, fx.kind === 'bolt' ? 0.3 : 0.08, fx.z + dz / 2);
      mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dx, -dz));
      if (fx.kind === 'line') {
        mesh.scale.set(fx.radius * (1 - 0.5 * age), Math.hypot(dx, dz), 1);
        material.opacity = 0.7 * fade;
      } else {
        // Mirrors itself a few times while it lasts, so it crackles.
        const flip = Math.floor(age * 5) % 2 ? -1 : 1;
        mesh.scale.set(fx.radius * flip, Math.hypot(dx, dz), 1);
        material.opacity = fade * (0.65 + 0.35 * Math.sin(age * 50));
      }
      return;
    }
    case 'pillar': {
      const width = fx.radius * (1 - 0.6 * age);
      mesh.position.set(fx.x, PILLAR_HEIGHT / 2, fx.z);
      mesh.scale.set(width, PILLAR_HEIGHT, width);
      material.opacity = 0.5 * fade;
      return;
    }
    case 'burst':
      mesh.position.set(fx.x, 0.25, fx.z);
      mesh.rotation.set(-Math.PI / 2, 0, fx.angle ?? 0);
      // Out fast, then lingers.
      mesh.scale.setScalar(fx.radius * (1 - (1 - age) ** 3));
      material.opacity = fade;
      return;
    case 'cone':
      mesh.position.set(fx.x, 0.12, fx.z);
      mesh.rotation.set(-Math.PI / 2, 0, groundTurn(fx.angle ?? 0));
      mesh.scale.setScalar(fx.radius * (0.3 + 0.7 * Math.min(1, age * 2.5)));
      material.opacity = 0.7 * fade;
      return;
    case 'slash':
      mesh.position.set(fx.x, 0.9, fx.z);
      // Sweeps across the direction it faces.
      mesh.rotation.set(-Math.PI / 2, 0, groundTurn((fx.angle ?? 0) + (age - 0.5) * 1.4));
      mesh.scale.setScalar(fx.radius * (0.8 + 0.3 * age));
      material.opacity = fade;
      return;
  }
}

/** Short-lived visuals for casts, hits, deaths, clicks and gold, drawn from fixed pools. */
export function Effects({ game }: { game: GameSession }) {
  const meshes = useRef<Record<FxShape, (Mesh | null)[]>>({
    ring: [],
    disc: [],
    line: [],
    pillar: [],
    burst: [],
    cone: [],
    bolt: [],
    slash: [],
  });
  const labels = useRef<HTMLDivElement[]>([]);
  const canvas = useThree((s) => s.gl.domElement);
  const projected = useMemo(() => new Vector3(), []);
  const burst = useMemo(burstGeometry, []);
  const bolt = useMemo(boltGeometry, []);

  useEffect(
    () => () => {
      burst.dispose();
      bolt.dispose();
    },
    [burst, bolt],
  );

  // Floating text is plain DOM laid over the canvas and positioned by projecting world points.
  useEffect(() => {
    const layer = document.createElement('div');
    layer.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    for (let i = 0; i < TEXTS; i++) {
      const label = document.createElement('div');
      label.className = 'absolute top-0 left-0 text-sm font-bold whitespace-nowrap text-gold opacity-0';
      layer.appendChild(label);
    }
    labels.current = [...layer.children] as HTMLDivElement[];
    canvas.parentElement?.appendChild(layer);
    return () => {
      layer.remove();
      labels.current = [];
    };
  }, [canvas]);

  useFrame(({ camera, size }) => {
    const used: Record<FxShape, number> = {
      ring: 0,
      disc: 0,
      line: 0,
      pillar: 0,
      burst: 0,
      cone: 0,
      bolt: 0,
      slash: 0,
    };
    let t = 0;
    for (const fx of game.fx) {
      const age = (game.clock - fx.bornAt) / fx.duration;
      // Below zero: a visual that starts after a delay and is still waiting.
      if (age < 0 || age >= 1) continue;
      if (fx.kind === 'text') {
        const label = labels.current[t];
        if (!label) continue;
        t++;
        projected.set(fx.x, 1.5 + age * 1.5, fx.z).project(camera);
        const left = (projected.x * 0.5 + 0.5) * size.width;
        const top = (-projected.y * 0.5 + 0.5) * size.height;
        label.style.transform = `translate(${left}px, ${top}px) translate(-50%, -50%)`;
        label.textContent = fx.text ?? '';
        label.style.opacity = String(1 - age);
      } else if (used[fx.kind] < POOL[fx.kind]) {
        const mesh = meshes.current[fx.kind][used[fx.kind]++];
        if (mesh) place(mesh, fx as Fx & { kind: FxShape }, age);
      }
    }
    for (const shape of SHAPES) {
      for (let i = used[shape]; i < POOL[shape]; i++) {
        const mesh = meshes.current[shape][i];
        if (mesh) mesh.visible = false;
      }
    }
    for (; t < TEXTS; t++) {
      const label = labels.current[t];
      if (label) label.style.opacity = '0';
    }
  });

  const pool = (shape: FxShape, geometry: React.ReactNode, upright = false) =>
    Array.from({ length: POOL[shape] }, (_, i) => (
      <mesh
        key={`${shape}${i}`}
        ref={(m) => void (meshes.current[shape][i] = m)}
        rotation={upright ? undefined : FLAT}
        visible={false}
      >
        {geometry}
        <meshBasicMaterial
          transparent
          depthWrite={false}
          side={DoubleSide}
          blending={GLOWING.has(shape) ? AdditiveBlending : undefined}
        />
      </mesh>
    ));

  return (
    <>
      {pool('ring', <ringGeometry args={[0.86, 1, 48]} />)}
      {pool('disc', <circleGeometry args={[1, 40]} />)}
      {pool('line', <planeGeometry args={[1, 1]} />)}
      {/* Narrower at the top, so it reads as a shaft of light and not a tube. */}
      {pool('pillar', <cylinderGeometry args={[0.3, 1, 1, 14, 1, true]} />, true)}
      {pool('burst', <primitive object={burst} attach="geometry" />)}
      {pool('cone', <circleGeometry args={[1, 20, Math.PI / 2 - CONE_HALF, CONE_HALF * 2]} />)}
      {pool('bolt', <primitive object={bolt} attach="geometry" />)}
      {pool('slash', <ringGeometry args={[0.72, 1, 20, 1, Math.PI / 2 - SLASH_HALF, SLASH_HALF * 2]} />)}
    </>
  );
}
