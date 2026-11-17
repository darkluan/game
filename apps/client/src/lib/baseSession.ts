import { type AbilityDef, type AbilitySlot, dist, type Faction, HEROES, type SimEvent, type Vec2 } from '@game/core';
import type { ActorAction, Fx, FxColor, SoundCue, UnitView, ViewEntity } from './session';

const HEAL_TEXT_MINIMUM = 20;

/** Sounds fade out with distance from the player's hero and are silent beyond this. */
const EARSHOT = 28;

/**
 * What the offline and online games share: the cursor, one-shot effects, sound cues, the latest
 * action of each unit, and how game events turn into those.
 */
export abstract class BaseSession {
  readonly cursor: Vec2 = { x: 0, z: 0 };
  clock = 0;
  fx: Fx[] = [];
  shakeUntil = 0;
  private readonly actions = new Map<number, ActorAction>();

  constructor(private readonly onCue: (cue: SoundCue, volume: number) => void) {}

  abstract readonly hero: ViewEntity;
  abstract units(): readonly UnitView[];
  /** The entity with this id, when the player can see it. */
  abstract find(id: number): ViewEntity | undefined;
  /** Where the entity was one update earlier, when known. */
  protected abstract previousPos(id: number): Vec2 | undefined;
  protected abstract isTargetable(e: UnitView): boolean;

  setCursor(x: number, z: number): void {
    this.cursor.x = x;
    this.cursor.z = z;
  }

  addFx(fx: Omit<Fx, 'bornAt'>): void {
    this.fx.push({ ...fx, bornAt: this.clock });
  }

  protected expireFx(): void {
    this.fx = this.fx.filter((f) => this.clock - f.bornAt < f.duration);
  }

  lastAction(id: number): ActorAction | undefined {
    return this.actions.get(id);
  }

  ability(slot: AbilitySlot): AbilityDef {
    return HEROES[this.hero.hero?.defId ?? 'kael'].abilities[slot];
  }

  private nearest(score: (e: UnitView) => number, limit: number): ViewEntity | null {
    let best: ViewEntity | null = null;
    let bestD = Infinity;
    for (const e of this.units()) {
      if (e.team === this.hero.team || !this.isTargetable(e)) continue;
      const d = score(e);
      if (d <= limit && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  pickEnemy(at: Vec2, slack = 1): ViewEntity | null {
    return this.nearest((e) => dist(e.pos, at) - e.radius, slack);
  }

  nearestEnemy(range: number): ViewEntity | null {
    return this.nearest((e) => dist(e.pos, this.hero.pos) - e.radius, range);
  }

  private side(team: Faction): FxColor {
    return team === this.hero.team ? 'ally' : 'enemy';
  }

  /** Plays a sound for something that happened at `at`, quieter the farther from the player's hero. */
  private cue(cue: SoundCue, at: Vec2 | null): void {
    const volume = at ? 1 - dist(at, this.hero.pos) / EARSHOT : 1;
    if (volume > 0) this.onCue(cue, volume);
  }

  protected handleEvent(event: SimEvent): void {
    switch (event.t) {
      case 'attack': {
        const source = this.find(event.sourceId);
        if (!source) return;
        this.actions.set(source.id, { kind: 'attack', at: this.clock });
        if (source.kind === 'hero') this.cue('hit', source.pos);
        else if (source.kind === 'tower') this.cue('tower', source.pos);
        return;
      }
      case 'cast': {
        const caster = this.find(event.casterId);
        const defId = caster?.hero?.defId;
        if (!caster || !defId) return;
        this.actions.set(caster.id, { kind: event.slot, at: this.clock });
        this.cue(`cast${event.slot}`, caster.pos);
        this.castFx(caster, HEROES[defId].abilities[event.slot], event);
        return;
      }
      case 'damage': {
        const target = this.find(event.targetId);
        if (target?.kind !== 'hero') return;
        this.addFx({
          kind: 'disc',
          x: event.x,
          z: event.z,
          radius: 0.7,
          color: this.side(target.team),
          duration: 0.15,
        });
        if (target.id === this.hero.id) this.shakeUntil = Math.max(this.shakeUntil, this.clock + 0.08);
        return;
      }
      case 'death': {
        this.actions.delete(event.id);
        if (event.kind === 'projectile') return;
        if (event.kind === 'zone' || event.kind === 'trap') return;
        const radius =
          event.kind === 'minion' || event.kind === 'turret'
            ? 0.8
            : event.kind === 'hero' || event.kind === 'monster'
              ? 2
              : 4;
        this.addFx({ kind: 'ring', x: event.x, z: event.z, radius, color: 'neutral', duration: 0.5 });
        if (event.kind === 'hero') this.cue('heroDeath', event);
        else if (event.kind === 'tower') this.cue('structureDown', null);
        return;
      }
      case 'gold': {
        if (event.id !== this.hero.id) return;
        this.addFx({
          kind: 'text',
          x: event.x,
          z: event.z,
          radius: 0,
          color: 'gold',
          text: `+${event.amount}`,
          duration: 0.9,
        });
        this.cue('gold', null);
        return;
      }
      case 'levelUp': {
        const who = this.find(event.id);
        if (!who) return;
        this.addFx({ kind: 'ring', x: who.pos.x, z: who.pos.z, radius: 2.2, color: 'gold', duration: 0.7 });
        if (who.id === this.hero.id) this.cue('levelUp', null);
        return;
      }
      case 'heal': {
        const target = this.find(event.targetId);
        if (!target || event.amount < HEAL_TEXT_MINIMUM) return;
        this.addFx({
          kind: 'text',
          x: event.x,
          z: event.z,
          radius: 0,
          color: 'heal',
          text: `+${Math.round(event.amount)}`,
          duration: 0.8,
        });
        return;
      }
      case 'evolve': {
        const who = this.find(event.id);
        if (!who) return;
        this.addFx({ kind: 'ring', x: who.pos.x, z: who.pos.z, radius: 5, color: 'gold', duration: 1.2 });
        this.addFx({ kind: 'disc', x: who.pos.x, z: who.pos.z, radius: 3, color: 'gold', duration: 0.8 });
        this.cue('levelUp', who.pos);
        return;
      }
      case 'overload': {
        const who = this.find(event.id);
        if (!who) return;
        this.addFx({ kind: 'disc', x: who.pos.x, z: who.pos.z, radius: 1.6, color: 'enemy', duration: 0.6 });
        this.cue('structureDown', who.pos);
        return;
      }
      case 'gameOver':
        this.cue(event.winner === this.hero.team ? 'victory' : 'defeat', null);
        return;
      default:
        return;
    }
  }

  /** The visual for a cast, chosen by how the ability is aimed. */
  private castFx(caster: ViewEntity, def: AbilityDef, at: Vec2): void {
    const color = this.side(caster.team);
    if (def.targeting === 'self') {
      this.addFx({ kind: 'ring', x: caster.pos.x, z: caster.pos.z, radius: 1.8, color, duration: 0.5 });
    } else if (def.targeting === 'direction') {
      // A dash: streak from where the caster stood before to where it stands now.
      const from = this.previousPos(caster.id) ?? caster.pos;
      const width = def.params.width?.[0] ?? 1;
      this.addFx({
        kind: 'line',
        x: from.x,
        z: from.z,
        x2: caster.pos.x,
        z2: caster.pos.z,
        radius: width,
        color,
        duration: 0.35,
      });
    } else {
      const radius = def.params.radius?.[0] ?? 1.2;
      this.addFx({ kind: 'disc', x: at.x, z: at.z, radius, color, duration: 0.3 });
      this.addFx({ kind: 'ring', x: at.x, z: at.z, radius: radius * 1.15, color, duration: 0.5 });
      if (def.params.radius && dist(at, this.hero.pos) < 14) this.shakeUntil = this.clock + 0.25;
    }
  }
}
