import { tr } from '@/i18n';
import { lazy, Suspense, useState } from 'react';
import { HERO_IDS, HEROES, type Race, RACES } from '@game/core';
import { useNarrowLayout } from '@/hooks/useNarrowLayout';
import { useSquatLayout } from '@/hooks/useSquatLayout';
import { useWideLayout } from '@/hooks/useWideLayout';
import { AbilityPanel } from './AbilityPanel';
import { HeroPortrait } from './HeroPortrait';
import { HeroTurnArea } from './HeroTurnArea';
import { RACE_TEXT, ROLE_NAMES } from './heroText';

// three.js is most of the bundle; the picker works before it arrives.
const HeroStage = lazy(() => import('@/scene/HeroStage'));

/** Each portrait is underlined in the colour of the hero's race. */
const RACE_EDGE = {
  human: 'border-race-human',
  dragon: 'border-race-dragon',
  god: 'border-race-god',
  machine: 'border-race-machine',
} as const;

/** The races in the order their columns are shown, each with its heroes. */
const RACE_ORDER: readonly Race[] = ['human', 'dragon', 'god', 'machine'];
const BY_RACE = RACE_ORDER.map((race) => ({ race, heroIds: HERO_IDS.filter((id) => HEROES[id].race === race) }));

interface Props {
  value: string;
  onChange: (heroId: string) => void;
  /** Heroes that cannot be picked, e.g. already taken by a teammate. */
  taken?: readonly string[];
  label: string;
}

/**
 * Pick one of the heroes and read what it does. The hero's abilities come first, each with all its
 * numbers; choosing one also has the 3D hero perform it. Below, the heroes stand in one column per
 * race, or on a phone under one tab per race. On a narrow screen the 3D hero is shown here too.
 */
export function HeroPicker({ value, onChange, taken = [], label }: Props) {
  const wide = useWideLayout();
  // A phone held sideways has no height to spare for the 3D hero.
  const squat = useSquatLayout();
  const narrow = useNarrowLayout();
  // On a wide screen the lobby frame shows the abilities over the 3D hero instead.
  const hero = HEROES[value] ?? HEROES[HERO_IDS[0]];
  const race = RACES[hero.race];
  // The race whose heroes are listed when the list is tabbed; it starts on the picked hero's own race.
  const [raceTab, setRaceTab] = useState<Race | null>(null);
  const shownRace = raceTab ?? hero.race;
  const tabbed = squat || narrow;

  const heroCard = (id: string) => {
    const def = HEROES[id];
    const unavailable = taken.includes(id) && id !== value;
    return (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={id === value}
        disabled={unavailable}
        title={unavailable ? tr('Đồng đội đã chọn tướng này') : `${def.name}, ${tr(def.title)}`}
        onClick={() => onChange(id)}
        className="flex min-w-0 cursor-pointer flex-col items-stretch gap-1 rounded-md border border-border bg-background/70 p-1 text-center text-sm font-semibold transition-colors hover:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-checked:border-primary aria-checked:bg-primary/15 aria-checked:text-primary squat:text-xs"
      >
        <HeroPortrait
          heroId={id}
          className={`aspect-[16/9] w-full shrink-0 rounded-sm border-b-2 squat:aspect-[2/1] ${RACE_EDGE[def.race]}`}
        />
        <span className="min-w-0">
          <span className="block truncate leading-tight">{def.name}</span>
          <span className="block truncate text-[0.65rem] leading-tight font-normal text-muted-foreground">
            {ROLE_NAMES[def.role]}
          </span>
        </span>
      </button>
    );
  };

  return (
    <div className="flex w-full flex-col gap-3 text-left squat:gap-1.5">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase squat:hidden">{label}</p>

      {!wide && !squat && (
        <HeroTurnArea className="hero-stage h-56 w-full sm:h-64 [&_canvas]:pointer-events-none">
          <Suspense fallback={null}>
            <HeroStage heroId={hero.id} />
          </Suspense>
        </HeroTurnArea>
      )}

      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl leading-tight font-black tracking-wide uppercase squat:text-base">
          {hero.name}
          <span className="block text-sm font-medium tracking-normal text-muted-foreground normal-case squat:ml-2 squat:inline squat:text-xs">
            {tr(hero.title)}
          </span>
        </p>
        <p className="text-right text-sm whitespace-nowrap squat:text-xs">
          <span className={`font-semibold ${RACE_TEXT[hero.race]}`}>{tr(race.name)}</span>
          <span className="block text-muted-foreground squat:ml-2 squat:inline">{ROLE_NAMES[hero.role]}</span>
        </p>
      </div>

      <AbilityPanel heroId={hero.id} />

      {tabbed ? (
        // On a phone there is no room for four columns: one race at a time, chosen by tab.
        <>
          <div role="tablist" aria-label={tr('Tộc')} className="grid grid-cols-4 gap-1.5">
            {RACE_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={id === shownRace}
                onClick={() => setRaceTab(id)}
                className={`cursor-pointer truncate rounded-md border border-border px-1 py-1.5 text-xs font-bold tracking-wider uppercase transition-colors aria-selected:border-current aria-selected:bg-background/80 squat:py-1 squat:text-[11px] ${
                  id === shownRace ? RACE_TEXT[id] : 'text-muted-foreground'
                }`}
              >
                {tr(RACES[id].name)}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1.5">
            {HERO_IDS.filter((id) => HEROES[id].race === shownRace).map(heroCard)}
          </div>
        </>
      ) : (
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
          {BY_RACE.map(({ race: columnRace, heroIds }) => (
            <div key={columnRace} className="flex min-w-0 flex-col gap-2">
              <p
                className={`truncate border-b border-border pb-1 text-center text-xs font-bold tracking-widest uppercase ${RACE_TEXT[columnRace]}`}
              >
                {tr(RACES[columnRace].name)}
              </p>
              {heroIds.map(heroCard)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
