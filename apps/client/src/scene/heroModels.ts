import { HYDRA_ACTIONS, type HydraColours } from './Hydra';
import { LONG_DRAGON_ACTIONS, type LongDragonColours } from './LongDragon';
import { MECH_ACTIONS, type MechColours } from './Mech';
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
  /** Set for a hero drawn as a winged or many-headed dragon built in code; `model` is then empty. */
  hydra?: HydraColours;
  /** Set for a hero drawn as the wandering swordsman built in code; `model` is then empty. */
  swordsman?: SwordsmanColours;
  /** Set for a hero drawn as the long eastern dragon built in code; `model` is then empty. */
  longDragon?: LongDragonColours;
  /** Set for a hero drawn as a war machine built in code; `model` is then empty. */
  mech?: MechColours;
}

export interface HeroModel extends HeroLook {
  /** Dragons: the look after each evolution, replacing the base look. */
  stages?: HeroLook[];
}

/**
 * How each hero looks. The dragons are built in code and grow as they evolve;
 * the machines are mechs.
 */
export const HERO_MODELS: Record<string, HeroModel> = {
  // A young blade-master in the style of a wuxia cartoon, built in code: big head, spiked hair in a
  // topknot, plated shoulders, flying ribbons and a sabre as tall as he is. In the Humans' blue and silver.
  kael: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.1,
    showcaseScale: 0.9,
    swordsman: {
      cloth: '#27408f',
      armour: '#3b4d74',
      trim: '#e8b84a',
      ribbon: '#3fd0ff',
      skin: '#f0c39c',
      hair: '#1a1b26',
      blade: '#e6edf5',
      gem: '#4aa3ff',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
  },
  // An archer in the same wuxia-cartoon style as Kael: hair in two buns with long tails, a short flared
  // skirt, a tall bow and a quiver. In forest green with coral ribbons.
  lyra: {
    model: '',
    hide: [],
    scale: 1,
    height: 2,
    showcaseScale: 0.9,
    swordsman: {
      archer: true,
      cloth: '#2c8a5c',
      armour: '#3f5f4a',
      trim: '#e8c35a',
      ribbon: '#ff7d5c',
      skin: '#f4cdaa',
      hair: '#b44a2c',
      blade: '#e6edf5',
      gem: '#5fe0a0',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
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
      cloth: '#e6d6b4',
      armour: '#c9a24a',
      trim: '#ffd76a',
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
      cloth: '#2a1c4a',
      armour: '#1d1933',
      trim: '#8a7ab8',
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
  // A star mage in a long indigo robe and a tall bent hat, a crescent staff in one hand and a book
  // floating over the other. Built in code.
  mira: {
    model: '',
    hide: [],
    scale: 1,
    height: 2,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'mage',
      cloth: '#3b2f8f',
      armour: '#2f3566',
      trim: '#cfd8f0',
      ribbon: '#8fd0ff',
      skin: '#f4d3bb',
      hair: '#d9d2ff',
      blade: '#e6edf5',
      gem: '#7fb0ff',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
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
      cloth: '#8a6a44',
      armour: '#b9b3a6',
      trim: '#d8b170',
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
  // A field medic in a deep green hooded cloak, a satchel at her hip, a hand crossbow and a mending
  // light she carries over her other hand. Built in code.
  elna: {
    model: '',
    hide: [],
    scale: 1,
    height: 1.95,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'healer',
      cloth: '#2c7048',
      armour: '#5b4630',
      trim: '#dcc47a',
      ribbon: '#9af0a6',
      skin: '#f2cfae',
      hair: '#7a4a2a',
      blade: '#e6edf5',
      gem: '#7dffa0',
    },
    rig: { idle: '', run: '', death: '', actions: SWORDSMAN_ACTIONS },
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
  // The wind god is a small robed spirit, in sky white and gold.
  // The god of wind: pale teal, floating, ringed by turning hoops of air, feathers in her hair and long scarves flying. Built in code.
  aeris: {
    model: '',
    hide: [],
    scale: 1,
    height: 2.05,
    showcaseScale: 0.9,
    swordsman: {
      kind: 'mage',
      divine: 'wind',
      cloth: '#cfeae4',
      armour: '#7fb7b0',
      trim: '#e8fbff',
      ribbon: '#b8f3ff',
      skin: '#f2d9c6',
      hair: '#a9e6dc',
      blade: '#e8fbff',
      gem: '#7fe7ff',
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
};
