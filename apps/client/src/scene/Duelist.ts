import {
  AdditiveBlending,
  CanvasTexture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
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
 * A swordsman of the night with a blade in each hand, built in code with no model file and on no
 * other hero's frame: a low, broad figure wrapped in a ragged hooded cloak, a blank mask with two
 * points of light for eyes, round shoulder plates, and two long curved blades that burn with a
 * will-o'-the-wisp fire. It moves by turning its joints every frame. Used the same way as an Actor.
 *
 * Built about one unit tall, facing +z; `height` rescales it.
 */

export interface DuelistColours {
  /** Hood and cloak. */
  cloak: string;
  /** Tunic, arms and legs. */
  cloth: string;
  /** Shoulder plates, bracers, greaves, the mask. */
  plate: string;
  /** The edging on the plate and the fittings of the blades. */
  trim: string;
  /** The fire on the blades and in the eyes. */
  fire: string;
  /** Set once the fire has taken the whole body: tongues of it rise from shoulders, back, hips and hood. */
  ablaze?: boolean;
}

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const DUELIST_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.4 },
  Q: { clip: 'Q', seconds: 0.45 },
  W: { clip: 'W', seconds: 0.6 },
  E: { clip: 'E', seconds: 0.6 },
  R: { clip: 'R', seconds: 0.8 },
};

const UP = Math.PI / 2;
const DEATH_SECONDS = 0.8;
/** Where the joints are, in parts of its height. */
const HIP = 0.42;
const THIGH = 0.2;
const SHIN = 0.22;
const SHOULDER = 0.25;
const UPPER_ARM = 0.13;
const BLADE = 0.66;

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

type Triple = [number, number, number];

interface Arm {
  upper: Group;
  lower: Group;
  /** The blade, hinged at the hand. */
  blade: Group;
  light: Sprite;
}

export class Duelist {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly hips = new Group();
  private readonly chest = new Group();
  private readonly head = new Group();
  private readonly legs: { upper: Group; lower: Group }[] = [];
  private readonly arms: Arm[] = [];
  private readonly tails: Group[] = [];
  private readonly wisps: Mesh[] = [];
  /** The tongues of fire around an ablaze body, each with the height it burns at and its own beat. */
  private readonly flames: { mesh: Mesh; tall: number; beat: number }[] = [];
  private readonly halo: Sprite | null = null;
  private readonly aura: Sprite;
  private readonly castShadow: boolean;
  private readonly materials: Record<Exclude<keyof DuelistColours, 'ablaze'>, MeshStandardMaterial>;
  private readonly colours: DuelistColours;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;
  /** Which hand strikes next: basic attacks go left, right, left. */
  private hand = 0;

  constructor(colours: DuelistColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.colours = colours;
    const soft = (color: string, extra: object = {}) => new MeshStandardMaterial({ color, roughness: 0.75, ...extra });
    this.materials = {
      cloak: soft(colours.cloak, { side: DoubleSide }),
      cloth: soft(colours.cloth),
      // Little metal in it: with no sky to mirror, true metal shows black here.
      plate: soft(colours.plate, { roughness: 0.4, metalness: 0.25 }),
      trim: soft(colours.trim, { roughness: 0.3, metalness: 0.3 }),
      fire: soft(colours.fire, { emissive: colours.fire, emissiveIntensity: 0.85, roughness: 0.3 }),
    };
    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.hips.position.y = HIP;
    this.model.add(this.hips);
    for (const side of [-1, 1]) this.legs.push(this.buildLeg(side));
    this.buildBody();
    for (const side of [-1, 1]) this.arms.push(this.buildArm(side));
    this.buildHead();
    this.aura = this.glow(this.hips, 0.01, [0, 0.1, 0], 0);
    if (colours.ablaze) this.halo = this.buildBlaze();
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

  /** A short strong leg in loose cloth, a round greave over the shin, a soft boot. */
  private buildLeg(side: number): { upper: Group; lower: Group } {
    const { cloth, plate, trim } = this.materials;
    const upper = new Group();
    upper.position.set(side * 0.075, 0, 0);
    this.hips.add(upper);
    this.part(new CylinderGeometry(0.058, 0.046, THIGH, 12), cloth, upper, [0, -THIGH / 2, 0]);
    const lower = new Group();
    lower.position.y = -THIGH;
    upper.add(lower);
    this.part(new SphereGeometry(0.05, 12, 8), plate, lower, [0, 0, 0.012]);
    this.part(new CylinderGeometry(0.046, 0.04, SHIN, 12), cloth, lower, [0, -SHIN / 2, 0]);
    this.part(new SphereGeometry(0.055, 12, 8), plate, lower, [0, -SHIN * 0.45, 0.014], [0, 0, 0], [0.9, 1.9, 0.8]);
    this.part(new TorusGeometry(0.047, 0.008, 6, 16), trim, lower, [0, -SHIN + 0.05, 0], [UP, 0, 0]);
    this.part(new SphereGeometry(0.06, 12, 8), cloth, lower, [0, -SHIN + 0.025, 0.03], [0, 0, 0], [0.85, 0.45, 1.5]);
    return { upper, lower };
  }

  /** A broad chest in a wrapped tunic, a sash with a clasp, and the cloak: a yoke over the shoulders and ragged tails behind. */
  private buildBody(): void {
    const { cloth, cloak, plate, trim, fire } = this.materials;
    this.part(new SphereGeometry(0.11, 14, 10), cloth, this.hips, [0, 0.01, 0], [0, 0, 0], [1.05, 0.8, 0.85]);
    this.part(new TorusGeometry(0.105, 0.02, 8, 20), trim, this.hips, [0, 0.05, 0], [UP, 0, 0], [1, 0.82, 1]);
    this.part(new SphereGeometry(0.028, 10, 8), fire, this.hips, [0, 0.05, 0.095], [0, 0, 0], [1, 1.2, 0.6]);
    // Two flaps of the tunic hanging over the thighs.
    for (const side of [-1, 1])
      this.part(
        new ConeGeometry(0.07, 0.2, 12),
        cloth,
        this.hips,
        [side * 0.07, -0.07, 0.03],
        [Math.PI, 0, 0],
        [1, 1, 0.4],
      );
    this.chest.position.y = 0.07;
    this.hips.add(this.chest);
    this.part(new SphereGeometry(0.125, 16, 12), cloth, this.chest, [0, 0.14, 0], [0, 0, 0], [1.15, 1.05, 0.78]);
    this.part(new SphereGeometry(0.1, 14, 10), plate, this.chest, [0, 0.15, 0.05], [0, 0, 0], [1, 0.9, 0.6]);
    this.part(new TorusGeometry(0.07, 0.008, 6, 20), trim, this.chest, [0, 0.15, 0.105], [0, 0, 0], [1, 0.9, 1]);
    this.part(new SphereGeometry(0.022, 10, 8), fire, this.chest, [0, 0.15, 0.112]);
    // Two straps crossed over the breast, each with a row of studs.
    for (const side of [-1, 1]) {
      this.part(
        new CylinderGeometry(0.012, 0.012, 0.3, 8),
        trim,
        this.chest,
        [side * 0.045, 0.13, 0.085],
        [0.25, 0, side * 0.55],
        [1, 1, 0.5],
      );
    }
    // The cloak's yoke, and five ragged tails of different lengths hanging from it.
    this.part(new SphereGeometry(0.16, 16, 10), cloak, this.chest, [0, 0.215, -0.045], [0, 0, 0], [1.15, 0.42, 0.8]);
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 0.075;
      const tail = new Group();
      tail.position.set(x, 0.2, -0.1 + Math.abs(i - 2) * 0.025);
      this.chest.add(tail);
      const long = 0.5 - Math.abs(i - 2) * 0.06 + (i % 2) * 0.05;
      const cut = new ConeGeometry(0.075, long, 8);
      cut.translate(0, -long / 2, 0);
      this.part(cut, cloak, tail, [0, 0, 0], [0, 0, Math.PI], [1, -1, 0.3]);
      this.tails.push(tail);
    }
  }

  /** A round shoulder plate with a wisp of fire on it, and below the elbow no arm but a long straight blade. */
  private buildArm(side: number): Arm {
    const { cloth, plate, trim, fire } = this.materials;
    const upper = new Group();
    upper.position.set(side * 0.175, SHOULDER, 0);
    this.chest.add(upper);
    this.part(new CylinderGeometry(0.042, 0.036, UPPER_ARM, 12), cloth, upper, [0, -UPPER_ARM / 2, 0]);
    this.part(
      new SphereGeometry(0.08, 14, 10),
      plate,
      upper,
      [side * 0.015, 0.015, 0],
      [0, 0, side * 0.3],
      [1, 0.75, 1],
    );
    this.part(new TorusGeometry(0.066, 0.009, 6, 18), trim, upper, [side * 0.005, -0.02, 0], [UP, side * 0.3, 0]);
    const wisp = this.part(
      new ConeGeometry(0.03, 0.12, 10),
      fire,
      upper,
      [side * 0.03, 0.12, -0.01],
      [-0.3, 0, -side * 0.3],
    );
    this.wisps.push(wisp);
    const lower = new Group();
    lower.position.y = -UPPER_ARM;
    upper.add(lower);
    // He has no forearms and no hands: below the elbow each arm is the blade itself. A short cuff of
    // plate closes the elbow, and the blade grows out of it, hinged there. Built along +y; at rest it
    // is laid forward and a little out.
    this.part(new SphereGeometry(0.046, 12, 8), plate, lower, [0, -0.012, 0]);
    this.part(new CylinderGeometry(0.046, 0.05, 0.06, 12), plate, lower, [0, -0.045, 0]);
    this.part(new TorusGeometry(0.05, 0.008, 6, 16), trim, lower, [0, -0.072, 0], [UP, 0, 0]);
    const blade = new Group();
    blade.position.y = -0.06;
    // Straight on from the elbow: the blade is built along +y and the arm hangs along -y.
    blade.rotation.x = Math.PI;
    lower.add(blade);
    this.part(new SphereGeometry(0.04, 10, 8), fire, blade, [0, 0.03, 0], [0, 0, 0], [1.2, 1.3, 0.6]);
    // Dead straight and double-edged, broadest a third of the way along: three lengths end to end.
    let holder = new Group();
    holder.position.y = 0.06;
    blade.add(holder);
    const lengths = [0.22, 0.24, 0.2];
    const widths = [0.05, 0.068, 0.05, 0.004];
    lengths.forEach((long, i) => {
      const piece = new CylinderGeometry(widths[i + 1], widths[i], long, 10);
      piece.translate(0, long / 2, 0);
      this.part(piece, fire, holder, [0, 0, 0], [0, 0, 0], [1, 1, 0.36]);
      const core = new CylinderGeometry(widths[i + 1] * 0.4, widths[i] * 0.4, long, 6);
      core.translate(0, long / 2, 0);
      this.part(core, WHITE, holder, [0, 0, 0], [0, 0, 0], [0.45, 1, 0.42]);
      const next = new Group();
      next.position.y = long;
      holder.add(next);
      holder = next;
    });
    return { upper, lower, blade, light: this.glow(blade, 0.3, [0, BLADE * 0.55, 0], 0.3) };
  }

  /** A hood drawn close, its point falling behind, and under it a smooth mask with two lights for eyes. */
  private buildHead(): void {
    const { cloak, plate, trim, fire } = this.materials;
    this.head.position.y = 0.31;
    this.chest.add(this.head);
    this.part(new SphereGeometry(0.085, 16, 12), plate, this.head, [0, 0.08, 0.012], [0, 0, 0], [0.92, 1.05, 0.95]);
    for (const side of [-1, 1]) {
      this.part(
        new SphereGeometry(0.018, 8, 6),
        fire,
        this.head,
        [side * 0.034, 0.088, 0.09],
        [0, 0, side * 0.35],
        [1.3, 0.55, 0.5],
      );
      this.glow(this.head, 0.09, [side * 0.034, 0.088, 0.105], 0.45);
    }
    // A ridge of bright metal down the middle of the mask.
    this.part(new CylinderGeometry(0.006, 0.006, 0.11, 6), trim, this.head, [0, 0.07, 0.092], [0.12, 0, 0]);
    // The hood: a shell open at the front, a rolled edge, and a long point behind.
    const gap = 0.95;
    const shell = new SphereGeometry(1, 20, 14, UP + gap, Math.PI * 2 - gap * 2);
    this.part(shell, cloak, this.head, [0, 0.09, -0.005], [0, 0, 0], [0.108, 0.118, 0.115]);
    for (const turn of [gap - UP, -UP - gap])
      this.part(new TorusGeometry(0.113, 0.009, 6, 20, Math.PI), trim, this.head, [0, 0.09, -0.005], [0, turn, -UP]);
    const point = new ConeGeometry(0.075, 0.24, 12);
    point.translate(0, 0.12, 0);
    this.part(point, cloak, this.head, [0, 0.15, -0.07], [-1.75, 0, 0]);
  }

  /**
   * The fire around the whole body: tongues rising off the shoulders, the back, the hips, the knees and
   * the top of the hood, and a soft light behind it all. They are drawn as light, not as lit solid shapes,
   * so they read as fire against the dark armour.
   */
  private buildBlaze(): Sprite {
    const flame = new MeshBasicMaterial({
      color: this.colours.fire,
      transparent: true,
      opacity: 0.62,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const tongue = (parent: Group, position: Triple, tall: number, wide: number, lean: Triple = [0, 0, 0]) => {
      const cone = new ConeGeometry(wide, tall, 8);
      cone.translate(0, tall / 2, 0);
      const mesh = new Mesh(cone, flame);
      mesh.position.set(...position);
      mesh.rotation.set(...lean);
      parent.add(mesh);
      this.flames.push({ mesh, tall: 1, beat: this.flames.length * 1.7 });
      // A paler heart inside each tongue.
      const heart = new ConeGeometry(wide * 0.5, tall * 0.6, 6);
      heart.translate(0, tall * 0.3, 0);
      mesh.add(new Mesh(heart, HEART));
    };
    for (const side of [-1, 1]) {
      tongue(this.chest, [side * 0.2, 0.27, -0.02], 0.3, 0.05, [-0.15, 0, -side * 0.35]);
      tongue(this.chest, [side * 0.13, 0.25, -0.1], 0.24, 0.04, [-0.5, 0, -side * 0.2]);
      tongue(this.chest, [side * 0.15, 0.08, -0.09], 0.22, 0.04, [-0.7, 0, -side * 0.5]);
      tongue(this.hips, [side * 0.14, 0.0, 0.0], 0.2, 0.04, [0, 0, -side * 0.75]);
      tongue(this.hips, [side * 0.1, -0.02, -0.09], 0.2, 0.035, [-0.9, 0, -side * 0.3]);
      tongue(this.head, [side * 0.07, 0.17, -0.02], 0.16, 0.03, [-0.2, 0, -side * 0.45]);
    }
    tongue(this.chest, [0, 0.2, -0.14], 0.32, 0.05, [-0.6, 0, 0]);
    tongue(this.head, [0, 0.2, -0.01], 0.22, 0.04, [-0.25, 0, 0]);
    this.legs.forEach((leg, i) => tongue(leg.lower, [(i ? 1 : -1) * 0.03, -0.02, -0.04], 0.14, 0.03, [-0.8, 0, 0]));
    return this.glow(this.chest, 1.1, [0, 0.1, -0.12], 0.3);
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
    this.stride = (this.stride + delta * 2.6 * this.walk) % 1;
    const t = this.time;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = DUELIST_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead) {
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
        if (incoming.kind === 'attack') this.hand = 1 - this.hand;
      }
    }
    if (this.action && (clock >= this.action.until || state.dead)) this.action = null;
    const kind = this.action?.kind;
    const p = this.action ? Math.max(0, (clock - this.action.from) / (this.action.until - this.action.from)) : 0;

    // Each arm is [shoulder forward, shoulder out, elbow, unused]. The blade is the arm below the elbow and
    // runs straight on from it. At rest the blades point low ahead; on the run they trail straight behind.
    const breath = Math.sin(t * 1.7) * 0.04;
    const run = this.walk;
    const rest = (): number[] => [0.15 + run * 0.75 + breath, 0.55 + run * 0.05, -0.95 + run * 1.25, 0];
    const arm = [rest(), rest()];
    let lean = run * 0.42;
    let spin = 0;
    let crouch = run * 0.02;
    let lift = 0;
    let lunge = 0;
    let flare = 0;
    if (kind === 'attack') {
      // One blade is drawn back across the body and cut through, wide.
      const i = this.hand;
      const side = i ? 1 : -1;
      const cut = ease(p);
      arm[i] = [-1.25 + there(p) * 0.2, 0.9 - cut * 1.5, -0.25, -1.5];
      spin = side * (0.5 - cut * 1.0) * there(Math.min(1, p * 1.4));
      lunge = there(p) * 0.06;
      flare = there(p) * 0.5;
    } else if (kind === 'Q') {
      // Both blades thrust out ahead, the body thrown flat behind them.
      const out = there(p);
      for (const one of arm) one.splice(0, 4, -1.45 * out + 0.25 * (1 - out), 0.25, -0.1, -1.55);
      lean += out * 0.7;
      crouch += out * 0.05;
      flare = out * 0.7;
    } else if (kind === 'W') {
      // A full turn with the blades held straight out to the sides.
      const out = Math.min(1, p * 5) * Math.min(1, (1 - p) * 5);
      for (const one of arm) one.splice(0, 4, 0.1, 0.45 + out * 1.05, -0.05, -1.57 * (1 - out));
      spin = ease(p) * Math.PI * 2;
      crouch += out * 0.04;
      flare = out;
    } else if (kind === 'E') {
      // The blades crossed before the face, and the fire on them blown up.
      const up = there(p);
      arm.forEach((one, i) =>
        one.splice(
          0,
          4,
          -1.15 * up + 0.25 * (1 - up),
          0.45 - up * 0.95,
          -0.9 * up - 0.5 * (1 - up),
          -1.25 + up * 1.0 * (i ? 1 : 1),
        ),
      );
      flare = up * 1.2;
    } else if (kind === 'R') {
      // Up into the air with both blades raised behind the head, and down with them together.
      const rise = ease(Math.min(1, p / 0.45));
      const fall = ease(Math.max(0, Math.min(1, (p - 0.45) / 0.2)));
      for (const one of arm) one.splice(0, 4, -2.9 * rise + 2.4 * fall, 0.2, -0.4 * (1 - fall), -0.4 - 1.1 * fall);
      lift = there(Math.min(1, p / 0.65)) * 0.3;
      lean += fall * 0.55 - rise * 0.3 * (1 - fall);
      crouch += fall * 0.08 * (1 - Math.max(0, (p - 0.8) / 0.2));
      flare = Math.max(rise * 0.6, fall * 1.6 * (1 - Math.max(0, (p - 0.7) / 0.3)));
    }

    const gone = ease(this.death);
    const step = this.stride * Math.PI * 2;
    const bob = Math.abs(Math.sin(step)) * 0.02 * run;
    this.hips.position.set(0, HIP - crouch + lift + bob - gone * (HIP - 0.08), lunge);
    this.hips.rotation.set(lean + gone * 1.4, spin, 0);
    this.chest.rotation.set(-lean * 0.25, 0, Math.sin(step) * 0.06 * run);
    this.head.rotation.set(-lean * 0.55 - gone * 0.3, Math.sin(t * 0.5) * 0.1 * (1 - run), 0);
    this.legs.forEach((leg, i) => {
      const swing = Math.sin(step + (i ? Math.PI : 0)) * run;
      leg.upper.rotation.x =
        -swing * 0.9 - crouch * 5 - lean * 0.85 - gone * 1.2 - (lift > 0 ? 0.5 * there(lift / 0.3) : 0);
      // The knee only ever bends one way.
      leg.lower.rotation.x =
        Math.max(0, swing) * 1.2 + crouch * 10 + (lift > 0 ? 1.1 * there(lift / 0.3) : 0) + run * 0.25;
    });
    this.arms.forEach((one, i) => {
      const side = i ? 1 : -1;
      const pose = arm[i];
      one.upper.rotation.set(pose[0] - gone * 0.4, 0, side * pose[1] + side * gone * 0.6);
      one.lower.rotation.x = pose[2];
      one.light.material.opacity = 0.3 + flare * 0.5;
      one.light.scale.setScalar(0.3 + flare * 0.5);
    });
    // The cloak streams out behind on the run and in the air, and hangs and stirs at rest.
    this.tails.forEach((tail, i) => {
      tail.rotation.x = 0.12 + run * 0.95 + lift * 2 + Math.sin(t * 2.3 + i * 1.3) * (0.05 + run * 0.12) - lean * 0.3;
      tail.rotation.z = (i - 2) * 0.1 + Math.sin(t * 1.7 + i) * 0.04;
    });
    // The fire never burns twice the same way.
    this.wisps.forEach((wisp, i) => {
      wisp.scale.y = (1 + Math.sin(t * 12 + i * 2) * 0.2 + flare * 0.9) * (1 - gone * 0.8);
    });
    // Each tongue leaps and sways on its own beat, streams back on the run and dies with him.
    for (const { mesh, beat } of this.flames) {
      const leap = 0.85 + Math.sin(t * 9 + beat) * 0.22 + Math.sin(t * 15.3 + beat * 2) * 0.12;
      mesh.scale.set(1 + Math.sin(t * 7 + beat) * 0.12, (leap + flare * 0.5 + run * 0.25) * (1 - gone), 1);
      mesh.visible = gone < 0.95;
    }
    if (this.halo) this.halo.material.opacity = (0.26 + Math.sin(t * 5) * 0.05 + flare * 0.2) * (1 - gone);
    this.aura.material.opacity = Math.min(0.55, flare * 0.4) * (1 - gone);
    this.aura.scale.setScalar(0.4 + flare * 0.9);
  }
}

/** The hot line down the middle of a blade: pale, but still of the fire's colour and not white. */
const WHITE = new MeshBasicMaterial({ color: '#9cc4ff' });
/** The paler heart of a tongue of fire. */
const HEART = new MeshBasicMaterial({
  color: '#a8ccff',
  transparent: true,
  opacity: 0.55,
  blending: AdditiveBlending,
  depthWrite: false,
});
