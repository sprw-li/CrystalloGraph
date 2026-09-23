import type { DocumentModel, VectorStroke } from "../document/types";
import type { CellParams } from "../symmetry/groups";
import { cartToFrac } from "../symmetry/groups";
import { fracToCartRel } from "../coords/strokeSpace";
import type { TileInstance } from "../symmetry/tiling";

function pointInPoly(
  p: { x: number; y: number },
  poly: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function strokeCartPoints(cell: CellParams, stroke: VectorStroke) {
  return stroke.points.map((p) => fracToCartRel(cell, p));
}

/** Hit-test including symmetry copies; returns master stroke id. */
export function hitTestStrokeId(
  doc: DocumentModel,
  cell: CellParams,
  tiles: TileInstance[],
  origin: { x: number; y: number },
  screen: { x: number; y: number },
  threshold: number,
): string | null {
  const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (!layer) return null;
  let bestId: string | null = null;
  let bestD = threshold;

  const identity = {
    m: 0,
    n: 0,
    g: 0,
    mapCart: (p: { x: number; y: number }) => ({
      x: p.x + origin.x,
      y: p.y + origin.y,
    }),
  };

  const allTiles = [identity, ...tiles.filter((t) => !(t.m === 0 && t.n === 0 && t.g === 0))];

  for (const stroke of layer.strokes) {
    const local = strokeCartPoints(cell, stroke);
    for (const tile of allTiles) {
      const mapped = local.map(tile.mapCart);
      for (const p of mapped) {
        const d = Math.hypot(p.x - screen.x, p.y - screen.y);
        if (d < bestD) {
          bestD = d;
          bestId = stroke.id;
        }
      }
      for (let i = 0; i < mapped.length - 1; i++) {
        const a = mapped[i];
        const b = mapped[i + 1];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const len2 = abx * abx + aby * aby;
        let t = len2 < 1e-9 ? 0 : ((screen.x - a.x) * abx + (screen.y - a.y) * aby) / len2;
        t = Math.max(0, Math.min(1, t));
        const d = Math.hypot(screen.x - (a.x + t * abx), screen.y - (a.y + t * aby));
        if (d < bestD) {
          bestD = d;
          bestId = stroke.id;
        }
      }
    }
  }
  return bestId;
}

export function strokesInScreenRect(
  doc: DocumentModel,
  cell: CellParams,
  origin: { x: number; y: number },
  rect: { x0: number; y0: number; x1: number; y1: number },
): string[] {
  const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (!layer) return [];
  const minX = Math.min(rect.x0, rect.x1);
  const maxX = Math.max(rect.x0, rect.x1);
  const minY = Math.min(rect.y0, rect.y1);
  const maxY = Math.max(rect.y0, rect.y1);
  const ids: string[] = [];
  for (const stroke of layer.strokes) {
    const pts = strokeCartPoints(cell, stroke).map((p) => ({
      x: p.x + origin.x,
      y: p.y + origin.y,
    }));
    if (pts.some((p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY)) {
      ids.push(stroke.id);
    }
  }
  return ids;
}

export function strokesInLasso(
  doc: DocumentModel,
  cell: CellParams,
  origin: { x: number; y: number },
  lassoScreen: { x: number; y: number }[],
): string[] {
  if (lassoScreen.length < 3) return [];
  const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (!layer) return [];
  const ids: string[] = [];
  for (const stroke of layer.strokes) {
    const pts = strokeCartPoints(cell, stroke).map((p) => ({
      x: p.x + origin.x,
      y: p.y + origin.y,
    }));
    if (pts.some((p) => pointInPoly(p, lassoScreen))) ids.push(stroke.id);
  }
  return ids;
}

export function moveSelectedStrokes(
  doc: DocumentModel,
  cell: CellParams,
  ids: Set<string>,
  dCart: { x: number; y: number },
) {
  const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (!layer || layer.locked) return;
  // Convert cartesian delta to approx frac delta at origin
  const f0 = cartToFrac(cell, { x: 0, y: 0 });
  const f1 = cartToFrac(cell, dCart);
  const du = f1.u - f0.u;
  const dv = f1.v - f0.v;
  for (const stroke of layer.strokes) {
    if (!ids.has(stroke.id)) continue;
    stroke.points = stroke.points.map((p) => ({
      ...p,
      u: p.u + du,
      v: p.v + dv,
    }));
  }
}
