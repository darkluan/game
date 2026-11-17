import { useEffect, useRef } from 'react';
import type { GameSession } from '@/lib/session';
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

    for (const b of game.buildings()) {
      if (!game.exists(b.id)) continue;
      const size = b.kind === 'shrine' ? 12 : 8;
      ctx.fillStyle = side(b.team);
      ctx.fillRect(px(b.pos.x) - size / 2, pz(b.pos.z) - size / 2, size, size);
    }
    for (const m of game.minions()) {
      if (m.dead) continue;
      ctx.fillStyle = side(m.team);
      ctx.fillRect(px(m.pos.x) - 1.5, pz(m.pos.z) - 1.5, 3, 3);
    }
    for (const h of game.heroes()) {
      if (h.dead) continue;
      ctx.beginPath();
      ctx.arc(px(h.pos.x), pz(h.pos.z), h === game.hero ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = h === game.hero ? colors.self : side(h.team);
      ctx.fill();
    }
  }, [hud, game, halfWidth, halfDepth, scale, height]);

  return (
    <canvas
      ref={canvas}
      width={WIDTH}
      height={height}
      role="img"
      aria-label="Bản đồ nhỏ. Bấm để di chuyển tới đó."
      className="pointer-events-auto cursor-pointer rounded-md border border-border bg-panel"
      onPointerDown={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        game.send({
          t: 'move',
          x: ((e.clientX - rect.left) / rect.width) * halfWidth * 2 - halfWidth,
          z: ((e.clientY - rect.top) / rect.height) * halfDepth * 2 - halfDepth,
        });
      }}
    />
  );
}
