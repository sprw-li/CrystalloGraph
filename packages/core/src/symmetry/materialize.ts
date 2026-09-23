import type { DocumentModel, VectorStroke } from "../document/types";
import { uid } from "../document/types";
import {
  SPACE_GROUPS,
  type CellParams,
  type SpaceGroupId,
} from "../symmetry/groups";
import { applyAff, identityAff, type Aff2 } from "../symmetry/affine";
import { getGroupElementsCached } from "../symmetry/tiling";

function isIdentity(el: Aff2): boolean {
  const [a, b, c, d] = el.m;
  return (
    Math.abs(a - 1) < 1e-9 &&
    Math.abs(b) < 1e-9 &&
    Math.abs(c) < 1e-9 &&
    Math.abs(d - 1) < 1e-9 &&
    Math.abs(el.t.x) < 1e-9 &&
    Math.abs(el.t.y) < 1e-9
  );
}

function mapStrokeByAff(stroke: VectorStroke, el: Aff2): VectorStroke {
  return {
    ...stroke,
    id: uid(),
    points: stroke.points.map((p) => {
      const q = applyAff(el, { x: p.u, y: p.v });
      return { u: q.x, v: q.y, pressure: p.pressure };
    }),
  };
}

/**
 * Bake current wallpaper point-group images into real master strokes.
 * Only motif copies (group elements at lattice 0), not infinite lattice translates.
 */
export function materializeGroupCopies(
  doc: DocumentModel,
  groupId: SpaceGroupId,
): DocumentModel {
  const elements = getGroupElementsCached(groupId);
  const ops = elements.length ? elements : [identityAff];

  return {
    ...doc,
    layers: doc.layers.map((layer) => {
      if (layer.id !== doc.activeLayerId) return layer;
      const next: VectorStroke[] = [];
      for (const stroke of layer.strokes) {
        for (const el of ops) {
          if (isIdentity(el)) next.push(stroke);
          else next.push(mapStrokeByAff(stroke, el));
        }
      }
      return { ...layer, strokes: next };
    }),
  };
}

export function breaksGroupConstraint(
  groupId: SpaceGroupId,
  cell: CellParams,
): boolean {
  if (groupId === "p1" || groupId === "p2") return false;
  return !SPACE_GROUPS[groupId].matchesHard(cell);
}
