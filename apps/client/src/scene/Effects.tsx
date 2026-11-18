import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  type Mesh,
  type MeshBasicMaterial,
  type Points,
  type Sprite,
  type SpriteMaterial,
  SRGBColorSpace,
  type Texture,
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
/**
 * Shapes drawn as a picture on a square are given room round their edge for the glow to fade out
 * in: the shape's own radius reaches this far across the half-square.
 */
const INSET = 0.8;
const QUAD = 2 / INSET;
/** Sparks thrown off by effects, and soft flashes of light where they go off. */
const SPARKS = 700;
const FLARES = 28;
const GRAVITY = 14;
/** Flat shapes are drawn this far off the ground, clear of the raised paving round the shrines and towers. */
const LIFT = 0.22;

// ---- pictures the shapes are drawn with: white with see-through parts, tinted by each effect's colour ----

function picture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Paints every pixel from how far it is from the middle (0..1 at the edge of the half-square) and its angle. */
function radial(ctx: CanvasRenderingContext2D, size: number, alpha: (r: number, angle: number) => number): void {
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size - 0.5;
      const dy = (y + 0.5) / size - 0.5;
      const a = Math.max(0, Math.min(1, alpha(Math.hypot(dx, dy) * 2, Math.atan2(dy, dx))));
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
      image.data[i + 3] = a * 255;
    }
  ctx.putImageData(image, 0, 0);
}

const bell = (x: number, width: number): number => Math.exp(-((x / width) ** 2));
/** A repeating flicker round a circle: `count` streaks of uneven strength. */
const streaks = (angle: number, count: number): number =>
  0.55 + 0.45 * Math.sin(angle * count) * Math.sin(angle * (count * 0.37) + 1.3);

/** A ring of light: a thin bright line, a wider glow either side, and a faint wash inside it. */
const ringPicture = (): Texture =>
  picture(256, (ctx, size) =>
    radial(ctx, size, (r) => {
      const d = r - 0.9 * INSET;
      return bell(d, 0.035) + 0.55 * bell(d, 0.11) + (r < 0.9 * INSET ? 0.07 : 0);
    }),
  );

/** A filled circle of force: brightest at its rim, streaked outward from the middle. */
const discPicture = (): Texture =>
  picture(256, (ctx, size) =>
    radial(ctx, size, (r, a) => {
      if (r > 1) return 0;
      const edge = Math.min(1, (1 - r) * 12);
      return edge * (0.3 + 0.45 * r * r * streaks(a, 23) + 0.6 * bell(r - 0.93, 0.05));
    }),
  );

/** A flash: a hot core and a crown of rays of uneven length. */
const burstPicture = (): Texture =>
  picture(256, (ctx, size) =>
    radial(ctx, size, (r, a) => {
      const reach = INSET * (0.55 + 0.45 * Math.abs(Math.sin(a * 7) * Math.sin(a * 3.1 + 0.7)));
      const ray = Math.max(0, 1 - r / reach) ** 1.5 * (0.35 + 0.65 * Math.abs(Math.sin(a * 14)) ** 6);
      return ray + bell(r, 0.22 * INSET) + 0.5 * bell(r, 0.5 * INSET);
    }),
  );

/** A crescent of light: thick in the middle of its sweep, drawn out to a point at each end, with a glow trailing inside it. */
const slashPicture = (): Texture =>
  picture(256, (ctx, size) =>
    radial(ctx, size, (r, a) => {
      // The picture's "up" is the middle of the sweep.
      const off = Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2)));
      if (off > SLASH_HALF) return 0;
      const taper = Math.cos((off / SLASH_HALF) * (Math.PI / 2));
      const d = r - 0.88 * INSET;
      return taper * (bell(d, 0.03 + 0.05 * taper) + (d < 0 ? 0.5 * bell(d, 0.22) : 0.25 * bell(d, 0.06)));
    }),
  );

/** A beam: a hot line down the middle with glow either side, fading at both ends. */
const beamPicture = (): Texture =>
  picture(128, (ctx, size) => {
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const across = (x + 0.5) / size - 0.5;
        const along = (y + 0.5) / size;
        const ends = Math.min(1, along * 6, (1 - along) * 6);
        const i = (y * size + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] = Math.min(1, bell(across, 0.07) + 0.5 * bell(across, 0.24)) * ends * 255;
      }
    ctx.putImageData(image, 0, 0);
  });

/** A shaft of light: brightest at the ground, thinning to nothing at the top, in uneven vertical strands. */
const pillarPicture = (): Texture =>
  picture(128, (ctx, size) => {
    const image = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const up = 1 - (y + 0.5) / size;
        const strand = streaks(((x + 0.5) / size) * Math.PI * 2, 9);
        const i = (y * size + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 255;
        image.data[i + 3] = Math.min(1, (1 - up) ** 1.6 * (0.45 + 0.75 * strand)) * 255;
      }
    ctx.putImageData(image, 0, 0);
  });

/** A soft round glow, for sparks and flashes. */
const glowPicture = (): Texture =>
  picture(64, (ctx, size) => radial(ctx, size, (r) => bell(r, 0.28) + 0.45 * bell(r, 0.6) * (r < 1 ? 1 : 0)));

/** A flat mesh's local +y axis lies along the ground; this turns it to point at `angle` (0 = +z, toward +x). */
const groundTurn = (angle: number): number => -Math.atan2(Math.sin(angle), -Math.cos(angle));

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
      mesh.position.set(fx.x, LIFT + 0.02, fx.z);
      mesh.scale.setScalar(fx.radius * (fx.inward ? 1 - 0.8 * age : 0.35 + 0.65 * age));
      mesh.rotation.z = age * (fx.inward ? -2 : 1.2);
      // A closing ring gathers: it brightens as it tightens, the opposite of one spreading out.
      material.opacity = fx.inward ? Math.min(1, age * 2.5) : fade;
      return;
    case 'disc':
      mesh.position.set(fx.x, LIFT, fx.z);
      mesh.scale.setScalar(fx.radius * (0.6 + 0.4 * age));
      material.opacity = 0.75 * fade;
      return;
    case 'line':
    case 'bolt': {
      // Between two points on the ground. The flat mesh's local y axis runs along the ground.
      const dx = (fx.x2 ?? fx.x) - fx.x;
      const dz = (fx.z2 ?? fx.z) - fx.z;
      mesh.position.set(fx.x + dx / 2, fx.kind === 'bolt' ? 0.4 : LIFT + 0.01, fx.z + dz / 2);
      mesh.rotation.set(-Math.PI / 2, 0, -Math.atan2(dx, -dz));
      if (fx.kind === 'line') {
        // The picture's hot line is thin: the streak is drawn wide so its glow has the width asked for.
        mesh.scale.set(fx.radius * 2.6 * (1 - 0.5 * age), Math.hypot(dx, dz), 1);
        material.opacity = 0.9 * fade;
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
      mesh.rotation.y = age * 2.5;
      material.opacity = 0.85 * fade;
      return;
    }
    case 'burst':
      mesh.position.set(fx.x, LIFT + 0.06, fx.z);
      // It turns a little as it opens, so the rays seem to fly out.
      mesh.rotation.set(-Math.PI / 2, 0, (fx.angle ?? 0) + age * 0.6);
      // Out fast, then lingers.
      mesh.scale.setScalar(fx.radius * (1 - (1 - age) ** 3));
      material.opacity = fade;
      return;
    case 'cone':
      mesh.position.set(fx.x, LIFT + 0.03, fx.z);
      mesh.rotation.set(-Math.PI / 2, 0, groundTurn(fx.angle ?? 0));
      mesh.scale.setScalar(fx.radius * (0.3 + 0.7 * Math.min(1, age * 2.5)));
      material.opacity = 0.9 * fade;
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
  const bolt = useMemo(boltGeometry, []);
  const pictures = useMemo(
    () => ({
      ring: ringPicture(),
      disc: discPicture(),
      burst: burstPicture(),
      slash: slashPicture(),
      line: beamPicture(),
      pillar: pillarPicture(),
      glow: glowPicture(),
    }),
    [],
  );
  // Sparks: one cloud of points, moved by hand each frame. Flares: a pool of soft glows that face the camera.
  const sparks = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(SPARKS * 3), 3));
    return {
      geometry,
      velocity: new Float32Array(SPARKS * 3),
      tint: new Float32Array(SPARKS * 3),
      born: new Float32Array(SPARKS).fill(-1e9),
      life: new Float32Array(SPARKS).fill(1),
      next: 0,
    };
  }, []);
  const points = useRef<Points>(null);
  const flares = useRef<(Sprite | null)[]>([]);
  const flareState = useMemo(
    () => Array.from({ length: FLARES }, () => ({ born: -1e9, life: 1, size: 1, color: new Color() })),
    [],
  );
  const scratch = useMemo(() => ({ color: new Color(), nextFlare: 0, seen: new WeakSet<Fx>(), last: 0 }), []);

  useEffect(
    () => () => {
      bolt.dispose();
      sparks.geometry.dispose();
      for (const texture of Object.values(pictures)) texture.dispose();
    },
    [bolt, sparks, pictures],
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
    const now = game.clock;
    const step = Math.min(0.05, Math.max(0, now - scratch.last));
    scratch.last = now;
    const colorOf = (fx: Fx) =>
      scratch.color.set(fx.color in COLORS ? COLORS[fx.color as keyof typeof COLORS] : fx.color);
    /** Throws `count` sparks from a point: outward at `speed`, upward at `rise`, optionally mostly toward `angle`. */
    const throwSparks = (fx: Fx, x: number, z: number, count: number, speed: number, rise: number, angle?: number) => {
      const c = colorOf(fx);
      for (let n = 0; n < count; n++) {
        const i = sparks.next;
        sparks.next = (sparks.next + 1) % SPARKS;
        const a = angle === undefined ? Math.random() * Math.PI * 2 : angle + (Math.random() - 0.5) * 1.1;
        const v = speed * (0.4 + Math.random() * 0.8);
        sparks.geometry.attributes.position.setXYZ(i, x, 0.3 + Math.random() * 0.5, z);
        sparks.velocity.set([Math.sin(a) * v, rise * (0.4 + Math.random() * 0.9), Math.cos(a) * v], i * 3);
        // Some sparks burn white-hot: mixed toward white.
        const hot = Math.random() * 0.6;
        sparks.tint.set([c.r + (1 - c.r) * hot, c.g + (1 - c.g) * hot, c.b + (1 - c.b) * hot], i * 3);
        sparks.born[i] = now;
        sparks.life[i] = 0.35 + Math.random() * 0.5;
      }
    };
    const flash = (fx: Fx, x: number, y: number, z: number, size: number, life: number) => {
      const i = scratch.nextFlare;
      scratch.nextFlare = (scratch.nextFlare + 1) % FLARES;
      const state = flareState[i];
      state.born = now;
      state.life = life;
      state.size = size;
      state.color.copy(colorOf(fx));
      flares.current[i]?.position.set(x, y, z);
    };

    let t = 0;
    for (const fx of game.fx) {
      const age = (game.clock - fx.bornAt) / fx.duration;
      // Below zero: a visual that starts after a delay and is still waiting.
      if (age < 0 || age >= 1) continue;
      // The moment an effect appears it throws sparks and lights the air round it.
      if (!scratch.seen.has(fx)) {
        scratch.seen.add(fx);
        const big = Math.min(2.5, Math.max(0.6, fx.radius / 2));
        if (fx.kind === 'burst') {
          throwSparks(fx, fx.x, fx.z, Math.round(12 * big), 5 * big, 6);
          flash(fx, fx.x, 0.8, fx.z, fx.radius * 3, 0.32);
          // Every flash drives a ring of force out along the ground.
          game.addFx({ kind: 'ring', x: fx.x, z: fx.z, radius: fx.radius * 1.35, color: fx.color, duration: 0.45 });
        } else if (fx.kind === 'pillar') {
          throwSparks(fx, fx.x, fx.z, 10, 1.6, 9);
          flash(fx, fx.x, 0.6, fx.z, fx.radius * 3.2 + 1.5, 0.45);
          // A shaft of light stands in a pool of it.
          game.addFx({
            kind: 'disc',
            x: fx.x,
            z: fx.z,
            radius: fx.radius * 1.5 + 0.6,
            color: fx.color,
            duration: Math.min(0.6, fx.duration),
          });
        } else if (fx.kind === 'disc' && fx.radius >= 1.2) {
          throwSparks(fx, fx.x, fx.z, Math.round(7 * big), 4 * big, 3.5);
        } else if (fx.kind === 'slash') {
          throwSparks(fx, fx.x, fx.z, 8, 7, 3, fx.angle ?? 0);
        } else if (fx.kind === 'cone') {
          throwSparks(fx, fx.x, fx.z, 14, fx.radius * 1.6, 3, fx.angle ?? 0);
        } else if (fx.kind === 'bolt') {
          const x = fx.x2 ?? fx.x;
          const z = fx.z2 ?? fx.z;
          throwSparks(fx, x, z, 6, 4, 5);
          flash(fx, x, 0.7, z, 2.2, 0.2);
        }
      }
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

    // Sparks fly, fall and burn out; a dead one is drawn black, which adds nothing.
    const position = sparks.geometry.attributes.position as BufferAttribute;
    const colour = sparks.geometry.attributes.color as BufferAttribute;
    for (let i = 0; i < SPARKS; i++) {
      const age = (now - sparks.born[i]) / sparks.life[i];
      if (age >= 1) {
        colour.setXYZ(i, 0, 0, 0);
        continue;
      }
      sparks.velocity[i * 3 + 1] -= GRAVITY * step;
      const y = Math.max(0.05, position.getY(i) + sparks.velocity[i * 3 + 1] * step);
      position.setXYZ(
        i,
        position.getX(i) + sparks.velocity[i * 3] * step,
        y,
        position.getZ(i) + sparks.velocity[i * 3 + 2] * step,
      );
      const glow = (1 - age) ** 1.5;
      colour.setXYZ(i, sparks.tint[i * 3] * glow, sparks.tint[i * 3 + 1] * glow, sparks.tint[i * 3 + 2] * glow);
    }
    position.needsUpdate = true;
    colour.needsUpdate = true;
    flareState.forEach((state, i) => {
      const sprite = flares.current[i];
      if (!sprite) return;
      const age = (now - state.born) / state.life;
      sprite.visible = age < 1;
      if (age >= 1) return;
      // Swells at once, then dies away.
      sprite.scale.setScalar(state.size * (0.6 + 0.6 * age));
      const material = sprite.material as SpriteMaterial;
      material.color.copy(state.color);
      material.opacity = 0.75 * (1 - age) ** 2;
    });
  });

  const pool = (shape: FxShape, geometry: React.ReactNode, map?: Texture, upright = false) =>
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
          map={map}
          blending={GLOWING.has(shape) ? AdditiveBlending : undefined}
        />
      </mesh>
    ));

  return (
    <>
      {pool('ring', <planeGeometry args={[QUAD, QUAD]} />, pictures.ring)}
      {pool('disc', <circleGeometry args={[1, 40]} />, pictures.disc)}
      {pool('line', <planeGeometry args={[1, 1]} />, pictures.line)}
      {/* Narrower at the top, so it reads as a shaft of light and not a tube. */}
      {pool('pillar', <cylinderGeometry args={[0.3, 1, 1, 18, 1, true]} />, pictures.pillar, true)}
      {pool('burst', <planeGeometry args={[QUAD, QUAD]} />, pictures.burst)}
      {pool('cone', <circleGeometry args={[1, 20, Math.PI / 2 - CONE_HALF, CONE_HALF * 2]} />, pictures.disc)}
      {pool('bolt', <primitive object={bolt} attach="geometry" />)}
      {pool('slash', <planeGeometry args={[QUAD, QUAD]} />, pictures.slash)}
      <points ref={points} geometry={sparks.geometry} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          map={pictures.glow}
          size={0.55}
          sizeAttenuation
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
      {flareState.map((_, i) => (
        <sprite key={i} ref={(sprite) => void (flares.current[i] = sprite)} visible={false}>
          <spriteMaterial map={pictures.glow} transparent depthWrite={false} blending={AdditiveBlending} />
        </sprite>
      ))}
    </>
  );
}
