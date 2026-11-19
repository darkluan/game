import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { HERO, HEROES, type Vec2 } from '@game/core';
import { synergyMarks } from '@/lib/heroSynergy';
import type { GameSession } from '@/lib/session';
import { RACE_TEXT } from '@/ui/heroText';

/** How far above the ground a hero's name floats: just over its health bar. */
const NAME_HEIGHT = 3.7;

/**
 * A name over each hero's head, in its side's colour: the player's for a person, the hero's for a bot. Plain DOM laid over the canvas and placed
 * by projecting the hero's position, like the floating numbers: crisp at any resolution.
 */
export function HeroNames({ game }: { game: GameSession }) {
  const canvas = useThree((s) => s.gl.domElement);
  const labels = useRef(new Map<number, HTMLDivElement>());
  const scratch = useMemo(() => ({ projected: new Vector3(), pos: { x: 0, z: 0 } as Vec2 }), []);

  useEffect(() => {
    const layer = document.createElement('div');
    layer.className = 'pointer-events-none absolute inset-0 overflow-hidden';
    const made = new Map<number, HTMLDivElement>();
    const marks = synergyMarks(game.roster());
    for (const entry of game.roster()) {
      const label = document.createElement('div');
      const tone =
        entry.id === game.hero.id ? 'text-foreground' : entry.team === game.hero.team ? 'text-ally' : 'text-enemy';
      label.className = `absolute top-0 left-0 text-[11px] font-bold whitespace-nowrap opacity-0 [text-shadow:0_1px_2px_#000,0_0_3px_#000] ${tone}`;
      // A person is known by their own name; a bot has none, so it goes by its hero's.
      label.textContent = entry.playerName || (HEROES[entry.defId]?.name ?? '');
      // The hero's race synergy, ahead of the name: a diamond in the race's colour for a pair, arrows for the speed of three races.
      const mark = marks.get(entry.id);
      if (mark) {
        const badge = document.createElement('span');
        badge.className = `mr-1 ${mark.kind === 'pair' ? RACE_TEXT[mark.race] : 'text-foreground'}`;
        badge.textContent = mark.kind === 'pair' ? '◆' : '»';
        label.prepend(badge);
      }
      layer.appendChild(label);
      made.set(entry.id, label);
    }
    labels.current = made;
    canvas.parentElement?.appendChild(layer);
    return () => {
      layer.remove();
      labels.current = new Map();
    };
  }, [canvas, game]);

  useFrame(({ camera, size }) => {
    const { projected, pos } = scratch;
    for (const entry of game.roster()) {
      const label = labels.current.get(entry.id);
      if (!label) continue;
      // Undefined while the hero is out of the player's sight.
      const hero = game.find(entry.id);
      if (!hero || hero.dead) {
        label.style.opacity = '0';
        continue;
      }
      const p = game.renderPos(hero, pos);
      projected.set(p.x, NAME_HEIGHT * (hero.radius / HERO.radius), p.z).project(camera);
      const left = (projected.x * 0.5 + 0.5) * size.width;
      const top = (-projected.y * 0.5 + 0.5) * size.height;
      label.style.transform = `translate(${left}px, ${top}px) translate(-50%, -50%)`;
      label.style.opacity = '1';
    }
  });

  return null;
}
