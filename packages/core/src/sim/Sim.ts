import { World } from 'miniplex';
import { HERO, SHRINE, TOWER } from '../data/balance.js';
import { HEROES } from '../data/heroes.js';
import { MAP, type MapDef } from '../data/map.js';
import { dist, Rng } from '../math.js';
import { NavGrid } from '../pathfinding/grid.js';
import { castReadyTick } from '../systems/ability.js';
import { aiSystem } from '../systems/ai.js';
import { attackSystem, projectileSystem, statusSystem } from '../systems/combat.js';
import { applyCommand } from '../systems/command.js';
import { heroUpkeepSystem, onDeath } from '../systems/economy.js';
import { minionSpawnSystem, minionSystem } from '../systems/minion.js';
import { heroOrderSystem, separationSystem } from '../systems/movement.js';
import { modifyDamageTaken } from '../systems/passives.js';
import { towerSystem } from '../systems/tower.js';
import type { Command, Entity, HeroDef, PlayerSetup, SimEvent, StatusType, Team, Vec2 } from '../types.js';

type With<K extends keyof Entity> = Entity & Required<Pick<Entity, K>>;
export type HeroEntity = With<'hero' | 'health' | 'statuses' | 'mover' | 'attacker'>;
export type UnitEntity = With<'health' | 'statuses'>;

export interface SimOptions {
  seed: number;
  players: PlayerSetup[];
  map?: MapDef;
}

/**
 * The whole match. Advances one fixed tick per step(); every rule reads `tick`, never wall-clock time,
 * and all randomness comes from the seeded rng, so the same seed and commands replay the same match.
 */
export class Sim {
  tick = 0;
  winner: Team | null = null;
  /** Events of the last step(), for visuals and sound. */
  events: SimEvent[] = [];

  readonly map: MapDef;
  readonly rng: Rng;
  readonly nav: NavGrid;
  readonly world = new World<Entity>();
  readonly q = {
    heroes: this.world.with('hero', 'health', 'statuses', 'mover', 'attacker'),
    minions: this.world.with('minion', 'health', 'statuses', 'mover', 'attacker'),
    towers: this.world.with('tower', 'health', 'statuses', 'attacker'),
    units: this.world.with('health', 'statuses'),
    attackers: this.world.with('attacker'),
    projectiles: this.world.with('projectile'),
  };

  private nextId = 1;
  private readonly byId = new Map<number, Entity>();
  private readonly byPlayer = new Map<string, HeroEntity>();
  private pending: { playerId: string; cmd: Command }[] = [];

  constructor(options: SimOptions) {
    this.map = options.map ?? MAP;
    this.rng = new Rng(options.seed);
    const buildings = [
      ...this.map.shrines.map((pos) => ({ pos, radius: SHRINE.radius })),
      ...this.map.towers.map((t) => ({ pos: t.pos, radius: TOWER.radius })),
    ];
    this.nav = new NavGrid(this.map, buildings, HERO.radius);

    for (const team of [0, 1] as const) {
      this.spawn({
        kind: 'shrine',
        team,
        pos: { ...this.map.shrines[team] },
        radius: SHRINE.radius,
        health: { hp: SHRINE.hp, maxHp: SHRINE.hp, armor: SHRINE.armor },
        statuses: [],
        shrine: true,
      });
    }
    for (const t of this.map.towers) {
      this.spawn({
        kind: 'tower',
        team: t.team,
        pos: { ...t.pos },
        radius: TOWER.radius,
        health: { hp: TOWER.hp, maxHp: TOWER.hp, armor: TOWER.armor },
        statuses: [],
        attacker: {
          damage: TOWER.attack,
          range: TOWER.range,
          intervalTicks: TOWER.intervalTicks,
          cooldown: 0,
          projectileSpeed: TOWER.projectileSpeed,
          targetId: null,
        },
        tower: { tier: t.tier },
      });
    }
    const perTeam = [0, 0];
    for (const p of options.players) this.spawnHero(p, perTeam[p.team]++);
  }

  private spawnHero(p: PlayerSetup, indexInTeam: number): void {
    const def = this.heroDef(p.heroId);
    const fountain = this.map.fountains[p.team];
    const hero = this.spawn({
      kind: 'hero',
      team: p.team,
      pos: { x: fountain.x, z: fountain.z + (indexInTeam - 1) * 2 },
      radius: HERO.radius,
      facing: p.team === 0 ? Math.PI / 2 : -Math.PI / 2,
      health: { hp: def.base.hp, maxHp: def.base.hp, armor: def.base.armor },
      statuses: [],
      mover: { speed: def.base.moveSpeed, path: [] },
      attacker: {
        damage: def.base.attack,
        range: def.base.attackRange,
        intervalTicks: def.base.attackInterval,
        cooldown: 0,
        projectileSpeed: def.base.projectileSpeed,
        targetId: null,
      },
      hero: {
        defId: def.id,
        playerId: p.playerId,
        isBot: p.isBot,
        level: 1,
        xp: 0,
        gold: 0,
        skillPoints: 1,
        abilityLevels: { Q: 0, W: 0, E: 0, R: 0 },
        readyAt: { Q: 0, W: 0, E: 0, R: 0 },
        mana: def.base.mana,
        maxMana: def.base.mana,
        respawnTick: 0,
        order: { t: 'idle' },
        kills: 0,
        deaths: 0,
        assists: 0,
        recentAttackers: [],
        lastHeroHitTick: -Infinity,
        botRetreating: false,
      },
    }) as HeroEntity;
    this.byPlayer.set(p.playerId, hero);
  }

  heroDef(id: string): HeroDef {
    const def = HEROES[id];
    if (!def) throw new Error(`Unknown hero: ${id}`);
    return def;
  }

  spawn(init: Omit<Entity, 'id' | 'facing'> & { facing?: number }): Entity {
    const entity: Entity = { facing: 0, ...init, id: this.nextId++ };
    this.byId.set(entity.id, entity);
    this.world.add(entity);
    return entity;
  }

  get(id: number): Entity | undefined {
    return this.byId.get(id);
  }

  heroOf(playerId: string): HeroEntity | undefined {
    return this.byPlayer.get(playerId);
  }

  emit(event: SimEvent): void {
    this.events.push(event);
  }

  /** Queue a player's command; it is validated and applied at the start of the next step. */
  command(playerId: string, cmd: Command): void {
    this.pending.push({ playerId, cmd });
  }

  step(): void {
    if (this.winner !== null) return;
    this.events = [];
    const pending = this.pending;
    this.pending = [];
    for (const { playerId, cmd } of pending) {
      const hero = this.byPlayer.get(playerId);
      if (hero) applyCommand(this, hero, cmd);
    }
    aiSystem(this);
    minionSpawnSystem(this);
    statusSystem(this);
    heroUpkeepSystem(this);
    minionSystem(this);
    heroOrderSystem(this);
    towerSystem(this);
    attackSystem(this);
    projectileSystem(this);
    separationSystem(this);
    for (const e of [...this.world.entities]) {
      if (e.dead && e.kind !== 'hero') {
        this.world.remove(e);
        this.byId.delete(e.id);
      }
    }
    this.tick++;
  }

  // ---- shared rules used by several systems ----

  isAlive(e: Entity): e is UnitEntity {
    return !e.dead && e.health !== undefined && e.health.hp > 0;
  }

  /** Towers fall in order: the inner tower needs the outer one down, the shrine needs both. */
  isInvulnerable(e: Entity): boolean {
    if (e.kind !== 'tower' && e.kind !== 'shrine') return false;
    for (const t of this.q.towers) {
      if (t.team !== e.team || t.dead || t === e) continue;
      if (e.kind === 'shrine' || t.tower.tier < (e.tower?.tier ?? 0)) return true;
    }
    return false;
  }

  isTargetable(e: Entity): e is UnitEntity {
    return this.isAlive(e) && !this.isInvulnerable(e);
  }

  inRange(from: Entity, target: Entity, range: number): boolean {
    return dist(from.pos, target.pos) <= range + target.radius;
  }

  nearestEnemy(from: Entity, range: number, filter?: (e: UnitEntity) => boolean): UnitEntity | null {
    let best: UnitEntity | null = null;
    let bestD = Infinity;
    for (const e of this.q.units) {
      if (e.team === from.team || !this.isTargetable(e) || (filter && !filter(e))) continue;
      const d = dist(from.pos, e.pos) - e.radius;
      if (d <= range && (d < bestD || (d === bestD && best !== null && e.id < best.id))) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  enemiesWithin(team: Team, centre: Vec2, radius: number): UnitEntity[] {
    const out: UnitEntity[] = [];
    for (const e of this.q.units) {
      if (e.team !== team && this.isTargetable(e) && dist(centre, e.pos) <= radius + e.radius) out.push(e);
    }
    return out.sort((a, b) => a.id - b.id);
  }

  hasStatus(e: Entity, type: StatusType): boolean {
    return e.statuses?.some((s) => s.type === type) ?? false;
  }

  addStatus(e: Entity, type: StatusType, durationTicks: number, value = 0): void {
    if (!e.statuses || e.kind === 'tower' || e.kind === 'shrine') return;
    e.statuses.push({ type, untilTick: this.tick + durationTicks, value });
  }

  dealDamage(target: Entity, raw: number, source: Entity | null): number {
    if (!this.isTargetable(target)) return 0;
    let amount = (raw * 100) / (100 + target.health.armor);
    amount = modifyDamageTaken(this, target, source, amount);
    for (const s of target.statuses) {
      if (s.type !== 'shield' || amount <= 0) continue;
      const absorbed = Math.min(s.value, amount);
      s.value -= absorbed;
      amount -= absorbed;
    }
    target.statuses = target.statuses.filter((s) => s.type !== 'shield' || s.value > 0);

    if (source?.hero && target.hero) {
      source.hero.lastHeroHitTick = this.tick;
      const recent = target.hero.recentAttackers.filter((a) => a.id !== source.id);
      recent.push({ id: source.id, tick: this.tick });
      target.hero.recentAttackers = recent;
    }
    if (amount <= 0) return 0;
    target.health.hp -= amount;
    this.emit({ t: 'damage', targetId: target.id, amount, x: target.pos.x, z: target.pos.z });
    if (target.health.hp <= 0) {
      target.health.hp = 0;
      target.dead = true;
      onDeath(this, target, source);
    }
    return amount;
  }

  spawnProjectile(source: Entity, target: Entity, damage: number, speed: number): void {
    this.spawn({
      kind: 'projectile',
      team: source.team,
      pos: { ...source.pos },
      radius: 0.2,
      projectile: { sourceId: source.id, targetId: target.id, damage, speed },
    });
  }

  /** Ticks until the hero can cast `slot`, 0 when ready. */
  cooldownLeft(hero: HeroEntity, slot: 'Q' | 'W' | 'E' | 'R'): number {
    return Math.max(0, castReadyTick(hero, slot) - this.tick);
  }

  /** Stable digest of the match state, to check two runs stayed identical. */
  hash(): string {
    let h = 2166136261;
    const mix = (n: number) => {
      h ^= Math.round(n * 1000);
      h = Math.imul(h, 16777619);
    };
    mix(this.tick);
    for (const e of [...this.world.entities].sort((a, b) => a.id - b.id)) {
      mix(e.id);
      mix(e.pos.x);
      mix(e.pos.z);
      mix(e.health?.hp ?? 0);
      mix(e.hero?.gold ?? 0);
      mix(e.hero?.xp ?? 0);
    }
    return (h >>> 0).toString(16);
  }
}
