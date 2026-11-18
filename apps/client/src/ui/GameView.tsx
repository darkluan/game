import { lazy, Suspense } from 'react';
import type { GameSession } from '@/lib/session';
import { useSettingsStore } from '@/store/settingsStore';
import { Hud, type HudActions } from './Hud';

// three.js is most of the bundle; load it only when a match starts.
const GameScene = lazy(() => import('@/scene/GameScene'));

/** A running match: the 3D scene with the HUD over it. */
export function GameView({ game, actions }: { game: GameSession; actions: HudActions }) {
  const graphics = useSettingsStore((s) => s.graphics);
  return (
    // touch-none: on a phone, dragging on the game must steer the hero, not scroll or zoom the page.
    <div className="relative h-full touch-none">
      <Suspense fallback={<p className="flex h-full items-center justify-center text-muted-foreground">Đang tải…</p>}>
        {/* The key rebuilds the scene for each new match and when the graphics mode changes. */}
        <GameScene key={`${game.seed}:${graphics}`} game={game} graphics={graphics} />
      </Suspense>
      <Hud game={game} actions={actions} />
    </div>
  );
}
