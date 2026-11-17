import type { Rig } from './Actor';
import { MODELS } from './models';

const BASE = { idle: 'Idle', run: 'Running_A', death: 'Death_A' } as const;
const clip = (name: string, seconds = 0.6) => ({ clip: name, seconds });

export interface HeroModel {
  model: string;
  rig: Rig;
  /** Parts of the model to hide, e.g. the weapons this hero does not carry. */
  hide: string[];
  /** Multiplied into the texture. Sets heroes sharing a model apart. */
  tint?: string;
  scale: number;
}

const MAGE_HIDDEN = ['Spellbook', 'Spellbook_open', '1H_Wand'];

/**
 * How each hero looks. The dragons and machines have no model of their own yet, so they borrow a
 * human or skeleton model with a tint.
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
  ignar: {
    model: MODELS.mage,
    hide: MAGE_HIDDEN,
    tint: '#ff8a5c',
    scale: 0.95,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Spellcast_Shoot'),
        Q: clip('Spellcast_Shoot'),
        W: clip('Spellcast_Shoot'),
        E: clip('Spellcast_Raise'),
        R: clip('Spellcast_Long', 1),
      },
    },
  },
  baru: {
    model: MODELS.barbarian,
    hide: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug'],
    tint: '#a9b0b8',
    scale: 1.05,
    rig: {
      ...BASE,
      actions: {
        attack: clip('2H_Melee_Attack_Chop', 0.7),
        Q: clip('Dodge_Forward', 0.4),
        W: clip('Block', 0.8),
        E: clip('2H_Melee_Attack_Spin', 0.7),
        R: clip('Jump_Full_Short', 0.7),
      },
    },
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
  bolt7: {
    model: MODELS.skeletonWarrior,
    hide: [],
    tint: '#8fd0ff',
    scale: 0.95,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Spellcast_Shoot', 0.5),
        Q: clip('Spellcast_Shoot'),
        W: clip('Spellcast_Raise'),
        E: clip('2H_Melee_Attack_Spin', 0.7),
        R: clip('Spellcast_Raise', 0.8),
      },
    },
  },
  mekka: {
    model: MODELS.skeletonRogue,
    hide: [],
    tint: '#ffc27a',
    scale: 0.92,
    rig: {
      ...BASE,
      actions: {
        attack: clip('Spellcast_Shoot'),
        Q: clip('Throw'),
        W: clip('Interact', 0.8),
        E: clip('Throw'),
        R: clip('Spellcast_Raise', 0.8),
      },
    },
  },
};
