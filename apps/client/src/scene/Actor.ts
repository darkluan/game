import { AnimationMixer, type AnimationAction, type AnimationClip, Group, LoopOnce, LoopRepeat } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { ActorAction } from '@/lib/session';
import { setShadows, tintModel } from './models';

/** Which clips a model uses for standing, running, dying and for each one-shot action. */
export interface Rig {
  idle: string;
  run: string;
  death: string;
  /** One-shot clips by action kind ('attack', 'Q', ...), squeezed or stretched to `seconds`. */
  actions: Record<string, { clip: string; seconds: number }>;
}

export interface ActorOptions {
  scale: number;
  tint?: string;
  /** Node names to hide, e.g. the weapons a character does not carry. */
  hide?: string[];
  castShadow: boolean;
}

const FADE = 0.12;

/** One animated character: a skinned clone of a model plus the logic choosing which clip plays. */
export class Actor {
  readonly root = new Group();
  private readonly mixer: AnimationMixer;
  private readonly clips: Map<string, AnimationClip>;
  private current: AnimationAction | null = null;
  private currentName = '';
  private busyUntil = 0;
  private seenActionAt = -1;

  constructor(
    gltf: GLTF,
    private readonly rig: Rig,
    options: ActorOptions,
  ) {
    const model = cloneSkinned(gltf.scene);
    model.scale.setScalar(options.scale);
    for (const name of options.hide ?? []) {
      const node = model.getObjectByName(name);
      if (node) node.visible = false;
    }
    if (options.tint) tintModel(model, options.tint);
    setShadows(model, options.castShadow);
    this.root.add(model);
    this.mixer = new AnimationMixer(model);
    this.clips = new Map(gltf.animations.map((c) => [c.name, c]));
    this.play(rig.idle, true);
  }

  private play(name: string, loop: boolean, seconds?: number): void {
    if (name === this.currentName && loop) return;
    const clip = this.clips.get(name);
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.setLoop(loop ? LoopRepeat : LoopOnce, loop ? Infinity : 1);
    next.clampWhenFinished = !loop;
    next.timeScale = seconds ? clip.duration / seconds : 1;
    next.fadeIn(FADE).play();
    if (this.current && this.current !== next) this.current.fadeOut(FADE);
    this.current = next;
    this.currentName = name;
  }

  /** Forget everything a previous owner did, for reuse from a pool. */
  reset(): void {
    this.busyUntil = 0;
    this.seenActionAt = -1;
    this.currentName = '';
    this.mixer.stopAllAction();
    this.current = null;
    this.play(this.rig.idle, true);
  }

  /** Pick the clip for this frame and advance the animation. */
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void {
    if (state.dead) {
      if (this.currentName !== this.rig.death) this.play(this.rig.death, false);
    } else {
      const action = state.action;
      if (action && action.at !== this.seenActionAt) {
        this.seenActionAt = action.at;
        const shot = this.rig.actions[action.kind];
        // Skip actions that are already stale, e.g. when this actor was just taken from the pool.
        if (shot && clock - action.at < 0.2) {
          this.currentName = '';
          this.play(shot.clip, false, shot.seconds);
          this.busyUntil = clock + shot.seconds;
        }
      }
      if (clock >= this.busyUntil) this.play(state.moving ? this.rig.run : this.rig.idle, true);
    }
    this.mixer.update(delta);
  }
}

export const KNIGHT_RIG: Rig = {
  idle: 'Idle',
  run: 'Running_A',
  death: 'Death_A',
  actions: {
    attack: { clip: '1H_Melee_Attack_Chop', seconds: 0.6 },
    Q: { clip: '1H_Melee_Attack_Stab', seconds: 0.6 },
    W: { clip: 'Blocking', seconds: 0.7 },
    E: { clip: 'Block_Attack', seconds: 0.6 },
    R: { clip: 'Jump_Full_Short', seconds: 0.7 },
  },
};

/** The knight model ships with every weapon attached; Kael carries a sword and a tall shield. */
export const KNIGHT_HIDDEN = ['1H_Sword_Offhand', 'Badge_Shield', 'Round_Shield', 'Spike_Shield', '2H_Sword'];

export const MELEE_MINION_RIG: Rig = {
  idle: 'Idle',
  run: 'Running_A',
  death: 'Death_A',
  actions: { attack: { clip: 'Unarmed_Melee_Attack_Punch_A', seconds: 0.7 } },
};

export const RANGED_MINION_RIG: Rig = {
  idle: 'Idle',
  run: 'Running_A',
  death: 'Death_A',
  actions: { attack: { clip: 'Spellcast_Shoot', seconds: 0.7 } },
};
