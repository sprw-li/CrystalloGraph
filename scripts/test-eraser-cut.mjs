/**
 * Integration-ish eraser test using duplicated affine-free path cutter
 * mirrored from eraser.ts keepRanges / intervals.
 */
function closestT(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < 1e-9) return 0;
  return Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
}

function erasedIntervalsOnSegment(a, b, tip, radius) {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len < 1e-9) {
    return Math.hypot(a.x - tip.x, a.y - tip.y) <= radius ? [{ t0: 0, t1: 1 }] : [];
  }
  const t = closestT(tip, a, b);
  const hx = a.x + (b.x - a.x) * t;
  const hy = a.y + (b.y - a.y) * t;
  if (Math.hypot(tip.x - hx, tip.y - hy) > radius) return [];
  const half = radius / len;
  return [{ t0: Math.max(0, t - half), t1: Math.min(1, t + half) }];
}

function keepRanges(erased) {
  if (!erased.length) return [{ t0: 0, t1: 1 }];
  const m = [...erased].sort((x, y) => x.t0 - y.t0);
  const merged = [{ ...m[0] }];
  for (let i = 1; i < m.length; i++) {
    const last = merged[merged.length - 1];
    if (m[i].t0 <= last.t1 + 1e-6) last.t1 = Math.max(last.t1, m[i].t1);
    else merged.push({ ...m[i] });
  }
  const keep = [];
  let cur = 0;
  for (const e of merged) {
    if (e.t0 > cur + 1e-4) keep.push({ t0: cur, t1: e.t0 });
    cur = Math.max(cur, e.t1);
  }
  if (cur < 1 - 1e-4) keep.push({ t0: cur, t1: 1 });
  return keep;
}

function cutPolyline(points, tip, radius) {
  const pieces = [];
  let buf = [];
  const push = (p) => {
    const last = buf[buf.length - 1];
    if (last && last.x === p.x && last.y === p.y) return;
    buf.push(p);
  };
  const flush = () => {
    if (buf.length) pieces.push(buf);
    buf = [];
  };
  const lerp = (a, b, t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });

  push(points[0]);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const keeps = keepRanges(erasedIntervalsOnSegment(a, b, tip, radius));
    if (!keeps.length) {
      flush();
      continue;
    }
    if (keeps[0].t0 > 1e-4) flush();
    for (let k = 0; k < keeps.length; k++) {
      const r = keeps[k];
      if (k > 0) flush();
      if (r.t0 > 1e-4) push(lerp(a, b, r.t0));
      else if (!buf.length) push(a);
      if (r.t1 < 1 - 1e-4) {
        push(lerp(a, b, r.t1));
        flush();
      } else push(b);
    }
  }
  flush();
  return pieces;
}

const line = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
];
const parts = cutPolyline(line, { x: 50, y: 0 }, 10);
if (parts.length !== 2) {
  console.error("FAIL cut", parts);
  process.exit(1);
}
if (parts[0].length < 2 || parts[1].length < 2) {
  console.error("FAIL piece verts", parts);
  process.exit(1);
}
console.log(
  "cut OK",
  parts.map((p) => p.map((q) => `(${q.x.toFixed(0)},${q.y.toFixed(0)})`).join("-")),
);

const miss = cutPolyline(line, { x: 50, y: 40 }, 10);
if (miss.length !== 1 || miss[0].length !== 2) {
  console.error("FAIL miss", miss);
  process.exit(1);
}
console.log("miss OK");
console.log("eraser integration OK");
