import type { ActorOptions, Rig } from './Actor';
import { HYDRA_ACTIONS, type HydraColours } from './Hydra';
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
  /** Multiplies the size on the hero-picking screens only, for a hero that fills too much of the stage there. */
  showcaseScale?: number;
  /** Set for a hero drawn as the three-headed dragon built in code; `model` is then empty. */
  hydra?: HydraColours;
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

/** Eye colours for the models that are coloured by material. */
const EYE = { Eye_White: '#ffffff', Eye_Black: '#14181f' };

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
 * How each hero looks. The dragons are built in code and grow as they evolve;
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
  // Fire: the red skeleton of a dragon with a fire burning in its ribs, built in code. It has one body
  // and simply grows as it evolves.
  ignar: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.1,
    showcaseScale: 0.9,
    hydra: {
      heads: 1,
      skeleton: true,
      scale: '#b8322a',
      accent: '#7c1d1a',
      belly: '#d8574a',
      horn: '#5a1614',
      wing: '#5c1410',
      glow: '#ffae3b',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
  },
  // Stone: a heavy dragon armoured in pale bone, built in code. It has one body and simply grows as it evolves.
  baru: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.05,
    showcaseScale: 0.9,
    hydra: {
      heads: 1,
      heavy: true,
      scale: '#6f7684',
      accent: '#9aa0ab',
      // Kept well short of white: the lobby's lights would wash white bone out into a glare.
      belly: '#a8a192',
      horn: '#8e887b',
      wing: '#8f95a3',
      glow: '#4fe3b0',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
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
  // Storm: a black dragon with fire showing between its plates, built in code. It has one body and
  // simply grows as it evolves.
  zerak: {
    model: '',
    hide: [],
    scale: 1,
    height: 1.95,
    showcaseScale: 0.88,
    hydra: {
      heads: 1,
      scale: '#3a3c48',
      accent: '#555866',
      belly: '#3c3e48',
      horn: '#5a5c68',
      wing: '#17171c',
      glow: '#ff4a1a',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
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
  // The medic wears the hooded outfit in pale green and carries a hand crossbow instead of knives.
  elna: {
    model: MODELS.rogueHooded,
    hide: ['Knife', 'Knife_Offhand', '2H_Crossbow', 'Throwable'],
    tint: '#c9f7d2',
    scale: 0.92,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Throw', 0.5),
        Q: clip('Throw'),
        W: clip('Spellcast_Raise'),
        E: clip('Throw'),
        R: clip('Spellcast_Raise', 0.8),
      },
    },
  },
  // Venom: a three-headed dragon in black-green scales with violet wings, its venom glowing between
  // the scales and in all three throats. Built in code; it has one body and simply grows as it evolves.
  nyx: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.3,
    showcaseScale: 0.85,
    hydra: {
      scale: '#27503a',
      accent: '#3f7d55',
      belly: '#6f7d3a',
      horn: '#2c2338',
      wing: '#3d2470',
      glow: '#b4ff3a',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
  },
  // The wind god is a small robed spirit, in sky white and gold.
  aeris: {
    model: MODELS.windSpirit,
    hide: [],
    palette: { ...EYE, Wizard_Main: '#dff3ff', Wizard_Secondary: '#f2c94c' },
    scale: 1,
    height: 2.1,
    rig: {
      idle: 'CharacterArmature|Idle',
      run: 'CharacterArmature|Walk',
      death: 'CharacterArmature|Death',
      actions: {
        attack: clip('CharacterArmature|Bite_Front', 0.5),
        Q: clip('CharacterArmature|Bite_Front'),
        W: clip('CharacterArmature|Yes', 0.7),
        E: clip('CharacterArmature|Jump', 0.6),
        R: clip('CharacterArmature|Dance', 1),
      },
    },
  },
  titan9: mech(MODELS.mechGeorge, 3.3, true),
};
