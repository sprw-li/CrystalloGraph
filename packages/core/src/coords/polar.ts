import type { Vec2 } from "../symmetry/affine";

/** Polar coords relative to main-frame origin (cartesian cell space). */
export type Polar = { r: number; phi: number };

export function cartToPolar(p: Vec2): Polar {
  return { r: Math.hypot(p.x, p.y), phi: Math.atan2(p.y, p.x) };
}

export function polarToCart(p: Polar): Vec2 {
  return { x: p.r * Math.cos(p.phi), y: p.r * Math.sin(p.phi) };
}

export function applyPolarLocks(
  p: Polar,
  lockR: boolean,
  lockPhi: boolean,
  anchor: Polar | null,
): Polar {
  if (!anchor) return p;
  return {
    r: lockR ? anchor.r : p.r,
    phi: lockPhi ? anchor.phi : p.phi,
  };
}
