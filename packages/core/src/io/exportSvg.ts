import type { DocumentModel, VectorStroke } from "../document/types";
import type { CellParams, SpaceGroupId } from "../symmetry/groups";
import { fracToCart, latticeVectors } from "../symmetry/groups";
import { buildVisibleTiles } from "../symmetry/tiling";
import { fracToCartRel } from "../coords/strokeSpace";

export type ExportSvgOptions = {
  includeMainFrame: boolean;
  includeSpecialPoints: boolean;
  includeOtherFrames: boolean;
  includeSymCopies: boolean;
};

function esc(c: string) {
  return c.replace(/"/g, "&quot;");
}

function pathD(
  cell: CellParams,
  stroke: VectorStroke,
  map: (p: { x: number; y: number }) => { x: number; y: number },
): string {
  const pts = stroke.points.map((p) => map(fracToCartRel(cell, p)));
  if (!pts.length) return "";
  if (stroke.kind === "rect" && pts.length >= 2) {
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    const w = Math.abs(pts[1].x - pts[0].x);
    const h = Math.abs(pts[1].y - pts[0].y);
    return `M${x} ${y}h${w}v${h}h${-w}z`;
  }
  if (stroke.kind === "ellipse" && pts.length >= 2) {
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;
    const rx = Math.abs(pts[1].x - pts[0].x) / 2 || 0.1;
    const ry = Math.abs(pts[1].y - pts[0].y) / 2 || 0.1;
    return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0`;
  }
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) d += `L${pts[i].x} ${pts[i].y}`;
  return d;
}

export function buildDocumentSvg(
  doc: DocumentModel,
  opts: ExportSvgOptions,
): string {
  const cell = doc.cell;
  const groupId = doc.spaceGroup as SpaceGroupId;
  const pad = Math.max(cell.a, cell.b) * 1.5;
  const w = Math.ceil(cell.a + pad * 2);
  const h = Math.ceil(cell.b + pad * 2);
  const origin = { x: pad, y: pad };
  const identity = (p: { x: number; y: number }) => ({
    x: p.x + origin.x,
    y: p.y + origin.y,
  });
  const strokes = doc.layers.filter((l) => l.visible).flatMap((l) => l.strokes);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="#fff"/>`);

  const drawStroke = (
    s: VectorStroke,
    map: (p: { x: number; y: number }) => { x: number; y: number },
  ) => {
    const d = pathD(cell, s, map);
    if (!d) return;
    parts.push(
      `<path d="${d}" fill="none" stroke="${esc(s.style.color)}" stroke-width="${s.style.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${s.style.opacity}"/>`,
    );
  };

  if (opts.includeSymCopies) {
    const tiles = buildVisibleTiles(
      cell,
      groupId,
      { x: 0, y: 0 },
      { x: w, y: h },
      origin,
      { mainFrameOnly: false },
    );
    for (const tile of tiles) {
      if (tile.m === 0 && tile.n === 0 && tile.g === 0) continue;
      for (const s of strokes) drawStroke(s, tile.mapCart);
    }
  }
  for (const s of strokes) drawStroke(s, identity);

  if (opts.includeOtherFrames) {
    const { ax, bx } = latticeVectors(cell);
    const c1 = fracToCart(cell, 1, 0);
    const c2 = fracToCart(cell, 1, 1);
    const c3 = fracToCart(cell, 0, 1);
    for (let m = -2; m <= 2; m++) {
      for (let n = -2; n <= 2; n++) {
        if (m === 0 && n === 0) continue;
        const o = {
          x: origin.x + m * ax.x + n * bx.x,
          y: origin.y + m * ax.y + n * bx.y,
        };
        parts.push(
          `<polygon points="${o.x},${o.y} ${o.x + c1.x},${o.y + c1.y} ${o.x + c2.x},${o.y + c2.y} ${o.x + c3.x},${o.y + c3.y}" fill="none" stroke="rgba(80,90,110,0.35)" stroke-width="1"/>`,
        );
      }
    }
  }

  if (opts.includeMainFrame) {
    const c1 = fracToCart(cell, 1, 0);
    const c2 = fracToCart(cell, 1, 1);
    const c3 = fracToCart(cell, 0, 1);
    parts.push(
      `<polygon points="${origin.x},${origin.y} ${origin.x + c1.x},${origin.y + c1.y} ${origin.x + c2.x},${origin.y + c2.y} ${origin.x + c3.x},${origin.y + c3.y}" fill="none" stroke="#1f6b4f" stroke-width="2.5"/>`,
    );
  }

  if (opts.includeSpecialPoints) {
    for (const sp of [
      { u: 0.5, v: 0.5 },
      { u: 0.5, v: 0 },
      { u: 0.5, v: 1 },
      { u: 0, v: 0.5 },
      { u: 1, v: 0.5 },
    ]) {
      const c = fracToCart(cell, sp.u, sp.v);
      parts.push(
        `<circle cx="${origin.x + c.x}" cy="${origin.y + c.y}" r="3" fill="#246"/>`,
      );
    }
  }

  parts.push(`</svg>`);
  return parts.join("\n");
}

export function downloadDocumentSvg(doc: DocumentModel, opts: ExportSvgOptions) {
  const svg = buildDocumentSvg(doc, opts);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crystallograph.svg";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
