import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { type Mesh, type MeshBasicMaterial, Vector3 } from 'three';
import type { Fx, GameSession } from '@/lib/session';
import { COLORS } from './palette';

const POOL = { ring: 32, disc: 16, line: 8 } as const;
const TEXTS = 8;
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
type Shape = keyof typeof POOL;

function place(mesh: Mesh, fx: Fx, age: number): void {
  const material = mesh.material as MeshBasicMaterial;
  material.color.set(COLORS[fx.color]);
  mesh.visible = true;
  if (fx.kind === 'ring') {
    mesh.position.set(fx.x, 0.07, fx.z);
    mesh.scale.setScalar(fx.radius * (0.35 + 0.65 * age));
    material.opacity = 1 - age;
  } else if (fx.kind === 'disc') {
    mesh.position.set(fx.x, 0.06, fx.z);
    mesh.scale.setScalar(fx.radius * (0.6 + 0.4 * age));
    material.opacity = 0.55 * (1 - age);
  } else {
    // A streak on the ground between two points. The flat quad's local y axis runs along the ground.
    const dx = (fx.x2 ?? fx.x) - fx.x;
    const dz = (fx.z2 ?? fx.z) - fx.z;
    mesh.position.set(fx.x + dx / 2, 0.08, fx.z + dz / 2);
    mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dx, -dz));
    mesh.scale.set(fx.radius * (1 - 0.5 * age), Math.hypot(dx, dz), 1);
    material.opacity = 0.7 * (1 - age);
  }
}

/** Short-lived visuals for casts, hits, deaths, clicks and gold, drawn from fixed pools. */
export function Effects({ game }: { game: GameSession }) {
  const meshes = useRef<Record<Shape, (Mesh | null)[]>>({ ring: [], disc: [], line: [] });
  const labels = useRef<HTMLDivElement[]>([]);
  const canvas = useThree((s) => s.gl.domElement);
  const projected = useMemo(() => new Vector3(), []);

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
    const used = { ring: 0, disc: 0, line: 0 };
    let t = 0;
    for (const fx of game.fx) {
      const age = (game.clock - fx.bornAt) / fx.duration;
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
        if (mesh) place(mesh, fx, age);
      }
    }
    for (const shape of ['ring', 'disc', 'line'] as const) {
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

  const pool = (shape: Shape, geometry: React.ReactNode) =>
    Array.from({ length: POOL[shape] }, (_, i) => (
      <mesh key={`${shape}${i}`} ref={(m) => void (meshes.current[shape][i] = m)} rotation={FLAT} visible={false}>
        {geometry}
        <meshBasicMaterial transparent depthWrite={false} />
      </mesh>
    ));

  return (
    <>
      {pool('ring', <ringGeometry args={[0.86, 1, 48]} />)}
      {pool('disc', <circleGeometry args={[1, 40]} />)}
      {pool('line', <planeGeometry args={[1, 1]} />)}
    </>
  );
}
