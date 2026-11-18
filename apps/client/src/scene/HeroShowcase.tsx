import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import type { ActorAction } from '@/lib/session';
import { useShowcaseStore } from '@/store/showcaseStore';
import { useHeroActors } from './heroActors';
import { HERO_MODELS } from './heroModels';
import { heroColor } from './palette';

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];
/** Seconds the hero rests between moves. */
const PAUSE = 2.2;
const ORDER = ['R', 'attack', 'Q', 'E'] as const;
const ENTRANCE_SECONDS = 0.45;
const PULSE_SECONDS = 0.9;

/**
 * The hero being picked, standing on a ring in its race colour. It arrives with its ultimate, then
 * keeps showing off its other moves, and performs any move asked for through the showcase store.
 * Drawn at game size: scale the parent. `pulseReach` is how far the arrival ring spreads. Give it a `key` per hero so each pick starts fresh.
 */
export function HeroShowcase({ heroId, pulseReach = 3.5 }: { heroId: string; pulseReach?: number }) {
  const look = HERO_MODELS[heroId] ?? HERO_MODELS.kael;
  const color = heroColor(heroId);
  const body = useRef<Group>(null);
  const pulse = useRef<Mesh>(null);
  const looks = useMemo(() => [look], [look]);
  const [actor] = useHeroActors(looks, false);
  const moves = useMemo(() => ORDER.filter((kind) => look.rig.actions[kind]), [look]);
  const show = useRef({ clock: 0, step: 0, nextAt: 0, seen: -1, action: undefined as ActorAction | undefined });

  // A newly picked hero starts facing forward, whatever way the last one was turned.
  useEffect(() => useShowcaseStore.getState().resetTurn(), []);

  useEffect(() => {
    const parent = body.current;
    actor.root.scale.setScalar(look.showcaseScale ?? 1);
    parent?.add(actor.root);
    return () => void parent?.remove(actor.root);
  }, [actor, look]);

  useFrame((_, delta) => {
    const state = show.current;
    state.clock += delta;
    const perform = (kind: ActorAction['kind']) => {
      const move = look.rig.actions[kind];
      if (!move) return;
      state.action = { kind, at: state.clock };
      state.nextAt = state.clock + move.seconds + PAUSE;
    };
    const { request, turn } = useShowcaseStore.getState();
    // Follows the player's drag, easing so it does not snap.
    if (body.current) body.current.rotation.y += (turn - body.current.rotation.y) * Math.min(1, delta * 12);
    // Requests made before this hero appeared were for another hero.
    if (state.seen < 0) state.seen = request.n;
    if (request.n !== state.seen) {
      state.seen = request.n;
      perform(request.kind);
    } else if (moves.length > 0 && state.clock >= state.nextAt) {
      perform(moves[state.step++ % moves.length]);
    }
    actor.update(delta, state.clock, { dead: false, moving: false, action: state.action });

    // Pop in: overshoot a little, then settle.
    const t = Math.min(1, state.clock / ENTRANCE_SECONDS);
    body.current?.scale.setScalar(1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2);
    const ring = pulse.current;
    if (ring) {
      const p = Math.min(1, state.clock / PULSE_SECONDS);
      ring.scale.setScalar(1 + p * pulseReach);
      (ring.material as MeshBasicMaterial).opacity = 1 - p;
      ring.visible = p < 1;
    }
  });

  return (
    <group>
      <group ref={body} scale={0} />
      <mesh rotation={FLAT} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.85, 0.93, 64]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh rotation={FLAT} position={[0, 0.015, 0]}>
        <circleGeometry args={[0.85, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.12} depthWrite={false} />
      </mesh>
      <mesh ref={pulse} rotation={FLAT} position={[0, 0.025, 0]}>
        <ringGeometry args={[0.85, 0.97, 64]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
