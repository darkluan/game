import { type Query, World } from 'miniplex';
import { BEAST, HERO, JUNGLE, RELIC, SHRINE, TOWER } from '../data/balance.js';
import { HEROES } from '../data/heroes.js';
import { MAP, type MapDef } from '../data/map.js';
import { dist, Rng } from '../math.js';
import { NavGrid } from '../pathfinding/grid.js';
import { aiSystem } from '../systems/ai.js';
import { attackSystem, projectileSystem, statusSystem } from '../systems/combat.js';
import { beastSystem } from '../systems/beast.js';
import { applyCommand } from '../systems/command.js';
import { heroUpkeepSystem, onDeath } from '../systems/economy.js';
import { jungleSystem } from '../systems/jungle.js';
import { minionSpawnSystem, minionSystem } from '../systems/minion.js';
import { heroOrderSystem, separationSystem } from '../systems/movement.js';
import { modifyDamageTaken } from '../systems/passives.js';
import { relicSystem, teamRelic } from '../systems/relic.js';
import { recomputeStats } from '../systems/stats.js';
import { summonSystem } from '../systems/summons.js';
import { towerSystem } from '../systems/tower.js';
import { computeCanSee, computeVisible } from '../systems/vision.js';
import {
  type AbilitySlot,
  type Command,
  type Entity,
  type Faction,
  type HeroDef,
  NEUTRAL,
  type PlayerSetup,
  type RelicType,
  type SimEvent,
  type StatusType,
  type Team,
  type Vec2,
} from '../types.js';

type With<K extends keyof Entity> = Entity & Required<Pick<Entity, K>>;
export type UnitEntity = With<'health' | 'statuses'>;
export type HeroEntity = With<'hero' | 'health' | 'statuses' | 'mover' | 'attacker'> & { team: Team };
export type MinionEntity = With<'minion' | 'health' | 'statuses' | 'mover' | 'attacker'> & { team: Team };
export type TowerEntity = With<'tower' | 'health' | 'statuses' | 'attacker'> & { team: Team };
export type MonsterEntity = With<'monster' | 'health' | 'statuses' | 'mover' | 'attacker'>;

export interface TeamBuff {
  relic: RelicType;
  untilTick: number;
}

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
    heroes: this.world.with('hero', 'health', 'statuses', 'mover', 'attacker') as unknown as Query<HeroEntity>,
    minions: this.world.with('minion', 'health', 'statuses', 'mover', 'attacker') as unknown as Query<MinionEntity>,
    towers: this.world.with('tower', 'health', 'statuses', 'attacker') as unknown as Query<TowerEntity>,
    monsters: this.world.with('monster', 'health', 'statuses', 'mover', 'attacker'),
    turrets: this.world.with('turret', 'health', 'statuses', 'attacker'),
    units: this.world.with('health', 'statuses'),
    attackers: this.world.with('attacker'),
    projectiles: this.world.with('projectile'),
    zones: this.world.with('zone'),
    traps: this.world.with('trap'),
  };
  /** Per jungle camp: monsters still alive and when the camp comes back. */
  readonly camps: { alive: number; respawnAt: number }[];
  /** The relic waiting on a pedestal: who is capturing it and for how many ticks. */
  relic: { pedestal: number; type: RelicType; team: Team | null; progress: number } | null = null;
  /** The relic buff each team holds, by team. */
  readonly buffs: [TeamBuff | null, TeamBuff | null] = [null, null];
  /** The Ancient Beast: when the next one appears, and which team's wave it will march with. */
  readonly beast: { respawnAt: number; owner: Team | null } = { respawnAt: BEAST.spawnTick, owner: null };

  private nextId = 1;
  private readonly byId = new Map<number, Entity>();
  private readonly byPlayer = new Map<string, HeroEntity>();
  private pending: { playerId: string; cmd: Command }[] = [];
  private readonly visionCache = new Map<number, boolean>();

  constructor(options: SimOptions) {
    this.map = options.map ?? MAP;
    this.rng = new Rng(options.seed);
    const buildings = [
      ...this.map.shrines.map((pos) => ({ pos, radius: SHRINE.radius })),
      ...this.map.towers.map((t) => ({ pos: t.pos, radius: TOWER.radius })),
    ];
    this.nav = new NavGrid(this.map, buildings, HERO.radius);
    this.camps = this.map.camps.map(() => ({ alive: 0, respawnAt: JUNGLE.firstSpawnTick }));

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
      health: { hp: 1, maxHp: 1, armor: 0 },
      statuses: [],
      mover: { speed: 0, path: [] },
      attacker: {
        damage: 0,
        range: 0,
        intervalTicks: 1,
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
        mana: 0,
        maxMana: 0,
        heat: 0,
        lastCastTick: -Infinity,
        overloadUntil: 0,
        stage: 0,
        followers: 0,
        siege: false,
        items: [],
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
    recomputeStats(this, hero);
    hero.health.hp = hero.health.maxHp;
    hero.hero.mana = hero.hero.maxMana;
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

  /** Hand a hero to the bot AI, or back to its player (a player dropped or came back). */
  setBot(playerId: string, isBot: boolean): void {
    const hero = this.byPlayer.get(playerId);
    if (!hero) return;
    hero.hero.isBot = isBot;
    hero.hero.botRetreating = false;
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
    this.visionCache.clear();
    const pending = this.pending;
    this.pending = [];
    for (const { playerId, cmd } of pending) {
      const hero = this.byPlayer.get(playerId);
      if (hero) applyCommand(this, hero, cmd);
    }
    aiSystem(this);
    minionSpawnSystem(this);
    jungleSystem(this);
    beastSystem(this);
    relicSystem(this);
    statusSystem(this);
    heroUpkeepSystem(this);
    summonSystem(this);
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
    this.visionCache.clear();
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

  /** Whether `team` can currently see the entity (bushes, stealth, hidden traps). */
  isVisibleTo(e: Entity, team: Faction): boolean {
    if (team === NEUTRAL || e.team === team) return true;
    const key = e.id * 2 + team;
    let visible = this.visionCache.get(key);
    if (visible === undefined) {
      visible = computeVisible(this, e, team);
      this.visionCache.set(key, visible);
    }
    return visible;
  }

  /** Whether this particular unit can see the entity: its team's vision, cut short when blinded. */
  canSee(viewer: Entity, e: Entity): boolean {
    return computeCanSee(this, viewer, e);
  }

  /**
   * The closest enemy `from` may attack: targetable and visible. Jungle monsters are left alone
   * unless `neutral` is set.
   */
  nearestEnemy(from: Entity, range: number, filter?: (e: UnitEntity) => boolean, neutral = false): UnitEntity | null {
    let best: UnitEntity | null = null;
    let bestD = Infinity;
    for (const e of this.q.units) {
      if (e.team === from.team || (e.team === NEUTRAL && !neutral)) continue;
      if (!this.isTargetable(e) || (filter && !filter(e))) continue;
      const d = dist(from.pos, e.pos) - e.radius;
      if (d > range || d > bestD || (d === bestD && best !== null && e.id > best.id)) continue;
      if (!this.canSee(from, e)) continue;
      best = e;
      bestD = d;
    }
    return best;
  }

  /**
   * Every hostile unit in a circle, monsters included, seen or not (for area effects).
   * Towers and shrines are left out: abilities do not damage buildings, only basic attacks do.
   */
  enemiesWithin(team: Faction, centre: Vec2, radius: number): UnitEntity[] {
    const out: UnitEntity[] = [];
    for (const e of this.q.units) {
      if (e.team === team || e.kind === 'tower' || e.kind === 'shrine') continue;
      if (this.isTargetable(e) && dist(centre, e.pos) <= radius + e.radius) out.push(e);
    }
    return out.sort((a, b) => a.id - b.id);
  }

  alliesWithin(team: Faction, centre: Vec2, radius: number): UnitEntity[] {
    const out: UnitEntity[] = [];
    for (const e of this.q.units) {
      if (e.team === team && this.isAlive(e) && dist(centre, e.pos) <= radius + e.radius) out.push(e);
    }
    return out.sort((a, b) => a.id - b.id);
  }

  hasStatus(e: Entity, type: StatusType): boolean {
    return e.statuses?.some((s) => s.type === type) ?? false;
  }

  /** Sum of the values of every status of one type (stacking buffs). */
  statusSum(e: Entity, type: StatusType): number {
    let sum = 0;
    for (const s of e.statuses ?? []) if (s.type === type) sum += s.value;
    return sum;
  }

  /** Largest value among the statuses of one type (non-stacking effects such as slows). */
  statusMax(e: Entity, type: StatusType): number {
    let max = 0;
    for (const s of e.statuses ?? []) if (s.type === type && s.value > max) max = s.value;
    return max;
  }

  addStatus(e: Entity, type: StatusType, durationTicks: number, value = 0, sourceId?: number): void {
    if (!e.statuses) return;
    // Buildings can be shielded or empowered, never controlled.
    if ((e.kind === 'tower' || e.kind === 'shrine') && type !== 'shield' && type !== 'attack') return;
    e.statuses.push({ type, untilTick: this.tick + durationTicks, value, sourceId });
  }

  removeStatus(e: Entity, type: StatusType): void {
    if (e.statuses) e.statuses = e.statuses.filter((s) => s.type !== type);
  }

  cannotAct(e: Entity): boolean {
    return this.hasStatus(e, 'stun') || this.hasStatus(e, 'stone');
  }

  cannotMove(e: Entity): boolean {
    return this.cannotAct(e) || this.hasStatus(e, 'root') || e.hero?.siege === true;
  }

  /** The hero that gets credit for what a summoned thing does. */
  creditOf(source: Entity | null): Entity | null {
    const ownerId = source?.turret?.ownerId;
    return ownerId === undefined ? source : (this.get(ownerId) ?? source);
  }

  dealDamage(target: Entity, raw: number, source: Entity | null): number {
    if (!this.isTargetable(target)) return 0;
    const armor = target.health.armor + this.statusSum(target, 'armor');
    let amount = (raw * 100) / (100 + Math.max(0, armor));
    amount *= 1 + this.statusMax(target, 'mark');
    amount *= 1 - this.statusMax(target, 'stone');
    amount = modifyDamageTaken(this, target, source, amount);
    for (const s of target.statuses) {
      if (s.type !== 'shield' || amount <= 0) continue;
      const absorbed = Math.min(s.value, amount);
      s.value -= absorbed;
      amount -= absorbed;
    }
    target.statuses = target.statuses.filter((s) => s.type !== 'shield' || s.value > 0);

    const credit = this.creditOf(source);
    // Fury relic: the team's heroes hit harder and are hit harder.
    if (credit?.hero && teamRelic(this, credit.team) === 'fury') amount *= RELIC.fury.dealt;
    if (target.hero && teamRelic(this, target.team) === 'fury') amount *= RELIC.fury.taken;
    if (credit?.hero && target.hero) {
      credit.hero.lastHeroHitTick = this.tick;
      const recent = target.hero.recentAttackers.filter((a) => a.id !== credit.id);
      recent.push({ id: credit.id, tick: this.tick });
      target.hero.recentAttackers = recent;
    }
    if (target.monster && credit && this.isAlive(credit)) {
      // Hitting one monster wakes its whole camp.
      for (const m of this.q.monsters) if (m.monster.camp === target.monster.camp) m.monster.aggroId ??= credit.id;
    }
    if (amount <= 0) return 0;
    target.health.hp -= amount;
    this.emit({ t: 'damage', targetId: target.id, amount, x: target.pos.x, z: target.pos.z });
    if (target.health.hp <= 0) {
      target.health.hp = 0;
      target.dead = true;
      onDeath(this, target, credit);
    }
    return amount;
  }

  heal(target: Entity, amount: number): number {
    if (!this.isAlive(target) || amount <= 0) return 0;
    const healed = Math.min(amount, target.health.maxHp - target.health.hp);
    if (healed <= 0) return 0;
    target.health.hp += healed;
    this.emit({ t: 'heal', targetId: target.id, amount: healed, x: target.pos.x, z: target.pos.z });
    return healed;
  }

  /** Push a mobile unit directly away from a point, stopping at walls. */
  knockback(target: Entity, from: Vec2, distance: number): void {
    if (!target.mover || this.hasStatus(target, 'stone')) return;
    const d = dist(from, target.pos);
    const nx = d > 1e-6 ? (target.pos.x - from.x) / d : 1;
    const nz = d > 1e-6 ? (target.pos.z - from.z) / d : 0;
    for (let moved = 0; moved < distance; moved += 0.25) {
      const x = target.pos.x + nx * 0.25;
      const z = target.pos.z + nz * 0.25;
      if (!this.nav.isWalkable(x, z)) break;
      target.pos.x = x;
      target.pos.z = z;
    }
    target.mover.path = [];
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
  cooldownLeft(hero: HeroEntity, slot: AbilitySlot): number {
    return Math.max(0, hero.hero.readyAt[slot] - this.tick);
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
