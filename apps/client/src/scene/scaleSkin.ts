import {
  CanvasTexture,
  type MeshStandardMaterialParameters,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

/** How wide and tall one scale is drawn on the skin texture, in pixels. The texture holds 8 by 16 of them. */
const SCALE_W = 32;
const SCALE_H = 16;
const SKIN_SIZE = 256;

let skinMaps: { colour: Texture; bump: Texture; cracks: Texture } | null = null;

/**
 * The dragon's skin, drawn once and shared by every dragon: rows of overlapping, pointed scales.
 * Three pictures of the same scales: their shading (multiplied into the body colour), their
 * height (so light catches each scale's edge), and thin cracks around some of them, which glow.
 */
function skin(): { colour: Texture; bump: Texture; cracks: Texture } {
  if (skinMaps) return skinMaps;
  const canvases = [0, 1, 2].map(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SKIN_SIZE;
    return canvas;
  });
  const [colour, bump, cracks] = canvases.map((canvas) => canvas.getContext('2d')!);
  colour.fillStyle = '#6a6a6a';
  colour.fillRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  bump.fillStyle = '#000';
  bump.fillRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  cracks.fillStyle = '#000';
  cracks.fillRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  cracks.lineWidth = 1.6;
  cracks.strokeStyle = '#fff';
  cracks.lineCap = 'round';

  /** One scale: a shield shape, round at the top and drawn to a point at the bottom. */
  const outline = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    const w = SCALE_W * 0.56;
    const h = SCALE_H * 2.1;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w, y + h * 0.55, x, y + h);
    ctx.quadraticCurveTo(x + w, y + h * 0.55, x + w, y);
    ctx.quadraticCurveTo(x, y - h * 0.3, x - w, y);
    ctx.closePath();
  };
  // A fixed sequence, not Math.random: every dragon and every visit gets the same skin.
  let seed = 7;
  const chance = () => ((seed = (seed * 16807) % 2147483647) % 1000) / 1000;
  const rows = SKIN_SIZE / SCALE_H;
  const columns = SKIN_SIZE / SCALE_W;
  // Bottom row first, so each row overlaps the one below it. One extra row and column each way so the edges tile.
  for (let row = rows + 2; row >= -2; row--) {
    for (let column = -1; column <= columns; column++) {
      const x = column * SCALE_W + (row % 2 ? SCALE_W / 2 : 0);
      const y = row * SCALE_H;
      const lit = colour.createLinearGradient(x, y - 4, x, y + SCALE_H * 2.1);
      // Each scale is light along its ridge and dark where it tucks under its neighbours.
      lit.addColorStop(0, '#3c3c3c');
      lit.addColorStop(0.45, '#e6e6e6');
      lit.addColorStop(1, '#9a9a9a');
      outline(colour, x, y);
      colour.fillStyle = lit;
      colour.fill();
      colour.lineWidth = 1.4;
      colour.strokeStyle = '#141414';
      colour.stroke();
      // A ridge down the middle of the scale.
      colour.beginPath();
      colour.moveTo(x, y + 5);
      colour.lineTo(x, y + SCALE_H * 2.1 - 3);
      colour.lineWidth = 1;
      colour.strokeStyle = 'rgba(255,255,255,0.35)';
      colour.stroke();

      const height = bump.createLinearGradient(x, y - 4, x, y + SCALE_H * 2.1);
      height.addColorStop(0, '#202020');
      height.addColorStop(0.55, '#ffffff');
      height.addColorStop(1, '#c8c8c8');
      outline(bump, x, y);
      bump.fillStyle = height;
      bump.fill();
      bump.lineWidth = 2;
      bump.strokeStyle = '#000';
      bump.stroke();

      // Fire shows around the edge of about one scale in nine.
      const cracked = chance() < 0.11;
      outline(cracks, x, y);
      cracks.fillStyle = '#000';
      cracks.fill();
      if (cracked) cracks.stroke();
    }
  }
  const [colourMap, bumpMap, crackMap] = canvases.map((canvas) => {
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  });
  colourMap.colorSpace = SRGBColorSpace;
  crackMap.colorSpace = SRGBColorSpace;
  skinMaps = { colour: colourMap, bump: bumpMap, cracks: crackMap };
  return skinMaps;
}

/** The skin's three pictures, repeated `across` by `along` times over each part they cover. */
export function skinned(glow: string, across: number, along: number): MeshStandardMaterialParameters {
  const tile = (texture: Texture) => {
    const copy = texture.clone();
    copy.repeat.set(across, along);
    copy.needsUpdate = true;
    return copy;
  };
  const maps = skin();
  return {
    map: tile(maps.colour),
    bumpMap: tile(maps.bump),
    bumpScale: 2.2,
    emissiveMap: tile(maps.cracks),
    emissive: glow,
    emissiveIntensity: 1.4,
    roughness: 0.48,
    metalness: 0.4,
  };
}
