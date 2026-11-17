import { useLoader } from '@react-three/fiber';
import { Color, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const url = (file: string) => `${import.meta.env.BASE_URL}models/${file}`;

/** CC0 models by Kay Lousberg (KayKit); see public/models/CREDITS.md. */
export const MODELS = {
  knight: url('knight.glb'),
  minionMelee: url('skeleton_minion.glb'),
  minionRanged: url('skeleton_mage.glb'),
  towerAlly: url('building_tower_A_blue.gltf'),
  towerEnemy: url('building_tower_A_red.gltf'),
  shrineAlly: url('building_castle_blue.gltf'),
  shrineEnemy: url('building_castle_red.gltf'),
  treeA: url('tree_single_A.gltf'),
  treeB: url('tree_single_B.gltf'),
  rock: url('rock_single_C.gltf'),
} as const;

/** Loads a model once and caches it. Suspends while loading. */
export function useModel(path: string): GLTF {
  return useLoader(GLTFLoader, path);
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

/** Multiplies every material's colour by `tint`. Tinted materials are shared between clones. */
export function tintModel(root: Object3D, tint: string): void {
  const colour = new Color(tint);
  root.traverse((o) => {
    if (!(o instanceof Mesh) || Array.isArray(o.material)) return;
    const key = `${o.material.uuid}:${tint}`;
    let material = tinted.get(key);
    if (!material) {
      material = (o.material as MeshStandardMaterial).clone();
      material.color.multiply(colour);
      tinted.set(key, material);
    }
    o.material = material;
  });
}
