import {
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry } from 'three';
import type { ActorAction } from '@/lib/session';

/** The colours of a young blade-master, by part. */
export interface SwordsmanColours {
  /** Tunic, trousers and the cloth hanging from the belt. */
  cloth: string;
  /** Shoulder guards, chest plate, bracers and boots. */
  armour: string;
  /** The metal edging on the armour, the belt buckle and the fittings of the sabre. */
  trim: string;
  /** The long ribbons, the headband and the grip of the sabre. */
  ribbon: string;
  skin: string;
  hair: string;
  blade: string;
  /** The stones set in the armour and the sabre. */
  gem: string;
  /**
   * An archer in place of the blade-master: a girl with her hair in two buns and long tails, a short
   * flared skirt, one light shoulder guard, a quiver on her back and a tall bow in her left hand.
   */
  archer?: boolean;
}

/**
 * A young blade-master, or an archer, in the style of a wuxia cartoon, built in code with no model file: a big
 * head on a small sturdy body, spiked hair tied in a topknot, plated shoulders, long ribbons
 * flying from the belt, and a broad sabre almost as tall as he is. It moves by turning its joints
 * every frame. Used the same way as an Actor.
 *
 * Built about one unit tall, facing +z; `height` rescales it.
 */

const UP = Math.PI / 2;
const BALL = new SphereGeometry(1, 20, 14);
const DEATH_SECONDS = 0.8;

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const SWORDSMAN_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.5 },
  Q: { clip: 'Q', seconds: 0.55 },
  W: { clip: 'W', seconds: 0.7 },
  E: { clip: 'E', seconds: 0.55 },
  R: { clip: 'R', seconds: 0.8 },
};

/** Where every joint is turned to. Angles in radians; an arm at 0 hangs straight down, negative swings it forward and up. */
interface Pose {
  /** The whole body: forward lean, turn at the waist, how far the hips are lifted, and how wide the feet are set. */
  lean: number;
  twist: number;
  lift: number;
  stance: number;
  swordArm: number;
  /** The sword arm raised out to the side. */
  swordArmOut: number;
  /** How far the elbow is folded. */
  swordElbow: number;
  /** The blade against the forearm: 0 points back up the arm, π points on past the fist. */
  swordTilt: number;
  freeArm: number;
  freeArmOut: number;
  freeElbow: number;
}

/** Standing ready: feet apart, the sabre held out to the right with its blade raised, the free fist forward. */
const REST: Pose = {
  lean: 0.05,
  twist: -0.25,
  lift: -0.012,
  stance: 1,
  swordArm: -0.25,
  swordArmOut: 0.95,
  swordElbow: 1.15,
  swordTilt: 1.5,
  freeArm: -0.35,
  freeArmOut: 0.3,
  freeElbow: 1.2,
};

const smooth = (p: number): number => {
  const c = Math.min(1, Math.max(0, p));
  return c * c * (3 - 2 * c);
};

/** A pose part of the way from one to another. */
function mix(from: Pose, to: Partial<Pose>, amount: number): Pose {
  const out = { ...from };
  for (const key of Object.keys(to) as (keyof Pose)[])
    out[key] = from[key] + ((to[key] ?? from[key]) - from[key]) * amount;
  return out;
}

/** Rises quickly from 0 at the start of an action and falls back to 0 at its end, so every action begins and ends at rest. */
const envelope = (p: number): number => smooth(p * 7) * smooth((1 - p) * 4);

/** How each action moves the joints. `p` runs 0 to 1 over the action. */
const ACTIONS: Record<string, (p: number) => Pose> = {
  // A great cut from behind the head down across the body.
  attack: (p) => {
    const wound = mix(
      REST,
      { swordArm: -2.7, swordArmOut: 0.3, swordElbow: 0.9, swordTilt: 1.3, twist: -0.7, lean: -0.1 },
      1,
    );
    const struck = mix(
      REST,
      { swordArm: 0.55, swordArmOut: 0.05, swordElbow: 0.1, swordTilt: 2.9, twist: 0.7, lean: 0.3, lift: -0.03 },
      1,
    );
    return mix(REST, mix(wound, struck, smooth(p * 1.9)), envelope(p));
  },
  // A lunge: the whole body behind the point of the sabre.
  Q: (p) =>
    mix(
      REST,
      {
        lean: 0.55,
        twist: 0.35,
        swordArm: -1.5,
        swordArmOut: 0,
        swordElbow: 0,
        swordTilt: Math.PI,
        freeArm: 1,
        freeArmOut: 0.2,
        freeElbow: 0.2,
        stance: 1.5,
      },
      envelope(p),
    ),
  // On guard: the flat of the blade held upright across the body, the free hand braced against it.
  W: (p) =>
    mix(
      REST,
      {
        twist: 0,
        lift: -0.035,
        swordArm: -1.15,
        swordArmOut: -0.35,
        swordElbow: 1.35,
        swordTilt: 0.15,
        freeArm: -1.2,
        freeArmOut: -0.3,
        freeElbow: 1.3,
        stance: 1.4,
      },
      envelope(p),
    ),
  // A blow with the free fist, the sabre drawn back.
  E: (p) =>
    mix(
      REST,
      {
        twist: -0.7,
        lean: 0.25,
        freeArm: -1.5,
        freeArmOut: 0,
        freeElbow: 0.05,
        swordArm: 0.5,
        swordElbow: 0.6,
        stance: 1.4,
      },
      envelope(p),
    ),
  // A leap, the sabre swung up over the head in both hands and brought down as he lands.
  R: (p) => {
    const up = mix(
      REST,
      {
        lift: 0.3,
        twist: 0,
        lean: -0.25,
        swordArm: -2.95,
        swordArmOut: 0.05,
        swordElbow: 0.5,
        swordTilt: 1.6,
        freeArm: -2.8,
        freeArmOut: -0.1,
        freeElbow: 0.5,
        stance: 0.6,
      },
      1,
    );
    const down = mix(
      REST,
      {
        lift: -0.06,
        twist: 0,
        lean: 0.5,
        swordArm: 0.35,
        swordArmOut: 0,
        swordElbow: 0.05,
        swordTilt: 2.95,
        freeArm: 0.1,
        freeArmOut: 0,
        freeElbow: 0.3,
        stance: 1.7,
      },
      1,
    );
    return mix(REST, mix(up, down, smooth((p - 0.5) / 0.3)), envelope(p));
  },
};

/** The archer standing ready: bow held low in front in the left hand, the right hand on the hip. */
const ARCHER_REST: Pose = {
  lean: 0.03,
  twist: 0.25,
  lift: -0.006,
  stance: 0.55,
  swordArm: 0.25,
  swordArmOut: 0.45,
  swordElbow: 1.5,
  swordTilt: 0,
  freeArm: -0.75,
  freeArmOut: 0.25,
  freeElbow: 0.7,
};

/** Bow arm out straight toward the target, body side-on, string hand drawn back to the cheek. */
const DRAWN: Partial<Pose> = {
  twist: 1,
  lean: -0.06,
  stance: 1.2,
  freeArm: -1.5,
  freeArmOut: -0.35,
  freeElbow: 0,
  swordArm: -1.5,
  swordArmOut: 0.75,
  swordElbow: 2.2,
};
/** The same, the instant after the string is let go: the hand has flown back past the ear. */
const LOOSED: Partial<Pose> = { ...DRAWN, swordArm: -1.2, swordArmOut: 1.1, swordElbow: 0.9, lean: -0.12 };

/** How each action moves the archer. `p` runs 0 to 1 over the action. */
const ARCHER_ACTIONS: Record<string, (p: number) => Pose> = {
  // Draw and loose.
  attack: (p) => mix(ARCHER_REST, mix(mix(ARCHER_REST, DRAWN, 1), LOOSED, smooth((p - 0.45) * 8)), envelope(p)),
  // Something thrown underhand to a spot on the ground.
  Q: (p) => {
    const back = mix(ARCHER_REST, { swordArm: 1, swordArmOut: 0.3, swordElbow: 0.3, lean: 0.25, twist: -0.3 }, 1);
    const thrown = mix(ARCHER_REST, { swordArm: -1.6, swordArmOut: 0.1, swordElbow: 0.1, lean: 0.35, twist: 0.5 }, 1);
    return mix(ARCHER_REST, mix(back, thrown, smooth(p * 2.2)), envelope(p));
  },
  // She points her prey out.
  W: (p) =>
    mix(ARCHER_REST, { swordArm: -1.45, swordArmOut: 0.05, swordElbow: 0.05, twist: -0.35, lean: 0.1 }, envelope(p)),
  // A tuck and roll: knees up, body folded.
  E: (p) =>
    mix(
      ARCHER_REST,
      { lift: 0.14, lean: 0.9, stance: 0.3, swordArm: -0.6, swordElbow: 1.6, freeArm: -0.9, freeElbow: 1.5 },
      envelope(p),
    ),
  // The long shot: a slow, deep draw held at full stretch, then loosed.
  R: (p) =>
    mix(
      ARCHER_REST,
      mix(mix(ARCHER_REST, { ...DRAWN, lean: -0.16, stance: 1.6, lift: -0.03 }, 1), LOOSED, smooth((p - 0.7) * 9)),
      envelope(p),
    ),
};

interface Limb {
  upper: Group;
  lower: Group;
}

/** A strip of cloth or hair hanging from one point: flat pieces, each hinged to the last. */
interface Streamer {
  pieces: Group[];
  /** How far it swings on its own, and how much it lifts and streams out. */
  sway: number;
  lift: number;
  phase: number;
}

export class Swordsman {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly hips = new Group();
  private readonly chest = new Group();
  private readonly head = new Group();
  private readonly legs: Limb[] = [];
  private readonly swordArm: Limb;
  private readonly freeArm: Limb;
  private readonly sword = new Group();
  private readonly tabard: Group[] = [];
  private readonly streamers: Streamer[] = [];
  private readonly materials: Record<Exclude<keyof SwordsmanColours, 'archer'> | 'dark', MeshStandardMaterial>;
  private readonly white = new MeshBasicMaterial({ color: '#ffffff' });
  private readonly castShadow: boolean;
  private readonly archer: boolean;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;

  constructor(colours: SwordsmanColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.archer = colours.archer === true;
    const make = (color: string, extra: MeshStandardMaterialParameters = {}) =>
      new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
    this.materials = {
      cloth: make(colours.cloth, { side: DoubleSide }),
      armour: make(colours.armour, { roughness: 0.4, metalness: 0.5 }),
      trim: make(colours.trim, { roughness: 0.3, metalness: 0.8 }),
      ribbon: make(colours.ribbon, { side: DoubleSide, emissive: colours.ribbon, emissiveIntensity: 0.35 }),
      skin: make(colours.skin, { roughness: 0.6 }),
      hair: make(colours.hair, { roughness: 0.45 }),
      blade: make(colours.blade, { roughness: 0.2, metalness: 0.9 }),
      gem: make(colours.gem, { roughness: 0.2, emissive: colours.gem, emissiveIntensity: 0.9 }),
      dark: make('#14161c'),
    };

    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.hips.position.y = 0.3;
    this.model.add(this.hips);

    for (const side of [-1, 1]) this.legs.push(this.buildLeg(side));
    this.buildBody();
    this.swordArm = this.buildArm(1);
    this.freeArm = this.buildArm(-1);
    if (this.archer) this.buildBowAndQuiver();
    else this.buildSabre();
    this.buildHead();
    this.applyPose(this.archer ? ARCHER_REST : REST);
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

  private ball(
    material: MeshStandardMaterial | MeshBasicMaterial,
    parent: Group,
    position: [number, number, number],
    scale: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
  ): Mesh {
    return this.mesh(BALL, material, parent, position, rotation, scale);
  }

  /** A tube hanging down from its top end, which is where it hinges. */
  private hanging(top: number, bottom: number, length: number, material: MeshStandardMaterial, parent: Group): Mesh {
    const geometry = new CylinderGeometry(top, bottom, length, 14);
    geometry.translate(0, -length / 2, 0);
    return this.mesh(geometry, material, parent);
  }

  private buildLeg(side: number): Limb {
    const { cloth, armour, trim, gem } = this.materials;
    const upper = new Group();
    upper.position.set(side * 0.07, 0, 0);
    // Short, sturdy legs in baggy trousers, tucked into heavy plated boots.
    this.ball(cloth, upper, [0, -0.06, 0], [0.072, 0.09, 0.075]);
    const lower = new Group();
    lower.position.y = -0.13;
    this.hanging(0.062, 0.07, 0.12, armour, lower);
    this.mesh(new TorusGeometry(0.064, 0.012, 8, 18), trim, lower, [0, -0.005, 0], [UP, 0, 0]);
    this.ball(armour, lower, [0, -0.14, 0.035], [0.075, 0.045, 0.115]);
    this.ball(trim, lower, [0, -0.125, 0.125], [0.04, 0.03, 0.035]);
    // A plate over the knee with a stone set in it.
    this.ball(armour, lower, [0, 0.01, 0.055], [0.05, 0.055, 0.03]);
    this.ball(gem, lower, [0, 0.012, 0.083], [0.014, 0.014, 0.008]);
    upper.add(lower);
    this.hips.add(upper);
    return { upper, lower };
  }

  /** Tunic and chest plate, a broad belt, cloth hanging front and back, and two long ribbons from the small of the back. */
  private buildBody(): void {
    const { cloth, armour, trim, ribbon, gem, dark } = this.materials;
    this.chest.position.y = 0.02;
    this.hips.add(this.chest);
    this.ball(cloth, this.hips, [0, -0.01, 0], [0.115, 0.07, 0.09]);
    if (this.archer) {
      // A short skirt flaring out over the hips, edged in the colour of her ribbons.
      this.mesh(
        new CylinderGeometry(0.105, 0.2, 0.13, 20, 1, true),
        cloth,
        this.hips,
        [0, -0.055, 0],
        [0, 0, 0],
        [1, 1, 0.9],
      );
      this.mesh(new TorusGeometry(0.2, 0.01, 6, 26), ribbon, this.hips, [0, -0.12, 0], [UP, 0, 0], [1, 0.9, 1]);
    }
    this.mesh(new CylinderGeometry(0.135, 0.1, 0.2, 18), cloth, this.chest, [0, 0.1, 0], [0, 0, 0], [1, 1, 0.78]);
    this.ball(cloth, this.chest, [0, 0.2, 0], [0.14, 0.05, 0.105]);
    // A plate over the chest, edged in metal, with a stone at its centre.
    this.ball(armour, this.chest, [0, 0.13, 0.05], [0.1, 0.085, 0.065]);
    this.mesh(new TorusGeometry(0.085, 0.01, 8, 22), trim, this.chest, [0, 0.13, 0.1], [0, 0, 0], [1, 0.85, 0.5]);
    this.ball(gem, this.chest, [0, 0.13, 0.115], [0.022, 0.022, 0.012]);
    // A high collar.
    this.mesh(
      new CylinderGeometry(0.07, 0.085, 0.045, 16, 1, true),
      dark,
      this.chest,
      [0, 0.235, 0],
      [0, 0, 0],
      [1, 1, 0.85],
    );

    // The belt and its buckle.
    this.mesh(new CylinderGeometry(0.108, 0.112, 0.05, 18), dark, this.chest, [0, 0.005, 0], [0, 0, 0], [1, 1, 0.8]);
    this.ball(trim, this.chest, [0, 0.005, 0.088], [0.034, 0.028, 0.014]);
    this.ball(gem, this.chest, [0, 0.005, 0.1], [0.014, 0.012, 0.008]);
    // Plates hanging over the hips.
    for (const side of [-1, 1]) {
      this.ball(armour, this.hips, [side * 0.115, -0.045, 0], [0.04, 0.075, 0.07], [0, 0, side * 0.25]);
      this.ball(trim, this.hips, [side * 0.128, -0.1, 0], [0.03, 0.015, 0.055], [0, 0, side * 0.25]);
    }
    // A long panel of cloth hangs from the belt in front and behind, edged in metal at the hem.
    for (const [z, length] of [
      [0.085, 0.22],
      [-0.08, 0.25],
    ]) {
      const flap = new Group();
      flap.position.set(0, -0.01, z);
      const panel = new CylinderGeometry(0.05, 0.075, length, 4, 1);
      panel.translate(0, -length / 2, 0);
      this.mesh(panel, cloth, flap, [0, 0, 0], [0, Math.PI / 4, 0], [1, 1, 0.14]);
      this.ball(trim, flap, [0, -length, 0], [0.055, 0.012, 0.012]);
      this.hips.add(flap);
      this.tabard.push(flap);
    }
    // Two long ribbons knotted at the back of the belt, which fly out and curl behind him.
    this.ball(ribbon, this.chest, [0, 0.01, -0.09], [0.035, 0.03, 0.025]);
    for (const side of [-1, 1])
      this.streamers.push(
        this.buildStreamer(this.chest, [side * 0.03, 0.01, -0.095], 9, 0.62, 0.05, ribbon, 0.9, 1.5, side * 0.5),
      );
  }

  /** A short strong arm under a big plated shoulder. `side` is +1 for the sword arm (the right), -1 for the free arm. */
  private buildArm(side: number): Limb {
    const { cloth, armour, trim, skin, gem } = this.materials;
    const upper = new Group();
    upper.position.set(side * 0.16, 0.17, 0);
    this.hanging(0.05, 0.046, 0.11, cloth, upper);
    // The archer wears no guard on the arm that draws the string.
    const guarded = !(this.archer && side === 1);
    // The shoulder guard: two overlapping plates, each rimmed in metal, with a spike and a stone.
    if (guarded) {
      this.ball(armour, upper, [side * 0.015, 0.03, 0], [0.085, 0.06, 0.085], [0, 0, side * 0.35]);
      this.ball(armour, upper, [side * 0.035, -0.015, 0], [0.07, 0.04, 0.075], [0, 0, side * 0.6]);
      this.mesh(
        new TorusGeometry(0.075, 0.009, 8, 20),
        trim,
        upper,
        [side * 0.02, 0.012, 0],
        [UP, side * 0.35, 0],
        [1, 1, 0.7],
      );
      this.mesh(new ConeGeometry(0.02, 0.08, 8), trim, upper, [side * 0.06, 0.075, 0], [0, 0, -side * 0.7]);
      this.ball(gem, upper, [side * 0.02, 0.045, 0.07], [0.015, 0.015, 0.01]);
    } else this.ball(cloth, upper, [0, 0.01, 0], [0.058, 0.05, 0.058]);
    const lower = new Group();
    lower.position.y = -0.11;
    this.ball(skin, lower, [0, 0, 0], [0.042, 0.042, 0.042]);
    // A bracer from the elbow to the wrist, and a fist.
    this.hanging(0.046, 0.054, 0.1, armour, lower);
    this.mesh(new TorusGeometry(0.05, 0.009, 8, 16), trim, lower, [0, -0.095, 0], [UP, 0, 0]);
    this.mesh(new TorusGeometry(0.046, 0.007, 8, 16), trim, lower, [0, -0.015, 0], [UP, 0, 0]);
    this.ball(skin, lower, [0, -0.135, 0], [0.046, 0.046, 0.046]);
    upper.add(lower);
    this.chest.add(upper);
    return { upper, lower };
  }

  /** A broad, heavy sabre nearly as tall as its owner: a wide blade with a clipped point and a toothed back. */
  private buildSabre(): void {
    const { blade, trim, ribbon, gem, dark } = this.materials;
    this.sword.position.set(0, -0.135, 0);
    // Turned about its own length so the broad flat of the blade, not its edge, shows from the front.
    this.sword.rotation.y = 1.25;
    this.swordArm.lower.add(this.sword);
    // Built pointing up from the fist: pommel ring, grip, guard, then the blade. Its edge faces +z.
    this.mesh(new TorusGeometry(0.022, 0.007, 8, 16), trim, this.sword, [0, -0.1, 0], [0, UP, 0]);
    this.mesh(new CylinderGeometry(0.016, 0.016, 0.13, 10), ribbon, this.sword, [0, -0.02, 0]);
    this.ball(trim, this.sword, [0, 0.055, 0], [0.022, 0.022, 0.075]);
    this.ball(gem, this.sword, [0, 0.055, 0], [0.026, 0.016, 0.02]);
    // The blade widens toward the point; a dark fuller runs up its middle.
    const steel = new CylinderGeometry(0.105, 0.06, 0.62, 4, 1);
    this.mesh(steel, blade, this.sword, [0, 0.38, 0.012], [0, Math.PI / 4, 0], [0.11, 1, 1]);
    this.mesh(
      new CylinderGeometry(0.03, 0.022, 0.5, 4),
      dark,
      this.sword,
      [0, 0.34, 0.005],
      [0, Math.PI / 4, 0],
      [0.13, 1, 1],
    );
    // The clipped point sweeps up to the back of the blade.
    this.mesh(
      new ConeGeometry(0.105, 0.17, 4),
      blade,
      this.sword,
      [0, 0.775, 0.012],
      [0, Math.PI / 4, -0.0],
      [0.11, 1, 1],
    );
    // Teeth of metal along the back, and a plate where blade meets guard.
    for (let i = 0; i < 4; i++)
      this.mesh(
        new ConeGeometry(0.02, 0.07, 6),
        trim,
        this.sword,
        [0, 0.22 + i * 0.14, -0.06 - i * 0.008],
        [-UP - 0.4, 0, 0],
        [0.4, 1, 1],
      );
    this.ball(trim, this.sword, [0, 0.11, 0.005], [0.014, 0.05, 0.062]);
    this.streamers.push(this.buildStreamer(this.sword, [0, -0.12, 0], 5, 0.26, 0.024, ribbon, 0.8, 0.6, 0));
  }

  /** A piece that curves: a row of ever thinner lengths, each tipped a little further than the last. */
  private curved(
    parent: Group,
    position: [number, number, number],
    rotation: [number, number, number],
    length: number,
    radius: number,
    curl: number,
    material: MeshStandardMaterial,
  ): void {
    const pieces = 7;
    const step = length / pieces;
    let holder = new Group();
    holder.position.set(...position);
    holder.rotation.set(...rotation);
    parent.add(holder);
    for (let i = 0; i < pieces; i++) {
      const r1 = radius * (1 - (i / pieces) * 0.75);
      const r2 = radius * (1 - ((i + 1) / pieces) * 0.75);
      const piece = new CylinderGeometry(r2, r1, step * 1.1, 8);
      piece.translate(0, step / 2, 0);
      this.mesh(piece, material, holder);
      const next = new Group();
      next.position.y = step;
      next.rotation.x = curl / pieces;
      holder.add(next);
      holder = next;
    }
  }

  /** A tall recurved bow in the left fist, and on the back a quiver of arrows. */
  private buildBowAndQuiver(): void {
    const { trim, ribbon, gem, dark, armour, blade } = this.materials;
    const bow = new Group();
    bow.position.set(0, -0.135, 0);
    // Built standing upright with the string toward +z, then laid so that it stands upright when the bow arm
    // is held out, with the string toward her.
    bow.rotation.x = -UP;
    this.freeArm.lower.add(bow);
    const limb = 0.4;
    const curl = 1;
    for (const turn of [0, Math.PI]) {
      const half = new Group();
      half.rotation.z = turn;
      this.curved(half, [0, 0.035, 0], [-0.25, 0, 0], limb, 0.02, curl, armour);
      // A band of metal on each limb and a horn tip that curls back.
      this.mesh(new TorusGeometry(0.021, 0.006, 6, 12), trim, half, [0, 0.14, 0.012], [UP, 0, 0]);
      bow.add(half);
    }
    // The grip, wrapped, with a stone set above and below it.
    this.mesh(new CylinderGeometry(0.022, 0.022, 0.09, 10), ribbon, bow);
    for (const y of [-0.055, 0.055]) this.ball(gem, bow, [0, y, -0.012], [0.014, 0.014, 0.01]);
    // The string runs from tip to tip.
    const tipY = 0.035 + (limb * Math.sin(curl - 0.25)) / curl + 0.07;
    const tipZ = (limb * (1 - Math.cos(curl))) / curl - 0.08;
    this.mesh(new CylinderGeometry(0.0025, 0.0025, tipY * 2, 4), this.white, bow, [0, 0, tipZ]);
    this.streamers.push(this.buildStreamer(bow, [0, -tipY, tipZ], 4, 0.18, 0.02, ribbon, 0.8, 0.4, 0));

    // The quiver hangs across her back, arrows fletched in the colour of her ribbons standing out of it.
    const quiver = new Group();
    quiver.position.set(0.05, 0.13, -0.11);
    quiver.rotation.set(0.25, 0, -0.5);
    this.mesh(new CylinderGeometry(0.036, 0.028, 0.24, 12), dark, quiver);
    this.mesh(new TorusGeometry(0.037, 0.007, 6, 14), trim, quiver, [0, 0.11, 0], [UP, 0, 0]);
    this.mesh(new TorusGeometry(0.031, 0.006, 6, 14), trim, quiver, [0, -0.08, 0], [UP, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const x = Math.sin(a) * 0.016;
      const z = Math.cos(a) * 0.016;
      this.mesh(new CylinderGeometry(0.003, 0.003, 0.12, 4), blade, quiver, [x, 0.17, z]);
      this.mesh(new ConeGeometry(0.012, 0.05, 4), ribbon, quiver, [x, 0.21, z], [Math.PI, a, 0], [1, 1, 0.3]);
    }
    this.chest.add(quiver);
  }

  /** Hair in a soft fringe, two buns tied with ribbon on the crown, and a long tail falling from each. */
  private buildArcherHair(): void {
    const { hair, ribbon, gem, dark } = this.materials;
    this.ball(hair, this.head, [0, 0.2, -0.02], [0.182, 0.162, 0.17]);
    // The fringe: locks swept to either side of a parting, and a longer lock in front of each ear.
    for (let i = 0; i < 6; i++) {
      const x = (i - 2.5) * 0.055;
      this.ball(
        hair,
        this.head,
        [x, 0.262 - Math.abs(i - 2.5) * 0.014, 0.135],
        [0.036, 0.05, 0.022],
        [0.35, 0, (i - 2.5) * -0.28],
      );
    }
    for (const side of [-1, 1]) {
      this.ball(hair, this.head, [side * 0.158, 0.11, 0.05], [0.026, 0.1, 0.03], [0, 0, side * 0.1]);
      // A bun high on each side, bound with ribbon, a stone in the knot.
      this.ball(hair, this.head, [side * 0.125, 0.335, -0.03], [0.062, 0.06, 0.062]);
      this.mesh(
        new TorusGeometry(0.045, 0.012, 8, 16),
        ribbon,
        this.head,
        [side * 0.112, 0.295, -0.028],
        [UP, 0, side * 0.5],
      );
      this.ball(gem, this.head, [side * 0.125, 0.3, 0.03], [0.014, 0.014, 0.01]);
      for (const out of [-1, 1])
        this.streamers.push(
          this.buildStreamer(
            this.head,
            [side * 0.125, 0.29, -0.06],
            4,
            0.16,
            0.022,
            ribbon,
            0.9,
            1,
            side * 0.3 + out * 0.3,
          ),
        );
      // The tail of hair from each bun.
      this.streamers.push(
        this.buildStreamer(this.head, [side * 0.15, 0.3, -0.07], 8, 0.5, 0.06, hair, 0.45, 0.8, side * 0.22),
      );
      // Long lashes at the corner of each eye, and a touch of colour on the cheek.
      this.mesh(new ConeGeometry(0.008, 0.04, 4), dark, this.head, [side * 0.102, 0.176, 0.128], [0, 0, -side * 1.1]);
      this.ball(this.materials.ribbon, this.head, [side * 0.1, 0.1, 0.132], [0.024, 0.012, 0.006]);
    }
  }

  private buildHead(): void {
    const { skin, hair, ribbon, trim, dark, gem } = this.materials;
    this.head.position.y = 0.245;
    this.chest.add(this.head);
    // A big round head on a short neck.
    this.mesh(new CylinderGeometry(0.04, 0.05, 0.04, 12), skin, this.head, [0, 0, 0]);
    this.ball(skin, this.head, [0, 0.17, 0.005], [0.172, 0.165, 0.16]);
    for (const side of [-1, 1]) {
      this.ball(skin, this.head, [side * 0.168, 0.15, -0.005], [0.022, 0.035, 0.028]);
      // Large eyes: a white, a dark iris with a coloured ring and a spark of light, under a bold slanted brow.
      this.ball(this.white, this.head, [side * 0.066, 0.158, 0.138], [0.036, 0.042, 0.02]);
      this.ball(dark, this.head, [side * 0.064, 0.154, 0.15], [0.026, 0.034, 0.014]);
      this.ball(gem, this.head, [side * 0.064, 0.146, 0.157], [0.014, 0.016, 0.008]);
      this.ball(this.white, this.head, [side * 0.056, 0.168, 0.163], [0.008, 0.009, 0.004]);
      this.ball(hair, this.head, [side * 0.068, 0.212, 0.142], [0.042, 0.011, 0.012], [0, 0, side * 0.32]);
      // A lock of hair in front of each ear.
      this.mesh(
        new ConeGeometry(0.028, 0.16, 6),
        hair,
        this.head,
        [side * 0.15, 0.13, 0.06],
        [Math.PI, 0, side * 0.12],
      );
    }
    // A small nose and a set mouth.
    this.ball(skin, this.head, [0, 0.118, 0.158], [0.012, 0.01, 0.012]);
    this.ball(dark, this.head, [0, 0.082, 0.146], [0.022, 0.005, 0.006]);

    if (this.archer) this.buildArcherHair();
    else {
      // Hair: a cap over the skull, a fringe of spikes over the brow, and a crest of bigger spikes swept up and back.
      this.ball(hair, this.head, [0, 0.2, -0.02], [0.18, 0.16, 0.168]);
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.062;
        this.mesh(
          new ConeGeometry(0.04, 0.13, 6),
          hair,
          this.head,
          [x, 0.265 - Math.abs(i - 2) * 0.012, 0.12],
          [Math.PI - 0.5, 0, (i - 2) * 0.22],
        );
      }
      for (let ring = 0; ring < 2; ring++)
        for (let i = 0; i < 7; i++) {
          const a = (i / 6 - 0.5) * 2.6;
          const reach = 0.12 + ring * 0.03;
          this.mesh(
            new ConeGeometry(0.05 - ring * 0.008, 0.2 - ring * 0.03, 6),
            hair,
            this.head,
            [Math.sin(a) * reach, 0.3 - ring * 0.07 - Math.abs(a) * 0.03, -0.06 - ring * 0.08 - Math.cos(a) * 0.01],
            [-0.75 - ring * 0.5, 0, -Math.sin(a) * 0.9],
          );
        }
      // The topknot, held in a ring of metal with a stone, standing over the crown.
      this.mesh(new TorusGeometry(0.034, 0.012, 8, 16), trim, this.head, [0, 0.355, -0.02], [UP, 0, 0]);
      this.ball(gem, this.head, [0, 0.355, 0.02], [0.013, 0.013, 0.008]);
      this.ball(hair, this.head, [0, 0.395, -0.025], [0.034, 0.045, 0.034]);
      this.streamers.push(this.buildStreamer(this.head, [0, 0.42, -0.03], 6, 0.3, 0.05, hair, 0.5, 1.2, 0, true));
    }

    // A headband with a plate at the brow; its ends fly out behind.
    this.mesh(new TorusGeometry(0.17, 0.014, 8, 26), ribbon, this.head, [0, 0.235, 0], [UP - 0.1, 0, 0], [1, 0.95, 1]);
    this.ball(trim, this.head, [0, 0.252, 0.162], [0.04, 0.026, 0.012]);
    this.ball(gem, this.head, [0, 0.252, 0.173], [0.015, 0.015, 0.008]);
    for (const side of [-1, 1])
      this.streamers.push(
        this.buildStreamer(this.head, [side * 0.03, 0.22, -0.165], 6, 0.36, 0.03, ribbon, 0.8, 1.3, side * 0.3),
      );
  }

  /**
   * A strip that hangs from `position` on `parent` and will be made to sway. `spread` turns it a
   * little to one side so two strips fly apart; `upright` starts it standing up, like a tail of hair
   * from a topknot.
   */
  private buildStreamer(
    parent: Group,
    position: [number, number, number],
    count: number,
    length: number,
    width: number,
    material: MeshStandardMaterial,
    sway: number,
    lift: number,
    spread: number,
    upright = false,
  ): Streamer {
    const pieces: Group[] = [];
    const step = length / count;
    const base = new Group();
    base.position.set(...position);
    base.rotation.set(upright ? Math.PI * 0.75 : 0, 0, spread);
    parent.add(base);
    let holder = new Group();
    base.add(holder);
    for (let i = 0; i < count; i++) {
      const taper = 1 - (i / count) * 0.5;
      const strip = new CylinderGeometry((width * taper) / 2, (width * taper * 0.9) / 2, step * 1.1, 6);
      strip.translate(0, -step / 2, 0);
      this.mesh(strip, material, holder, [0, 0, 0], [0, 0, 0], [1, 1, 0.18]);
      pieces.push(holder);
      const next = new Group();
      next.position.y = -step;
      holder.add(next);
      holder = next;
    }
    return { pieces, sway, lift, phase: Math.random() * 6 };
  }

  // ---- moving ----

  /** Forget everything a previous owner did. */
  reset(): void {
    this.action = null;
    this.seenActionAt = -1;
    this.death = 0;
  }

  private applyPose(pose: Pose): void {
    const t = this.time;
    const walk = this.walk;
    const dying = this.death;
    const alive = 1 - dying;
    const step = this.stride * Math.PI * 2;

    // Falling: he goes over backward and lies flat.
    this.model.rotation.x = -smooth(dying) * 1.5;
    this.model.position.y = smooth(dying) * 0.1 * this.model.scale.y;

    const breath = Math.sin(t * 2) * 0.006;
    const lean = pose.lean + walk * 0.28;
    this.hips.position.y = 0.3 + (breath + Math.abs(Math.sin(step)) * 0.03 * walk + pose.lift) * alive;
    this.hips.rotation.x = lean;
    this.hips.rotation.y = pose.twist * 0.4 * (1 - walk) + Math.sin(step) * 0.1 * walk;
    this.chest.rotation.y = pose.twist * 0.6 * (1 - walk * 0.5) - Math.sin(step) * 0.15 * walk;
    this.chest.rotation.x = breath * 2;
    // The head stays level, looks where he is going, and glances about when he stands.
    this.head.rotation.x = -lean * 0.8;
    this.head.rotation.y = -pose.twist * 0.8 * (1 - walk) + Math.sin(t * 0.6) * 0.1 * (1 - walk) * alive;

    this.legs.forEach((leg, i) => {
      const side = i === 0 ? -1 : 1;
      const phase = step + (i === 0 ? 0 : Math.PI);
      const swing = Math.sin(phase) * 0.9 * walk;
      // The knee folds as the leg comes through, and both knees give in a crouch or tuck in a leap.
      const fold = Math.max(0, -Math.cos(phase)) * 1.2 * walk;
      const tuck = Math.max(0, pose.lift) * 3 + Math.max(0, -pose.lift) * 7;
      leg.upper.rotation.x = swing - tuck * 0.5 - lean * 0.7 + side * 0.1 * (1 - walk);
      // Feet planted wide when he stands; they come in under him as he runs.
      leg.upper.rotation.z = side * (0.1 + 0.16 * pose.stance * (1 - walk));
      leg.lower.rotation.x = fold + tuck;
    });
    // The cloth at the belt swings with his stride and flies back as he runs.
    this.tabard.forEach((flap, i) => {
      flap.rotation.x =
        (i === 0 ? -1 : 1) * (0.12 + Math.sin(step * 2) * 0.1 * walk) + walk * (i === 0 ? 0.35 : 0.6) - lean * 0.5;
    });

    // Running, the sabre is carried low and back and the free arm pumps.
    const run = walk * (this.action ? 0 : 1);
    this.swordArm.upper.rotation.x = pose.swordArm * (1 - run) + run * (0.8 + Math.sin(step) * 0.12);
    this.swordArm.upper.rotation.z = pose.swordArmOut * (1 - run) + run * 0.35;
    this.swordArm.lower.rotation.x = -(pose.swordElbow * (1 - run) + run * 0.25);
    this.sword.rotation.x = pose.swordTilt * (1 - run) + run * 2.5;
    // The archer runs with her bow carried low and forward, not pumping that arm.
    const carry = this.archer ? 0.25 : 1;
    this.freeArm.upper.rotation.x = pose.freeArm * (1 - run) + run * (-0.3 - Math.sin(step) * 0.7 * carry);
    this.freeArm.upper.rotation.z = -(pose.freeArmOut * (1 - run) + run * 0.2);
    this.freeArm.lower.rotation.x = -(pose.freeElbow * (1 - run) + run * 1.2);

    // Ribbons and hair are never still: they ripple when he stands and stream out behind when he moves or strikes.
    const stir = walk + (this.action ? 0.7 : 0);
    for (const streamer of this.streamers) {
      const count = streamer.pieces.length;
      streamer.pieces.forEach((piece, i) => {
        const f = (i + 1) / count;
        const wave = Math.sin(t * (2.6 + stir * 4) + streamer.phase - i * 0.75);
        const out = (0.35 + stir * 0.75) * streamer.lift;
        piece.rotation.x = (i === 0 ? out : out * 0.12 - 0.1 * f) + wave * 0.16 * streamer.sway * (0.6 + f);
        piece.rotation.z = Math.sin(t * 1.7 + streamer.phase + i * 0.6) * 0.14 * streamer.sway * f;
      });
    }
  }

  /** Turn the joints for this frame: stand, run, act or fall. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 9);
    this.stride = (this.stride + delta * 2.4 * this.walk) % 1;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = SWORDSMAN_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead)
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
    }
    const rest = this.archer ? ARCHER_REST : REST;
    const actions = this.archer ? ARCHER_ACTIONS : ACTIONS;
    let pose = rest;
    if (this.action && clock < this.action.until && !state.dead) {
      const progress = (clock - this.action.from) / (this.action.until - this.action.from);
      pose = actions[this.action.kind]?.(Math.max(0, progress)) ?? rest;
    } else this.action = null;
    this.applyPose(pose);
  }
}
