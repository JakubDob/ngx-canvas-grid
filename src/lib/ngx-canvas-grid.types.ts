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
  from: number;
  to: number;
  x: number;
  y: number;
};

export type CanvasGridDropEvent = {
  buttonId: number;
  from: number;
  to: number;
  x: number;
  y: number;
};

export type CanvasGridClickEvent = {
  buttonId: number;
  cellIndex: number;
  x: number;
  y: number;
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

export type CanvasGridCellFn = {
  type: "cell";
  drawFn: CanvasGridCellDrawFn;
};

export type CanvasGridLayerFn = {
  type: "layer";
  drawFn: CanvasGridLayerDrawFn;
};

export type CanvasGridDrawFn = CanvasGridCellFn | CanvasGridLayerFn;

export enum CanvasGridLayerDrawStrategy {
  STATIC,
  PER_FRAME,
}

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
