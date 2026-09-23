import type { Aff2, Vec2 } from "./affine";
import { closeGroup, identityAff, translateAff } from "./affine";
import { F, glideFrac } from "./fracOps";

export type SpaceGroupId =
  | "p1"
  | "p2"
  | "pm"
  | "pg"
  | "cm"
  | "pmm"
  | "pmg"
  | "pgg"
  | "cmm"
  | "p4"
  | "p4m"
  | "p4g"
  | "p3"
  | "p3m1"
  | "p31m"
  | "p6"
  | "p6m";

export type LatticeKind =
  | "oblique"
  | "rectangular"
  | "centered"
  | "square"
  | "hexagonal";

export type CellParams = {
  a: number;
  b: number;
  thetaDeg: number;
};

export type SpecialPointKind = "cellCenter" | "edgeMid" | "rCenter";

export type SpecialPoint = {
  kind: SpecialPointKind;
  u: number;
  v: number;
  label?: string;
};

export type SpaceGroupDef = {
  id: SpaceGroupId;
  lattice: LatticeKind;
  constrain: (c: CellParams) => CellParams;
  matchesHard: (c: CellParams, eps?: number) => boolean;
  generatorsFrac: Aff2[];
  specialPoints: SpecialPoint[];
};

const EPS = 1e-3;

function near(x: number, y: number, eps = EPS) {
  return Math.abs(x - y) <= eps;
}

function forceRect(c: CellParams): CellParams {
  return { ...c, thetaDeg: 90 };
}
function forceSquare(c: CellParams): CellParams {
  const s = (c.a + c.b) / 2;
  return { a: s, b: s, thetaDeg: 90 };
}
function forceHex(c: CellParams): CellParams {
  const s = (c.a + c.b) / 2;
  return { a: s, b: s, thetaDeg: 120 };
}

const cellCenter: SpecialPoint = {
  kind: "cellCenter",
  u: 0.5,
  v: 0.5,
  label: "C",
};
const edgeMids: SpecialPoint[] = [
  { kind: "edgeMid", u: 0.5, v: 0, label: "E" },
  { kind: "edgeMid", u: 0.5, v: 1, label: "E" },
  { kind: "edgeMid", u: 0, v: 0.5, label: "E" },
  { kind: "edgeMid", u: 1, v: 0.5, label: "E" },
];
const hexRCenters: SpecialPoint[] = [
  { kind: "rCenter", u: 0, v: 0, label: "R" },
  { kind: "rCenter", u: 1 / 3, v: 2 / 3, label: "R" },
  { kind: "rCenter", u: 2 / 3, v: 1 / 3, label: "R" },
];

function pts(extra: SpecialPoint[] = []): SpecialPoint[] {
  return [cellCenter, ...edgeMids, ...extra];
}

export const SPACE_GROUPS: Record<SpaceGroupId, SpaceGroupDef> = {
  p1: {
    id: "p1",
    lattice: "oblique",
    constrain: (c) => c,
    matchesHard: () => true,
    generatorsFrac: [],
    specialPoints: pts(),
  },
  p2: {
    id: "p2",
    lattice: "oblique",
    constrain: (c) => c,
    matchesHard: () => true,
    generatorsFrac: [F.rot2],
    specialPoints: pts([{ kind: "rCenter", u: 0, v: 0, label: "2" }]),
  },
  pm: {
    id: "pm",
    lattice: "rectangular",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    generatorsFrac: [F.my],
    specialPoints: pts(),
  },
  pg: {
    id: "pg",
    lattice: "rectangular",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    generatorsFrac: [glideFrac(F.my, 0, 0.5)],
    specialPoints: pts(),
  },
  cm: {
    id: "cm",
    lattice: "centered",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    generatorsFrac: [F.my, translateAff(0.5, 0.5)],
    specialPoints: pts(),
  },
  pmm: {
    id: "pmm",
    lattice: "rectangular",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    generatorsFrac: [F.mx, F.my],
    specialPoints: pts(),
  },
  pmg: {
    id: "pmg",
    lattice: "rectangular",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    // mirror ⊥ b  +  glide ∥ a (½)
    generatorsFrac: [F.my, glideFrac(F.mx, 0.5, 0)],
    specialPoints: pts(),
  },
  pgg: {
    id: "pgg",
    lattice: "rectangular",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    generatorsFrac: [glideFrac(F.mx, 0.5, 0), glideFrac(F.my, 0, 0.5)],
    specialPoints: pts(),
  },
  cmm: {
    id: "cmm",
    lattice: "centered",
    constrain: forceRect,
    matchesHard: (c) => near(c.thetaDeg, 90),
    generatorsFrac: [F.mx, F.my, translateAff(0.5, 0.5)],
    specialPoints: pts(),
  },
  p4: {
    id: "p4",
    lattice: "square",
    constrain: forceSquare,
    matchesHard: (c) => near(c.thetaDeg, 90) && near(c.a, c.b),
    generatorsFrac: [F.rot4],
    specialPoints: pts([{ kind: "rCenter", u: 0, v: 0, label: "4" }]),
  },
  p4m: {
    id: "p4m",
    lattice: "square",
    constrain: forceSquare,
    matchesHard: (c) => near(c.thetaDeg, 90) && near(c.a, c.b),
    generatorsFrac: [F.rot4, F.mx],
    specialPoints: pts([{ kind: "rCenter", u: 0, v: 0, label: "4" }]),
  },
  p4g: {
    id: "p4g",
    lattice: "square",
    constrain: forceSquare,
    matchesHard: (c) => near(c.thetaDeg, 90) && near(c.a, c.b),
    generatorsFrac: [F.rot4, glideFrac(F.md, 0.5, 0.5)],
    specialPoints: pts([{ kind: "rCenter", u: 0, v: 0, label: "4" }]),
  },
  p3: {
    id: "p3",
    lattice: "hexagonal",
    constrain: forceHex,
    matchesHard: (c) => near(c.thetaDeg, 120) && near(c.a, c.b),
    generatorsFrac: [F.rot3],
    specialPoints: pts(hexRCenters),
  },
  p3m1: {
    id: "p3m1",
    lattice: "hexagonal",
    constrain: forceHex,
    matchesHard: (c) => near(c.thetaDeg, 120) && near(c.a, c.b),
    generatorsFrac: [F.rot3, F.hexMa],
    specialPoints: pts(hexRCenters),
  },
  p31m: {
    id: "p31m",
    lattice: "hexagonal",
    constrain: forceHex,
    matchesHard: (c) => near(c.thetaDeg, 120) && near(c.a, c.b),
    generatorsFrac: [F.rot3, F.hexMb],
    specialPoints: pts(hexRCenters),
  },
  p6: {
    id: "p6",
    lattice: "hexagonal",
    constrain: forceHex,
    matchesHard: (c) => near(c.thetaDeg, 120) && near(c.a, c.b),
    generatorsFrac: [F.rot6],
    specialPoints: pts(hexRCenters),
  },
  p6m: {
    id: "p6m",
    lattice: "hexagonal",
    constrain: forceHex,
    matchesHard: (c) => near(c.thetaDeg, 120) && near(c.a, c.b),
    generatorsFrac: [F.rot6, F.hexMa],
    specialPoints: pts(hexRCenters),
  },
};

export const SPACE_GROUP_IDS = Object.keys(SPACE_GROUPS) as SpaceGroupId[];

export function groupElements(id: SpaceGroupId): Aff2[] {
  const g = SPACE_GROUPS[id];
  return closeGroup(g.generatorsFrac.length ? g.generatorsFrac : [identityAff]);
}

export function latticeVectors(cell: CellParams): { ax: Vec2; bx: Vec2 } {
  const th = (cell.thetaDeg * Math.PI) / 180;
  return {
    ax: { x: cell.a, y: 0 },
    bx: { x: cell.b * Math.cos(th), y: cell.b * Math.sin(th) },
  };
}

export function fracToCart(cell: CellParams, u: number, v: number): Vec2 {
  const { ax, bx } = latticeVectors(cell);
  return { x: u * ax.x + v * bx.x, y: u * ax.y + v * bx.y };
}

export function cartToFrac(cell: CellParams, p: Vec2): { u: number; v: number } {
  const { ax, bx } = latticeVectors(cell);
  const det = ax.x * bx.y - ax.y * bx.x;
  if (Math.abs(det) < 1e-12) return { u: 0, v: 0 };
  return {
    u: (p.x * bx.y - p.y * bx.x) / det,
    v: (ax.x * p.y - ax.y * p.x) / det,
  };
}

function latticeRank(l: LatticeKind): number {
  const map: Record<LatticeKind, number> = {
    oblique: 0,
    rectangular: 1,
    centered: 2,
    square: 3,
    hexagonal: 4,
  };
  return map[l];
}

export function inferHardGroup(
  cell: CellParams,
  current: SpaceGroupId,
  locked: boolean,
): SpaceGroupId | null {
  if (locked) return null;
  const order: SpaceGroupId[] = [
    "p6m",
    "p6",
    "p31m",
    "p3m1",
    "p3",
    "p4m",
    "p4g",
    "p4",
    "cmm",
    "pmm",
    "pmg",
    "pgg",
    "cm",
    "pm",
    "pg",
    "p2",
    "p1",
  ];
  for (const id of order) {
    const def = SPACE_GROUPS[id];
    if (!def.matchesHard(cell)) continue;
    if (id === current) return null;
    const cur = SPACE_GROUPS[current];
    if (latticeRank(def.lattice) > latticeRank(cur.lattice)) return id;
    if (
      def.lattice === cur.lattice &&
      def.generatorsFrac.length > cur.generatorsFrac.length
    )
      return id;
  }
  return null;
}

export type BetterCellHint = {
  targetGroup: SpaceGroupId;
  suggested: CellParams;
  reasonKey: string;
};

export function detectBetterCell(
  cell: CellParams,
  current: SpaceGroupId,
): BetterCellHint | null {
  if (
    near(cell.thetaDeg, 90) &&
    near(cell.a, cell.b, 0.02 * Math.max(cell.a, cell.b)) &&
    SPACE_GROUPS[current].lattice !== "square" &&
    SPACE_GROUPS[current].lattice !== "hexagonal"
  ) {
    return {
      targetGroup: "p4",
      suggested: forceSquare(cell),
      reasonKey: "betterCell.square",
    };
  }
  if (
    near(cell.thetaDeg, 120, 2) &&
    near(cell.a, cell.b, 0.02 * Math.max(cell.a, cell.b)) &&
    SPACE_GROUPS[current].lattice !== "hexagonal"
  ) {
    return {
      targetGroup: "p6",
      suggested: forceHex(cell),
      reasonKey: "betterCell.hex",
    };
  }
  if (near(cell.thetaDeg, 90, 2) && SPACE_GROUPS[current].lattice === "oblique") {
    return {
      targetGroup: "p2",
      suggested: forceRect(cell),
      reasonKey: "betterCell.rect",
    };
  }
  return null;
}
