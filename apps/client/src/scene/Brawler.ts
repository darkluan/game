import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
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
 * A dragon in the shape of a man, and a strong one, with four arms: smooth skin over slabs of muscle,
 * a chest far broader than its hips on short thick legs set wide, the upper arms held open like a
 * wrestler's about to take hold and the lower fists planted on its hips, a blunt horned head with
 * tusks, and a knotted sash for its only clothing. Built in code with no model file,
 * on no other hero's frame. It moves by turning its joints every frame. Used the same way as an Actor.
 *
 * It has four forms, each its own body: the young one is lean, with stubs for horns; the grown one
 * is thicker, with swept horns and spines down its back; the third carries a crown of four horns and
 * burns: its spines, its knuckles, bands round its arms and a mark on its chest; and the last, in
 * another colour altogether, has grown a third pair of arms and wears its sash long.
 *
 * Built about one unit tall, facing +z; `height` rescales it.
 */

export interface BrawlerColours {
  /** Which of the four bodies this is: 0 the young one, 3 the last. */
  form: 0 | 1 | 2 | 3;
  /** The skin. */
  hide: string;
  /** The paler skin of the belly. */
  belly: string;
  /** The sash and the wraps on the forearms. */
  cloth: string;
  /** Horns, claws, spines and knuckles. */
  horn: string;
  /** The eyes, and in the last form everything that burns. */
  glow: string;
}

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const BRAWLER_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.4 },
  Q: { clip: 'Q', seconds: 0.6 },
  W: { clip: 'W', seconds: 0.75 },
  E: { clip: 'E', seconds: 0.7 },
  R: { clip: 'R', seconds: 0.95 },
};

const UP = Math.PI / 2;
const DEATH_SECONDS = 0.8;
/** Where the joints are, in parts of its height. */
const HIP = 0.4;
const THIGH = 0.18;
const SHIN = 0.19;
const UPPER_ARM = 0.15;
/** How thick each form is built, against the grown one. */
const BULK = [0.86, 1, 1.1, 1.18] as const;

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

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const ease = (t: number) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};
/** 0 at both ends and 1 in the middle: the shape of something done and undone within one action. */
const there = (t: number) => Math.sin(Math.PI * clamp(t));
/** Up over the first `rise` of the action, held, and down again over its last `fall`. */
const held = (t: number, rise: number, fall: number) => ease(t / rise) * (1 - ease((t - (1 - fall)) / fall));

type Triple = [number, number, number];
/** One arm's pose: shoulder forward, shoulder out, elbow bent forward, forearm curled up. */
type Pose = [forward: number, out: number, elbow: number, curl: number];

interface Arm {
  upper: Group;
  lower: Group;
  side: number;
  /** The light on the fist, in the last form. */
  ember: Sprite | null;
}

export class Brawler {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly hips = new Group();
  private readonly chest = new Group();
  private readonly head = new Group();
  private readonly legs: { upper: Group; lower: Group }[] = [];
  /** The upper pair first, then the lower; within a pair the left arm first. */
  private readonly arms: Arm[] = [];
  private readonly aura: Sprite | null;
  private readonly castShadow: boolean;
  private readonly form: 0 | 1 | 2 | 3;
  /** The two last forms burn: spines, knuckles, bands and a mark on the chest. */
  private readonly burning: boolean;
  private readonly bulk: number;
  private readonly colours: BrawlerColours;
  private readonly hide: MeshStandardMaterial;
  /** The skin gone darker, for the hollows between muscles. */
  private readonly deep: MeshStandardMaterial;
  private readonly belly: MeshStandardMaterial;
  private readonly cloth: MeshStandardMaterial;
  private readonly horn: MeshStandardMaterial;
  private readonly fire: MeshStandardMaterial;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  /** Counts its basic attacks, so that each is thrown with the next fist round. */
  private punches = 0;
  private action: { kind: string; from: number; until: number; fist: number } | null = null;

  constructor(colours: BrawlerColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.colours = colours;
    this.form = colours.form;
    this.burning = this.form >= 2;
    this.bulk = BULK[this.form];
    this.hide = new MeshStandardMaterial({ color: colours.hide, roughness: 0.55 });
    this.deep = new MeshStandardMaterial({ color: colours.hide, roughness: 0.7 });
    this.deep.color.multiplyScalar(0.55);
    this.belly = new MeshStandardMaterial({ color: colours.belly, roughness: 0.6 });
    this.cloth = new MeshStandardMaterial({ color: colours.cloth, roughness: 0.85 });
    this.horn = new MeshStandardMaterial({ color: colours.horn, roughness: 0.4 });
    this.fire = new MeshStandardMaterial({
      color: colours.glow,
      emissive: colours.glow,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.hips.position.y = HIP;
    this.model.add(this.hips);
    for (const side of [-1, 1]) this.legs.push(this.buildLeg(side));
    this.buildBody();
    for (const side of [-1, 1]) this.arms.push(this.buildArm(side, 0));
    for (const side of [-1, 1]) this.arms.push(this.buildArm(side, 2));
    // The last form has grown a third pair, between the other two.
    if (this.form === 3) for (const side of [-1, 1]) this.arms.push(this.buildArm(side, 1));
    this.buildHead();
    this.aura = this.burning ? this.glow(this.chest, 0.95, [0, 0.2, -0.05], 0.16) : null;
  }

  private part(
    geometry: ConstructorParameters<typeof Mesh>[0],
    material: MeshStandardMaterial,
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
        color: this.colours.glow,
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

  /** A short, thick leg: a heavy thigh, a calf, and a broad foot with three claws. */
  private buildLeg(side: number): { upper: Group; lower: Group } {
    const b = this.bulk;
    const upper = new Group();
    upper.position.set(side * 0.085 * b, 0, 0);
    this.hips.add(upper);
    this.part(new CapsuleGeometry(0.062 * b, 0.08, 6, 16), this.hide, upper, [0, -0.085, 0]);
    const lower = new Group();
    lower.position.y = -THIGH;
    upper.add(lower);
    this.part(new SphereGeometry(0.04 * b, 16, 12), this.deep, lower, [0, 0, 0.03]);
    this.part(new CapsuleGeometry(0.048 * b, 0.07, 6, 16), this.hide, lower, [0, -0.085, -0.008]);
    this.part(
      new SphereGeometry(0.07 * b, 16, 12),
      this.hide,
      lower,
      [0, -SHIN + 0.03, 0.035],
      [0, 0, 0],
      [0.9, 0.5, 1.5],
    );
    for (const toe of [-1, 0, 1])
      this.part(
        new ConeGeometry(0.016 * b, 0.05, 10),
        this.horn,
        lower,
        [toe * 0.035 * b, -SHIN + 0.02, 0.135 * b],
        [UP + 0.2, 0, -toe * 0.25],
      );
    return { upper, lower };
  }

  /** The pelvis and its sash, a waist of pale plates, and a chest far broader than the hips under it. */
  private buildBody(): void {
    const b = this.bulk;
    const { hide, deep, belly, cloth, horn, fire, hips, chest } = this;
    this.part(new SphereGeometry(0.115 * b, 18, 12), hide, hips, [0, 0.02, 0], [0, 0, 0], [1, 0.72, 0.85]);
    // The sash: wound twice round the hips, knotted at one side, its two ends hanging, and a flap of it down the front.
    for (const y of [0.035, 0.065])
      this.part(new TorusGeometry(0.1 * b, 0.022, 10, 26), cloth, hips, [0, y, 0], [UP, 0, 0], [1, 0.86, 1]);
    this.part(new SphereGeometry(0.032, 14, 10), cloth, hips, [0.105 * b, 0.05, 0.03]);
    for (const [turn, long] of [
      [0.25, 0.15],
      [-0.1, 0.11],
    ])
      this.part(
        new BoxGeometry(0.034, long, 0.012),
        cloth,
        hips,
        [0.118 * b + turn * 0.05, 0.04 - long / 2, 0.035],
        [0, 0, turn],
      );
    this.part(new BoxGeometry(0.085, 0.15, 0.012), cloth, hips, [0, -0.045, 0.092 * b], [-0.12, 0, 0]);
    this.part(new BoxGeometry(0.085, 0.014, 0.014), horn, hips, [0, -0.118, 0.1 * b], [-0.12, 0, 0]);

    // The last form wears the sash long: a flap to the knee in front and behind, and one at each hip.
    if (this.form === 3) {
      for (const z of [-1, 1])
        this.part(new BoxGeometry(0.13, 0.26, 0.012), cloth, hips, [0, -0.1, z * 0.1 * b], [-z * 0.1, 0, 0]);
      for (const side of [-1, 1])
        this.part(new BoxGeometry(0.012, 0.2, 0.1), cloth, hips, [side * 0.125 * b, -0.07, 0], [0, 0, side * 0.12]);
      this.part(new BoxGeometry(0.13, 0.014, 0.014), fire, hips, [0, -0.228, 0.124 * b], [-0.1, 0, 0]);
    }

    chest.position.y = 0.07;
    hips.add(chest);
    this.part(new SphereGeometry(0.105 * b, 18, 12), hide, chest, [0, 0.07, 0], [0, 0, 0], [1, 1.05, 0.8]);
    // The belly: six blocks of muscle in paler skin, two by three.
    for (let i = 0; i < 3; i++)
      for (const side of [-1, 1])
        this.part(
          new SphereGeometry(0.034 * b, 12, 10),
          belly,
          chest,
          [side * 0.031 * b, 0.03 + i * 0.047, 0.07 * b + i * 0.006],
          [0, 0, 0],
          [1.05, 0.72, 0.5],
        );
    this.part(new SphereGeometry(0.165 * b, 20, 14), hide, chest, [0, 0.225, -0.005], [0, 0, 0], [1.2, 0.82, 0.74]);
    for (const side of [-1, 1])
      this.part(
        new SphereGeometry(0.085 * b, 16, 12),
        this.hide,
        chest,
        [side * 0.08 * b, 0.235, 0.078 * b],
        [0, 0, side * 0.2],
        [1.08, 0.78, 0.6],
      );
    // The neck rises out of a hump of muscle.
    this.part(new SphereGeometry(0.1 * b, 16, 12), hide, chest, [0, 0.31, -0.03], [0, 0, 0], [1.25, 0.6, 0.8]);
    this.part(new CylinderGeometry(0.052 * b, 0.07 * b, 0.07, 16), hide, chest, [0, 0.345, 0]);
    // Spines down the back, from the grown form on; in the last they burn.
    const spines = [0, 4, 6, 7][this.form];
    for (let i = 0; i < spines; i++) {
      const t = i / (spines - 1);
      const tall = 0.07 + Math.sin(t * Math.PI) * 0.05 + this.form * 0.01;
      this.part(
        new ConeGeometry(0.022, tall, 10),
        this.burning ? fire : horn,
        chest,
        [0, 0.33 - t * 0.27, -0.1 * b - Math.sin(t * Math.PI) * 0.03],
        [-UP + 0.5 - t * 0.5, 0, 0],
        [0.55, 1, 1],
      );
    }
    // The last form wears its fire on its chest: a mark over the heart of it.
    if (this.burning) {
      this.part(new BoxGeometry(0.035, 0.035, 0.012), fire, chest, [0, 0.3, 0.1 * b], [-0.3, 0, Math.PI / 4]);
      this.glow(chest, 0.22, [0, 0.3, 0.13 * b], 0.35);
    }
    // The hollow between the two halves of the chest.
    this.part(new BoxGeometry(0.008, 0.1, 0.02), deep, chest, [0, 0.235, 0.112 * b]);
  }

  /**
   * An arm: a round shoulder, a thick upper arm, a forearm bound in cloth and a fist with horn for
   * knuckles. The lower pair hangs from the ribs and is the slighter of the two.
   */
  private buildArm(side: number, row: 0 | 1 | 2): Arm {
    const top = row === 0;
    const b = this.bulk;
    // The young one's lower arms have not filled out yet.
    const k = top ? 1 : row === 1 ? 0.92 : this.form === 0 ? 0.74 : 0.86;
    const { hide, deep, cloth, horn, fire } = this;
    const upper = new Group();
    // With six arms the lowest pair hangs lower, to leave room for the middle one.
    const low = this.form === 3 ? 0.125 : 0.15;
    upper.position.set(side * [0.215, 0.2, 0.165][row] * b, [0.285, 0.21, low][row], [0, 0.025, 0.03][row]);
    this.chest.add(upper);
    this.part(new SphereGeometry(0.075 * b * k, 16, 12), hide, upper, [side * 0.01, 0, 0], [0, 0, 0], [1, 0.92, 1]);
    this.part(new CapsuleGeometry(0.046 * b * k, 0.06, 6, 14), hide, upper, [0, -0.08, 0]);
    this.part(new SphereGeometry(0.046 * b * k, 14, 10), hide, upper, [0, -0.07, 0.018], [0, 0, 0], [0.9, 1.25, 0.9]);
    // A plate of horn on each upper shoulder once it is grown: one spike, then a second in the last form.
    if (top && this.form > 0)
      for (let i = 0; i < Math.min(this.form, 2); i++)
        this.part(
          new ConeGeometry(0.026 * b, 0.09 + (Math.min(this.form, 2) - i) * 0.02, 10),
          horn,
          upper,
          [side * (0.03 + i * 0.045), 0.07 - i * 0.03, -0.01],
          [0, 0, -side * (0.5 + i * 0.55)],
        );
    // The last form burns in a band round each arm.
    if (this.burning) this.part(new TorusGeometry(0.05 * b * k, 0.008, 6, 18), fire, upper, [0, -0.105, 0], [UP, 0, 0]);
    const lower = new Group();
    lower.position.y = -UPPER_ARM;
    upper.add(lower);
    this.part(new SphereGeometry(0.04 * b * k, 12, 10), deep, lower);
    this.part(new CapsuleGeometry(0.042 * b * k, 0.055, 6, 14), hide, lower, [0, -0.065, 0]);
    this.part(new CylinderGeometry(0.047 * b * k, 0.043 * b * k, 0.06, 14), cloth, lower, [0, -0.085, 0]);
    this.part(new TorusGeometry(0.046 * b * k, 0.008, 6, 16), horn, lower, [0, -0.05, 0], [UP, 0, 0]);
    this.part(new SphereGeometry(0.06 * b * k, 16, 12), hide, lower, [0, -0.165, 0], [0, 0, 0], [1, 0.92, 1.05]);
    for (const x of [-1, 0, 1])
      this.part(new SphereGeometry(0.017 * b * k, 10, 8), this.burning ? fire : horn, lower, [
        x * 0.03 * b * k,
        -0.2,
        0.03 * b * k,
      ]);
    const ember = this.burning ? this.glow(lower, 0.2, [0, -0.19, 0.02], 0.3) : null;
    return { upper, lower, side, ember };
  }

  /** A broad skull with a blunt face, a heavy brow, eyes that burn and horns that grow with each form. */
  private buildHead(): void {
    const { hide, deep, horn, fire, head } = this;
    // The last two forms carry the same horns; the last only has them longer.
    const form = Math.min(this.form, 2);
    head.position.y = 0.37;
    // A head big enough to read from the height the game is watched from.
    head.scale.setScalar(1.25);
    this.chest.add(head);
    this.part(new SphereGeometry(0.078, 18, 14), hide, head, [0, 0.065, 0], [0, 0, 0], [1.05, 0.95, 1.05]);
    // The face is blunt, a man's more than a beast's: a broad jaw thrust forward under high cheekbones, a
    // flat nose, and a mouth open wide in a shout: dark inside, a red tongue, teeth above and a
    // tusk standing up at each end. Three studs of horn stand along the chin like a beard.
    this.part(new SphereGeometry(0.064, 16, 12), hide, head, [0, 0.028, 0.04], [0, 0, 0], [1.12, 0.82, 0.98]);
    // The mouth: wide open and round, as in a shout, lipped in the paler skin of the belly.
    this.part(new SphereGeometry(0.044, 16, 12), deep, head, [0, 0.027, 0.083], [0, 0, 0], [1.15, 0.72, 0.4]);
    this.part(new TorusGeometry(0.042, 0.008, 8, 24), this.belly, head, [0, 0.027, 0.09], [0, 0, 0], [1.15, 0.72, 1]);
    this.part(new SphereGeometry(0.028, 12, 10), this.cloth, head, [0, 0.014, 0.09], [0, 0, 0], [1.2, 0.5, 0.4]);
    this.part(new BoxGeometry(0.06, 0.008, 0.01), horn, head, [0, 0.046, 0.098]);
    this.part(new SphereGeometry(0.02, 10, 8), hide, head, [0, 0.064, 0.097], [0, 0, 0], [1.25, 0.8, 0.8]);
    for (const x of [-1, 0, 1])
      this.part(
        new ConeGeometry(0.008, 0.03, 8),
        horn,
        head,
        [x * 0.024, -0.018, 0.082 - Math.abs(x) * 0.01],
        [Math.PI - 0.5, 0, x * 0.3],
      );
    for (const side of [-1, 1]) {
      // The eye: wide and pale with a burning iris and a dark pupil, under a heavy brow drawn down toward the nose in a scowl.
      this.part(new SphereGeometry(0.024, 12, 10), horn, head, [side * 0.041, 0.08, 0.066], [0, 0, 0], [1.2, 0.8, 0.6]);
      this.part(new SphereGeometry(0.012, 10, 8), fire, head, [side * 0.038, 0.079, 0.08], [0, 0, 0], [1, 1, 0.5]);
      this.part(new SphereGeometry(0.006, 8, 6), deep, head, [side * 0.037, 0.079, 0.086], [0, 0, 0], [1, 1, 0.5]);
      this.part(
        new SphereGeometry(0.036, 12, 10),
        hide,
        head,
        [side * 0.044, 0.102, 0.064],
        [0.3, 0, side * 0.42],
        [1.3, 0.4, 0.9],
      );
      this.part(new SphereGeometry(0.024, 10, 8), hide, head, [side * 0.062, 0.052, 0.058], [0, 0, 0], [1, 0.7, 0.8]);
      this.part(new ConeGeometry(0.011, 0.045, 8), horn, head, [side * 0.042, 0.04, 0.095], [0.1, 0, side * 0.2]);
      // An ear like a fin, swept back.
      this.part(
        new ConeGeometry(0.03, 0.1, 8),
        hide,
        head,
        [side * 0.09, 0.07, -0.02],
        [-1.0, 0, -side * 0.9],
        [1, 1, 0.3],
      );
      // The young one has stubs; the grown one horns swept back; the last a second pair below them.
      const long = [0.06, 0.15, 0.2, 0.25][this.form];
      this.part(
        new ConeGeometry(0.014 + form * 0.006, long, 12),
        horn,
        head,
        [side * (0.05 + form * 0.006), 0.115 + long * 0.28, -0.015 - long * 0.3],
        [-0.35 - form * 0.35, 0, -side * (0.25 + form * 0.12)],
      );
      if (this.burning)
        this.part(new ConeGeometry(0.018, 0.13, 12), horn, head, [side * 0.11, 0.075, -0.01], [-0.3, 0, -side * 1.15]);
      if (form > 0)
        this.part(
          new ConeGeometry(0.03, 0.07, 8),
          deep,
          head,
          [side * 0.075, 0.03, 0.01],
          [Math.PI, 0, side * 0.5],
          [0.35, 1, 1],
        );
    }
    // A low ridge over the skull; in the last form it burns like the spines.
    for (let i = 0; i < 1 + form; i++)
      this.part(
        new ConeGeometry(0.016, 0.045 + form * 0.012, 8),
        this.burning ? fire : deep,
        head,
        [0, 0.135 - i * 0.012, 0.03 - i * 0.04],
        [-0.3 - i * 0.35, 0, 0],
        [0.5, 1, 1],
      );
    if (this.burning) this.glow(head, 0.1, [0, 0.079, 0.09], 0.2);
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
    this.death = clamp(this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 9);
    this.stride = (this.stride + delta * 1.7 * this.walk) % 1;
    const t = this.time;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const move = BRAWLER_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (move && clock - incoming.at < 0.2 && !state.dead) {
        if (incoming.kind === 'attack') this.punches++;
        this.action = {
          kind: incoming.kind,
          from: clock,
          until: clock + move.seconds,
          fist: this.punches % this.arms.length,
        };
      }
    }
    if (this.action && (clock >= this.action.until || state.dead)) this.action = null;
    const kind = this.action?.kind;
    const p = this.action ? clamp((clock - this.action.from) / (this.action.until - this.action.from)) : 0;

    // At rest: the upper arms held wide and open like a wrestler's, the lower fists planted on the hips.
    const breath = Math.sin(t * 1.7) * 0.04;
    const guard: Pose = [-0.5 + breath, 0.95, -1.15, 0.45];
    const loose: Pose = [0.1, 0.78 + breath, -0.25, -1.3];
    const pose: Pose[] = [[...guard], [...guard], [...loose], [...loose]];
    let lean = this.walk * 0.14;
    let twist = 0;
    let crouch = 0;
    let swell = 0;
    const lit = [0, 0, 0, 0, 0, 0];
    /** Throw arm `i` straight out in front by `out`, 0 to 1. */
    const punch = (i: number, out: number) => {
      const from = pose[i];
      pose[i] = [from[0] + (-1.5 - from[0]) * out, from[1] * (1 - out * 0.7), from[2] * (1 - out), 0];
      lit[i] = Math.max(lit[i], out);
    };
    if (kind === 'attack') {
      // One fist, and the next one round at the next attack.
      const i = this.action!.fist;
      const out = there(p * 1.15);
      if (i < 4) punch(i, out);
      twist = (this.arms[i].side > 0 ? -1 : 1) * 0.3 * out;
      lean += 0.08 * out;
    } else if (kind === 'Q') {
      // All four, one after another and round again.
      const hard = held(p, 0.15, 0.2);
      for (let i = 0; i < 4; i++) punch(i, Math.max(0, Math.sin(p * Math.PI * 7 + i * UP)) * hard);
      lean += 0.16 * hard;
      twist = Math.sin(p * Math.PI * 7) * 0.18 * hard;
    } else if (kind === 'W') {
      // The upper hands take hold, the lower ones come up under, and the lot goes over the shoulder.
      const hold = ease(p / 0.3);
      const over = ease((p - 0.3) / 0.4) * (1 - ease((p - 0.85) / 0.15));
      for (let i = 0; i < 4; i++) {
        pose[i] = [-1.4 * hold - (i < 2 ? 2.0 : 1.2) * over, 0.2 + 0.25 * over, -0.3 * hold, 0];
        lit[i] = hold * (1 - over);
      }
      const back = 1 - ease((p - 0.85) / 0.15);
      for (const one of pose) one[0] *= back;
      lean += 0.25 * hold * (1 - over) - 0.4 * over;
      crouch = 0.03 * hold * (1 - over);
    } else if (kind === 'E') {
      // Every arm flexed out and up, the chest swelling.
      const hard = held(p, 0.25, 0.25);
      for (let i = 0; i < 4; i++) {
        const top = i < 2;
        pose[i] = [
          pose[i][0] * (1 - hard),
          pose[i][1] + ((top ? 1.45 : 0.85) - pose[i][1]) * hard,
          pose[i][2] * (1 - hard),
          (top ? 1.75 : -1.5) * hard,
        ];
        lit[i] = hard;
      }
      swell = hard;
      crouch = 0.025 * hard;
      lean -= 0.1 * hard;
    } else if (kind === 'R') {
      // All four fists up over the head, held there, and brought down into the ground together.
      const up = ease(p / 0.3) * (1 - ease((p - 0.45) / 0.12));
      const down = ease((p - 0.45) / 0.12) * (1 - ease((p - 0.8) / 0.2));
      for (let i = 0; i < 4; i++) {
        pose[i] = [
          pose[i][0] * (1 - up - down) - (i < 2 ? 3.0 : 2.6) * up - (i < 2 ? 0.75 : 0.45) * down,
          pose[i][1] * (1 - up - down) + 0.25 * up + (i < 2 ? 0.25 : 0.5) * down,
          pose[i][2] * (1 - up - down) - 0.25 * down,
          0,
        ];
        lit[i] = Math.max(up * 0.6, down);
      }
      lean += -0.22 * up + 0.75 * down;
      crouch = 0.1 * down;
      swell = up * 0.6;
    }

    // A middle pair does what lies between the pair above it and the pair below, unless it is the one punching.
    for (let i = 4; i < this.arms.length; i++) {
      const jab = kind === 'attack' && this.action!.fist === i ? there(p * 1.15) : 0;
      const [a, b] = [pose[i - 4], pose[i - 2]];
      pose[i] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.15, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2];
      lit[i] = (lit[i - 4] + lit[i - 2]) / 2;
      if (jab > 0) punch(i, jab);
    }

    const gone = ease(this.death);
    const step = this.stride * Math.PI * 2;
    const bob = Math.abs(Math.sin(step)) * 0.014 * this.walk;
    // It dies on its back, the arms falling open.
    this.hips.position.set(0, HIP - crouch + bob - gone * (HIP - 0.12), -gone * 0.12);
    this.hips.rotation.set(lean * 0.5 - gone * 1.4, twist * 0.4 + Math.sin(step) * 0.08 * this.walk, 0);
    this.chest.rotation.set(lean * 0.5, twist * 0.6, 0);
    this.chest.scale.setScalar(1 + swell * 0.06 + breath * 0.25);
    this.head.rotation.set(-lean * 0.7 + gone * 0.3, -twist * 0.5 + Math.sin(t * 0.6) * 0.1 * (1 - this.walk), 0);
    this.legs.forEach((leg, i) => {
      const swing = Math.sin(step + (i ? Math.PI : 0)) * this.walk;
      leg.upper.rotation.x = -swing * 0.6 - crouch * 7 - lean * 0.5 + gone * 1.1;
      // It stands with its feet set wide.
      leg.upper.rotation.z = (i ? 1 : -1) * 0.2;
      leg.lower.rotation.z = (i ? -1 : 1) * 0.2;
      // The knee only ever bends one way.
      leg.lower.rotation.x = Math.max(0, swing) * 0.9 + crouch * 14;
    });
    this.arms.forEach((arm, i) => {
      const [forward, out, elbow, curl] = pose[i];
      // The lower pair swings with the stride; the upper stays open.
      const swing = i < 2 ? 0 : Math.sin(step + (arm.side > 0 ? 0 : Math.PI)) * this.walk * 0.4;
      arm.upper.rotation.set(forward + swing - gone * 0.9, 0, arm.side * (out + gone * 0.7));
      arm.lower.rotation.set(elbow * (1 - gone * 0.6), 0, arm.side * curl);
      if (arm.ember) {
        arm.ember.material.opacity = (0.3 + lit[i] * 0.6) * (1 - gone);
        arm.ember.scale.setScalar(0.2 + lit[i] * 0.22);
      }
    });
    if (this.aura) this.aura.material.opacity = (0.14 + Math.sin(t * 2.2) * 0.04 + swell * 0.2) * (1 - gone);
    this.fire.emissiveIntensity = (1.1 + Math.sin(t * 4) * 0.2 + swell * 0.8) * (1 - gone * 0.7);
  }
}
