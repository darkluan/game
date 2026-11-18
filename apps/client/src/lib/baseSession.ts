import { tr } from '@/i18n';
import { type AbilityDef, type AbilitySlot, dist, type Faction, HEROES, type SimEvent, type Vec2 } from '@game/core';
import { RELIC_EFFECTS, RELIC_NAMES } from '@/ui/relicText';
import { ABILITY_FX } from './abilityFx';
import { ABILITY_SOUND, HERO_ATTACK_SOUND } from './abilitySounds';
import type { ActorAction, Announcement, Fx, FxColor, RosterHero, SoundCue, UnitView, ViewEntity } from './session';

/** How long an announcement stays on screen. */
const ANNOUNCEMENT_SECONDS = 5;
const MAX_ANNOUNCEMENTS = 4;

const HEAL_TEXT_MINIMUM = 20;

/** Sounds fade out with distance from the player's hero and are silent beyond this. */
const EARSHOT = 28;
/** A hit on a hero weaker than this makes no sound of its own. */
const IMPACT_MINIMUM = 12;
/** Units that attack from farther than this shoot instead of striking. */
const RANGED_BEYOND = 3;

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
  private announced: Announcement[] = [];
  private nextAnnouncementId = 1;

  constructor(private readonly onCue: (cue: SoundCue, volume: number, pan: number) => void) {}

  abstract readonly hero: ViewEntity;
  abstract roster(): readonly RosterHero[];
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

  addFx(fx: Omit<Fx, 'bornAt'>, delay = 0): void {
    this.fx.push({ ...fx, bornAt: this.clock + delay });
  }

  protected expireFx(): void {
    this.fx = this.fx.filter((f) => this.clock - f.bornAt < f.duration);
    this.announced = this.announced.filter((a) => this.clock - a.at < ANNOUNCEMENT_SECONDS);
  }

  /** Announcements still on screen, oldest first. */
  protected announcements(): Announcement[] {
    return this.announced;
  }

  private announce(text: string, tone: Announcement['tone']): void {
    const next = { id: this.nextAnnouncementId++, text, tone, at: this.clock };
    this.announced = [...this.announced, next].slice(-MAX_ANNOUNCEMENTS);
  }

  /** 'good' when something favours the player's team, 'bad' when it favours the enemy. */
  private toneFor(team: Faction | null): Announcement['tone'] {
    return team === null ? 'neutral' : team === this.hero.team ? 'good' : 'bad';
  }

  private heroNameOf(id: number | null): string | null {
    const entry = this.roster().find((r) => r.id === id);
    return entry ? (HEROES[entry.defId]?.name ?? null) : null;
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
  private cue(cue: SoundCue, at: Vec2 | null, loudness = 1): void {
    const volume = (at ? 1 - dist(at, this.hero.pos) / EARSHOT : 1) * loudness;
    // Things to the side of the hero are heard from that side.
    const pan = at ? (at.x - this.hero.pos.x) / EARSHOT : 0;
    if (volume > 0) this.onCue(cue, volume, pan);
  }

  protected handleEvent(event: SimEvent): void {
    switch (event.t) {
      case 'attack': {
        const source = this.find(event.sourceId);
        if (!source) return;
        this.actions.set(source.id, { kind: 'attack', at: this.clock });
        if (source.kind === 'hero') this.cue(HERO_ATTACK_SOUND[source.hero?.defId ?? ''] ?? 'swing', source.pos);
        else if (source.kind === 'tower') this.cue('tower', source.pos);
        // The rank and file fight quietly under the heroes.
        else if (source.kind === 'minion' || source.kind === 'monster' || source.kind === 'turret')
          this.cue((source.attacker?.range ?? 0) > RANGED_BEYOND ? 'minionShot' : 'minionHit', source.pos, 0.4);
        return;
      }
      case 'cast': {
        const caster = this.find(event.casterId);
        const defId = caster?.hero?.defId;
        if (!caster || !defId) return;
        this.actions.set(caster.id, { kind: event.slot, at: this.clock });
        this.cue(ABILITY_SOUND[event.abilityId] ?? 'cast', caster.pos);
        this.castFx(caster, HEROES[defId].abilities[event.slot], event);
        return;
      }
      case 'damage': {
        const target = this.find(event.targetId);
        if (target?.kind !== 'hero') return;
        if (event.amount >= IMPACT_MINIMUM) this.cue('impact', event, Math.min(1, 0.45 + event.amount / 200));
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
        if (event.kind === 'minion' || event.kind === 'monster') this.cue('minionDeath', event, 0.5);
        if (event.kind === 'hero') {
          this.cue(event.killerId === this.hero.id ? 'kill' : 'heroDeath', event);
          const victim = this.heroNameOf(event.id);
          const killer = this.heroNameOf(event.killerId);
          const mine = event.team === this.hero.team;
          if (victim)
            this.announce(
              killer ? tr('{killer} hạ gục {victim}', { killer, victim }) : tr('{victim} bị hạ gục', { victim }),
              mine ? 'bad' : 'good',
            );
        } else if (event.kind === 'tower') {
          this.cue('structureDown', null);
          const mine = event.team === this.hero.team;
          this.announce(
            mine ? tr('Một trụ của đội bạn đã sụp!') : tr('Đội bạn phá được một trụ địch!'),
            mine ? 'bad' : 'good',
          );
        }
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
      case 'recall': {
        if (event.phase === 'cancel') return;
        const who = this.find(event.id);
        if (event.phase === 'start') {
          this.addFx({ kind: 'ring', x: event.x, z: event.z, radius: 2.4, color: 'ally', inward: true, duration: 1.2 });
          this.cue('cast', event);
          return;
        }
        this.addFx({ kind: 'pillar', x: event.x, z: event.z, radius: 1.4, color: 'ally', duration: 0.6 });
        if (who) this.addFx({ kind: 'pillar', x: who.pos.x, z: who.pos.z, radius: 1.4, color: 'ally', duration: 0.6 });
        this.cue('blink', event);
        return;
      }
      case 'spell': {
        const flash = event.spell === 'flash';
        if (flash)
          this.addFx({
            kind: 'ring',
            x: event.fromX,
            z: event.fromZ,
            radius: 1.6,
            color: 'gold',
            inward: true,
            duration: 0.35,
          });
        this.addFx({
          kind: flash ? 'burst' : 'pillar',
          x: event.x,
          z: event.z,
          radius: flash ? 1.8 : 1.4,
          color: flash ? 'gold' : 'heal',
          duration: flash ? 0.4 : 0.7,
        });
        this.cue(flash ? 'blink' : 'heal', event);
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
      case 'relicSpawn':
        this.announce(tr('Di vật {relic} đã sáng lên ở rừng dưới!', { relic: RELIC_NAMES[event.relic] }), 'neutral');
        this.addFx({ kind: 'ring', x: event.x, z: event.z, radius: 6, color: 'gold', duration: 1.5 });
        this.cue('matchStart', null);
        return;
      case 'relicCaptured': {
        const mine = event.team === this.hero.team;
        const who = mine ? tr('Đội bạn') : tr('Đội địch');
        this.announce(
          tr('{who} chiếm Di vật {relic}: {effect}', {
            who,
            relic: RELIC_NAMES[event.relic],
            effect: RELIC_EFFECTS[event.relic],
          }),
          this.toneFor(event.team),
        );
        this.cue(mine ? 'levelUp' : 'heroDeath', null);
        return;
      }
      case 'lightning':
        this.addFx({
          kind: 'line',
          x: event.x1,
          z: event.z1,
          x2: event.x2,
          z2: event.z2,
          radius: 0.25,
          color: 'gold',
          duration: 0.25,
        });
        return;
      case 'beastSpawn':
        this.announce(tr('Cổ thú đã xuất hiện trong hang ở rừng trên!'), 'neutral');
        this.addFx({ kind: 'ring', x: event.x, z: event.z, radius: 7, color: 'enemy', duration: 1.5 });
        this.cue('matchStart', null);
        return;
      case 'beastSlain':
        if (event.team === null) return;
        this.announce(
          event.team === this.hero.team ? tr('Đội bạn đã hạ Cổ thú!') : tr('Đội địch đã hạ Cổ thú!'),
          this.toneFor(event.team),
        );
        this.cue('structureDown', null);
        return;
      case 'beastMarch':
        this.announce(
          event.team === this.hero.team
            ? tr('Cổ thú đang cùng lính đội bạn tiến về đền địch!')
            : tr('Cổ thú đang tiến về đền của đội bạn!'),
          this.toneFor(event.team),
        );
        return;
      case 'gameOver':
        this.cue(event.winner === this.hero.team ? 'victory' : 'defeat', null);
        return;
      default:
        return;
    }
  }

  /** The visual for a cast: the ability's own, or one chosen by how it is aimed when it has none. */
  private castFx(caster: ViewEntity, def: AbilityDef, at: Vec2): void {
    const color = this.side(caster.team);
    const from = this.previousPos(caster.id) ?? caster.pos;
    const own = ABILITY_FX[def.id];
    if (own) {
      own({ add: (fx, delay) => this.addFx(fx, delay), from, caster: caster.pos, at, side: color });
    } else if (def.targeting === 'self') {
      this.addFx({ kind: 'ring', x: caster.pos.x, z: caster.pos.z, radius: 1.8, color, duration: 0.5 });
    } else if (def.targeting === 'direction') {
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
    }
    if (def.targeting !== 'direction' && def.params.radius && dist(at, this.hero.pos) < 14)
      this.shakeUntil = this.clock + 0.25;
  }
}
