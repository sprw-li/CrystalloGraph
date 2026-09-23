/** Affine transform: x' = A x + t */
export type Mat2 = [number, number, number, number];
export type Vec2 = { x: number; y: number };

export type Aff2 = {
  m: Mat2;
  t: Vec2;
};

export function applyAff(a: Aff2, p: Vec2): Vec2 {
  const [a11, a12, a21, a22] = a.m;
  return {
    x: a11 * p.x + a12 * p.y + a.t.x,
    y: a21 * p.x + a22 * p.y + a.t.y,
  };
}

export function composeAff(a: Aff2, b: Aff2): Aff2 {
  const [a11, a12, a21, a22] = a.m;
  const [b11, b12, b21, b22] = b.m;
  return {
    m: [
      a11 * b11 + a12 * b21,
      a11 * b12 + a12 * b22,
      a21 * b11 + a22 * b21,
      a21 * b12 + a22 * b22,
    ],
    t: applyAff(a, b.t),
  };
}

export function invertAff(a: Aff2): Aff2 {
  const [a11, a12, a21, a22] = a.m;
  const det = a11 * a22 - a12 * a21;
  if (Math.abs(det) < 1e-12) return identityAff;
  const m: Mat2 = [a22 / det, -a12 / det, -a21 / det, a11 / det];
  const inv = { m, t: { x: 0, y: 0 } };
  const t = applyAff(inv, { x: -a.t.x, y: -a.t.y });
  return { m, t };
}

export const identityAff: Aff2 = { m: [1, 0, 0, 1], t: { x: 0, y: 0 } };

export function rotationAff(deg: number, center: Vec2 = { x: 0, y: 0 }): Aff2 {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const m: Mat2 = [c, -s, s, c];
  return {
    m,
    t: {
      x: center.x - (c * center.x - s * center.y),
      y: center.y - (s * center.x + c * center.y),
    },
  };
}

export function mirrorAff(axisDeg: number, center: Vec2 = { x: 0, y: 0 }): Aff2 {
  const r = (axisDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const m: Mat2 = [c * c - s * s, 2 * c * s, 2 * c * s, s * s - c * c];
  return {
    m,
    t: {
      x: center.x - (m[0] * center.x + m[1] * center.y),
      y: center.y - (m[2] * center.x + m[3] * center.y),
    },
  };
}

export function translateAff(tx: number, ty: number): Aff2 {
  return { m: [1, 0, 0, 1], t: { x: tx, y: ty } };
}

export function closeGroup(generators: Aff2[], max = 64): Aff2[] {
  const key = (a: Aff2) =>
    [...a.m, a.t.x, a.t.y].map((v) => v.toFixed(6)).join(",");
  const out: Aff2[] = [identityAff];
  const seen = new Set([key(identityAff)]);
  let changed = true;
  while (changed && out.length < max) {
    changed = false;
    const snapshot = [...out];
    for (const g of generators) {
      for (const e of snapshot) {
        for (const cand of [composeAff(g, e), composeAff(e, g)]) {
          const k = key(cand);
          if (!seen.has(k)) {
            seen.add(k);
            out.push(cand);
            changed = true;
            if (out.length >= max) return out;
          }
        }
      }
    }
  }
  return out;
}
