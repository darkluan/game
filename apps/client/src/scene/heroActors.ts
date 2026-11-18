import { useMemo } from 'react';
import type { Group } from 'three';
import type { ActorAction } from '@/lib/session';
import { Actor } from './Actor';
import { actorOptions, type HeroLook } from './heroModels';
import { Hydra } from './Hydra';
import { Swordsman } from './Swordsman';
import { useModels } from './models';

/** Something that stands in the scene as a hero and can be told what the hero is doing. */
export interface HeroActor {
  readonly root: Group;
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void;
}

/**
 * One actor per look: an animated model for most heroes, a body built in code for those that have
 * no model file. Suspends while model files load.
 */
export function useHeroActors(looks: readonly HeroLook[], castShadow: boolean): HeroActor[] {
  const files = useMemo(() => looks.filter((look) => look.model !== '').map((look) => look.model), [looks]);
  const gltfs = useModels(files);
  return useMemo(() => {
    let next = 0;
    return looks.map((look) =>
      look.hydra
        ? new Hydra(look.hydra, look.height ?? 2.6, castShadow)
        : look.swordsman
          ? new Swordsman(look.swordsman, look.height ?? 1.9, castShadow)
          : new Actor(gltfs[next++], look.rig, actorOptions(look, castShadow)),
    );
  }, [gltfs, looks, castShadow]);
}
