import { tr } from '@/i18n';
import { lazy, type ReactNode, Suspense } from 'react';
import { Link } from 'react-router';
import { useWideLayout } from '@/hooks/useWideLayout';
import { useServerStatus } from '@/net/serverStatus';
import { useSquatLayout } from '@/hooks/useSquatLayout';
import { useSettingsStore } from '@/store/settingsStore';
import { HeroTurnArea } from '@/ui/HeroTurnArea';
import { FullscreenButton } from '@/ui/FullscreenButton';
import { LangSwitch } from '@/ui/LangSwitch';
import { SoundSettings } from '@/ui/SoundSettings';

// three.js is most of the bundle: the menu shows at once and the backdrop fades in when it arrives.
const LobbyScene = lazy(() => import('@/scene/LobbyScene'));
const HeroStage = lazy(() => import('@/scene/HeroStage'));

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

/** Far enough back that the tallest dragon, horns and all, fits the short stage of a phone. */
const PHONE_STAGE_DISTANCE = 7.2;

/** The hero on a phone held sideways: its own lit stage behind the panels, which can be dragged to turn the hero round. */
function PhoneHeroStage({ heroId, className }: { heroId: string; className: string }) {
  return (
    <div className={`relative min-h-32 ${className}`}>
      {/* The stage is far wider than its column, so a wide hero is not cut off at the column's edges;
          what spills over shows through the panels either side, which are drawn above it. */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[260%] -translate-x-1/2">
        <Suspense fallback={null}>
          <HeroStage heroId={heroId} distance={PHONE_STAGE_DISTANCE} />
        </Suspense>
      </div>
      <HeroTurnArea className="absolute inset-0 flex items-end justify-center pb-0.5 text-[10px] text-muted-foreground/70">
        {tr('Giữ và kéo để xoay tướng')}
      </HeroTurnArea>
    </div>
  );
}

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
  /** The page shows the game's name as its own big title, so the top bar keeps to the logo and does not say it twice. */
  titled?: boolean;
}

/** Frame shared by every screen outside a match: the 3D backdrop, the top bar and the sound controls. */
export function LobbyShell({ children, aside, actions, heroId, sides, titled = false }: Props) {
  const wide = useWideLayout();
  const squat = useSquatLayout();
  // On a wide screen the 3D hero stands in the backdrop, between the columns. A phone held sideways
  // has no room there: it gets a small lit stage of its own in a narrow middle column instead.
  const showHero = wide;
  // A wide screen with a hero and its picker shown: the middle column is kept clear for the 3D hero.
  const overHero = wide && heroId !== undefined && aside !== undefined && aside !== null && aside !== false;
  const column =
    'mx-auto flex w-full max-w-xl flex-col items-center gap-6 xl:gap-4 text-center lg:mx-0 lg:items-start lg:text-left squat:relative squat:z-10 squat:mx-0 squat:items-start squat:gap-2 squat:text-left';
  const graphics = useSettingsStore((s) => s.graphics);
  return (
    <div className="relative h-full overflow-hidden">
      {/* In a pick room the scene is drawn a little higher, so the dock along the bottom clears the hero's feet. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 ${sides && showHero ? '-translate-y-[15%]' : ''}`}
      >
        <Suspense fallback={null}>
          <div className="h-full animate-fade">
            <LobbyScene
              graphics={graphics}
              heroId={showHero ? heroId : undefined}
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
            {titled ? <span className="sr-only">{tr('Tứ Tộc')}</span> : tr('Tứ Tộc')}
            {/* The game is still being tried out: say so wherever its name is shown. */}
            <span className="rounded-full border border-primary px-2 py-0.5 text-[10px] tracking-widest text-primary">
              {tr('Bản thử nghiệm')}
            </span>
          </Link>
          <ServerStatusChip />
        </header>
        {sides ? (
          // A pick room: one team down each side and, on a wide screen, the hero on show between them
          // with its abilities over its head and nothing in front of it. What the page adds (the
          // choice of heroes, the start button) is a low dock along the bottom there, and sits
          // between the teams on a phone, where there is no 3D hero to keep clear.
          <main className="grid flex-1 grid-cols-2 content-start gap-3 px-4 pt-0 pb-2 xl:grid-cols-[19rem_minmax(0,1fr)_19rem] xl:grid-rows-[1fr_auto] xl:content-stretch xl:gap-x-6 xl:gap-y-3 xl:px-10 xl:pb-4 squat:grid-cols-[11rem_minmax(0,1fr)_11rem] squat:grid-rows-[1fr_auto] squat:content-stretch squat:gap-2 squat:pb-10">
            <div className="xl:col-start-1 xl:row-start-1 squat:relative squat:z-10 squat:col-start-1 squat:row-start-1">
              {sides[0]}
            </div>
            <div className="xl:col-start-3 xl:row-start-1 squat:relative squat:z-10 squat:col-start-3 squat:row-start-1">
              {sides[1]}
            </div>
            {showHero && heroId && (
              <div className="flex min-w-0 flex-col items-center gap-3 xl:col-start-2 xl:row-start-1 squat:col-start-2 squat:row-start-1">
                <HeroTurnArea className="flex min-h-40 w-full flex-1 items-end justify-center pb-1 text-xs text-muted-foreground/70 squat:min-h-24">
                  {tr('Giữ và kéo để xoay tướng')}
                </HeroTurnArea>
              </div>
            )}
            {squat && heroId && <PhoneHeroStage heroId={heroId} className="col-start-2 row-start-1" />}
            <div className="col-span-2 min-w-0 xl:col-span-3 xl:row-start-2 squat:relative squat:z-10 squat:col-span-3 squat:col-start-1 squat:row-start-2">
              {children}
            </div>
          </main>
        ) : (
          <main
            className={`grid flex-1 grid-cols-[minmax(0,1fr)] content-center gap-6 px-5 py-6 lg:px-24 squat:content-start squat:gap-2 squat:px-4 squat:py-1 squat:pb-10 ${aside ? 'xl:grid-cols-[minmax(0,24rem)_1fr_28rem] xl:gap-x-8 xl:px-16 squat:grid-cols-[minmax(0,9fr)_minmax(0,6fr)_minmax(0,11fr)] squat:gap-x-3' : ''}`}
          >
            <>
              <div className={`${column} xl:col-start-1 xl:self-end squat:col-start-1`}>{children}</div>
              {overHero && heroId && (
                // The empty middle column: the hero standing in the backdrop, with nothing in front of it,
                // which can be dragged round. Its abilities are listed in the picker beside it.
                <div className="flex flex-col gap-3 self-stretch xl:col-start-2 xl:row-span-2 xl:row-start-1">
                  <HeroTurnArea className="flex min-h-64 flex-1 items-end justify-center pb-1 text-xs text-muted-foreground/70">
                    {tr('Giữ và kéo để xoay tướng')}
                  </HeroTurnArea>
                </div>
              )}
              {squat && heroId && aside && (
                <PhoneHeroStage heroId={heroId} className="col-start-2 row-span-2 row-start-1 self-stretch" />
              )}
              {aside && (
                <aside className="glass-panel mx-auto w-full max-w-xl animate-rise rounded-xl p-4 [animation-delay:320ms] lg:mx-0 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:self-center squat:relative squat:z-10 squat:col-start-3 squat:row-span-2 squat:row-start-1 squat:max-w-none squat:self-start squat:p-2.5">
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
            </>
          </main>
        )}
        {/* A pick room on a wide screen gives the whole bottom edge to its dock. */}
        {!(sides && wide) && (
          <footer className="px-5 py-4 pr-28 lg:px-10 lg:pr-28 squat:px-4 squat:py-2 squat:pr-28">
            <SoundSettings />
            <p className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground lg:justify-start">
              <Link to="/credits" className="underline">
                {tr('Ghi công')}
              </Link>
              <Link to="/privacy" className="underline">
                {tr('Quyền riêng tư')}
              </Link>
            </p>
          </footer>
        )}
      </div>
      <div className="absolute right-4 bottom-3 flex items-center gap-2 squat:right-3 squat:bottom-2">
        <FullscreenButton />
        <LangSwitch />
      </div>
    </div>
  );
}
