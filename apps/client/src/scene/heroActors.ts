import { useMemo } from 'react';
import type { Group } from 'three';
import type { ActorAction } from '@/lib/session';
import { Actor } from './Actor';
import type { HeroLook } from './heroModels';
import { Cube } from './Cube';
import { dressHuman } from './humanDress';
import { Hydra } from './Hydra';
import { LongDragon } from './LongDragon';
import { Mech } from './Mech';
import { useModels } from './models';
import { Swordsman } from './Swordsman';

/** Something that stands in the scene as a hero and can be told what the hero is doing. */
export interface HeroActor {
  readonly root: Group;
  update(delta: number, clock: number, state: { dead: boolean; moving: boolean; action?: ActorAction }): void;
}

/**
 * One actor per look. Most heroes are bodies built in code: a dragon, a machine, or a figure on two
 * legs. A look that names a model file is that model instead; the hook suspends while it loads.
 */
export function useHeroActors(looks: readonly HeroLook[], castShadow: boolean): HeroActor[] {
  const files = useMemo(() => [...new Set(looks.map((look) => look.model).filter(Boolean))], [looks]);
  const models = useModels(files);
  return useMemo(
    () =>
      looks.map((look) => {
        if (look.model) {
          const actor = new Actor(models[files.indexOf(look.model)], look.rig, {
            scale: look.scale,
            height: look.height,
            turn: look.turn,
            tint: look.tint,
            castShadow,
          });
          if (!look.dress) return actor;
          // Dressed before its first frame, while the model still stands as it was made.
          const turn = dressHuman(actor.root, look.dress);
          return {
            root: actor.root,
            update: (delta, clock, state) => {
              actor.update(delta, clock, state);
              turn(delta);
            },
          } satisfies HeroActor;
        }
        if (look.hydra) return new Hydra(look.hydra, look.height ?? 2.6, castShadow);
        if (look.longDragon) return new LongDragon(look.longDragon, look.height ?? 2.2, castShadow);
        if (look.cube) return new Cube(look.cube, look.height ?? 2.5, castShadow);
        if (look.mech) return new Mech(look.mech, look.height ?? 2.6, castShadow);
        if (look.swordsman) return new Swordsman(look.swordsman, look.height ?? 1.9, castShadow);
        throw new Error('a hero look names no body to build');
      }),
    [looks, castShadow, models, files],
  );
}
