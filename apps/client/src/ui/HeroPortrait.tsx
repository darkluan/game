/**
 * Raised whenever the portrait pictures are remade. They keep their file names, and both the browser
 * and the game's own offline copy hold on to a picture by its address for a day or more: a new
 * number in the address is what makes the new picture show at once.
 */
const PORTRAITS_VERSION = 2;

/** A hero's portrait picture. The images are screenshots of the 3D models, one per hero id. */
export function HeroPortrait({ heroId, className = '' }: { heroId: string; className?: string }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}portraits/${heroId}.webp?v=${PORTRAITS_VERSION}`}
      alt=""
      draggable={false}
      className={`object-cover ${className}`}
    />
  );
}
