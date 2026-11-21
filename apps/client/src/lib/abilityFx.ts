import type { Vec2 } from '@game/core';
import type { Fx, FxColor, FxShape } from './session';

/** What an ability's visual is built from. */
export interface CastFxContext {
  add(fx: Omit<Fx, 'bornAt'>, delay?: number): void;
  /** Where the caster stood just before the cast; differs from `caster` after a dash or a blink. */
  from: Vec2;
  caster: Vec2;
  /** The point the ability was aimed at; the caster's own position for a self-cast. */
  at: Vec2;
  /** The caster's team colour, used for the edge of anything that can hurt, so friend and foe read apart. */
  side: FxColor;
}

type Color = Fx['color'];

/** The look of each element: one small set of colours shared by every hero that uses it. */
const C = {
  steel: '#c9d2dc',
  guard: '#9cc8ff',
  stun: '#ffe066',
  mark: '#ff4d6d',
  wind: '#cfe8ff',
  soul: '#6dffb3',
  bone: '#e4fff0',
  fire: '#ff7a1a',
  flame: '#ffd166',
  earth: '#c49a6c',
  crack: '#6b4a2a',
  stone: '#aab0b8',
  light: '#fff3c4',
  dawn: '#ffe9a0',
  heal: '#7be08f',
  shadow: '#b98cff',
  dark: '#2a1140',
  spark: '#9fd8ff',
  white: '#f2f8ff',
  volt: '#5ad7ff',
  tech: '#7dffb0',
  star: '#b9a6ff',
  saw: '#ff8a5a',
  venom: '#9be35a',
  acid: '#d6f03c',
} as const satisfies Record<string, Color>;

const TURN = Math.PI * 2;
/** The colours of the tiles on Kubo-6's faces, for what it throws about. */
const TILE: Color[] = ['#ff5a3c', '#ff9d2e', '#f4f6fa', '#ffd84a', '#4aa3ff', '#4fd67a'];

/** The direction from one point to another, as the scene measures angles. */
const angle = (a: Vec2, b: Vec2): number => Math.atan2(b.x - a.x, b.z - a.z);

const along = (a: Vec2, b: Vec2, t: number): Vec2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

const around = (p: Vec2, radius: number, direction: number): Vec2 => ({
  x: p.x + Math.sin(direction) * radius,
  z: p.z + Math.cos(direction) * radius,
});

/** A random point within a circle. Visual only, so it need not match between players. */
const scatter = (p: Vec2, radius: number): Vec2 => around(p, radius * Math.sqrt(Math.random()), Math.random() * TURN);

/** A shape at a point. */
function put(
  c: CastFxContext,
  kind: Exclude<FxShape, 'line' | 'bolt'>,
  p: Vec2,
  radius: number,
  color: Color,
  duration: number,
  options: { delay?: number; angle?: number; inward?: boolean } = {},
): void {
  c.add({ kind, x: p.x, z: p.z, radius, color, duration, angle: options.angle, inward: options.inward }, options.delay);
}

/** A straight streak or a jagged bolt between two points. */
function draw(
  c: CastFxContext,
  kind: 'line' | 'bolt',
  a: Vec2,
  b: Vec2,
  width: number,
  color: Color,
  duration: number,
  delay = 0,
): void {
  c.add({ kind, x: a.x, z: a.z, x2: b.x, z2: b.z, radius: width, color, duration }, delay);
}

/** Bolts from a point out to the edge of a circle, evenly spread. */
function spokes(c: CastFxContext, p: Vec2, radius: number, count: number, color: Color, duration: number): void {
  const turn = Math.random() * TURN;
  for (let i = 0; i < count; i++)
    draw(c, 'bolt', p, around(p, radius, turn + (i / count) * TURN), 0.9, color, duration, i * 0.02);
}

/** Things dropping from the sky at random spots of an area, spread over `seconds`. */
function rain(
  c: CastFxContext,
  p: Vec2,
  radius: number,
  count: number,
  seconds: number,
  color: Color,
  glow: Color,
): void {
  for (let i = 0; i < count; i++) {
    const spot = scatter(p, radius * 0.85);
    const delay = (i / count) * seconds;
    put(c, 'pillar', spot, 0.35, color, 0.3, { delay });
    put(c, 'burst', spot, 1.3, glow, 0.35, { delay: delay + 0.12, angle: Math.random() * TURN });
  }
}

/**
 * The visual of every ability, keyed by ability id. Each is a handful of simple shapes with their
 * own colours and timing. An ability missing here gets a plain visual chosen by how it is aimed.
 */
export const ABILITY_FX: Record<string, (c: CastFxContext) => void> = {
  // Kael: steel and shield-blue.
  kael_charge: (c) => {
    draw(c, 'line', c.from, c.caster, 1.4, C.steel, 0.35);
    put(c, 'slash', c.caster, 1.8, C.white, 0.3, { angle: angle(c.from, c.caster) });
    put(c, 'ring', c.caster, 1.4, c.side, 0.4);
  },
  kael_guard: (c) => {
    put(c, 'ring', c.caster, 2.4, C.guard, 0.45, { inward: true });
    put(c, 'pillar', c.caster, 1.1, C.guard, 0.6);
    put(c, 'ring', c.caster, 1.5, C.white, 0.7, { delay: 0.25 });
  },
  kael_bash: (c) => {
    put(c, 'slash', c.at, 1.5, C.steel, 0.25, { angle: angle(c.caster, c.at) });
    put(c, 'burst', c.at, 1.7, C.stun, 0.4, { delay: 0.05 });
    put(c, 'ring', c.at, 1.2, c.side, 0.4);
  },
  kael_verdict: (c) => {
    put(c, 'pillar', c.at, 1.8, C.dawn, 0.5);
    put(c, 'disc', c.at, 3.5, c.side, 0.3);
    put(c, 'burst', c.at, 3.8, C.stun, 0.5, { delay: 0.05 });
    put(c, 'ring', c.at, 3.5, c.side, 0.5);
    put(c, 'ring', c.at, 4.6, C.steel, 0.6, { delay: 0.12 });
  },

  // Lyra: thin, precise, with a red mark.
  lyra_trap: (c) => {
    put(c, 'ring', c.at, 1.5, C.steel, 0.45, { inward: true });
    put(c, 'burst', c.at, 0.9, C.steel, 0.35, { delay: 0.3 });
  },
  lyra_mark: (c) => {
    put(c, 'ring', c.at, 2.2, C.mark, 0.4, { inward: true });
    put(c, 'burst', c.at, 1.3, C.mark, 0.5, { delay: 0.3 });
    put(c, 'pillar', c.at, 0.25, C.mark, 0.6, { delay: 0.3 });
  },
  lyra_tumble: (c) => {
    draw(c, 'line', c.from, c.caster, 0.7, C.tech, 0.3);
    put(c, 'ring', c.from, 1, C.wind, 0.35);
    put(c, 'ring', c.caster, 1.2, C.wind, 0.4, { delay: 0.1 });
  },
  lyra_final_shot: (c) => {
    put(c, 'ring', c.caster, 1.6, C.light, 0.3, { inward: true });
    draw(c, 'line', c.caster, c.at, 1.6, c.side, 0.45);
    draw(c, 'line', c.caster, c.at, 0.5, C.white, 0.6);
    for (let i = 1; i <= 4; i++) put(c, 'ring', along(c.caster, c.at, i / 4.5), 1.4, C.light, 0.4, { delay: i * 0.04 });
  },

  // Ignar: fire.
  ignar_breath: (c) => {
    const direction = angle(c.caster, c.at);
    put(c, 'cone', c.caster, 7, C.fire, 0.5, { angle: direction });
    put(c, 'cone', c.caster, 5, C.flame, 0.4, { angle: direction, delay: 0.08 });
    for (let i = 1; i <= 3; i++)
      put(c, 'burst', along(c.caster, c.at, i / 3.3), 1.3, C.flame, 0.35, { delay: i * 0.07, angle: i });
  },
  ignar_fireball: (c) => {
    draw(c, 'line', c.caster, c.at, 0.45, C.flame, 0.2);
    put(c, 'disc', c.at, 2.5, C.fire, 0.4, { delay: 0.1 });
    put(c, 'burst', c.at, 2.9, C.flame, 0.45, { delay: 0.1 });
    put(c, 'ring', c.at, 2.6, c.side, 0.5, { delay: 0.1 });
  },
  ignar_gust: (c) => {
    for (let i = 0; i < 3; i++) put(c, 'ring', c.caster, 3.5 + i * 0.5, C.wind, 0.45, { delay: i * 0.09 });
    for (let i = 0; i < 4; i++) put(c, 'slash', c.caster, 2.6, C.white, 0.4, { angle: (i / 4) * TURN, delay: 0.03 });
  },
  ignar_firestorm: (c) => {
    put(c, 'ring', c.at, 4.5, c.side, 1.2);
    put(c, 'disc', c.at, 4.5, C.fire, 0.6);
    rain(c, c.at, 4.5, 12, 3.4, C.fire, C.flame);
  },

  // Baru: earth and stone.
  baru_ram: (c) => {
    draw(c, 'line', c.from, c.caster, 1.8, C.earth, 0.4);
    put(c, 'burst', c.caster, 2.2, C.earth, 0.4);
    put(c, 'ring', c.caster, 1.8, c.side, 0.4);
  },
  baru_petrify: (c) => {
    put(c, 'ring', c.caster, 2.6, C.stone, 0.5, { inward: true });
    put(c, 'disc', c.caster, 1.5, C.stone, 0.9, { delay: 0.3 });
    put(c, 'pillar', c.caster, 1.2, C.stone, 0.7, { delay: 0.3 });
  },
  baru_stomp: (c) => {
    put(c, 'burst', c.caster, 3.6, C.earth, 0.45);
    put(c, 'ring', c.caster, 3.5, c.side, 0.5);
    put(c, 'ring', c.caster, 2.3, C.earth, 0.5, { delay: 0.08 });
    spokes(c, c.caster, 3.3, 5, C.crack, 0.6);
  },
  baru_avalanche: (c) => {
    put(c, 'disc', c.at, 4, C.earth, 0.4);
    put(c, 'burst', c.at, 4.6, C.stone, 0.55);
    put(c, 'ring', c.at, 4, c.side, 0.5);
    put(c, 'ring', c.at, 5.2, C.earth, 0.7, { delay: 0.12 });
    spokes(c, c.at, 4, 7, C.crack, 0.8);
  },

  // Sola: warm light.
  sola_heal: (c) => {
    put(c, 'pillar', c.caster, 0.9, C.heal, 0.7);
    put(c, 'ring', c.caster, 4, C.heal, 0.7);
    put(c, 'burst', c.caster, 1.8, C.dawn, 0.5);
  },
  sola_shield: (c) => {
    put(c, 'ring', c.caster, 6, C.dawn, 0.6);
    put(c, 'ring', c.caster, 6, C.light, 0.5, { inward: true, delay: 0.3 });
    put(c, 'pillar', c.caster, 0.8, C.dawn, 0.6);
  },
  sola_ray: (c) => {
    put(c, 'burst', c.caster, 1.4, C.light, 0.3);
    draw(c, 'line', c.caster, c.at, 1.4, C.dawn, 0.4);
    draw(c, 'line', c.caster, c.at, 0.45, C.white, 0.55);
    put(c, 'ring', c.at, 1.2, c.side, 0.4, { delay: 0.05 });
  },
  sola_dawn: (c) => {
    put(c, 'pillar', c.caster, 2.6, C.dawn, 1.1);
    put(c, 'disc', c.caster, 10, C.dawn, 0.7);
    put(c, 'burst', c.caster, 6.5, C.light, 0.8);
    for (let i = 0; i < 3; i++) put(c, 'ring', c.caster, 10, C.dawn, 0.9, { delay: i * 0.18 });
  },

  // Vesper: violet shadow.
  vesper_ambush: (c) => {
    put(c, 'ring', c.from, 1.3, C.shadow, 0.35, { inward: true });
    draw(c, 'line', c.from, c.caster, 0.45, C.shadow, 0.3);
    put(c, 'slash', c.at, 1.6, C.white, 0.25, { angle: angle(c.caster, c.at), delay: 0.05 });
    put(c, 'burst', c.at, 1.5, C.shadow, 0.4, { delay: 0.08 });
  },
  vesper_shroud: (c) => {
    put(c, 'ring', c.caster, 2.6, C.shadow, 0.5, { inward: true });
    put(c, 'disc', c.caster, 1.9, C.dark, 0.8);
    put(c, 'pillar', c.caster, 0.9, C.shadow, 0.5, { delay: 0.2 });
  },
  vesper_dart: (c) => {
    draw(c, 'line', c.caster, c.at, 0.5, C.shadow, 0.35);
    draw(c, 'line', c.caster, c.at, 1.2, c.side, 0.2);
    put(c, 'slash', c.at, 1.2, C.shadow, 0.3, { angle: angle(c.caster, c.at), delay: 0.08 });
  },
  vesper_darkness: (c) => {
    put(c, 'ring', c.at, 6.2, C.shadow, 0.6, { inward: true });
    put(c, 'disc', c.at, 5, C.dark, 1.2);
    put(c, 'ring', c.at, 5, c.side, 0.9, { delay: 0.3 });
  },

  // Bolt-7: gunfire and heat.
  bolt_burst: (c) => {
    const side = angle(c.caster, c.at) + Math.PI / 2;
    put(c, 'burst', c.caster, 1.2, C.flame, 0.2);
    for (let i = 0; i < 4; i++) {
      const shift = (i - 1.5) * 0.28;
      draw(c, 'line', around(c.caster, shift, side), around(c.at, shift, side), 0.22, C.stun, 0.18, i * 0.06);
    }
    draw(c, 'line', c.caster, c.at, 1.4, c.side, 0.3);
  },
  bolt_siege: (c) => {
    put(c, 'ring', c.caster, 2.2, C.tech, 0.4, { inward: true });
    put(c, 'burst', c.caster, 1.6, C.tech, 0.4, { delay: 0.3 });
    put(c, 'ring', c.caster, 1.5, C.steel, 0.5, { delay: 0.3 });
  },
  bolt_vent: (c) => {
    put(c, 'disc', c.caster, 3.5, C.fire, 0.35);
    put(c, 'burst', c.caster, 3.8, C.flame, 0.45);
    put(c, 'ring', c.caster, 3.5, c.side, 0.5);
    for (let i = 0; i < 5; i++) put(c, 'pillar', scatter(c.caster, 2.4), 0.4, C.white, 0.6, { delay: i * 0.05 });
  },
  bolt_orbital: (c) => {
    put(c, 'ring', c.at, 3.5, c.side, 0.35, { inward: true });
    put(c, 'pillar', c.at, 1.5, C.volt, 0.6, { delay: 0.1 });
    put(c, 'pillar', c.at, 0.6, C.white, 0.7, { delay: 0.1 });
    put(c, 'disc', c.at, 3.5, C.volt, 0.4, { delay: 0.15 });
    put(c, 'burst', c.at, 4, C.white, 0.5, { delay: 0.15 });
    put(c, 'ring', c.at, 4.6, C.volt, 0.6, { delay: 0.22 });
  },

  // Mekka: green build-light and blue current.
  mekka_turret: (c) => {
    put(c, 'ring', c.at, 1.6, C.tech, 0.4, { inward: true });
    put(c, 'pillar', c.at, 0.5, C.tech, 0.5, { delay: 0.2 });
    put(c, 'burst', c.at, 1.1, C.tech, 0.4, { delay: 0.3 });
  },
  mekka_repair: (c) => {
    put(c, 'pillar', c.caster, 0.7, C.tech, 0.6);
    put(c, 'ring', c.caster, 3, C.tech, 0.6);
    put(c, 'burst', c.caster, 1.3, C.flame, 0.4, { delay: 0.1 });
  },
  mekka_emp: (c) => {
    draw(c, 'line', c.caster, c.at, 0.3, C.volt, 0.2);
    put(c, 'disc', c.at, 2.5, C.volt, 0.35, { delay: 0.1 });
    put(c, 'ring', c.at, 2.6, c.side, 0.5, { delay: 0.1 });
    spokes(c, c.at, 2.6, 6, C.white, 0.45);
  },
  mekka_overdrive: (c) => {
    put(c, 'pillar', c.caster, 1.2, C.tech, 0.8);
    put(c, 'burst', c.caster, 5, C.flame, 0.6);
    for (let i = 0; i < 2; i++) put(c, 'ring', c.caster, 12, C.tech, 0.9, { delay: i * 0.2 });
  },

  // Astor (id mira): starlight.
  mira_bolt: (c) => {
    draw(c, 'line', c.caster, c.at, 1.3, C.star, 0.4);
    draw(c, 'line', c.caster, c.at, 0.4, C.white, 0.5);
    put(c, 'burst', c.at, 1.4, C.star, 0.4, { delay: 0.05 });
  },
  mira_bind: (c) => {
    put(c, 'ring', c.at, 2.2, c.side, 0.5, { inward: true });
    for (let i = 0; i < 5; i++) draw(c, 'line', around(c.at, 2.6, (i / 5) * TURN), c.at, 0.18, C.star, 0.6, 0.05);
    put(c, 'burst', c.at, 1.4, C.white, 0.4, { delay: 0.25 });
  },
  mira_blink: (c) => {
    put(c, 'ring', c.from, 1.4, C.star, 0.35, { inward: true });
    put(c, 'pillar', c.from, 0.5, C.star, 0.35);
    put(c, 'pillar', c.caster, 0.6, C.white, 0.4, { delay: 0.08 });
    put(c, 'ring', c.caster, 1.5, C.star, 0.4, { delay: 0.08 });
  },
  mira_starfall: (c) => {
    put(c, 'ring', c.at, 4, c.side, 1.2);
    put(c, 'disc', c.at, 4, C.star, 0.5);
    rain(c, c.at, 4, 12, 2.6, C.white, C.star);
  },

  // Zerak: lightning.
  zerak_claw: (c) => {
    const direction = angle(c.from, c.caster);
    draw(c, 'bolt', c.from, c.caster, 1.4, C.spark, 0.35);
    for (let i = -1; i <= 1; i++)
      put(c, 'slash', c.caster, 1.7, C.white, 0.3, { angle: direction + i * 0.35, delay: 0.04 * (i + 1) });
  },
  zerak_charge: (c) => {
    put(c, 'ring', c.caster, 2.2, C.spark, 0.4, { inward: true });
    spokes(c, c.caster, 2, 5, C.spark, 0.5);
    put(c, 'pillar', c.caster, 0.5, C.white, 0.3, { delay: 0.3 });
  },
  zerak_roar: (c) => {
    for (let i = 0; i < 3; i++) put(c, 'ring', c.caster, 3.5, i === 0 ? c.side : C.spark, 0.5, { delay: i * 0.1 });
    spokes(c, c.caster, 3.5, 7, C.white, 0.5);
  },
  zerak_strike: (c) => {
    draw(c, 'bolt', c.from, c.at, 1.3, C.spark, 0.4);
    put(c, 'pillar', c.at, 1.1, C.white, 0.45);
    put(c, 'burst', c.at, 2.6, C.spark, 0.45, { delay: 0.05 });
    put(c, 'ring', c.at, 2, c.side, 0.5);
    spokes(c, c.at, 2.4, 5, C.white, 0.4);
  },

  // Orun: mountain and gold.
  orun_hammer: (c) => {
    put(c, 'pillar', c.at, 0.5, C.dawn, 0.3);
    put(c, 'burst', c.at, 2.1, C.earth, 0.4, { delay: 0.05 });
    put(c, 'ring', c.at, 1.8, c.side, 0.45, { delay: 0.05 });
    spokes(c, c.at, 1.8, 4, C.crack, 0.6);
  },
  orun_bulwark: (c) => {
    put(c, 'disc', c.caster, 5, C.earth, 0.5);
    put(c, 'ring', c.caster, 5, C.dawn, 0.6);
    put(c, 'ring', c.caster, 5, C.stone, 0.5, { inward: true, delay: 0.3 });
  },
  orun_pull: (c) => {
    draw(c, 'bolt', c.at, c.caster, 1.6, C.crack, 0.7);
    draw(c, 'line', c.at, c.caster, 1.6, c.side, 0.3);
    for (let i = 0; i < 4; i++)
      put(c, 'ring', along(c.at, c.caster, i / 4), 1.4, C.earth, 0.35, { inward: true, delay: i * 0.07 });
  },
  orun_quake: (c) => {
    put(c, 'disc', c.caster, 4.5, C.earth, 0.4);
    put(c, 'burst', c.caster, 4.8, C.dawn, 0.5);
    for (let i = 0; i < 3; i++) put(c, 'ring', c.caster, 4.5, i === 0 ? c.side : C.earth, 0.6, { delay: i * 0.12 });
    spokes(c, c.caster, 4.5, 8, C.crack, 0.9);
  },

  // Raze-3: hot steel.
  raze_saw: (c) => {
    const direction = angle(c.from, c.caster);
    draw(c, 'line', c.from, c.caster, 1.5, C.saw, 0.35);
    for (let i = 1; i <= 3; i++) {
      const spot = along(c.from, c.caster, i / 3.5);
      put(c, 'slash', spot, 1.3, C.white, 0.25, { angle: direction + (i % 2 ? 1.2 : -1.2), delay: i * 0.04 });
      put(c, 'burst', spot, 0.9, C.flame, 0.25, { delay: i * 0.04, angle: i });
    }
  },
  raze_boost: (c) => {
    put(c, 'ring', c.caster, 2.2, C.saw, 0.4, { inward: true });
    put(c, 'pillar', c.caster, 0.6, C.saw, 0.5, { delay: 0.2 });
    put(c, 'burst', c.caster, 1.6, C.flame, 0.35, { delay: 0.3 });
  },
  raze_blade: (c) => {
    draw(c, 'line', c.caster, c.at, 0.35, C.steel, 0.25);
    put(c, 'slash', c.at, 1.3, C.white, 0.3, { angle: angle(c.caster, c.at), delay: 0.06 });
    put(c, 'ring', c.at, 1.8, C.mark, 0.45, { inward: true, delay: 0.1 });
  },
  raze_execute: (c) => {
    const direction = angle(c.caster, c.at);
    put(c, 'ring', c.from, 1.2, C.saw, 0.3, { inward: true });
    draw(c, 'line', c.from, c.caster, 0.35, C.saw, 0.25);
    put(c, 'slash', c.at, 2, C.mark, 0.3, { angle: direction + 0.8, delay: 0.05 });
    put(c, 'slash', c.at, 2, C.white, 0.3, { angle: direction - 0.8, delay: 0.12 });
    put(c, 'burst', c.at, 1.8, C.mark, 0.4, { delay: 0.15 });
  },

  // Elna: pale green, a medic's colours.
  elna_bolt: (c) => {
    draw(c, 'line', c.caster, c.at, 1.3, c.side, 0.3);
    draw(c, 'line', c.caster, c.at, 0.35, C.white, 0.45);
    put(c, 'ring', c.at, 1.1, C.tech, 0.4, { delay: 0.05 });
  },
  elna_mend: (c) => {
    put(c, 'pillar', c.caster, 0.7, C.heal, 0.6);
    put(c, 'ring', c.caster, 2.2, C.heal, 0.5, { inward: true });
    put(c, 'burst', c.caster, 1.4, C.white, 0.4, { delay: 0.25 });
  },
  elna_smoke: (c) => {
    draw(c, 'line', c.caster, c.at, 0.3, C.steel, 0.2);
    put(c, 'disc', c.at, 3, C.stone, 1.1, { delay: 0.1 });
    for (let i = 0; i < 3; i++) put(c, 'ring', c.at, 3 + i * 0.3, C.steel, 0.7, { delay: 0.1 + i * 0.12 });
  },
  elna_rally: (c) => {
    put(c, 'pillar', c.caster, 1, C.dawn, 0.8);
    put(c, 'burst', c.caster, 4, C.flame, 0.6);
    for (let i = 0; i < 2; i++) put(c, 'ring', c.caster, 9, C.dawn, 0.8, { delay: i * 0.18 });
  },

  // Nyx: venom green and acid yellow.
  nyx_spit: (c) => {
    draw(c, 'line', c.caster, c.at, 1.4, c.side, 0.25);
    draw(c, 'line', c.caster, c.at, 0.6, C.venom, 0.45);
    for (let i = 1; i <= 3; i++)
      put(c, 'burst', along(c.caster, c.at, i / 3.2), 0.9, C.acid, 0.3, { delay: i * 0.05, angle: i });
  },
  nyx_pool: (c) => {
    draw(c, 'line', c.caster, c.at, 0.4, C.acid, 0.2);
    put(c, 'disc', c.at, 3, C.venom, 0.7, { delay: 0.1 });
    put(c, 'ring', c.at, 3, c.side, 0.9, { delay: 0.1 });
    rain(c, c.at, 3, 6, 1.5, C.acid, C.venom);
  },
  nyx_glide: (c) => {
    draw(c, 'line', c.from, c.caster, 1, C.venom, 0.3);
    put(c, 'slash', c.caster, 1.6, C.wind, 0.3, { angle: angle(c.from, c.caster) });
    put(c, 'ring', c.from, 1.2, C.wind, 0.35);
  },
  nyx_plague: (c) => {
    put(c, 'ring', c.at, 4.6, C.venom, 0.4, { inward: true });
    put(c, 'disc', c.at, 4, C.venom, 0.8, { delay: 0.2 });
    put(c, 'burst', c.at, 4.2, C.acid, 0.5, { delay: 0.2 });
    put(c, 'ring', c.at, 4, c.side, 0.7, { delay: 0.2 });
  },

  // Thana, the god of death (id aeris): the green of grave-light, and bone.
  aeris_gale: (c) => {
    const direction = angle(c.caster, c.at);
    draw(c, 'line', c.caster, c.at, 1.4, C.soul, 0.35);
    for (let i = 1; i <= 3; i++)
      put(c, 'slash', along(c.caster, c.at, i / 3.3), 1.5, C.bone, 0.3, { angle: direction, delay: i * 0.05 });
  },
  aeris_cyclone: (c) => {
    put(c, 'pillar', c.at, 1.3, C.soul, 0.7);
    for (let i = 0; i < 4; i++)
      put(c, 'slash', c.at, 1.4 + i * 0.4, C.bone, 0.45, { angle: (i / 4) * TURN, delay: i * 0.06 });
    put(c, 'ring', c.at, 2.6, c.side, 0.5);
  },
  aeris_drift: (c) => {
    put(c, 'ring', c.caster, 2.2, C.soul, 0.4, { inward: true });
    put(c, 'ring', c.caster, 1.5, C.guard, 0.6, { delay: 0.25 });
    put(c, 'slash', c.caster, 1.6, C.bone, 0.4, { angle: Math.random() * TURN, delay: 0.1 });
  },
  aeris_tempest: (c) => {
    put(c, 'ring', c.at, 4.5, c.side, 1.2);
    put(c, 'disc', c.at, 4.5, C.soul, 0.6);
    for (let i = 0; i < 6; i++) {
      const delay = i * 0.55;
      const spot = scatter(c.at, 3.5);
      put(c, 'pillar', spot, 0.4, C.bone, 0.25, { delay });
      draw(c, 'bolt', spot, scatter(spot, 2.2), 1, C.spark, 0.35, delay);
      put(c, 'slash', c.at, 3.4, C.soul, 0.5, { angle: i * 1.1, delay });
    }
  },

  // Titan-9: heavy steel and a hot core.
  titan_punch: (c) => {
    put(c, 'burst', c.at, 1.9, C.stun, 0.4);
    put(c, 'ring', c.at, 1.4, c.side, 0.4);
    put(c, 'slash', c.at, 1.5, C.steel, 0.25, { angle: angle(c.caster, c.at) });
  },
  titan_barrier: (c) => {
    put(c, 'ring', c.caster, 5, C.volt, 0.5);
    put(c, 'ring', c.caster, 5, C.tech, 0.5, { inward: true, delay: 0.25 });
    put(c, 'pillar', c.caster, 1.2, C.volt, 0.6);
  },
  titan_magnet: (c) => {
    draw(c, 'line', c.at, c.caster, 1.6, c.side, 0.3);
    draw(c, 'bolt', c.at, c.caster, 1.2, C.volt, 0.5);
    for (let i = 0; i < 4; i++)
      put(c, 'ring', along(c.at, c.caster, i / 4), 1.3, C.volt, 0.3, { inward: true, delay: i * 0.07 });
  },
  titan_meltdown: (c) => {
    put(c, 'ring', c.caster, 4.5, C.fire, 0.3, { inward: true });
    put(c, 'pillar', c.caster, 1.6, C.flame, 0.6, { delay: 0.2 });
    put(c, 'disc', c.caster, 4.5, C.fire, 0.4, { delay: 0.2 });
    put(c, 'burst', c.caster, 4.9, C.flame, 0.5, { delay: 0.2 });
    put(c, 'ring', c.caster, 4.5, c.side, 0.6, { delay: 0.2 });
    spokes(c, c.caster, 4.2, 6, C.white, 0.5);
  },
  // Kubo-6: the colours of its tiles, thrown about.
  kubo_twist: (c) => {
    const direction = angle(c.caster, c.at);
    draw(c, 'line', c.caster, c.at, 1.5, C.volt, 0.35);
    for (let i = 1; i <= 4; i++)
      put(c, 'slash', along(c.caster, c.at, i / 4.4), 1.4, TILE[i % TILE.length], 0.3, {
        angle: direction + i * 1.57,
        delay: i * 0.04,
      });
  },
  kubo_scramble: (c) => {
    for (let i = 0; i < 6; i++)
      put(c, 'burst', scatter(c.at, 1.2), 0.9, TILE[i % TILE.length], 0.3, { delay: i * 0.05, angle: i * 1.3 });
    put(c, 'ring', c.at, 1.9, C.volt, 0.5, { inward: true });
    put(c, 'ring', c.at, 1.6, c.side, 0.5, { delay: 0.15 });
  },
  kubo_roll: (c) => {
    draw(c, 'line', c.from, c.caster, 1.1, C.volt, 0.3);
    for (let i = 1; i <= 3; i++) put(c, 'ring', along(c.from, c.caster, i / 3), 1, TILE[i], 0.3, { delay: i * 0.05 });
    put(c, 'ring', c.caster, 1.6, C.guard, 0.6, { delay: 0.2 });
  },
  // The reading itself: a beam to the one read and a ring closing on them. What was read is cast
  // right after, with its own look.
  kubo_solve: (c) => {
    draw(c, 'line', c.caster, c.at, 0.5, C.volt, 0.35);
    put(c, 'ring', c.at, 2.6, C.volt, 0.5, { inward: true });
    put(c, 'ring', c.caster, 2.2, C.white, 0.4);
    for (let i = 0; i < 6; i++) put(c, 'burst', c.caster, 1.2 + i * 0.2, TILE[i], 0.35, { delay: i * 0.04, angle: i });
    put(c, 'pillar', c.at, 0.7, C.volt, 0.5, { delay: 0.15 });
  },
};
