import {
  CanvasTexture,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry } from 'three';
import type { ActorAction } from '@/lib/session';
import { skinned } from './scaleSkin';

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
  /**
   * Who this is. A blade-master unless said otherwise (`archer` is the older way to ask for the
   * archer). The mage wears a long robe and a tall bent hat, carries a staff crowned with a crescent
   * and a burning stone, and reads from a book that floats over her hand. The healer wears a hooded
   * cloak and a satchel, shoots a small crossbow and keeps a mending light over her other hand.
   */
  kind?: HumanKind;
}

export type HumanKind = 'blade' | 'archer' | 'mage' | 'healer';

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
/**
 * The parts are built short and round, then drawn out: long legs, a longer body, a smaller head. These are
 * how far each is stretched, and where that puts the hips.
 */
const LEG_STRETCH = 1.75;
const BODY_STRETCH = 1.28;
const BODY_SLIM = 0.86;
const ARM_STRETCH = 1.3;
const HEAD_SIZE = 0.6;
const HIP_HEIGHT = 0.3 * LEG_STRETCH - 0.03;

let brocadeMaps: { colour: Texture; thread: Texture } | null = null;

/**
 * Embroidered cloth, drawn once and shared: a fine weave with curling cloud motifs worked over it.
 * Two pictures of the same cloth: its shading (multiplied into the cloth's colour) and the
 * embroidery thread alone, which is made to glow.
 */
function brocade(): { colour: Texture; thread: Texture } {
  if (brocadeMaps) return brocadeMaps;
  const size = 256;
  const [colourCanvas, threadCanvas] = [0, 1].map(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    return canvas;
  });
  const colour = colourCanvas.getContext('2d')!;
  const thread = threadCanvas.getContext('2d')!;
  colour.fillStyle = '#b4b4b4';
  colour.fillRect(0, 0, size, size);
  thread.fillStyle = '#000';
  thread.fillRect(0, 0, size, size);
  // The weave: fine diagonal lines both ways.
  colour.lineWidth = 1;
  for (let i = -size; i < size * 2; i += 6) {
    colour.strokeStyle = 'rgba(0,0,0,0.16)';
    colour.beginPath();
    colour.moveTo(i, 0);
    colour.lineTo(i + size, size);
    colour.stroke();
    colour.strokeStyle = 'rgba(255,255,255,0.12)';
    colour.beginPath();
    colour.moveTo(i, size);
    colour.lineTo(i + size, 0);
    colour.stroke();
  }
  /** One cloud: three curls of thread spiralling out of a point. */
  const cloud = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => {
    for (const [dx, dy, turn] of [
      [0, 0, 0],
      [r * 0.9, r * 0.25, 2.1],
      [-r * 0.8, r * 0.35, 4.2],
    ]) {
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 2.6; a += 0.2) {
        const reach = r * (0.15 + a * 0.085);
        const px = x + dx + Math.cos(a + turn) * reach;
        const py = y + dy + Math.sin(a + turn) * reach * 0.8;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  };
  for (const ctx of [colour, thread]) {
    ctx.lineCap = 'round';
    ctx.lineWidth = ctx === colour ? 3.2 : 2;
    ctx.strokeStyle = ctx === colour ? '#f4f4f4' : '#fff';
    // Motifs on a staggered grid; those near an edge are drawn again on the far side so the cloth tiles.
    for (let row = 0; row < 4; row++)
      for (let column = 0; column < 4; column++) {
        const x = column * 64 + (row % 2 ? 32 : 0) + 16;
        const y = row * 64 + 24;
        for (const ox of [-size, 0, size]) cloud(ctx, x + ox, y, 13);
      }
    // A border line with dots along one edge, which falls on hems.
    ctx.lineWidth = ctx === colour ? 4 : 3;
    ctx.beginPath();
    ctx.moveTo(0, size - 8);
    ctx.lineTo(size, size - 8);
    ctx.stroke();
  }
  const [colourMap, threadMap] = [colourCanvas, threadCanvas].map((canvas) => {
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    texture.colorSpace = SRGBColorSpace;
    texture.repeat.set(2, 1.5);
    return texture;
  });
  brocadeMaps = { colour: colourMap, thread: threadMap };
  return brocadeMaps;
}

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

/** The mage standing ready: staff upright beside her, the book hovering over her raised left hand. */
const MAGE_REST: Pose = {
  lean: 0.02,
  twist: -0.15,
  lift: -0.004,
  stance: 0.5,
  swordArm: -0.35,
  swordArmOut: 0.4,
  swordElbow: 1.2,
  swordTilt: 1.45,
  freeArm: -0.75,
  freeArmOut: 0.25,
  freeElbow: 1.25,
};

/** How each action moves the mage. `p` runs 0 to 1 over the action. */
const MAGE_ACTIONS: Record<string, (p: number) => Pose> = {
  // The head of the staff levelled at the target.
  attack: (p) =>
    mix(
      MAGE_REST,
      { swordArm: -1.35, swordArmOut: 0.1, swordElbow: 0.25, swordTilt: 2.3, twist: 0.35, lean: 0.15 },
      envelope(p),
    ),
  // The same with her whole weight behind it.
  Q: (p) =>
    mix(
      MAGE_REST,
      { swordArm: -1.45, swordArmOut: 0.05, swordElbow: 0.1, swordTilt: 2.7, twist: 0.5, lean: 0.28, stance: 1.3 },
      envelope(p),
    ),
  // The staff thrust up over her head.
  W: (p) =>
    mix(
      MAGE_REST,
      { swordArm: -2.6, swordArmOut: 0.15, swordElbow: 0.2, swordTilt: 2.9, lean: -0.1, lift: 0.02 },
      envelope(p),
    ),
  // Gathered small to vanish: knees up, arms in.
  E: (p) =>
    mix(
      MAGE_REST,
      { lift: 0.12, lean: 0.3, stance: 0.3, swordArm: -0.8, swordElbow: 1.6, freeArm: -0.9, freeElbow: 1.6 },
      envelope(p),
    ),
  // Both arms flung up to call the sky down.
  R: (p) =>
    mix(
      MAGE_REST,
      {
        swordArm: -2.8,
        swordArmOut: 0.3,
        swordElbow: 0.15,
        swordTilt: 2.9,
        freeArm: -2.7,
        freeArmOut: 0.3,
        freeElbow: 0.2,
        lean: -0.2,
        lift: 0.06,
        stance: 1.2,
      },
      envelope(p),
    ),
};

/** The healer standing ready: crossbow held forward at the hip, the mending light lifted in her left hand. */
const HEALER_REST: Pose = {
  lean: 0.03,
  twist: 0.1,
  lift: -0.005,
  stance: 0.6,
  swordArm: -0.2,
  swordArmOut: 0.12,
  swordElbow: 1.3,
  swordTilt: 3,
  freeArm: -0.9,
  freeArmOut: 0.35,
  freeElbow: 1.5,
};

/** Crossbow arm out straight, sighting along it. */
const AIMED: Partial<Pose> = {
  swordArm: -1.5,
  swordArmOut: 0.05,
  swordElbow: 0.05,
  swordTilt: Math.PI,
  twist: 0.45,
  lean: 0.05,
  stance: 1.1,
};
/** The same, kicked back by the shot. */
const KICKED: Partial<Pose> = { ...AIMED, swordArm: -1.8, lean: -0.1 };

/** How each action moves the healer. `p` runs 0 to 1 over the action. */
const HEALER_ACTIONS: Record<string, (p: number) => Pose> = {
  // Aim and shoot.
  attack: (p) => mix(HEALER_REST, mix(mix(HEALER_REST, AIMED, 1), KICKED, smooth((p - 0.45) * 8)), envelope(p)),
  Q: (p) => mix(HEALER_REST, mix(mix(HEALER_REST, AIMED, 1), KICKED, smooth((p - 0.45) * 8)), envelope(p)),
  // The mending light held high.
  W: (p) => mix(HEALER_REST, { freeArm: -2.6, freeArmOut: 0.2, freeElbow: 0.25, lean: -0.12, lift: 0.02 }, envelope(p)),
  // Something lobbed underhand from the left.
  E: (p) => {
    const back = mix(HEALER_REST, { freeArm: 0.9, freeArmOut: 0.3, freeElbow: 0.3, lean: 0.2, twist: 0.3 }, 1);
    const thrown = mix(HEALER_REST, { freeArm: -1.6, freeArmOut: 0.1, freeElbow: 0.1, lean: 0.3, twist: -0.4 }, 1);
    return mix(HEALER_REST, mix(back, thrown, smooth(p * 2.2)), envelope(p));
  },
  // Both arms raised to rally everyone near.
  R: (p) =>
    mix(
      HEALER_REST,
      {
        swordArm: -2.7,
        swordArmOut: 0.35,
        swordElbow: 0.2,
        freeArm: -2.7,
        freeArmOut: 0.35,
        freeElbow: 0.2,
        lean: -0.15,
        lift: 0.05,
        stance: 1.2,
      },
      envelope(p),
    ),
};

const REST_OF: Record<HumanKind, Pose> = { blade: REST, archer: ARCHER_REST, mage: MAGE_REST, healer: HEALER_REST };
const ACTIONS_OF: Record<HumanKind, Record<string, (p: number) => Pose>> = {
  blade: ACTIONS,
  archer: ARCHER_ACTIONS,
  mage: MAGE_ACTIONS,
  healer: HEALER_ACTIONS,
};
/** How the thing in the right hand is carried at a run: the sabre and bow hand low and back, the staff upright, the crossbow forward. */
const RUN_TILT: Record<HumanKind, number> = { blade: 2.5, archer: 2.5, mage: 1.35, healer: 2.8 };

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
  private readonly materials: Record<Exclude<keyof SwordsmanColours, 'archer' | 'kind'> | 'dark', MeshStandardMaterial>;
  private readonly white = new MeshBasicMaterial({ color: '#ffffff' });
  private readonly castShadow: boolean;
  private readonly kind: HumanKind;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;

  constructor(colours: SwordsmanColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.kind = colours.kind ?? (colours.archer ? 'archer' : 'blade');
    const make = (color: string, extra: MeshStandardMaterialParameters = {}) =>
      new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...extra });
    this.materials = {
      // Embroidered cloth, its thread glowing in the colour of the metal trim.
      cloth: make(colours.cloth, {
        side: DoubleSide,
        map: brocade().colour,
        emissiveMap: brocade().thread,
        emissive: colours.trim,
        emissiveIntensity: 0.9,
        roughness: 0.65,
      }),
      // Armour of small overlapping plates, light showing between some of them: the dragons' own scales, in metal.
      armour: make(colours.armour, { ...skinned(colours.gem, 1.6, 1), roughness: 0.35, metalness: 0.65 }),
      trim: make(colours.trim, { roughness: 0.3, metalness: 0.8 }),
      ribbon: make(colours.ribbon, { side: DoubleSide, emissive: colours.ribbon, emissiveIntensity: 0.9 }),
      skin: make(colours.skin, { roughness: 0.6 }),
      hair: make(colours.hair, { roughness: 0.45 }),
      blade: make(colours.blade, { roughness: 0.2, metalness: 0.9 }),
      gem: make(colours.gem, { roughness: 0.2, emissive: colours.gem, emissiveIntensity: 1.6 }),
      dark: make('#14161c'),
    };

    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.hips.position.y = HIP_HEIGHT;
    this.model.add(this.hips);

    for (const side of [-1, 1]) this.legs.push(this.buildLeg(side));
    this.buildBody();
    this.swordArm = this.buildArm(1);
    this.freeArm = this.buildArm(-1);
    if (this.kind === 'archer') this.buildBowAndQuiver();
    else if (this.kind === 'mage') this.buildStaffAndBook();
    else if (this.kind === 'healer') this.buildCrossbowAndLight();
    else this.buildSabre();
    this.buildHead();
    this.buildCape();
    this.buildTrappings();
    // Draw the short round figure out into a tall, lean one. Each part is stretched in itself, joint by
    // joint: scaling a whole limb at its root would skew whatever bends below it.
    for (const leg of this.legs) {
      this.stretch(leg.upper, LEG_STRETCH, 0.82);
      this.stretch(leg.lower, LEG_STRETCH, 0.82);
    }
    this.stretch(this.chest, BODY_STRETCH, BODY_SLIM);
    for (const arm of [this.swordArm, this.freeArm]) {
      this.stretch(arm.upper, ARM_STRETCH, 0.88);
      this.stretch(arm.lower, ARM_STRETCH, 0.88);
    }
    for (const flap of this.tabard) flap.scale.y = LEG_STRETCH;
    this.head.scale.setScalar(HEAD_SIZE);
    this.applyPose(REST_OF[this.kind]);
  }

  // ---- building ----

  /**
   * Lengthens and thins what hangs directly on one joint: its own shapes are stretched, and the joints
   * below it are moved to where the longer part now ends, but left unscaled themselves.
   */
  private stretch(joint: Group, tall: number, thin: number): void {
    for (const child of joint.children) {
      child.position.set(child.position.x * thin, child.position.y * tall, child.position.z * thin);
      if (!(child instanceof Mesh)) continue;
      // A shape that has been turned is only thinned: stretching it would pull it along the wrong axis.
      const turned = child.rotation.x !== 0 || child.rotation.z !== 0;
      child.scale.set(child.scale.x * thin, child.scale.y * (turned ? thin : tall), child.scale.z * thin);
    }
  }

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
    // A ridge down the shin, a spur at the knee and a band at the ankle.
    this.mesh(new CylinderGeometry(0.007, 0.011, 0.1, 4), trim, lower, [0, -0.062, 0.066]);
    this.mesh(new ConeGeometry(0.014, 0.05, 6), trim, lower, [0, 0.045, 0.07], [0.5, 0, 0]);
    this.mesh(new TorusGeometry(0.071, 0.008, 6, 18), trim, lower, [0, -0.112, 0], [UP, 0, 0]);
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
    if (this.kind === 'archer' || this.kind === 'healer') {
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
    if (this.kind === 'mage') {
      // A long robe to the ankles, banded in metal, its hem edged in light.
      const robe = 0.43;
      this.mesh(new CylinderGeometry(0.1, 0.25, robe, 24, 1, true), cloth, this.hips, [0, -robe / 2 + 0.01, 0]);
      for (const [y, r] of [
        [-0.13, 0.148],
        [-0.27, 0.205],
      ])
        this.mesh(new TorusGeometry(r, 0.007, 6, 30), trim, this.hips, [0, y, 0], [UP, 0, 0]);
      this.mesh(new TorusGeometry(0.25, 0.011, 6, 34), ribbon, this.hips, [0, -robe + 0.01, 0], [UP, 0, 0]);
      // Stars worked into the skirt, all the way round.
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const y = -0.2 - (i % 3) * 0.07;
        const r = 0.1 + ((0.01 - y) / robe) * 0.15 + 0.004;
        this.ball(gem, this.hips, [Math.sin(a) * r, y, Math.cos(a) * r], [0.011, 0.011, 0.006], [0, a, 0]);
      }
    }
    this.mesh(new CylinderGeometry(0.135, 0.1, 0.2, 18), cloth, this.chest, [0, 0.1, 0], [0, 0, 0], [1, 1, 0.78]);
    this.ball(cloth, this.chest, [0, 0.2, 0], [0.14, 0.05, 0.105]);
    // A plate over the chest, edged in metal, with a stone at its centre.
    this.ball(armour, this.chest, [0, 0.13, 0.05], [0.1, 0.085, 0.065]);
    this.mesh(new TorusGeometry(0.064, 0.008, 8, 22), trim, this.chest, [0, 0.13, 0.098], [0, 0, 0], [1, 0.9, 0.5]);
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
    for (const side of this.kind === 'mage' ? [] : [-1, 1]) {
      this.ball(armour, this.hips, [side * 0.115, -0.045, 0], [0.04, 0.075, 0.07], [0, 0, side * 0.25]);
      this.ball(trim, this.hips, [side * 0.128, -0.1, 0], [0.03, 0.015, 0.055], [0, 0, side * 0.25]);
    }
    // A long panel of cloth hangs from the belt in front and behind, edged in metal at the hem.
    const flaps: [number, number][] =
      this.kind === 'mage'
        ? []
        : [
            [0.085, 0.22],
            [-0.08, 0.25],
          ];
    for (const [z, length] of flaps) {
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
    const guarded = this.kind === 'blade' || (this.kind === 'archer' && side === -1);
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
      // A third plate lower down, a row of studs along the crest, and a tassel that flies from the rim.
      this.ball(armour, upper, [side * 0.052, -0.05, 0], [0.055, 0.03, 0.065], [0, 0, side * 0.85]);
      for (let i = 0; i < 3; i++)
        this.mesh(
          new ConeGeometry(0.01, 0.035, 6),
          trim,
          upper,
          [side * (0.022 + i * 0.004), 0.082, (i - 1) * 0.045],
          [(i - 1) * 0.5, 0, -side * 0.35],
        );
      this.streamers.push(
        this.buildStreamer(
          upper,
          [side * 0.075, -0.045, 0],
          4,
          0.15,
          0.02,
          this.materials.ribbon,
          0.7,
          0.6,
          side * 0.4,
        ),
      );
    } else this.ball(cloth, upper, [0, 0.01, 0], [0.058, 0.05, 0.058]);
    const lower = new Group();
    lower.position.y = -0.11;
    this.ball(skin, lower, [0, 0, 0], [0.042, 0.042, 0.042]);
    if (this.kind === 'mage') {
      // A wide sleeve that opens toward the wrist, banded at its mouth.
      this.hanging(0.05, 0.088, 0.11, cloth, lower);
      this.mesh(new TorusGeometry(0.088, 0.008, 6, 20), trim, lower, [0, -0.108, 0], [UP, 0, 0]);
    } else {
      // A bracer from the elbow to the wrist, ridged down the back.
      this.hanging(0.046, 0.054, 0.1, armour, lower);
      this.mesh(new TorusGeometry(0.05, 0.009, 8, 16), trim, lower, [0, -0.095, 0], [UP, 0, 0]);
      this.mesh(new TorusGeometry(0.046, 0.007, 8, 16), trim, lower, [0, -0.015, 0], [UP, 0, 0]);
      this.mesh(new CylinderGeometry(0.006, 0.009, 0.075, 4), trim, lower, [0, -0.055, -0.052]);
      this.ball(gem, lower, [0, -0.05, 0.052], [0.011, 0.016, 0.007]);
    }
    // A hand closed round what it holds: four fingers and a thumb laid across them.
    this.ball(skin, lower, [0, -0.13, 0], [0.034, 0.036, 0.03]);
    for (let i = 0; i < 4; i++) this.ball(skin, lower, [(i - 1.5) * 0.016, -0.15, 0.018], [0.0095, 0.02, 0.014]);
    this.ball(skin, lower, [side * 0.03, -0.134, 0.016], [0.011, 0.022, 0.012], [0, 0, side * 0.5]);
    upper.add(lower);
    this.chest.add(upper);
    return { upper, lower };
  }

  /**
   * A broad curved sabre: the blade cut from one outline, its edge a line of light, runes down the
   * fuller, a toothed back, a round guard set with stones and a tasselled ring at the pommel.
   */
  private buildSabre(): void {
    const { blade, trim, ribbon, gem, dark } = this.materials;
    this.sword.position.set(0, -0.135, 0);
    // Turned about its own length so the broad flat of the blade, not its edge, shows from the front.
    this.sword.rotation.y = 1.25;
    this.swordArm.lower.add(this.sword);
    // Built pointing up from the fist: pommel ring, bound grip, guard, then the blade. Its edge faces +z.
    this.mesh(new TorusGeometry(0.02, 0.006, 8, 16), trim, this.sword, [0, -0.095, 0], [0, UP, 0]);
    this.mesh(new CylinderGeometry(0.014, 0.016, 0.12, 10), ribbon, this.sword, [0, -0.02, 0]);
    for (const y of [-0.06, -0.02, 0.02])
      this.mesh(new TorusGeometry(0.0165, 0.004, 6, 12), trim, this.sword, [0, y, 0], [UP, 0, 0]);
    this.mesh(new CylinderGeometry(0.05, 0.05, 0.014, 20), trim, this.sword, [0, 0.05, 0], [0, 0, 0], [0.55, 1, 1]);
    for (const z of [-0.036, 0.036]) this.ball(gem, this.sword, [0, 0.05, z], [0.012, 0.01, 0.01]);
    this.ball(trim, this.sword, [0, 0.078, 0.003], [0.012, 0.03, 0.04]);

    // The outline of the blade, drawn lying down: along its length, then across from back (-) to edge (+).
    const from = [0, 0.032] as const;
    const belly = [0.36, 0.1] as const;
    const point = [0.64, -0.005] as const;
    const outline = new Shape();
    outline.moveTo(0, -0.03);
    outline.lineTo(...from);
    outline.quadraticCurveTo(...belly, ...point);
    // The clipped point sweeps back to a spine that dips a little along its length.
    outline.lineTo(0.5, -0.055);
    outline.quadraticCurveTo(0.26, -0.02, 0, -0.03);
    const thick = 0.012;
    const steel = new ExtrudeGeometry(outline, {
      depth: thick,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 1,
      curveSegments: 16,
    });
    // Stood up: its length along y, its width along z, its thickness along x.
    steel.translate(0, 0, -thick / 2);
    steel.rotateZ(UP);
    steel.rotateY(UP);
    const base = 0.085;
    this.mesh(steel, blade, this.sword, [0, base, 0]);
    // A dark fuller up the middle: the same outline, narrower and standing a little proud.
    this.mesh(steel, dark, this.sword, [0, base + 0.03, -0.003], [0, 0, 0], [1.3, 0.7, 0.36]);
    // The edge burns: short lengths of light laid along the belly of the blade.
    for (let i = 0; i < 9; i++) {
      const t = 0.06 + (i / 8) * 0.9;
      const u = (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * belly[0] + t ** 2 * point[0];
      const v = (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * belly[1] + t ** 2 * point[1];
      const du = 2 * (1 - t) * (belly[0] - from[0]) + 2 * t * (point[0] - belly[0]);
      const dv = 2 * (1 - t) * (belly[1] - from[1]) + 2 * t * (point[1] - belly[1]);
      this.ball(gem, this.sword, [0, base + u, v + 0.003], [0.0055, 0.042, 0.0055], [Math.atan2(dv, du), 0, 0]);
    }
    // Runes down the fuller.
    for (let i = 0; i < 4; i++)
      this.ball(
        gem,
        this.sword,
        [0, base + 0.1 + i * 0.105, 0.012 - i * 0.004],
        [0.012, 0.018, 0.012],
        [0, 0, i * 0.7],
      );
    // Teeth of metal along the back, and fire trailing from it near the point.
    for (let i = 0; i < 3; i++)
      this.mesh(
        new ConeGeometry(0.014, 0.05, 6),
        trim,
        this.sword,
        [0, base + 0.12 + i * 0.11, -0.04],
        [-UP - 0.4, 0, 0],
        [0.4, 1, 1],
      );
    for (let i = 0; i < 2; i++)
      this.streamers.push(
        this.buildStreamer(this.sword, [0, base + 0.36 + i * 0.12, -0.045], 4, 0.18, 0.03, ribbon, 1.4, 1.6, 0, true),
      );
    // A long tassel from the ring at the pommel.
    for (const spread of [-0.25, 0.25])
      this.streamers.push(this.buildStreamer(this.sword, [0, -0.115, 0], 5, 0.24, 0.02, ribbon, 0.8, 0.6, spread));
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
  ): Group {
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
    return holder;
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
    this.mesh(new CylinderGeometry(0.004, 0.004, tipY * 2, 4), ribbon, bow, [0, 0, tipZ]);
    // An arrow of light lies on the string, its head a burning point.
    this.mesh(new CylinderGeometry(0.006, 0.006, 0.5, 6), gem, bow, [0, 0, tipZ - 0.22], [UP, 0, 0]);
    this.mesh(new ConeGeometry(0.022, 0.09, 6), gem, bow, [0, 0, tipZ - 0.5], [-UP, 0, 0]);
    for (let i = 0; i < 3; i++)
      this.streamers.push(
        this.buildStreamer(bow, [0, 0, tipZ - 0.45], 3, 0.14, 0.022, ribbon, 1.5, 0.9, (i - 1) * 0.9, true),
      );
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

  /** A long cape from the shoulders: panels of embroidered cloth that billow and fly, lined in the colour of the ribbons. */
  private buildCape(): void {
    const { cloth, ribbon, trim, gem } = this.materials;
    // A clasp at each shoulder and a chain between them.
    for (const side of [-1, 1]) this.ball(trim, this.chest, [side * 0.09, 0.225, -0.055], [0.024, 0.024, 0.018]);
    this.ball(gem, this.chest, [0, 0.215, -0.085], [0.016, 0.016, 0.01]);
    // The blade-master's long cape, the archer's short one, the mage's mantle over her shoulders, the healer's cloak.
    const panels = { blade: 5, archer: 3, mage: 5, healer: 5 }[this.kind];
    const length = { blade: 0.5, archer: 0.34, mage: 0.2, healer: 0.46 }[this.kind];
    for (let i = 0; i < panels; i++) {
      const across = (i / (panels - 1) - 0.5) * 2;
      this.streamers.push(
        this.buildStreamer(this.chest, [across * 0.085, 0.21, -0.085], 7, length, 0.085, cloth, 0.5, 1, across * 0.3),
      );
      // A thin lining shows at the edge of each panel.
      this.streamers.push(
        this.buildStreamer(
          this.chest,
          [across * 0.092, 0.2, -0.09],
          7,
          length * 1.04,
          0.022,
          ribbon,
          0.5,
          1,
          across * 0.32,
        ),
      );
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

    if (this.kind === 'archer') this.buildArcherHair();
    else if (this.kind === 'mage') this.buildMageHat();
    else if (this.kind === 'healer') this.buildHood();
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

    if (this.kind === 'mage' || this.kind === 'healer') return;
    // A headband with a plate at the brow; its ends fly out behind.
    this.mesh(new TorusGeometry(0.17, 0.014, 8, 26), ribbon, this.head, [0, 0.235, 0], [UP - 0.1, 0, 0], [1, 0.95, 1]);
    this.ball(trim, this.head, [0, 0.252, 0.162], [0.04, 0.026, 0.012]);
    this.ball(gem, this.head, [0, 0.252, 0.173], [0.015, 0.015, 0.008]);
    for (const side of [-1, 1])
      this.streamers.push(
        this.buildStreamer(this.head, [side * 0.03, 0.22, -0.165], 6, 0.36, 0.03, ribbon, 0.8, 1.3, side * 0.3),
      );
  }

  /** A soft fringe over the brow and a lock in front of each ear: the hair that shows under a hat or a hood. */
  private buildFringe(): void {
    const { hair, dark, ribbon } = this.materials;
    this.ball(hair, this.head, [0, 0.2, -0.02], [0.182, 0.162, 0.17]);
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
      // Long lashes at the corner of each eye, and a touch of colour on the cheek.
      this.mesh(new ConeGeometry(0.008, 0.04, 4), dark, this.head, [side * 0.102, 0.176, 0.128], [0, 0, -side * 1.1]);
      this.ball(ribbon, this.head, [side * 0.1, 0.1, 0.132], [0.024, 0.012, 0.006]);
    }
  }

  /**
   * The mage's hair, long down her back, under a tall hat: a wide brim rimmed in metal, a crown that
   * bends over backward to a burning point, a jewelled band and a star at the brow.
   */
  private buildMageHat(): void {
    const { cloth, trim, gem, hair, ribbon } = this.materials;
    this.buildFringe();
    for (const side of [-1, 0, 1])
      this.streamers.push(
        this.buildStreamer(this.head, [side * 0.09, 0.16, -0.15], 8, 0.5, 0.11, hair, 0.35, 0.5, side * 0.18),
      );
    for (const side of [-1, 1])
      this.streamers.push(
        this.buildStreamer(this.head, [side * 0.165, 0.2, 0.02], 6, 0.3, 0.045, hair, 0.4, 0.4, side * 0.12),
      );
    const tilt = -0.14;
    this.mesh(new CylinderGeometry(0.3, 0.335, 0.02, 30), cloth, this.head, [0, 0.305, -0.015], [tilt, 0, 0]);
    this.mesh(new TorusGeometry(0.33, 0.009, 6, 38), trim, this.head, [0, 0.297, -0.015], [UP + tilt, 0, 0]);
    const tip = this.curved(this.head, [0, 0.305, -0.015], [tilt - 0.1, 0, 0], 0.52, 0.168, -1.25, cloth);
    this.mesh(new TorusGeometry(0.166, 0.017, 8, 28), trim, this.head, [0, 0.34, -0.02], [UP + tilt, 0, 0]);
    for (let i = 0; i < 5; i++) {
      const a = (i / 4 - 0.5) * 2;
      this.ball(
        gem,
        this.head,
        [Math.sin(a) * 0.172, 0.343, -0.02 + Math.cos(a) * 0.172],
        [0.012, 0.012, 0.008],
        [0, a, 0],
      );
    }
    // A star at the brow, cradled in a crescent.
    this.ball(gem, this.head, [0, 0.4, 0.14], [0.028, 0.028, 0.012], [tilt, 0, 0]);
    this.mesh(
      new TorusGeometry(0.036, 0.007, 6, 16, Math.PI * 1.3),
      trim,
      this.head,
      [0, 0.4, 0.143],
      [tilt, 0, -Math.PI * 1.15],
    );
    // The point of the hat ends in a stone that trails light.
    this.ball(gem, tip, [0, 0.01, 0], [0.026, 0.026, 0.026]);
    for (const spread of [-0.3, 0.3])
      this.streamers.push(this.buildStreamer(tip, [0, 0, 0], 4, 0.16, 0.02, ribbon, 0.9, 0.8, spread));
  }

  /** The healer's hood: a deep cowl over her hair, rimmed in metal round the face, peaked behind, a leaf of light at the brow. */
  private buildHood(): void {
    const { cloth, trim, gem, hair } = this.materials;
    this.buildFringe();
    for (const side of [-1, 1])
      this.streamers.push(
        this.buildStreamer(this.head, [side * 0.15, 0.12, 0.06], 6, 0.3, 0.05, hair, 0.4, 0.4, side * 0.1),
      );
    // A shell round the head with a gap left open down the front for the face.
    const gap = 0.95;
    const shell = new SphereGeometry(1, 26, 16, UP + gap, Math.PI * 2 - gap * 2);
    this.mesh(shell, cloth, this.head, [0, 0.19, -0.012], [0, 0, 0], [0.204, 0.205, 0.2]);
    this.mesh(new TorusGeometry(0.166, 0.012, 8, 30), trim, this.head, [0, 0.19, 0.106], [0, 0, 0], [1, 1.16, 1]);
    this.mesh(new ConeGeometry(0.1, 0.24, 12), cloth, this.head, [0, 0.31, -0.17], [-1.05, 0, 0]);
    this.ball(gem, this.head, [0, 0.39, 0.1], [0.02, 0.03, 0.01]);
    for (const side of [-1, 1])
      this.ball(trim, this.head, [side * 0.03, 0.38, 0.1], [0.022, 0.01, 0.008], [0, 0, side * 0.6]);
  }

  /** A staff taller than she is in the right hand, and a spell book floating open over the left. */
  private buildStaffAndBook(): void {
    const { trim, ribbon, gem, dark, cloth } = this.materials;
    this.sword.position.set(0, -0.135, 0);
    this.swordArm.lower.add(this.sword);
    // Built pointing up from the fist, the shaft running on down through it to a shod foot.
    this.mesh(new CylinderGeometry(0.012, 0.015, 0.98, 8), dark, this.sword, [0, 0.19, 0]);
    for (const y of [-0.22, -0.06, 0.3, 0.52, 0.62])
      this.mesh(new TorusGeometry(0.0165, 0.005, 6, 12), trim, this.sword, [0, y, 0], [UP, 0, 0]);
    this.mesh(new ConeGeometry(0.016, 0.06, 8), trim, this.sword, [0, -0.325, 0], [Math.PI, 0, 0]);
    // The head: a crescent open to the sky, a burning stone held in it, a ring of light and three sparks round that.
    const top = 0.76;
    this.mesh(
      new TorusGeometry(0.09, 0.014, 8, 26, Math.PI * 1.36),
      trim,
      this.sword,
      [0, top, 0],
      [0, 0, -Math.PI * 1.18],
    );
    for (const side of [-1, 1])
      this.mesh(
        new ConeGeometry(0.014, 0.05, 6),
        trim,
        this.sword,
        [side * 0.052, top + 0.092, 0],
        [0, 0, -side * 0.5],
      );
    this.ball(gem, this.sword, [0, top + 0.012, 0], [0.05, 0.05, 0.05]);
    this.mesh(new TorusGeometry(0.068, 0.005, 6, 26), ribbon, this.sword, [0, top + 0.012, 0], [UP - 0.5, 0.3, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      this.ball(
        gem,
        this.sword,
        [Math.sin(a) * 0.12, top + 0.03 + Math.cos(a * 2) * 0.05, Math.cos(a) * 0.12],
        [0.012, 0.012, 0.012],
      );
    }
    for (const spread of [-0.4, 0.4])
      this.streamers.push(this.buildStreamer(this.sword, [0, top - 0.11, 0], 5, 0.26, 0.022, ribbon, 0.9, 0.6, spread));

    // The book hangs in the air just past her left hand, open, its pages bright.
    const book = new Group();
    book.position.set(0, -0.235, 0.02);
    book.rotation.set(0.5, 0, 0);
    this.freeArm.lower.add(book);
    for (const side of [-1, 1]) {
      const half = new Group();
      half.position.x = side * 0.004;
      half.rotation.z = side * 0.3;
      book.add(half);
      const leaf = new CylinderGeometry(0.058, 0.058, 0.012, 4);
      leaf.rotateY(Math.PI / 4);
      this.mesh(leaf, cloth, half, [side * 0.045, 0, 0], [0, 0, 0], [1.05, 1, 1.3]);
      this.mesh(leaf, this.white, half, [side * 0.044, -0.009, 0], [0, 0, 0], [0.95, 0.8, 1.2]);
      this.ball(trim, half, [side * 0.085, 0.004, 0.045], [0.008, 0.008, 0.008]);
      this.ball(trim, half, [side * 0.085, 0.004, -0.045], [0.008, 0.008, 0.008]);
    }
    this.ball(gem, book, [0, -0.04, 0], [0.016, 0.016, 0.016]);
    for (const spread of [-0.5, 0, 0.5])
      this.streamers.push(this.buildStreamer(book, [0, -0.02, 0], 3, 0.12, 0.016, ribbon, 1.2, 0.5, spread));
  }

  /** A small crossbow in the right hand, a bolt of light on it, and a mending light floating over the left. */
  private buildCrossbowAndLight(): void {
    const { trim, ribbon, gem, dark, armour } = this.materials;
    this.sword.position.set(0, -0.135, 0);
    this.swordArm.lower.add(this.sword);
    // Built pointing up from the fist: the stock, the bow across its far end swept back, the string, the bolt.
    const stock = new CylinderGeometry(0.02, 0.026, 0.3, 4);
    stock.rotateY(Math.PI / 4);
    this.mesh(stock, dark, this.sword, [0, 0.09, 0], [0, 0, 0], [1, 1, 0.75]);
    this.mesh(new TorusGeometry(0.02, 0.005, 6, 12), trim, this.sword, [0, -0.02, 0], [UP, 0, 0]);
    this.mesh(new TorusGeometry(0.022, 0.006, 6, 14), trim, this.sword, [0, 0.262, 0], [0, 0, 0]);
    const front = 0.215;
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        this.mesh(
          new CylinderGeometry(0.012 - i * 0.002, 0.015 - i * 0.002, 0.056, 8),
          armour,
          this.sword,
          [side * (0.026 + i * 0.045), front - i * 0.012 - i * i * 0.007, 0],
          [0, 0, -side * (UP - 0.2 - i * 0.28)],
        );
      this.ball(trim, this.sword, [side * 0.142, front - 0.062, 0], [0.008, 0.012, 0.008]);
    }
    this.mesh(new CylinderGeometry(0.0045, 0.0045, 0.284, 4), ribbon, this.sword, [0, front - 0.062, 0], [0, 0, UP]);
    // A plate of metal where the bow is lashed to the stock.
    this.ball(trim, this.sword, [0, front, 0.012], [0.03, 0.02, 0.012]);
    this.mesh(new CylinderGeometry(0.005, 0.005, 0.2, 6), gem, this.sword, [0, 0.22, 0.016]);
    this.mesh(new ConeGeometry(0.014, 0.05, 6), gem, this.sword, [0, 0.345, 0.016]);
    this.ball(gem, this.sword, [0, 0.12, 0.02], [0.01, 0.014, 0.008]);

    // The mending light: a bright heart in a ring, three leaves round it, wisps rising from it.
    const light = new Group();
    light.position.set(0, -0.225, 0);
    this.freeArm.lower.add(light);
    this.ball(gem, light, [0, 0, 0], [0.04, 0.04, 0.04]);
    this.mesh(new TorusGeometry(0.06, 0.006, 6, 24), ribbon, light, [0, 0, 0], [0.4, 0, 0.3]);
    this.mesh(new TorusGeometry(0.074, 0.004, 6, 24), trim, light, [0, 0, 0], [UP - 0.3, 0.5, 0]);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      this.ball(ribbon, light, [Math.sin(a) * 0.085, 0, Math.cos(a) * 0.085], [0.012, 0.03, 0.02], [0, a, 0.5]);
      this.streamers.push(
        this.buildStreamer(
          light,
          [Math.sin(a) * 0.02, 0, Math.cos(a) * 0.02],
          4,
          0.16,
          0.018,
          ribbon,
          1.3,
          0.3,
          (i - 1) * 0.5,
        ),
      );
    }
  }

  /**
   * What is worn over the rest, by everyone: an emblem and crossed straps on the chest, a pendant and
   * a pouch at the belt, and for the blade-master a skirt of small plates round the hips and back.
   */
  private buildTrappings(): void {
    const { armour, trim, ribbon, gem, dark, cloth } = this.materials;
    if (this.kind === 'mage') {
      // A wide collar of metal over the mantle, and a great stone at the throat.
      this.mesh(
        new CylinderGeometry(0.085, 0.175, 0.07, 22, 1, true),
        cloth,
        this.chest,
        [0, 0.205, 0],
        [0, 0, 0],
        [1, 1, 0.82],
      );
      this.mesh(new TorusGeometry(0.175, 0.008, 6, 30), trim, this.chest, [0, 0.17, 0], [UP, 0, 0], [1, 0.82, 1]);
      this.ball(trim, this.chest, [0, 0.2, 0.09], [0.034, 0.034, 0.014]);
      this.ball(gem, this.chest, [0, 0.2, 0.1], [0.022, 0.022, 0.012]);
      // A sash round the waist, knotted in front, its ends hanging.
      this.mesh(new TorusGeometry(0.108, 0.016, 8, 24), ribbon, this.chest, [0, 0.01, 0], [UP, 0, 0], [1, 0.8, 1]);
      for (const spread of [-0.2, 0.2])
        this.streamers.push(this.buildStreamer(this.chest, [0, 0, 0.09], 5, 0.26, 0.03, ribbon, 0.6, 0.3, spread));
    } else {
      // The emblem on the chest plate: four petals of metal round the stone.
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        this.ball(
          trim,
          this.chest,
          [Math.cos(a) * 0.042, 0.13 + Math.sin(a) * 0.042, 0.108 - Math.abs(Math.cos(a)) * 0.012],
          [0.024, 0.009, 0.006],
          [0, 0, a],
        );
      }
      // Straps crossed over the chest, studded.
      for (const side of [-1, 1]) {
        this.mesh(
          new CylinderGeometry(0.011, 0.011, 0.25, 6),
          dark,
          this.chest,
          [side * 0.05, 0.115, 0.074],
          [0, 0, side * 0.45],
          [1, 1, 0.4],
        );
        for (const along of [-0.08, 0.085])
          this.ball(trim, this.chest, [side * (0.05 - along * 0.45), 0.115 + along, 0.083], [0.008, 0.008, 0.005]);
      }
    }
    // A pendant of stone on a cord at the left hip, and a buttoned pouch at the right.
    this.ball(gem, this.hips, [-0.092, -0.035, 0.072], [0.014, 0.02, 0.008]);
    this.streamers.push(this.buildStreamer(this.hips, [-0.092, -0.05, 0.072], 4, 0.14, 0.02, ribbon, 0.7, 0.2, -0.15));
    this.ball(dark, this.hips, [0.1, -0.025, 0.062], [0.03, 0.032, 0.022]);
    this.ball(trim, this.hips, [0.1, -0.02, 0.083], [0.008, 0.008, 0.005]);

    if (this.kind === 'blade') {
      // A skirt of small plates round the sides and back, each tipped in metal.
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6 - 0.5) * 3.5;
        const x = Math.sin(a) * 0.122;
        const z = Math.cos(a) * 0.096;
        this.ball(armour, this.hips, [x, -0.07, z], [0.036, 0.07, 0.013], [0, a, 0]);
        this.ball(trim, this.hips, [x * 1.02, -0.135, z * 1.02], [0.02, 0.012, 0.01], [0, a, 0]);
      }
    }
    if (this.kind === 'healer') {
      // A satchel on a strap across the body, and vials of light along the belt.
      this.mesh(
        new CylinderGeometry(0.012, 0.012, 0.3, 6),
        dark,
        this.chest,
        [0.01, 0.11, 0.08],
        [0, 0, 0.75],
        [1, 1, 0.4],
      );
      this.ball(dark, this.hips, [-0.125, -0.03, 0.0], [0.04, 0.05, 0.05]);
      this.ball(trim, this.hips, [-0.15, -0.01, 0.0], [0.02, 0.03, 0.045], [0, 0, 0.3]);
      this.ball(gem, this.hips, [-0.166, -0.02, 0.0], [0.008, 0.012, 0.012]);
      for (let i = 0; i < 3; i++) {
        this.mesh(new CylinderGeometry(0.009, 0.009, 0.036, 8), gem, this.hips, [
          0.03 + i * 0.03,
          -0.03,
          0.088 - i * 0.008,
        ]);
        this.ball(trim, this.hips, [0.03 + i * 0.03, -0.008, 0.088 - i * 0.008], [0.007, 0.006, 0.007]);
      }
    }
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
    this.hips.position.y = HIP_HEIGHT + (breath + Math.abs(Math.sin(step)) * 0.03 * walk + pose.lift) * alive;
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
    this.sword.rotation.x = pose.swordTilt * (1 - run) + run * RUN_TILT[this.kind];
    // Only the blade-master's left hand is empty: the others carry something in it and do not pump that arm.
    const carry = this.kind === 'blade' ? 1 : 0.25;
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
    const rest = REST_OF[this.kind];
    const actions = ACTIONS_OF[this.kind];
    let pose = rest;
    if (this.action && clock < this.action.until && !state.dead) {
      const progress = (clock - this.action.from) / (this.action.until - this.action.from);
      pose = actions[this.action.kind]?.(Math.max(0, progress)) ?? rest;
    } else this.action = null;
    this.applyPose(pose);
  }
}
