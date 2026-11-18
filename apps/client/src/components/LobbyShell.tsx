import { tr } from '@/i18n';
import { lazy, type ReactNode, Suspense } from 'react';
import { Link } from 'react-router';
import { useWideLayout } from '@/hooks/useWideLayout';
import { useServerStatus } from '@/net/serverStatus';
import { useSettingsStore } from '@/store/settingsStore';
import { AbilitiesShownContext } from '@/ui/abilitiesShown';
import { AbilityPanel } from '@/ui/AbilityPanel';
import { HeroTurnArea } from '@/ui/HeroTurnArea';
import { LangSwitch } from '@/ui/LangSwitch';
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
        {tr('Đang kết nối máy chủ…')}
      </p>
    );
  }
  if (status.state === 'online') {
    return (
      <p className={`${chip} text-hp`}>
        <span aria-hidden className="size-2 animate-pulse-dot rounded-full bg-hp" />
        {tr('Máy chủ sẵn sàng · {ping} ms · {rate} tick/giây', { ping: status.pingMs, rate: status.tickRate })}
      </p>
    );
  }
  return (
    <p className={`${chip} text-danger`}>
      <span aria-hidden className="size-2 rounded-full bg-danger" />
      {tr('Mất kết nối máy chủ')}
      <button type="button" onClick={retry} className="cursor-pointer font-semibold underline">
        {tr('Thử lại')}
      </button>
    </p>
  );
}

/** How big the hero on show is in a pick room, against its size on the home screen. */
const PICK_ROOM_HERO_SIZE = 0.68;

interface Props {
  children: ReactNode;
  /** A second block of content. On wide screens it gets its own column on the right. */
  aside?: ReactNode;
  /** The buttons that move on. They come last on a narrow screen and sit under `children` on a wide one. */
  actions?: ReactNode;
  /**
   * Turns the frame into a pick room: these two blocks stand down the left and right sides (the two
   * teams) and `children` go in the middle, under the hero. `aside` and `actions` are then not used.
   */
  sides?: [ReactNode, ReactNode];
  /** The hero to put on show in the backdrop, when the screen is wide enough to leave room for it. */
  heroId?: string;
}

/** Frame shared by every screen outside a match: the 3D backdrop, the top bar and the sound controls. */
export function LobbyShell({ children, aside, actions, heroId, sides }: Props) {
  const wide = useWideLayout();
  // Where the 3D hero stands in the backdrop: only a wide screen has the room.
  const showHero = wide;
  // The abilities float over the 3D hero only where there is one: a wide screen, with a hero and its picker shown.
  const overHero = wide && heroId !== undefined && aside !== undefined && aside !== null && aside !== false;
  const column =
    'mx-auto flex w-full max-w-xl flex-col items-center gap-6 xl:gap-4 text-center lg:mx-0 lg:items-start lg:text-left squat:mx-0 squat:items-start squat:gap-2 squat:text-left';
  const graphics = useSettingsStore((s) => s.graphics);
  return (
    <div className="relative h-full overflow-hidden">
      {/* In a pick room the scene is drawn a little higher, so the dock along the bottom clears the hero's feet. */}
      <div aria-hidden className={`pointer-events-none absolute inset-0 ${sides && wide ? '-translate-y-[15%]' : ''}`}>
        <Suspense fallback={null}>
          <div className="h-full animate-fade">
            <LobbyScene
              graphics={graphics}
              heroId={wide ? heroId : undefined}
              // In a pick room the hero has to fit between the abilities above it and the dock below, on a laptop's
              // short screen too: it is drawn smaller there.
              heroSize={sides ? PICK_ROOM_HERO_SIZE : 1}
            />
          </div>
        </Suspense>
      </div>
      <div aria-hidden className="lobby-veil pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col overflow-y-auto">
        {/* A pick room keeps its top bar thin, so the teams and the abilities sit as high as they can. */}
        <header
          className={`flex flex-wrap items-center justify-between gap-3 px-5 lg:px-10 squat:px-4 squat:py-1.5 ${sides ? 'py-1.5' : 'py-4'}`}
        >
          <Link to="/" className="flex items-center gap-3 text-sm font-extrabold tracking-[0.3em] uppercase">
            <img src="favicon.svg" alt="" className="size-9 squat:size-6" />
            {tr('Tứ Tộc')}
          </Link>
          <ServerStatusChip />
        </header>
        {sides ? (
          // A pick room: one team down each side and, on a wide screen, the hero on show between them
          // with its abilities over its head and nothing in front of it. What the page adds (the
          // choice of heroes, the start button) is a low dock along the bottom there, and sits
          // between the teams on a phone, where there is no 3D hero to keep clear.
          <main className="grid flex-1 grid-cols-2 content-start gap-3 px-4 pt-0 pb-2 xl:grid-cols-[19rem_minmax(0,1fr)_19rem] xl:grid-rows-[1fr_auto] xl:content-stretch xl:gap-x-6 xl:gap-y-3 xl:px-10 xl:pb-4 squat:grid-cols-[11rem_minmax(0,1fr)_11rem] squat:gap-2 squat:pb-10">
            <div className="xl:col-start-1 xl:row-start-1 squat:col-start-1 squat:row-start-1">{sides[0]}</div>
            <div className="xl:col-start-3 xl:row-start-1 squat:col-start-3 squat:row-start-1">{sides[1]}</div>
            {showHero && heroId && (
              <div className="flex min-w-0 flex-col items-center gap-3 xl:col-start-2 xl:row-start-1">
                <AbilityPanel
                  key={heroId}
                  heroId={heroId}
                  className="glass-panel w-full max-w-[31rem] animate-rise rounded-xl p-3"
                />
                <HeroTurnArea className="flex min-h-40 w-full flex-1 items-end justify-center pb-1 text-xs text-muted-foreground/70">
                  {tr('Giữ và kéo để xoay tướng')}
                </HeroTurnArea>
              </div>
            )}
            <div className="col-span-2 min-w-0 xl:col-span-3 xl:row-start-2 squat:col-span-1 squat:col-start-2 squat:row-start-1">
              <AbilitiesShownContext value={showHero && heroId !== undefined}>{children}</AbilitiesShownContext>
            </div>
          </main>
        ) : (
          <main
            className={`grid flex-1 grid-cols-[minmax(0,1fr)] content-center gap-6 px-5 py-6 lg:px-24 squat:content-start squat:gap-2 squat:px-4 squat:py-1 squat:pb-10 ${aside ? 'xl:grid-cols-[minmax(0,24rem)_1fr_24rem] xl:gap-x-8 xl:px-16 squat:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] squat:gap-x-4' : ''}`}
          >
            <AbilitiesShownContext value={overHero}>
              <div className={`${column} xl:col-start-1 xl:self-end squat:col-start-1`}>{children}</div>
              {overHero && heroId && (
                // The empty middle column: the abilities over the head of the hero standing in the backdrop,
                // and under them the hero itself, which can be dragged round.
                <div className="flex flex-col gap-3 self-stretch xl:col-start-2 xl:row-span-2 xl:row-start-1">
                  <AbilityPanel
                    key={heroId}
                    heroId={heroId}
                    // Wide enough for the six ability tabs to sit on one row.
                    className="glass-panel w-full max-w-[31rem] animate-rise self-center rounded-xl p-3"
                  />
                  <HeroTurnArea className="flex min-h-64 flex-1 items-end justify-center pb-1 text-xs text-muted-foreground/70">
                    {tr('Giữ và kéo để xoay tướng')}
                  </HeroTurnArea>
                </div>
              )}
              {aside && (
                <aside className="glass-panel mx-auto w-full max-w-xl animate-rise rounded-xl p-4 [animation-delay:320ms] lg:mx-0 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-center squat:col-start-2 squat:row-span-2 squat:row-start-1 squat:max-w-none squat:self-start squat:p-2.5">
                  {aside}
                </aside>
              )}
              {actions && (
                <div
                  className={`${column} xl:col-start-1 xl:row-start-2 xl:self-start squat:col-start-1 squat:row-start-2`}
                >
                  {actions}
                </div>
              )}
            </AbilitiesShownContext>
          </main>
        )}
        {/* A pick room on a wide screen gives the whole bottom edge to its dock. */}
        {!(sides && wide) && (
          <footer className="px-5 py-4 pr-28 lg:px-10 lg:pr-28 squat:px-4 squat:py-2 squat:pr-28">
            <SoundSettings />
            <Link to="/credits" className="mt-2 block text-center text-xs text-muted-foreground underline lg:text-left">
              {tr('Ghi công')}
            </Link>
          </footer>
        )}
      </div>
      <LangSwitch className="absolute right-4 bottom-3 squat:right-3 squat:bottom-2" />
    </div>
  );
}
