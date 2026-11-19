import { HEROES, synergyOf } from '@game/core';
import { tr } from '@/i18n';
import { PAIR_TEXT } from '@/lib/hud';

interface Props {
  /** The hero the player has picked. */
  heroId: string;
  /** The heroes the teammates have picked. */
  teammates: readonly string[];
  className?: string;
}

/**
 * The two race synergies a line-up can earn, while the team is still picking: the one for three
 * different races, and the one for a pair of the race the team shares (or, with no pair yet, of the
 * picked hero's race). The ones the team's picks earn right now are lit and marked.
 */
export function SynergyNote({ heroId, teammates, className = '' }: Props) {
  const races = [heroId, ...teammates].flatMap((id) => HEROES[id]?.race ?? []);
  const synergy = synergyOf(races);
  const pairRace = synergy.race ?? HEROES[heroId]?.race;
  const rows = [
    { text: tr('Ba tộc khác nhau: cả đội chạy nhanh hơn 6%'), active: synergy.speed },
    ...(pairRace ? [{ text: PAIR_TEXT[pairRace], active: synergy.race !== null }] : []),
  ];
  return (
    <div className={`text-xs leading-snug ${className}`}>
      <p className="text-[11px] font-bold tracking-widest text-muted-foreground uppercase">{tr('Cộng hưởng tộc')}</p>
      <ul>
        {rows.map((row) => (
          <li key={row.text} className={row.active ? 'font-semibold text-primary' : 'text-muted-foreground'}>
            {row.active && '✓ '}
            {row.text}
            {row.active && ` · ${tr('đội bạn đang có')}`}
          </li>
        ))}
      </ul>
    </div>
  );
}
