import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry } from 'three';
import type { ActorAction } from '@/lib/session';

/**
 * Which machine this is. The gunner is a walker with a long cannon on its shoulder and a twin gun for
 * an arm. The engineer is a round little builder with a crane over its back, a claw, a torch and a
 * drone for company. The striker is lean and long-legged, a blade on each arm and a saw that never
 * stops. The fortress is a wall on legs: huge shoulders, a shield, fists, and stacks that glow.
 */
export type MechKind = 'gunner' | 'engineer' | 'striker' | 'fortress';

export interface MechColours {
  kind: MechKind;
  /** The body. */
  hull: string;
  /** Armour plates laid over it. */
  plate: string;
  /** Lights, eyes, the core and everything hot. */
  glow: string;
}

/**
 * A war machine built in code, with no model file: hard plates over a dark frame, a burning core,
 * lit seams. It moves by turning its joints every frame. Used the same way as an Actor.
 *
 * Built about one unit tall, facing +z; `height` rescales it.
 */

export const MECH_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.45 },
  Q: { clip: 'Q', seconds: 0.55 },
  W: { clip: 'W', seconds: 0.7 },
  E: { clip: 'E', seconds: 0.55 },
  R: { clip: 'R', seconds: 0.9 },
};

const UP = Math.PI / 2;
const DEATH_SECONDS = 0.9;

/** How each machine is proportioned. Lengths are fractions of its height. */
const BUILD: Record<
  MechKind,
  {
    hip: number;
    leg: number;
    legWidth: number;
    stance: number;
    chest: [number, number, number];
    arm: number;
    armWidth: number;
  }
> = {
  gunner: { hip: 0.42, leg: 0.42, legWidth: 0.07, stance: 0.11, chest: [0.28, 0.2, 0.22], arm: 0.3, armWidth: 0.06 },
  engineer: { hip: 0.32, leg: 0.32, legWidth: 0.05, stance: 0.1, chest: [0.3, 0.26, 0.28], arm: 0.28, armWidth: 0.045 },
  striker: { hip: 0.5, leg: 0.5, legWidth: 0.055, stance: 0.085, chest: [0.22, 0.2, 0.16], arm: 0.36, armWidth: 0.045 },
  fortress: { hip: 0.38, leg: 0.38, legWidth: 0.12, stance: 0.17, chest: [0.5, 0.3, 0.34], arm: 0.34, armWidth: 0.11 },
};

/** Where the joints are turned to. Angles in radians; an arm at 0 hangs straight down, negative swings it forward and up. */
interface Pose {
  lean: number;
  twist: number;
  lift: number;
  rightArm: number;
  rightElbow: number;
  leftArm: number;
  leftElbow: number;
}

const REST: Record<MechKind, Pose> = {
  // Gun arm levelled, the other hanging ready.
  gunner: { lean: 0.04, twist: -0.15, lift: 0, rightArm: -0.55, rightElbow: 0.85, leftArm: 0.1, leftElbow: 0.4 },
  engineer: { lean: 0.02, twist: 0, lift: 0, rightArm: -0.4, rightElbow: 1.0, leftArm: -0.4, leftElbow: 1.0 },
  // Blades held out in front, crossed low, weight forward.
  striker: { lean: 0.16, twist: -0.2, lift: -0.01, rightArm: -0.45, rightElbow: 0.95, leftArm: -0.25, leftElbow: 0.85 },
  fortress: { lean: 0.03, twist: 0, lift: 0, rightArm: -0.15, rightElbow: 0.55, leftArm: -0.15, leftElbow: 0.55 },
};

const smooth = (p: number): number => {
  const c = Math.min(1, Math.max(0, p));
  return c * c * (3 - 2 * c);
};
/** Rises quickly from 0 at the start of an action and falls back to 0 at its end. */
const envelope = (p: number): number => smooth(p * 6) * smooth((1 - p) * 3.5);

function mix(from: Pose, to: Partial<Pose>, amount: number): Pose {
  const out = { ...from };
  for (const key of Object.keys(to) as (keyof Pose)[])
    out[key] = from[key] + ((to[key] ?? from[key]) - from[key]) * amount;
  return out;
}

/** A blow in two beats: wound up, then struck. */
const strike =
  (wound: Partial<Pose>, struck: Partial<Pose>) =>
  (rest: Pose, p: number): Pose =>
    mix(rest, mix(mix(rest, wound, 1), struck, smooth((p - 0.25) * 4)), envelope(p));
const hold =
  (to: Partial<Pose>) =>
  (rest: Pose, p: number): Pose =>
    mix(rest, to, envelope(p));

const AIM: Partial<Pose> = { rightArm: -1.5, rightElbow: 0.05, twist: 0.25 };
const ACTIONS: Record<MechKind, Record<string, (rest: Pose, p: number) => Pose>> = {
  gunner: {
    attack: strike(AIM, { ...AIM, rightArm: -1.75, lean: -0.1 }),
    Q: strike(AIM, { ...AIM, rightArm: -1.8, lean: -0.14 }),
    // Braces to fire the long cannon.
    W: hold({ lift: -0.06, lean: 0.12, rightArm: -0.3, leftArm: -0.3, rightElbow: 1.3, leftElbow: 1.3 }),
    E: strike(AIM, { ...AIM, rightArm: -1.75, lean: -0.1 }),
    R: strike({ lift: -0.07, lean: 0.15 }, { lift: -0.07, lean: -0.22, rightArm: -0.2, leftArm: -0.2 }),
  },
  engineer: {
    attack: hold({ rightArm: -1.45, rightElbow: 0.1, twist: 0.3 }),
    // Both hands down at the work.
    Q: hold({ lean: 0.35, lift: -0.04, rightArm: -1.0, leftArm: -1.0, rightElbow: 0.3, leftElbow: 0.3 }),
    W: hold({ rightArm: -2.7, leftArm: -2.7, rightElbow: 0.2, leftElbow: 0.2, lean: -0.1 }),
    E: strike({ leftArm: 0.9, leftElbow: 0.3, twist: 0.4 }, { leftArm: -1.6, leftElbow: 0.1, twist: -0.4, lean: 0.2 }),
    R: hold({ rightArm: -2.8, leftArm: -2.8, rightElbow: 0.1, leftElbow: 0.1, lift: 0.04, lean: -0.15 }),
  },
  striker: {
    attack: strike(
      { rightArm: -2.6, rightElbow: 0.6, twist: -0.6 },
      { rightArm: 0.6, rightElbow: 0.05, twist: 0.7, lean: 0.35 },
    ),
    Q: strike(
      { rightArm: -2.6, leftArm: -2.6, rightElbow: 0.5, leftElbow: 0.5 },
      { rightArm: 0.5, leftArm: 0.5, rightElbow: 0, leftElbow: 0, lean: 0.4 },
    ),
    // A dash: flat out, blades trailing.
    W: hold({ lean: 0.75, lift: -0.04, rightArm: 1.1, leftArm: 1.1, rightElbow: 0.1, leftElbow: 0.1 }),
    E: hold({ rightArm: -1.3, leftArm: -1.3, rightElbow: 1.5, leftElbow: 1.5, twist: 0 }),
    R: strike(
      { lift: 0.28, lean: -0.2, rightArm: -2.9, leftArm: -2.9, rightElbow: 0.3, leftElbow: 0.3 },
      { lift: -0.05, lean: 0.5, rightArm: 0.3, leftArm: 0.3, rightElbow: 0, leftElbow: 0 },
    ),
  },
  fortress: {
    attack: strike(
      { rightArm: 0.6, rightElbow: 1.4, twist: -0.5 },
      { rightArm: -1.45, rightElbow: 0.05, twist: 0.55, lean: 0.2 },
    ),
    Q: strike(
      { rightArm: -2.7, leftArm: -2.7, rightElbow: 0.3, leftElbow: 0.3, lean: -0.15 },
      { rightArm: -0.5, leftArm: -0.5, rightElbow: 0.1, leftElbow: 0.1, lean: 0.45, lift: -0.06 },
    ),
    // On guard: both arms across the body.
    W: hold({ rightArm: -1.05, leftArm: -1.05, rightElbow: 1.7, leftElbow: 1.7, lift: -0.04 }),
    E: strike({ lift: 0.12, lean: -0.1 }, { lift: -0.09, lean: 0.2 }),
    R: hold({ rightArm: -2.6, leftArm: -2.6, rightElbow: 0.2, leftElbow: 0.2, lift: 0.05, lean: -0.12 }),
  },
};

interface Limb {
  upper: Group;
  lower: Group;
}

export class Mech {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly hips = new Group();
  private readonly torso = new Group();
  private readonly head = new Group();
  private readonly legs: Limb[] = [];
  private readonly rightArm: Limb;
  private readonly leftArm: Limb;
  /** Parts that turn steadily about one of their axes: a saw, a radar dish, a drone's path. */
  private readonly spinners: { group: Group; axis: 'x' | 'y' | 'z'; speed: number }[] = [];
  /** The gunner's shoulder cannon, which kicks back when it fires. */
  private readonly cannon = new Group();
  private readonly kind: MechKind;
  private readonly build: (typeof BUILD)[MechKind];
  private readonly hull: MeshStandardMaterial;
  private readonly plate: MeshStandardMaterial;
  private readonly dark: MeshStandardMaterial;
  private readonly glow: MeshStandardMaterial;
  private readonly castShadow: boolean;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;

  constructor(colours: MechColours, height: number, castShadow: boolean) {
    this.kind = colours.kind;
    this.build = BUILD[this.kind];
    this.castShadow = castShadow;
    this.hull = new MeshStandardMaterial({ color: colours.hull, metalness: 0.55, roughness: 0.45 });
    this.plate = new MeshStandardMaterial({ color: colours.plate, metalness: 0.7, roughness: 0.32 });
    this.dark = new MeshStandardMaterial({ color: '#1b1f27', metalness: 0.5, roughness: 0.6 });
    this.glow = new MeshStandardMaterial({ color: colours.glow, emissive: colours.glow, emissiveIntensity: 2.2 });

    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.hips.position.y = this.build.hip;
    this.model.add(this.hips);
    for (const side of [-1, 1]) this.legs.push(this.buildLeg(side));
    this.buildTorso();
    this.rightArm = this.buildArm(1);
    this.leftArm = this.buildArm(-1);
    this.buildHead();
    this.buildKit();
    this.applyPose(REST[this.kind], 0);
  }

  // ---- building ----

  private mesh(
    geometry: BufferGeometry,
    material: MeshStandardMaterial,
    parent: Group,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = this.castShadow;
    parent.add(mesh);
    return mesh;
  }

  private box(
    size: [number, number, number],
    material: MeshStandardMaterial,
    parent: Group,
    position: [number, number, number] = [0, 0, 0],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh {
    return this.mesh(new BoxGeometry(...size), material, parent, position, rotation);
  }

  /** A round joint whose axle runs across the body. */
  private joint(radius: number, width: number, parent: Group, position: [number, number, number]): void {
    this.mesh(new CylinderGeometry(radius, radius, width, 14), this.dark, parent, position, [0, 0, UP]);
    for (const side of [-1, 1])
      this.mesh(
        new CylinderGeometry(radius * 0.45, radius * 0.45, 0.008, 10),
        this.glow,
        parent,
        [position[0] + side * (width / 2 + 0.002), position[1], position[2]],
        [0, 0, UP],
      );
  }

  private buildLeg(side: number): Limb {
    const { leg, legWidth: w, stance } = this.build;
    const half = leg / 2;
    const upper = new Group();
    upper.position.set(side * stance, 0, 0);
    this.joint(w * 0.75, w * 1.5, upper, [0, 0, 0]);
    // The thigh: frame inside, a plate over the front.
    this.box([w * 0.8, half, w * 0.9], this.dark, upper, [0, -half / 2, 0]);
    this.box([w * 1.25, half * 0.8, w * 0.5], this.plate, upper, [0, -half * 0.45, w * 0.45]);
    this.box([w * 0.2, half * 0.5, 0.01], this.glow, upper, [0, -half * 0.45, w * 0.71]);
    const lower = new Group();
    lower.position.y = -half;
    this.joint(w * 0.7, w * 1.4, lower, [0, 0, 0]);
    // The shin widens to the ankle; a lit seam runs down it.
    this.box([w * 1.1, half * 0.85, w * 1.15], this.hull, lower, [0, -half * 0.5, 0]);
    this.box([w * 1.35, half * 0.35, w * 1.35], this.plate, lower, [0, -half * 0.72, 0.005]);
    this.box([0.012, half * 0.6, 0.01], this.glow, lower, [side * w * 0.3, -half * 0.45, w * 0.59]);
    // A piston behind the calf, and a broad foot with a toe plate.
    this.mesh(new CylinderGeometry(w * 0.16, w * 0.16, half * 0.7, 8), this.dark, lower, [0, -half * 0.45, -w * 0.7]);
    this.box([w * 1.7, 0.035, w * 2.6], this.dark, lower, [0, -half + 0.018, w * 0.45]);
    this.box([w * 1.5, 0.03, w * 1.1], this.plate, lower, [0, -half + 0.045, w * 1.05], [0.25, 0, 0]);
    this.box([w * 1.1, 0.04, w * 0.6], this.plate, lower, [0, -half + 0.03, -w * 0.75], [-0.3, 0, 0]);
    upper.add(lower);
    this.hips.add(upper);
    return { upper, lower };
  }

  private buildTorso(): void {
    const [w, h, d] = this.build.chest;
    const { hull, plate, dark, glow } = this;
    // The pelvis, and a waist the chest turns on.
    this.box([this.build.stance * 2 + this.build.legWidth, 0.07, d * 0.7], dark, this.hips, [0, 0, 0]);
    this.box([this.build.stance * 1.2, 0.06, d * 0.5], plate, this.hips, [0, 0.005, d * 0.3], [-0.2, 0, 0]);
    this.mesh(new CylinderGeometry(w * 0.2, w * 0.24, 0.07, 14), dark, this.hips, [0, 0.06, 0]);
    this.torso.position.y = 0.1;
    this.hips.add(this.torso);

    if (this.kind === 'engineer') {
      // A boiler of a body, banded, with a round window on the core.
      this.mesh(new SphereGeometry(w / 2, 22, 16), hull, this.torso, [0, h / 2, 0]).scale.set(1, h / w, d / w);
      for (const y of [0.3, 0.7])
        this.mesh(
          new TorusGeometry(w * 0.47 * (y === 0.3 ? 0.94 : 0.92), 0.012, 6, 28),
          plate,
          this.torso,
          [0, h * y, 0],
          [UP, 0, 0],
        );
    } else {
      // A chest that is wider at the shoulders, plated front and back, vents down its sides.
      this.box([w * 0.78, h, d * 0.86], dark, this.torso, [0, h / 2, 0]);
      this.box([w, h * 0.55, d], hull, this.torso, [0, h * 0.7, 0]);
      this.box([w * 0.62, h * 0.4, d * 0.9], hull, this.torso, [0, h * 0.22, 0]);
      for (const side of [-1, 1]) {
        this.box(
          [w * 0.36, h * 0.5, 0.03],
          plate,
          this.torso,
          [side * w * 0.24, h * 0.72, d / 2 + 0.012],
          [0, side * 0.22, 0],
        );
        for (let i = 0; i < 3; i++)
          this.box([0.012, 0.012, d * 0.5], glow, this.torso, [side * (w / 2 + 0.003), h * (0.55 + i * 0.1), 0]);
      }
      this.box([w * 0.9, h * 0.5, 0.03], plate, this.torso, [0, h * 0.7, -d / 2 - 0.012]);
    }
    // The core: a hot heart behind a ring.
    this.mesh(new SphereGeometry(Math.min(w, h) * 0.16, 16, 12), glow, this.torso, [0, h * 0.55, d / 2 + 0.005]);
    this.mesh(new TorusGeometry(Math.min(w, h) * 0.2, 0.012, 8, 22), plate, this.torso, [0, h * 0.55, d / 2 + 0.02]);
    this.mesh(new CylinderGeometry(0.035, 0.045, 0.04, 12), dark, this.torso, [0, h + 0.015, 0]);
    this.head.position.y = h + 0.035;
    this.torso.add(this.head);
  }

  private buildArm(side: number): Limb {
    const { arm, armWidth: w, chest } = this.build;
    const half = arm / 2;
    const upper = new Group();
    upper.position.set(side * (chest[0] / 2 + w * 0.75), chest[1] * 0.82, 0);
    this.mesh(new SphereGeometry(w * 0.85, 14, 10), this.dark, upper);
    // A shoulder plate, bigger on the heavy machines, with a lit edge.
    const guard = this.kind === 'fortress' ? 2.3 : this.kind === 'striker' ? 1.3 : 1.7;
    this.box(
      [w * guard, w * 1.2, w * guard * 1.05],
      this.plate,
      upper,
      [side * w * 0.35, w * 0.55, 0],
      [0, 0, side * -0.25],
    );
    this.box(
      [w * guard, 0.012, 0.012],
      this.glow,
      upper,
      [side * w * 0.35, w * -0.05, w * guard * 0.53],
      [0, 0, side * -0.25],
    );
    this.box([w * 0.85, half, w * 0.85], this.hull, upper, [0, -half / 2, 0]);
    const lower = new Group();
    lower.position.y = -half;
    this.joint(w * 0.6, w * 1.1, lower, [0, 0, 0]);
    this.box([w * 1.1, half * 0.8, w * 1.1], this.plate, lower, [0, -half * 0.5, 0]);
    this.box([0.012, half * 0.55, 0.012], this.glow, lower, [side * w * 0.56, -half * 0.5, 0]);
    upper.add(lower);
    this.torso.add(upper);
    return { upper, lower };
  }

  private buildHead(): void {
    const { hull, plate, dark, glow, head } = this;
    if (this.kind === 'engineer') {
      // A dome with two round lamps for eyes and an aerial.
      this.mesh(new SphereGeometry(0.085, 18, 12, 0, Math.PI * 2, 0, UP), hull, head);
      this.mesh(new CylinderGeometry(0.088, 0.088, 0.02, 18), plate, head, [0, 0.002, 0]);
      for (const side of [-1, 1]) {
        this.mesh(new CylinderGeometry(0.026, 0.026, 0.03, 12), dark, head, [side * 0.036, 0.04, 0.07], [UP, 0, 0]);
        this.mesh(new SphereGeometry(0.019, 10, 8), glow, head, [side * 0.036, 0.04, 0.086]);
      }
      this.mesh(new CylinderGeometry(0.004, 0.004, 0.1, 6), dark, head, [0.05, 0.12, -0.02]);
      this.mesh(new SphereGeometry(0.012, 8, 6), glow, head, [0.05, 0.175, -0.02]);
    } else if (this.kind === 'striker') {
      // A narrow wedge of a head, one thin visor, two swept-back fins.
      this.box([0.075, 0.07, 0.11], hull, head, [0, 0.04, 0.005]);
      this.mesh(new ConeGeometry(0.05, 0.1, 4), plate, head, [0, 0.045, 0.085], [UP, Math.PI / 4, 0]);
      this.box([0.082, 0.012, 0.06], glow, head, [0, 0.05, 0.04]);
      for (const side of [-1, 1]) this.box([0.008, 0.035, 0.13], plate, head, [side * 0.04, 0.085, -0.05], [0.5, 0, 0]);
    } else if (this.kind === 'fortress') {
      // A small head sunk between the shoulders: a slit of light under a heavy brow, a crest on top.
      this.box([0.13, 0.085, 0.12], hull, head, [0, 0.035, 0]);
      this.box([0.15, 0.03, 0.14], plate, head, [0, 0.075, 0.005], [0.12, 0, 0]);
      this.box([0.1, 0.014, 0.01], glow, head, [0, 0.042, 0.062]);
      this.box([0.016, 0.07, 0.12], plate, head, [0, 0.11, -0.01]);
    } else {
      // A box of a head with a single wide eye, a targeting lens beside it, an aerial behind.
      this.box([0.12, 0.085, 0.11], hull, head, [0, 0.045, 0]);
      this.box([0.13, 0.03, 0.12], plate, head, [0, 0.092, 0]);
      this.box([0.1, 0.022, 0.01], glow, head, [0, 0.05, 0.057]);
      this.mesh(new CylinderGeometry(0.02, 0.024, 0.05, 10), dark, head, [0.07, 0.06, 0.04], [UP, 0, 0]);
      this.mesh(new SphereGeometry(0.014, 8, 6), glow, head, [0.07, 0.06, 0.068]);
      this.mesh(new CylinderGeometry(0.003, 0.003, 0.11, 5), dark, head, [-0.045, 0.14, -0.04], [0.2, 0, 0]);
    }
  }

  /** What makes each machine itself: its weapons and the gear on its back. */
  private buildKit(): void {
    const { hull, plate, dark, glow } = this;
    const [w, h, d] = this.build.chest;
    const hand = -this.build.arm / 2;
    const right = this.rightArm.lower;
    const left = this.leftArm.lower;

    if (this.kind === 'gunner') {
      // Right arm: twin barrels in a housing. Left: a three-fingered claw.
      this.box([0.075, 0.07, 0.075], dark, right, [0, hand - 0.02, 0]);
      for (const side of [-1, 1]) {
        this.mesh(new CylinderGeometry(0.014, 0.014, 0.2, 10), plate, right, [side * 0.02, hand - 0.14, 0]);
        this.mesh(new CylinderGeometry(0.018, 0.018, 0.02, 10), dark, right, [side * 0.02, hand - 0.235, 0]);
        this.mesh(new SphereGeometry(0.011, 8, 6), glow, right, [side * 0.02, hand - 0.247, 0]);
      }
      this.claw(left, hand);
      // The long cannon rides on the left shoulder, pointing ahead.
      this.cannon.position.set(-(w / 2 + 0.02), h + 0.05, -0.02);
      this.torso.add(this.cannon);
      this.box([0.1, 0.09, 0.2], hull, this.cannon, [0, 0, 0]);
      this.box([0.11, 0.03, 0.12], plate, this.cannon, [0, 0.055, -0.02]);
      this.mesh(new CylinderGeometry(0.03, 0.034, 0.42, 14), dark, this.cannon, [0, 0, 0.3], [UP, 0, 0]);
      for (const z of [0.16, 0.3, 0.44])
        this.mesh(new TorusGeometry(0.036, 0.008, 6, 16), plate, this.cannon, [0, 0, z]);
      this.mesh(new CylinderGeometry(0.045, 0.036, 0.06, 14), plate, this.cannon, [0, 0, 0.53], [UP, 0, 0]);
      this.mesh(new SphereGeometry(0.026, 12, 8), glow, this.cannon, [0, 0, 0.555]);
      // An ammunition drum on the back, feeding it.
      this.mesh(
        new CylinderGeometry(0.075, 0.075, 0.12, 16),
        dark,
        this.torso,
        [0.03, h * 0.55, -d / 2 - 0.07],
        [0, 0, UP],
      );
      this.mesh(new TorusGeometry(0.076, 0.008, 6, 20), glow, this.torso, [0.03, h * 0.55, -d / 2 - 0.07], [0, UP, 0]);
    } else if (this.kind === 'engineer') {
      // Right hand: a welding torch that burns. Left: a claw.
      this.mesh(new CylinderGeometry(0.02, 0.028, 0.09, 10), dark, right, [0, hand - 0.04, 0]);
      this.mesh(new ConeGeometry(0.018, 0.08, 8), glow, right, [0, hand - 0.12, 0], [Math.PI, 0, 0]);
      this.claw(left, hand);
      // A crane rises from the pack on its back and arches over its head, a hook hanging from it.
      this.box([w * 0.7, h * 0.6, 0.1], dark, this.torso, [0, h * 0.55, -d / 2 - 0.03]);
      this.box([0.03, 0.34, 0.03], plate, this.torso, [0, h + 0.1, -d / 2 - 0.04], [0.25, 0, 0]);
      this.box([0.026, 0.026, 0.3], plate, this.torso, [0, h + 0.27, -d / 2 + 0.05], [-0.25, 0, 0]);
      this.mesh(new CylinderGeometry(0.003, 0.003, 0.1, 4), dark, this.torso, [0, h + 0.25, -d / 2 + 0.19]);
      this.mesh(new TorusGeometry(0.018, 0.006, 6, 12, Math.PI * 1.4), plate, this.torso, [
        0,
        h + 0.185,
        -d / 2 + 0.19,
      ]);
      // A dish that turns, and a little drone that circles the machine.
      const dish = new Group();
      dish.position.set(-w * 0.35, h + 0.03, -d * 0.2);
      this.mesh(new CylinderGeometry(0.004, 0.004, 0.06, 5), dark, dish, [0, 0.03, 0]);
      this.mesh(new SphereGeometry(0.045, 12, 6, 0, Math.PI * 2, 0, 1), plate, dish, [0, 0.06, 0], [UP + 0.5, 0, 0]);
      this.mesh(new SphereGeometry(0.008, 6, 5), glow, dish, [0, 0.075, 0.035]);
      this.torso.add(dish);
      this.spinners.push({ group: dish, axis: 'y', speed: 1.2 });
      const orbit = new Group();
      orbit.position.y = h + 0.02;
      const drone = new Group();
      drone.position.set(0.36, 0.05, 0);
      this.box([0.07, 0.03, 0.07], hull, drone);
      this.mesh(new SphereGeometry(0.016, 8, 6), glow, drone, [0, -0.02, 0.02]);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          this.mesh(new CylinderGeometry(0.004, 0.004, 0.03, 4), dark, drone, [sx * 0.045, 0.02, sz * 0.045]);
          this.mesh(new TorusGeometry(0.022, 0.003, 4, 14), plate, drone, [sx * 0.045, 0.038, sz * 0.045], [UP, 0, 0]);
        }
      orbit.add(drone);
      this.torso.add(orbit);
      this.spinners.push({ group: orbit, axis: 'y', speed: 0.9 });
    } else if (this.kind === 'striker') {
      // A long blade from each forearm, hot along its edge, and a saw on the right that never stops.
      for (const lower of [right, left]) {
        this.box([0.012, 0.36, 0.05], plate, lower, [0, hand - 0.14, 0.02]);
        this.box([0.014, 0.34, 0.01], glow, lower, [0, hand - 0.14, 0.048]);
        this.mesh(new ConeGeometry(0.03, 0.09, 4), plate, lower, [0, hand - 0.36, 0.02], [Math.PI, 0, 0]).scale.set(
          0.25,
          1,
          1,
        );
      }
      const saw = new Group();
      saw.position.set(0.045, hand + 0.06, 0);
      this.mesh(new CylinderGeometry(0.07, 0.07, 0.008, 18), plate, saw, [0, 0, 0], [0, 0, UP]);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        this.mesh(
          new ConeGeometry(0.012, 0.03, 4),
          glow,
          saw,
          [0, Math.cos(a) * 0.078, Math.sin(a) * 0.078],
          [a, 0, 0],
        );
      }
      right.add(saw);
      this.spinners.push({ group: saw, axis: 'x', speed: 16 });
      // Two thrusters on the back, fins beside them.
      for (const side of [-1, 1]) {
        this.mesh(
          new CylinderGeometry(0.03, 0.04, 0.14, 12),
          dark,
          this.torso,
          [side * 0.055, h * 0.6, -d / 2 - 0.05],
          [0.5, 0, 0],
        );
        this.mesh(new SphereGeometry(0.03, 10, 8), glow, this.torso, [side * 0.055, h * 0.6 - 0.07, -d / 2 - 0.09]);
        this.box([0.01, 0.2, 0.1], plate, this.torso, [side * 0.12, h * 0.85, -d / 2 - 0.07], [0.6, 0, side * 0.25]);
      }
    } else {
      // Fists like anvils, studded with light; a shield bolted to the left forearm.
      for (const lower of [right, left]) {
        this.box([0.14, 0.12, 0.14], dark, lower, [0, hand - 0.05, 0]);
        this.box([0.15, 0.04, 0.15], plate, lower, [0, hand - 0.02, 0]);
        for (let i = 0; i < 3; i++)
          this.mesh(new SphereGeometry(0.014, 8, 6), glow, lower, [(i - 1) * 0.045, hand - 0.09, 0.07]);
      }
      this.box([0.03, 0.3, 0.28], plate, left, [-0.085, hand + 0.06, 0.02]);
      this.box([0.034, 0.24, 0.02], glow, left, [-0.088, hand + 0.06, 0.02]);
      this.box([0.034, 0.02, 0.2], glow, left, [-0.088, hand + 0.12, 0.02]);
      // Armour hung on the front, and two stacks on the back that burn at the top.
      for (const side of [-1, 1]) {
        this.box(
          [w * 0.42, h * 0.75, 0.035],
          plate,
          this.torso,
          [side * w * 0.25, h * 0.45, d / 2 + 0.04],
          [-0.12, side * 0.25, 0],
        );
        this.mesh(new CylinderGeometry(0.04, 0.05, 0.3, 12), dark, this.torso, [
          side * w * 0.3,
          h + 0.08,
          -d / 2 - 0.03,
        ]);
        this.mesh(
          new TorusGeometry(0.042, 0.01, 6, 16),
          plate,
          this.torso,
          [side * w * 0.3, h + 0.2, -d / 2 - 0.03],
          [UP, 0, 0],
        );
        this.mesh(new CylinderGeometry(0.03, 0.03, 0.02, 12), glow, this.torso, [
          side * w * 0.3,
          h + 0.232,
          -d / 2 - 0.03,
        ]);
      }
      this.box([w * 0.8, h * 0.8, 0.1], hull, this.torso, [0, h * 0.55, -d / 2 - 0.05]);
    }
  }

  /** Three hooked fingers round a palm. */
  private claw(lower: Group, hand: number): void {
    this.mesh(new CylinderGeometry(0.035, 0.03, 0.04, 10), this.dark, lower, [0, hand - 0.02, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this.mesh(
        new ConeGeometry(0.012, 0.09, 5),
        this.plate,
        lower,
        [Math.sin(a) * 0.028, hand - 0.08, Math.cos(a) * 0.028],
        [Math.PI + Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35],
      );
    }
    this.mesh(new SphereGeometry(0.012, 8, 6), this.glow, lower, [0, hand - 0.045, 0]);
  }

  // ---- moving ----

  /** Forget everything a previous owner did. */
  reset(): void {
    this.action = null;
    this.seenActionAt = -1;
    this.death = 0;
  }

  private applyPose(pose: Pose, kick: number): void {
    const t = this.time;
    const walk = this.walk;
    const dying = smooth(this.death);
    const alive = 1 - dying;
    const step = this.stride * Math.PI * 2;

    // Shut down: it sags at the knees, pitches forward, and its lights go out.
    this.glow.emissiveIntensity = 2.2 * (1 - 0.92 * dying) * (0.85 + 0.15 * Math.sin(t * 3));
    const hum = Math.sin(t * 2.2) * 0.004;
    this.hips.position.y =
      this.build.hip * (1 - 0.45 * dying) + (hum + Math.abs(Math.sin(step)) * 0.025 * walk + pose.lift) * alive;
    this.hips.rotation.x = (pose.lean + walk * 0.14) * alive + dying * 0.5;
    this.hips.rotation.y = Math.sin(step) * 0.08 * walk;
    this.torso.rotation.y = pose.twist * (1 - walk * 0.6) * alive - Math.sin(step) * 0.1 * walk;
    this.torso.rotation.x = -kick * 0.16 + dying * 0.7;
    this.head.rotation.y = (-pose.twist * 0.7 + Math.sin(t * 0.7) * 0.25 * (1 - walk)) * alive;
    this.head.rotation.x = dying * 0.5;

    this.legs.forEach((leg, i) => {
      const phase = step + (i === 0 ? 0 : Math.PI);
      const swing = Math.sin(phase) * 0.75 * walk;
      const fold = Math.max(0, -Math.cos(phase)) * 1.0 * walk;
      const crouch = Math.max(0, -pose.lift) * 6 * alive + dying * 1.1;
      leg.upper.rotation.x = swing - crouch * 0.5 - this.hips.rotation.x * 0.8;
      leg.lower.rotation.x = fold + crouch;
    });

    // Running, the arms pump a little; acting, they do what the action says.
    const run = walk * (this.action ? 0 : 1);
    const hang = dying;
    this.rightArm.upper.rotation.x =
      (pose.rightArm * (1 - run * 0.5) - Math.sin(step) * 0.3 * run) * (1 - hang) + hang * 0.3;
    this.rightArm.lower.rotation.x = -pose.rightElbow * (1 - hang);
    this.leftArm.upper.rotation.x =
      (pose.leftArm * (1 - run * 0.5) + Math.sin(step) * 0.3 * run) * (1 - hang) + hang * 0.3;
    this.leftArm.lower.rotation.x = -pose.leftElbow * (1 - hang);
    // The cannon slides back on its mount when it fires.
    this.cannon.position.z = -0.02 - kick * 0.07;
    for (const spinner of this.spinners) spinner.group.rotation[spinner.axis] = t * spinner.speed * alive;
  }

  /** Turn the joints for this frame: stand, run, act or shut down. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 9);
    this.stride = (this.stride + delta * 2.2 * this.walk) % 1;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = MECH_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead)
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
    }
    const rest = REST[this.kind];
    let pose = rest;
    let kick = 0;
    if (this.action && clock < this.action.until && !state.dead) {
      const progress = Math.max(0, (clock - this.action.from) / (this.action.until - this.action.from));
      pose = ACTIONS[this.kind][this.action.kind]?.(rest, progress) ?? rest;
      // The recoil of a shot or the jolt of a blow landing: sharp, a third of the way in.
      kick = Math.exp(-(((progress - 0.33) / 0.09) ** 2));
    } else this.action = null;
    this.applyPose(pose, kick);
  }
}
