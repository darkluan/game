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
  const { scale, height, turn, hide, tint, brightness } = look;
  return { scale, height, turn, hide, tint, brightness, castShadow };
}

/** A dinosaur from the Quaternius pack; every clip is named after the animal. */
function dino(model: string, name: string, height: number, tint: string, death = name): HeroLook {
  const c = (move: string, seconds: number) => clip(`Armature|${name}_${move}`, seconds);
  return {
    model,
    hide: [],
    tint,
    // The pack's colours are very dark; lift them to sit with the rest of the scene.
    brightness: 3,
    scale: 1,
    height,
    rig: {
      idle: `Armature|${name}_Idle`,
      run: `Armature|${name}_Run`,
      death: `Armature|${death}_Death`,
      actions: {
        attack: c('Attack', 0.6),
        Q: c('Attack', 0.6),
        W: c('Attack', 0.7),
        E: c('Attack', 0.6),
        R: c('Jump', 0.8),
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

const FIRE = '#ffb089';
const STONE = '#c9d2e6';
const STORM = '#fff3a6';

const MAGE_HIDDEN = ['Spellbook', 'Spellbook_open', '1H_Wand'];

/**
 * How each hero looks. The dragons are dinosaurs that change species as they evolve; the machines
 * are mechs.
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
    ...dino(MODELS.velociraptor, 'Velociraptor', 1.9, FIRE),
    stages: [dino(MODELS.parasaurolophus, 'Parasaurolophus', 2.6, FIRE), dino(MODELS.trex, 'TRex', 3.4, FIRE)],
  },
  baru: {
    ...dino(MODELS.triceratops, 'Triceratops', 1.7, STONE),
    stages: [
      dino(MODELS.stegosaurus, 'Stegosaurus', 2.5, STONE),
      // The pack ships this one's death clip under the Stegosaurus name.
      // Kept low: this animal is several times longer than it is tall.
      dino(MODELS.apatosaurus, 'Apatosaurus', 2.1, STONE, 'Stegosaurus'),
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
  // The storm dragon shares the dinosaur models with the other dragons, in its own colour and order.
  zerak: {
    ...dino(MODELS.velociraptor, 'Velociraptor', 2, STORM),
    stages: [dino(MODELS.stegosaurus, 'Stegosaurus', 2.4, STORM), dino(MODELS.trex, 'TRex', 3.2, STORM)],
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
