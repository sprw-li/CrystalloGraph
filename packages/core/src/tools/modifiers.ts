import type { FracPoint } from "../document/types";
import type { CellParams } from "../symmetry/groups";
import { cartRelToFrac, fracToCartRel } from "../coords/strokeSpace";

type Cart = { x: number; y: number };

/** Reflect point P across infinite line AB in Cartesian space. */
export function reflectCartAcrossLine(P: Cart, A: Cart, B: Cart): Cart {
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) {
    // Degenerate: point reflection through A
    return { x: 2 * A.x - P.x, y: 2 * A.y - P.y };
  }
  const t = ((P.x - A.x) * dx + (P.y - A.y) * dy) / len2;
  const projX = A.x + t * dx;
  const projY = A.y + t * dy;
  return { x: 2 * projX - P.x, y: 2 * projY - P.y };
}

export function reflectAcrossLine(
  cell: CellParams,
  p: FracPoint,
  a: FracPoint,
  b: FracPoint,
): FracPoint {
  const P = fracToCartRel(cell, p);
  const A = fracToCartRel(cell, a);
  const B = fracToCartRel(cell, b);
  const R = reflectCartAcrossLine(P, A, B);
  return cartRelToFrac(cell, R, p.pressure);
}

/** Expand stroke point sets by mirror XOR mandala. */
export function applyModifiers(
  cell: CellParams,
  points: FracPoint[],
  mirrorOn: boolean,
  mirrorA: FracPoint,
  mirrorB: FracPoint,
  mandalaOn: boolean,
  mandalaCenter: FracPoint,
  mandalaN: number,
): FracPoint[][] {
  if (mirrorOn) {
    const A = fracToCartRel(cell, mirrorA);
    const B = fracToCartRel(cell, mirrorB);
    // Reflect in cart then convert once — avoids per-point basis drift
    const mirrored = points.map((p) => {
      const P = fracToCartRel(cell, p);
      const R = reflectCartAcrossLine(P, A, B);
      return cartRelToFrac(cell, R, p.pressure);
    });
    // Reverse mirrored polyline so stroke direction stays continuous at the seam
    return [points, mirrored.slice().reverse()];
  }
  if (mandalaOn) {
    const C = fracToCartRel(cell, mandalaCenter);
    const next: FracPoint[][] = [];
    for (let i = 0; i < mandalaN; i++) {
      const ang = (i * 2 * Math.PI) / mandalaN;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      next.push(
        points.map((p) => {
          const P = fracToCartRel(cell, p);
          const dx = P.x - C.x;
          const dy = P.y - C.y;
          return cartRelToFrac(
            cell,
            { x: C.x + dx * cos - dy * sin, y: C.y + dx * sin + dy * cos },
            p.pressure,
          );
        }),
      );
    }
    return next;
  }
  return [points];
}

/** Cart-space mirror of a polyline (for live preview without frac roundtrip). */
export function mirrorPolylineCart(
  pts: Cart[],
  A: Cart,
  B: Cart,
): Cart[] {
  return pts.map((p) => reflectCartAcrossLine(p, A, B)).reverse();
}
