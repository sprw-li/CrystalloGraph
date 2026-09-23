import type { Aff2, Vec2 } from "../symmetry/affine";
import { applyAff } from "../symmetry/affine";
import {
  cartToFrac,
  fracToCart,
  groupElements,
  type CellParams,
  type SpaceGroupId,
  type SpecialPoint,
  SPACE_GROUPS,
} from "../symmetry/groups";

export type TileInstance = {
  m: number;
  n: number;
  g: number;
  mapCart: (p: Vec2) => Vec2;
};

const elementCache = new Map<SpaceGroupId, Aff2[]>();

/** Drop cached generators (e.g. after group definition fixes). */
export function clearGroupElementCache(id?: SpaceGroupId) {
  if (id) elementCache.delete(id);
  else elementCache.clear();
}

export function getGroupElementsCached(id: SpaceGroupId): Aff2[] {
  let e = elementCache.get(id);
  if (!e) {
    e = groupElements(id);
    // Safety cap — wallpaper groups should be ≤12 point-group ops
    if (e.length > 24) e = e.slice(0, 24);
    elementCache.set(id, e);
  }
  return e;
}

clearGroupElementCache();

export function buildVisibleTiles(
  cell: CellParams,
  groupId: SpaceGroupId,
  viewMin: Vec2,
  viewMax: Vec2,
  origin: Vec2,
  opts?: { mainFrameOnly?: boolean },
): TileInstance[] {
  const elements = getGroupElementsCached(groupId);
  // Pad ≥1 cell so a stroke at one view corner can show its copy at the opposite corner
  const pad = Math.max(cell.a, cell.b) * 1.25;
  const minX = viewMin.x - origin.x - pad;
  const maxX = viewMax.x - origin.x + pad;
  const minY = viewMin.y - origin.y - pad;
  const maxY = viewMax.y - origin.y + pad;

  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: minX, y: maxY },
    { x: maxX, y: maxY },
  ].map((p) => cartToFrac(cell, p));

  const us = corners.map((c) => c.u);
  const vs = corners.map((c) => c.v);
  let u0 = Math.floor(Math.min(...us));
  let u1 = Math.ceil(Math.max(...us));
  let v0 = Math.floor(Math.min(...vs));
  let v1 = Math.ceil(Math.max(...vs));

  // Soft caps — keep a wide wallpaper domain (pg/cm/pmg… need large lattice)
  const hardCap = opts?.mainFrameOnly ? 4 : 32;
  u0 = Math.max(u0, -hardCap);
  u1 = Math.min(u1, hardCap);
  v0 = Math.max(v0, -hardCap);
  v1 = Math.min(v1, hardCap);

  // If still too many tiles (high-order groups), thin lattice before elements
  const elCount = Math.max(1, elements.length);
  const latticeCount = (u1 - u0 + 1) * (v1 - v0 + 1);
  const maxTiles = opts?.mainFrameOnly ? 400 : 12000;
  if (latticeCount * elCount > maxTiles) {
    const targetLattice = Math.max(9, Math.floor(maxTiles / elCount));
    const side = Math.max(1, Math.floor(Math.sqrt(targetLattice) / 2));
    u0 = Math.max(u0, -side);
    u1 = Math.min(u1, side);
    v0 = Math.max(v0, -side);
    v1 = Math.min(v1, side);
  }

  const tiles: TileInstance[] = [];
  for (let m = u0; m <= u1; m++) {
    for (let n = v0; n <= v1; n++) {
      elements.forEach((el, g) => {
        tiles.push({
          m,
          n,
          g,
          mapCart: (p: Vec2) => {
            const f = cartToFrac(cell, p);
            const fp = applyAff(el, { x: f.u, y: f.v });
            const c = fracToCart(cell, fp.x + m, fp.y + n);
            return { x: c.x + origin.x, y: c.y + origin.y };
          },
        });
      });
    }
  }
  return tiles;
}

export function specialPointsInView(
  cell: CellParams,
  groupId: SpaceGroupId,
  origin: Vec2,
  viewMin: Vec2,
  viewMax: Vec2,
): Array<SpecialPoint & { x: number; y: number }> {
  const base = SPACE_GROUPS[groupId].specialPoints;
  const { ax, bx } = {
    ax: fracToCart(cell, 1, 0),
    bx: fracToCart(cell, 0, 1),
  };
  const out: Array<SpecialPoint & { x: number; y: number }> = [];
  const seen = new Set<string>();
  for (let m = -5; m <= 5; m++) {
    for (let n = -5; n <= 5; n++) {
      for (const sp of base) {
        const local = fracToCart(cell, sp.u, sp.v);
        const p = {
          x: origin.x + local.x + m * ax.x + n * bx.x,
          y: origin.y + local.y + m * ax.y + n * bx.y,
        };
        if (p.x < viewMin.x - 8 || p.x > viewMax.x + 8) continue;
        if (p.y < viewMin.y - 8 || p.y > viewMax.y + 8) continue;
        const k = `${p.x.toFixed(1)},${p.y.toFixed(1)},${sp.kind}`;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push({ ...sp, x: p.x, y: p.y });
      }
    }
  }
  return out;
}

export function snapToPoints(
  screen: Vec2,
  points: Array<{ x: number; y: number }>,
  threshold: number,
): Vec2 | null {
  let best: Vec2 | null = null;
  let bestD = threshold;
  for (const p of points) {
    const d = Math.hypot(p.x - screen.x, p.y - screen.y);
    if (d < bestD) {
      bestD = d;
      best = { x: p.x, y: p.y };
    }
  }
  return best;
}

export type { Aff2 };
