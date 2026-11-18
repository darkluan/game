import type { MapDef, Vec2 } from '@game/core';

/** The point of the ground under a point of the screen that lies on the minimap. */
export function minimapPoint(el: Element, clientX: number, clientY: number, map: MapDef): Vec2 {
  const rect = el.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * map.halfWidth * 2 - map.halfWidth,
    z: ((clientY - rect.top) / rect.height) * map.halfDepth * 2 - map.halfDepth,
  };
}
