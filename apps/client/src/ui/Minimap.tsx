import { tr } from '@/i18n';
import { useEffect, useRef } from 'react';
import type { GameSession } from '@/lib/session';
import { minimapPoint } from '@/lib/minimapPoint';
import { useGameStore } from '@/store/gameStore';

const WIDTH = 250;

/** Reads the design tokens so the map uses the same colours as the rest of the HUD. */
function tokens() {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string) => style.getPropertyValue(name).trim();
  return {
    ally: get('--ally'),
    enemy: get('--enemy'),
    self: get('--primary'),
    wall: get('--border'),
    lane: get('--muted-foreground'),
    bush: get('--hp'),
    monster: get('--gold'),
  };
}

/** Top-down overview of the whole map. Click it to walk there. */
export function Minimap({ game }: { game: GameSession }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  // Redraw whenever the HUD state changes, i.e. once per game tick.
  const hud = useGameStore((s) => s.hud);
  const { halfWidth, halfDepth } = game.map;
  const scale = WIDTH / (halfWidth * 2);
  const height = Math.round(halfDepth * 2 * scale);

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const colors = tokens();
    const px = (x: number) => (x + halfWidth) * scale;
    const pz = (z: number) => (z + halfDepth) * scale;
    const side = (team: number) => (team === game.hero.team ? colors.ally : colors.enemy);
    ctx.clearRect(0, 0, WIDTH, height);

    ctx.globalAlpha = 0.35;
    ctx.fillStyle = colors.lane;
    ctx.fillRect(px(game.map.shrines[0].x), pz(-6), px(game.map.shrines[1].x) - px(game.map.shrines[0].x), 12 * scale);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.wall;
    for (const o of game.map.obstacles) ctx.fillRect(px(o.x - o.w / 2), pz(o.z - o.d / 2), o.w * scale, o.d * scale);

    ctx.globalAlpha = 0.5;
    ctx.fillStyle = colors.bush;
    for (const b of game.map.bushes) ctx.fillRect(px(b.x - b.w / 2), pz(b.z - b.d / 2), b.w * scale, b.d * scale);
    ctx.globalAlpha = 1;
    ctx.fillStyle = colors.monster;
    for (const m of game.monsters()) {
      if (m.dead) continue;
      // The Ancient Beast is a big red square; camp monsters are small.
      const beast = m.monster.type === 'beast';
      const size = beast ? 10 : m.monster.type === 'big' ? 5 : 3;
      ctx.fillStyle = beast ? colors.enemy : colors.monster;
      ctx.fillRect(px(m.pos.x) - size / 2, pz(m.pos.z) - size / 2, size, size);
    }

    // Relic pedestals: hollow when dark, filled and ringed while lit. The Beast's cave is a ring.
    const lit = game.world().relic;
    ctx.strokeStyle = colors.self;
    ctx.fillStyle = colors.self;
    game.map.pedestals.forEach((p, i) => {
      const active = lit?.pedestal === i;
      ctx.lineWidth = active ? 2 : 1;
      ctx.beginPath();
      ctx.arc(px(p.x), pz(p.z), active ? 5 : 3, 0, Math.PI * 2);
      if (active) ctx.fill();
      ctx.stroke();
      if (!active) return;
      ctx.beginPath();
      ctx.arc(px(p.x), pz(p.z), 9, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.lineWidth = 1;
    ctx.strokeStyle = colors.enemy;
    ctx.beginPath();
    ctx.arc(px(game.map.beastCave.x), pz(game.map.beastCave.z), 5, 0, Math.PI * 2);
    ctx.stroke();

    for (const b of game.buildings()) {
      if (!game.exists(b.id)) continue;
      const size = b.kind === 'shrine' ? 12 : 8;
      ctx.fillStyle = side(b.team);
      ctx.fillRect(px(b.pos.x) - size / 2, pz(b.pos.z) - size / 2, size, size);
    }
    for (const m of game.minions()) {
      if (m.dead) continue;
      ctx.fillStyle = side(m.team);
      // The marching Beast stands out among its wave.
      const size = m.minion.type === 'beast' ? 9 : 3;
      ctx.fillRect(px(m.pos.x) - size / 2, pz(m.pos.z) - size / 2, size, size);
    }
    for (const h of game.heroes()) {
      if (h.dead) continue;
      ctx.beginPath();
      ctx.arc(px(h.pos.x), pz(h.pos.z), h === game.hero ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = h === game.hero ? colors.self : side(h.team);
      ctx.fill();
    }
    // Signals from teammates, each in its colour: a ring that spreads and fades.
    ctx.lineWidth = 2;
    for (const ping of game.pings) {
      ctx.strokeStyle = ping.type === 'attack' ? colors.enemy : ping.type === 'retreat' ? colors.monster : colors.ally;
      const age = (game.clock - ping.at) % 1;
      ctx.globalAlpha = 1 - age;
      ctx.beginPath();
      ctx.arc(px(ping.x), pz(ping.z), 4 + age * 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }, [hud, game, halfWidth, halfDepth, scale, height]);

  return (
    <canvas
      ref={canvas}
      width={WIDTH}
      height={height}
      role="img"
      aria-label={tr('Bản đồ nhỏ. Bấm để di chuyển tới đó.')}
      // Lets a signal button dragged onto the map find it.
      data-minimap
      className="pointer-events-auto cursor-pointer rounded-md hud-panel"
      onPointerDown={(e) => {
        const { x, z } = minimapPoint(e.currentTarget, e.clientX, e.clientY, game.map);
        // Alt+click calls the team to the spot instead of walking there.
        if (game.chatEnabled && e.altKey) game.sendChat({ k: 'ping', type: 'gather', x, z });
        else game.send({ t: 'move', x, z });
      }}
    />
  );
}
