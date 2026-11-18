import { useState } from 'react';
import { ABILITY_SLOTS, type AbilitySlot, HERO_IDS, HEROES, RACES } from '@game/core';
import { tr } from '@/i18n';
import { abilityPreview } from '@/lib/abilityDetails';
import { useShowcaseStore } from '@/store/showcaseStore';
import { AbilityInfo } from './hud/parts';
import { GameIcon } from './icons/GameIcon';

/** What the panel explains: one ability, the hero's passive or its race trait. */
type Topic = AbilitySlot | 'passive' | 'race';

const tab =
  'cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-semibold transition-colors aria-pressed:border-primary aria-pressed:bg-primary/15 aria-pressed:text-primary squat:py-0.5 squat:text-xs';

/**
 * A hero's abilities, one at a time: what it does, and behind a switch its numbers at every level.
 * Choosing an ability also has the 3D hero perform it.
 */
export function AbilityPanel({ heroId, className = '' }: { heroId: string; className?: string }) {
  const play = useShowcaseStore((s) => s.play);
  const [picked, setPicked] = useState<Topic>('R');
  // The numbers stay folded away until asked for, so the panel is small by default.
  const [numbersOpen, setNumbersOpen] = useState(false);
  const hero = HEROES[heroId] ?? HEROES[HERO_IDS[0]];
  const race = RACES[hero.race];
  const topic = picked === 'passive' && !hero.passive ? 'R' : picked;
  const isAbility = topic !== 'race' && topic !== 'passive';

  return (
    <div className={`flex flex-col gap-2 text-left squat:gap-1.5 ${className}`}>
      <div className="flex flex-wrap gap-2 squat:gap-1.5">
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
            className={`${tab} flex items-center gap-1.5 px-2!`}
          >
            <GameIcon id={hero.abilities[slot].id} className="size-6 squat:size-5" />
            {slot}
          </button>
        ))}
        {hero.passive && (
          <button type="button" aria-pressed={topic === 'passive'} onClick={() => setPicked('passive')} className={tab}>
            {tr('Nội tại')}
          </button>
        )}
        <button type="button" aria-pressed={topic === 'race'} onClick={() => setPicked('race')} className={tab}>
          {tr('Tộc')}
        </button>
      </div>

      <div
        aria-live="polite"
        className="relative rounded-md border border-border bg-background/70 p-3 text-sm squat:p-1.5"
      >
        {isAbility ? (
          <>
            {/* Room on the right for the arrow, so a long name does not run under it. */}
            <div className="pr-8">
              <AbilityInfo ability={abilityPreview(hero, topic)} preview numbers={numbersOpen} />
            </div>
            {/* A small arrow in the corner folds the numbers in and out. */}
            <button
              type="button"
              aria-expanded={numbersOpen}
              aria-label={numbersOpen ? tr('Ẩn chỉ số') : tr('Xem chỉ số')}
              title={numbersOpen ? tr('Ẩn chỉ số') : tr('Xem chỉ số')}
              onClick={() => setNumbersOpen((open) => !open)}
              className="absolute top-1.5 right-1.5 flex size-7 cursor-pointer items-center justify-center rounded-md border border-border text-primary transition-colors hover:border-primary aria-expanded:bg-primary/15 squat:size-6"
            >
              <svg
                viewBox="0 0 16 16"
                aria-hidden
                className={`size-4 transition-transform ${numbersOpen ? 'rotate-180' : ''}`}
              >
                <path
                  d="M3 6l5 5 5-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
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
