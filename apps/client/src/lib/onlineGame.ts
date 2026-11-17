import {
  type Command,
  FLAG_DEAD,
  FLAG_SIEGE,
  FLAG_TARGETABLE,
  HEROES,
  MAP,
  type MatchWelcome,
  type Snapshot,
  STATUS_FLAGS,
  type StatusType,
  TICK_RATE,
  type Vec2,
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
} from './session';

const TICK_MS = 1000 / TICK_RATE;
/** The scene shows the game this far in the past, so there are always two snapshots to blend between. */
const INTERPOLATION_DELAY_MS = 100;
/** After a network stall, skip ahead instead of replaying a long backlog in fast motion. */
const MAX_QUEUED_SNAPSHOTS = 8;
const MOVING_EPSILON = 0.01;

interface View extends ViewEntity {
  flags: number;
  level: number;
  kda: [number, number, number];
  /** Position at the snapshot being blended from and the one being blended to. */
  from: Vec2;
  to: Vec2;
}

/** The connection to a match, reduced to what this class needs (a Colyseus room in practice). */
export interface MatchConnection {
  send(type: 'cmd', cmd: Command): void;
}

/**
 * A match played on the server. Receives a snapshot per server tick, shows them slightly delayed
 * and blends positions between the two snapshots around the displayed moment.
 * The server only sends what this player can see, so an entity missing from a snapshot is hidden.
 */
export class OnlineGame extends BaseSession implements GameSession {
  readonly seed = Date.now();
  readonly map = MAP;
  hero: ViewEntity;

  private readonly views = new Map<number, View>();
  private readonly heroRoster: RosterHero[];
  private queue: Snapshot[] = [];
  private current: Snapshot | null = null;
  private fromTick = 0;
  /** Smallest seen (arrival time - snapshot game time): maps the local clock to server game time. */
  private clockOffset = Infinity;
  private seen = {
    heroes: [] as View[],
    minions: [] as MinionView[],
    monsters: [] as MonsterView[],
    projectiles: [] as View[],
    zones: [] as View[],
    summons: [] as View[],
    units: [] as UnitView[],
  };
  private startBuildings: View[] = [];
  private readonly lastScore = new Map<number, { level: number; kda: number[] }>();

  constructor(
    private readonly connection: MatchConnection,
    private readonly welcome: MatchWelcome,
    onCue: (cue: SoundCue, volume: number) => void = () => {},
    private readonly now: () => number = () => performance.now(),
  ) {
    super(onCue);
    this.heroRoster = welcome.roster.map((r) => ({ id: r.heroId, team: r.team, defId: r.heroDefId }));
    // Stand-in until the first snapshot arrives; replaced by the real view then.
    this.hero = { id: welcome.heroId, kind: 'hero', team: 0, pos: { x: 0, z: 0 }, radius: 0.6, facing: 0 };
  }

  /** True once the first snapshot has been applied and the scene can be built. */
  get ready(): boolean {
    return this.current !== null;
  }

  /** Feed a snapshot received from the server. */
  receive(snapshot: Snapshot): void {
    this.queue.push(snapshot);
    // The fastest delivery so far is the best estimate of the true offset; drift up slowly so one
    // unusually quick packet does not pin it forever.
    this.clockOffset = Math.min(this.clockOffset + 0.05, this.now() - snapshot.tick * TICK_MS);
    if (!this.current) this.apply(this.queue.shift()!);
  }

  send(cmd: Command): void {
    this.connection.send('cmd', cmd);
  }

  update(): boolean {
    if (!this.current) return false;
    const renderTick = (this.now() - this.clockOffset - INTERPOLATION_DELAY_MS) / TICK_MS;
    let applied = false;
    while (this.queue.length > 0 && (renderTick >= this.current.tick || this.queue.length > MAX_QUEUED_SNAPSHOTS)) {
      this.apply(this.queue.shift()!);
      applied = true;
    }
    const span = this.current.tick - this.fromTick;
    const alpha = span > 0 ? Math.min(1, Math.max(0, (renderTick - this.fromTick) / span)) : 1;
    for (const v of this.views.values()) {
      v.pos.x = v.from.x + (v.to.x - v.from.x) * alpha;
      v.pos.z = v.from.z + (v.to.z - v.from.z) * alpha;
    }
    this.clock = ((this.fromTick + span * alpha) * TICK_MS) / 1000;
    if (applied) this.expireFx();
    return applied;
  }

  /** Make `snapshot` the state being blended toward. */
  private apply(snapshot: Snapshot): void {
    this.fromTick = this.current?.tick ?? snapshot.tick;
    this.current = snapshot;
    const seen = new Set<number>();
    for (const e of snapshot.entities) {
      seen.add(e.id);
      let v = this.views.get(e.id);
      if (!v) {
        v = {
          id: e.id,
          kind: e.k,
          team: e.t,
          pos: { x: e.x, z: e.z },
          radius: e.r,
          facing: e.f,
          flags: e.fl,
          level: 1,
          kda: [0, 0, 0],
          from: { x: e.x, z: e.z },
          to: { x: e.x, z: e.z },
        };
        if (e.mt) v.minion = { type: e.mt };
        if (e.mo) v.monster = { type: e.mo };
        if (e.ze) v.zone = { effect: e.ze };
        if (e.ar) v.attacker = { range: e.ar };
        if (e.hd) v.hero = { defId: e.hd, stage: 0 };
        this.views.set(e.id, v);
      }
      // The previous snapshot's position becomes the start of the next blend.
      v.from = v.to;
      v.to = { x: e.x, z: e.z };
      v.facing = e.f;
      v.radius = e.r;
      v.flags = e.fl;
      v.dead = (e.fl & FLAG_DEAD) !== 0;
      if (e.hp !== undefined && e.mhp !== undefined) v.health = { hp: e.hp, maxHp: e.mhp };
      if (e.ar && v.attacker) v.attacker.range = e.ar;
      if (v.hero && e.st !== undefined) v.hero.stage = e.st;
      if (e.lv !== undefined) v.level = e.lv;
      if (e.kda) v.kda = e.kda;
    }
    // Gone, or no longer visible to this player.
    for (const id of this.views.keys()) if (!seen.has(id)) this.views.delete(id);

    const all = [...this.views.values()];
    this.seen = {
      heroes: all.filter((v) => v.kind === 'hero'),
      minions: all.filter((v): v is View & MinionView => v.minion !== undefined && v.health !== undefined),
      monsters: all.filter((v): v is View & MonsterView => v.monster !== undefined && v.health !== undefined),
      projectiles: all.filter((v) => v.kind === 'projectile'),
      zones: all.filter((v) => v.kind === 'zone'),
      summons: all.filter((v) => v.kind === 'trap' || v.kind === 'turret'),
      units: all.filter((v): v is View & UnitView => v.health !== undefined),
    };
    if (this.fromTick === snapshot.tick) {
      // First snapshot: fix the lists the scene builds its static objects from.
      this.startBuildings = all.filter((v) => v.kind === 'tower' || v.kind === 'shrine');
    }
    this.hero = this.views.get(this.welcome.heroId) ?? this.hero;
    this.clock = (this.fromTick * TICK_MS) / 1000;
    for (const event of snapshot.events) this.handleEvent(event);
  }

  roster(): readonly RosterHero[] {
    return this.heroRoster;
  }

  find(id: number): ViewEntity | undefined {
    return this.views.get(id);
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
    return this.views.has(id);
  }

  private flags(id: number): number {
    return this.views.get(id)?.flags ?? 0;
  }

  hasStatus(e: ViewEntity, type: StatusType): boolean {
    return (this.flags(e.id) & STATUS_FLAGS[type]) !== 0;
  }

  isSiege(e: ViewEntity): boolean {
    return (this.flags(e.id) & FLAG_SIEGE) !== 0;
  }

  protected previousPos(id: number): Vec2 | undefined {
    return this.views.get(id)?.from;
  }

  protected isTargetable(e: UnitView): boolean {
    return (this.flags(e.id) & FLAG_TARGETABLE) !== 0;
  }

  renderPos(e: ViewEntity, out: Vec2): Vec2 {
    // update() already blended every position for this frame.
    out.x = e.pos.x;
    out.z = e.pos.z;
    return out;
  }

  isMoving(e: ViewEntity): boolean {
    const v = this.views.get(e.id);
    return v !== undefined && Math.hypot(v.to.x - v.from.x, v.to.z - v.from.z) > MOVING_EPSILON;
  }

  hud(): HudState {
    const snapshot = this.current;
    const me = this.views.get(this.welcome.heroId);
    if (!snapshot || !me || !snapshot.you) throw new Error('hud() called before the first snapshot');
    // Heroes out of sight keep their last known score line.
    for (const v of this.seen.heroes) this.lastScore.set(v.id, { level: v.level, kda: v.kda });
    return buildHud({
      tick: snapshot.tick,
      def: HEROES[me.hero?.defId ?? 'kael'],
      team: me.team === 1 ? 1 : 0,
      hp: me.health?.hp ?? 0,
      maxHp: me.health?.maxHp ?? 1,
      level: me.level,
      stage: me.hero?.stage ?? 0,
      dead: me.dead === true,
      has: (type) => (me.flags & STATUS_FLAGS[type]) !== 0,
      siege: (me.flags & FLAG_SIEGE) !== 0,
      you: snapshot.you,
      scores: this.welcome.roster.map((r) => {
        const score = this.lastScore.get(r.heroId) ?? { level: 1, kda: [0, 0, 0] };
        return {
          id: r.heroId,
          name: r.isBot ? 'Máy' : r.nickname,
          heroName: HEROES[r.heroDefId]?.name ?? r.heroDefId,
          team: r.team,
          isPlayer: r.heroId === me.id,
          level: score.level,
          kills: score.kda[0],
          deaths: score.kda[1],
          assists: score.kda[2],
        };
      }),
      winner: snapshot.winner,
    });
  }
}
