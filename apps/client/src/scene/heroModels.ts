import type { ActorOptions, Rig } from './Actor';
import { MODELS } from './models';

const BASE = { idle: 'Idle', run: 'Running_A', death: 'Death_A' } as const;
const clip = (name: string, seconds = 0.6) => ({ clip: name, seconds });

export interface HeroLook {
  model: string;
  rig: Rig;
  /** Parts of the model to hide, e.g. the weapons this hero does not carry. */
  hide: string[];
  /** Multiplied into the texture. Sets heroes sharing a model apart. */
  tint?: string;
  /** New colours for materials, by material name, for models coloured by material instead of a texture. */
  palette?: Record<string, string>;
  scale: number;
  /** Fit the model to this height instead of trusting its own units. */
  height?: number;
  /** Extra turn in radians, for models that do not face +z. */
  turn?: number;
  /** Multiplies the model's colours, for models that come out too dark. */
  brightness?: number;
}

export interface HeroModel extends HeroLook {
  /** Dragons: the look after each evolution, replacing the base look. */
  stages?: HeroLook[];
}

/** The options an Actor needs to draw a hero look. */
export function actorOptions(look: HeroLook, castShadow: boolean): ActorOptions {
  const { scale, height, turn, hide, tint, palette, brightness } = look;
  return { scale, height, turn, hide, tint, palette, brightness, castShadow };
}

/** The colours of a dragon, by part. */
interface DragonColours {
  body: string;
  belly: string;
  horn: string;
  wing: string;
}

const EYE = { Eye_White: '#ffffff', Eye_Black: '#14181f', Eyes: '#ffe27a' };

/** The long-necked dragon with broad wings. It never lands. */
function wyvern(height: number, c: DragonColours): HeroLook {
  const move = (name: string, seconds: number) => clip(`DragonArmature|Dragon_${name}`, seconds);
  return {
    model: MODELS.dragonWyvern,
    hide: [],
    palette: { ...EYE, Main: c.body, Belly: c.belly, Claws: c.horn, Wings: c.wing },
    scale: 1,
    height,
    rig: {
      idle: 'DragonArmature|Dragon_Flying',
      run: 'DragonArmature|Dragon_Flying',
      death: 'DragonArmature|Dragon_Death',
      actions: {
        attack: move('Attack', 0.6),
        Q: move('Attack2', 0.7),
        W: move('Attack', 0.6),
        E: move('Attack2', 0.7),
        R: move('Attack2', 0.9),
      },
    },
  };
}

/** The stocky dragon, young or grown (`elder`). Both share one set of clips. */
function drake(elder: boolean, height: number, c: DragonColours): HeroLook {
  const move = (name: string, seconds: number) => clip(`CharacterArmature|${name}`, seconds);
  return {
    model: elder ? MODELS.dragonElder : MODELS.dragonYoung,
    hide: [],
    palette: { ...EYE, Dragon_Main: c.body, Dragon_Secondary: c.belly, Dragon_Horn: c.horn },
    scale: 1,
    height,
    rig: {
      idle: 'CharacterArmature|Flying_Idle',
      run: 'CharacterArmature|Fast_Flying',
      death: 'CharacterArmature|Death',
      actions: {
        attack: move('Punch', 0.5),
        Q: move('Headbutt', 0.6),
        W: move('Yes', 0.7),
        E: move('Punch', 0.6),
        R: move('Headbutt', 0.8),
      },
    },
  };
}

/** A mech from the Quaternius pack. A melee mech swings instead of shooting. */
function mech(model: string, height: number, melee = false): HeroLook {
  const strike = melee ? 'SwordSlash' : 'Shoot';
  return {
    model,
    hide: [],
    scale: 1,
    height,
    rig: {
      idle: 'Idle',
      run: 'Run',
      death: 'Death',
      actions: {
        attack: clip(melee ? 'Punch' : 'Shoot', 0.5),
        Q: clip(strike),
        W: clip(melee ? 'Jump' : 'Pickup', 0.8),
        E: clip(melee ? strike : 'Kick'),
        R: clip(melee ? 'Kick' : 'Jump', 0.8),
      },
    },
  };
}

const MAGE_HIDDEN = ['Spellbook', 'Spellbook_open', '1H_Wand'];

/**
 * How each hero looks. The dragons change colour, size and, for some, body as they evolve;
 * the machines are mechs.
 */
export const HERO_MODELS: Record<string, HeroModel> = {
  kael: {
    model: MODELS.knight,
    hide: ['1H_Sword_Offhand', 'Badge_Shield', 'Round_Shield', 'Spike_Shield', '2H_Sword'],
    scale: 0.95,
    rig: {
      ...BASE,
      actions: {
        attack: clip('1H_Melee_Attack_Chop'),
        Q: clip('1H_Melee_Attack_Stab'),
        W: clip('Blocking', 0.7),
        E: clip('Block_Attack'),
        R: clip('Jump_Full_Short', 0.7),
      },
    },
  },
  lyra: {
    model: MODELS.rogue,
    hide: ['Knife_Offhand', '1H_Crossbow', 'Knife', 'Throwable'],
    scale: 0.92,
    rig: {
      ...BASE,
      actions: {
        attack: clip('2H_Ranged_Shoot', 0.5),
        Q: clip('Throw'),
        W: clip('2H_Ranged_Shoot'),
        E: clip('Dodge_Forward', 0.4),
        R: clip('2H_Ranged_Shoot', 0.8),
      },
    },
  },
  // Fire: a red wyvern whose scales darken and wings brighten as it grows.
  ignar: {
    ...wyvern(2.4, { body: '#d9552b', belly: '#f2c46a', horn: '#3a2a22', wing: '#f08a3c' }),
    stages: [
      wyvern(3.1, { body: '#c5371f', belly: '#f5b54a', horn: '#2a1c18', wing: '#ff7a2a' }),
      wyvern(3.9, { body: '#8f1d1d', belly: '#ffcf5a', horn: '#1a1212', wing: '#ff5a1f' }),
    ],
  },
  // Stone: a grey drake that grows into the heavy elder.
  baru: {
    ...drake(false, 2.4, { body: '#7f8b99', belly: '#c9c2ad', horn: '#e9e2cf', wing: '#5f6a78' }),
    stages: [
      drake(true, 3, { body: '#6b7785', belly: '#bdb59d', horn: '#f1ead6', wing: '#4f5966' }),
      drake(true, 3.6, { body: '#4d5764', belly: '#a8a08a', horn: '#fff6dd', wing: '#3a424d' }),
    ],
  },
  sola: {
    model: MODELS.mage,
    hide: MAGE_HIDDEN,
    tint: '#fff0b8',
    scale: 0.95,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Spellcast_Shoot'),
        Q: clip('Spellcast_Raise'),
        W: clip('Spellcast_Raise'),
        E: clip('Spellcast_Shoot'),
        R: clip('Spellcast_Long', 1),
      },
    },
  },
  vesper: {
    model: MODELS.rogueHooded,
    hide: ['1H_Crossbow', '2H_Crossbow', 'Throwable'],
    tint: '#b9a2e8',
    scale: 0.92,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Dualwield_Melee_Attack_Slice', 0.5),
        Q: clip('Dualwield_Melee_Attack_Stab'),
        W: clip('Spellcast_Raise'),
        E: clip('Throw'),
        R: clip('Spellcast_Raise', 0.8),
      },
    },
  },
  bolt7: mech(MODELS.mechMike, 3),
  mekka: mech(MODELS.mechLeela, 2.7),
  mira: {
    model: MODELS.mage,
    // Sola carries the staff; Mira reads from an open book and casts with a wand.
    hide: ['2H_Staff', 'Spellbook'],
    tint: '#b9c8ff',
    scale: 0.95,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Spellcast_Shoot'),
        Q: clip('Spellcast_Shoot'),
        W: clip('Spellcast_Raise'),
        E: clip('Spellcast_Raise', 0.4),
        R: clip('Spellcast_Long', 1),
      },
    },
  },
  // Storm: a blue-violet drake with lightning-yellow horns.
  zerak: {
    ...drake(false, 2.4, { body: '#3f6fd8', belly: '#bfe3ff', horn: '#ffe14d', wing: '#2b4fa8' }),
    stages: [
      drake(false, 2.8, { body: '#3a4fc9', belly: '#c9e6ff', horn: '#ffe14d', wing: '#27358f' }),
      drake(true, 3.4, { body: '#3b2f9e', belly: '#d6ecff', horn: '#fff07a', wing: '#241c6b' }),
    ],
  },
  orun: {
    model: MODELS.barbarian,
    hide: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug'],
    tint: '#ffe9b0',
    scale: 1.12,
    rig: {
      ...BASE,
      actions: {
        attack: clip('2H_Melee_Attack_Chop', 0.7),
        Q: clip('2H_Melee_Attack_Chop'),
        W: clip('Block', 0.8),
        E: clip('2H_Melee_Attack_Spin', 0.7),
        R: clip('Jump_Full_Short', 0.7),
      },
    },
  },
  raze3: mech(MODELS.mechStan, 2.8, true),
};
