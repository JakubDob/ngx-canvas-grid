import { InjectionToken } from "@angular/core";

export type RenderTextParams = {
  text: string;
  font: string;
  color: string;
  cellRect: Rect;
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

export type CanvasGridCellRenderParams = {
  context: CanvasRenderingContext2D;
  renderTextFn: (params: RenderTextParams) => void;
  cellIndex: number;
  cellRect: Rect;
  deltaTime: number;
  elapsedTime: number;
};

export type GridDragEvent = {
  buttonId: number;
  from: number;
  to: number;
};

export type GridDropEvent = {
  buttonId: number;
  from: number;
  to: number;
};

export type GridClickEvent = {
  buttonId: number;
  cellIndex: number;
};

export type CanvasGridCellRenderFn = (
  params: CanvasGridCellRenderParams
) => void;

export type CanvasGridDefaultOptions = {
  cellWidth?: number;
  cellHeight?: number;
  rows?: number;
  cols?: number;
  spacing?: number;
  fpsThrottle?: number;
};

export const CANVAS_GRID_DEFAULT_OPTIONS =
  new InjectionToken<CanvasGridDefaultOptions>("CANVAS_GRID_DEFAULT_OPTIONS");
