import {
  ABILITY_SLOTS,
  dist,
  maxAbilityLevel,
  Sim,
  TICK_RATE,
  xpToNext,
  type AbilityDef,
  type AbilitySlot,
  type Command,
  type Entity,
  type HeroEntity,
  type MapDef,
  type PlayerSetup,
  type SimEvent,
  type StatusType,
  type Team,
  type UnitEntity,
  type Vec2,
} from '@game/core';
import type { ActorAction, Fx, FxColor, GameSession, HudState, MinionEntity, SoundCue } from './session';

const TICK_SECONDS = 1 / TICK_RATE;
/** After a long stall (hidden tab) catch up at most this much instead of fast-forwarding. */
const MAX_CATCH_UP_SECONDS = 0.25;
/** Sounds fade out with distance from the player's hero and are silent beyond this. */
const EARSHOT = 28;
const MOVING_EPSILON = 0.01;

export const LOCAL_PLAYER_ID = 'local';

function offlinePlayers(): PlayerSetup[] {
  const players: PlayerSetup[] = [{ playerId: LOCAL_PLAYER_ID, team: 0, heroId: 'kael', isBot: false }];
  for (let i = 0; i < 2; i++) players.push({ playerId: `ally-bot-${i}`, team: 0, heroId: 'kael', isBot: true });
  for (let i = 0; i < 3; i++) players.push({ playerId: `enemy-bot-${i}`, team: 1, heroId: 'kael', isBot: true });
  return players;
}

/**
 * Offline play test: runs the core sim in the browser at the fixed tick rate and keeps the previous
 * tick's positions so the scene can interpolate between ticks.
 */
export class LocalGame implements GameSession {
  readonly sim: Sim;
  readonly hero: HeroEntity;
  readonly cursor: Vec2 = { x: 0, z: 0 };
  clock = 0;
  fx: Fx[] = [];
  shakeUntil = 0;
  /** 0..1 progress from the previous tick to the current one. */
  alpha = 0;

  private accumulator = 0;
  private readonly prev = new Map<number, Vec2>();
  private readonly actions = new Map<number, ActorAction>();
  private readonly startBuildings: Entity[];

  constructor(
    readonly seed: number,
    private readonly onCue: (cue: SoundCue, volume: number) => void = () => {},
  ) {
    this.sim = new Sim({ seed, players: offlinePlayers() });
    const hero = this.sim.heroOf(LOCAL_PLAYER_ID);
    if (!hero) throw new Error('local hero missing');
    this.hero = hero;
    this.startBuildings = this.sim.world.entities.filter((e) => e.kind === 'tower' || e.kind === 'shrine');
  }

  get map(): MapDef {
    return this.sim.map;
  }

  setCursor(x: number, z: number): void {
    this.cursor.x = x;
    this.cursor.z = z;
  }

  send(cmd: Command): void {
    this.sim.command(LOCAL_PLAYER_ID, cmd);
  }

  update(deltaSeconds: number): boolean {
    this.accumulator = Math.min(this.accumulator + deltaSeconds, MAX_CATCH_UP_SECONDS);
    let stepped = false;
    while (this.accumulator >= TICK_SECONDS && this.sim.winner === null) {
      this.prev.clear();
      for (const e of this.sim.world.entities) this.prev.set(e.id, { x: e.pos.x, z: e.pos.z });
      this.sim.step();
      this.clock = this.sim.tick * TICK_SECONDS;
      for (const event of this.sim.events) this.onEvent(event);
      this.accumulator -= TICK_SECONDS;
      stepped = true;
    }
    this.alpha = this.sim.winner === null ? this.accumulator / TICK_SECONDS : 1;
    this.clock = (this.sim.tick + this.alpha) * TICK_SECONDS;
    if (stepped) this.fx = this.fx.filter((f) => this.clock - f.bornAt < f.duration);
    return stepped;
  }

  heroes(): readonly HeroEntity[] {
    return this.sim.q.heroes.entities;
  }

  minions(): Iterable<MinionEntity> {
    return this.sim.q.minions;
  }

  projectiles(): Iterable<Entity> {
    return this.sim.q.projectiles;
  }

  units(): Iterable<UnitEntity> {
    return this.sim.q.units;
  }

  buildings(): readonly Entity[] {
    return this.startBuildings;
  }

  exists(id: number): boolean {
    return this.sim.get(id) !== undefined;
  }

  hasStatus(e: Entity, type: StatusType): boolean {
    return this.sim.hasStatus(e, type);
  }

  ability(slot: AbilitySlot): AbilityDef {
    return this.sim.heroDef(this.hero.hero.defId).abilities[slot];
  }

  renderPos(e: Entity, out: Vec2): Vec2 {
    const prev = this.prev.get(e.id);
    if (!prev) {
      out.x = e.pos.x;
      out.z = e.pos.z;
    } else {
      out.x = prev.x + (e.pos.x - prev.x) * this.alpha;
      out.z = prev.z + (e.pos.z - prev.z) * this.alpha;
    }
    return out;
  }

  isMoving(e: Entity): boolean {
    const prev = this.prev.get(e.id);
    return prev !== undefined && dist(prev, e.pos) > MOVING_EPSILON;
  }

  lastAction(id: number): ActorAction | undefined {
    return this.actions.get(id);
  }

  pickEnemy(at: Vec2, slack = 1): Entity | null {
    let best: Entity | null = null;
    let bestD = Infinity;
    for (const e of this.sim.q.units) {
      if (e.team === this.hero.team || !this.sim.isTargetable(e)) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z) - e.radius;
      if (d <= slack && d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  nearestEnemy(range: number): Entity | null {
    return this.sim.nearestEnemy(this.hero, range);
  }

  addFx(fx: Omit<Fx, 'bornAt'>): void {
    this.fx.push({ ...fx, bornAt: this.clock });
  }

  private side(team: Team): FxColor {
    return team === this.hero.team ? 'ally' : 'enemy';
  }

  /** Plays a sound for something that happened at `at`, quieter the farther from the player's hero. */
  private cue(cue: SoundCue, at: Vec2 | null): void {
    const volume = at ? 1 - dist(at, this.hero.pos) / EARSHOT : 1;
    if (volume > 0) this.onCue(cue, volume);
  }

  private onEvent(event: SimEvent): void {
    switch (event.t) {
      case 'attack': {
        const source = this.sim.get(event.sourceId);
        if (!source) return;
        this.actions.set(source.id, { kind: 'attack', at: this.clock });
        if (source.kind === 'hero') this.cue('hit', source.pos);
        else if (source.kind === 'tower') this.cue('tower', source.pos);
        return;
      }
      case 'cast': {
        const caster = this.sim.get(event.casterId);
        if (!caster?.hero) return;
        this.actions.set(caster.id, { kind: event.slot, at: this.clock });
        this.cue(`cast${event.slot}`, caster.pos);
        this.castFx(caster, this.sim.heroDef(caster.hero.defId).abilities[event.slot], event);
        return;
      }
      case 'damage': {
        const target = this.sim.get(event.targetId);
        if (target?.kind !== 'hero') return;
        this.addFx({
          kind: 'disc',
          x: event.x,
          z: event.z,
          radius: 0.7,
          color: this.side(target.team),
          duration: 0.15,
        });
        if (target === this.hero) this.shakeUntil = Math.max(this.shakeUntil, this.clock + 0.08);
        return;
      }
      case 'death': {
        this.actions.delete(event.id);
        if (event.kind === 'projectile') return;
        const radius = event.kind === 'minion' ? 0.8 : event.kind === 'hero' ? 2 : 4;
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
        const who = this.sim.get(event.id);
        if (!who) return;
        this.addFx({ kind: 'ring', x: who.pos.x, z: who.pos.z, radius: 2.2, color: 'gold', duration: 0.7 });
        if (who === this.hero) this.cue('levelUp', null);
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
  private castFx(caster: Entity, def: AbilityDef, at: Vec2): void {
    const color = this.side(caster.team);
    if (def.targeting === 'self') {
      this.addFx({ kind: 'ring', x: caster.pos.x, z: caster.pos.z, radius: 1.8, color, duration: 0.5 });
    } else if (def.targeting === 'direction') {
      // A dash: streak from where the caster stood last tick to where it stands now.
      const from = this.prev.get(caster.id) ?? caster.pos;
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

  hud(): HudState {
    const { sim, hero: h } = this;
    const hero = h.hero;
    const def = sim.heroDef(hero.defId);
    const stunned = sim.hasStatus(h, 'stun');
    return {
      timeSeconds: Math.floor(sim.tick / TICK_RATE),
      heroName: def.name,
      team: h.team,
      hp: h.health.hp,
      maxHp: h.health.maxHp,
      shield: h.statuses.reduce((sum, s) => (s.type === 'shield' ? sum + s.value : sum), 0),
      mana: hero.mana,
      maxMana: hero.maxMana,
      level: hero.level,
      xpFraction: hero.xp / xpToNext(hero.level),
      gold: hero.gold,
      skillPoints: hero.skillPoints,
      dead: h.dead === true,
      respawnSeconds: Math.max(0, Math.ceil((hero.respawnTick - sim.tick) / TICK_RATE)),
      stunned,
      abilities: ABILITY_SLOTS.map((slot) => {
        const ability = def.abilities[slot];
        const level = hero.abilityLevels[slot];
        const index = Math.max(0, level - 1);
        const left = sim.cooldownLeft(h, slot);
        return {
          slot,
          name: ability.name,
          level,
          cost: ability.cost[index],
          cooldownLeft: left / TICK_RATE,
          cooldownFraction: left / ability.cooldownTicks[index],
          canLevelUp: hero.skillPoints > 0 && level < maxAbilityLevel(ability, slot, hero.level),
          usable: level > 0 && left === 0 && !h.dead && !stunned && hero.mana >= ability.cost[index],
        };
      }),
      scores: sim.q.heroes.entities
        .map((e) => ({
          id: e.id,
          name: e === h ? 'Bạn' : `Bot ${e.id}`,
          team: e.team,
          isPlayer: e === h,
          level: e.hero.level,
          kills: e.hero.kills,
          deaths: e.hero.deaths,
          assists: e.hero.assists,
        }))
        .sort((a, b) => a.team - b.team || a.id - b.id),
      winner: sim.winner,
    };
  }
}
