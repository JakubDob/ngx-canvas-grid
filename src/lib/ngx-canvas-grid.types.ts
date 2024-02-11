export interface RenderTextParams {
  text: string;
  font: string;
  color: string;
  cellRect: Rect;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CanvasGridCellRenderParams {
  context: CanvasRenderingContext2D;
  renderTextFn: (params: RenderTextParams) => void;
  cellIndex: number;
  cellRect: Rect;
  deltaTime: number;
  elapsedTime: number;
}

export interface GridDragEvent {
  from: number;
  to: number;
}

export interface GridClickEvent {
  index: number;
  buttonId: number;
}

export type CanvasGridCellRenderFn = (
  params: CanvasGridCellRenderParams
) => void;
