import type { ReactNode } from 'react';

/** The colours an item's picture is painted with: those of its tile, and the materials things are made of. */
export interface ArtColours {
  /** The tile's own light, mid and dark tones. */
  light: string;
  mid: string;
  deep: string;
}

const STEEL = '#e3eaf2';
const STEEL_DARK = '#8794a6';
const GOLD = '#ffd76a';
const GOLD_DARK = '#b8842a';
const WOOD = '#9a6630';
const WOOD_DARK = '#5e3c1a';
const LEATHER = '#b0733f';
const LEATHER_DARK = '#6e4424';
const BLOOD = '#e0332c';
const WHITE = '#ffffff';

/**
 * A picture for each shop item, drawn for this game on a 64 by 64 tile: a few flat shapes in two or
 * three tones each, outlined by the caller. Keyed by item id.
 */
export const ITEM_ART: Record<string, (c: ArtColours) => ReactNode> = {
  // A plain straight sword, point up and to the right.
  iron_sword: () => (
    <>
      <path d="M45 11L51 13L53 19L27 45L19 37Z" fill={STEEL} />
      <path d="M45 11L51 13L23 41L19 37Z" fill={WHITE} />
      <path d="M13 35L29 51L26 54L10 38Z" fill={GOLD} />
      <path d="M17 43L21 47L13 55L9 51Z" fill={WOOD} />
      <circle cx="10" cy="54" r="3.4" fill={GOLD_DARK} />
    </>
  ),
  // A broad two-handed blade with a red stone in its guard.
  great_blade: () => (
    <>
      <path d="M44 6L56 8L58 20L30 48L16 34Z" fill={STEEL} />
      <path d="M44 6L56 8L23 41L16 34Z" fill={WHITE} />
      <path d="M50 12L26 38" stroke={STEEL_DARK} strokeWidth="2.4" />
      <path d="M8 30L14 28L36 50L34 56L28 54L10 36Z" fill={GOLD} />
      <circle cx="22" cy="42" r="3.6" fill={BLOOD} />
      <path d="M15 45L19 49L11 57L7 53Z" fill={WOOD_DARK} />
      <circle cx="8" cy="56" r="3.6" fill={GOLD_DARK} />
    </>
  ),
  // A short bow with an arrow on the string and the wind behind it.
  swift_bow: (c) => (
    <>
      <path d="M22 8Q52 32 22 56" fill="none" stroke={WOOD} strokeWidth="5" strokeLinecap="round" />
      <path d="M22 8Q46 32 22 56" fill="none" stroke={GOLD} strokeWidth="1.6" />
      <path d="M22 9L22 55" stroke={WHITE} strokeWidth="1.2" />
      <path d="M8 32H48" stroke={STEEL} strokeWidth="2.6" />
      <path d="M56 32L46 27V37Z" fill={STEEL} />
      <path d="M8 32L4 27H12L16 32L12 37H4Z" fill={c.light} />
      <path d="M30 20H42M32 44H46" stroke={c.light} strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  // A bearded axe, its edge wet and dripping.
  blood_axe: () => (
    <>
      <path d="M16 56L20 58L44 14L40 12Z" fill={WOOD} />
      <path d="M36 8Q58 8 58 34Q48 26 34 28Q40 18 36 8Z" fill={STEEL} />
      <path d="M36 8Q52 10 54 26Q44 22 36 24Q40 16 36 8Z" fill={WHITE} />
      <path d="M58 34Q48 26 34 28Q46 30 56 38Z" fill={BLOOD} />
      <path d="M52 36Q54 41 52 44Q50 41 52 36Z" fill={BLOOD} />
      <path d="M44 31Q45.5 35 44 37Q42.5 35 44 31Z" fill={BLOOD} />
      <path d="M33 22L42 26L40 30L31 26Z" fill={GOLD} />
    </>
  ),
  // A war hammer: a block of steel banded in gold, a spike behind.
  war_hammer: () => (
    <>
      <path d="M18 56L22 58L40 26L36 24Z" fill={WOOD} />
      <path d="M26 10L54 24L47 38L19 24Z" fill={STEEL} />
      <path d="M26 10L54 24L52 28L24 14Z" fill={WHITE} />
      <path d="M30 12L34 14L27 28L23 26ZM44 19L48 21L41 35L37 33Z" fill={GOLD} />
      <path d="M19 24L9 22L22 17Z" fill={STEEL_DARK} />
      <circle cx="20" cy="56" r="3.2" fill={GOLD_DARK} />
    </>
  ),
  // A stitched leather jerkin.
  leather_armor: () => (
    <>
      <path d="M19 12L27 10Q32 18 37 10L45 12L53 22L45 30V54H19V30L11 22Z" fill={LEATHER} />
      <path d="M27 10Q32 18 37 10L41 11Q32 26 23 11Z" fill={LEATHER_DARK} />
      <path d="M32 24V54" stroke={LEATHER_DARK} strokeWidth="1.6" strokeDasharray="3 2.4" />
      <path d="M19 42H45V47H19Z" fill={LEATHER_DARK} />
      <path d="M29 41H35V48H29Z" fill={GOLD} />
      <path d="M22 30H28M36 30H42" stroke={WOOD_DARK} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  // A steel breastplate trimmed in gold.
  steel_armor: () => (
    <>
      <path d="M18 12L27 10Q32 17 37 10L46 12L54 22L46 30V50Q32 58 18 50V30L10 22Z" fill={STEEL} />
      <path d="M18 12L27 10Q32 17 37 10L46 12L50 17Q32 30 14 17Z" fill={WHITE} />
      <path d="M32 20V54M20 34Q32 42 44 34" fill="none" stroke={STEEL_DARK} strokeWidth="1.8" />
      <path d="M18 46Q32 54 46 46V50Q32 58 18 50Z" fill={GOLD} />
      <circle cx="22" cy="26" r="1.8" fill={GOLD_DARK} />
      <circle cx="42" cy="26" r="1.8" fill={GOLD_DARK} />
    </>
  ),
  // A champion's belt with a great buckle.
  strength_belt: (c) => (
    <>
      <path d="M8 26Q32 16 56 26L54 42Q32 32 10 42Z" fill={LEATHER} />
      <path d="M8 26Q32 16 56 26L55.5 30Q32 20 8.5 30Z" fill={LEATHER_DARK} />
      <path d="M22 18H42L46 30L42 46H22L18 30Z" fill={GOLD} />
      <path d="M25 22H39L42 30L39 42H25L22 30Z" fill={GOLD_DARK} />
      <path d="M32 24L38 32L32 40L26 32Z" fill={c.light} />
      <circle cx="13" cy="33" r="1.6" fill={GOLD} />
      <circle cx="51" cy="33" r="1.6" fill={GOLD} />
    </>
  ),
  // A heart too big for any man, still beating.
  giant_heart: (c) => (
    <>
      <path d="M32 55C6 37 9 12 23 12C29 12 32 17 32 20C32 17 35 12 41 12C55 12 58 37 32 55Z" fill={BLOOD} />
      <path
        d="M23 12C29 12 32 17 32 20C32 17 35 12 41 12C47 12 50 17 51 22C40 16 24 16 13 24C14 17 18 12 23 12Z"
        fill="#ff7a6e"
      />
      <path d="M32 20V30L26 36M32 30L39 38" fill="none" stroke="#8f1410" strokeWidth="2" strokeLinecap="round" />
      <path d="M19 20Q22 16 26 18" fill="none" stroke={WHITE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M46 40V48M42 44H50" stroke={c.light} strokeWidth="2.6" strokeLinecap="round" />
    </>
  ),
  // A core that mends: a living light in a ring of gold, forever turning.
  regen_core: (c) => (
    <>
      <path d="M32 8L52 20V44L32 56L12 44V20Z" fill={GOLD_DARK} />
      <path d="M32 12L48 22V42L32 52L16 42V22Z" fill={GOLD} />
      <circle cx="32" cy="32" r="12.5" fill={c.deep} />
      <circle cx="32" cy="32" r="9" fill={c.mid} />
      <circle cx="29" cy="29" r="3.6" fill={WHITE} />
      <path d="M32 17A15 15 0 0 1 47 32" fill="none" stroke={WHITE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M47 32L44 26L50 27Z" fill={WHITE} />
      <path d="M32 47A15 15 0 0 1 17 32" fill="none" stroke={WHITE} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17 32L20 38L14 37Z" fill={WHITE} />
    </>
  ),
  // A winged boot.
  swift_boots: () => (
    <>
      <path d="M22 10H36V34L52 42Q56 45 54 52H16V44L22 38Z" fill={LEATHER} />
      <path d="M22 10H36V16H22Z" fill={GOLD} />
      <path d="M16 50H54V55H16Z" fill={WOOD_DARK} />
      <path d="M36 34L52 42Q54 43.5 54.5 46Q44 40 36 40Z" fill={LEATHER_DARK} />
      <path d="M24 30L6 18L12 30L4 30L14 38L8 42L24 40Z" fill={WHITE} />
      <path d="M24 30L12 24M24 34L10 33" stroke={STEEL_DARK} strokeWidth="1.2" />
    </>
  ),
  // A cut stone full of mana.
  mana_gem: (c) => (
    <>
      <path d="M32 6L52 24L32 58L12 24Z" fill={c.mid} />
      <path d="M32 6L52 24H12Z" fill={c.light} />
      <path d="M22 24L32 6L42 24L32 58Z" fill={WHITE} opacity="0.55" />
      <path d="M12 24H52M22 24L32 58L42 24" fill="none" stroke={c.deep} strokeWidth="1.2" />
      <path d="M48 8L49.5 12.5L54 14L49.5 15.5L48 20L46.5 15.5L42 14L46.5 12.5Z" fill={WHITE} />
    </>
  ),
  // A book of spells, clasped, a star on its cover.
  spell_book: (c) => (
    <>
      <path d="M14 14Q14 10 18 10H48V50H18Q14 50 14 54Z" fill={c.mid} />
      <path d="M14 14Q14 10 18 10H22V50H18Q14 50 14 54Z" fill={c.deep} />
      <path d="M18 50H50V56H18Q14 56 14 53Q14 50 18 50Z" fill={WHITE} />
      <path d="M48 10L40 10L48 18ZM48 50L40 50L48 42Z" fill={GOLD} />
      <path d="M35 18L37.6 26L46 26L39.2 31L41.8 39L35 34L28.2 39L30.8 31L24 26L32.4 26Z" fill={GOLD} />
      <path d="M48 27H53V33H48Z" fill={GOLD_DARK} />
    </>
  ),
  // A staff older than the kingdoms, a light caught in its crook.
  ancient_staff: (c) => (
    <>
      <path d="M14 56L18 58L38 24L34 22Z" fill={WOOD} />
      <path d="M34 22Q26 8 42 6Q56 6 54 20Q52 30 42 28L43 23Q49 24 49.5 18Q50 11 42 11Q34 12 38 22Z" fill={GOLD} />
      <circle cx="43" cy="17" r="6.5" fill={c.mid} />
      <circle cx="41" cy="15" r="2.6" fill={WHITE} />
      <path d="M22 38L28 41M18 45L24 48" stroke={GOLD_DARK} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M54 6L55 9L58 10L55 11L54 14L53 11L50 10L53 9Z" fill={WHITE} />
    </>
  ),
  // An hourglass, the sand still running.
  hourglass: (c) => (
    <>
      <path d="M14 8H50V14H14ZM14 50H50V56H14Z" fill={GOLD} />
      <path d="M18 14H46Q46 26 34 32Q46 38 46 50H18Q18 38 30 32Q18 26 18 14Z" fill={c.light} opacity="0.75" />
      <path d="M22 18H42Q40 26 32 30Q24 26 22 18Z" fill={GOLD} />
      <path d="M32 30V44" stroke={GOLD} strokeWidth="1.8" />
      <path d="M20 50Q22 42 32 40Q42 42 44 50Z" fill={GOLD} />
      <path d="M16 14V50M48 14V50" stroke={GOLD_DARK} strokeWidth="2.4" />
    </>
  ),
  // A guardian's shield, a heart at its centre.
  guardian_plate: (c) => (
    <>
      <path d="M32 6L54 13V32Q54 49 32 58Q10 49 10 32V13Z" fill={GOLD} />
      <path d="M32 11L49 16.5V32Q49 45.5 32 53Q15 45.5 15 32V16.5Z" fill={STEEL} />
      <path d="M32 11L49 16.5V24Q32 16 15 24V16.5Z" fill={WHITE} />
      <path d="M32 46C20 37 22 25 28 25C30.5 25 32 27 32 29C32 27 33.5 25 36 25C42 25 44 37 32 46Z" fill={c.mid} />
      <path d="M32 11V22M15 32H22M42 32H49" stroke={STEEL_DARK} strokeWidth="1.6" />
    </>
  ),
  // A blade forged in a storm: lightning with a hilt.
  storm_blade: (c) => (
    <>
      <path d="M52 6L40 22L47 23L30 42L22 34L33 22L27 20Z" fill={c.light} />
      <path d="M52 6L40 22L47 23L27 39L22 34L33 22L27 20Z" fill={WHITE} />
      <path d="M14 32L32 50L29 53L11 35Z" fill={GOLD} />
      <path d="M17 43L21 47L13 55L9 51Z" fill={WOOD_DARK} />
      <circle cx="10" cy="54" r="3.4" fill={GOLD_DARK} />
      <path
        d="M50 30L44 38L48 38L42 48"
        fill="none"
        stroke={c.light}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 12L18 18L15 18L19 26"
        fill="none"
        stroke={c.light}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  // A feather from the firebird, still alight at its tip.
  phoenix_feather: () => (
    <>
      <path d="M50 8Q20 10 16 46Q44 44 50 8Z" fill="#ff8a2c" />
      <path d="M50 8Q30 14 22 40Q42 36 50 8Z" fill="#ffd166" />
      <path d="M50 8Q28 30 12 58" fill="none" stroke={WOOD_DARK} strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M40 18L30 20M36 26L24 28M30 34L19 37M44 24L40 34M38 32L33 42"
        stroke="#c9501a"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M50 8Q56 2 54 12Q58 10 55 17Q52 13 50 8Z" fill={BLOOD} />
      <path d="M14 14L15.2 17.6L19 19L15.2 20.4L14 24L12.8 20.4L9 19L12.8 17.6Z" fill="#ffd166" />
    </>
  ),
  // A sphere of bound magic on a stand, a ring turning about it.
  arcane_orb: (c) => (
    <>
      <path d="M22 50H42L46 57H18Z" fill={GOLD_DARK} />
      <path d="M26 44H38L42 50H22Z" fill={GOLD} />
      <circle cx="32" cy="27" r="17" fill={c.deep} />
      <circle cx="32" cy="27" r="15" fill={c.mid} />
      <circle cx="27" cy="22" r="6" fill={WHITE} opacity="0.85" />
      <path d="M26 30Q32 24 38 30Q32 36 26 30Z" fill={c.light} opacity="0.7" />
      <ellipse
        cx="32"
        cy="27"
        rx="23"
        ry="7"
        fill="none"
        stroke={GOLD}
        strokeWidth="2.4"
        transform="rotate(-22 32 27)"
      />
      <circle cx="53" cy="18.5" r="2.6" fill={WHITE} />
    </>
  ),
  // A cloak that the wind never lets hang still.
  wind_cloak: (c) => (
    <>
      <path d="M20 12Q32 6 44 12L54 46Q48 42 44 52Q40 44 35 54Q30 44 25 53Q20 42 10 48Z" fill={c.mid} />
      <path d="M20 12Q32 6 44 12L46 20Q32 12 18 20Z" fill={c.light} />
      <path
        d="M32 16Q27 32 30 50M40 16Q41 30 44 46M24 17Q19 30 16 44"
        fill="none"
        stroke={c.deep}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="32" cy="12" r="4.4" fill={GOLD} />
      <circle cx="32" cy="12" r="1.8" fill={GOLD_DARK} />
      <path
        d="M48 12Q58 12 56 20Q54 25 49 22M4 26Q12 24 13 30"
        fill="none"
        stroke={WHITE}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
};
