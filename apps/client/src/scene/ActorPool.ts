import { Group } from 'three';
import type { Vec2 } from '@game/core';
import type { GameSession, ViewEntity } from '@/lib/session';
import type { ActorAction } from '@/lib/session';

/** What the pool keeps: anything that stands in the scene, can be told what its unit is doing, and can be handed on to another. */
interface Actor {
  readonly root: Group;
  reset(): void;
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void;
}

const CORPSE_SECONDS = 1;

interface Slot {
  actor: Actor;
  poolKey: string;
  seenFrame: number;
  diedAt: number;
}

/**
 * Animated bodies for units that come and go (minions, monsters). Actors are pooled: when a unit
 * disappears its actor plays the death clip, then waits here for the next unit of the same look.
 */
export class ActorPool<T extends ViewEntity> {
  readonly group = new Group();
  private readonly active = new Map<number, Slot>();
  private readonly free = new Map<string, Actor[]>();
  private readonly pos: Vec2 = { x: 0, z: 0 };
  private frame = 0;

  /**
   * @param lookOf  a key naming how a unit looks; units with the same key can share actors
   * @param create  builds a new actor for a unit when the pool has none free for its key
   */
  constructor(
    private readonly lookOf: (unit: T) => string,
    private readonly create: (unit: T) => Actor,
  ) {}

  update(game: GameSession, units: readonly T[], delta: number): void {
    this.frame++;
    for (const unit of units) {
      if (unit.dead) continue;
      let slot = this.active.get(unit.id);
      if (!slot) {
        const poolKey = this.lookOf(unit);
        let actor = this.free.get(poolKey)?.pop();
        if (actor) {
          actor.reset();
        } else {
          actor = this.create(unit);
          this.group.add(actor.root);
        }
        actor.root.visible = true;
        slot = { actor, poolKey, seenFrame: 0, diedAt: -1 };
        this.active.set(unit.id, slot);
      }
      slot.seenFrame = this.frame;
      const p = game.renderPos(unit, this.pos);
      slot.actor.root.position.set(p.x, 0, p.z);
      slot.actor.root.rotation.y = unit.facing;
      slot.actor.update(delta, game.clock, {
        dead: false,
        moving: game.isMoving(unit),
        action: game.lastAction(unit.id),
      });
    }
    for (const [id, slot] of this.active) {
      if (slot.seenFrame === this.frame) continue;
      // Gone from the game (or from sight): play out the death where it stood, then recycle the actor.
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
