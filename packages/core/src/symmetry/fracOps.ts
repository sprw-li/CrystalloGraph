import type { Aff2 } from "./affine";
import { composeAff, translateAff } from "./affine";

/** Fractional-space generators (correct for our latticeVectors convention). */

export const F = {
  id: { m: [1, 0, 0, 1], t: { x: 0, y: 0 } } as Aff2,
  /** 180° — works for all lattices */
  rot2: { m: [-1, 0, 0, -1], t: { x: 0, y: 0 } } as Aff2,
  /** 90° square: (u,v)→(-v,u) */
  rot4: { m: [0, -1, 1, 0], t: { x: 0, y: 0 } } as Aff2,
  /** 120° hexagonal: (u,v)→(-v, u-v) */
  rot3: { m: [0, -1, 1, -1], t: { x: 0, y: 0 } } as Aff2,
  /** 60° hexagonal: (u,v)→(u-v, u) */
  rot6: { m: [1, -1, 1, 0], t: { x: 0, y: 0 } } as Aff2,
  /** mirror across a-axis (v=0): (u,v)→(u,-v) — rectangular/square */
  mx: { m: [1, 0, 0, -1], t: { x: 0, y: 0 } } as Aff2,
  /** mirror across b-axis direction through origin in rect: (u,v)→(-u,v) */
  my: { m: [-1, 0, 0, 1], t: { x: 0, y: 0 } } as Aff2,
  /** hexagonal mirror across a-axis in cart (y→−y at θ=120): (u,v)→(u−v, −v) */
  hexMa: { m: [1, -1, 0, -1], t: { x: 0, y: 0 } } as Aff2,
  /** hexagonal mirror across a-altitude (x→−x at θ=120): (u,v)→(−u+v, v) — used by p31m */
  hexMb: { m: [-1, 1, 0, 1], t: { x: 0, y: 0 } } as Aff2,
  /** diagonal mirror square: (u,v)→(v,u) */
  md: { m: [0, 1, 1, 0], t: { x: 0, y: 0 } } as Aff2,
};

export function glideFrac(mirror: Aff2, tx: number, ty: number): Aff2 {
  return composeAff(translateAff(tx, ty), mirror);
}
