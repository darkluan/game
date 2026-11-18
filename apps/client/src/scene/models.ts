import { useLoader } from '@react-three/fiber';
import { Color, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const url = (file: string) => `${import.meta.env.BASE_URL}models/${file}`;

/** CC0 models by Kay Lousberg (KayKit); see public/models/CREDITS.md. The heroes have no model files: they are built in code. */
export const MODELS = {
  minionMelee: url('skeleton_minion.glb'),
  minionRanged: url('skeleton_mage.glb'),
  towerAlly: url('building_tower_A_blue.gltf'),
  towerEnemy: url('building_tower_A_red.gltf'),
  shrineAlly: url('building_castle_blue.gltf'),
  shrineEnemy: url('building_castle_red.gltf'),
  treeA: url('tree_single_A.gltf'),
  treeB: url('tree_single_B.gltf'),
  rock: url('rock_single_C.gltf'),
  // Scenery around the battlefield.
  mountainAGrassTrees: url('mountain_A_grass_trees.gltf'),
  mountainBGrassTrees: url('mountain_B_grass_trees.gltf'),
  mountainCGrass: url('mountain_C_grass.gltf'),
  hillsATrees: url('hills_A_trees.gltf'),
  hillsBTrees: url('hills_B_trees.gltf'),
  hillsC: url('hills_C.gltf'),
  rockSingleA: url('rock_single_A.gltf'),
  rockSingleB: url('rock_single_B.gltf'),
  treesALarge: url('trees_A_large.gltf'),
  treesBLarge: url('trees_B_large.gltf'),
  flagBlue: url('flag_blue.gltf'),
  flagRed: url('flag_red.gltf'),
  barrel: url('barrel.gltf'),
  crateABig: url('crate_A_big.gltf'),
  weaponrack: url('weaponrack.gltf'),
  tent: url('tent.gltf'),
  fenceStoneStraight: url('fence_stone_straight.gltf'),
  homeAAlly: url('building_home_A_blue.gltf'),
  homeAEnemy: url('building_home_A_red.gltf'),
  homeBAlly: url('building_home_B_blue.gltf'),
  homeBEnemy: url('building_home_B_red.gltf'),
  windmillAlly: url('building_windmill_blue.gltf'),
  windmillEnemy: url('building_windmill_red.gltf'),
  barracksAlly: url('building_barracks_blue.gltf'),
  barracksEnemy: url('building_barracks_red.gltf'),
} as const;

/** Loads a model once and caches it. Suspends while loading. */
export function useModel(path: string): GLTF {
  return useLoader(GLTFLoader, path);
}

/** Loads several models with one hook call. Suspends until all are in. */
export function useModels(paths: string[]): GLTF[] {
  return useLoader(GLTFLoader, paths);
}

/** The first mesh of a single-mesh prop model, for instancing. */
export function firstMesh(root: Object3D): Mesh {
  let found: Mesh | undefined;
  root.traverse((o) => {
    if (!found && o instanceof Mesh) found = o;
  });
  if (!found) throw new Error('model has no mesh');
  return found;
}

export function setShadows(root: Object3D, cast: boolean, receive = false): void {
  root.traverse((o) => {
    if (o instanceof Mesh) {
      o.castShadow = cast;
      o.receiveShadow = receive;
    }
  });
}

const tinted = new Map<string, MeshStandardMaterial>();

/**
 * Multiplies every material's colour by `tint`, and by `brightness` for models whose own colours
 * are too dark for this scene (those are also made matte). Tinted materials are shared between clones.
 */
export function tintModel(root: Object3D, tint: string, brightness = 1): void {
  const colour = new Color(tint).multiplyScalar(brightness);
  root.traverse((o) => {
    if (!(o instanceof Mesh) || Array.isArray(o.material)) return;
    const key = `${o.material.uuid}:${tint}:${brightness}`;
    let material = tinted.get(key);
    if (!material) {
      material = (o.material as MeshStandardMaterial).clone();
      material.color.multiply(colour);
      if (brightness !== 1) material.metalness = 0;
      tinted.set(key, material);
    }
    o.material = material;
  });
}

const painted = new Map<string, MeshStandardMaterial>();

/**
 * Gives materials new colours by name, for models coloured by material instead of by a texture.
 * Materials not named keep their own colour. Painted materials are shared between clones.
 */
export function paintModel(root: Object3D, palette: Record<string, string>): void {
  root.traverse((o) => {
    if (!(o instanceof Mesh) || Array.isArray(o.material)) return;
    const colour = palette[o.material.name];
    if (!colour) return;
    const key = `${o.material.uuid}:${colour}`;
    let material = painted.get(key);
    if (!material) {
      material = (o.material as MeshStandardMaterial).clone();
      material.color.set(colour);
      material.metalness = 0;
      painted.set(key, material);
    }
    o.material = material;
  });
}
