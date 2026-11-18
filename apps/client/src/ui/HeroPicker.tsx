import { lazy, Suspense, useState } from 'react';
import { ABILITY_SLOTS, type AbilitySlot, HERO_IDS, HEROES, RACES } from '@game/core';
import { useWideLayout } from '@/hooks/useWideLayout';
import { useShowcaseStore } from '@/store/showcaseStore';
import { HeroPortrait } from './HeroPortrait';
import { RACE_TEXT, ROLE_NAMES } from './heroText';
import { GameIcon } from './icons/GameIcon';

// three.js is most of the bundle; the picker works before it arrives.
const HeroStage = lazy(() => import('@/scene/HeroStage'));

/** Each portrait is underlined in the colour of the hero's race. */
const RACE_EDGE = {
  human: 'border-race-human',
  dragon: 'border-race-dragon',
  god: 'border-race-god',
  machine: 'border-race-machine',
} as const;

/** What the text under the hero explains: one ability, the hero's passive or its race trait. */
type Topic = AbilitySlot | 'passive' | 'race';

interface Props {
  value: string;
  onChange: (heroId: string) => void;
  /** Heroes that cannot be picked, e.g. already taken by a teammate. */
  taken?: readonly string[];
  label: string;
}

const tab =
  'cursor-pointer rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary';

/**
 * Pick one of the heroes and read what it does, one topic at a time. Choosing an ability also has
 * the 3D hero perform it. On a narrow screen the 3D hero is shown here, above the choices.
 */
export function HeroPicker({ value, onChange, taken = [], label }: Props) {
  const wide = useWideLayout();
  const play = useShowcaseStore((s) => s.play);
  const [picked, setPicked] = useState<Topic>('R');
  const hero = HEROES[value] ?? HEROES[HERO_IDS[0]];
  const race = RACES[hero.race];
  const topic = picked === 'passive' && !hero.passive ? 'R' : picked;
  const detail =
    topic === 'race'
      ? { name: `Tộc ${race.name}`, text: race.description }
      : topic === 'passive'
        ? { name: 'Nội tại', text: hero.passive?.description }
        : { name: hero.abilities[topic].name, text: hero.abilities[topic].description };

  return (
    <div className="flex w-full flex-col gap-3 text-left">
      <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">{label}</p>

      {!wide && (
        <div aria-hidden className="hero-stage pointer-events-none h-56 w-full sm:h-64">
          <Suspense fallback={null}>
            <HeroStage heroId={hero.id} />
          </Suspense>
        </div>
      )}

      <div className="flex items-end justify-between gap-3">
        <p className="text-2xl leading-tight font-black tracking-wide uppercase">
          {hero.name}
          <span className="block text-sm font-medium tracking-normal text-muted-foreground normal-case">
            {hero.title}
          </span>
        </p>
        <p className="text-right text-sm whitespace-nowrap">
          <span className={`font-semibold ${RACE_TEXT[hero.race]}`}>{race.name}</span>
          <span className="block text-muted-foreground">{ROLE_NAMES[hero.role]}</span>
        </p>
      </div>

      <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-2">
        {HERO_IDS.map((id) => {
          const def = HEROES[id];
          const unavailable = taken.includes(id) && id !== value;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={id === value}
              disabled={unavailable}
              title={unavailable ? 'Đồng đội đã chọn tướng này' : `${def.name}, ${def.title}`}
              onClick={() => onChange(id)}
              className="flex cursor-pointer flex-col items-center gap-1 rounded-md border border-border bg-background/70 p-1 pb-1.5 text-sm font-semibold transition-colors hover:border-muted-foreground disabled:cursor-not-allowed disabled:opacity-40 aria-checked:border-primary aria-checked:bg-primary/15 aria-checked:text-primary"
            >
              <HeroPortrait
                heroId={id}
                className={`aspect-[4/3] w-full rounded-sm border-b-2 ${RACE_EDGE[def.race]}`}
              />
              {def.name}
              <span className="text-[0.65rem] leading-none font-normal text-muted-foreground">
                {ROLE_NAMES[def.role]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {ABILITY_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={topic === slot}
            aria-label={`Chiêu ${slot}: ${hero.abilities[slot].name}`}
            onClick={() => {
              setPicked(slot);
              play(slot);
            }}
            className={`${tab} flex items-center gap-1.5 border-border px-2!`}
          >
            <GameIcon id={hero.abilities[slot].id} className="size-6" />
            {slot}
          </button>
        ))}
        {hero.passive && (
          <button
            type="button"
            aria-pressed={topic === 'passive'}
            onClick={() => setPicked('passive')}
            className={`${tab} border-border`}
          >
            Nội tại
          </button>
        )}
        <button
          type="button"
          aria-pressed={topic === 'race'}
          onClick={() => setPicked('race')}
          className={`${tab} border-border`}
        >
          Tộc
        </button>
      </div>

      <div aria-live="polite" className="min-h-24 rounded-md border border-border bg-background/70 p-3 text-sm">
        <p className="font-semibold">{detail.name}</p>
        <p className="mt-1 text-muted-foreground">{detail.text}</p>
      </div>
    </div>
  );
}
