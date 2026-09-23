/** Standalone eraser math smoke test. */
function distPointToSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby));
}

function closestT(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return 0;
  return Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
}

function erasedIntervalsOnSegment(a, b, tip, radius) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const t = closestT(tip, a, b);
  const hx = a.x + (b.x - a.x) * t;
  const hy = a.y + (b.y - a.y) * t;
  if (Math.hypot(tip.x - hx, tip.y - hy) > radius) return [];
  const half = radius / len;
  return [{ t0: Math.max(0, t - half), t1: Math.min(1, t + half) }];
}

function keepRanges(erased) {
  if (!erased.length) return [{ t0: 0, t1: 1 }];
  const keep = [];
  let cur = 0;
  for (const e of erased) {
    if (e.t0 > cur + 1e-4) keep.push({ t0: cur, t1: e.t0 });
    cur = Math.max(cur, e.t1);
  }
  if (cur < 1 - 1e-4) keep.push({ t0: cur, t1: 1 });
  return keep;
}

// Mid-segment: long line should split into 2 pieces
const a = { x: 0, y: 50 };
const b = { x: 100, y: 50 };
const tip = { x: 50, y: 52 };
const erased = erasedIntervalsOnSegment(a, b, tip, 8);
const keeps = keepRanges(erased);
if (keeps.length !== 2) {
  console.error("FAIL mid split keeps", keeps, erased);
  process.exit(1);
}
console.log("mid-segment split OK", keeps);

// Vertex hit
const tip2 = { x: 50, y: 50 };
const a2 = { x: 10, y: 50 };
const b2 = { x: 50, y: 50 };
const c2 = { x: 90, y: 50 };
const e1 = erasedIntervalsOnSegment(a2, b2, tip2, 8);
const e2 = erasedIntervalsOnSegment(b2, c2, tip2, 8);
const k1 = keepRanges(e1);
const k2 = keepRanges(e2);
if (k1.length !== 1 || k2.length !== 1) {
  console.error("FAIL vertex", k1, k2);
  process.exit(1);
}
console.log("vertex partial OK", k1, k2);

const d = distPointToSegment({ x: 50, y: 52 }, { x: 0, y: 50 }, { x: 100, y: 50 });
if (d > 3) {
  console.error("FAIL dist", d);
  process.exit(1);
}
console.log("eraser math OK");
