import type { DocumentModel, FracPoint, VectorStroke } from "../document/types";
import type { CellParams } from "../symmetry/groups";
import { cartRelToFrac, fracToCartRel } from "../coords/strokeSpace";

/** Keep cart geometry fixed while cell a/b/θ change. */
export function remapPointToNewCell(
  oldCell: CellParams,
  newCell: CellParams,
  p: FracPoint,
): FracPoint {
  const c = fracToCartRel(oldCell, p);
  return cartRelToFrac(newCell, c, p.pressure);
}

export function remapStrokeToNewCell(
  oldCell: CellParams,
  newCell: CellParams,
  stroke: VectorStroke,
): VectorStroke {
  return {
    ...stroke,
    points: stroke.points.map((p) => remapPointToNewCell(oldCell, newCell, p)),
  };
}

/**
 * Translate a stroke by integer lattice so its centroid lies in [0,1)².
 * Replaces the object with an equivalent translate (graphics unchanged in cart).
 */
export function wrapStrokeToPrimaryCell(
  cell: CellParams,
  stroke: VectorStroke,
): VectorStroke {
  if (!stroke.points.length) return stroke;
  let su = 0;
  let sv = 0;
  for (const p of stroke.points) {
    su += p.u;
    sv += p.v;
  }
  const n = stroke.points.length;
  const du = -Math.floor(su / n);
  const dv = -Math.floor(sv / n);
  if (du === 0 && dv === 0) return stroke;
  return {
    ...stroke,
    points: stroke.points.map((p) => ({ ...p, u: p.u + du, v: p.v + dv })),
  };
}

export function remapDocumentCell(
  doc: DocumentModel,
  oldCell: CellParams,
  newCell: CellParams,
  opts?: { wrapToPrimary?: boolean },
): DocumentModel {
  const wrap = opts?.wrapToPrimary !== false;
  return {
    ...doc,
    cell: newCell,
    layers: doc.layers.map((layer) => ({
      ...layer,
      strokes: layer.strokes.map((s) => {
        let next = remapStrokeToNewCell(oldCell, newCell, s);
        if (wrap) next = wrapStrokeToPrimaryCell(newCell, next);
        return next;
      }),
    })),
  };
}

export function remapFracHandles(
  oldCell: CellParams,
  newCell: CellParams,
  handles: { mirrorA: FracPoint; mirrorB: FracPoint; mandalaCenter: FracPoint },
) {
  return {
    mirrorA: remapPointToNewCell(oldCell, newCell, handles.mirrorA),
    mirrorB: remapPointToNewCell(oldCell, newCell, handles.mirrorB),
    mandalaCenter: remapPointToNewCell(oldCell, newCell, handles.mandalaCenter),
  };
}
