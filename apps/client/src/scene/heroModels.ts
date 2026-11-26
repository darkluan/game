import { BRAWLER_ACTIONS, type BrawlerColours } from './Brawler';
import { CUBE_ACTIONS, type CubeColours } from './Cube';
import { HYDRA_ACTIONS, type HydraColours } from './Hydra';
import { DUELIST_ACTIONS, type DuelistColours } from './Duelist';
import { IRONCLAD_ACTIONS, type IroncladColours } from './Ironclad';
import { LONG_DRAGON_ACTIONS, type LongDragonColours } from './LongDragon';
import { MECH_ACTIONS, type MechColours } from './Mech';
import type { HumanDress } from './humanDress';
import { MODELS } from './models';
import { SWORDSMAN_ACTIONS, type SwordsmanColours } from './Swordsman';

/** How long each of a hero's actions plays, by its name. The other fields are left from the days of model files. */
export interface Rig {
  idle: string;
  run: string;
  death: string;
  actions: Record<string, { clip: string; seconds: number }>;
}

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
  /** What is drawn in code onto a Human's model: a line round it, eyes, a lit weapon and its own ornaments. */
  dress?: HumanDress;
  /** Set for a hero drawn as a winged or many-headed dragon built in code; `model` is then empty. */
  hydra?: HydraColours;
  /** Set for a hero drawn as the wandering swordsman built in code; `model` is then empty. */
  swordsman?: SwordsmanColours;
  /** Set for a hero drawn as the long eastern dragon built in code; `model` is then empty. */
  longDragon?: LongDragonColours;
  /** Set for a hero drawn as the tall figure in plate with guns for forearms, built in code; `model` is then empty. */
  ironclad?: IroncladColours;
  /** Set for a hero drawn as the cloaked swordsman with a blade in each hand, built in code; `model` is then empty. */
  duelist?: DuelistColours;
  /** Set for a hero drawn as the four-armed dragon that walks upright, built in code; `model` is then empty. */
  brawler?: BrawlerColours;
  /** Set for a hero drawn as the thinking puzzle cube built in code; `model` is then empty. */
  cube?: CubeColours;
  /** Set for a hero drawn as a war machine built in code; `model` is then empty. */
  mech?: MechColours;
}

export interface HeroModel extends HeroLook {
  /** A dragon with a body of its own for each form: the look after each evolution, replacing the base look. */
  stages?: HeroLook[];
}

/**
 * How each hero looks. The dragons are built in code and grow as they evolve;
 * the machines are mechs.
 */
export const HERO_MODELS: Record<string, HeroModel> = {
  // The four Humans are the CC0 "RPG Characters" by Quaternius: the warrior with his sword for Kael.
  kael: {
    model: MODELS.humanWarrior,
    dress: 'warrior',
    hide: [],
    scale: 1,
    height: 2.3,
    showcaseScale: 0.9,
    rig: {
      idle: 'Idle_Weapon',
      run: 'Run_Weapon',
      death: 'Death',
      actions: {
        attack: { clip: 'Sword_Attack', seconds: 0.5 },
        Q: { clip: 'Roll', seconds: 0.55 },
        W: { clip: 'Punch', seconds: 0.7 },
        E: { clip: 'Sword_AttackFast', seconds: 0.55 },
        R: { clip: 'Sword_Attack', seconds: 0.8 },
      },
    },
  },
  // The ranger with her bow.
  lyra: {
    model: MODELS.humanRanger,
    dress: 'ranger',
    hide: [],
    scale: 1,
    height: 2.25,
    showcaseScale: 0.9,
    rig: {
      idle: 'Idle_Weapon',
      run: 'Run_Holding',
      death: 'Death',
      actions: {
        attack: { clip: 'Bow_Attack_Shoot', seconds: 0.5 },
        Q: { clip: 'Bow_Attack_Shoot', seconds: 0.55 },
        W: { clip: 'Bow_Attack_Draw', seconds: 0.7 },
        E: { clip: 'Roll', seconds: 0.55 },
        R: { clip: 'Bow_Attack_Draw', seconds: 0.8 },
      },
    },
  },
  // Fire: a dragon of the eastern kind, built in code: a long crimson body swimming through the air, a
  // mane and whiskers of flame, antlers, and a burning pearl. It has one body and simply grows as it evolves.
  ignar: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.2,
    showcaseScale: 0.85,
    longDragon: { scale: '#b3261e', belly: '#e9b44a', mane: '#ff8a1e', horn: '#f2e2b8', glow: '#ffd24a' },
    rig: { idle: '', run: '', death: '', actions: LONG_DRAGON_ACTIONS },
  },
  // Stone: a heavy dragon armoured in pale bone, with ram's horns and a club on its tail, splinters of
  // bone circling it. Built in code; it has one body and simply grows as it evolves.
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
      fin: '#c9c2ae',
      glow: '#4fe3b0',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
  },
  // The dawn goddess: white and gold, a sun turning behind her head, wings of light, floating. Built in code.
  sola: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.05,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'mage',
      divine: 'sun',
      cloth: '#f1dfb6',
      armour: '#d99a2b',
      trim: '#ffd35a',
      ribbon: '#ffe9a0',
      skin: '#f6d6bc',
      hair: '#f2c868',
      blade: '#fff6dc',
      gem: '#ffb347',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
  },
  // The god of shadow: hooded in deep violet, a dark crescent behind him, wisps of shadow trailing. Built in code.
  vesper: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.05,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'blade',
      divine: 'moon',
      cloth: '#3a2378',
      armour: '#221a45',
      trim: '#c9b8ff',
      ribbon: '#b98cff',
      skin: '#d9c9e8',
      hair: '#e8e0ff',
      blade: '#cfc6ee',
      gem: '#c084ff',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
  },
  // A gun walker in steel blue: a long cannon on one shoulder, twin barrels for an arm. Built in code.
  bolt7: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.5,
    showcaseScale: 0.9,
    mech: { kind: 'gunner', hull: '#3d5a80', plate: '#c9d6e8', glow: '#5ad7ff' },
    rig: { idle: '', run: '', death: '', actions: MECH_ACTIONS },
  },
  // A round little builder in workshop yellow, a crane over its back and a drone circling it. Built in code.
  mekka: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.2,
    showcaseScale: 0.9,
    mech: { kind: 'engineer', hull: '#c98a2b', plate: '#f2d9a0', glow: '#7dffb0' },
    rig: { idle: '', run: '', death: '', actions: MECH_ACTIONS },
  },
  // The wizard with his staff.
  mira: {
    model: MODELS.humanWizard,
    dress: 'wizard',
    hide: [],
    scale: 1,
    height: 2.3,
    showcaseScale: 0.9,
    rig: {
      idle: 'Idle_Weapon',
      run: 'Run_Weapon',
      death: 'Death',
      actions: {
        attack: { clip: 'Staff_Attack', seconds: 0.5 },
        Q: { clip: 'Spell1', seconds: 0.55 },
        W: { clip: 'Spell2', seconds: 0.7 },
        E: { clip: 'Spell1', seconds: 0.55 },
        R: { clip: 'Spell2', seconds: 0.8 },
      },
    },
  },
  // Storm: a black winged dragon with fire showing between its scales, fins and a mane of flame, and
  // burning shards circling it. Built in code; it has one body and simply grows as it evolves.
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
      fin: '#b8321c',
      glow: '#ff4a1a',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
  },
  // The god of the mountain: a broad old giant crowned and horned in stone, a great hammer, boulders circling him. Built in code.
  orun: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.35,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'blade',
      divine: 'mountain',
      cloth: '#a8672c',
      armour: '#8f8a80',
      trim: '#e2b45c',
      ribbon: '#e0b070',
      skin: '#c99a72',
      hair: '#ece6da',
      blade: '#b9b2a6',
      gem: '#ffb45a',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
  },
  // A lean black killer, a blade on each arm and a saw that never stops, lit in red. Built in code.
  raze3: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.6,
    showcaseScale: 0.9,
    mech: { kind: 'striker', hull: '#2b2f3a', plate: '#8b93a7', glow: '#ff3b5c' },
    rig: { idle: '', run: '', death: '', actions: MECH_ACTIONS },
  },
  // The cleric with her staff.
  elna: {
    model: MODELS.humanCleric,
    dress: 'cleric',
    hide: [],
    scale: 1,
    height: 2.25,
    showcaseScale: 0.9,
    rig: {
      idle: 'Idle_Weapon',
      run: 'Run_Weapon',
      death: 'Death',
      actions: {
        attack: { clip: 'Staff_Attack', seconds: 0.5 },
        Q: { clip: 'Spell1', seconds: 0.55 },
        W: { clip: 'Spell2', seconds: 0.7 },
        E: { clip: 'Spell1', seconds: 0.55 },
        R: { clip: 'Spell2', seconds: 0.8 },
      },
    },
  },
  // Venom: a three-headed dragon in black-green scales with violet wings and fins, venom glowing between
  // the scales and dripping from all three mouths. Built in code; it has one body and simply grows as it evolves.
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
      fin: '#8a4be0',
      glow: '#b4ff3a',
    },
    rig: { idle: '', run: '', death: '', actions: HYDRA_ACTIONS },
  },
  // The god of death: robed and hooded in black, a skull for a face with grave-light in its eyes, ragged
  // wings, a scythe taller than itself and the souls it has taken circling it. Built in code. She is
  // called Thana; the id is left from when she was Aeris, the god of wind, so saved picks and builds still find her.
  aeris: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.15,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'mage',
      divine: 'death',
      cloth: '#2a2d3a',
      armour: '#3f4454',
      trim: '#cfd6d2',
      ribbon: '#5dffa8',
      skin: '#e6e3d4',
      hair: '#c9cfd2',
      blade: '#dfe9e6',
      gem: '#4dff9c',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
  },
  // A wall on legs in olive armour: huge shoulders, a shield, fists like anvils, stacks that burn. Built in code.
  titan9: {
    model: '',
    hide: [],
    scale: 1,
    height: 3.0,
    showcaseScale: 0.9,
    mech: { kind: 'fortress', hull: '#4a5548', plate: '#aab79a', glow: '#ffb347' },
    rig: { idle: '', run: '', death: '', actions: MECH_ACTIONS },
  },
  // A swordsman of the night, a Human on a frame of his own: a low broad figure in a ragged hooded
  // cloak and a blank mask, a long curved blade in each hand burning with a deep blue fire. Built in code.
  varo: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.7,
    showcaseScale: 0.9,
    duelist: { cloak: '#131a3d', cloth: '#24347c', plate: '#3d5fc8', trim: '#d08f52', fire: '#2b6dff' },
    rig: { idle: '', run: '', death: '', actions: DUELIST_ACTIONS },
    // From level 6 the fire is no longer only on the blades: it wraps the whole of him.
    stages: [
      {
        model: '',
        hide: [],
        scale: 1,
        height: 2.7,
        duelist: {
          cloak: '#131a3d',
          cloth: '#24347c',
          plate: '#3d5fc8',
          trim: '#d08f52',
          fire: '#2b6dff',
          ablaze: true,
        },
        rig: { idle: '', run: '', death: '', actions: DUELIST_ACTIONS },
      },
    ],
  },
  // The god of the forge: a tall lean figure in gold plate over red, its helm of black and silver, a fire burning in it, a crest of that
  // fire on its helm, and a gun for each forearm. Built in code, on a frame of its own.
  brann: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.7,
    showcaseScale: 0.85,
    ironclad: { under: '#b01f2a', plate: '#e3a92c', trim: '#fff0b8', fire: '#ff3d24', helm: '#b9c0cc' },
    rig: { idle: '', run: '', death: '', actions: IRONCLAD_ACTIONS },
  },
  // A dragon in the shape of a man, with four arms: smooth blue skin over heavy muscle, a red sash, horns of bone,
  // built in code. Unlike the other dragons it has a body for each form: lean with stubs for horns, then thick and
  // spined, then a deeper blue and burning gold at its spines, knuckles and chest, and at last red, with six arms
  // and a long dark sash.
  garok: {
    model: '',
    hide: [],
    scale: 1,
    height: 1.95,
    showcaseScale: 0.95,
    brawler: { form: 0, hide: '#4f7fd6', belly: '#8fb4f0', cloth: '#b8322a', horn: '#efe3c4', glow: '#ffc83d' },
    rig: { idle: '', run: '', death: '', actions: BRAWLER_ACTIONS },
    stages: [
      {
        model: '',
        hide: [],
        scale: 1,
        height: 2.3,
        brawler: { form: 1, hide: '#3a64c2', belly: '#7ea4ea', cloth: '#b8322a', horn: '#efe3c4', glow: '#ffc83d' },
        rig: { idle: '', run: '', death: '', actions: BRAWLER_ACTIONS },
      },
      {
        model: '',
        hide: [],
        scale: 1,
        height: 2.7,
        brawler: { form: 2, hide: '#27479c', belly: '#6088d8', cloth: '#8f2420', horn: '#f4ead0', glow: '#ffc83d' },
        rig: { idle: '', run: '', death: '', actions: BRAWLER_ACTIONS },
      },
      {
        model: '',
        hide: [],
        scale: 1,
        height: 3.1,
        brawler: { form: 3, hide: '#b3262a', belly: '#e2675c', cloth: '#241c2e', horn: '#f4ead0', glow: '#ffc83d' },
        rig: { idle: '', run: '', death: '', actions: BRAWLER_ACTIONS },
      },
    ],
  },
  // A puzzle cube that thinks: three layers of coloured tiles turning on each other, an eye in its
  // front, hanging in the air with loose pieces circling it. Built in code.
  kubo6: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.5,
    showcaseScale: 0.9,
    cube: { body: '#161a24', glow: '#7df9ff' },
    rig: { idle: '', run: '', death: '', actions: CUBE_ACTIONS },
  },
};
