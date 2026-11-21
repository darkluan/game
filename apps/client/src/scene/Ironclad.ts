import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
} from 'three';
import type { ActorAction } from '@/lib/session';

/**
 * A tall, lean figure in plate, built in code with no model file and on no other hero's frame: long
 * legs in flared greaves, a narrow waist under a wedge of breastplate, a small closed helm with a
 * slit of light for eyes and a crest of fire, and arms that end in guns, each as thick as its
 * thigh. It moves by turning its joints every frame. Used the same way as an Actor.
 *
 * Built about one unit tall, facing +z; `height` rescales it.
 */

export interface IroncladColours {
  /** The body under the plate: thighs, upper arms, waist. */
  under: string;
  /** The plate. */
  plate: string;
  /** The edging on the plate. */
  trim: string;
  /** The fire: the crest, the eyes, the furnace in the chest, the mouths of the guns. */
  fire: string;
  /** The helm, when it is of another metal than the plate. */
  helm?: string;
}

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const IRONCLAD_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.45 },
  Q: { clip: 'Q', seconds: 0.55 },
  W: { clip: 'W', seconds: 0.7 },
  E: { clip: 'E', seconds: 0.55 },
  R: { clip: 'R', seconds: 0.95 },
};

const UP = Math.PI / 2;
const DEATH_SECONDS = 0.8;
/** Where the joints are, in parts of its height. */
const HIP = 0.5;
const THIGH = 0.23;
const SHIN = 0.27;
const SHOULDER = 0.27;
const UPPER_ARM = 0.13;

let glowMap: Texture | null = null;

function glowTexture(): Texture {
  if (glowMap) return glowMap;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fade.addColorStop(0, 'rgba(255,255,255,1)');
  fade.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  glowMap = new CanvasTexture(canvas);
  glowMap.colorSpace = SRGBColorSpace;
  return glowMap;
}

const ease = (t: number) => t * t * (3 - 2 * t);
/** 0 at both ends and 1 in the middle: the shape of something done and undone within one action. */
const there = (t: number) => Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
/** A sharp jolt a third of the way in: the kick of a gun going off. */
const kick = (t: number) => Math.exp(-(((t - 0.33) / 0.09) ** 2));

type Triple = [number, number, number];

interface Arm {
  upper: Group;
  lower: Group;
  muzzle: Sprite;
}

export class Ironclad {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly hips = new Group();
  private readonly chest = new Group();
  private readonly head = new Group();
  private readonly legs: { upper: Group; lower: Group }[] = [];
  private readonly arms: Arm[] = [];
  private readonly flames: Mesh[] = [];
  private readonly heart: Sprite;
  private readonly castShadow: boolean;
  private readonly materials: Record<Exclude<keyof IroncladColours, 'helm'>, MeshStandardMaterial>;
  private readonly helm: MeshStandardMaterial;
  private readonly dark = new MeshStandardMaterial({ color: '#15161c', roughness: 0.5, flatShading: true });
  private readonly colours: IroncladColours;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;

  constructor(colours: IroncladColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.colours = colours;
    this.materials = {
      under: new MeshStandardMaterial({ color: colours.under, roughness: 0.7 }),
      // Cut in flats, and with little metal in it: with no sky to mirror, true metal shows black here.
      plate: new MeshStandardMaterial({ color: colours.plate, roughness: 0.4, metalness: 0.25, flatShading: true }),
      trim: new MeshStandardMaterial({ color: colours.trim, roughness: 0.3, metalness: 0.3, flatShading: true }),
      fire: new MeshStandardMaterial({
        color: colours.fire,
        emissive: colours.fire,
        emissiveIntensity: 1,
        roughness: 0.3,
      }),
    };
    this.helm = colours.helm
      ? new MeshStandardMaterial({ color: colours.helm, roughness: 0.3, metalness: 0.3, flatShading: true })
      : this.materials.plate;
    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.hips.position.y = HIP;
    this.model.add(this.hips);
    for (const side of [-1, 1]) this.legs.push(this.buildLeg(side));
    this.heart = this.buildBody();
    for (const side of [-1, 1]) this.arms.push(this.buildArm(side));
    this.buildHead();
  }

  private part(
    geometry: ConstructorParameters<typeof Mesh>[0],
    material: MeshStandardMaterial | MeshBasicMaterial,
    parent: Group,
    position: Triple = [0, 0, 0],
    rotation: Triple = [0, 0, 0],
    scale: Triple = [1, 1, 1],
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.scale.set(...scale);
    mesh.castShadow = this.castShadow;
    parent.add(mesh);
    return mesh;
  }

  /** A light hung on `parent`, drawn over what is behind it. */
  private glow(parent: Group, size: number, position: Triple, opacity: number): Sprite {
    const light = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: this.colours.fire,
        transparent: true,
        opacity,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    light.position.set(...position);
    light.scale.setScalar(size);
    parent.add(light);
    return light;
  }

  /** A long leg: a slim thigh, a knee cap, and a greave that flares out to a heavy boot. */
  private buildLeg(side: number): { upper: Group; lower: Group } {
    const { under, plate, trim, fire } = this.materials;
    const upper = new Group();
    upper.position.set(side * 0.07, 0, 0);
    this.hips.add(upper);
    this.part(new CylinderGeometry(0.042, 0.034, THIGH, 6), under, upper, [0, -THIGH / 2, 0]);
    const lower = new Group();
    lower.position.y = -THIGH;
    upper.add(lower);
    this.part(new CylinderGeometry(0.04, 0.085, SHIN, 6), plate, lower, [0, -SHIN / 2, 0]);
    this.part(new TorusGeometry(0.086, 0.012, 4, 6), trim, lower, [0, -SHIN + 0.012, 0], [UP, 0, 0]);
    this.part(new BoxGeometry(0.13, 0.05, 0.19), plate, lower, [0, -SHIN + 0.025, 0.04]);
    this.part(new ConeGeometry(0.05, 0.1, 4), trim, lower, [0, -SHIN + 0.03, 0.15], [UP, UP / 2, 0], [1, 1, 0.6]);
    // The knee: a pointed cap with a slit of fire under it.
    this.part(new ConeGeometry(0.05, 0.11, 4), plate, lower, [0, 0.02, 0.035], [0.5, UP / 2, 0]);
    this.part(new BoxGeometry(0.05, 0.012, 0.01), fire, lower, [0, -0.05, 0.062]);
    return { upper, lower };
  }

  /** A narrow waist, a skirt of plates, and a breastplate like a wedge with a furnace door in it. */
  private buildBody(): Sprite {
    const { under, plate, trim, fire } = this.materials;
    this.part(new CylinderGeometry(0.075, 0.095, 0.08, 6), under, this.hips, [0, 0.02, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      this.part(
        new ConeGeometry(0.06, 0.16, 4),
        i % 2 ? trim : plate,
        this.hips,
        [Math.sin(a) * 0.095, -0.03, Math.cos(a) * 0.08],
        [Math.PI + Math.cos(a) * 0.35, a, -Math.sin(a) * 0.35],
        [1, 1, 0.35],
      );
    }
    this.chest.position.y = 0.06;
    this.hips.add(this.chest);
    this.part(new CylinderGeometry(0.06, 0.07, 0.09, 6), under, this.chest, [0, 0.04, 0]);
    // The breastplate: broad at the shoulders, a point at the belt.
    this.part(new CylinderGeometry(0.15, 0.07, 0.17, 6), plate, this.chest, [0, 0.16, 0], [0, 0, 0], [1, 1, 0.75]);
    this.part(new CylinderGeometry(0.11, 0.15, 0.05, 6), trim, this.chest, [0, 0.265, 0], [0, 0, 0], [1, 1, 0.75]);
    this.part(new ConeGeometry(0.06, 0.12, 4), plate, this.chest, [0, 0.05, 0.075], [Math.PI, UP / 2, 0], [1, 1, 0.4]);
    // The furnace: a slot of fire across the chest behind three bars.
    this.part(new BoxGeometry(0.13, 0.055, 0.02), fire, this.chest, [0, 0.185, 0.105]);
    for (const x of [-0.04, 0, 0.04])
      this.part(new BoxGeometry(0.012, 0.07, 0.03), plate, this.chest, [x, 0.185, 0.112]);
    // Two stacks behind the shoulders that burn, as on anything with a fire inside it.
    for (const side of [-1, 1]) {
      this.part(
        new CylinderGeometry(0.022, 0.028, 0.14, 5),
        plate,
        this.chest,
        [side * 0.07, 0.28, -0.1],
        [-0.35, 0, 0],
      );
      const flame = this.part(
        new ConeGeometry(0.024, 0.11, 5),
        fire,
        this.chest,
        [side * 0.07, 0.38, -0.14],
        [-0.35, 0, 0],
      );
      this.flames.push(flame);
    }
    return this.glow(this.chest, 0.3, [0, 0.185, 0.14], 0.3);
  }

  /** A slim upper arm under a great angular shoulder, and for a forearm a gun: a drum, a banded barrel, a flared mouth. */
  private buildArm(side: number): Arm {
    const { under, plate, trim, fire } = this.materials;
    const upper = new Group();
    upper.position.set(side * 0.19, SHOULDER, 0);
    this.chest.add(upper);
    this.part(new CylinderGeometry(0.032, 0.028, UPPER_ARM, 6), under, upper, [0, -UPPER_ARM / 2, 0]);
    // The shoulder: two plates, one over the other, and a fin standing up from the top one.
    this.part(new CylinderGeometry(0.05, 0.105, 0.09, 5), plate, upper, [side * 0.02, 0.025, 0], [0, 0, side * 0.35]);
    this.part(new CylinderGeometry(0.105, 0.09, 0.03, 5), trim, upper, [side * 0.035, -0.02, 0], [0, 0, side * 0.35]);
    this.part(
      new ConeGeometry(0.04, 0.16, 4),
      plate,
      upper,
      [side * 0.06, 0.11, 0],
      [0, UP / 2, -side * 0.5],
      [1, 1, 0.3],
    );
    const lower = new Group();
    lower.position.y = -UPPER_ARM;
    upper.add(lower);
    // The gun hangs from the elbow, its mouth at the bottom.
    this.part(new CylinderGeometry(0.06, 0.07, 0.08, 6), plate, lower, [0, -0.03, 0]);
    this.part(new CylinderGeometry(0.052, 0.058, 0.2, 8), under, lower, [0, -0.16, 0]);
    for (const y of [-0.09, -0.16, -0.23])
      this.part(new TorusGeometry(0.058, 0.01, 4, 8), trim, lower, [0, y, 0], [UP, 0, 0]);
    this.part(new CylinderGeometry(0.058, 0.08, 0.06, 8), plate, lower, [0, -0.285, 0]);
    this.part(new CylinderGeometry(0.06, 0.06, 0.012, 8), fire, lower, [0, -0.31, 0]);
    // A guard over the back of the gun, like the back of a gauntlet, and a sight.
    this.part(new ConeGeometry(0.05, 0.2, 4), plate, lower, [side * 0.055, -0.1, 0], [Math.PI, UP / 2, 0], [0.4, 1, 1]);
    this.part(new BoxGeometry(0.012, 0.03, 0.012), trim, lower, [0, -0.25, 0.07]);
    return { upper, lower, muzzle: this.glow(lower, 0.22, [0, -0.33, 0], 0.25) };
  }

  /** A small closed helm: a visor that comes to a point, a slit of light for eyes, cheek plates, and a crest of fire. */
  private buildHead(): void {
    const { plate, fire } = this.materials;
    // The skull of the helm in its own metal; the visor, the cheeks and the ridge in black.
    const { helm, dark } = this;
    this.head.position.y = 0.3;
    this.chest.add(this.head);
    this.part(new CylinderGeometry(0.035, 0.045, 0.04, 6), this.materials.under, this.head, [0, 0, 0]);
    this.part(new SphereGeometry(0.075, 7, 5), helm, this.head, [0, 0.085, 0], [0, Math.PI / 7, 0], [1, 1.1, 1.08]);
    this.part(new ConeGeometry(0.06, 0.11, 4), dark, this.head, [0, 0.07, 0.055], [UP + 0.35, UP / 2, 0], [1, 1, 0.8]);
    this.part(new BoxGeometry(0.1, 0.014, 0.02), fire, this.head, [0, 0.092, 0.072]);
    for (const side of [-1, 1]) {
      this.part(
        new ConeGeometry(0.03, 0.1, 4),
        dark,
        this.head,
        [side * 0.07, 0.045, 0.02],
        [Math.PI, UP / 2, 0],
        [0.4, 1, 1],
      );
      this.part(
        // A long fin standing up from each side of the helm, like an ear pricked.
        new ConeGeometry(0.026, 0.24, 4),
        plate,
        this.head,
        [side * 0.095, 0.2, -0.02],
        [-0.2, 0, -side * 0.28],
        [0.4, 1, 1],
      );
    }
    this.part(new BoxGeometry(0.014, 0.05, 0.14), dark, this.head, [0, 0.165, -0.01]);
    // The crest: five tongues of fire, the tallest in the middle, leaning back.
    for (let i = 0; i < 5; i++) {
      const tall = 0.2 - Math.abs(i - 2) * 0.04;
      const flame = this.part(
        new ConeGeometry(0.03, tall, 5),
        fire,
        this.head,
        [0, 0.18 + tall / 2, 0.05 - i * 0.035],
        [-0.25 - i * 0.12, 0, 0],
        [0.6, 1, 1],
      );
      this.flames.push(flame);
    }
    this.glow(this.head, 0.34, [0, 0.27, -0.02], 0.3);
    this.glow(this.head, 0.14, [0, 0.092, 0.09], 0.4);
  }

  /** Forget everything a previous owner did. */
  reset(): void {
    this.action = null;
    this.seenActionAt = -1;
    this.death = 0;
  }

  /** Pick the pose for this frame and move every joint to it. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 9);
    this.stride = (this.stride + delta * 1.9 * this.walk) % 1;
    const t = this.time;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = IRONCLAD_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead)
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
    }
    if (this.action && (clock >= this.action.until || state.dead)) this.action = null;
    const kind = this.action?.kind;
    const p = this.action ? Math.max(0, (clock - this.action.from) / (this.action.until - this.action.from)) : 0;

    // At rest: the guns held a little forward and apart, breathing. Each arm is [shoulder forward, shoulder out, elbow].
    const breath = Math.sin(t * 1.8) * 0.03;
    const arm: Triple[] = [
      [-0.2 + breath, 0.16, -0.55],
      [-0.2 - breath, 0.16, -0.55],
    ];
    let lean = this.walk * 0.16;
    let twist = 0;
    let crouch = 0;
    let lift = 0;
    let back = 0;
    const fired = [0, 0];
    if (kind === 'attack' || kind === 'Q') {
      // The right gun comes up level, fires and kicks back.
      const up = ease(Math.min(1, p * 4)) * (1 - ease(Math.max(0, p * 2.5 - 1.5)));
      arm[1] = [-0.2 - 1.3 * up + kick(p) * 0.35, 0.16 - 0.1 * up, -0.55 + 0.5 * up];
      twist = -0.25 * up;
      back = kick(p) * (kind === 'Q' ? 0.05 : 0.025);
      fired[1] = kick(p);
    } else if (kind === 'W') {
      // The left gun is thrown up and over, to lob what it throws.
      const up = there(p);
      arm[0] = [-0.2 - 2.1 * up, 0.16 + 0.2 * up, -0.55 + 0.3 * up];
      twist = 0.3 * up;
      lean -= 0.12 * up;
      fired[0] = kick(p);
    } else if (kind === 'E') {
      // Both guns down at its own feet; the shot throws it into the air.
      const down = there(p);
      for (const one of arm) {
        one[0] = -0.2 + 0.1 * down;
        one[2] = -0.55 + 0.5 * down;
      }
      crouch = ease(Math.min(1, p * 5)) * (1 - ease(Math.min(1, Math.max(0, p * 5 - 1)))) * 0.06;
      lift = there(Math.max(0, (p - 0.2) / 0.8)) * 0.16;
      lean += down * 0.3;
      fired[0] = fired[1] = kick(p);
    } else if (kind === 'R') {
      // Braced, both guns brought together and level, held while they charge, then the great kick.
      const up = ease(Math.min(1, p * 3)) * (1 - ease(Math.max(0, p * 4 - 3)));
      const jolt = Math.exp(-(((p - 0.6) / 0.08) ** 2));
      for (const one of arm) {
        one[0] = -0.2 - 1.3 * up + jolt * 0.4;
        one[1] = 0.16 - 0.3 * up;
        one[2] = -0.55 + 0.5 * up;
      }
      crouch = up * 0.05;
      lean += up * 0.12 - jolt * 0.25;
      back = jolt * 0.09;
      fired[0] = fired[1] = Math.max(jolt, Math.min(1, p / 0.6) * 0.6 * up);
    }

    const gone = ease(this.death);
    const step = this.stride * Math.PI * 2;
    const bob = Math.abs(Math.sin(step)) * 0.015 * this.walk;
    this.hips.position.set(0, HIP - crouch + lift + bob - gone * (HIP - 0.1), -back - gone * 0.15);
    this.hips.rotation.set(lean - gone * 1.35, twist * 0.4, 0);
    this.chest.rotation.set(0, twist * 0.6, 0);
    this.head.rotation.set(-lean * 0.6 + gone * 0.4, -twist * 0.5 + Math.sin(t * 0.6) * 0.08 * (1 - this.walk), 0);
    this.legs.forEach((leg, i) => {
      const swing = Math.sin(step + (i ? Math.PI : 0)) * this.walk;
      leg.upper.rotation.x = -swing * 0.65 - crouch * 6 - lean * 0.6 + gone * 0.9;
      // The knee only ever bends one way.
      leg.lower.rotation.x = Math.max(0, swing) * 0.9 + crouch * 12 + (lift > 0 ? 0.5 * there(lift / 0.16) : 0);
    });
    this.arms.forEach((one, i) => {
      const side = i ? 1 : -1;
      const counter = Math.sin(step + (i ? 0 : Math.PI)) * this.walk * 0.25;
      one.upper.rotation.set(arm[i][0] + counter - gone * 0.6, 0, side * arm[i][1] + side * gone * 0.5);
      one.lower.rotation.x = arm[i][2];
      // The mouth of a gun flares as it goes off.
      one.muzzle.material.opacity = 0.25 + fired[i] * 0.75;
      one.muzzle.scale.setScalar(0.22 + fired[i] * 0.5);
    });
    // The fire never burns twice the same way.
    this.flames.forEach((flame, i) => {
      flame.scale.y = (1 + Math.sin(t * 11 + i * 1.7) * 0.18 + Math.sin(t * 23 + i) * 0.08) * (1 - gone * 0.8);
    });
    this.heart.material.opacity = (0.3 + Math.sin(t * 3) * 0.08 + Math.max(...fired) * 0.4) * (1 - gone);
  }
}
