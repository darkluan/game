import type { MapDef } from '../data/map.js';
import { clamp } from '../math.js';
import type { Vec2 } from '../types.js';

const CELL = 1;
const SQRT2 = Math.SQRT2;

/** Walkability grid over the map with A* and straight-line smoothing. */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private readonly minX: number;
  private readonly minZ: number;
  private readonly blocked: Uint8Array;

  constructor(map: MapDef, circles: { pos: Vec2; radius: number }[], agentRadius: number) {
    this.cols = Math.round((map.halfWidth * 2) / CELL);
    this.rows = Math.round((map.halfDepth * 2) / CELL);
    this.minX = -map.halfWidth;
    this.minZ = -map.halfDepth;
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const x = this.minX + (c + 0.5) * CELL;
        const z = this.minZ + (r + 0.5) * CELL;
        const inRect = map.obstacles.some(
          (o) => Math.abs(x - o.x) <= o.w / 2 + agentRadius && Math.abs(z - o.z) <= o.d / 2 + agentRadius,
        );
        const inCircle = circles.some((b) => Math.hypot(x - b.pos.x, z - b.pos.z) <= b.radius + agentRadius);
        if (inRect || inCircle) this.blocked[r * this.cols + c] = 1;
      }
    }
  }

  private col(x: number): number {
    return Math.floor((x - this.minX) / CELL);
  }

  private row(z: number): number {
    return Math.floor((z - this.minZ) / CELL);
  }

  private cellFree(c: number, r: number): boolean {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows && this.blocked[r * this.cols + c] === 0;
  }

  private center(index: number): Vec2 {
    return {
      x: this.minX + ((index % this.cols) + 0.5) * CELL,
      z: this.minZ + (Math.floor(index / this.cols) + 0.5) * CELL,
    };
  }

  isWalkable(x: number, z: number): boolean {
    return this.cellFree(this.col(x), this.row(z));
  }

  /** True when the straight segment a-b crosses no blocked cell. */
  lineClear(a: Vec2, b: Vec2): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(d / (CELL * 0.4)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (!this.isWalkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /** The point itself when walkable, else the centre of the closest free cell. */
  nearestWalkable(p: Vec2): Vec2 {
    const x = clamp(p.x, this.minX + 0.01, -this.minX - 0.01);
    const z = clamp(p.z, this.minZ + 0.01, -this.minZ - 0.01);
    if (this.isWalkable(x, z)) return { x, z };
    const c0 = this.col(x);
    const r0 = this.row(z);
    for (let ring = 1; ring < Math.max(this.cols, this.rows); ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let r = r0 - ring; r <= r0 + ring; r++) {
        for (let c = c0 - ring; c <= c0 + ring; c++) {
          if (Math.max(Math.abs(c - c0), Math.abs(r - r0)) !== ring || !this.cellFree(c, r)) continue;
          const index = r * this.cols + c;
          const centre = this.center(index);
          const d = Math.hypot(centre.x - x, centre.z - z);
          if (d < bestD) {
            bestD = d;
            best = index;
          }
        }
      }
      if (best >= 0) return this.center(best);
    }
    return { x, z };
  }

  /** Waypoints from `from` to the walkable point nearest `to`, start excluded. Empty when unreachable. */
  findPath(from: Vec2, to: Vec2): Vec2[] {
    const start = this.nearestWalkable(from);
    const goal = this.nearestWalkable(to);
    if (this.lineClear(start, goal)) return [goal];

    const cols = this.cols;
    const startIdx = this.row(start.z) * cols + this.col(start.x);
    const goalIdx = this.row(goal.z) * cols + this.col(goal.x);
    const goalC = goalIdx % cols;
    const goalR = Math.floor(goalIdx / cols);
    const size = cols * this.rows;
    const g = new Float32Array(size).fill(Infinity);
    const parent = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const heap = new MinHeap();
    g[startIdx] = 0;
    heap.push(startIdx, 0);

    while (heap.size > 0) {
      const cur = heap.pop();
      if (cur === goalIdx) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const c = cur % cols;
      const r = Math.floor(cur / cols);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (!this.cellFree(nc, nr)) continue;
          // No cutting corners between two blocked cells.
          if (dc !== 0 && dr !== 0 && (!this.cellFree(c + dc, r) || !this.cellFree(c, r + dr))) continue;
          const next = nr * cols + nc;
          const cost = g[cur] + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
          if (cost < g[next]) {
            g[next] = cost;
            parent[next] = cur;
            const dx = Math.abs(nc - goalC);
            const dz = Math.abs(nr - goalR);
            heap.push(next, cost + Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz));
          }
        }
      }
    }
    if (parent[goalIdx] === -1) return [];

    const cells: Vec2[] = [goal];
    for (let i = parent[goalIdx]; i !== startIdx && i !== -1; i = parent[i]) cells.push(this.center(i));
    cells.reverse();

    // Drop every waypoint that can be skipped in a straight line.
    const path: Vec2[] = [];
    let anchor = start;
    let i = 0;
    while (i < cells.length) {
      let far = i;
      for (let j = cells.length - 1; j > i; j--) {
        if (this.lineClear(anchor, cells[j])) {
          far = j;
          break;
        }
      }
      path.push(cells[far]);
      anchor = cells[far];
      i = far + 1;
    }
    return path;
  }
}

class MinHeap {
  private items: number[] = [];
  private keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    const { items, keys } = this;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      items[i] = items[p];
      keys[i] = keys[p];
      i = p;
    }
    items[i] = item;
    keys[i] = key;
  }

  pop(): number {
    const { items, keys } = this;
    const top = items[0];
    const item = items.pop() as number;
    const key = keys.pop() as number;
    const n = items.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= key) break;
        items[i] = items[child];
        keys[i] = keys[child];
        i = child;
      }
      items[i] = item;
      keys[i] = key;
    }
    return top;
  }
}
