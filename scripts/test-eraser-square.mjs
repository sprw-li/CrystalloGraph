/** Square eraser coverage tests. */
function erasedIntervalsInSquare(a, b, tip, h) {
  const xmin = tip.x - h;
  const xmax = tip.x + h;
  const ymin = tip.y - h;
  const ymax = tip.y + h;
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (p, q) => {
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

function keepRanges(erased) {
  if (!erased.length) return [{ t0: 0, t1: 1 }];
  const keep = [];
  let cur = 0;
  for (const e of erased) {
    if (e.t0 > cur + 1e-6) keep.push({ t0: cur, t1: e.t0 });
    cur = Math.max(cur, e.t1);
  }
  if (cur < 1 - 1e-6) keep.push({ t0: cur, t1: 1 });
  return keep;
}

// Horizontal line through square center → erase middle only
const a = { x: 0, y: 0 };
const b = { x: 100, y: 0 };
const tip = { x: 50, y: 0 };
const h = 10; // size 20
const erased = erasedIntervalsInSquare(a, b, tip, h);
const keeps = keepRanges(erased);
if (keeps.length !== 2) {
  console.error("FAIL keeps", keeps, erased);
  process.exit(1);
}
// covered portion should be ~[0.4, 0.6]
if (Math.abs(erased[0].t0 - 0.4) > 0.01 || Math.abs(erased[0].t1 - 0.6) > 0.01) {
  console.error("FAIL interval", erased[0]);
  process.exit(1);
}

// Point just outside square not covered
const tip2 = { x: 50, y: 11 };
const miss = erasedIntervalsInSquare(a, b, tip2, h);
if (miss.length !== 0) {
  console.error("FAIL outside should miss", miss);
  process.exit(1);
}

console.log("square eraser OK", erased[0], keeps);
