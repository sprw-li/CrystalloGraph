import type { DocumentModel, FracPoint, VectorStroke } from "../document/types";
import { uid } from "../document/types";
import {
  cartToFrac,
  fracToCart,
  type CellParams,
  type SpaceGroupId,
} from "../symmetry/groups";
import { applyAff, invertAff, type Aff2 } from "../symmetry/affine";
import { getGroupElementsCached } from "../symmetry/tiling";
import { fracToCartRel, cartRelToFrac } from "../coords/strokeSpace";

type Cart = { x: number; y: number };

function half(size: number) {
  return Math.max(1, size) / 2;
}

function pointInSquare(p: Cart, tip: Cart, h: number): boolean {
  return Math.abs(p.x - tip.x) <= h && Math.abs(p.y - tip.y) <= h;
}

function distToSquare(p: Cart, tip: Cart, h: number): number {
  const dx = Math.max(Math.abs(p.x - tip.x) - h, 0);
  const dy = Math.max(Math.abs(p.y - tip.y) - h, 0);
  return Math.hypot(dx, dy);
}

function distPointToSegment(p: Cart, a: Cart, b: Cart): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

/** Fast stroke hit: distance from tip to geometry (no square). */
function strokeHitDistance(cell: CellParams, stroke: VectorStroke, tip: Cart): number {
  const pts = stroke.points;
  if (!pts.length) return Infinity;
  if (stroke.kind === "rect" && pts.length >= 2) {
    const a = fracToCartRel(cell, pts[0]);
    const b = fracToCartRel(cell, pts[1]);
    const x0 = Math.min(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const corners = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ];
    let best = Infinity;
    for (let i = 0; i < 4; i++) best = Math.min(best, distPointToSegment(tip, corners[i], corners[i + 1]));
    return best;
  }
  if (stroke.kind === "ellipse" && pts.length >= 2) {
    const a = fracToCartRel(cell, pts[0]);
    const b = fracToCartRel(cell, pts[1]);
    const cx = (a.x + b.x) / 2;
    const cy = (a.y + b.y) / 2;
    const rx = Math.max(Math.abs(b.x - a.x) / 2, 0.1);
    const ry = Math.max(Math.abs(b.y - a.y) / 2, 0.1);
    return Math.abs(Math.hypot((tip.x - cx) / rx, (tip.y - cy) / ry) - 1) * Math.min(rx, ry);
  }
  let best = Infinity;
  let prev = fracToCartRel(cell, pts[0]);
  best = Math.min(best, Math.hypot(prev.x - tip.x, prev.y - tip.y));
  for (let i = 1; i < pts.length; i++) {
    const cur = fracToCartRel(cell, pts[i]);
    best = Math.min(best, distPointToSegment(tip, prev, cur));
    prev = cur;
    if (best === 0) return 0;
  }
  return best;
}

function segmentHitsSquare(a: Cart, b: Cart, tip: Cart, h: number): boolean {
  if (pointInSquare(a, tip, h) || pointInSquare(b, tip, h)) return true;
  const xmin = tip.x - h;
  const xmax = tip.x + h;
  const ymin = tip.y - h;
  const ymax = tip.y + h;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, a.x - xmin)) return false;
  if (!clip(dx, xmax - a.x)) return false;
  if (!clip(-dy, a.y - ymin)) return false;
  if (!clip(dy, ymax - a.y)) return false;
  return t0 <= t1;
}

function erasedIntervalsInSquare(
  a: Cart,
  b: Cart,
  tip: Cart,
  h: number,
): { t0: number; t1: number }[] {
  const xmin = tip.x - h;
  const xmax = tip.x + h;
  const ymin = tip.y - h;
  const ymax = tip.y + h;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p: number, q: number) => {
    if (Math.abs(p) < 1e-12) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > t1) return false;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return false;
      if (r < t1) t1 = r;
    }
    return true;
  };
  if (!clip(-dx, a.x - xmin)) return [];
  if (!clip(dx, xmax - a.x)) return [];
  if (!clip(-dy, a.y - ymin)) return [];
  if (!clip(dy, ymax - a.y)) return [];
  if (t0 > t1) return [];
  return [{ t0, t1 }];
}

function mergeIntervals(iv: { t0: number; t1: number }[]) {
  if (!iv.length) return [];
  const s = [...iv].sort((a, b) => a.t0 - b.t0);
  const m = [{ ...s[0] }];
  for (let i = 1; i < s.length; i++) {
    const last = m[m.length - 1];
    if (s[i].t0 <= last.t1 + 1e-9) last.t1 = Math.max(last.t1, s[i].t1);
    else m.push({ ...s[i] });
  }
  return m;
}

function keepRanges(erased: { t0: number; t1: number }[]): { t0: number; t1: number }[] {
  const m = mergeIntervals(erased);
  if (!m.length) return [{ t0: 0, t1: 1 }];
  const keep: { t0: number; t1: number }[] = [];
  let cur = 0;
  for (const e of m) {
    if (e.t0 > cur + 1e-6) keep.push({ t0: cur, t1: e.t0 });
    cur = Math.max(cur, e.t1);
  }
  if (cur < 1 - 1e-6) keep.push({ t0: cur, t1: 1 });
  return keep;
}

/** Cached group inverses (identity lattice only) — used by whole-stroke erase. */
const invCache = new Map<SpaceGroupId, Aff2[]>();

function groupInverses(groupId: SpaceGroupId): Aff2[] {
  let list = invCache.get(groupId);
  if (!list) {
    list = getGroupElementsCached(groupId).map((el) => invertAff(el));
    invCache.set(groupId, list);
  }
  return list;
}

function masterFromTip(cell: CellParams, tip: Cart, inv: Aff2): Cart {
  const f = cartToFrac(cell, tip);
  const fm = applyAff(inv, { x: f.u, y: f.v });
  return fracToCart(cell, fm.x, fm.y);
}

/**
 * Local lattice neighbors around tip only (±1), not global ±3 grid.
 * This is the main perf fix for erase-whole-stroke.
 */
function localMasterTips(cell: CellParams, tip: Cart, groupId: SpaceGroupId): Cart[] {
  const f = cartToFrac(cell, tip);
  const u0 = Math.floor(f.u);
  const v0 = Math.floor(f.v);
  const invs = groupInverses(groupId);
  const out: Cart[] = [];
  for (let m = u0 - 1; m <= u0 + 1; m++) {
    for (let n = v0 - 1; n <= v0 + 1; n++) {
      for (const inv of invs) {
        // tip in cell (m,n) mapped back: first subtract lattice, then inverse group
        const local = { x: tip.x, y: tip.y };
        // Apply inv of (T(m,n) ∘ g) = g^{-1} ∘ T(-m,-n)
        // Equivalent: frac tip → subtract (m,n) → apply inv
        const ff = cartToFrac(cell, local);
        const shifted = { x: ff.u - m, y: ff.v - n };
        const fm = applyAff(inv, shifted);
        out.push(fracToCart(cell, fm.x, fm.y));
      }
    }
  }
  if (!out.length) out.push(tip);
  return out;
}

function brushSamples(tip: Cart, prev: Cart | null, size: number): Cart[] {
  const out: Cart[] = [tip];
  if (!prev) return out;
  const dist = Math.hypot(tip.x - prev.x, tip.y - prev.y);
  const step = Math.max(size * 0.45, 2);
  const n = Math.min(8, Math.ceil(dist / step)); // hard cap samples
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    out.push({
      x: prev.x + (tip.x - prev.x) * t,
      y: prev.y + (tip.y - prev.y) * t,
    });
  }
  return out;
}

function lerpFrac(a: FracPoint, b: FracPoint, t: number): FracPoint {
  return {
    u: a.u + (b.u - a.u) * t,
    v: a.v + (b.v - a.v) * t,
    pressure:
      a.pressure != null && b.pressure != null
        ? a.pressure + (b.pressure - a.pressure) * t
        : a.pressure ?? b.pressure,
  };
}

function erasePathWithSquares(
  stroke: VectorStroke,
  cell: CellParams,
  tips: Cart[],
  h: number,
): VectorStroke[] {
  const pts = stroke.points;
  if (!pts.length) return [];
  if (pts.length === 1) {
    const c = fracToCartRel(cell, pts[0]);
    return tips.some((tip) => pointInSquare(c, tip, h)) ? [] : [stroke];
  }

  const pieces: FracPoint[][] = [];
  let buf: FracPoint[] = [];
  const pushPt = (p: FracPoint) => {
    const last = buf[buf.length - 1];
    if (last && Math.abs(last.u - p.u) < 1e-10 && Math.abs(last.v - p.v) < 1e-10) return;
    buf.push(p);
  };
  const flush = () => {
    if (buf.length >= 1) pieces.push(buf);
    buf = [];
  };

  pushPt(pts[0]);
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const ca = fracToCartRel(cell, a);
    const cb = fracToCartRel(cell, b);
    const erased: { t0: number; t1: number }[] = [];
    for (const tip of tips) erased.push(...erasedIntervalsInSquare(ca, cb, tip, h));
    const keeps = keepRanges(erased);
    if (!keeps.length) {
      flush();
      continue;
    }
    if (keeps[0].t0 > 1e-6) flush();
    for (let k = 0; k < keeps.length; k++) {
      const r = keeps[k];
      if (k > 0) flush();
      if (r.t0 > 1e-6) pushPt(lerpFrac(a, b, r.t0));
      else if (!buf.length) pushPt(a);
      if (r.t1 < 1 - 1e-6) {
        pushPt(lerpFrac(a, b, r.t1));
        flush();
      } else pushPt(b);
    }
  }
  flush();

  return pieces.map((points) => ({
    id: uid(),
    kind: "path" as const,
    points,
    style: { ...stroke.style },
  }));
}

/**
 * Whole-stroke erase — O(strokes × local tiles × elements), not O(strokes × 7² × G).
 */
export function eraseWholeStrokeAt(
  doc: DocumentModel,
  cell: CellParams,
  tipCart: Cart,
  size: number,
  groupId: SpaceGroupId,
): boolean {
  const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (!layer || layer.locked) return false;
  const threshold = Math.max(size * 0.55, 4);
  const masters = localMasterTips(cell, tipCart, groupId);

  let bestIdx = -1;
  let bestD = threshold;

  for (let i = 0; i < layer.strokes.length; i++) {
    const stroke = layer.strokes[i];
    for (const tip of masters) {
      const d = strokeHitDistance(cell, stroke, tip);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
        if (d < 0.5) break;
      }
    }
    if (bestD < 0.5) break;
  }
  if (bestIdx < 0) return false;
  layer.strokes = layer.strokes.filter((_, i) => i !== bestIdx);
  return true;
}

export function eraseNearTip(
  doc: DocumentModel,
  cell: CellParams,
  tipCart: Cart,
  prevCart: Cart | null,
  size: number,
  groupId: SpaceGroupId,
): boolean {
  const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
  if (!layer || layer.locked) return false;

  const h = half(size);
  // Local masters only (±1 lattice), then densify brush along prev→tip
  const baseTips = localMasterTips(cell, tipCart, groupId);
  const prevMasters = prevCart ? localMasterTips(cell, prevCart, groupId) : null;
  const tips: Cart[] = [];
  for (let i = 0; i < baseTips.length; i++) {
    const tip = baseTips[i];
    const prev = prevMasters ? prevMasters[i] ?? null : null;
    for (const s of brushSamples(tip, prev, size)) tips.push(s);
  }

  const next: VectorStroke[] = [];
  let changed = false;

  for (const stroke of layer.strokes) {
    if (stroke.kind !== "path") {
      let hit = false;
      for (const tip of tips) {
        if (strokeHitDistance(cell, stroke, tip) <= h) {
          hit = true;
          break;
        }
        // also square coverage for shapes
        const pts = stroke.points.map((p) => fracToCartRel(cell, p));
        for (let i = 0; i < pts.length - 1; i++) {
          if (segmentHitsSquare(pts[i], pts[i + 1], tip, h)) {
            hit = true;
            break;
          }
        }
        if (hit) break;
      }
      if (hit) {
        changed = true;
        continue;
      }
      next.push(stroke);
      continue;
    }

    const parts = erasePathWithSquares(stroke, cell, tips, h);
    if (
      parts.length === 1 &&
      parts[0].points.length === stroke.points.length &&
      parts[0].points.every(
        (p, i) =>
          Math.abs(p.u - stroke.points[i].u) < 1e-10 &&
          Math.abs(p.v - stroke.points[i].v) < 1e-10,
      )
    ) {
      next.push(stroke);
      continue;
    }
    changed = true;
    next.push(...parts);
  }

  if (changed) layer.strokes = next;
  return changed;
}

export function cartTipToFrac(cell: CellParams, tip: Cart): FracPoint {
  return cartRelToFrac(cell, tip);
}

export function clearEraserCaches() {
  invCache.clear();
}
