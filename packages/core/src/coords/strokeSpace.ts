import type { CellParams } from "../symmetry/groups";
import { cartToFrac, fracToCart } from "../symmetry/groups";
import type { FracPoint, VectorStroke } from "../document/types";
import { cartToPolar, type Polar } from "../coords/polar";

export function cartRelToFrac(
  cell: CellParams,
  cart: { x: number; y: number },
  pressure?: number,
): FracPoint {
  const f = cartToFrac(cell, cart);
  return { u: f.u, v: f.v, pressure };
}

export function fracToCartRel(cell: CellParams, p: FracPoint): { x: number; y: number } {
  return fracToCart(cell, p.u, p.v);
}

export function strokeToCart(
  cell: CellParams,
  stroke: VectorStroke,
): { x: number; y: number }[] {
  return stroke.points.map((p) => fracToCartRel(cell, p));
}

export function fracToPolar(cell: CellParams, p: FracPoint): Polar {
  return cartToPolar(fracToCartRel(cell, p));
}

/** Reflect frac point across v-axis through origin in cartesian, expressed back in frac. */
export function mirrorFracVertical(cell: CellParams, p: FracPoint): FracPoint {
  const c = fracToCartRel(cell, p);
  const mirrored = { x: -c.x, y: c.y };
  return cartRelToFrac(cell, mirrored, p.pressure);
}

export function rotateFrac(
  cell: CellParams,
  p: FracPoint,
  angleRad: number,
): FracPoint {
  const c = fracToCartRel(cell, p);
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const rotated = { x: c.x * cos - c.y * sin, y: c.x * sin + c.y * cos };
  return cartRelToFrac(cell, rotated, p.pressure);
}

export function translateFrac(points: FracPoint[], du: number, dv: number): FracPoint[] {
  return points.map((p) => ({ ...p, u: p.u + du, v: p.v + dv }));
}
