import {
  BufferGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  OctahedronGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  Vector3,
} from 'three';
import type { ActorAction } from '@/lib/session';

/** The colours of a hydra, by part. */
export interface HydraColours {
  scale: string;
  /** The raised scales along the flanks and necks, a shade off the body. */
  accent: string;
  /** The plates down the throat and belly. */
  belly: string;
  horn: string;
  wing: string;
  /** Eyes, crystals, the light inside the mouths and the fire showing between the plates. */
  glow: string;
  /** How many heads it has; three unless said otherwise. */
  heads?: 1 | 3;
  /**
   * A heavy build: a short thick neck, a broad head under a plate of bone, ram's horns, ribs of bone
   * over the flanks, small wings and a club on the tail. Only with one head.
   */
  heavy?: boolean;
  /**
   * Bones only: a skull, a spine, an open cage of ribs with a fire burning inside, thin limbs and
   * wings whose skin hangs in rags. Only with one head; `scale` is then the colour of the bone.
   */
  skeleton?: boolean;
}

/**
 * A dragon with one head or three, built in code, with no model file: every muscle, scale, horn, tooth and
 * wing finger is a simple rounded shape, and it moves by bending its necks, tail, wings and legs
 * every frame. Used the same way as an Actor.
 *
 * Built in its own small units, about 1.3 tall to the top of the middle head, facing +z; `height`
 * rescales it.
 */

const UP = Math.PI / 2;
const DEG = Math.PI / 180;
/** The tallest point of the resting pose, in the model's own units. */
const REST_HEIGHT = 1.32;

const NECK_SEGMENTS = 11;
const TAIL_SEGMENTS = 14;
/** Left, middle and right. */
const SIDES = [-1, 0, 1] as const;

interface Chain {
  segments: Group[];
  lengths: number[];
  /** Where the chain leaves the body. */
  root: Vector3;
}

interface Head {
  chain: Chain;
  holder: Group;
  jaw: Group;
  side: -1 | 0 | 1;
}

interface Leg {
  hip: Group;
  knee: Group;
  /** Where in the stride this leg is, 0 to 1. */
  phase: number;
}

/** What the body is doing on top of standing or walking, each 0 to 1. */
interface Pose {
  /** Necks stretch forward to bite; one value per head. */
  lunge: [number, number, number];
  /** Jaws open; one value per head. */
  jaw: [number, number, number];
  /** Side heads swing outward. */
  spread: number;
  /** Heads and wings lift. */
  raise: number;
  /** Wings sweep back, as in a dive. */
  sweep: number;
  /** The front of the body lifts off the ground. */
  rear: number;
  /** Crystals and eyes flare. */
  flare: number;
}

const restPose = (): Pose => ({ lunge: [0, 0, 0], jaw: [0, 0, 0], spread: 0, raise: 0, sweep: 0, rear: 0, flare: 0 });

/** How each action bends the body at its peak. `p` runs 0 to 1 over the action. */
const ACTIONS: Record<string, (p: number, pose: Pose) => void> = {
  // The middle head snaps forward.
  attack: (p, pose) => {
    const bite = Math.sin(Math.PI * p);
    pose.lunge[1] = bite;
    pose.jaw[1] = bite;
  },
  // A lunge with every head, wings swept back.
  Q: (p, pose) => {
    const drive = Math.sin(Math.PI * p);
    pose.lunge = [drive * 0.7, drive, drive * 0.7];
    pose.jaw = [drive, drive * 0.5, drive];
    pose.sweep = drive;
  },
  // Gathering power: heads and wings up, everything glowing.
  W: (p, pose) => {
    const swell = Math.sin(Math.PI * p);
    pose.raise = swell;
    pose.flare = swell;
  },
  // A roar from all three throats, heads fanned out.
  E: (p, pose) => {
    const roar = Math.sin(Math.PI * Math.min(1, p * 1.2));
    pose.spread = roar;
    pose.jaw = [roar, roar, roar];
    pose.raise = roar * 0.4;
    pose.flare = roar * 0.6;
  },
  // Rear up, then all three heads come down at once.
  R: (p, pose) => {
    const up = Math.sin(Math.PI * Math.min(1, p * 1.6));
    const strike = p < 0.45 ? 0 : Math.sin(Math.PI * ((p - 0.45) / 0.55));
    pose.rear = up * (1 - strike * 0.6);
    pose.raise = up * (1 - strike);
    pose.lunge = [strike, strike, strike];
    pose.jaw = [strike, strike, strike];
    pose.flare = Math.max(up * 0.5, strike);
  },
};

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const HYDRA_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.6 },
  Q: { clip: 'Q', seconds: 0.6 },
  W: { clip: 'W', seconds: 0.9 },
  E: { clip: 'E', seconds: 0.9 },
  R: { clip: 'R', seconds: 1.1 },
};

const DEATH_SECONDS = 0.9;

/** How wide and tall one scale is drawn on the skin texture, in pixels. The texture holds 8 by 16 of them. */
const SCALE_W = 32;
const SCALE_H = 16;
const SKIN_SIZE = 256;

let skinMaps: { colour: Texture; bump: Texture; cracks: Texture } | null = null;

/**
 * The dragon's skin, drawn once and shared by every dragon: rows of overlapping, pointed scales.
 * Three pictures of the same scales: their shading (multiplied into the body colour), their
 * height (so light catches each scale's edge), and thin cracks around some of them, which glow.
 */
function skin(): { colour: Texture; bump: Texture; cracks: Texture } {
  if (skinMaps) return skinMaps;
  const canvases = [0, 1, 2].map(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SKIN_SIZE;
    return canvas;
  });
  const [colour, bump, cracks] = canvases.map((canvas) => canvas.getContext('2d')!);
  colour.fillStyle = '#6a6a6a';
  colour.fillRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  bump.fillStyle = '#000';
  bump.fillRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  cracks.fillStyle = '#000';
  cracks.fillRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  cracks.lineWidth = 1.6;
  cracks.strokeStyle = '#fff';
  cracks.lineCap = 'round';

  /** One scale: a shield shape, round at the top and drawn to a point at the bottom. */
  const outline = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const w = SCALE_W * 0.56;
    const h = SCALE_H * 2.1;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w, y + h * 0.55, x, y + h);
    ctx.quadraticCurveTo(x + w, y + h * 0.55, x + w, y);
    ctx.quadraticCurveTo(x, y - h * 0.3, x - w, y);
    ctx.closePath();
  };
  // A fixed sequence, not Math.random: every dragon and every visit gets the same skin.
  let seed = 7;
  const chance = () => ((seed = (seed * 16807) % 2147483647) % 1000) / 1000;
  const rows = SKIN_SIZE / SCALE_H;
  const columns = SKIN_SIZE / SCALE_W;
  // Bottom row first, so each row overlaps the one below it. One extra row and column each way so the edges tile.
  for (let row = rows + 2; row >= -2; row--) {
    for (let column = -1; column <= columns; column++) {
      const x = column * SCALE_W + (row % 2 ? SCALE_W / 2 : 0);
      const y = row * SCALE_H;
      const lit = colour.createLinearGradient(x, y - 4, x, y + SCALE_H * 2.1);
      // Each scale is light along its ridge and dark where it tucks under its neighbours.
      lit.addColorStop(0, '#3c3c3c');
      lit.addColorStop(0.45, '#e6e6e6');
      lit.addColorStop(1, '#9a9a9a');
      outline(colour, x, y);
      colour.fillStyle = lit;
      colour.fill();
      colour.lineWidth = 1.4;
      colour.strokeStyle = '#141414';
      colour.stroke();
      // A ridge down the middle of the scale.
      colour.beginPath();
      colour.moveTo(x, y + 5);
      colour.lineTo(x, y + SCALE_H * 2.1 - 3);
      colour.lineWidth = 1;
      colour.strokeStyle = 'rgba(255,255,255,0.35)';
      colour.stroke();

      const height = bump.createLinearGradient(x, y - 4, x, y + SCALE_H * 2.1);
      height.addColorStop(0, '#202020');
      height.addColorStop(0.55, '#ffffff');
      height.addColorStop(1, '#c8c8c8');
      outline(bump, x, y);
      bump.fillStyle = height;
      bump.fill();
      bump.lineWidth = 2;
      bump.strokeStyle = '#000';
      bump.stroke();

      // Fire shows around the edge of about one scale in nine.
      const cracked = chance() < 0.11;
      outline(cracks, x, y);
      cracks.fillStyle = '#000';
      cracks.fill();
      if (cracked) cracks.stroke();
    }
  }
  const [colourMap, bumpMap, crackMap] = canvases.map((canvas) => {
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  });
  colourMap.colorSpace = SRGBColorSpace;
  crackMap.colorSpace = SRGBColorSpace;
  skinMaps = { colour: colourMap, bump: bumpMap, cracks: crackMap };
  return skinMaps;
}

/** The skin's three pictures, repeated `across` by `along` times over each part they cover. */
function skinned(glow: string, across: number, along: number): MeshStandardMaterialParameters {
  const tile = (texture: Texture) => {
    const copy = texture.clone();
    copy.repeat.set(across, along);
    copy.needsUpdate = true;
    return copy;
  };
  const maps = skin();
  return {
    map: tile(maps.colour),
    bumpMap: tile(maps.bump),
    bumpScale: 2.2,
    emissiveMap: tile(maps.cracks),
    emissive: glow,
    emissiveIntensity: 1.4,
    roughness: 0.48,
    metalness: 0.4,
  };
}

/**
 * How a rib is turned so that it leaves the spine going outward and a little up, and then curls
 * down and in round the body: a horn curls toward its own +z, so that axis is pointed downward.
 */
function ribTurn(side: number): [number, number, number] {
  const lean = 0.3;
  const out = new Vector3(side * Math.cos(lean), Math.sin(lean), 0);
  const down = new Vector3(side * Math.sin(lean), -Math.cos(lean), 0);
  const turn = new Euler().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0, 0, -side), out, down));
  return [turn.x, turn.y, turn.z];
}

/** One smooth ball, shared by every rounded part and stretched to shape. */
const BALL = new SphereGeometry(1, 20, 14);

export class Hydra {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly heads: Head[] = [];
  private readonly tail: Chain;
  private readonly wings: { root: Group; side: number }[] = [];
  private readonly legs: Leg[] = [];
  private readonly glowing: MeshStandardMaterial;
  private readonly eyes: MeshBasicMaterial;
  private readonly materials: Record<'scale' | 'hide' | 'accent' | 'belly' | 'horn' | 'dark', MeshStandardMaterial>;
  private readonly wingMaterial: MeshStandardMaterial;
  private readonly castShadow: boolean;
  /** One head on a thick neck, not three on slender ones. */
  private readonly single: boolean;
  private readonly heavy: boolean;
  private readonly skeleton: boolean;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;

  constructor(colours: HydraColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.single = colours.heads === 1;
    this.heavy = this.single && colours.heavy === true;
    this.skeleton = this.single && colours.skeleton === true;
    const smooth = (color: string, extra: MeshStandardMaterialParameters = {}) =>
      new MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.14, ...extra });
    this.materials = {
      // Scaled skin: on the rounded masses of the body, and wrapped tighter round the necks, tail and legs.
      scale: this.skeleton ? smooth(colours.scale) : smooth(colours.scale, skinned(colours.glow, 2.5, 1.5)),
      hide: this.skeleton ? smooth(colours.scale) : smooth(colours.scale, skinned(colours.glow, 2, 0.5)),
      accent: this.skeleton
        ? smooth(colours.accent)
        : smooth(colours.accent, { ...skinned(colours.glow, 1, 1), emissiveIntensity: 0 }),
      belly: smooth(colours.belly, { roughness: 0.5 }),
      horn: smooth(colours.horn, { roughness: 0.3, metalness: 0.5 }),
      dark: smooth('#0b0d1a', { roughness: 0.8, metalness: 0 }),
    };
    // Crystals stay faceted: they are cut stones on a rounded body.
    this.glowing = smooth(colours.glow, { emissive: colours.glow, emissiveIntensity: 1.2, flatShading: true });
    this.eyes = new MeshBasicMaterial({ color: colours.glow });
    this.wingMaterial = smooth(colours.wing, {
      side: DoubleSide,
      transparent: true,
      // A skeleton's wings are rags: what skin is left lets the light through.
      opacity: this.skeleton ? 0.42 : 0.94,
      roughness: 0.6,
      metalness: 0.05,
      emissive: colours.glow,
      emissiveIntensity: 0.03,
    });

    if (this.skeleton) this.buildBoneTorso();
    else this.buildTorso();
    for (const side of this.single ? ([0] as const) : SIDES) this.heads.push(this.buildNeckAndHead(side));
    this.tail = this.buildTail();
    for (const side of [-1, 1]) this.wings.push({ root: this.buildWing(side), side });
    this.buildLegs();
    if (this.heavy) this.buildBoneArmour();
    // Thin bones for legs.
    if (this.skeleton) for (const leg of this.legs) leg.hip.scale.set(0.5, 1, 0.5);

    const model = new Group();
    model.scale.setScalar(height / REST_HEIGHT);
    model.add(this.body);
    this.root.add(model);
    this.applyPose(restPose(), 0);
  }

  // ---- building ----

  private mesh(
    geometry: BufferGeometry,
    material: MeshStandardMaterial | MeshBasicMaterial,
    parent: Group,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = this.castShadow;
    parent.add(mesh);
    return mesh;
  }

  /** A ball, squashed and turned as asked: most of the body is made of these. */
  private ball(
    material: MeshStandardMaterial | MeshBasicMaterial,
    parent: Group,
    position: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh {
    return this.mesh(BALL, material, parent, position, rotation, scale);
  }

  /** A horn that curves: a row of ever thinner pieces, each tipped a little further than the last. */
  private horn(
    parent: Group,
    position: [number, number, number],
    rotation: [number, number, number],
    length: number,
    radius: number,
    curl: number,
    material: MeshStandardMaterial = this.materials.horn,
  ): void {
    const pieces = 6;
    const step = length / pieces;
    let holder = new Group();
    holder.position.set(...position);
    holder.rotation.set(...rotation);
    parent.add(holder);
    for (let i = 0; i < pieces; i++) {
      const r1 = radius * (1 - i / pieces);
      const r2 = Math.max(0.002, radius * (1 - (i + 1) / pieces));
      const piece = new CylinderGeometry(r2, r1, step * 1.1, 10, 1);
      piece.translate(0, step / 2, 0);
      this.mesh(piece, material, holder);
      this.ball(material, holder, [0, 0, 0], [r1, r1, r1]);
      const next = new Group();
      next.position.y = step;
      next.rotation.x = curl / pieces;
      holder.add(next);
      holder = next;
    }
  }

  private buildTorso(): void {
    const { scale, accent, belly, horn } = this.materials;
    // Hips, barrel and chest, with the muscle of the shoulders and haunches standing out from them.
    this.ball(scale, this.body, [0, 0.52, -0.3], [0.25, 0.23, 0.33]);
    this.ball(scale, this.body, [0, 0.56, 0.02], [0.29, 0.26, 0.4]);
    this.ball(scale, this.body, [0, 0.63, 0.3], [0.3, 0.3, 0.3], [0.25, 0, 0]);
    this.ball(scale, this.body, [0, 0.75, 0.36], [0.25, 0.17, 0.2]);
    for (const side of [-1, 1]) {
      this.ball(scale, this.body, [side * 0.21, 0.58, 0.25], [0.13, 0.17, 0.17]);
      this.ball(scale, this.body, [side * 0.2, 0.5, -0.31], [0.14, 0.18, 0.2]);
      // Two rows of raised scales along each flank.
      for (let row = 0; row < 2; row++)
        for (let i = 0; i < 7; i++) {
          const z = 0.3 - i * 0.105 - row * 0.05;
          const out = 0.275 - Math.abs(i - 3) * 0.012 - row * 0.02;
          this.ball(
            accent,
            this.body,
            [side * out, 0.6 - row * 0.1, z],
            [0.022, 0.05, 0.058],
            [0, 0, side * (0.2 + row * 0.5)],
          );
        }
    }
    // Fire inside the body shows along the seams of the flanks and under the belly plates.
    for (const side of [-1, 1]) {
      this.ball(this.glowing, this.body, [side * 0.268, 0.55, 0.02], [0.008, 0.012, 0.3]);
      this.ball(this.glowing, this.body, [side * 0.2, 0.47, 0.3], [0.01, 0.1, 0.012], [0, 0, side * 0.5]);
      this.ball(this.glowing, this.body, [side * 0.21, 0.42, -0.3], [0.01, 0.09, 0.012], [0, 0, side * 0.4]);
    }
    this.ball(this.glowing, this.body, [0, 0.345, 0.0], [0.11, 0.02, 0.42]);
    // Belly plates, overlapping like armour.
    for (let i = 0; i < 8; i++) {
      const z = 0.4 - i * 0.115;
      const width = 1 - Math.abs(i - 3) * 0.07;
      this.ball(
        belly,
        this.body,
        [0, 0.335 + (i === 0 ? 0.07 : 0) + Math.abs(i - 3.5) * 0.008, z],
        [0.19 * width, 0.045, 0.075],
        [0.12, 0, 0],
      );
    }
    // A ridge of spikes down the back, tallest over the shoulders, each rising from a rounded base.
    for (let i = 0; i < 8; i++) {
      const z = 0.38 - i * 0.115;
      const tall = 1.3 - Math.abs(i - 1.5) * 0.13;
      const y = 0.83 - i * 0.012 - Math.abs(i - 2) * 0.012;
      this.mesh(new ConeGeometry(0.04, 0.24, 10), horn, this.body, [0, y, z], [-0.35, 0, 0], [1, tall, 1]);
      this.ball(horn, this.body, [0, y - 0.1 * tall, z + 0.035 * tall], [0.045, 0.03, 0.05]);
    }
    // Shoulder plates with a glowing crystal set in each, and a horn curving up behind.
    const shard = new OctahedronGeometry(1, 0);
    for (const side of [-1, 1]) {
      this.ball(accent, this.body, [side * 0.27, 0.71, 0.2], [0.11, 0.17, 0.19], [0, 0, side * 0.5]);
      this.mesh(shard, this.glowing, this.body, [side * 0.345, 0.76, 0.2], [0.4, 0, side * 0.6], [0.035, 0.07, 0.035]);
      this.horn(this.body, [side * 0.31, 0.82, 0.12], [-0.5, 0, -side * 0.7], 0.2, 0.035, -0.9);
    }
    // Crystals growing along the spine.
    for (let i = 0; i < 3; i++)
      this.mesh(
        shard,
        this.glowing,
        this.body,
        [0, 0.81 - i * 0.02, 0.05 - i * 0.2],
        [0.5, 0.4, 0],
        [0.028, 0.06, 0.028],
      );
  }

  /**
   * A row of tapering segments that will be bent into a neck or a tail. Each has a rounded joint, a
   * spike on its back, a plate on its throat and, with `scales`, a raised scale on either side.
   */
  private buildChain(
    root: Vector3,
    count: number,
    length: number,
    from: number,
    to: number,
    spikes: number,
    scales: boolean,
  ): Chain {
    const { hide, accent, belly, horn } = this.materials;
    const segments: Group[] = [];
    const lengths: number[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const r1 = from + (to - from) * t;
      const r2 = from + (to - from) * Math.min(1, (i + 1) / (count - 1));
      const segment = new Group();
      segment.rotation.order = 'YXZ';
      if (this.skeleton) {
        // A vertebra: a thin shaft, a knob at the joint, a spine on its back and a stub out to each side.
        const shaft = new CylinderGeometry(r2 * 0.36, r1 * 0.36, length, 10, 1);
        shaft.translate(0, length * 0.5, 0);
        this.mesh(shaft, hide, segment);
        this.ball(hide, segment, [0, 0, 0], [r1 * 0.72, r1 * 0.5, r1 * 0.72]);
        if (i % spikes === 0)
          this.mesh(
            new ConeGeometry(r1 * 0.2, r1 * 1.8, 8),
            horn,
            segment,
            [0, length * 0.2, -r1 * 0.95],
            [-UP + 0.5, 0, 0],
          );
        for (const side of [-1, 1])
          this.mesh(
            new ConeGeometry(r1 * 0.16, r1 * 0.9, 6),
            hide,
            segment,
            [side * r1 * 0.75, 0, 0],
            [0, 0, -side * UP],
          );
        this.body.add(segment);
        segments.push(segment);
        lengths.push(length);
        continue;
      }
      const tube = new CylinderGeometry(r2, r1, length, 14, 1);
      tube.translate(0, length * 0.5, 0);
      this.mesh(tube, hide, segment);
      // A ball at the joint keeps the bend round, with no gap on the outside of the curve.
      this.ball(hide, segment, [0, 0, 0], [r1, r1, r1]);
      // Local -z is the back of the neck, +z the throat.
      if (i % spikes === 0)
        this.mesh(
          new ConeGeometry(r1 * 0.34, r1 * 2.9, 10),
          horn,
          segment,
          [0, length * 0.5, -r1 * 1.4],
          [-UP + 0.55, 0, 0],
        );
      // Broad plates down the throat, with the fire inside showing in the gaps between them.
      this.ball(belly, segment, [0, length * 0.55, r1 * 0.72], [r1 * 0.82, length * 0.42, r1 * 0.42]);
      this.ball(this.glowing, segment, [0, length * 0.05, r1 * 0.68], [r1 * 0.6, length * 0.14, r1 * 0.34]);
      if (scales)
        for (const side of [-1, 1]) {
          this.ball(
            accent,
            segment,
            [side * r1 * 0.86, length * 0.5, -r1 * 0.15],
            [r1 * 0.24, length * 0.42, r1 * 0.5],
          );
          // A row of spikes down each side of the neck, raked back.
          this.mesh(
            new ConeGeometry(r1 * 0.2, r1 * 1.7, 8),
            horn,
            segment,
            [side * r1 * 1.15, length * 0.3, -r1 * 0.55],
            [-0.9, 0, -side * 1.15],
          );
        }
      this.body.add(segment);
      segments.push(segment);
      lengths.push(length);
    }
    return { segments, lengths, root };
  }

  private buildNeckAndHead(side: -1 | 0 | 1): Head {
    const middle = side === 0;
    const root = new Vector3(side * 0.19, middle ? 0.8 : 0.76, middle ? 0.42 : 0.36);
    // A single head gets a longer, much thicker neck and a bigger skull.
    const chain = this.single
      ? this.heavy
        ? this.buildChain(root, NECK_SEGMENTS, 0.066, 0.21, 0.14, 1, true)
        : this.skeleton
          ? this.buildChain(root, NECK_SEGMENTS, 0.092, 0.13, 0.09, 1, true)
          : this.buildChain(root, NECK_SEGMENTS, 0.098, 0.175, 0.1, 1, true)
      : this.buildChain(root, NECK_SEGMENTS, middle ? 0.086 : 0.078, middle ? 0.115 : 0.1, 0.064, 1, true);
    const holder = new Group();
    // The head is built facing +z with +y up; a neck segment's own axes are +y along the neck and -z at its back.
    const head = new Group();
    head.rotation.x = -UP;
    head.scale.setScalar(this.heavy ? 0.74 : this.skeleton ? 0.54 : this.single ? 0.62 : middle ? 0.46 : 0.4);
    holder.add(head);
    this.body.add(holder);
    const jaw = this.buildHead(head);
    return { chain, holder, jaw, side };
  }

  /** One head, facing +z. Returns the lower jaw, which hinges at the back of the skull. */
  private buildHead(head: Group): Group {
    const { scale, accent, belly, dark } = this.materials;
    const along: [number, number, number] = [UP, 0, 0];
    // Skull, cheeks and a long tapering snout with a rounded nose.
    this.ball(scale, head, [0, 0.05, 0.02], [0.27, 0.2, 0.3]);
    this.mesh(new CylinderGeometry(0.105, 0.21, 0.56, 16), scale, head, [0, 0.01, 0.46], along, [1, 1, 0.74]);
    this.ball(scale, head, [0, 0.005, 0.74], [0.11, 0.082, 0.12]);
    // A ridge down the top of the snout, ending in a horn on the nose.
    this.ball(accent, head, [0, 0.085, 0.5], [0.045, 0.03, 0.24]);
    this.horn(head, [0, 0.09, 0.72], [-0.2, 0, 0], 0.22, 0.035, -0.8);
    for (const side of [-1, 1]) {
      this.ball(scale, head, [side * 0.165, -0.02, 0.1], [0.12, 0.12, 0.2]);
      // Heavy brows over glowing eyes with slit pupils, and a streak of light trailing back from each.
      this.ball(accent, head, [side * 0.16, 0.175, 0.2], [0.1, 0.038, 0.18], [0.15, 0, side * 0.4]);
      this.ball(this.eyes, head, [side * 0.195, 0.1, 0.27], [0.052, 0.045, 0.06]);
      this.ball(dark, head, [side * 0.238, 0.1, 0.285], [0.01, 0.04, 0.018]);
      this.ball(this.eyes, head, [side * 0.24, 0.115, 0.16], [0.01, 0.018, 0.1], [0, side * 0.3, 0]);
      this.ball(dark, head, [side * 0.055, 0.05, 0.815], [0.018, 0.014, 0.024]);
      // Two swept-back horns each side, a long one over a short one, and a spike curling off the cheek.
      this.horn(head, [side * 0.19, 0.2, -0.1], [-1.05, 0, -side * 0.32], 0.95, 0.078, 0.75);
      this.horn(head, [side * 0.27, 0.08, -0.12], [-1.3, 0, -side * 0.75], 0.55, 0.052, 0.6);
      this.horn(head, [side * 0.26, -0.08, 0.04], [-1.6, 0, -side * 1.25], 0.32, 0.042, 0.9);
      // A fin behind the jaw.
      this.mesh(
        new ConeGeometry(0.16, 0.36, 12),
        this.wingMaterial,
        head,
        [side * 0.27, 0.02, -0.3],
        [-UP, 0, -side * 0.9],
        [1, 1, 0.08],
      );
      // Upper teeth, with a long fang at the front.
      for (let i = 0; i < 5; i++)
        this.mesh(
          new ConeGeometry(0.018, i === 4 ? 0.15 : 0.085, 8),
          belly,
          head,
          [side * (0.155 - i * 0.022), -0.115, 0.36 + i * 0.1],
          [Math.PI, 0, 0],
        );
    }
    if (this.skeleton)
      // Deep, dark sockets round the eyes turn the head into a skull.
      for (const side of [-1, 1]) this.ball(dark, head, [side * 0.175, 0.1, 0.25], [0.075, 0.07, 0.085]);
    if (this.heavy) {
      // A plate of bone over the skull and down the snout, and a ram's horns curling forward round the cheeks.
      this.ball(belly, head, [0, 0.15, 0.1], [0.25, 0.09, 0.3]);
      this.ball(belly, head, [0, 0.1, 0.52], [0.1, 0.05, 0.26]);
      for (const side of [-1, 1]) {
        this.horn(head, [side * 0.25, 0.12, -0.06], [-0.5, 0, -side * 1.35], 0.8, 0.1, 2.7, belly);
        this.ball(belly, head, [side * 0.2, -0.03, 0.2], [0.05, 0.1, 0.18]);
      }
    }
    // A mane of spikes fanning back from behind the skull.
    for (let i = 0; i < 9; i++) {
      const a = (i / 8 - 0.5) * 2.5;
      this.horn(
        head,
        [Math.sin(a) * 0.23, 0.02 + Math.cos(a) * 0.15, -0.2],
        [-1.35 - Math.cos(a) * 0.2, 0, -Math.sin(a) * 0.95],
        0.44,
        0.034,
        0.3,
      );
    }
    // A crest of spikes over the skull and a crystal in the forehead.
    for (let i = 0; i < 4; i++)
      this.horn(head, [0, 0.22 - i * 0.012, 0.06 - i * 0.13], [-0.75, 0, 0], 0.24 - i * 0.03, 0.036, 0.5);
    this.mesh(new OctahedronGeometry(1, 0), this.glowing, head, [0, 0.215, 0.3], [0.3, 0, 0], [0.045, 0.03, 0.08]);

    const jaw = new Group();
    jaw.position.set(0, -0.09, -0.08);
    this.mesh(new CylinderGeometry(0.085, 0.2, 0.9, 14), scale, jaw, [0, -0.03, 0.48], along, [1, 1, 0.4]);
    this.ball(scale, jaw, [0, -0.03, 0.92], [0.085, 0.04, 0.07]);
    this.ball(belly, jaw, [0, -0.07, 0.42], [0.13, 0.03, 0.38]);
    // The light in the throat, seen when the mouth opens.
    this.ball(this.glowing, jaw, [0, 0.03, 0.2], [0.1, 0.05, 0.16]);
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++)
        this.mesh(new ConeGeometry(0.018, 0.08, 8), belly, jaw, [side * (0.135 - i * 0.02), 0.04, 0.46 + i * 0.1]);
    this.horn(jaw, [0, -0.07, 0.86], [Math.PI * 0.85, 0, 0], 0.16, 0.03, 0.6);
    head.add(jaw);
    return jaw;
  }

  private buildTail(): Chain {
    const chain = this.heavy
      ? this.buildChain(new Vector3(0, 0.5, -0.56), TAIL_SEGMENTS, 0.08, 0.19, 0.06, 2, false)
      : this.buildChain(new Vector3(0, 0.5, -0.56), TAIL_SEGMENTS, 0.1, 0.15, 0.022, 2, false);
    // A blade at the tip, with barbs and a crystal at its heart.
    const tip = chain.segments[TAIL_SEGMENTS - 1];
    const { horn, belly } = this.materials;
    if (this.heavy) {
      // A club of bone at the end of the tail, studded with spikes.
      this.ball(belly, tip, [0, 0.16, 0], [0.13, 0.15, 0.13]);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.horn(
          tip,
          [Math.sin(a) * 0.1, 0.16 + (i % 2 ? 0.05 : -0.03), Math.cos(a) * 0.1],
          [Math.cos(a) * 1.4, 0, -Math.sin(a) * 1.4],
          0.16,
          0.03,
          0.2,
        );
      }
      return chain;
    }
    this.ball(horn, tip, [0, 0.2, 0], [0.028, 0.18, 0.11]);
    this.mesh(new OctahedronGeometry(1, 0), this.glowing, tip, [0, 0.18, 0], [0, 0, 0], [0.035, 0.07, 0.035]);
    for (const side of [-1, 1]) this.horn(tip, [0, 0.08, side * 0.05], [side * 1.2, 0, 0], 0.16, 0.022, -side * 0.8);
    // Spikes out to both sides along the last third of the tail.
    for (let i = TAIL_SEGMENTS - 5; i < TAIL_SEGMENTS - 1; i++)
      for (const side of [-1, 1])
        this.horn(chain.segments[i], [side * 0.03, 0.05, 0], [0, 0, -side * 1.3], 0.13, 0.02, 0.4);
    return chain;
  }

  /** One wing: arm, forearm, three long fingers and the skin stretched between them. */
  private buildWing(side: number): Group {
    const { horn, scale } = this.materials;
    const wing = new Group();
    wing.position.set(side * 0.2, 0.8, 0.12);
    const at = (x: number, y: number, z: number) => new Vector3(side * x, y, z);
    const shoulder = at(0, 0, 0);
    const elbow = at(0.42, 0.26, -0.06);
    const wrist = at(0.82, 0.44, 0.1);
    const tips = [at(1.72, 0.52, 0.02), at(1.5, 0.12, -0.72), at(0.98, -0.06, -1.02)];
    const trailing = at(0.06, -0.16, -0.74);

    const bone = (a: Vector3, b: Vector3, r1: number, r2: number) => {
      const length = a.distanceTo(b);
      const geometry = new CylinderGeometry(r2, r1, length, 10);
      geometry.translate(0, length / 2, 0);
      const mesh = this.mesh(geometry, horn, wing, [a.x, a.y, a.z]);
      mesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
      // A knuckle at the start of each bone.
      this.ball(horn, wing, [a.x, a.y, a.z], [r1 * 1.25, r1 * 1.25, r1 * 1.25]);
    };
    // The arm is muscle near the body and bare bone beyond the elbow.
    this.ball(scale, wing, [side * 0.2, 0.12, -0.03], [0.24, 0.075, 0.08], [0, 0, side * 0.55]);
    bone(shoulder, elbow, 0.05, 0.04);
    bone(elbow, wrist, 0.04, 0.03);
    for (const tip of tips) bone(wrist, tip, 0.026, 0.007);
    // A hooked claw at the wrist.
    this.horn(wing, [wrist.x, wrist.y + 0.03, wrist.z + 0.04], [0.5, 0, -side * 0.2], 0.4, 0.045, 1.9);
    // Each finger ends in a claw hooking down past the edge of the skin.
    for (const tip of tips) this.horn(wing, [tip.x, tip.y, tip.z], [2.2, 0, side * 0.9], 0.16, 0.014, 0.8);

    // Skin: fans between the fingers, the trailing edge curving in between each pair of tips.
    const points: number[] = [];
    const tri = (a: Vector3, b: Vector3, c: Vector3) => points.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    const edge = [tips[0], tips[1], tips[2], trailing];
    const steps = 6;
    for (let i = 0; i < edge.length - 1; i++) {
      // Points along a curve from one tip to the next that sags toward the wrist in the middle.
      const curve = Array.from({ length: steps + 1 }, (_, k) => {
        const f = k / steps;
        return edge[i]
          .clone()
          .lerp(edge[i + 1], f)
          .lerp(wrist, 0.36 * 4 * f * (1 - f));
      });
      for (let k = 0; k < steps; k++) tri(wrist, curve[k], curve[k + 1]);
    }
    tri(elbow, wrist, trailing);
    tri(shoulder, elbow, trailing);
    const skin = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(points, 3));
    skin.computeVertexNormals();
    this.mesh(skin, this.wingMaterial, wing);
    this.body.add(wing);
    return wing;
  }

  private buildLegs(): void {
    const { scale, accent } = this.materials;
    const places: [x: number, y: number, z: number, front: boolean][] = [
      [0.25, 0.5, 0.26, true],
      [0.27, 0.48, -0.32, false],
    ];
    for (const [x, y, z, front] of places) {
      for (const side of [-1, 1]) {
        const hip = new Group();
        hip.position.set(side * x, y, z);
        const upper = front ? 0.26 : 0.3;
        const lower = front ? 0.25 : 0.22;
        // A thick thigh of muscle, with a plate of scale over it.
        this.ball(scale, hip, [0, -upper * 0.45, 0], [0.095, upper * 0.62, 0.115]);
        this.ball(accent, hip, [side * 0.06, -upper * 0.35, 0], [0.04, upper * 0.4, 0.085]);
        const knee = new Group();
        knee.position.set(0, -upper, 0);
        this.ball(scale, knee, [0, 0, 0], [0.065, 0.065, 0.07]);
        const shin = new CylinderGeometry(0.038, 0.06, lower, 12);
        shin.translate(0, -lower / 2, 0);
        this.mesh(shin, scale, knee);
        this.horn(knee, [0, 0.01, -0.05], [-1.9, 0, 0], 0.13, 0.028, -0.6);
        // A broad foot with three clawed toes forward and a spur behind.
        const foot = new Group();
        foot.position.set(0, -lower, 0);
        this.ball(scale, foot, [0, 0.02, 0.02], [0.07, 0.045, 0.09]);
        for (const toe of [-1, 0, 1]) {
          this.ball(scale, foot, [toe * 0.045, 0.012, 0.1], [0.026, 0.024, 0.055], [0, toe * 0.3, 0]);
          this.horn(foot, [toe * 0.06, 0.014, 0.145], [UP - 0.1, 0, -toe * 0.3], 0.13, 0.02, 0.9);
        }
        this.horn(foot, [0, 0.02, -0.06], [-UP - 0.2, 0, 0], 0.09, 0.017, -0.8);
        knee.add(foot);
        hip.add(knee);
        this.body.add(hip);
        // Diagonal pairs step together, as a walking animal's do.
        this.legs.push({ hip, knee, phase: (front ? 0 : 0.5) + (side > 0 ? 0 : 0.5) });
      }
    }
  }

  /** A skeleton's body: a spine, a cage of ribs open underneath, shoulder blades, a pelvis, and a fire inside. */
  private buildBoneTorso(): void {
    const { scale: bone, accent, horn } = this.materials;
    // The spine, from the root of the neck back to the root of the tail.
    for (let i = 0; i < 12; i++) {
      const z = 0.42 - i * 0.088;
      const y = 0.78 - Math.abs(i - 4) * 0.008;
      this.ball(bone, this.body, [0, y, z], [0.05, 0.042, 0.05]);
      this.mesh(
        new ConeGeometry(0.022, 0.16 - Math.abs(i - 3) * 0.008, 8),
        horn,
        this.body,
        [0, y + 0.08, z - 0.02],
        [-0.4, 0, 0],
      );
    }
    this.mesh(new CylinderGeometry(0.022, 0.022, 0.98, 8), bone, this.body, [0, 0.775, -0.06], [UP, 0, 0]);
    for (const side of [-1, 1]) {
      // Ribs curving down and round from the spine, longest in the middle of the chest.
      for (let i = 0; i < 7; i++) {
        const z = 0.36 - i * 0.085;
        const long = 1 - Math.abs(i - 2.5) * 0.11;
        this.horn(this.body, [side * 0.04, 0.775, z], ribTurn(side), 0.6 * long, 0.022, 2.5, bone);
      }
      // A shoulder blade and half a pelvis, where the legs hang from.
      this.ball(accent, this.body, [side * 0.17, 0.68, 0.26], [0.045, 0.16, 0.1], [0, 0, side * 0.35]);
      this.ball(accent, this.body, [side * 0.17, 0.62, -0.32], [0.05, 0.14, 0.11], [0, 0, side * 0.4]);
    }
    // A breastbone under the ribs, and the fire that drives the bones burning inside the cage.
    this.ball(accent, this.body, [0, 0.4, 0.16], [0.03, 0.028, 0.2]);
    this.ball(this.glowing, this.body, [0, 0.6, 0.14], [0.1, 0.1, 0.15]);
    this.ball(this.eyes, this.body, [0, 0.6, 0.14], [0.055, 0.055, 0.08]);
  }

  /** The heavy build's extras: ribs and plates of bone over a broader body, on thicker legs under smaller wings. */
  private buildBoneArmour(): void {
    const { belly } = this.materials;
    for (const side of [-1, 1]) {
      // Ribs curving down over the flanks, longest in the middle of the barrel.
      for (let i = 0; i < 6; i++) {
        const z = 0.3 - i * 0.12;
        const long = 1 - Math.abs(i - 2) * 0.13;
        this.horn(
          this.body,
          [side * 0.1, 0.84 - Math.abs(i - 2) * 0.012, z],
          ribTurn(side),
          0.62 * long,
          0.036,
          1.9,
          belly,
        );
      }
      // A shoulder and a hip of bone.
      this.ball(belly, this.body, [side * 0.3, 0.68, 0.24], [0.1, 0.15, 0.17], [0, 0, side * 0.45]);
      this.ball(belly, this.body, [side * 0.27, 0.6, -0.33], [0.08, 0.13, 0.16], [0, 0, side * 0.4]);
    }
    // Vertebrae standing along the spine between the ribs.
    for (let i = 0; i < 7; i++)
      this.ball(belly, this.body, [0, 0.83 - Math.abs(i - 2.5) * 0.012, 0.36 - i * 0.12], [0.05, 0.045, 0.045]);
    for (const leg of this.legs) leg.hip.scale.set(1.4, 1.02, 1.4);
    for (const wing of this.wings) wing.root.scale.setScalar(0.68);
    // Broader and deeper through the body than the lean dragon.
    this.body.scale.set(1.18, 1.04, 1.04);
  }

  // ---- moving ----

  /** Forget everything a previous owner did. */
  reset(): void {
    this.action = null;
    this.seenActionAt = -1;
    this.death = 0;
  }

  /** Bends a chain: each segment points along the direction its angles give, and starts where the last ended. */
  private bend(chain: Chain, angles: (i: number, t: number) => [yaw: number, pitch: number]): Group {
    let x = chain.root.x;
    let y = chain.root.y;
    let z = chain.root.z;
    const last = chain.segments.length - 1;
    for (let i = 0; i <= last; i++) {
      const [yaw, pitch] = angles(i, i / last);
      const segment = chain.segments[i];
      segment.position.set(x, y, z);
      // Turns the segment's own +y axis to the direction given by yaw and pitch.
      segment.rotation.set(UP - pitch, yaw, 0);
      const length = chain.lengths[i];
      x += Math.sin(yaw) * Math.cos(pitch) * length;
      y += Math.sin(pitch) * length;
      z += Math.cos(yaw) * Math.cos(pitch) * length;
    }
    return chain.segments[last];
  }

  private applyPose(pose: Pose, walk: number): void {
    const t = this.time;
    const dying = this.death;
    const alive = 1 - dying;

    // The body breathes, bounces with each step, rears, and sinks when it dies.
    const step = Math.abs(Math.sin(this.stride * Math.PI * 2));
    this.body.position.y = (Math.sin(t * 2) * 0.012 + step * 0.03 * walk) * alive - dying * 0.26;
    this.body.rotation.x = -pose.rear * 0.42 + walk * 0.06;
    this.body.rotation.z = dying * 0.55;

    for (const head of this.heads) {
      const n = head.side + 1;
      const lunge = pose.lunge[n];
      const middle = head.side === 0;
      // An S: up out of the shoulders, then curving over to look ahead.
      // A single head is carried lower and further forward, on a deeper curve.
      const rise =
        (this.heavy ? 52 : this.skeleton ? 78 : this.single ? 74 : middle ? 84 : 64) * DEG +
        pose.raise * 8 * DEG -
        lunge * 34 * DEG;
      const level =
        (this.heavy ? -18 : this.single ? -10 : middle ? 12 : 2) * DEG +
        pose.raise * 34 * DEG -
        lunge * 10 * DEG +
        pose.rear * 20 * DEG;
      const outward = head.side * (44 + pose.spread * 24 - lunge * 20) * DEG;
      const end = this.bend(head.chain, (i, f) => {
        const sway = Math.sin(t * 0.9 + head.side * 2.1 + i * 0.35) * 9 * DEG * f * alive;
        const wave = Math.sin(t * 1.3 + head.side * 1.7 + i * 0.5) * 5 * DEG * alive;
        const pitch = rise + (level - rise) * f ** 1.3 + wave;
        // Dying, the necks fall forward and outward onto the ground.
        return [outward * (0.35 + 0.65 * f) + sway + dying * head.side * 0.5, pitch * alive + dying * (0.5 - f * 1.5)];
      });
      // The head sits on the end of the neck, nodding slightly and tucking its chin.
      const length = head.chain.lengths[NECK_SEGMENTS - 1];
      head.holder.position.copy(end.position);
      head.holder.rotation.order = 'YXZ';
      head.holder.rotation.copy(end.rotation);
      head.holder.translateY(length * 0.9);
      head.holder.rotateX((0.28 - lunge * 0.3 + Math.sin(t * 1.1 + head.side) * 0.06) * alive);
      head.holder.rotateZ(Math.sin(t * 0.7 + head.side * 3) * 0.08 * alive);
      head.jaw.rotation.x =
        (this.single ? 0.22 : 0.06) +
        pose.jaw[n] * 0.62 +
        (Math.sin(t * 2 + head.side) * 0.03 + 0.03) * alive +
        dying * 0.25;
    }

    // The tail trails behind, swinging from side to side, its tip curling up.
    this.bend(this.tail, (i, f) => {
      const swing = Math.sin(t * 1.5 - i * 0.42) * (10 + 14 * walk) * DEG * f * alive;
      const pitch = (-16 + 34 * f * f) * DEG + pose.rear * 0.3 * (1 - f);
      return [Math.PI + swing + dying * 0.6 * f, pitch * alive - dying * 0.25];
    });

    // Wings: a slow beat standing, a faster one walking, up when gathering power, back in a dive, folded in death.
    const beat = Math.sin(t * (2.2 + 3 * walk)) * (0.16 + 0.14 * walk);
    for (const wing of this.wings) {
      wing.root.rotation.z = wing.side * (beat + pose.raise * 0.3 - pose.sweep * 0.35 - dying * 1.5 + 0.72);
      wing.root.rotation.y = wing.side * (-pose.sweep * 0.75 - dying * 0.5 + pose.raise * 0.15);
      wing.root.rotation.x = -pose.rear * 0.2 - pose.sweep * 0.25;
    }

    for (const leg of this.legs) {
      const swing = Math.sin((this.stride + leg.phase) * Math.PI * 2) * walk;
      const lift = Math.max(0, Math.cos((this.stride + leg.phase) * Math.PI * 2)) * walk;
      leg.hip.rotation.x = swing * 0.55 - 0.12 + pose.rear * 0.4 + dying * 0.9;
      leg.knee.rotation.x = 0.3 + lift * 0.7 - pose.rear * 0.3 + dying * 0.6;
    }

    const flare = pose.flare * alive;
    this.glowing.emissiveIntensity = (1.1 + Math.sin(t * 3) * 0.3 + flare * 3) * alive + 0.1;
    // The fire in the cracks between the scales breathes slowly and flares with the crystals.
    const embers = (1.2 + Math.sin(t * 1.7) * 0.35 + flare * 2.5) * alive;
    this.materials.scale.emissiveIntensity = embers;
    this.materials.hide.emissiveIntensity = embers;
    this.wingMaterial.emissiveIntensity = 0.03 + flare * 0.4;
    this.eyes.color.copy(this.glowing.emissive).multiplyScalar(alive * 0.85 + 0.15);
  }

  /** Bend the body for this frame: stand, walk, act or die. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 8);
    this.stride = (this.stride + delta * 1.7 * this.walk) % 1;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = HYDRA_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead)
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
    }
    const pose = restPose();
    if (this.action && clock < this.action.until && !state.dead) {
      const progress = (clock - this.action.from) / (this.action.until - this.action.from);
      ACTIONS[this.action.kind]?.(Math.max(0, progress), pose);
    } else this.action = null;
    this.applyPose(pose, this.walk);
  }
}
