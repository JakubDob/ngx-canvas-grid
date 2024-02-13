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
  from: number;
  to: number;
};

export type GridClickEvent = {
  index: number;
  buttonId: number;
};

export type CanvasGridCellRenderFn = (
  params: CanvasGridCellRenderParams
) => void;
