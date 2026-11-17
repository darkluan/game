import { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Vec2 } from '@game/core';
import type { GameSession } from '@/lib/session';
import { Actor, MELEE_MINION_RIG, RANGED_MINION_RIG } from './Actor';
import { teamTint } from './palette';

const CORPSE_SECONDS = 1;
const SCALE = 0.58;

interface Slot {
  actor: Actor;
  poolKey: string;
  seenFrame: number;
  diedAt: number;
}

/**
 * Animated minions. Waves come and go all match, so actors are pooled: a dead minion's actor plays
 * its death clip, then waits here for the next minion of the same kind and team.
 */
export class MinionPool {
  readonly group = new Group();
  private readonly active = new Map<number, Slot>();
  private readonly free = new Map<string, Actor[]>();
  private readonly pos: Vec2 = { x: 0, z: 0 };
  private frame = 0;

  constructor(
    private readonly melee: GLTF,
    private readonly ranged: GLTF,
  ) {}

  private acquire(game: GameSession, type: 'melee' | 'ranged', team: number): Slot {
    const poolKey = `${type}:${team}`;
    let actor = this.free.get(poolKey)?.pop();
    if (actor) {
      actor.reset();
    } else {
      const isMelee = type === 'melee';
      actor = new Actor(isMelee ? this.melee : this.ranged, isMelee ? MELEE_MINION_RIG : RANGED_MINION_RIG, {
        scale: SCALE,
        tint: teamTint(team, game.hero.team),
        castShadow: false,
      });
      this.group.add(actor.root);
    }
    actor.root.visible = true;
    return { actor, poolKey, seenFrame: 0, diedAt: -1 };
  }

  update(game: GameSession, delta: number): void {
    this.frame++;
    for (const m of game.minions()) {
      if (m.dead) continue;
      let slot = this.active.get(m.id);
      if (!slot) {
        slot = this.acquire(game, m.minion.type, m.team);
        this.active.set(m.id, slot);
      }
      slot.seenFrame = this.frame;
      const p = game.renderPos(m, this.pos);
      slot.actor.root.position.set(p.x, 0, p.z);
      slot.actor.root.rotation.y = m.facing;
      slot.actor.update(delta, game.clock, { dead: false, moving: game.isMoving(m), action: game.lastAction(m.id) });
    }
    for (const [id, slot] of this.active) {
      if (slot.seenFrame === this.frame) continue;
      // The minion is gone from the game: play out its death where it stood, then recycle the actor.
      if (slot.diedAt < 0) slot.diedAt = game.clock;
      if (game.clock - slot.diedAt < CORPSE_SECONDS) {
        slot.actor.update(delta, game.clock, { dead: true, moving: false });
        continue;
      }
      slot.actor.root.visible = false;
      this.active.delete(id);
      const free = this.free.get(slot.poolKey) ?? [];
      free.push(slot.actor);
      this.free.set(slot.poolKey, free);
    }
  }
}
