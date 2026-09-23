export type ToolId =
  | "selectBox"
  | "selectLasso"
  | "move"
  | "pen"
  | "eraser"
  | "line"
  | "rect"
  | "ellipse";

export type EraserMode = "stroke" | "path";

/** Fractional coordinates in the current unit cell — stretch with a/b/θ. */
export type FracPoint = { u: number; v: number; pressure?: number };

export type StrokeStyle = {
  color: string;
  width: number;
  opacity: number;
};

export type StrokeKind = "path" | "line" | "rect" | "ellipse";

/** One stroke = one object. Eraser may split into multiple objects. */
export type VectorStroke = {
  id: string;
  kind: StrokeKind;
  points: FracPoint[];
  style: StrokeStyle;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  strokes: VectorStroke[];
};

export type DocumentModel = {
  version: 2;
  cell: { a: number; b: number; thetaDeg: number };
  spaceGroup: string;
  layers: Layer[];
  activeLayerId: string;
};

export function createEmptyDocument(): DocumentModel {
  const layerId = crypto.randomUUID();
  return {
    version: 2,
    cell: { a: 120, b: 120, thetaDeg: 90 },
    spaceGroup: "p1",
    layers: [
      {
        id: layerId,
        name: "Layer 1",
        visible: true,
        locked: false,
        opacity: 1,
        strokes: [],
      },
    ],
    activeLayerId: layerId,
  };
}

export function uid(): string {
  return crypto.randomUUID();
}
