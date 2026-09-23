import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/appStore";
import { fracToCart, latticeVectors, type SpaceGroupId } from "../symmetry/groups";
import {
  buildVisibleTiles,
  specialPointsInView,
  snapToPoints,
} from "../symmetry/tiling";
import { fracToCartRel } from "../coords/strokeSpace";
import type { VectorStroke } from "../document/types";
import {
  hitTestStrokeId,
  strokesInLasso,
  strokesInScreenRect,
} from "../tools/selection";
import { applyModifiers } from "../tools/modifiers";

type Cart = { x: number; y: number };

function mapStrokeCart(
  cell: { a: number; b: number; thetaDeg: number },
  stroke: VectorStroke,
  map: (p: Cart) => Cart,
) {
  return stroke.points.map((p) => map(fracToCartRel(cell, p)));
}

/** Catmull-Rom → cubic Bezier for smooth freehand (idle / committed). */
function drawSmoothPath(
  ctx: CanvasRenderingContext2D,
  pts: Cart[],
  pressures: number[],
  baseW: number,
  fast?: boolean,
) {
  if (pts.length === 1) {
    const pr = pressures[0] ?? 0.5;
    ctx.beginPath();
    ctx.arc(pts[0].x, pts[0].y, (baseW * (0.4 + 0.8 * pr)) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Fast path while drawing: variable-width polyline (pressure retained, <1ms)
  if (fast || pts.length === 2) {
    for (let i = 1; i < pts.length; i++) {
      const pr = ((pressures[i - 1] ?? 0.5) + (pressures[i] ?? 0.5)) / 2;
      ctx.beginPath();
      ctx.lineWidth = Math.max(0.5, baseW * (0.28 + 1.05 * pr));
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
    return;
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const pr = ((pressures[i] ?? 0.5) + (pressures[i + 1] ?? 0.5)) / 2;
    ctx.beginPath();
    ctx.lineWidth = Math.max(0.5, baseW * (0.28 + 1.05 * pr));
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.moveTo(p1.x, p1.y);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    ctx.stroke();
  }
}

function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  cell: { a: number; b: number; thetaDeg: number },
  stroke: VectorStroke,
  map: (p: Cart) => Cart,
  opts?: { selected?: boolean; ghost?: boolean; fast?: boolean },
) {
  const raw = stroke.points;
  const pts = mapStrokeCart(cell, stroke, map);
  if (!pts.length) return;
  ctx.save();
  ctx.globalAlpha = opts?.ghost ? stroke.style.opacity * 0.55 : stroke.style.opacity;
  ctx.strokeStyle = opts?.selected ? "#1a6fd0" : stroke.style.color;
  ctx.fillStyle = stroke.style.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.kind === "rect" && pts.length >= 2) {
    ctx.lineWidth = opts?.selected ? stroke.style.width + 2 : stroke.style.width;
    const x = Math.min(pts[0].x, pts[1].x);
    const y = Math.min(pts[0].y, pts[1].y);
    ctx.strokeRect(x, y, Math.abs(pts[1].x - pts[0].x), Math.abs(pts[1].y - pts[0].y));
  } else if (stroke.kind === "ellipse" && pts.length >= 2) {
    ctx.lineWidth = opts?.selected ? stroke.style.width + 2 : stroke.style.width;
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
  } else {
    const baseW = opts?.selected ? stroke.style.width + 2 : stroke.style.width;
    drawSmoothPath(
      ctx,
      pts,
      raw.map((p) => p.pressure ?? 0.5),
      baseW,
      opts?.fast,
    );
  }
  ctx.restore();
}

function cellPath(
  ctx: CanvasRenderingContext2D,
  origin: Cart,
  cell: { a: number; b: number; thetaDeg: number },
) {
  const c1 = fracToCart(cell, 1, 0);
  const c2 = fracToCart(cell, 1, 1);
  const c3 = fracToCart(cell, 0, 1);
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(origin.x + c1.x, origin.y + c1.y);
  ctx.lineTo(origin.x + c2.x, origin.y + c2.y);
  ctx.lineTo(origin.x + c3.x, origin.y + c3.y);
  ctx.closePath();
}

function drawCellFrame(
  ctx: CanvasRenderingContext2D,
  origin: Cart,
  cell: { a: number; b: number; thetaDeg: number },
  style: string,
  lineWidth: number,
) {
  ctx.save();
  ctx.strokeStyle = style;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  cellPath(ctx, origin, cell);
  ctx.stroke();
  ctx.restore();
}

function drawHandle(ctx: CanvasRenderingContext2D, p: Cart, color: string) {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function DrawingCanvas() {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const rafPending = useRef(false);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const tileCache = useRef<{
    key: string;
    tiles: ReturnType<typeof buildVisibleTiles>;
  } | null>(null);
  const sampleQueue = useRef<
    { sample: { x: number; y: number; pressure: number }; screen: Cart }[]
  >([]);
  const flushRaf = useRef(0);

  const doc = useAppStore((s) => s.doc);
  const view = useAppStore((s) => s.view);
  const zoom = useAppStore((s) => s.zoom);
  const draft = useAppStore((s) => s.draftStroke);
  const tool = useAppStore((s) => s.tool);
  const lineWidth = useAppStore((s) => s.lineWidth);
  const eraserSize = useAppStore((s) => s.eraserSize);
  const eraserMode = useAppStore((s) => s.eraserMode);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const selectRect = useAppStore((s) => s.selectRect);
  const selectLasso = useAppStore((s) => s.selectLasso);
  const mirrorOn = useAppStore((s) => s.mirrorOn);
  const mandalaOn = useAppStore((s) => s.mandalaOn);
  const mandalaN = useAppStore((s) => s.mandalaN);
  const mirrorA = useAppStore((s) => s.mirrorA);
  const mirrorB = useAppStore((s) => s.mirrorB);
  const mandalaCenter = useAppStore((s) => s.mandalaCenter);
  const contextMenu = useAppStore((s) => s.contextMenu);
  const pasteOffer = useAppStore((s) => s.pasteOffer);
  const cursorCart = useAppStore((s) => s.cursorCart);
  const groupId = doc.spaceGroup as SpaceGroupId;

  const worldFromScreen = (sx: number, sy: number, w: number, h: number) => {
    const cx = w / 2;
    const cy = h / 2;
    return {
      x: (sx - cx) / zoom + cx,
      y: (sy - cy) / zoom + cy,
    };
  };

  const getOrigin = (w: number, h: number) => ({
    x: w / 2 - doc.cell.a / 2,
    y: h / 2 - doc.cell.b / 2,
  });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 2 || h < 2) return;

    // Only resize backing store when needed (avoids clear + lag every frame)
    if (
      sizeRef.current.w !== w ||
      sizeRef.current.h !== h ||
      sizeRef.current.dpr !== dpr
    ) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      sizeRef.current = { w, h, dpr };
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--canvas-bg")
      .trim() || "#FFFFFF";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h / 2);

    const origin = getOrigin(w, h);
    const cell = doc.cell;
    const selected = new Set(selectedIds);
    const layers = doc.layers.filter((l) => l.visible);

    // Live mirror/mandala preview of in-progress stroke
    const draftVariants: VectorStroke[] = [];
    if (draft) {
      if (mirrorOn || mandalaOn) {
        const sets = applyModifiers(
          cell,
          draft.points,
          mirrorOn,
          mirrorA,
          mirrorB,
          mandalaOn,
          mandalaCenter,
          mandalaN,
        );
        for (let i = 0; i < sets.length; i++) {
          draftVariants.push({
            ...draft,
            id: `${draft.id}-pv-${i}`,
            points: sets[i],
          });
        }
      } else {
        draftVariants.push(draft);
      }
    }

    const strokes = [...layers.flatMap((l) => l.strokes), ...draftVariants];
    const committed = layers.flatMap((l) => l.strokes);
    const identity = (p: Cart) => ({
      x: p.x + origin.x,
      y: p.y + origin.y,
    });

    // While drawing: skip heavy wallpaper tiling of committed strokes (fixes p6m lag/jumps)
    const lite = isDrawing && (tool === "pen" || tool === "line" || tool === "rect" || tool === "ellipse");
    const tileKey = `${groupId}:${cell.a}:${cell.b}:${cell.thetaDeg}:${w}:${h}:${view.showMainFrameOnly}:${zoom}`;
    let tiles = tileCache.current?.key === tileKey ? tileCache.current.tiles : null;
    if (!tiles && view.showSymCopies && !lite) {
      tiles = buildVisibleTiles(cell, groupId, { x: 0, y: 0 }, { x: w, y: h }, origin, {
        mainFrameOnly: view.showMainFrameOnly,
      });
      tileCache.current = { key: tileKey, tiles };
    }
    if (!tiles) tiles = [];

    const drawCommitted = () => {
      if (view.showSymCopies && !lite) {
        for (const tile of tiles!) {
          if (tile.m === 0 && tile.n === 0 && tile.g === 0) continue;
          for (const s of committed) {
            drawStrokePath(ctx, cell, s, tile.mapCart, {
              selected: selected.has(s.id),
            });
          }
        }
      }
      for (const s of committed) {
        drawStrokePath(ctx, cell, s, identity, { selected: selected.has(s.id) });
      }
    };

    const drawDraft = () => {
      for (const s of draftVariants) {
        drawStrokePath(ctx, cell, s, identity, {
          ghost: /-pv-([1-9]\d*)$/.test(s.id),
          fast: lite,
        });
      }
    };

    const drawSpecial = () => {
      if (!view.showSpecialPoints) return;
      for (const p of specialPointsInView(cell, groupId, origin, { x: 0, y: 0 }, { x: w, y: h })) {
        ctx.beginPath();
        ctx.fillStyle =
          p.kind === "rCenter" ? "#c33" : p.kind === "cellCenter" ? "#246" : "#888";
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (view.showMainFrameOnly) {
      ctx.save();
      ctx.beginPath();
      cellPath(ctx, origin, cell);
      ctx.clip();
      drawCommitted();
      drawDraft();
      drawSpecial();
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "rgba(160,160,160,0.5)";
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      cellPath(ctx, origin, cell);
      ctx.fill("evenodd");
      ctx.restore();
    } else {
      drawCommitted();
      drawDraft();
      if (view.showOtherFrames && !lite) {
        const { ax, bx } = latticeVectors(cell);
        const span = 3;
        for (let m = -span; m <= span; m++) {
          for (let n = -span; n <= span; n++) {
            if (m === 0 && n === 0) continue;
            drawCellFrame(
              ctx,
              { x: origin.x + m * ax.x + n * bx.x, y: origin.y + m * ax.y + n * bx.y },
              cell,
              "rgba(80,90,110,0.22)",
              1,
            );
          }
        }
      }
      drawSpecial();
    }

    if (view.showMainFrame) {
      drawCellFrame(ctx, origin, cell, "#1f6b4f", 2.5);
    }

    if (mirrorOn) {
      const a = identity(fracToCartRel(cell, mirrorA));
      const b = identity(fracToCartRel(cell, mirrorB));
      ctx.save();
      ctx.strokeStyle = "rgba(200,40,40,0.85)";
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
      drawHandle(ctx, a, "#c33");
      drawHandle(ctx, b, "#c33");
    }
    if (mandalaOn) {
      const c = identity(fracToCartRel(cell, mandalaCenter));
      ctx.save();
      ctx.strokeStyle = "rgba(200,40,40,0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      const R = Math.max(cell.a, cell.b) * 1.4;
      for (let i = 0; i < mandalaN; i++) {
        const ang = (i * 2 * Math.PI) / mandalaN;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + R * Math.cos(ang), c.y + R * Math.sin(ang));
        ctx.stroke();
      }
      ctx.restore();
      drawHandle(ctx, c, "#c33");
    }

    if (selectRect) {
      ctx.save();
      ctx.strokeStyle = "#1a6fd0";
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(
        Math.min(selectRect.x0, selectRect.x1),
        Math.min(selectRect.y0, selectRect.y1),
        Math.abs(selectRect.x1 - selectRect.x0),
        Math.abs(selectRect.y1 - selectRect.y0),
      );
      ctx.restore();
    }
    if (selectLasso && selectLasso.length > 1) {
      ctx.save();
      ctx.strokeStyle = "#1a6fd0";
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(selectLasso[0].x, selectLasso[0].y);
      for (let i = 1; i < selectLasso.length; i++) ctx.lineTo(selectLasso[i].x, selectLasso[i].y);
      ctx.stroke();
      ctx.restore();
    }

    // Eraser square = exact erase footprint (only current tip — trail erase is invisible)
    if (tool === "eraser" && cursorCart) {
      const cx = cursorCart.x + origin.x;
      const cy = cursorCart.y + origin.y;
      const s = eraserSize;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.strokeStyle = "#111";
      ctx.lineWidth = 1.5 / zoom;
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.strokeRect(cx - s / 2, cy - s / 2, s, s);
      ctx.restore();
    }

    ctx.restore();
  }, [
    doc,
    view,
    zoom,
    draft,
    tool,
    lineWidth,
    eraserSize,
    eraserMode,
    groupId,
    selectedIds,
    selectRect,
    selectLasso,
    mirrorOn,
    mandalaOn,
    mandalaN,
    mirrorA,
    mirrorB,
    mandalaCenter,
    cursorCart,
    isDrawing,
  ]);

  useEffect(() => {
    if (rafPending.current) return;
    rafPending.current = true;
    requestAnimationFrame(() => {
      rafPending.current = false;
      redraw();
    });
  }, [redraw]);

  useEffect(() => {
    const onResize = () => {
      sizeRef.current = { w: 0, h: 0, dpr: 1 };
      redraw();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  const hitHandle = (wx: number, wy: number, origin: Cart) => {
    const cell = doc.cell;
    const targets: { id: "mirrorA" | "mirrorB" | "mandala"; p: Cart }[] = [];
    if (mirrorOn) {
      const a = fracToCartRel(cell, mirrorA);
      const b = fracToCartRel(cell, mirrorB);
      targets.push(
        { id: "mirrorA", p: { x: a.x + origin.x, y: a.y + origin.y } },
        { id: "mirrorB", p: { x: b.x + origin.x, y: b.y + origin.y } },
      );
    }
    if (mandalaOn) {
      const c = fracToCartRel(cell, mandalaCenter);
      targets.push({ id: "mandala", p: { x: c.x + origin.x, y: c.y + origin.y } });
    }
    for (const t of targets) {
      if (Math.hypot(wx - t.p.x, wy - t.p.y) <= 14 / zoom) return t.id;
    }
    return null;
  };

  const toSample = (
    e: { clientX: number; clientY: number; pressure: number; pointerType?: string },
    allowSpecialSnap: boolean,
  ) => {
    const canvas = canvasRef.current!;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const origin = getOrigin(w, h);
    const rect = canvas.getBoundingClientRect();
    const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const world = worldFromScreen(screen.x, screen.y, w, h);
    let x = world.x;
    let y = world.y;
    if (allowSpecialSnap && view.snapSpecial && tool !== "eraser") {
      const pts = specialPointsInView(doc.cell, groupId, origin, { x: 0, y: 0 }, { x: w, y: h });
      const snapped = snapToPoints({ x, y }, pts, 12 / zoom);
      if (snapped) {
        x = snapped.x;
        y = snapped.y;
      }
    }
    let pressure = 0.5;
    if (e.pointerType === "pen" || e.pointerType === "touch") {
      pressure = e.pressure > 0 ? e.pressure : 0.35;
    } else if (e.pressure > 0 && e.pressure < 1) {
      pressure = e.pressure;
    }
    return {
      sample: { x: x - origin.x, y: y - origin.y, pressure },
      screen: world,
      origin,
      w,
      h,
      rawScreen: screen,
    };
  };

  const flushSamples = () => {
    flushRaf.current = 0;
    const q = sampleQueue.current;
    if (!q.length) return;
    sampleQueue.current = [];
    const store = useAppStore.getState();
    const last = q[q.length - 1];
    store.setCursorPolarFromCart(last.sample);
    if (drawingRef.current) {
      store.extendStrokeBatch(
        q.map((item) => item.sample),
        last.screen,
      );
    }
  };

  const queueSample = (sample: { x: number; y: number; pressure: number }, screen: Cart) => {
    sampleQueue.current.push({ sample, screen });
    if (!flushRaf.current) {
      flushRaf.current = requestAnimationFrame(flushSamples);
    }
  };

  return (
    <div className="cgraph-canvas-wrap">
      <canvas
        ref={canvasRef}
        className={`cgraph-canvas${tool === "eraser" ? " eraser-cursor" : ""}`}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!selectedIds.length) return;
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          useAppStore.getState().setContextMenu({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        }}
        onPointerDown={(e) => {
          if (e.button === 2) return;
          sampleQueue.current = [];
          const { sample, screen, origin, w, h } = toSample(
            e,
            tool === "pen" || tool === "line" || tool === "rect" || tool === "ellipse",
          );
          const handle = hitHandle(screen.x, screen.y, origin);
          if (handle) {
            useAppStore.getState().setDraggingHandle(handle);
            drawingRef.current = true;
            setIsDrawing(true);
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            return;
          }
          drawingRef.current = true;
          setIsDrawing(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);

          if (tool === "selectBox" || tool === "selectLasso") {
            const tiles = buildVisibleTiles(
              doc.cell,
              groupId,
              { x: 0, y: 0 },
              { x: w, y: h },
              origin,
              { mainFrameOnly: view.showMainFrameOnly },
            );
            const id = hitTestStrokeId(
              doc,
              doc.cell,
              tiles,
              origin,
              screen,
              Math.max(10, lineWidth * 3) / zoom,
            );
            useAppStore.getState().beginStroke(sample, screen);
            if (id) useAppStore.getState().setSelectedIds([id]);
            else useAppStore.getState().clearSelection();
            return;
          }
          useAppStore.getState().beginStroke(sample, screen);
        }}
        onPointerMove={(e) => {
          const shapeTool = tool === "line" || tool === "rect" || tool === "ellipse";
          const native = e.nativeEvent as PointerEvent;
          const coalesced =
            typeof native.getCoalescedEvents === "function"
              ? native.getCoalescedEvents()
              : [native];
          const list = coalesced.length ? coalesced : [native];
          for (const pe of list) {
            const { sample, screen } = toSample(
              {
                clientX: pe.clientX,
                clientY: pe.clientY,
                pressure: pe.pressure,
                pointerType: pe.pointerType || e.pointerType,
              },
              shapeTool,
            );
            if (drawingRef.current && (e.buttons === 1 || useAppStore.getState().draggingHandle)) {
              queueSample(sample, screen);
            } else {
              useAppStore.getState().setCursorPolarFromCart(sample);
            }
          }
        }}
        onPointerUp={(e) => {
          if (flushRaf.current) {
            cancelAnimationFrame(flushRaf.current);
            flushSamples();
          }
          drawingRef.current = false;
          setIsDrawing(false);
          const { sample, screen } = toSample(
            e,
            tool === "line" || tool === "rect" || tool === "ellipse",
          );
          const state = useAppStore.getState();
          if (state.draggingHandle) {
            state.endStroke(sample);
            return;
          }
          if (tool === "selectBox" && state.selectRect) {
            const r = state.selectRect;
            if (Math.hypot(r.x1 - r.x0, r.y1 - r.y0) > 4) {
              const canvas = canvasRef.current!;
              const origin = getOrigin(canvas.clientWidth, canvas.clientHeight);
              state.setSelectedIds(strokesInScreenRect(doc, doc.cell, origin, r));
            }
            state.endStroke(sample);
            return;
          }
          if (tool === "selectLasso" && state.selectLasso) {
            const canvas = canvasRef.current!;
            const origin = getOrigin(canvas.clientWidth, canvas.clientHeight);
            state.setSelectedIds(strokesInLasso(doc, doc.cell, origin, state.selectLasso));
            state.endStroke(sample);
            return;
          }
          state.endStroke(sample);
          void screen;
        }}
        onPointerCancel={() => {
          if (flushRaf.current) {
            cancelAnimationFrame(flushRaf.current);
            flushSamples();
          }
          drawingRef.current = false;
          setIsDrawing(false);
          useAppStore.getState().endStroke();
        }}
        onWheel={(e) => {
          if (!(e.ctrlKey || e.metaKey)) return;
          e.preventDefault();
          useAppStore.getState().zoomBy(e.deltaY < 0 ? 1.08 : 1 / 1.08);
        }}
      />

      {pasteOffer && (
        <button
          type="button"
          className="cgraph-paste-fab"
          onClick={() => useAppStore.getState().pasteClipboard()}
        >
          {t("paste")}
        </button>
      )}

      {contextMenu && (
        <div
          className="cgraph-ctx"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button type="button" onClick={() => useAppStore.getState().cutSelected()}>
            {t("ctxCut")}
          </button>
          <button type="button" onClick={() => useAppStore.getState().copySelected()}>
            {t("ctxCopy")}
          </button>
          <button type="button" onClick={() => useAppStore.getState().cloneSelected()}>
            {t("ctxClone")}
          </button>
          <button
            type="button"
            onClick={() => useAppStore.getState().setContextMenu(null)}
          >
            {t("ctxCancel")}
          </button>
        </div>
      )}
    </div>
  );
}
