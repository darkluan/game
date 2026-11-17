import {
  type Command,
  dist,
  type Entity,
  type HeroEntity,
  type MapDef,
  type PlayerSetup,
  Sim,
  type StatusType,
  TICK_RATE,
  type UnitEntity,
  type Vec2,
  youSnapshotOf,
} from '@game/core';
import { BaseSession } from './baseSession';
import { buildHud } from './hud';
import type { GameSession, HudState, MinionView, SoundCue, UnitView, ViewEntity } from './session';

const TICK_SECONDS = 1 / TICK_RATE;
/** After a long stall (hidden tab) catch up at most this much instead of fast-forwarding. */
const MAX_CATCH_UP_SECONDS = 0.25;
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
export class LocalGame extends BaseSession implements GameSession {
  readonly sim: Sim;
  readonly hero: HeroEntity;
  /** 0..1 progress from the previous tick to the current one. */
  alpha = 0;

  private accumulator = 0;
  private readonly prev = new Map<number, Vec2>();
  private readonly startBuildings: Entity[];

  constructor(
    readonly seed: number,
    onCue: (cue: SoundCue, volume: number) => void = () => {},
  ) {
    super(onCue);
    this.sim = new Sim({ seed, players: offlinePlayers() });
    const hero = this.sim.heroOf(LOCAL_PLAYER_ID);
    if (!hero) throw new Error('local hero missing');
    this.hero = hero;
    this.startBuildings = this.sim.world.entities.filter((e) => e.kind === 'tower' || e.kind === 'shrine');
  }

  get map(): MapDef {
    return this.sim.map;
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
      for (const event of this.sim.events) this.handleEvent(event);
      this.accumulator -= TICK_SECONDS;
      stepped = true;
    }
    this.alpha = this.sim.winner === null ? this.accumulator / TICK_SECONDS : 1;
    this.clock = (this.sim.tick + this.alpha) * TICK_SECONDS;
    if (stepped) this.expireFx();
    return stepped;
  }

  heroes(): readonly ViewEntity[] {
    return this.sim.q.heroes.entities;
  }

  minions(): Iterable<MinionView> {
    return this.sim.q.minions;
  }

  projectiles(): Iterable<ViewEntity> {
    return this.sim.q.projectiles;
  }

  units(): Iterable<UnitView> {
    return this.sim.q.units;
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

  protected find(id: number): ViewEntity | undefined {
    return this.sim.get(id);
  }

  protected heroDefId(id: number): string | undefined {
    return this.sim.get(id)?.hero?.defId;
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
      dead: h.dead === true,
      stunned: sim.hasStatus(h, 'stun'),
      you: youSnapshotOf(sim, h),
      scores: sim.q.heroes.entities.map((e) => ({
        id: e.id,
        name: e === h ? 'Bạn' : `Bot ${e.id}`,
        team: e.team,
        isPlayer: e === h,
        level: e.hero.level,
        kills: e.hero.kills,
        deaths: e.hero.deaths,
        assists: e.hero.assists,
      })),
      winner: sim.winner,
    });
  }
}
