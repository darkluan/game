import { useState } from 'react';
import { ABILITY_SLOTS, type AbilitySlot, HERO_IDS, HEROES, RACES } from '@game/core';
import { tr } from '@/i18n';
import { abilityPreview } from '@/lib/abilityDetails';
import { useShowcaseStore } from '@/store/showcaseStore';
import { AbilityInfo } from './hud/parts';
import { GameIcon } from './icons/GameIcon';

/** What the panel explains: one ability, the hero's passive or its race trait. */
type Topic = AbilitySlot | 'passive' | 'race';

// Six tabs share one row whatever the width. The four abilities are a letter each; the two worded tabs get
// a wider share so their labels fit.
const tab =
  'min-w-0 cursor-pointer truncate rounded-md border border-border px-1.5 py-1.5 text-center text-sm font-semibold transition-colors aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary squat:py-0.5 squat:text-[11px]';

/**
 * A hero's abilities, one at a time: what it does and its numbers at every level.
 * Choosing an ability also has the 3D hero perform it.
 */
export function AbilityPanel({ heroId, className = '' }: { heroId: string; className?: string }) {
  const play = useShowcaseStore((s) => s.play);
  const [picked, setPicked] = useState<Topic>('R');
  const hero = HEROES[heroId] ?? HEROES[HERO_IDS[0]];
  const race = RACES[hero.race];
  const topic = picked === 'passive' && !hero.passive ? 'R' : picked;
  const isAbility = topic !== 'race' && topic !== 'passive';

  return (
    <div className={`flex flex-col gap-2 text-left squat:gap-1.5 ${className}`}>
      <div className="flex gap-1.5 squat:gap-1">
        {ABILITY_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            aria-pressed={topic === slot}
            aria-label={tr('Chiêu {slot}: {name}', { slot, name: tr(hero.abilities[slot].name) })}
            onClick={() => {
              setPicked(slot);
              play(slot);
            }}
            className={`${tab} flex flex-1 items-center justify-center gap-1`}
          >
            <GameIcon id={hero.abilities[slot].id} className="size-6 squat:size-5" />
            {slot}
          </button>
        ))}
        {hero.passive && (
          <button
            type="button"
            aria-pressed={topic === 'passive'}
            onClick={() => setPicked('passive')}
            className={`${tab} flex-[1.7]`}
          >
            {tr('Nội tại')}
          </button>
        )}
        <button
          type="button"
          aria-pressed={topic === 'race'}
          onClick={() => setPicked('race')}
          className={`${tab} flex-[1.3]`}
        >
          {tr('Tộc')}
        </button>
      </div>

      <div
        aria-live="polite"
        // Its numbers, when opened, scroll inside it: the panel never grows past half the screen.
        className="max-h-[46dvh] overflow-y-auto rounded-md border border-border bg-background/70 p-3 text-sm squat:max-h-[24dvh] squat:p-1.5"
      >
        {isAbility ? (
          <>
            <AbilityInfo ability={abilityPreview(hero, topic)} preview numbers />
          </>
        ) : (
          <>
            <p className="font-semibold">
              {topic === 'race' ? tr('Tộc {race}', { race: tr(race.name) }) : tr('Nội tại')}
            </p>
            <p className="mt-1 text-muted-foreground squat:text-xs">
              {topic === 'race' ? tr(race.description) : hero.passive && tr(hero.passive.description)}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
