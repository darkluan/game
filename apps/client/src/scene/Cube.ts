import {
  AdditiveBlending,
  BoxGeometry,
  CanvasTexture,
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
 * A puzzle cube that thinks, built in code with no model file: twenty-seven small cubes in three
 * layers that turn on each other, every outer face a tile of colour, an eye in the middle of its
 * front, hanging in the air with a few loose pieces circling it. It has no limbs: everything it does
 * it does by turning. Used the same way as an Actor.
 *
 * Built about one unit tall, facing +z; `height` rescales it.
 */

export interface CubeColours {
  /** The dark body between the tiles. */
  body: string;
  /** The eye, the seams when it opens, and the loose pieces. */
  glow: string;
}

/** How long each action lasts, in seconds; the same table an animated model's rig carries. */
export const CUBE_ACTIONS: Record<string, { clip: string; seconds: number }> = {
  attack: { clip: 'attack', seconds: 0.45 },
  Q: { clip: 'Q', seconds: 0.55 },
  W: { clip: 'W', seconds: 0.7 },
  E: { clip: 'E', seconds: 0.55 },
  R: { clip: 'R', seconds: 0.9 },
};

/** The six tiles, by the face they are on: right, left, top, bottom, front, back. The game's own colours, one for each race and two more. */
const TILES = ['#ff5a3c', '#ff9d2e', '#f4f6fa', '#ffd84a', '#4aa3ff', '#4fd67a'];
/** The side of the whole cube, and of one small cube in it; the gap between is the dark seam. */
const SIDE = 0.46;
const PITCH = SIDE / 3;
const PIECE = PITCH * 0.9;
/** How high its middle hangs over the ground. */
const HOVER = 0.56;
const QUARTER = Math.PI / 2;
/** How it is held at rest: tipped forward and turned a little aside. */
const TIP = 0.24;
const TURNED = 0.42;
const DEATH_SECONDS = 0.8;
/** At rest, one layer or another gives a quarter turn this often, as a thing does that cannot keep still. */
const FIDGET_SECONDS = 2.6;

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

export class Cube {
  readonly root = new Group();
  private readonly model = new Group();
  /** Hangs in the air and leans; the three layers sit in it. */
  private readonly body = new Group();
  private readonly layers: Group[] = [];
  private readonly loose = new Group();
  private readonly eye: Mesh;
  private readonly halo: Sprite;
  private readonly tiles: MeshStandardMaterial[];
  private readonly light: MeshBasicMaterial;

  private time = Math.random() * 10;
  private walk = 0;
  private death = 0;
  private seenActionAt = -1;
  private action: { kind: string; from: number; until: number } | null = null;
  /** How far each layer has been turned and left there, in quarter turns: its resting place between actions. */
  private readonly turned = [0, 0, 0];
  private readonly shown = [0, 0, 0];
  private fidgetAt = FIDGET_SECONDS * (0.5 + Math.random());

  constructor(colours: CubeColours, height: number, castShadow: boolean) {
    const dark = new MeshStandardMaterial({ color: colours.body, roughness: 0.5, metalness: 0.3 });
    // Lit a little from within: a tile has to read as its colour in the shade of a wall too.
    this.tiles = TILES.map(
      (color) =>
        new MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.28,
          roughness: 0.45,
          flatShading: true,
        }),
    );
    this.light = new MeshBasicMaterial({ color: colours.glow });
    const piece = new BoxGeometry(PIECE, PIECE, PIECE);

    this.model.scale.setScalar(height);
    this.root.add(this.model);
    this.body.position.y = HOVER;
    this.model.add(this.body);
    // The seams: a dark core just smaller than the cube, seen between the pieces.
    const core = new Mesh(new BoxGeometry(SIDE * 0.9, SIDE * 0.9, SIDE * 0.9), dark);
    this.body.add(core);

    for (let y = -1; y <= 1; y++) {
      const layer = new Group();
      layer.position.y = y * PITCH;
      this.body.add(layer);
      this.layers.push(layer);
      for (let x = -1; x <= 1; x++)
        for (let z = -1; z <= 1; z++) {
          // A piece shows a tile on each face that is on the outside of the cube, and body on the rest.
          const faces = [x === 1, x === -1, y === 1, y === -1, z === 1, z === -1].map((outer, i) =>
            outer ? this.tiles[i] : dark,
          );
          const cubelet = new Mesh(piece, faces);
          cubelet.position.set(x * PITCH, 0, z * PITCH);
          cubelet.castShadow = castShadow;
          layer.add(cubelet);
        }
    }

    // The eye, in the middle tile of the front: a ring of light, a dark pupil, a spark.
    const face = new Group();
    face.position.set(0, 0, SIDE / 2 + 0.004);
    this.layers[1].add(face);
    const ring = new Mesh(new TorusGeometry(PIECE * 0.3, PIECE * 0.09, 6, 20), this.light);
    face.add(ring);
    this.eye = new Mesh(new SphereGeometry(PIECE * 0.2, 12, 8), new MeshBasicMaterial({ color: '#10131c' }));
    this.eye.scale.z = 0.4;
    face.add(this.eye);
    const spark = new Mesh(new SphereGeometry(PIECE * 0.06, 8, 6), new MeshBasicMaterial({ color: '#ffffff' }));
    spark.position.set(PIECE * 0.08, PIECE * 0.09, PIECE * 0.08);
    face.add(spark);

    // A light at its heart that shows through the seams when it opens, and four loose pieces that circle it.
    this.halo = new Sprite(
      new SpriteMaterial({
        map: glowTexture(),
        color: colours.glow,
        transparent: true,
        opacity: 0.3,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.halo.scale.setScalar(SIDE * 2.4);
    this.body.add(this.halo);
    this.body.add(this.loose);
    const shard = new BoxGeometry(PIECE * 0.45, PIECE * 0.45, PIECE * 0.45);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const bit = new Mesh(shard, i % 2 ? this.light : this.tiles[(i * 2) % TILES.length]);
      bit.position.set(Math.sin(a) * SIDE * 1.05, (i % 2 ? 1 : -1) * PITCH * 0.6, Math.cos(a) * SIDE * 1.05);
      bit.rotation.set(a, a * 2, 0);
      this.loose.add(bit);
    }
  }

  /** Forget everything a previous owner did. */
  reset(): void {
    this.action = null;
    this.seenActionAt = -1;
    this.death = 0;
  }

  /** Pick the turning for this frame and move every part to it. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    this.time += delta;
    this.death = Math.max(0, Math.min(1, this.death + (state.dead ? delta / DEATH_SECONDS : -delta * 4)));
    this.walk += ((state.moving && !state.dead ? 1 : 0) - this.walk) * Math.min(1, delta * 9);
    const t = this.time;

    const incoming = state.action;
    if (incoming && incoming.at !== this.seenActionAt) {
      this.seenActionAt = incoming.at;
      const shot = CUBE_ACTIONS[incoming.kind];
      // Skip actions that are already stale.
      if (shot && clock - incoming.at < 0.2 && !state.dead) {
        this.action = { kind: incoming.kind, from: clock, until: clock + shot.seconds };
        // A blow leaves the top layer a quarter turn on from where it was.
        if (incoming.kind === 'attack') this.turned[2]++;
      }
    }
    if (this.action && (clock >= this.action.until || state.dead)) this.action = null;
    const kind = this.action?.kind;
    const progress = this.action ? Math.max(0, (clock - this.action.from) / (this.action.until - this.action.from)) : 0;

    // At rest it cannot keep still.
    this.fidgetAt -= delta;
    if (this.fidgetAt <= 0 && !this.action && !state.dead) {
      this.fidgetAt = FIDGET_SECONDS * (0.6 + Math.random() * 0.8);
      const which = Math.floor(Math.random() * 3);
      this.turned[which] += Math.random() < 0.5 ? 1 : -1;
    }

    let lean = this.walk * 0.3;
    let roll = 0;
    let lift = Math.sin(t * 2.1) * 0.02 + this.walk * Math.abs(Math.sin(t * 9)) * 0.03;
    let lunge = 0;
    let open = 0;
    let glow = 0.3;
    const extra = [0, 0, 0];
    if (kind === 'attack') {
      lunge = there(progress) * 0.1;
      glow = 0.3 + there(progress) * 0.5;
    } else if (kind === 'Q') {
      // The middle layer spins right round and is thrown: the cube leans into the throw.
      extra[1] = ease(progress) * Math.PI * 2;
      lean += there(progress) * 0.35;
      lunge = there(progress) * 0.14;
      glow = 0.3 + there(progress) * 0.6;
    } else if (kind === 'W') {
      // All three layers at once, each its own way.
      extra[0] = ease(progress) * Math.PI;
      extra[1] = -ease(progress) * Math.PI * 2;
      extra[2] = ease(progress) * Math.PI * 3;
      glow = 0.3 + there(progress) * 0.7;
    } else if (kind === 'E') {
      // The whole cube goes over forwards, once.
      roll = ease(progress) * Math.PI * 2;
      lift += there(progress) * 0.08;
    } else if (kind === 'R') {
      // It comes apart at the seams, the light pours out, the layers race, and it shuts again.
      open = there(progress);
      extra[0] = ease(progress) * Math.PI * 4;
      extra[2] = -ease(progress) * Math.PI * 4;
      lift += open * 0.12;
      glow = 0.3 + open * 1.2;
    }

    // Dying, it falls apart: the layers drop away from each other and it sinks out of the air.
    const gone = ease(this.death);
    open = Math.max(open, gone * 1.6);
    this.body.position.set(0, HOVER + lift - gone * (HOVER - SIDE * 0.35), lunge);
    // Held a little tipped and turned, so that three of its faces show at once and not one flat square.
    this.body.rotation.set(
      TIP + lean + roll + gone * 0.9,
      TURNED + Math.sin(t * 0.7) * 0.12 * (1 - this.walk),
      gone * 0.5,
    );
    this.body.scale.setScalar(1 - gone * 0.35);
    this.layers.forEach((layer, i) => {
      // Ease to the quarter turn it was left at; an action's own turning rides on top of that.
      this.shown[i] += (this.turned[i] - this.shown[i]) * Math.min(1, delta * 12);
      layer.rotation.y = this.shown[i] * QUARTER + extra[i];
      layer.position.y = (i - 1) * PITCH * (1 + open * 0.9);
    });
    this.loose.rotation.y = t * 1.3;
    this.loose.rotation.x = Math.sin(t * 0.9) * 0.25;
    this.loose.scale.setScalar(1 + open * 0.5 - gone);
    this.halo.material.opacity = Math.min(1, glow) * (1 - gone);
    this.halo.scale.setScalar(SIDE * (2.4 + open * 2));
    // It blinks.
    this.eye.scale.y = t % 3.4 < 0.12 ? 0.15 : 1;
  }
}
