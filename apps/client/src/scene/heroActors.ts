import { useMemo } from 'react';
import type { Group } from 'three';
import type { ActorAction } from '@/lib/session';
import type { HeroLook } from './heroModels';
import { Hydra } from './Hydra';
import { LongDragon } from './LongDragon';
import { Mech } from './Mech';
import { Swordsman } from './Swordsman';

/** Something that stands in the scene as a hero and can be told what the hero is doing. */
export interface HeroActor {
  readonly root: Group;
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void;
}

/** One actor per look. Every hero is a body built in code: a dragon, a machine, or a figure on two legs. */
export function useHeroActors(looks: readonly HeroLook[], castShadow: boolean): HeroActor[] {
  return useMemo(
    () =>
      looks.map((look) => {
        if (look.hydra) return new Hydra(look.hydra, look.height ?? 2.6, castShadow);
        if (look.longDragon) return new LongDragon(look.longDragon, look.height ?? 2.2, castShadow);
        if (look.mech) return new Mech(look.mech, look.height ?? 2.6, castShadow);
        if (look.swordsman) return new Swordsman(look.swordsman, look.height ?? 1.9, castShadow);
        throw new Error('a hero look names no body to build');
      }),
    [looks, castShadow],
  );
}
