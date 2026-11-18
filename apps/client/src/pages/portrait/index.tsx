import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { Box3, type Group, Vector3 } from 'three';
import { HEROES } from '@game/core';
import { useHeroActors } from '@/scene/heroActors';
import { HERO_MODELS } from '@/scene/heroModels';
import { heroColor } from '@/scene/palette';

/**
 * Development tool, not part of the game: draws one hero framed for a portrait, 256 pixels square
 * in the top-left corner. The portrait images in public/portraits are screenshots of this page.
 * The page title becomes "ready" once the picture has settled.
 */

/** How to frame each kind of body: where to look (fraction of height and of length), how far back, and from what angle. */
const FRAMING = {
  // Head and shoulders.
  person: { lookAt: 0.72, forward: 0.5, distance: 0.95, yaw: 0.35, lift: 0.1 },
  // The whole machine.
  mech: { lookAt: 0.6, forward: 0.5, distance: 1.0, yaw: 0.4, lift: 0.05 },
  // Dragons: the whole animal with its wings, from a front quarter.
  dragon: { lookAt: 0.55, forward: 0.5, distance: 0.75, yaw: 0.6, lift: 0.08 },
  // The three-headed dragon: the heads and chest, wings running out of frame.
  hydra: { lookAt: 0.62, forward: 0.85, distance: 0.42, yaw: 0.75, lift: 0.04 },
  whole: { lookAt: 0.45, forward: 0.56, distance: 0.7, yaw: 0.85, lift: 0.25 },
  // The stocky dragons spread their wings far wider than they stand at rest.
  drake: { lookAt: 0.6, forward: 0.5, distance: 1.05, yaw: 0.6, lift: 0.08 },
} as const;

function framingOf(heroId: string): (typeof FRAMING)[keyof typeof FRAMING] {
  const race = HEROES[heroId]?.race;
  if (HERO_MODELS[heroId]?.hydra || HERO_MODELS[heroId]?.longDragon) return FRAMING.hydra;
  // The wind spirit is all hat: show the whole of it, like the mechs.
  return race === 'machine' ? FRAMING.mech : FRAMING.person;
}

function Subject({ heroId }: { heroId: string }) {
  const look = HERO_MODELS[heroId] ?? HERO_MODELS.kael;
  const holder = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const looks = useMemo(() => [look], [look]);
  const [actor] = useHeroActors(looks, false);
  const frames = useRef(0);

  useEffect(() => {
    const parent = holder.current;
    parent?.add(actor.root);
    return () => void parent?.remove(actor.root);
  }, [actor]);

  useFrame((_, delta) => {
    // Hold the idle pose a moment in, so every portrait is taken at the same point of the animation.
    if (frames.current < 20) actor.update(delta, 0, { dead: false, moving: false });
    frames.current++;
    if (frames.current !== 20) return;
    const box = new Box3().setFromObject(actor.root);
    const size = box.getSize(new Vector3());
    // ?view=whole shows the entire body from farther back, for checking a model rather than making a portrait.
    const whole = new URLSearchParams(window.location.search).get('view') === 'whole';
    const framing = whole ? FRAMING.whole : framingOf(heroId);
    const span = HEROES[heroId]?.race === 'dragon' ? Math.max(size.x, size.y, size.z) : size.y;
    const target = new Vector3(
      (box.min.x + box.max.x) / 2,
      box.min.y + size.y * framing.lookAt,
      box.min.z + size.z * framing.forward,
    );
    // ?far=1.5 steps the camera back, for a body whose staff or cloak runs out of the frame.
    const far = Number(new URLSearchParams(window.location.search).get('far') ?? 1) || 1;
    const distance = span * framing.distance * 2.2 * far;
    camera.position.set(
      target.x + Math.sin(framing.yaw) * distance,
      target.y + span * framing.lift,
      target.z + Math.cos(framing.yaw) * distance,
    );
    camera.lookAt(target);
    document.title = 'ready';
  });

  return <group ref={holder} />;
}

export default function PortraitPage() {
  const heroId = useParams().heroId ?? 'kael';
  const color = heroColor(heroId);
  return (
    <div
      className="size-64"
      style={{ background: `radial-gradient(circle at 50% 38%, ${color}66 0%, #101822 62%, #0b1016 100%)` }}
    >
      <Canvas camera={{ fov: 28, near: 0.1, far: 100 }} dpr={1} gl={{ alpha: true, antialias: true }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[3, 6, 5]} intensity={2.4} />
        <directionalLight position={[-4, 2, -3]} intensity={0.8} color={color} />
        <Suspense fallback={null}>
          <Subject key={heroId} heroId={heroId} />
        </Suspense>
      </Canvas>
    </div>
  );
}
