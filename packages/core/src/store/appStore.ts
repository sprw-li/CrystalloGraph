import { create } from "zustand";
import {
  detectBetterCell,
  inferHardGroup,
  SPACE_GROUPS,
  type BetterCellHint,
  type CellParams,
  type SpaceGroupId,
} from "../symmetry/groups";
import {
  createEmptyDocument,
  uid,
  type DocumentModel,
  type EraserMode,
  type FracPoint,
  type ToolId,
  type VectorStroke,
} from "../document/types";
import { cartToPolar, type Polar } from "../coords/polar";
import { cartRelToFrac, fracToCartRel, fracToPolar } from "../coords/strokeSpace";
import { eraseNearTip, eraseWholeStrokeAt, clearEraserCaches } from "../tools/eraser";
import { applyModifiers } from "../tools/modifiers";
import { remapDocumentCell, remapFracHandles } from "../coords/cellRemap";
import { fracToCart, cartToFrac } from "../symmetry/groups";
import { clearGroupElementCache } from "../symmetry/tiling";
import { changeLang, currentLang, type Lang } from "../i18n";
import {
  breaksGroupConstraint,
  materializeGroupCopies,
} from "../symmetry/materialize";

export type CellUnlockPrompt = {
  fromGroup: SpaceGroupId;
  intendedCell: CellParams;
  /** unlock = ask switch to p1; keepPattern = ask bake copies */
  step: "unlock" | "keepPattern";
};

function snapCartToSpecial(
  cell: CellParams,
  groupId: SpaceGroupId,
  pos: { x: number; y: number },
  threshold: number,
): { x: number; y: number } | null {
  const base = [
    ...SPACE_GROUPS[groupId].specialPoints,
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 0, v: 1 },
    { u: 1, v: 1 },
    { u: 0.5, v: 0 },
    { u: 0.5, v: 1 },
    { u: 0, v: 0.5 },
    { u: 1, v: 0.5 },
    { u: 0.5, v: 0.5 },
  ];
  const f = cartToFrac(cell, pos);
  const u0 = Math.floor(f.u);
  const v0 = Math.floor(f.v);
  let best: { x: number; y: number } | null = null;
  let bestD = threshold;
  for (let m = u0 - 1; m <= u0 + 1; m++) {
    for (let n = v0 - 1; n <= v0 + 1; n++) {
      for (const sp of base) {
        const c = fracToCart(cell, sp.u + m, sp.v + n);
        const d = Math.hypot(c.x - pos.x, c.y - pos.y);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
    }
  }
  return best;
}

function normalizePressure(p: number | undefined): number {
  // Mouse often reports 0.5; treat 0 as light, keep tablet range
  if (p == null || Number.isNaN(p)) return 0.5;
  if (p <= 0) return 0.35;
  return Math.min(1, Math.max(0.08, p));
}

function snapToStrokeGeometry(
  cell: CellParams,
  cart: { x: number; y: number },
  doc: DocumentModel,
  threshold: number,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = threshold;
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    for (const stroke of layer.strokes) {
      for (const pt of stroke.points.map((p) => fracToCartRel(cell, p))) {
        const d = Math.hypot(pt.x - cart.x, pt.y - cart.y);
        if (d < bestD) {
          bestD = d;
          best = pt;
        }
      }
    }
  }
  return best;
}

export type ViewFlags = {
  showSymCopies: boolean;
  showOtherFrames: boolean;
  showMainFrame: boolean;
  showMainFrameOnly: boolean;
  showSpecialPoints: boolean;
  snapSpecial: boolean;
  snapCurve: boolean;
  lockR: boolean;
  lockPhi: boolean;
};

type PointerSample = { x: number; y: number; pressure?: number };
type CartTip = { x: number; y: number };

type AppState = {
  lang: Lang;
  theme: "classic" | "teal" | "blue" | "amber" | "rose";
  doc: DocumentModel;
  tool: ToolId;
  mirrorOn: boolean;
  mandalaOn: boolean;
  mandalaN: number;
  mirrorA: FracPoint;
  mirrorB: FracPoint;
  mandalaCenter: FracPoint;
  color: string;
  lineWidth: number;
  eraserMode: EraserMode;
  eraserSize: number;
  groupLocked: boolean;
  previewGroup: SpaceGroupId | null;
  draggingCell: boolean;
  view: ViewFlags;
  zoom: number;
  betterHint: BetterCellHint | null;
  cellUnlockPrompt: CellUnlockPrompt | null;
  suppressBetterSession: boolean;
  lastBetterKey: string | null;
  lastBetterAt: number;
  cursorPolar: Polar | null;
  cursorCart: CartTip | null;
  draftStroke: VectorStroke | null;
  eraserTrailCart: CartTip[];
  selectedIds: string[];
  selectRect: { x0: number; y0: number; x1: number; y1: number } | null;
  selectLasso: { x: number; y: number }[] | null;
  moveOrigin: { x: number; y: number } | null;
  clipboard: VectorStroke[] | null;
  pasteOffer: boolean;
  contextMenu: { x: number; y: number } | null;
  history: DocumentModel[];
  future: DocumentModel[];
  mode: "desktop" | "web";
  draggingHandle: "mirrorA" | "mirrorB" | "mandala" | null;

  /** Switch UI language (persisted outside the document). */
  setLang: (lang: Lang) => void;
  setTheme: (theme: AppState["theme"]) => void;
  setTool: (t: ToolId) => void;
  toggleMirror: () => void;
  toggleMandala: () => void;
  setMandalaN: (n: number) => void;
  setMirrorA: (p: FracPoint) => void;
  setMirrorB: (p: FracPoint) => void;
  setMandalaCenter: (p: FracPoint) => void;
  setColor: (c: string) => void;
  setLineWidth: (w: number) => void;
  setEraserMode: (m: EraserMode) => void;
  setEraserSize: (s: number) => void;
  setGroupLocked: (v: boolean) => void;
  setView: (partial: Partial<ViewFlags>) => void;
  setZoom: (z: number) => void;
  zoomBy: (factor: number) => void;
  setMode: (m: "desktop" | "web") => void;
  setSelectedIds: (ids: string[]) => void;
  clearSelection: () => void;
  setDraggingHandle: (h: AppState["draggingHandle"]) => void;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  newDoc: () => void;
  loadDoc: (doc: DocumentModel) => void;

  setCellDraft: (partial: Partial<CellParams>) => void;
  commitCell: () => void;
  applyPreviewGroup: () => void;
  setSpaceGroup: (id: SpaceGroupId) => void;
  applyBetterHint: () => void;
  dismissBetterHint: (dontAsk?: boolean) => void;
  /** Keep a/b linked under current group (no unlock). */
  resolveCellUnlockKeepLinked: () => void;
  /** Proceed to “keep pattern?” step (will switch to p1). */
  resolveCellUnlockToP1: () => void;
  /** After unlock: bake symmetry images as real strokes, then apply cell + p1. */
  resolveCellUnlockKeepPattern: () => void;
  /** After unlock: drop images, remap masters to new cell, switch to p1. */
  resolveCellUnlockDiscardPattern: () => void;
  dismissCellUnlock: () => void;

  beginStroke: (sample: PointerSample, screen?: { x: number; y: number }) => void;
  extendStroke: (sample: PointerSample, screen?: { x: number; y: number }) => void;
  /** One Zustand write per frame — all coalesced samples. */
  extendStrokeBatch: (
    samples: PointerSample[],
    screen?: { x: number; y: number },
  ) => void;
  endStroke: (sample?: PointerSample) => void;
  setCursorPolarFromCart: (cart: { x: number; y: number } | null) => void;

  deleteSelected: () => void;
  nudgeSelected: (du: number, dv: number) => void;
  copySelected: () => void;
  cutSelected: () => void;
  cloneSelected: () => void;
  pasteClipboard: () => void;
  setContextMenu: (m: { x: number; y: number } | null) => void;
  setPasteOffer: (v: boolean) => void;
};

function cloneDoc(doc: DocumentModel): DocumentModel {
  return structuredClone(doc);
}

/** Switch to p1 with intended cell; optionally bake motif copies first. */
function finishCellUnlock(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  keepPattern: boolean,
) {
  const state = get();
  const prompt = state.cellUnlockPrompt;
  if (!prompt) return;
  get().pushHistory();
  clearEraserCaches();
  clearGroupElementCache();

  let doc = cloneDoc(state.doc);
  const oldCell = doc.cell;
  if (keepPattern) {
    doc = materializeGroupCopies(doc, prompt.fromGroup);
  }
  doc = remapDocumentCell(doc, oldCell, prompt.intendedCell, {
    wrapToPrimary: false,
  });
  doc.spaceGroup = "p1";
  const handles = remapFracHandles(oldCell, prompt.intendedCell, {
    mirrorA: state.mirrorA,
    mirrorB: state.mirrorB,
    mandalaCenter: state.mandalaCenter,
  });
  set({
    doc,
    cellUnlockPrompt: null,
    draggingCell: false,
    previewGroup: null,
    betterHint: null,
    groupLocked: false,
    ...handles,
  });
}

function replaceLayerStrokes(doc: DocumentModel, strokes: VectorStroke[]) {
  return {
    ...doc,
    layers: doc.layers.map((l) =>
      l.id === doc.activeLayerId ? { ...l, strokes } : l,
    ),
  };
}

const defaultView: ViewFlags = {
  showSymCopies: true,
  showOtherFrames: true,
  showMainFrame: true,
  showMainFrameOnly: false,
  showSpecialPoints: true,
  snapSpecial: true,
  snapCurve: true,
  lockR: false,
  lockPhi: false,
};

let betterTimer: ReturnType<typeof setTimeout> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  lang: currentLang(),
  theme: "classic",
  doc: createEmptyDocument(),
  tool: "pen",
  mirrorOn: false,
  mandalaOn: false,
  mandalaN: 6,
  mirrorA: { u: 0, v: -0.2 },
  mirrorB: { u: 0, v: 1.2 },
  mandalaCenter: { u: 0.5, v: 0.5 },
  color: "#1a1a1a",
  lineWidth: 2.5,
  eraserMode: "path",
  eraserSize: 18,
  groupLocked: false,
  previewGroup: null,
  draggingCell: false,
  view: defaultView,
  zoom: 1,
  betterHint: null,
  cellUnlockPrompt: null,
  suppressBetterSession: false,
  lastBetterKey: null,
  lastBetterAt: 0,
  cursorPolar: null,
  cursorCart: null,
  draftStroke: null,
  eraserTrailCart: [],
  selectedIds: [],
  selectRect: null,
  selectLasso: null,
  moveOrigin: null,
  clipboard: null,
  pasteOffer: false,
  contextMenu: null,
  history: [],
  future: [],
  mode: "web",
  draggingHandle: null,

  setLang: (lang) => {
    changeLang(lang);
    set({ lang });
  },
  setTheme: (theme) => set({ theme }),
  setTool: (tool) => {
    const clearSel = tool === "pen" || tool === "eraser" || tool === "line" || tool === "rect" || tool === "ellipse";
    set({
      tool,
      selectRect: null,
      selectLasso: null,
      moveOrigin: null,
      contextMenu: null,
      ...(clearSel ? { selectedIds: [] } : {}),
    });
  },
  toggleMirror: () => {
    const on = !get().mirrorOn;
    set({ mirrorOn: on, mandalaOn: on ? false : get().mandalaOn });
  },
  toggleMandala: () => {
    const on = !get().mandalaOn;
    set({ mandalaOn: on, mirrorOn: on ? false : get().mirrorOn });
  },
  setMandalaN: (mandalaN) => set({ mandalaN: Math.max(2, Math.min(24, Math.round(mandalaN))) }),
  setMirrorA: (mirrorA) => set({ mirrorA }),
  setMirrorB: (mirrorB) => set({ mirrorB }),
  setMandalaCenter: (mandalaCenter) => set({ mandalaCenter }),
  setColor: (color) => set({ color }),
  setLineWidth: (lineWidth) => set({ lineWidth }),
  setEraserMode: (eraserMode) => set({ eraserMode }),
  setEraserSize: (eraserSize) =>
    set({ eraserSize: Math.max(4, Math.min(96, Math.round(eraserSize))) }),
  setGroupLocked: (groupLocked) => set({ groupLocked }),
  setView: (partial) => set({ view: { ...get().view, ...partial } }),
  setZoom: (zoom) => set({ zoom: Math.max(0.25, Math.min(4, zoom)) }),
  zoomBy: (factor) => get().setZoom(get().zoom * factor),
  setMode: (mode) => set({ mode }),
  setSelectedIds: (selectedIds) => set({ selectedIds, contextMenu: null }),
  clearSelection: () => set({ selectedIds: [], contextMenu: null }),
  setDraggingHandle: (draggingHandle) => set({ draggingHandle }),
  setContextMenu: (contextMenu) => set({ contextMenu }),
  setPasteOffer: (pasteOffer) => set({ pasteOffer }),

  pushHistory: () => {
    const { doc, history } = get();
    set({ history: [...history.slice(-79), cloneDoc(doc)], future: [] });
  },

  undo: () => {
    const { history, doc, future } = get();
    if (!history.length) return;
    set({
      history: history.slice(0, -1),
      future: [cloneDoc(doc), ...future],
      doc: history[history.length - 1],
      draftStroke: null,
      selectedIds: [],
    });
  },

  redo: () => {
    const { future, doc, history } = get();
    if (!future.length) return;
    set({
      future: future.slice(1),
      history: [...history, cloneDoc(doc)],
      doc: future[0],
      draftStroke: null,
      selectedIds: [],
    });
  },

  newDoc: () => {
    set({
      doc: createEmptyDocument(),
      draftStroke: null,
      eraserTrailCart: [],
      history: [],
      future: [],
      previewGroup: null,
      betterHint: null,
      tool: "pen",
      mirrorOn: false,
      mandalaOn: false,
      mandalaN: 6,
      mirrorA: { u: 0, v: -0.2 },
      mirrorB: { u: 0, v: 1.2 },
      mandalaCenter: { u: 0.5, v: 0.5 },
      color: "#1a1a1a",
      lineWidth: 2.5,
      eraserMode: "path",
      eraserSize: 18,
      groupLocked: false,
      view: { ...defaultView },
      zoom: 1,
      cursorPolar: null,
      selectedIds: [],
      selectRect: null,
      selectLasso: null,
      moveOrigin: null,
      clipboard: null,
      pasteOffer: false,
      contextMenu: null,
    });
  },

  loadDoc: (doc) => {
    get().pushHistory();
    set({
      doc: doc.version === 2 ? doc : createEmptyDocument(),
      draftStroke: null,
      selectedIds: [],
    });
  },

  setCellDraft: (partial) => {
    const state = get();
    const groupId = state.doc.spaceGroup as SpaceGroupId;
    const oldCell = state.doc.cell;

    // Dialog open: only update the intended target cell
    if (state.cellUnlockPrompt) {
      set({
        cellUnlockPrompt: {
          ...state.cellUnlockPrompt,
          intendedCell: {
            ...state.cellUnlockPrompt.intendedCell,
            ...partial,
          },
        },
      });
      return;
    }

    const def = SPACE_GROUPS[groupId];
    const hard = groupId !== "p1" && groupId !== "p2" && def.matchesHard(oldCell);
    const linkedSides =
      def.lattice === "square" || def.lattice === "hexagonal";

    // Square/hex: a↔b locked. Editing b alone unlocks → p1 flow.
    if (
      hard &&
      linkedSides &&
      partial.b !== undefined &&
      partial.a === undefined &&
      Math.abs(partial.b - oldCell.a) > 1e-3
    ) {
      set({
        cellUnlockPrompt: {
          fromGroup: groupId,
          intendedCell: { ...oldCell, ...partial },
          step: "unlock",
        },
        draggingCell: false,
      });
      return;
    }

    // Linked sides: dragging a also moves b
    let intended = { ...oldCell, ...partial };
    if (hard && linkedSides && partial.a !== undefined && partial.b === undefined) {
      intended = { ...intended, b: partial.a };
    }

    // Breaking θ (or other hard constraints) → unlock flow
    if (hard && breaksGroupConstraint(groupId, intended)) {
      set({
        cellUnlockPrompt: {
          fromGroup: groupId,
          intendedCell: intended,
          step: "unlock",
        },
        draggingCell: false,
      });
      return;
    }

    const newCell = hard ? def.constrain(intended) : intended;
    const doc = remapDocumentCell(cloneDoc(state.doc), oldCell, newCell, {
      wrapToPrimary: false,
    });
    const handles = remapFracHandles(oldCell, newCell, {
      mirrorA: state.mirrorA,
      mirrorB: state.mirrorB,
      mandalaCenter: state.mandalaCenter,
    });
    const preview = inferHardGroup(
      doc.cell,
      doc.spaceGroup as SpaceGroupId,
      state.groupLocked,
    );
    set({
      doc,
      draggingCell: true,
      previewGroup: preview,
      ...handles,
    });
  },

  commitCell: () => {
    const state = get();
    // Do not wrap/rewrite strokes on release — that was breaking polylines.
    const preview = inferHardGroup(
      state.doc.cell,
      state.doc.spaceGroup as SpaceGroupId,
      state.groupLocked,
    );
    set({
      draggingCell: false,
      previewGroup: preview,
    });
    if (betterTimer) clearTimeout(betterTimer);
    betterTimer = setTimeout(() => {
      const s = get();
      if (s.suppressBetterSession) return;
      const hint = detectBetterCell(s.doc.cell, s.doc.spaceGroup as SpaceGroupId);
      if (!hint) return;
      const key = `${hint.reasonKey}:${hint.targetGroup}:${hint.suggested.a.toFixed(1)}`;
      const now = Date.now();
      if (s.lastBetterKey === key && now - s.lastBetterAt < 60_000) return;
      set({ betterHint: hint, lastBetterKey: key, lastBetterAt: now });
    }, 400);
  },

  /** Explicitly apply the suggested space group from preview. */
  applyPreviewGroup: () => {
    const state = get();
    if (!state.previewGroup) return;
    get().setSpaceGroup(state.previewGroup);
  },

  /**
   * Switch wallpaper group without touching stroke objects.
   * 1) Stretch cell a/b/θ to the new group's default (frac coords stay put → continuous stretch)
   * 2) Change spaceGroup id only
   * Remapping/wrapping strokes here was what produced broken polylines / bogus straight segments.
   */
  setSpaceGroup: (id) => {
    get().pushHistory();
    clearEraserCaches();
    clearGroupElementCache();
    const state = get();
    const doc = cloneDoc(state.doc);
    // Stretch lattice to the new group's default a/b/θ; never rewrite stroke points.
    doc.cell = SPACE_GROUPS[id].constrain(doc.cell);
    doc.spaceGroup = id;
    set({ doc, previewGroup: null });
  },

  applyBetterHint: () => {
    const hint = get().betterHint;
    if (!hint) return;
    get().pushHistory();
    clearEraserCaches();
    clearGroupElementCache();
    const doc = cloneDoc(get().doc);
    // Same rule: stretch cell + switch group; never rewrite stroke points
    doc.cell = hint.suggested;
    doc.spaceGroup = hint.targetGroup;
    set({ doc, betterHint: null, previewGroup: null });
  },

  dismissBetterHint: (dontAsk) => {
    set({
      betterHint: null,
      suppressBetterSession: dontAsk ? true : get().suppressBetterSession,
    });
  },

  resolveCellUnlockKeepLinked: () => {
    const state = get();
    const prompt = state.cellUnlockPrompt;
    if (!prompt) return;
    const oldCell = state.doc.cell;
    const def = SPACE_GROUPS[prompt.fromGroup];
    const linkedSides =
      def.lattice === "square" || def.lattice === "hexagonal";
    // Prefer the side the user dragged when re-locking a=b
    let target = prompt.intendedCell;
    if (linkedSides && Math.abs(target.b - oldCell.b) > Math.abs(target.a - oldCell.a)) {
      target = { ...target, a: target.b, b: target.b };
    } else if (linkedSides) {
      target = { ...target, a: target.a, b: target.a };
    }
    const newCell = def.constrain(target);
    const doc = remapDocumentCell(cloneDoc(state.doc), oldCell, newCell, {
      wrapToPrimary: false,
    });
    const handles = remapFracHandles(oldCell, newCell, {
      mirrorA: state.mirrorA,
      mirrorB: state.mirrorB,
      mandalaCenter: state.mandalaCenter,
    });
    set({
      doc,
      cellUnlockPrompt: null,
      draggingCell: false,
      previewGroup: inferHardGroup(
        doc.cell,
        doc.spaceGroup as SpaceGroupId,
        state.groupLocked,
      ),
      ...handles,
    });
  },

  resolveCellUnlockToP1: () => {
    const prompt = get().cellUnlockPrompt;
    if (!prompt) return;
    set({
      cellUnlockPrompt: { ...prompt, step: "keepPattern" },
    });
  },

  resolveCellUnlockKeepPattern: () => {
    finishCellUnlock(get, set, true);
  },

  resolveCellUnlockDiscardPattern: () => {
    finishCellUnlock(get, set, false);
  },

  dismissCellUnlock: () => {
    set({ cellUnlockPrompt: null, draggingCell: false });
  },

  setCursorPolarFromCart: (cart) => {
    set({
      cursorPolar: cart ? cartToPolar(cart) : null,
      cursorCart: cart ? { x: cart.x, y: cart.y } : null,
    });
  },

  beginStroke: (sample, screen) => {
    const state = get();
    const {
      tool,
      color,
      lineWidth,
      view,
      doc,
      eraserMode,
      eraserSize,
      draggingHandle,
    } = state;
    const cell = doc.cell;
    const groupId = doc.spaceGroup as SpaceGroupId;
    let pos = { x: sample.x, y: sample.y };
    const pressure = normalizePressure(sample.pressure);

    if (draggingHandle) return;

    if (
      (view.snapCurve || tool === "line" || tool === "rect" || tool === "ellipse") &&
      tool !== "eraser" &&
      tool !== "move" &&
      tool !== "pen"
    ) {
      const snapped = snapToStrokeGeometry(cell, pos, doc, 12);
      if (snapped) pos = snapped;
    }
    // pen: only optional special-point snap at start (handled in canvas)

    // Stroke start defines the (r,φ) anchor; locks apply on subsequent points only

    const frac = cartRelToFrac(cell, pos, pressure);

    if (tool === "selectBox" && screen) {
      set({
        selectRect: { x0: screen.x, y0: screen.y, x1: screen.x, y1: screen.y },
        selectLasso: null,
      });
      return;
    }
    if (tool === "selectLasso" && screen) {
      set({ selectLasso: [screen], selectRect: null });
      return;
    }
    if (tool === "move") {
      set({ moveOrigin: { x: sample.x, y: sample.y } });
      get().pushHistory();
      return;
    }

    if (tool === "eraser") {
      get().pushHistory();
      const next = cloneDoc(doc);
      const size = eraserSize;
      if (eraserMode === "stroke") {
        const hit = eraseWholeStrokeAt(next, cell, pos, size, groupId);
        set({
          ...(hit ? { doc: next } : {}),
          eraserTrailCart: [],
          draftStroke: null,
          cursorPolar: cartToPolar(pos),
          cursorCart: pos,
          selectedIds: [],
        });
        return;
      }
      eraseNearTip(next, cell, pos, null, size, groupId);
      set({
        doc: next,
        eraserTrailCart: [pos],
        draftStroke: null,
        cursorPolar: cartToPolar(pos),
        cursorCart: pos,
        selectedIds: [],
      });
      return;
    }

    const kind =
      tool === "line"
        ? "line"
        : tool === "rect"
          ? "rect"
          : tool === "ellipse"
            ? "ellipse"
            : "path";

    get().pushHistory();
    set({
      draftStroke: {
        id: uid(),
        kind,
        points: kind === "path" ? [frac] : [frac, frac],
        style: { color, width: lineWidth, opacity: 1 },
      },
      eraserTrailCart: [],
      cursorPolar: cartToPolar(pos),
      selectedIds: [],
    });
  },

  extendStroke: (sample, screen) => {
    const state = get();
    const {
      tool,
      view,
      doc,
      eraserMode,
      eraserTrailCart,
      draftStroke,
      lineWidth,
      eraserSize,
      selectRect,
      selectLasso,
      moveOrigin,
      selectedIds,
      draggingHandle,
    } = state;
    const cell = doc.cell;
    const groupId = doc.spaceGroup as SpaceGroupId;
    let pos = { x: sample.x, y: sample.y };
    const pressure = normalizePressure(sample.pressure);

    if (draggingHandle === "mirrorA" || draggingHandle === "mirrorB" || draggingHandle === "mandala") {
      let p = pos;
      if (view.snapSpecial) {
        const snapped = snapCartToSpecial(cell, groupId, pos, 14);
        if (snapped) p = snapped;
      }
      const fracH = cartRelToFrac(cell, p);
      if (draggingHandle === "mirrorA") {
        set({ mirrorA: fracH, cursorPolar: cartToPolar(p), cursorCart: p });
      } else if (draggingHandle === "mirrorB") {
        set({ mirrorB: fracH, cursorPolar: cartToPolar(p), cursorCart: p });
      } else {
        set({ mandalaCenter: fracH, cursorPolar: cartToPolar(p), cursorCart: p });
      }
      return;
    }

    if (
      (tool === "line" || tool === "rect" || tool === "ellipse") &&
      (view.snapCurve || view.snapSpecial)
    ) {
      const snapped = snapToStrokeGeometry(cell, pos, doc, 12);
      if (snapped) pos = snapped;
    }

    if (view.lockR || view.lockPhi) {
      const polar = cartToPolar(pos);
      const anchor = draftStroke
        ? fracToPolar(cell, draftStroke.points[0])
        : state.cursorPolar;
      if (anchor) {
        const r = view.lockR ? anchor.r : polar.r;
        const phi = view.lockPhi ? anchor.phi : polar.phi;
        pos = { x: r * Math.cos(phi), y: r * Math.sin(phi) };
      }
    }

    const frac = cartRelToFrac(cell, pos, pressure);

    if (tool === "selectBox" && selectRect && screen) {
      set({ selectRect: { ...selectRect, x1: screen.x, y1: screen.y } });
      return;
    }
    if (tool === "selectLasso" && selectLasso && screen) {
      set({ selectLasso: [...selectLasso, screen] });
      return;
    }
    if (tool === "move" && moveOrigin && selectedIds.length) {
      const dx = sample.x - moveOrigin.x;
      const dy = sample.y - moveOrigin.y;
      const base = state.history[state.history.length - 1];
      if (base) {
        const next = cloneDoc(base);
        const layer = next.layers.find((l) => l.id === next.activeLayerId);
        if (layer) {
          const f0 = cartRelToFrac(cell, { x: 0, y: 0 });
          const f1 = cartRelToFrac(cell, { x: dx, y: dy });
          const du = f1.u - f0.u;
          const dv = f1.v - f0.v;
          const idSet = new Set(selectedIds);
          for (const s of layer.strokes) {
            if (!idSet.has(s.id)) continue;
            s.points = s.points.map((p) => ({ ...p, u: p.u + du, v: p.v + dv }));
          }
        }
        set({ doc: next, cursorPolar: cartToPolar(pos) });
      }
      return;
    }

    if (tool === "eraser") {
      if (eraserMode === "stroke") {
        set({ cursorPolar: cartToPolar(pos), cursorCart: pos });
        return;
      }
      const prev = eraserTrailCart.length
        ? eraserTrailCart[eraserTrailCart.length - 1]
        : null;
      const next = cloneDoc(doc);
      const changed = eraseNearTip(next, cell, pos, prev, eraserSize, groupId);
      const trail =
        eraserTrailCart.length > 48
          ? [...eraserTrailCart.slice(-32), pos]
          : [...eraserTrailCart, pos];
      if (changed) {
        set({
          doc: next,
          eraserTrailCart: trail,
          cursorPolar: cartToPolar(pos),
          cursorCart: pos,
        });
      } else {
        set({
          eraserTrailCart: trail,
          cursorPolar: cartToPolar(pos),
          cursorCart: pos,
        });
      }
      return;
    }

    if (!draftStroke) return;

    if (draftStroke.kind === "path") {
      const last = draftStroke.points[draftStroke.points.length - 1];
      const lastC = fracToCartRel(cell, last);
      const dist = Math.hypot(lastC.x - pos.x, lastC.y - pos.y);
      // denser sampling for smooth freehand (sub-pixel ok when coalesced)
      if (dist < 0.4) {
        const pts = draftStroke.points.slice();
        pts[pts.length - 1] = { ...last, pressure };
        set({
          draftStroke: { ...draftStroke, points: pts },
          cursorPolar: cartToPolar(pos),
          cursorCart: pos,
        });
        return;
      }
      set({
        draftStroke: { ...draftStroke, points: [...draftStroke.points, frac] },
        cursorPolar: cartToPolar(pos),
        cursorCart: pos,
      });
      return;
    }

    set({
      draftStroke: { ...draftStroke, points: [draftStroke.points[0], frac] },
      cursorPolar: cartToPolar(pos),
      cursorCart: pos,
    });
  },

  extendStrokeBatch: (samples, screen) => {
    if (!samples.length) return;
    const state = get();
    // Handles / eraser / select: process sequentially (rare, few samples)
    if (
      state.draggingHandle ||
      state.tool === "eraser" ||
      state.tool === "selectBox" ||
      state.tool === "selectLasso" ||
      state.tool === "move"
    ) {
      for (const s of samples) get().extendStroke(s, screen);
      return;
    }
    // Pen / shapes: one Zustand write — critical for pressure & <10ms latency
    const { draftStroke, doc, view, lineWidth } = state;
    if (!draftStroke) {
      get().extendStroke(samples[samples.length - 1], screen);
      return;
    }
    const cell = doc.cell;
    const lastSample = samples[samples.length - 1];
    let pos = { x: lastSample.x, y: lastSample.y };

    if (
      (state.tool === "line" || state.tool === "rect" || state.tool === "ellipse") &&
      (view.snapCurve || view.snapSpecial)
    ) {
      const snapped = snapToStrokeGeometry(cell, pos, doc, 12);
      if (snapped) pos = snapped;
    }

    const anchorPolar = fracToPolar(cell, draftStroke.points[0]);
    const applyLock = (p: { x: number; y: number }) => {
      if (!(view.lockR || view.lockPhi)) return p;
      const polar = cartToPolar(p);
      const r = view.lockR ? anchorPolar.r : polar.r;
      const phi = view.lockPhi ? anchorPolar.phi : polar.phi;
      return { x: r * Math.cos(phi), y: r * Math.sin(phi) };
    };
    pos = applyLock(pos);

    if (draftStroke.kind !== "path") {
      const frac = cartRelToFrac(cell, pos, normalizePressure(lastSample.pressure));
      set({
        draftStroke: { ...draftStroke, points: [draftStroke.points[0], frac] },
        cursorPolar: cartToPolar(pos),
        cursorCart: pos,
      });
      return;
    }

    const pts = draftStroke.points.slice();
    let last = pts[pts.length - 1];
    let lastC = fracToCartRel(cell, last);
    for (const s of samples) {
      const pr = normalizePressure(s.pressure);
      const cur = applyLock({ x: s.x, y: s.y });
      const dist = Math.hypot(lastC.x - cur.x, lastC.y - cur.y);
      if (dist < 0.35) {
        last = { ...last, pressure: pr };
        pts[pts.length - 1] = last;
      } else {
        last = cartRelToFrac(cell, cur, pr);
        lastC = cur;
        pts.push(last);
      }
    }
    // Cap runaway density (tablet floods)
    const capped =
      pts.length > 4000 ? [pts[0], ...pts.slice(pts.length - 3999)] : pts;
    void lineWidth;
    set({
      draftStroke: { ...draftStroke, points: capped },
      cursorPolar: cartToPolar(pos),
      cursorCart: pos,
    });
  },

  endStroke: (sample) => {
    const state = get();
    const {
      tool,
      draftStroke,
      doc,
      view,
      mirrorOn,
      mandalaOn,
      mandalaN,
      mirrorA,
      mirrorB,
      mandalaCenter,
      selectRect,
      selectLasso,
      draggingHandle,
    } = state;
    const cell = doc.cell;

    if (draggingHandle) {
      set({ draggingHandle: null });
      return;
    }

    if (tool === "selectBox" && selectRect) {
      set({ selectRect: null, moveOrigin: null });
      return;
    }
    if (tool === "selectLasso" && selectLasso) {
      set({ selectLasso: null, moveOrigin: null });
      return;
    }
    if (tool === "move") {
      set({ moveOrigin: null });
      return;
    }
    if (tool === "eraser") {
      set({ eraserTrailCart: [] });
      return;
    }
    if (!draftStroke) return;

    let stroke = draftStroke;
    if (
      sample &&
      (stroke.kind === "line" || stroke.kind === "rect" || stroke.kind === "ellipse")
    ) {
      let pos = { x: sample.x, y: sample.y };
      if (view.snapCurve || view.snapSpecial) {
        const snapped = snapToStrokeGeometry(cell, pos, doc, 12);
        if (snapped) pos = snapped;
      }
      stroke = {
        ...stroke,
        points: [
          stroke.points[0],
          cartRelToFrac(cell, pos, normalizePressure(sample.pressure)),
        ],
      };
    }

    const next = cloneDoc(doc);
    const layer = next.layers.find((l) => l.id === next.activeLayerId);
    if (layer && !layer.locked) {
      const variants = applyModifiers(
        cell,
        stroke.points,
        mirrorOn,
        mirrorA,
        mirrorB,
        mandalaOn,
        mandalaCenter,
        mandalaN,
      );
      for (const points of variants) {
        layer.strokes.push({ ...stroke, id: uid(), points });
      }
    }
    set({ doc: next, draftStroke: null });
  },

  deleteSelected: () => {
    const { doc, selectedIds } = get();
    if (!selectedIds.length) return;
    get().pushHistory();
    const idSet = new Set(selectedIds);
    const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
    if (!layer) return;
    const strokes = layer.strokes.filter((s) => !idSet.has(s.id));
    set({ doc: replaceLayerStrokes(doc, strokes), selectedIds: [], contextMenu: null });
  },

  nudgeSelected: (du, dv) => {
    const { doc, selectedIds } = get();
    if (!selectedIds.length) return;
    get().pushHistory();
    const idSet = new Set(selectedIds);
    const next = cloneDoc(doc);
    const layer = next.layers.find((l) => l.id === next.activeLayerId);
    if (!layer) return;
    for (const s of layer.strokes) {
      if (!idSet.has(s.id)) continue;
      s.points = s.points.map((p) => ({ ...p, u: p.u + du, v: p.v + dv }));
    }
    set({ doc: next });
  },

  copySelected: () => {
    const { doc, selectedIds } = get();
    const idSet = new Set(selectedIds);
    const layer = doc.layers.find((l) => l.id === doc.activeLayerId);
    if (!layer) return;
    const clips = layer.strokes
      .filter((s) => idSet.has(s.id))
      .map((s) => structuredClone(s));
    if (!clips.length) return;
    set({ clipboard: clips, pasteOffer: true, contextMenu: null });
  },

  cutSelected: () => {
    get().copySelected();
    get().deleteSelected();
    set({ pasteOffer: true });
  },

  cloneSelected: () => {
    const { doc, selectedIds } = get();
    if (!selectedIds.length) return;
    get().pushHistory();
    const idSet = new Set(selectedIds);
    const next = cloneDoc(doc);
    const layer = next.layers.find((l) => l.id === next.activeLayerId);
    if (!layer) return;
    const newIds: string[] = [];
    for (const s of [...layer.strokes]) {
      if (!idSet.has(s.id)) continue;
      const c = structuredClone(s);
      c.id = uid();
      c.points = c.points.map((p) => ({ ...p, u: p.u + 0.05, v: p.v + 0.05 }));
      layer.strokes.push(c);
      newIds.push(c.id);
    }
    set({ doc: next, selectedIds: newIds, contextMenu: null });
  },

  pasteClipboard: () => {
    const { doc, clipboard } = get();
    if (!clipboard?.length) return;
    get().pushHistory();
    const next = cloneDoc(doc);
    const layer = next.layers.find((l) => l.id === next.activeLayerId);
    if (!layer) return;
    const newIds: string[] = [];
    for (const s of clipboard) {
      const c = structuredClone(s);
      c.id = uid();
      c.points = c.points.map((p) => ({ ...p, u: p.u + 0.08, v: p.v + 0.08 }));
      layer.strokes.push(c);
      newIds.push(c.id);
    }
    set({
      doc: next,
      selectedIds: newIds,
      pasteOffer: false,
      contextMenu: null,
      tool: "move",
    });
  },
}));
