import { InjectionToken, Signal } from "@angular/core";

export type CanvasGridState = {
  readonly gapSize: Signal<number>;
  readonly canvasWidth: Signal<number>;
  readonly canvasHeight: Signal<number>;
  readonly cellWidth: Signal<number>;
  readonly cellHeight: Signal<number>;
  readonly rowCount: Signal<number>;
  readonly colCount: Signal<number>;
  readonly layerCount: Signal<number>;
  readonly deltaTime: Signal<number>;
  readonly elapsedTime: Signal<number>;
  readonly draggingButtonId: Signal<number | null>;
};

export type Rect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Point2D = {
  x: number;
  y: number;
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
  cellIndex: number,
  cellRect: Rect
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
