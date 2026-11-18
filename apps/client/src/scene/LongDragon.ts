import {
  AdditiveBlending,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import type { BufferGeometry } from 'three';
import type { ActorAction } from '@/lib/session';
import { skinned } from './scaleSkin';

/** The colours of a long dragon, by part. */
export interface LongDragonColours {
  scale: string;
  /** The plates along the underside. */
  belly: string;
  /** Mane, back fin, whiskers and the tuft of the tail: the parts that look like flame. */
  mane: string;
  /** Antlers and claws. */
  horn: string;
  /** Eyes, the fire between the scales, and the pearl. */
  glow: string;
  /** How thick the body is against the standard build; above 1 is a heavier, shorter-looking dragon. */
  girth?: number;
  /** What runs along the back: a fin of flame (the default), or a row of hard spikes in the colour of the horns. */
  crest?: 'flame' | 'spikes';
}

/**
 * A dragon of the eastern kind, built in code with no model file: no wings, a long scaled body that
 * swims through the air in waves, a maned head with antlers and long whiskers, four small clawed
 * legs, and a burning pearl it carries before it. It moves by bending its body every frame. Used
 * the same way as an Actor.
 *
 * Built in its own small units, facing +z, its head about 1.3 above the ground; `height` rescales it.
 */

const UP = Math.PI / 2;
const DEG = Math.PI / 180;
const BALL = new SphereGeometry(1, 18, 12);
const REST_HEIGHT = 1.5;
const SEGMENTS = 30;
const SEGMENT_LENGTH = 0.105;
/** The segments the front and hind legs hang from. */
const LEG_SEGMENTS = [6, 17];
const DEATH_SECONDS = 1;

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const LONG_DRAGON_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.55 },
  Q: { clip: 'Q', seconds: 0.8 },
  W: { clip: 'W', seconds: 0.7 },
  E: { clip: 'E', seconds: 0.8 },
  R: { clip: 'R', seconds: 1.1 },
};

/** What the dragon is doing on top of swimming in place, each 0 to 1. */
interface Pose {
  /** The head darts forward. */
  strike: number;
  /** The head and neck rear up and back. */
  rear: number;
  jaw: number;
  /** The body winds itself into tighter coils. */
  coil: number;
  /** The pearl and the fire between the scales blaze. */
  flare: number;
}

const calm = (): Pose => ({ strike: 0, rear: 0, jaw: 0, coil: 0, flare: 0 });
const arc = (p: number): number => Math.sin(Math.PI * Math.min(1, Math.max(0, p)));

const ACTIONS: Record<string, (p: number, pose: Pose) => void> = {
  // A snap of the jaws.
  attack: (p, pose) => {
    pose.strike = arc(p);
    pose.jaw = arc(p);
  },
  // Fire breathed in a long stream: the head draws back, then pours it out.
  Q: (p, pose) => {
    pose.rear = arc(p * 2.2) * 0.7;
    pose.strike = p < 0.3 ? 0 : arc((p - 0.3) / 0.7) * 0.7;
    pose.jaw = p < 0.25 ? 0.2 : arc((p - 0.25) / 0.75);
    pose.flare = pose.jaw * 0.6;
  },
  // A ball of fire tossed from the pearl with a flick of the head.
  W: (p, pose) => {
    pose.rear = arc(p * 1.5);
    pose.jaw = arc(p) * 0.6;
    pose.flare = arc(p);
  },
  // The whole body whips round in a tight coil and throws the air outward.
  E: (p, pose) => {
    pose.coil = arc(p);
    pose.rear = arc(p) * 0.4;
  },
  // It rises high and calls the fire down.
  R: (p, pose) => {
    pose.rear = arc(p);
    pose.coil = arc(p) * 0.5;
    pose.jaw = arc(p);
    pose.flare = arc(p);
  },
};

/** A whisker, a beard or a wisp of flame: thin pieces, each hinged to the last. */
interface Wisp {
  pieces: Group[];
  sway: number;
  phase: number;
}

export class LongDragon {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly segments: Group[] = [];
  private readonly head = new Group();
  private readonly jaw = new Group();
  private readonly pearl = new Group();
  private readonly legs: { hip: Group; knee: Group; segment: number; side: number }[] = [];
  private readonly wisps: Wisp[] = [];
  private readonly materials: Record<'scale' | 'belly' | 'mane' | 'horn' | 'glow' | 'dark', MeshStandardMaterial>;
  private readonly eyes: MeshBasicMaterial;
  private readonly halo: MeshBasicMaterial;
  private readonly castShadow: boolean;
  private readonly thick: number;
  private readonly spiked: boolean;

  private time = Math.random() * 10;
  private travel = 0;
  private walk = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;

  constructor(colours: LongDragonColours, height: number, castShadow: boolean) {
    this.castShadow = castShadow;
    this.thick = colours.girth ?? 1;
    this.spiked = colours.crest === 'spikes';
    const make = (color: string, extra: MeshStandardMaterialParameters = {}) =>
      new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.15, ...extra });
    this.materials = {
      scale: make(colours.scale, skinned(colours.glow, 2, 0.5)),
      belly: make(colours.belly, { roughness: 0.4, metalness: 0.4 }),
      mane: make(colours.mane, { emissive: colours.mane, emissiveIntensity: 0.7, roughness: 0.5 }),
      horn: make(colours.horn, { roughness: 0.35, metalness: 0.5 }),
      glow: make(colours.glow, { emissive: colours.glow, emissiveIntensity: 1.6 }),
      dark: make('#16090a', { roughness: 0.9, metalness: 0 }),
    };
    this.eyes = new MeshBasicMaterial({ color: colours.glow });
    this.halo = new MeshBasicMaterial({
      color: colours.glow,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    this.model.scale.setScalar(height / REST_HEIGHT);
    this.root.add(this.model);
    this.buildBody();
    this.buildHead();
    this.buildPearl();
    this.applyPose(calm());
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
    const pieces = 6;
    const step = length / pieces;
    let holder = new Group();
    holder.position.set(...position);
    holder.rotation.set(...rotation);
    parent.add(holder);
    for (let i = 0; i < pieces; i++) {
      const r1 = radius * (1 - i / pieces);
      const r2 = Math.max(0.002, radius * (1 - (i + 1) / pieces));
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

  /** A thin strand hanging from a point, to be waved about. */
  private wisp(
    parent: Group,
    position: [number, number, number],
    rotation: [number, number, number],
    count: number,
    length: number,
    width: number,
    material: MeshStandardMaterial,
    sway: number,
  ): void {
    const pieces: Group[] = [];
    const step = length / count;
    const base = new Group();
    base.position.set(...position);
    base.rotation.set(...rotation);
    parent.add(base);
    let holder = new Group();
    base.add(holder);
    for (let i = 0; i < count; i++) {
      const taper = 1 - (i / count) * 0.8;
      const strand = new CylinderGeometry((width * taper * 0.7) / 2, (width * taper) / 2, step * 1.1, 6);
      strand.translate(0, step / 2, 0);
      this.mesh(strand, material, holder);
      pieces.push(holder);
      const next = new Group();
      next.position.y = step;
      holder.add(next);
      holder = next;
    }
    this.wisps.push({ pieces, sway, phase: Math.random() * 6 });
  }

  /** How thick the body is at segment `i`: a slim neck, a deep chest, then a long taper to the tail. */
  private girth(i: number): number {
    const t = i / (SEGMENTS - 1);
    const chest = 0.062 + 0.04 * Math.sin(Math.min(1, t / 0.22) * UP);
    return chest * (1 - Math.max(0, (t - 0.3) / 0.7) ** 1.3 * 0.86) * this.thick;
  }

  private buildBody(): void {
    const { scale, belly, mane, horn, glow } = this.materials;
    for (let i = 0; i < SEGMENTS; i++) {
      const r1 = this.girth(i);
      const r2 = this.girth(Math.min(SEGMENTS - 1, i + 1));
      const segment = new Group();
      segment.rotation.order = 'YXZ';
      const tube = new CylinderGeometry(r2, r1, SEGMENT_LENGTH, 14, 1);
      tube.translate(0, SEGMENT_LENGTH / 2, 0);
      this.mesh(tube, scale, segment);
      this.ball(scale, segment, [0, 0, 0], [r1, r1, r1]);
      // Local -z is the back, +z the belly. A broad plate underneath, fire showing in the gap before the next.
      this.ball(belly, segment, [0, SEGMENT_LENGTH * 0.55, r1 * 0.62], [r1 * 0.8, SEGMENT_LENGTH * 0.42, r1 * 0.5]);
      this.ball(glow, segment, [0, SEGMENT_LENGTH * 0.04, r1 * 0.6], [r1 * 0.55, SEGMENT_LENGTH * 0.1, r1 * 0.4]);
      // A fin of flame along the back, tallest over the shoulders.
      const tall = r1 * (2.2 + Math.sin(i * 1.7) * 0.5);
      this.mesh(
        new ConeGeometry(r1 * (this.spiked ? 0.36 : 0.5), tall * (this.spiked ? 0.8 : 1), 6),
        this.spiked ? horn : mane,
        segment,
        [0, SEGMENT_LENGTH * 0.4, -r1 * 0.9 - tall * 0.35],
        [-UP + 0.75, 0, 0],
        [this.spiked ? 0.8 : 0.35, 1, 1],
      );
      this.model.add(segment);
      this.segments.push(segment);
    }
    // Four short legs, each with a clawed foot.
    for (const index of LEG_SEGMENTS)
      for (const side of [-1, 1]) {
        const r = this.girth(index);
        const hip = new Group();
        hip.position.set(side * r * 0.85, SEGMENT_LENGTH * 0.5, r * 0.35);
        this.ball(scale, hip, [0, 0, 0], [r * 0.5, r * 0.5, r * 0.65]);
        const thigh = new CylinderGeometry(r * 0.3, r * 0.42, 0.14, 10);
        thigh.translate(0, -0.07, 0);
        this.mesh(thigh, scale, hip);
        const knee = new Group();
        knee.position.y = -0.14;
        const shin = new CylinderGeometry(r * 0.2, r * 0.3, 0.12, 10);
        shin.translate(0, -0.06, 0);
        this.mesh(shin, scale, knee);
        this.wispless(knee, mane, r);
        const foot = new Group();
        foot.position.y = -0.12;
        this.ball(scale, foot, [0, 0, 0], [r * 0.34, r * 0.25, r * 0.4]);
        for (const toe of [-1, 0, 1])
          this.curved(foot, [toe * r * 0.25, 0, r * 0.2], [UP + 0.2, 0, -toe * 0.5], 0.09, 0.014, 1.5, horn);
        this.curved(foot, [0, 0, -r * 0.2], [-UP - 0.2, 0, 0], 0.06, 0.012, -1.4, horn);
        knee.add(foot);
        hip.add(knee);
        this.segments[index].add(hip);
        this.legs.push({ hip, knee, segment: index, side });
      }
    // The tail ends in a plume of flame.
    const tip = this.segments[SEGMENTS - 1];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      this.wisp(tip, [0, SEGMENT_LENGTH, 0], [Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45], 5, 0.32, 0.05, mane, 1.2);
    }
  }

  /** A tuft of flame behind the elbow of a leg. */
  private wispless(knee: Group, mane: MeshStandardMaterial, r: number): void {
    for (const a of [-0.4, 0, 0.4])
      this.mesh(new ConeGeometry(r * 0.16, 0.13, 5), mane, knee, [0, 0, -r * 0.2], [-UP - 0.5, 0, a], [0.5, 1, 1]);
  }

  /** The head, facing +z: a long muzzle, antlers, a mane of flame, whiskers and a beard. */
  private buildHead(): void {
    const { scale, belly, mane, horn, dark } = this.materials;
    const head = this.head;
    head.scale.setScalar(0.62 * (0.7 + 0.3 * this.thick));
    this.model.add(head);
    const along: [number, number, number] = [UP, 0, 0];
    // Skull, heavy brow, and a long muzzle swelling into a broad nose.
    this.ball(scale, head, [0, 0.04, 0], [0.2, 0.17, 0.23]);
    this.mesh(new CylinderGeometry(0.1, 0.17, 0.42, 14), scale, head, [0, 0.01, 0.33], along, [1, 1, 0.78]);
    this.ball(scale, head, [0, 0.025, 0.56], [0.125, 0.09, 0.11]);
    this.ball(belly, head, [0, 0.085, 0.3], [0.05, 0.03, 0.22]);
    for (const side of [-1, 1]) {
      this.ball(dark, head, [side * 0.055, 0.05, 0.655], [0.02, 0.016, 0.02]);
      this.ball(scale, head, [side * 0.13, 0.15, 0.12], [0.085, 0.045, 0.13], [0.2, 0, side * 0.45]);
      this.ball(this.eyes, head, [side * 0.15, 0.085, 0.17], [0.042, 0.036, 0.05]);
      this.ball(dark, head, [side * 0.186, 0.085, 0.185], [0.008, 0.032, 0.016]);
      // An antler: a long beam swept back with two tines branching up from it.
      const beam = this.curved(head, [side * 0.1, 0.17, -0.02], [-0.85, 0, -side * 0.45], 0.62, 0.04, 0.5, horn);
      this.curved(head, [side * 0.16, 0.34, -0.2], [-0.1, 0, -side * 0.3], 0.26, 0.026, -0.6, horn);
      this.curved(head, [side * 0.21, 0.46, -0.36], [0.1, 0, -side * 0.55], 0.2, 0.022, -0.5, horn);
      void beam;
      // An ear, a fan of flame behind the jaw, and one long whisker from beside the nose.
      this.mesh(
        new ConeGeometry(0.045, 0.2, 6),
        scale,
        head,
        [side * 0.2, 0.1, -0.08],
        [-0.9, 0, -side * 1.1],
        [1, 1, 0.4],
      );
      for (let i = 0; i < 4; i++)
        this.mesh(
          new ConeGeometry(0.04, 0.3 - i * 0.03, 5),
          mane,
          head,
          [side * 0.19, 0.04 - i * 0.045, -0.1],
          [-1.25 - i * 0.12, 0, -side * (0.9 - i * 0.12)],
          [0.5, 1, 1],
        );
      this.wisp(head, [side * 0.11, 0.0, 0.56], [0.9, 0, -side * 1.15], 9, 0.95, 0.03, mane, 1);
      // Fangs.
      this.mesh(new ConeGeometry(0.022, 0.12, 8), belly, head, [side * 0.085, -0.09, 0.5], [Math.PI, 0, 0]);
      for (let i = 0; i < 4; i++)
        this.mesh(
          new ConeGeometry(0.014, 0.06, 6),
          belly,
          head,
          [side * (0.12 - i * 0.004), -0.085, 0.2 + i * 0.075],
          [Math.PI, 0, 0],
        );
    }
    // The mane: flame swept back over the skull and down the neck.
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 5; i++) {
        const a = (i / 4 - 0.5) * 2.2;
        this.mesh(
          new ConeGeometry(0.05, 0.42 - row * 0.05, 5),
          mane,
          head,
          [Math.sin(a) * 0.17, 0.12 + Math.cos(a) * 0.1 - row * 0.03, -0.14 - row * 0.12],
          [-1.2 - row * 0.12, 0, -Math.sin(a) * 0.8],
          [0.5, 1, 1],
        );
      }
    // A stone in the brow.
    this.mesh(
      new OctahedronGeometry(1, 0),
      this.materials.glow,
      head,
      [0, 0.17, 0.16],
      [0.4, 0, 0],
      [0.035, 0.025, 0.06],
    );

    this.jaw.position.set(0, -0.07, -0.06);
    this.mesh(new CylinderGeometry(0.075, 0.15, 0.66, 12), scale, this.jaw, [0, -0.02, 0.36], along, [1, 1, 0.42]);
    this.ball(belly, this.jaw, [0, -0.05, 0.34], [0.1, 0.025, 0.3]);
    this.ball(this.materials.glow, this.jaw, [0, 0.03, 0.14], [0.08, 0.04, 0.13]);
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        this.mesh(new ConeGeometry(0.013, 0.055, 6), belly, this.jaw, [
          side * (0.1 - i * 0.012),
          0.035,
          0.34 + i * 0.075,
        ]);
    // A beard of flame under the chin.
    for (const x of [-0.04, 0, 0.04]) this.wisp(this.jaw, [x, -0.06, 0.5], [2.6, 0, x * 4], 5, 0.36, 0.045, mane, 0.8);
    head.add(this.jaw);
  }

  /** The pearl the dragon carries: a burning ball in a halo, turning slowly before its face. */
  private buildPearl(): void {
    this.ball(this.materials.glow, this.pearl, [0, 0, 0], [0.085, 0.085, 0.085]);
    this.ball(this.eyes, this.pearl, [0, 0, 0], [0.055, 0.055, 0.055]);
    this.ball(this.halo, this.pearl, [0, 0, 0], [0.17, 0.17, 0.17]);
    for (let i = 0; i < 3; i++) {
      const ring = this.mesh(
        new TorusGeometry(0.13, 0.008, 6, 26),
        this.materials.mane,
        this.pearl,
        [0, 0, 0],
        [i * 1.05, i * 0.8, 0],
      );
      ring.castShadow = false;
    }
    // Tongues of flame rising off it.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      this.wisp(
        this.pearl,
        [Math.sin(a) * 0.05, 0.05, Math.cos(a) * 0.05],
        [Math.cos(a) * 0.4, 0, -Math.sin(a) * 0.4],
        4,
        0.22,
        0.04,
        this.materials.mane,
        1.4,
      );
    }
    this.model.add(this.pearl);
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
    // The wave that runs down the body: faster when it travels, wound tighter when it coils.
    const run = this.travel;
    const wide = (50 + pose.coil * 50 - walk * 14) * DEG * alive;
    const high = (16 + pose.coil * 8) * DEG * alive;

    // The head leads: it hangs in the air, bobbing, and the body trails back and down from it.
    const hover = 1.28 + Math.sin(t * 1.4) * 0.05 + pose.rear * 0.3 - walk * 0.18;
    let x = Math.sin(t * 0.7) * 0.05 * alive;
    let y = hover * alive + 0.14;
    let z = 0.55 + pose.strike * 0.4 - pose.rear * 0.22;
    const nod = (0.12 - pose.rear * 0.55 + pose.strike * 0.2 + Math.sin(t * 1.1) * 0.05) * alive;
    this.head.position.set(x, y, z);
    this.head.rotation.set(nod, Math.sin(t * 0.6) * 0.14 * alive, Math.sin(t * 0.9) * 0.05 * alive);
    this.jaw.rotation.x = 0.1 + pose.jaw * 0.7 + (Math.sin(t * 2.1) * 0.04 + 0.04) * alive + dying * 0.3;

    for (let i = 0; i < SEGMENTS; i++) {
      const f = i / (SEGMENTS - 1);
      // The neck drops away behind the head, then the body levels out and winds from side to side.
      const neck = Math.max(0, 1 - f / 0.2);
      const settle = Math.max(0, 1 - Math.abs(f - 0.38) / 0.2);
      const pitch =
        (-(62 + pose.rear * 22) * DEG * neck ** 1.2 +
          20 * DEG * settle +
          Math.sin(f * 9 - run * 1.3 + 1) * high * (1 - neck)) *
          alive -
        // Dying, every part of it sinks to the ground.
        dying * Math.min(0.9, y * 0.9);
      const yaw =
        Math.PI +
        Math.sin(f * 7.2 - run) * wide * Math.min(1, f / 0.16 + 0.15) +
        Math.sin(f * 3 + t * 0.4) * 0.2 * alive;
      const segment = this.segments[i];
      segment.position.set(x, y, z);
      segment.rotation.set(UP - pitch, yaw, 0);
      x += Math.sin(yaw) * Math.cos(pitch) * SEGMENT_LENGTH;
      y = Math.max(0.05, y + Math.sin(pitch) * SEGMENT_LENGTH);
      z += Math.cos(yaw) * Math.cos(pitch) * SEGMENT_LENGTH;
    }

    // The legs paddle as it swims, and reach forward when it strikes.
    for (const leg of this.legs) {
      const beat = Math.sin(run * 1.6 + leg.segment + (leg.side > 0 ? 0 : Math.PI));
      leg.hip.rotation.set(-0.5 + beat * (0.25 + walk * 0.35) - pose.strike * 0.6, 0, leg.side * 0.75);
      leg.knee.rotation.x = 0.9 + beat * 0.3;
    }

    // The pearl floats before the face, circling a little, and blazes when the dragon calls on it.
    const flare = pose.flare * alive;
    this.pearl.position.set(
      Math.sin(t * 1.3) * 0.12,
      hover * alive - 0.1 + Math.cos(t * 1.7) * 0.06 + flare * 0.25,
      1.05 + pose.strike * 0.35 + flare * 0.15,
    );
    this.pearl.rotation.set(t * 0.9, t * 1.4, 0);
    this.pearl.scale.setScalar((1 + flare * 0.7) * (alive * 0.95 + 0.05));
    this.halo.opacity = (0.3 + Math.sin(t * 5) * 0.08 + flare * 0.4) * alive;
    this.materials.glow.emissiveIntensity = (1.5 + Math.sin(t * 3) * 0.3 + flare * 3) * alive + 0.1;
    this.materials.mane.emissiveIntensity = (0.65 + Math.sin(t * 4.3) * 0.15 + flare * 1.2) * alive + 0.05;
    this.materials.scale.emissiveIntensity = (1.1 + Math.sin(t * 1.7) * 0.3 + flare * 2.5) * alive;
    this.eyes.color.copy(this.materials.glow.emissive).multiplyScalar(alive * 0.85 + 0.15);

    // Whiskers, beard and flame are never still.
    for (const wisp of this.wisps) {
      const count = wisp.pieces.length;
      wisp.pieces.forEach((piece, i) => {
        const f = (i + 1) / count;
        piece.rotation.x =
          Math.sin(t * 3.2 + wisp.phase - i * 0.8) * 0.22 * wisp.sway * f + (i === 0 ? 0 : -0.06 - walk * 0.1);
        piece.rotation.z = Math.cos(t * 2.3 + wisp.phase - i * 0.6) * 0.18 * wisp.sway * f;
      });
    }
  }

  /** Bend the body for this frame: swim in place, travel, act or die. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 6);

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = LONG_DRAGON_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead)
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
    }
    const pose = calm();
    if (this.action && clock < this.action.until && !state.dead) {
      const progress = (clock - this.action.from) / (this.action.until - this.action.from);
      ACTIONS[this.action.kind]?.(Math.max(0, progress), pose);
    } else this.action = null;
    // The wave runs down the body all the time, quicker when it travels or coils.
    this.travel += delta * (2 + this.walk * 5 + pose.coil * 7) * (1 - this.death);
    this.applyPose(pose);
  }
}
