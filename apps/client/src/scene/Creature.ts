import {
  BoxGeometry,
  type BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import type { ActorAction } from '@/lib/session';
import { piece, prop } from './egypt';

/**
 * What walks the battlefield besides the heroes, in the look of ancient Egypt. A mummy with a sickle
 * sword and a jackal-headed guard with a staff are the two lane soldiers; a scarab and a scorpion
 * live in the wild; the sphinx is the Ancient Beast.
 */
export type CreatureKind = 'mummy' | 'jackal' | 'scarab' | 'scorpion' | 'sphinx';

/**
 * A lesser unit built in code, with no model file: a few painted parts on joints that turn each
 * frame. Used the same way as an Actor. Each is built at its real size, facing +z; `scale` resizes it.
 */

const LINEN = '#e9dfc4';
const LINEN_DARK = '#b9aa84';
const GOLD = '#f2c94c';
const GOLD_DARK = '#b8842a';
const JACKAL = '#23232b';
const BRONZE = '#c98a4a';
const SHELL = '#1f6f74';
const SHELL_DARK = '#124348';
const CHITIN = '#7a2f1c';
const CHITIN_DARK = '#4a1a10';
const LION = '#d6a85a';
const LION_DARK = '#a87c3c';
const LAPIS = '#2f5fc4';
const EYE = '#fff3b0';

type Triple = [number, number, number];
const UP = Math.PI / 2;
const DEATH_SECONDS = 0.7;
const ATTACK_SECONDS = 0.4;

const box = (w: number, h: number, d: number) => new BoxGeometry(w, h, d);
const tube = (top: number, bottom: number, h: number, sides = 6) => new CylinderGeometry(top, bottom, h, sides);
const cone = (r: number, h: number, sides = 5) => new ConeGeometry(r, h, sides);
const ball = (r: number) => new SphereGeometry(r, 9, 6);

/** One material for every creature: each part carries its colours on its vertices. */
let shared: MeshStandardMaterial | null = null;
const material = (): MeshStandardMaterial =>
  (shared ??= new MeshStandardMaterial({ vertexColors: true, roughness: 0.8, flatShading: true }));

const smooth = (p: number): number => {
  const c = Math.min(1, Math.max(0, p));
  return c * c * (3 - 2 * c);
};

export class Creature {
  readonly root = new Group();
  private readonly model = new Group();
  private readonly body = new Group();
  /** Limbs that swing in step: odd ones opposite to even ones. */
  private readonly limbs: Group[] = [];
  /** What it strikes with: an arm, a pair of claws. */
  private readonly weapons: Group[] = [];
  private readonly tail = new Group();
  private readonly height: number;
  private readonly castShadow: boolean;

  private time = Math.random() * 10;
  private walk = 0;
  private stride = 0;
  private death = 0;
  private seenActionAt = -1;
  private strikeFrom = -10;

  constructor(
    private readonly kind: CreatureKind,
    color: string,
    scale: number,
    castShadow: boolean,
  ) {
    this.castShadow = castShadow;
    this.model.scale.setScalar(scale);
    this.root.add(this.model);
    this.model.add(this.body);
    if (kind === 'mummy' || kind === 'jackal') this.height = this.buildSoldier(kind === 'jackal', color);
    else if (kind === 'scarab') this.height = this.buildScarab();
    else if (kind === 'scorpion') this.height = this.buildScorpion();
    else this.height = this.buildSphinx(color);
    this.body.position.y = this.height;
  }

  // ---- building ----

  private part(pieces: BufferGeometry[], parent: Group, position: Triple = [0, 0, 0]): Group {
    const joint = new Group();
    joint.position.set(...position);
    const mesh = new Mesh(prop(pieces), material());
    mesh.castShadow = this.castShadow;
    joint.add(mesh);
    parent.add(joint);
    return joint;
  }

  /** A lane soldier on two legs: the wrapped dead with a sickle sword, or a jackal-headed guard with a staff. Returns hip height. */
  private buildSoldier(jackal: boolean, team: string): number {
    const cloth = jackal ? BRONZE : LINEN;
    const dark = jackal ? JACKAL : LINEN_DARK;
    const torso: BufferGeometry[] = [
      piece(box(0.4, 0.44, 0.24), cloth, [0, 0.24, 0]),
      piece(box(0.42, 0.07, 0.26), team, [0, 0.06, 0]),
      piece(box(0.44, 0.06, 0.27), jackal ? GOLD : dark, [0, 0.42, 0]),
    ];
    if (jackal) {
      // A black jackal's head: long muzzle, tall ears, a gold collar and a striped headcloth.
      torso.push(
        piece(box(0.2, 0.2, 0.2), JACKAL, [0, 0.6, 0]),
        piece(box(0.1, 0.09, 0.2), JACKAL, [0, 0.57, 0.17]),
        piece(cone(0.045, 0.2, 4), JACKAL, [-0.07, 0.8, -0.02]),
        piece(cone(0.045, 0.2, 4), JACKAL, [0.07, 0.8, -0.02]),
        piece(box(0.26, 0.22, 0.06), LAPIS, [0, 0.58, -0.12]),
        piece(box(0.03, 0.03, 0.02), EYE, [-0.06, 0.63, 0.105]),
        piece(box(0.03, 0.03, 0.02), EYE, [0.06, 0.63, 0.105]),
        piece(box(0.3, 0.16, 0.02), team, [0, 0, 0.13]),
      );
    } else {
      // A wrapped head with two burning eyes, loose ends of linen trailing.
      torso.push(
        piece(ball(0.15), LINEN, [0, 0.62, 0]),
        piece(box(0.31, 0.04, 0.31), LINEN_DARK, [0, 0.66, 0], [0.2, 0, 0.15]),
        piece(box(0.31, 0.04, 0.31), LINEN_DARK, [0, 0.57, 0], [-0.15, 0, -0.2]),
        piece(box(0.04, 0.035, 0.02), EYE, [-0.055, 0.63, 0.14]),
        piece(box(0.04, 0.035, 0.02), EYE, [0.055, 0.63, 0.14]),
        piece(box(0.41, 0.04, 0.25), LINEN_DARK, [0, 0.3, 0], [0, 0, 0.25]),
        piece(box(0.06, 0.3, 0.02), LINEN_DARK, [-0.16, 0.02, -0.13], [0.2, 0, 0.1]),
      );
    }
    this.part(torso, this.body);
    for (const side of [-1, 1]) {
      this.limbs.push(
        this.part(
          [
            piece(box(0.15, 0.62, 0.16), jackal ? JACKAL : LINEN, [0, -0.31, 0]),
            piece(box(0.17, 0.08, 0.24), dark, [0, -0.6, 0.04]),
          ],
          this.body,
          [side * 0.1, 0.02, 0],
        ),
      );
    }
    const arm = (side: number, pieces: BufferGeometry[]) =>
      this.part([piece(box(0.11, 0.46, 0.11), jackal ? JACKAL : LINEN, [0, -0.2, 0]), ...pieces], this.body, [
        side * 0.26,
        0.4,
        0,
      ]);
    // The left arm hangs and swings; the right carries the weapon and strikes with it.
    this.limbs.push(arm(-1, [piece(box(0.12, 0.05, 0.12), jackal ? GOLD : LINEN_DARK, [0, -0.3, 0])]));
    const weapon = jackal
      ? [
          piece(tube(0.014, 0.014, 0.95, 5), GOLD_DARK, [0, -0.3, 0.2], [UP - 0.25, 0, 0]),
          piece(ball(0.05), team, [0, -0.18, 0.66]),
          piece(cone(0.05, 0.12, 4), GOLD, [0, -0.15, 0.76], [UP - 0.25, 0, 0]),
        ]
      : [
          piece(tube(0.016, 0.016, 0.24, 5), GOLD_DARK, [0, -0.42, 0.1], [UP, 0, 0]),
          piece(box(0.025, 0.07, 0.34), '#dfe6ee', [0, -0.42, 0.36]),
          piece(box(0.025, 0.07, 0.2), '#dfe6ee', [0, -0.34, 0.56], [-0.8, 0, 0]),
        ];
    this.weapons.push(arm(1, weapon));
    return 0.66;
  }

  /** A scarab: a domed shell rimmed in gold, a horned head, six quick legs. Returns how high it rides. */
  private buildScarab(): number {
    this.part(
      [
        piece(ball(0.5), SHELL, [0, 0.12, -0.05], [0, 0, 0], [1, 0.62, 1.25]),
        piece(box(0.02, 0.3, 1.1), SHELL_DARK, [0, 0.3, -0.05]),
        piece(ball(0.5), GOLD_DARK, [0, 0.04, -0.05], [0, 0, 0], [1.04, 0.3, 1.29]),
        piece(ball(0.24), SHELL_DARK, [0, 0.1, 0.62], [0, 0, 0], [1.1, 0.7, 1]),
        piece(cone(0.05, 0.3, 4), GOLD, [0, 0.2, 0.86], [UP - 0.5, 0, 0]),
        piece(box(0.05, 0.05, 0.03), EYE, [-0.14, 0.16, 0.8]),
        piece(box(0.05, 0.05, 0.03), EYE, [0.14, 0.16, 0.8]),
        piece(ball(0.1), GOLD, [0, 0.42, -0.05], [0, 0, 0], [1, 0.4, 1]),
      ],
      this.body,
    );
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++)
        this.limbs.push(
          this.part(
            [
              piece(box(0.4, 0.05, 0.06), SHELL_DARK, [side * 0.2, 0, 0], [0, 0, side * -0.5]),
              piece(box(0.05, 0.26, 0.05), SHELL_DARK, [side * 0.4, -0.2, 0]),
            ],
            this.body,
            [side * 0.4, 0.05, 0.35 - i * 0.38],
          ),
        );
    return 0.32;
  }

  /** A scorpion: plated back, two great claws, a tail curled over it with a gold sting. Returns how high it rides. */
  private buildScorpion(): number {
    const back: BufferGeometry[] = [];
    for (let i = 0; i < 4; i++)
      back.push(
        piece(
          ball(0.5),
          i % 2 ? CHITIN_DARK : CHITIN,
          [0, 0.08, 0.5 - i * 0.42],
          [0, 0, 0],
          [1.05 - i * 0.12, 0.5, 0.62],
        ),
      );
    back.push(
      piece(box(0.07, 0.07, 0.04), EYE, [-0.16, 0.22, 0.78]),
      piece(box(0.07, 0.07, 0.04), EYE, [0.16, 0.22, 0.78]),
      piece(box(0.5, 0.06, 0.06), GOLD_DARK, [0, 0.32, 0.5]),
    );
    this.part(back, this.body);
    for (const side of [-1, 1]) {
      this.weapons.push(
        this.part(
          [
            piece(box(0.16, 0.14, 0.6), CHITIN, [side * 0.12, 0, 0.3], [0, side * 0.35, 0]),
            piece(ball(0.24), CHITIN_DARK, [side * 0.28, 0, 0.7], [0, 0, 0], [0.8, 0.6, 1.2]),
            piece(cone(0.07, 0.42, 4), GOLD_DARK, [side * 0.36, 0, 1.08], [UP, 0, 0]),
            piece(cone(0.06, 0.36, 4), CHITIN, [side * 0.16, 0, 1.04], [UP, 0, 0]),
          ],
          this.body,
          [side * 0.36, 0.06, 0.6],
        ),
      );
      for (let i = 0; i < 3; i++)
        this.limbs.push(
          this.part(
            [
              piece(box(0.5, 0.06, 0.07), CHITIN_DARK, [side * 0.25, 0.05, 0], [0, 0, side * -0.45]),
              piece(box(0.06, 0.4, 0.06), CHITIN_DARK, [side * 0.5, -0.2, 0]),
            ],
            this.body,
            [side * 0.42, 0, 0.3 - i * 0.4],
          ),
        );
    }
    // The tail rises from the last plate and arches forward over the back.
    const tail: BufferGeometry[] = [];
    let y = 0;
    let z = 0;
    for (let i = 0; i < 6; i++) {
      const bend = 0.5 + i * 0.42;
      y += Math.sin(bend) * 0.3;
      z += -Math.cos(bend) * 0.3;
      tail.push(piece(ball(0.17 - i * 0.012), i % 2 ? CHITIN : CHITIN_DARK, [0, y, z]));
    }
    tail.push(piece(cone(0.09, 0.4, 5), GOLD, [0, y - 0.12, z + 0.22], [UP + 0.6, 0, 0]));
    this.tail.position.set(0, 0.2, -0.9);
    this.tail.add(new Mesh(prop(tail), material()));
    this.body.add(this.tail);
    return 0.42;
  }

  /** The sphinx: a lion's body lying low on four legs, a king's head in a striped headcloth. Returns how high it rides. */
  private buildSphinx(eyes: string): number {
    const stripes: BufferGeometry[] = [];
    for (let i = 0; i < 5; i++)
      stripes.push(
        piece(box(0.78 - i * 0.05, 0.07, 0.5), i % 2 ? GOLD : LAPIS, [0, 1.26 - i * 0.13, 0.86], [0.12, 0, 0]),
      );
    this.part(
      [
        piece(box(0.9, 0.7, 1.9), LION, [0, 0.25, 0]),
        piece(box(1, 0.8, 0.7), LION, [0, 0.36, 0.75]),
        piece(box(0.96, 0.62, 0.6), LION_DARK, [0, 0.2, -0.78]),
        // The head and its headcloth, the lappets falling to the chest.
        piece(box(0.46, 0.5, 0.42), LION, [0, 1.02, 0.98]),
        ...stripes,
        piece(box(0.16, 0.5, 0.1), LAPIS, [-0.3, 0.72, 1.12]),
        piece(box(0.16, 0.5, 0.1), LAPIS, [0.3, 0.72, 1.12]),
        piece(box(0.1, 0.24, 0.08), GOLD, [0, 0.72, 1.2]),
        piece(box(0.09, 0.06, 0.03), eyes, [-0.11, 1.08, 1.2]),
        piece(box(0.09, 0.06, 0.03), eyes, [0.11, 1.08, 1.2]),
        piece(cone(0.06, 0.2, 4), GOLD, [0, 1.42, 1.02], [0.5, 0, 0]),
        piece(box(1.02, 0.08, 0.5), GOLD_DARK, [0, 0.74, 0.75]),
      ],
      this.body,
    );
    for (const side of [-1, 1])
      for (const z of [0.72, -0.72])
        this.limbs.push(
          this.part(
            [piece(box(0.3, 0.9, 0.34), LION_DARK, [0, -0.4, 0]), piece(box(0.34, 0.14, 0.5), LION, [0, -0.86, 0.1])],
            this.body,
            [side * 0.36, 0, z],
          ),
        );
    this.tail.position.set(0, 0.4, -1.06);
    this.tail.add(
      new Mesh(
        prop([
          piece(tube(0.04, 0.05, 0.9, 5), LION_DARK, [0, 0.3, -0.25], [-0.7, 0, 0]),
          piece(ball(0.11), GOLD_DARK, [0, 0.66, -0.56]),
        ]),
        material(),
      ),
    );
    this.body.add(this.tail);
    return 0.94;
  }

  // ---- moving ----

  /** Forget everything a previous owner did. */
  reset(): void {
    this.seenActionAt = -1;
    this.strikeFrom = -10;
    this.death = 0;
  }

  /** Turn the joints for this frame: stand, walk, strike or fall. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 9);
    const crawler = this.kind === 'scarab' || this.kind === 'scorpion';
    this.stride = (this.stride + delta * (crawler ? 4.5 : 2.4) * this.walk) % 1;
    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      if (clock - incoming.at < 0.2 && !state.dead) this.strikeFrom = clock;
    }
    const p = (clock - this.strikeFrom) / ATTACK_SECONDS;
    // Out fast and back: 0 at rest, 1 at the moment the blow lands.
    const strike = p >= 0 && p < 1 ? Math.sin(Math.PI * smooth(p)) : 0;

    const t = this.time;
    const walk = this.walk;
    const dying = smooth(this.death);
    const step = this.stride * Math.PI * 2;
    // Falling: it tips over and sinks toward the sand.
    this.model.rotation.x = crawler ? 0 : -dying * 1.45;
    this.model.rotation.z = crawler ? dying * 2.6 : 0;
    this.body.position.y =
      this.height * (1 - 0.5 * dying) + Math.abs(Math.sin(step)) * 0.04 * walk + Math.sin(t * 2.2) * 0.012;
    this.body.rotation.x = strike * (crawler ? -0.25 : 0.3);

    const biped = this.kind === 'mummy' || this.kind === 'jackal';
    this.limbs.forEach((limb, i) => {
      const swing = Math.sin(step + (i % 2 ? Math.PI : 0)) * walk;
      if (biped) {
        // Two legs, then the free arm, which swings against the leg on its side.
        limb.rotation.x = i < 2 ? swing * 0.8 : -Math.sin(step) * 0.6 * walk + 0.1;
        // A mummy walks with its arms out before it.
        if (i === 2 && this.kind === 'mummy') limb.rotation.x -= 1.1;
      } else if (this.kind === 'sphinx') limb.rotation.x = swing * 0.55;
      else limb.rotation.y = swing * 0.5;
    });
    this.weapons.forEach((weapon, i) => {
      if (biped) weapon.rotation.x = -0.5 - strike * 1.5 + Math.sin(step) * 0.2 * walk;
      // Claws snap shut on the blow and idle open and closed between.
      else weapon.rotation.y = (i === 0 ? 1 : -1) * (0.25 + Math.sin(t * 2 + i) * 0.1 - strike * 0.6);
    });
    this.tail.rotation.x = (this.kind === 'scorpion' ? strike * 0.9 : 0) + Math.sin(t * 2.4) * 0.12;
    this.tail.rotation.y = Math.sin(t * 1.3) * (this.kind === 'sphinx' ? 0.5 : 0.08);
  }
}
