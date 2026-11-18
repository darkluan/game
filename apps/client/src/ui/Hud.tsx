import { useTouchLayout } from '@/hooks/useTouchLayout';
import type { GameSession } from '@/lib/session';
import { useGameStore } from '@/store/gameStore';
import { DesktopHud } from './hud/DesktopHud';
import { MobileHud } from './hud/MobileHud';

/** What the HUD's buttons do; differs between offline play and a room. */
export interface HudActions {
  /** Leave the match at any time. */
  exit: () => void;
  /** The main button on the end-of-match screen, e.g. play again or back to the room. */
  afterMatch: { label: string; run: () => void };
}

/** Everything drawn over the match. Picks the touch layout on phones and tablets, the desktop one otherwise. */
export function Hud({ game, actions }: { game: GameSession; actions: HudActions }) {
  const hud = useGameStore((s) => s.hud);
  const touch = useTouchLayout();
  if (!hud) return null;
  const Layout = touch ? MobileHud : DesktopHud;
  return <Layout game={game} hud={hud} actions={actions} />;
}
