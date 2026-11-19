import { useLoader } from '@react-three/fiber';
import { Color, Mesh, type MeshStandardMaterial, type Object3D } from 'three';
import { type GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const url = (file: string) => `${import.meta.env.BASE_URL}models/${file}`;

/** CC0 models by Kay Lousberg (KayKit) and Quaternius; see public/models/CREDITS.md. The lane soldiers and the four Humans have model files: everything else is built in code. */
export const MODELS = {
  minionMelee: url('skeleton_minion.glb'),
  minionRanged: url('skeleton_mage.glb'),
  humanWarrior: url('human_warrior.glb'),
  humanRanger: url('human_ranger.glb'),
  humanWizard: url('human_wizard.glb'),
  humanCleric: url('human_cleric.glb'),
} as const;

/** Loads several models with one hook call; none at all is fine. Suspends until all are in. */
export function useModels(paths: string[]): GLTF[] {
  return useLoader(GLTFLoader, paths);
}

/** Loads a model once and caches it. Suspends while loading. */
export function useModel(path: string): GLTF {
  return useLoader(GLTFLoader, path);
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
