import { useId } from 'react';
import { ITEMS, type ItemStats } from '@game/core';
import { GAME_ICONS } from './gameIcons';
import { ITEM_ART } from './itemArt';

/** What an item is for, which decides the colours of its tile. */
type Family = 'blade' | 'guard' | 'vital' | 'arcane' | 'swift';

/** The family each kind of stat belongs to. An item takes the family of the first stat it lists: what it is mainly for. */
const FAMILY_OF: Record<keyof ItemStats, Family> = {
  attack: 'blade',
  attackSpeed: 'blade',
  lifesteal: 'blade',
  armor: 'guard',
  hp: 'vital',
  hpRegen: 'vital',
  mana: 'arcane',
  manaRegen: 'arcane',
  abilityDamage: 'arcane',
  cooldownReduction: 'arcane',
  moveSpeed: 'swift',
};

/** Each family: the deep colour behind the picture, the light at its heart, and the two ends of the picture's own sheen. */
const FAMILIES: Record<Family, { deep: string; heart: string; top: string; bottom: string }> = {
  blade: { deep: '#3a0f0c', heart: '#e0432c', top: '#ffffff', bottom: '#ffc26b' },
  guard: { deep: '#0e1d33', heart: '#3f8fe0', top: '#ffffff', bottom: '#bcd9f5' },
  vital: { deep: '#0a2a14', heart: '#2fc463', top: '#ffffff', bottom: '#b8f7c4' },
  arcane: { deep: '#1e0f3d', heart: '#9a58f0', top: '#ffffff', bottom: '#e0c2ff' },
  swift: { deep: '#072c33', heart: '#22c9c9', top: '#ffffff', bottom: '#b4fbf5' },
};

/** How dear an item is, shown by its frame: plain steel, then blue, violet and gold. */
const TIERS = [
  { upTo: 350, frame: ['#c9d2dc', '#5b6675'], pips: 1 },
  { upTo: 650, frame: ['#9fd8ff', '#2f6fb0'], pips: 2 },
  { upTo: 850, frame: ['#e3c2ff', '#7a3fd0'], pips: 3 },
  { upTo: Infinity, frame: ['#fff0b0', '#d99a1c'], pips: 4 },
] as const;

/** The outline of the tile: a square with its corners cut, like the game's panels. */
const TILE = 'M10 2H54L62 10V54L54 62H10L2 54V10Z';

/**
 * An item as a small framed tile: its own picture (see itemArt) over the colour of what it is for
 * (red for weapons, blue for armour, green for health, violet for magic, teal for speed), in a frame
 * whose metal tells how dear it is. The dearest also throw sparks.
 */
export function ItemIcon({ id, className }: { id: string; className?: string }) {
  const uid = useId();
  const item = ITEMS[id];
  const icon = GAME_ICONS[id];
  const art = ITEM_ART[id];
  if (!item || (!icon && !art)) return null;
  const family = FAMILIES[FAMILY_OF[(Object.keys(item.stats) as (keyof ItemStats)[])[0]] ?? 'vital'];
  const tier = TIERS.find((t) => item.cost <= t.upTo) ?? TIERS[0];
  const ref = (name: string) => `url(#${uid}${name})`;
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className}>
      <defs>
        <radialGradient id={`${uid}bg`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor={family.bottom} />
          <stop offset="0.38" stopColor={family.heart} />
          <stop offset="1" stopColor={family.deep} />
        </radialGradient>
        <linearGradient id={`${uid}frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier.frame[0]} />
          <stop offset="0.5" stopColor={tier.frame[1]} />
          <stop offset="1" stopColor={tier.frame[0]} />
        </linearGradient>
        <linearGradient id={`${uid}sheen`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={family.top} />
          <stop offset="1" stopColor={family.bottom} />
        </linearGradient>
        <linearGradient id={`${uid}gloss`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id={`${uid}lift`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.3" floodColor="#000" floodOpacity="0.7" />
        </filter>
        <filter id={`${uid}glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="14" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={TILE} fill={ref('bg')} />
      {/* Rays behind the picture, so it seems lit from within. */}
      <g opacity="0.22" fill={family.top}>
        {[0, 45, 90, 135].map((turn) => (
          <path key={turn} d="M32 4L34 32L32 60L30 32Z" transform={`rotate(${turn} 32 32)`} />
        ))}
      </g>
      {art ? (
        // The item's own picture, outlined in the tile's dark tone and lifted off it by a shadow.
        <g
          filter={ref('lift')}
          stroke={family.deep}
          strokeWidth="1.1"
          strokeLinejoin="round"
          transform="translate(4.5 4) scale(0.86)"
        >
          {art({ light: family.top, mid: family.bottom, deep: family.deep })}
        </g>
      ) : (
        icon && (
          // An item with no picture of its own yet: its plain symbol, drawn on a 512 grid.
          <g transform="translate(8.5 7.5) scale(0.092)" filter={ref('glow')}>
            <path d={icon.d} fill={family.deep} opacity="0.7" transform="translate(8 14)" />
            <path d={icon.d} fill={ref('sheen')} />
          </g>
        )
      )}
      <path d={TILE} fill={ref('gloss')} />
      <path d={TILE} fill="none" stroke={ref('frame')} strokeWidth="3" strokeLinejoin="round" />
      <path d="M11 5H53L59 11V53L53 59H11L5 53V11Z" fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="1" />
      {/* One pip along the foot of the frame for each step of price. */}
      {Array.from({ length: tier.pips }, (_, i) => (
        <path
          key={i}
          d="M0 -2.6L2.6 0L0 2.6L-2.6 0Z"
          transform={`translate(${32 + (i - (tier.pips - 1) / 2) * 7} 58.5)`}
          fill={tier.frame[0]}
          stroke={family.deep}
          strokeWidth="0.6"
        />
      ))}
      {tier.pips === 4 && (
        <g fill="#fff8d8">
          <path d="M51 9L52.2 12.8L56 14L52.2 15.2L51 19L49.8 15.2L46 14L49.8 12.8Z" />
          <path d="M12 44L12.8 46.2L15 47L12.8 47.8L12 50L11.2 47.8L9 47L11.2 46.2Z" opacity="0.8" />
        </g>
      )}
    </svg>
  );
}
