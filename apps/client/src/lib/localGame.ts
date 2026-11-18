import {
  type Command,
  dist,
  type Entity,
  type HeroEntity,
  HERO_IDS,
  type MapDef,
  type PlayerSetup,
  Rng,
  Sim,
  type StatusType,
  TICK_RATE,
  type UnitEntity,
  type Vec2,
  worldSnapshotOf,
  youSnapshotOf,
} from '@game/core';
import { BaseSession } from './baseSession';
import { buildHud } from './hud';
import type {
  GameSession,
  HudState,
  MinionView,
  MonsterView,
  RosterHero,
  SoundCue,
  UnitView,
  ViewEntity,
  WorldView,
} from './session';

const TICK_SECONDS = 1 / TICK_RATE;
/** After a long stall (hidden tab) catch up at most this much instead of fast-forwarding. */
const MAX_CATCH_UP_SECONDS = 0.25;
const MOVING_EPSILON = 0.01;

export const LOCAL_PLAYER_ID = 'local';

/** The player's hero plus bots: two allies and three enemies, no hero twice on a team. */
function offlinePlayers(heroId: string, rng: Rng): PlayerSetup[] {
  const draw = (taken: string[]): string => {
    const free = HERO_IDS.filter((id) => !taken.includes(id));
    const pick = free[Math.floor(rng.next() * free.length)];
    taken.push(pick);
    return pick;
  };
  const allies = [heroId];
  const enemies: string[] = [];
  const players: PlayerSetup[] = [{ playerId: LOCAL_PLAYER_ID, team: 0, heroId, isBot: false }];
  for (let i = 0; i < 2; i++) players.push({ playerId: `ally-bot-${i}`, team: 0, heroId: draw(allies), isBot: true });
  for (let i = 0; i < 3; i++) players.push({ playerId: `enemy-bot-${i}`, team: 1, heroId: draw(enemies), isBot: true });
  return players;
}

/**
 * Offline play test: runs the core sim in the browser at the fixed tick rate and keeps the previous
 * tick's positions so the scene can interpolate between ticks.
 */
export class LocalGame extends BaseSession implements GameSession {
  readonly sim: Sim;
  readonly hero: HeroEntity;
  /** 0..1 progress from the previous tick to the current one. */
  alpha = 0;

  private accumulator = 0;
  private readonly prev = new Map<number, Vec2>();
  private readonly startBuildings: Entity[];
  private readonly heroRoster: RosterHero[];
  /** What the player can see this tick. */
  private seen = {
    heroes: [] as ViewEntity[],
    minions: [] as MinionView[],
    monsters: [] as MonsterView[],
    projectiles: [] as ViewEntity[],
    zones: [] as ViewEntity[],
    summons: [] as ViewEntity[],
    units: [] as UnitView[],
  };

  constructor(
    readonly seed: number,
    heroId = 'kael',
    onCue: (cue: SoundCue, volume: number) => void = () => {},
  ) {
    super(onCue);
    this.sim = new Sim({ seed, players: offlinePlayers(heroId, new Rng(seed)) });
    const hero = this.sim.heroOf(LOCAL_PLAYER_ID);
    if (!hero) throw new Error('local hero missing');
    this.hero = hero;
    this.startBuildings = this.sim.world.entities.filter((e) => e.kind === 'tower' || e.kind === 'shrine');
    this.heroRoster = this.sim.q.heroes.entities.map((h) => ({ id: h.id, team: h.team, defId: h.hero.defId }));
    this.look();
  }

  get map(): MapDef {
    return this.sim.map;
  }

  send(cmd: Command): void {
    this.sim.command(LOCAL_PLAYER_ID, cmd);
  }

  /** Rebuild the lists of what the player's hero can see. */
  private look(): void {
    const { sim, hero } = this;
    const see = (e: Entity) => sim.canSee(hero, e);
    this.seen = {
      heroes: sim.q.heroes.entities.filter(see),
      minions: sim.q.minions.entities.filter(see),
      monsters: sim.q.monsters.entities.filter(see),
      projectiles: sim.q.projectiles.entities.filter(see),
      zones: sim.q.zones.entities.filter(see),
      summons: [...sim.q.traps.entities, ...sim.q.turrets.entities].filter(see),
      units: sim.q.units.entities.filter(see),
    };
  }

  update(deltaSeconds: number): boolean {
    this.accumulator = Math.min(this.accumulator + deltaSeconds, MAX_CATCH_UP_SECONDS);
    let stepped = false;
    while (this.accumulator >= TICK_SECONDS && this.sim.winner === null) {
      this.prev.clear();
      for (const e of this.sim.world.entities) this.prev.set(e.id, { x: e.pos.x, z: e.pos.z });
      this.sim.step();
      this.clock = this.sim.tick * TICK_SECONDS;
      for (const event of this.sim.events) this.handleEvent(event);
      this.accumulator -= TICK_SECONDS;
      stepped = true;
    }
    this.alpha = this.sim.winner === null ? this.accumulator / TICK_SECONDS : 1;
    this.clock = (this.sim.tick + this.alpha) * TICK_SECONDS;
    if (stepped) {
      this.look();
      this.expireFx();
    }
    return stepped;
  }

  roster(): readonly RosterHero[] {
    return this.heroRoster;
  }

  world(): WorldView {
    return worldSnapshotOf(this.sim);
  }

  find(id: number): ViewEntity | undefined {
    const e = this.sim.get(id);
    return e && this.sim.canSee(this.hero, e) ? e : undefined;
  }

  heroes(): readonly ViewEntity[] {
    return this.seen.heroes;
  }

  minions(): readonly MinionView[] {
    return this.seen.minions;
  }

  monsters(): readonly MonsterView[] {
    return this.seen.monsters;
  }

  projectiles(): readonly ViewEntity[] {
    return this.seen.projectiles;
  }

  zones(): readonly ViewEntity[] {
    return this.seen.zones;
  }

  summons(): readonly ViewEntity[] {
    return this.seen.summons;
  }

  units(): readonly UnitView[] {
    return this.seen.units;
  }

  buildings(): readonly ViewEntity[] {
    return this.startBuildings;
  }

  exists(id: number): boolean {
    return this.sim.get(id) !== undefined;
  }

  hasStatus(e: ViewEntity, type: StatusType): boolean {
    const entity = this.sim.get(e.id);
    return entity !== undefined && this.sim.hasStatus(entity, type);
  }

  isSiege(e: ViewEntity): boolean {
    return this.sim.get(e.id)?.hero?.siege === true;
  }

  protected previousPos(id: number): Vec2 | undefined {
    return this.prev.get(id);
  }

  protected isTargetable(e: UnitView): boolean {
    return this.sim.isTargetable(e as UnitEntity);
  }

  renderPos(e: ViewEntity, out: Vec2): Vec2 {
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

  isMoving(e: ViewEntity): boolean {
    const prev = this.prev.get(e.id);
    return prev !== undefined && dist(prev, e.pos) > MOVING_EPSILON;
  }

  hud(): HudState {
    const { sim, hero: h } = this;
    return buildHud({
      tick: sim.tick,
      def: sim.heroDef(h.hero.defId),
      team: h.team,
      hp: h.health.hp,
      maxHp: h.health.maxHp,
      level: h.hero.level,
      stage: h.hero.stage,
      dead: h.dead === true,
      has: (type) => sim.hasStatus(h, type),
      siege: h.hero.siege,
      you: youSnapshotOf(sim, h),
      scores: sim.q.heroes.entities.map((e) => ({
        id: e.id,
        name: e === h ? 'Bạn' : 'Máy',
        heroDefId: e.hero.defId,
        heroName: sim.heroDef(e.hero.defId).name,
        team: e.team,
        isPlayer: e === h,
        level: e.hero.level,
        kills: e.hero.kills,
        deaths: e.hero.deaths,
        assists: e.hero.assists,
      })),
      winner: sim.winner,
      world: this.world(),
      announcements: this.announcements(),
    });
  }
}
