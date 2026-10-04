import type { SpaceGroupId } from "./groups";

/**
 * Language-neutral reference data for the 17 plane groups, following
 * International Tables for Crystallography, Vol. A (ITA).
 *
 * Symbols are notation and are shown as-is in every UI language; prose
 * (lattice names, descriptions) is looked up in `i18n/locales.ts` via
 * `lattice.<kind>` and `group.<id>.desc`.
 */
export type PlaneGroupInfo = {
  /** ITA plane-group number, 1–17. */
  itaNumber: number;
  /** Full Hermann–Mauguin symbol (ITA). The short symbol is the group id. */
  fullSymbol: string;
  /** Conway orbifold symbol. */
  orbifold: string;
  /** Crystallographic point group (2D). */
  pointGroup: string;
  /** Orders of the rotation centers present (highest first); empty if none. */
  rotationOrders: number[];
  /** Has mirror (reflection) lines. */
  mirrors: boolean;
  /** Has glide lines that are not also mirror lines. */
  glides: boolean;
  /**
   * Number of symmetry-equivalent copies of the fundamental domain in the
   * cell drawn by the app (the conventional cell; doubled for c-centred groups).
   */
  copiesPerCell: number;
};

export const PLANE_GROUP_INFO: Record<SpaceGroupId, PlaneGroupInfo> = {
  p1: { itaNumber: 1, fullSymbol: "p1", orbifold: "o", pointGroup: "1", rotationOrders: [], mirrors: false, glides: false, copiesPerCell: 1 },
  p2: { itaNumber: 2, fullSymbol: "p211", orbifold: "2222", pointGroup: "2", rotationOrders: [2], mirrors: false, glides: false, copiesPerCell: 2 },
  pm: { itaNumber: 3, fullSymbol: "p1m1", orbifold: "**", pointGroup: "m", rotationOrders: [], mirrors: true, glides: false, copiesPerCell: 2 },
  pg: { itaNumber: 4, fullSymbol: "p1g1", orbifold: "××", pointGroup: "m", rotationOrders: [], mirrors: false, glides: true, copiesPerCell: 2 },
  cm: { itaNumber: 5, fullSymbol: "c1m1", orbifold: "*×", pointGroup: "m", rotationOrders: [], mirrors: true, glides: true, copiesPerCell: 4 },
  pmm: { itaNumber: 6, fullSymbol: "p2mm", orbifold: "*2222", pointGroup: "2mm", rotationOrders: [2], mirrors: true, glides: false, copiesPerCell: 4 },
  pmg: { itaNumber: 7, fullSymbol: "p2mg", orbifold: "22*", pointGroup: "2mm", rotationOrders: [2], mirrors: true, glides: true, copiesPerCell: 4 },
  pgg: { itaNumber: 8, fullSymbol: "p2gg", orbifold: "22×", pointGroup: "2mm", rotationOrders: [2], mirrors: false, glides: true, copiesPerCell: 4 },
  cmm: { itaNumber: 9, fullSymbol: "c2mm", orbifold: "2*22", pointGroup: "2mm", rotationOrders: [2], mirrors: true, glides: true, copiesPerCell: 8 },
  p4: { itaNumber: 10, fullSymbol: "p4", orbifold: "442", pointGroup: "4", rotationOrders: [4, 2], mirrors: false, glides: false, copiesPerCell: 4 },
  p4m: { itaNumber: 11, fullSymbol: "p4mm", orbifold: "*442", pointGroup: "4mm", rotationOrders: [4, 2], mirrors: true, glides: true, copiesPerCell: 8 },
  p4g: { itaNumber: 12, fullSymbol: "p4gm", orbifold: "4*2", pointGroup: "4mm", rotationOrders: [4, 2], mirrors: true, glides: true, copiesPerCell: 8 },
  p3: { itaNumber: 13, fullSymbol: "p3", orbifold: "333", pointGroup: "3", rotationOrders: [3], mirrors: false, glides: false, copiesPerCell: 3 },
  p3m1: { itaNumber: 14, fullSymbol: "p3m1", orbifold: "*333", pointGroup: "3m", rotationOrders: [3], mirrors: true, glides: true, copiesPerCell: 6 },
  p31m: { itaNumber: 15, fullSymbol: "p31m", orbifold: "3*3", pointGroup: "3m", rotationOrders: [3], mirrors: true, glides: true, copiesPerCell: 6 },
  p6: { itaNumber: 16, fullSymbol: "p6", orbifold: "632", pointGroup: "6", rotationOrders: [6, 3, 2], mirrors: false, glides: false, copiesPerCell: 6 },
  p6m: { itaNumber: 17, fullSymbol: "p6mm", orbifold: "*632", pointGroup: "6mm", rotationOrders: [6, 3, 2], mirrors: true, glides: true, copiesPerCell: 12 },
};
