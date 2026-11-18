/** A hero's portrait picture. The images are screenshots of the 3D models, one per hero id. */
export function HeroPortrait({ heroId, className = '' }: { heroId: string; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}portraits/${heroId}.webp`}
      alt=""
      draggable={false}
      className={`object-cover ${className}`}
    />
  );
}
