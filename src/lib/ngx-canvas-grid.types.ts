import { InjectionToken, Signal } from "@angular/core";

export type CanvasGridState = {
  gapSize: Signal<number>;
  canvasWidth: Signal<number>;
  canvasHeight: Signal<number>;
  cellWidth: Signal<number>;
  cellHeight: Signal<number>;
  cells: Signal<Readonly<GridCell[]>>;
  rowCount: Signal<number>;
  colCount: Signal<number>;
  layerCount: Signal<number>;
  deltaTime: Signal<number>;
  elapsedTime: Signal<number>;
  draggingButtonId: Signal<number | null>;
};

export type GridCell = {
  x: number;
  y: number;
  w: number;
  h: number;
  row: number;
  col: number;
  index: number;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Extent = {
  w: number;
  h: number;
};

export type CanvasGridDragEvent = {
  buttonId: number;
  from: GridCell;
  to: GridCell;
};

export type CanvasGridDropEvent = {
  buttonId: number;
  from: GridCell;
  to: GridCell;
};

export type CanvasGridClickEvent = {
  buttonId: number;
  cell: GridCell;
};

export type CanvasGridCellDrawFn = (
  state: CanvasGridState,
  context: CanvasRenderingContext2D,
  cell: GridCell
) => void;

export type CanvasGridLayerDrawFn = (
  state: CanvasGridState,
  context: CanvasRenderingContext2D
) => void;

export const PerCellDrawType = "per_cell";
export const WholeCanvasDrawType = "whole_canvas";

export type CanvasGridCellFn = {
  type: typeof PerCellDrawType;
  drawFn: CanvasGridCellDrawFn;
};

export type CanvasGridLayerFn = {
  type: typeof WholeCanvasDrawType;
  drawFn: CanvasGridLayerDrawFn;
};

export type CanvasGridDrawFn = CanvasGridCellFn | CanvasGridLayerFn;

export enum CanvasGridLayerDrawStrategy {
  STATIC,
  PER_FRAME,
}

export type GridLayerState = {
  singleFrameCellIndices: Set<number>;
  multiFrameCellIndices: Set<number>;
  drawStrategy: CanvasGridLayerDrawStrategy;
  redrawAll: boolean;
  drawFn: CanvasGridDrawFn;
};

export type CanvasGridDefaultOptions = {
  cellWidth?: number;
  cellHeight?: number;
  rows?: number;
  cols?: number;
  gapSize?: number;
  fpsThrottle?: number;
  layerCount?: number;
};

export const CANVAS_GRID_DEFAULT_OPTIONS =
  new InjectionToken<CanvasGridDefaultOptions>("CANVAS_GRID_DEFAULT_OPTIONS");
