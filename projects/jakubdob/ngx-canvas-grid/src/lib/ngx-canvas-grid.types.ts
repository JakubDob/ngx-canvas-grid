import { InjectionToken, Signal, WritableSignal } from '@angular/core';

export const CellType = 'cell';
export const GapType = 'gap';
export const GapPairType = 'gap_pair';

export type CanvasGridState = {
  rowGaps: Signal<GridGap[]>;
  colGaps: Signal<GridGap[]>;
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
};

export type PixelPos = {
  x: number;
  y: number;
};

export type GridPos = {
  row: number;
  col: number;
};

export type PixelExtent = {
  w: number;
  h: number;
};

export type PixelRect = PixelPos & PixelExtent;

export type GridCell = {
  type: typeof CellType;
  index: number;
} & PixelRect &
  GridPos;

export type GridGap = {
  type: typeof GapType;
  value: number;
  prefixSum: number;
} & PixelPos &
  GridPos;

export type GridGapPair = {
  type: typeof GapPairType;
  rowGap: GridGap;
  colGap: GridGap;
};

export type CanvasGridElement = GridCell | GridGap | GridGapPair;

export type CanvasGridMoveEvent = {
  browserEvent: PointerEvent;
  target: CanvasGridElement;
  pointerPos: PixelPos;
};

export type CanvasGridDragEvent = {
  browserEvent: PointerEvent;
  from: CanvasGridElement;
  fromPixels: PixelPos;
  to: CanvasGridElement;
  pointerPos: PixelPos;
};

export type CanvasGridDropEvent = {
  browserEvent: PointerEvent;
  from: CanvasGridElement;
  to: CanvasGridElement;
  pointerPos: PixelPos;
};

export type CanvasGridDoubleClickEvent = {
  browserEvent: MouseEvent;
  target: CanvasGridElement;
  pointerPos: PixelPos;
};

export type CanvasGridClickEvent = {
  browserEvent: PointerEvent;
  target: CanvasGridElement;
  pointerPos: PixelPos;
};

export type CanvasGridContextMenuEvent = {
  browserEvent: MouseEvent;
  target: CanvasGridElement;
  pointerPos: PixelPos;
};

export type CanvasGridCellDrawFn = (
  context: CanvasRenderingContext2D,
  cell: GridCell,
  state: CanvasGridState,
  layerIndex: number
) => void;

export type CanvasGridLayerDrawFn = (
  context: CanvasRenderingContext2D,
  state: CanvasGridState,
  layerIndex: number
) => void;

export const PerCellDrawType = 'per_cell';
export const WholeCanvasDrawType = 'whole_canvas';

export type CanvasGridCellFn = {
  type: typeof PerCellDrawType;
  drawFn: CanvasGridCellDrawFn;
};

export type CanvasGridLayerFn = {
  type: typeof WholeCanvasDrawType;
  drawFn: CanvasGridLayerDrawFn;
};

export type CanvasGridDrawFn = CanvasGridCellFn | CanvasGridLayerFn;

export type GridLayerState = {
  singleFrameCellIndices: Set<number>;
  multiFrameCellIndices: Set<number>;
  singleFrameCellGridPos: GridPos[];
  multiFrameCellGridPos: GridPos[];
  delMultiFrameCellGridPos: GridPos[];
  redrawAll: boolean;
  redrawPerFrame: boolean;
  hidden: WritableSignal<boolean>;
  drawFn: CanvasGridDrawFn;
};

export type CanvasGridGapSizeFn = (rowOrColGapIndex: number) => number;

export type CanvasGridGapSizeFns = {
  rowFn: CanvasGridGapSizeFn;
  colFn: CanvasGridGapSizeFn;
};

export type CanvasGridGapSizeType = number | CanvasGridGapSizeFns;

export type CanvasGridDefaultOptions = {
  cellWidth?: number;
  cellHeight?: number;
  rows?: number;
  cols?: number;
  gapSize?: number;
  fpsThrottle?: number;
};

export const CANVAS_GRID_DEFAULT_OPTIONS =
  new InjectionToken<CanvasGridDefaultOptions>('CANVAS_GRID_DEFAULT_OPTIONS');
