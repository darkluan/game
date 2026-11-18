import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useParams } from 'react-router';
import { Box3, type Group, Vector3 } from 'three';
import { HEROES } from '@game/core';
import { Actor } from '@/scene/Actor';
import { actorOptions, HERO_MODELS } from '@/scene/heroModels';
import { useModel } from '@/scene/models';
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
  // Long animals: the head and chest, from a front quarter. The head is at the +z end of the body.
  dinosaur: { lookAt: 0.68, forward: 0.78, distance: 0.34, yaw: 0.75, lift: 0.04 },
} as const;

function framingOf(heroId: string): (typeof FRAMING)[keyof typeof FRAMING] {
  const race = HEROES[heroId]?.race;
  return race === 'dragon' ? FRAMING.dinosaur : race === 'machine' ? FRAMING.mech : FRAMING.person;
}

function Subject({ heroId }: { heroId: string }) {
  const look = HERO_MODELS[heroId] ?? HERO_MODELS.kael;
  const gltf = useModel(look.model);
  const holder = useRef<Group>(null);
  const camera = useThree((s) => s.camera);
  const actor = useMemo(() => new Actor(gltf, look.rig, actorOptions(look, false)), [gltf, look]);
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
    const framing = framingOf(heroId);
    const span = heroId && HEROES[heroId]?.race === 'dragon' ? Math.max(size.x, size.z) : size.y;
    const target = new Vector3(
      (box.min.x + box.max.x) / 2,
      box.min.y + size.y * framing.lookAt,
      box.min.z + size.z * framing.forward,
    );
    const distance = span * framing.distance * 2.2;
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
