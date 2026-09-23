import type { DocumentModel, VectorStroke } from "../document/types";
import type { CellParams, SpaceGroupId } from "../symmetry/groups";
import { fracToCart, latticeVectors } from "../symmetry/groups";
import { buildVisibleTiles } from "../symmetry/tiling";
import { fracToCartRel } from "../coords/strokeSpace";

export type ExportPngOptions = {
  includeMainFrame: boolean;
  includeSpecialPoints: boolean;
  includeOtherFrames: boolean;
  includeSymCopies: boolean;
  maxEdge?: number;
};

function drawStrokeSimple(
  ctx: CanvasRenderingContext2D,
  cell: CellParams,
  stroke: VectorStroke,
  map: (p: { x: number; y: number }) => { x: number; y: number },
) {
  const pts = stroke.points.map((p) => map(fracToCartRel(cell, p)));
  if (!pts.length) return;
  ctx.save();
  ctx.globalAlpha = stroke.style.opacity;
  ctx.strokeStyle = stroke.style.color;
  ctx.fillStyle = stroke.style.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.style.width;
  if (stroke.kind === "rect" && pts.length >= 2) {
    ctx.strokeRect(
      Math.min(pts[0].x, pts[1].x),
      Math.min(pts[0].y, pts[1].y),
      Math.abs(pts[1].x - pts[0].x),
      Math.abs(pts[1].y - pts[0].y),
    );
  } else if (stroke.kind === "ellipse" && pts.length >= 2) {
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy,
      Math.abs(pts[1].x - pts[0].x) / 2 || 0.1,
      Math.abs(pts[1].y - pts[0].y) / 2 || 0.1,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (pts.length === 1) {
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, stroke.style.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Render document to an offscreen canvas (no UI chrome), then encode async.
 * Avoids freezing the live canvas with sync toDataURL.
 */
export async function exportDocumentPng(
  doc: DocumentModel,
  opts: ExportPngOptions,
): Promise<void> {
  const cell = doc.cell;
  const groupId = doc.spaceGroup as SpaceGroupId;
  const pad = Math.max(cell.a, cell.b) * 1.5;
  const w0 = Math.ceil(cell.a + pad * 2);
  const h0 = Math.ceil(cell.b + pad * 2);
  const maxEdge = opts.maxEdge ?? 2048;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.max(64, Math.round(w0 * scale));
  const h = Math.max(64, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.scale(scale, scale);

  const origin = { x: pad, y: pad };
  const identity = (p: { x: number; y: number }) => ({
    x: p.x + origin.x,
    y: p.y + origin.y,
  });

  const strokes = doc.layers.filter((l) => l.visible).flatMap((l) => l.strokes);

  const tiles =
    opts.includeSymCopies
      ? buildVisibleTiles(
          cell,
          groupId,
          { x: 0, y: 0 },
          { x: w0, y: h0 },
          origin,
          { mainFrameOnly: false },
        )
      : [];

  if (opts.includeSymCopies) {
    for (const tile of tiles) {
      if (tile.m === 0 && tile.n === 0 && tile.g === 0) continue;
      for (const s of strokes) drawStrokeSimple(ctx, cell, s, tile.mapCart);
    }
  }
  for (const s of strokes) drawStrokeSimple(ctx, cell, s, identity);

  if (opts.includeOtherFrames) {
    const { ax, bx } = latticeVectors(cell);
    ctx.strokeStyle = "rgba(80,90,110,0.35)";
    ctx.lineWidth = 1;
    for (let m = -2; m <= 2; m++) {
      for (let n = -2; n <= 2; n++) {
        if (m === 0 && n === 0) continue;
        const o = {
          x: origin.x + m * ax.x + n * bx.x,
          y: origin.y + m * ax.y + n * bx.y,
        };
        const c1 = fracToCart(cell, 1, 0);
        const c2 = fracToCart(cell, 1, 1);
        const c3 = fracToCart(cell, 0, 1);
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(o.x + c1.x, o.y + c1.y);
        ctx.lineTo(o.x + c2.x, o.y + c2.y);
        ctx.lineTo(o.x + c3.x, o.y + c3.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }

  if (opts.includeMainFrame) {
    const c1 = fracToCart(cell, 1, 0);
    const c2 = fracToCart(cell, 1, 1);
    const c3 = fracToCart(cell, 0, 1);
    ctx.strokeStyle = "#1f6b4f";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + c1.x, origin.y + c1.y);
    ctx.lineTo(origin.x + c2.x, origin.y + c2.y);
    ctx.lineTo(origin.x + c3.x, origin.y + c3.y);
    ctx.closePath();
    ctx.stroke();
  }

  if (opts.includeSpecialPoints) {
    // lightweight: cell center + edge mids
    const pts = [
      { u: 0.5, v: 0.5 },
      { u: 0.5, v: 0 },
      { u: 0.5, v: 1 },
      { u: 0, v: 0.5 },
      { u: 1, v: 0.5 },
    ];
    ctx.fillStyle = "#246";
    for (const sp of pts) {
      const c = fracToCart(cell, sp.u, sp.v);
      ctx.beginPath();
      ctx.arc(origin.x + c.x, origin.y + c.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("PNG encode failed"));
          return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "crystallograph.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        resolve();
      },
      "image/png",
    );
  });
}
