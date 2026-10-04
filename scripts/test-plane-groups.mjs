/**
 * Plane-group regression test. For each of the 17 groups, the generators in
 * packages/core/src/symmetry/groups.ts are closed modulo lattice translations
 * and checked against ITA properties recorded in symmetry/groupInfo.ts:
 * metric compatibility, point-group order, number of copies per cell,
 * rotation orders, presence of mirror lines and of (non-mirror) glide lines.
 * Then the defining site properties are checked: p3m1 (all threefold centres
 * on mirrors) vs p31m (centres at (1/3,2/3),(2/3,1/3) off mirrors), plus
 * pmm/pmg/cmm/p4m/p4g rotation-centre-on-mirror facts.
 * Run: node scripts/test-plane-groups.mjs
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const core = path.join(root, "packages", "core", "src");
const out = await build({
  stdin: {
    contents: `export { SPACE_GROUPS, SPACE_GROUP_IDS } from "./symmetry/groups";
export { PLANE_GROUP_INFO } from "./symmetry/groupInfo";`,
    resolveDir: core,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
  logLevel: "silent",
});
const { SPACE_GROUPS, SPACE_GROUP_IDS, PLANE_GROUP_INFO } = await import(
  "data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64")
);

const EPS = 1e-9;
const near = (a, b) => Math.abs(a - b) < 1e-7;
const frac = (x) => {
  const f = x - Math.floor(x);
  return near(f, 1) || near(f, 0) ? 0 : f;
};
// op = [m11, m12, m21, m22, tx, ty]; x' = M x + t (fractional coordinates)
const compose = (a, b) => [
  a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
  a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
  a[0] * b[4] + a[1] * b[5] + a[4], a[2] * b[4] + a[3] * b[5] + a[5],
];
const reduce = (g) => [g[0], g[1], g[2], g[3], frac(g[4]), frac(g[5])];
const key = (g) => g.map((v) => (Math.round(v * 1e6) / 1e6 + 0).toFixed(6)).join(",");
const det = (g) => g[0] * g[3] - g[1] * g[2];
const isI = (g) => near(g[0], 1) && near(g[1], 0) && near(g[2], 0) && near(g[3], 1);
const apply = (g, p) => [g[0] * p[0] + g[1] * p[1] + g[4], g[2] * p[0] + g[3] * p[1] + g[5]];
const LAT = [-2, -1, 0, 1, 2];

/** Coset representatives of the group modulo integer lattice translations. */
function closeModLattice(gens) {
  const id = [1, 0, 0, 1, 0, 0];
  const out = new Map([[key(id), id]]);
  let frontier = [id];
  while (frontier.length) {
    const next = [];
    for (const e of frontier)
      for (const g of gens) {
        const c = reduce(compose(g, e));
        const k = key(c);
        if (!out.has(k)) {
          out.set(k, c);
          next.push(c);
        }
      }
    frontier = next;
    assert.ok(out.size <= 48, "group closure did not terminate");
  }
  return [...out.values()];
}

function linearOrder(g) {
  let p = [g[0], g[1], g[2], g[3], 0, 0];
  for (let n = 1; n <= 12; n++) {
    if (isI(p)) return n;
    p = compose(g, p);
  }
  return Infinity;
}

/** All translations of the group (lattice + centring), as fractional vectors. */
const translationsOf = (ops) => ops.filter((g) => isI(g)).map((g) => [g[4], g[5]]);
const inTranslations = (T, w) =>
  T.some((t) => near(frac(w[0] - t[0]), 0) && near(frac(w[1] - t[1]), 0));

/** Is point p fixed by some reflection of the group (i.e. lies on a mirror line)? */
function onMirror(ops, p) {
  for (const g of ops) {
    if (det(g) > 0) continue;
    for (const i of LAT)
      for (const j of LAT) {
        const q = apply(g, p);
        if (near(q[0] + i, p[0]) && near(q[1] + j, p[1])) return true;
      }
  }
  return false;
}

/** Is p a rotation centre of order ≥ n? */
function rotationCentre(ops, p, n) {
  for (const g of ops) {
    if (det(g) < 0 || isI(g) || linearOrder(g) < n) continue;
    for (const i of LAT)
      for (const j of LAT) {
        const q = apply(g, p);
        if (near(q[0] + i, p[0]) && near(q[1] + j, p[1])) return true;
      }
  }
  return false;
}

function equivalent(ops, p, q) {
  return ops.some((g) => {
    const r = apply(g, p);
    return near(frac(r[0] - q[0]), 0) && near(frac(r[1] - q[1]), 0);
  });
}

const POINT_GROUP_ORDER = { 1: 1, 2: 2, m: 2, "2mm": 4, 4: 4, "4mm": 8, 3: 3, "3m": 6, 6: 6, "6mm": 12 };

let checks = 0;
const opsOf = {};
for (const id of SPACE_GROUP_IDS) {
  const def = SPACE_GROUPS[id];
  const info = PLANE_GROUP_INFO[id];
  const gens = def.generatorsFrac.map((a) => [...a.m, a.t.x, a.t.y]);
  const ops = closeModLattice(gens);
  opsOf[id] = ops;

  // Every linear part must be an isometry of the constrained cell metric.
  const c = def.constrain({ a: 100, b: 137, thetaDeg: 73 });
  const th = (c.thetaDeg * Math.PI) / 180;
  const G = [c.a * c.a, c.a * c.b * Math.cos(th), c.a * c.b * Math.cos(th), c.b * c.b];
  for (const g of ops) {
    const M = [g[0], g[1], g[2], g[3]];
    // MᵀGM
    const GM = [G[0] * M[0] + G[1] * M[2], G[0] * M[1] + G[1] * M[3], G[2] * M[0] + G[3] * M[2], G[2] * M[1] + G[3] * M[3]];
    const R = [M[0] * GM[0] + M[2] * GM[2], M[0] * GM[1] + M[2] * GM[3], M[1] * GM[0] + M[3] * GM[2], M[1] * GM[1] + M[3] * GM[3]];
    for (let k = 0; k < 4; k++)
      assert.ok(Math.abs(R[k] - G[k]) < 1e-6 * c.a * c.b, `${id}: operation is not an isometry of its lattice`);
    checks++;
  }

  assert.equal(ops.length, info.copiesPerCell, `${id}: copies per cell`);
  const linear = new Set(ops.map((g) => key([g[0], g[1], g[2], g[3], 0, 0])));
  assert.equal(linear.size, POINT_GROUP_ORDER[info.pointGroup], `${id}: point-group order (${info.pointGroup})`);
  const hasReflections = ops.some((g) => det(g) < 0);
  assert.equal(hasReflections, /m|g/.test(info.pointGroup) || info.pointGroup === "m", `${id}: point group has reflections`);

  const orders = [...new Set(ops.filter((g) => det(g) > 0 && !isI(g)).map(linearOrder))].sort((a, b) => b - a);
  assert.deepEqual(orders, info.rotationOrders, `${id}: rotation orders`);

  const T = translationsOf(ops);
  let mirror = false;
  let glide = false;
  for (const g of ops) {
    if (det(g) > 0) continue;
    for (const i of LAT)
      for (const j of LAT) {
        const tx = g[4] + i, ty = g[5] + j;
        // g² = translation by w = (M + I) t
        const w = [(g[0] + 1) * tx + g[1] * ty, g[2] * tx + (g[3] + 1) * ty];
        if (near(w[0], 0) && near(w[1], 0)) mirror = true;
        else if (!inTranslations(T, [w[0] / 2, w[1] / 2])) glide = true;
      }
  }
  assert.equal(mirror, info.mirrors, `${id}: mirror lines`);
  assert.equal(glide, info.glides, `${id}: glide lines`);
  checks += 6;
}

// Defining property: p3m1 vs p31m
const T3 = [[0, 0], [1 / 3, 2 / 3], [2 / 3, 1 / 3]];
for (const id of ["p3", "p3m1", "p31m", "p6", "p6m"])
  for (const p of T3) assert.ok(rotationCentre(opsOf[id], p, 3), `${id}: threefold centre at ${p}`);
for (const p of T3) assert.ok(onMirror(opsOf.p3m1, p), `p3m1: threefold centre ${p} must lie on a mirror`);
assert.ok(onMirror(opsOf.p31m, [0, 0]), "p31m: centre at origin must lie on mirrors");
assert.ok(!onMirror(opsOf.p31m, T3[1]), "p31m: centre at (1/3,2/3) must not lie on a mirror");
assert.ok(!onMirror(opsOf.p31m, T3[2]), "p31m: centre at (2/3,1/3) must not lie on a mirror");
assert.ok(equivalent(opsOf.p31m, T3[1], T3[2]), "p31m: (1/3,2/3) and (2/3,1/3) are one class");
assert.ok(!equivalent(opsOf.p3m1, T3[1], T3[2]), "p3m1: three inequivalent threefold centres");
checks += 14;

// Other site facts quoted in the Symmetry elements descriptions
const twofold = [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]];
const centresOf = (id, n, pts) => pts.filter((p) => rotationCentre(opsOf[id], p, n));
const sample = [];
for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) sample.push([i / 8, j / 8]);
const allTwofold = (id) => sample.filter((p) => rotationCentre(opsOf[id], p, 2));
assert.ok(allTwofold("pmm").every((p) => onMirror(opsOf.pmm, p)), "pmm: twofold centres on mirrors");
assert.ok(allTwofold("pmg").length && allTwofold("pmg").every((p) => !onMirror(opsOf.pmg, p)), "pmg: twofold centres off mirrors");
assert.ok(allTwofold("pgg").length, "pgg: twofold centres exist");
const cmm2 = allTwofold("cmm");
assert.ok(cmm2.some((p) => onMirror(opsOf.cmm, p)) && cmm2.some((p) => !onMirror(opsOf.cmm, p)), "cmm: twofold centres on and off mirrors");
assert.ok(allTwofold("p4m").every((p) => onMirror(opsOf.p4m, p)), "p4m: every rotation centre on mirrors");
const p4g4 = sample.filter((p) => rotationCentre(opsOf.p4g, p, 4));
assert.ok(p4g4.length && p4g4.every((p) => !onMirror(opsOf.p4g, p)), "p4g: fourfold centres off mirrors");
assert.ok(allTwofold("p6m").every((p) => onMirror(opsOf.p6m, p)), "p6m: every rotation centre on mirrors");
assert.equal(centresOf("p2", 2, twofold).length, 4, "p2: twofold centres at lattice points, edge midpoints, cell centre");
checks += 8;

console.log(`plane groups OK — 17 groups, ${checks} checks`);
