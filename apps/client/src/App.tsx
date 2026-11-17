import { lazy, Suspense } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { Hud } from '@/ui/Hud';
import { MainMenu } from '@/ui/MainMenu';

// three.js is most of the bundle; load it only when a match starts.
const GameScene = lazy(() => import('@/scene/GameScene'));

export function App() {
  const game = useGameStore((s) => s.game);
  const graphics = useSettingsStore((s) => s.graphics);
  if (!game) return <MainMenu />;
  return (
    <div className="relative h-full">
      <Suspense fallback={<p className="flex h-full items-center justify-center text-muted-foreground">Đang tải…</p>}>
        {/* The key rebuilds the scene for each new match and when the graphics mode changes. */}
        <GameScene key={`${game.seed}:${graphics}`} game={game} graphics={graphics} />
      </Suspense>
      <Hud game={game} />
    </div>
  );
}
