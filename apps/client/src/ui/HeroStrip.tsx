import { useState } from 'react';
import { HERO_IDS, HEROES, type Race, RACES } from '@game/core';
import { tr } from '@/i18n';
import { useSquatLayout } from '@/hooks/useSquatLayout';
import { AbilityPanel } from './AbilityPanel';
import { HeroPortrait } from './HeroPortrait';
import { RACE_TEXT, ROLE_NAMES } from './heroText';
import { SynergyNote } from './SynergyNote';

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
  const hero = HEROES[value] ?? HEROES[HERO_IDS[0]];
  const squat = useSquatLayout();
  const [tab, setTab] = useState<Race>(hero.race);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const portrait = (id: string) => {
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
  };
  // The abilities open over the hero on request, and stay out of its way otherwise.
  const skills = skillsOpen && (
    <div className="absolute bottom-full left-1/2 z-30 mb-2 flex max-h-[calc(100dvh-7.5rem)] w-[min(31rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2 overflow-y-auto rounded-xl hud-sheet p-2.5">
      <AbilityPanel key={hero.id} heroId={hero.id} />
      {/* A phone held sideways has no room for this beside the portraits. */}
      {squat && <SynergyNote heroId={hero.id} teammates={taken} />}
      <button
        type="button"
        onClick={() => setSkillsOpen(false)}
        className="cursor-pointer self-end rounded-md border border-border px-3 py-1 text-xs"
      >
        {tr('Đóng')}
      </button>
    </div>
  );
  const skillsButton = (
    <button
      type="button"
      onClick={() => setSkillsOpen((open) => !open)}
      aria-expanded={skillsOpen}
      className="cursor-pointer rounded-md border border-primary px-2 py-0.5 text-[10px] font-bold tracking-wider text-primary uppercase"
    >
      {tr('Kỹ năng')}
    </button>
  );
  if (squat) {
    // A phone held sideways: one low row along the bottom, under the hero standing in the backdrop.
    // One race at a time, so its four portraits stay big enough for a thumb.
    return (
      <div className="relative flex w-full items-center gap-3 text-left">
        {skills}
        <div className="flex min-w-0 flex-col gap-0.5 leading-tight">
          <span className="truncate text-sm font-black tracking-wide uppercase">{hero.name}</span>
          <span className={`truncate text-[11px] font-semibold ${RACE_TEXT[hero.race]}`}>{ROLE_NAMES[hero.role]}</span>
          {skillsButton}
        </div>
        <div role="tablist" className="grid shrink-0 grid-cols-2 gap-1">
          {RACE_ORDER.map((race) => (
            <button
              key={race}
              type="button"
              role="tab"
              aria-selected={tab === race}
              onClick={() => setTab(race)}
              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                tab === race ? `border-current ${RACE_TEXT[race]}` : 'border-border text-muted-foreground'
              }`}
            >
              {tr(RACES[race].name)}
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label={label} className="grid w-52 shrink-0 grid-cols-4 gap-1.5">
          {HERO_IDS.filter((id) => HEROES[id].race === tab).map(portrait)}
        </div>
      </div>
    );
  }
  return (
    <div className="relative flex w-full flex-col gap-2 text-left">
      {skills}
      <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
        <span className="text-xl leading-tight font-black tracking-wide uppercase squat:text-base">{hero.name}</span>
        <span className="text-sm text-muted-foreground squat:text-xs">{tr(hero.title)}</span>
        {skillsButton}
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
              {HERO_IDS.filter((id) => HEROES[id].race === race).map(portrait)}
            </div>
          </div>
        ))}
      </div>
      <SynergyNote heroId={hero.id} teammates={taken} />
    </div>
  );
}
