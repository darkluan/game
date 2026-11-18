import { useContext } from 'react';
import { HERO_IDS, HEROES, type Race, RACES } from '@game/core';
import { tr } from '@/i18n';
import { AbilitiesShownContext } from './abilitiesShown';
import { AbilityPanel } from './AbilityPanel';
import { HeroPortrait } from './HeroPortrait';
import { RACE_TEXT, ROLE_NAMES } from './heroText';

const RACE_ORDER: readonly Race[] = ['human', 'dragon', 'god', 'machine'];
const RACE_EDGE = {
  human: 'border-race-human',
  dragon: 'border-race-dragon',
  god: 'border-race-god',
  machine: 'border-race-machine',
} as const;

interface Props {
  value: string;
  onChange: (heroId: string) => void;
  /** Heroes that cannot be picked, e.g. already taken by a teammate. */
  taken?: readonly string[];
  label: string;
}

/**
 * The hero choice of a pick room: every hero as a small portrait, in one group per race, with the
 * picked hero named above. Where the frame does not already show the abilities, they come first.
 */
export function HeroStrip({ value, onChange, taken = [], label }: Props) {
  const abilitiesShown = useContext(AbilitiesShownContext);
  const hero = HEROES[value] ?? HEROES[HERO_IDS[0]];
  return (
    <div className="flex w-full flex-col gap-2 text-left">
      {!abilitiesShown && <AbilityPanel key={hero.id} heroId={hero.id} />}
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-xl leading-tight font-black tracking-wide uppercase squat:text-base">{hero.name}</span>
        <span className="text-sm text-muted-foreground squat:text-xs">{tr(hero.title)}</span>
        <span className={`ml-auto text-sm font-semibold squat:text-xs ${RACE_TEXT[hero.race]}`}>
          {tr(RACES[hero.race].name)}
          <span className="ml-2 font-normal text-muted-foreground">{ROLE_NAMES[hero.role]}</span>
        </span>
      </p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-x-3 gap-y-2 xl:grid-cols-4">
        {RACE_ORDER.map((race) => (
          <div key={race} className="flex min-w-0 flex-col gap-1">
            <p className={`text-[11px] font-bold tracking-widest uppercase ${RACE_TEXT[race]}`}>
              {tr(RACES[race].name)}
            </p>
            <div className="grid grid-cols-4 gap-1">
              {HERO_IDS.filter((id) => HEROES[id].race === race).map((id) => {
                const def = HEROES[id];
                const unavailable = taken.includes(id) && id !== value;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={id === value}
                    aria-label={def.name}
                    disabled={unavailable}
                    title={unavailable ? tr('Đồng đội đã chọn tướng này') : `${def.name}, ${tr(def.title)}`}
                    onClick={() => onChange(id)}
                    className="cursor-pointer overflow-hidden rounded-md border-2 border-transparent bg-background/70 transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale aria-checked:border-primary aria-checked:shadow-[0_0_14px_color-mix(in_srgb,var(--primary)_60%,transparent)]"
                  >
                    <HeroPortrait heroId={id} className={`aspect-square w-full border-b-2 ${RACE_EDGE[def.race]}`} />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
