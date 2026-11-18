import { lazy, type ReactNode, Suspense } from 'react';
import { Link } from 'react-router';
import { useWideLayout } from '@/hooks/useWideLayout';
import { useServerStatus } from '@/net/serverStatus';
import { useSettingsStore } from '@/store/settingsStore';
import { SoundSettings } from '@/ui/SoundSettings';

// three.js is most of the bundle: the menu shows at once and the backdrop fades in when it arrives.
const LobbyScene = lazy(() => import('@/scene/LobbyScene'));

function ServerStatusChip() {
  const { status, retry } = useServerStatus();
  const chip = 'glass-panel flex items-center gap-2 rounded-full px-3 py-1.5 text-xs';
  if (status.state === 'connecting') {
    return (
      <p className={`${chip} text-muted-foreground`}>
        <span aria-hidden className="size-2 animate-pulse-dot rounded-full bg-muted-foreground" />
        Đang kết nối máy chủ…
      </p>
    );
  }
  if (status.state === 'online') {
    return (
      <p className={`${chip} text-hp`}>
        <span aria-hidden className="size-2 animate-pulse-dot rounded-full bg-hp" />
        Máy chủ sẵn sàng · {status.pingMs} ms · {status.tickRate} tick/giây
      </p>
    );
  }
  return (
    <p className={`${chip} text-danger`}>
      <span aria-hidden className="size-2 rounded-full bg-danger" />
      Mất kết nối máy chủ
      <button type="button" onClick={retry} className="cursor-pointer font-semibold underline">
        Thử lại
      </button>
    </p>
  );
}

interface Props {
  children: ReactNode;
  /** A second block of content. On wide screens it gets its own column on the right. */
  aside?: ReactNode;
  /** The buttons that move on. They come last on a narrow screen and sit under `children` on a wide one. */
  actions?: ReactNode;
  /** The hero to put on show in the backdrop, when the screen is wide enough to leave room for it. */
  heroId?: string;
}

/** Frame shared by every screen outside a match: the 3D backdrop, the top bar and the sound controls. */
export function LobbyShell({ children, aside, actions, heroId }: Props) {
  const wide = useWideLayout();
  const column =
    'mx-auto flex w-full max-w-xl flex-col items-center gap-6 text-center lg:mx-0 lg:items-start lg:text-left';
  const graphics = useSettingsStore((s) => s.graphics);
  return (
    <div className="relative h-full overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Suspense fallback={null}>
          <div className="h-full animate-fade">
            <LobbyScene graphics={graphics} heroId={wide ? heroId : undefined} />
          </div>
        </Suspense>
      </div>
      <div aria-hidden className="lobby-veil pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col overflow-y-auto">
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 lg:px-10">
          <Link to="/" className="flex items-center gap-3 text-sm font-extrabold tracking-[0.3em] uppercase">
            <img src="favicon.svg" alt="" className="size-9" />
            Tứ Tộc
          </Link>
          <ServerStatusChip />
        </header>
        <main
          className={`grid flex-1 grid-cols-[minmax(0,1fr)] content-center gap-6 px-5 py-6 lg:px-24 ${aside ? 'xl:grid-cols-[minmax(0,32rem)_1fr_24rem] xl:gap-x-8 xl:px-16' : ''}`}
        >
          <div className={`${column} xl:col-start-1 xl:self-end`}>{children}</div>
          {aside && (
            <aside className="glass-panel mx-auto w-full max-w-xl animate-rise rounded-xl p-4 [animation-delay:320ms] lg:mx-0 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-center">
              {aside}
            </aside>
          )}
          {actions && <div className={`${column} xl:col-start-1 xl:row-start-2 xl:self-start`}>{actions}</div>}
        </main>
        <footer className="px-5 py-4 lg:px-10">
          <SoundSettings />
          <Link to="/credits" className="mt-2 block text-center text-xs text-muted-foreground underline lg:text-left">
            Ghi công
          </Link>
        </footer>
      </div>
    </div>
  );
}
