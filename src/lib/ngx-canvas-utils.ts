import { CanvasGridState, PixelRect } from "./ngx-canvas-grid.types";

export function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  fillStyle: string,
  rect: PixelRect
) {
  context.textAlign = "center";
  context.font = font;
  context.fillStyle = fillStyle;
  const cellCenterX = rect.x + rect.w / 2;
  const cellCenterY = rect.y + rect.h / 2;
  const metrics = context.measureText(text);
  const textHeight =
    metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  context.fillText(
    text,
    Math.floor(cellCenterX),
    Math.floor(cellCenterY + textHeight / 2)
  );
}

export type StrokeStyleFn = (rowOrColIndex: number) => string | null;

export function drawRowLines(
  state: CanvasGridState,
  context: CanvasRenderingContext2D,
  styleFn: StrokeStyleFn
) {
  if (state.rowCount() > 0) {
    const rowGaps = state.rowGaps();
    for (let i = 0; i < state.rowCount() + 1; ++i) {
      const strokeStyle = styleFn(i);
      if (rowGaps[i].value === 0 || !strokeStyle) {
        continue;
      }
      context.strokeStyle = strokeStyle;
      context.lineWidth = rowGaps[i].value;
      context.beginPath();
      const currentY =
        rowGaps[i].prefixSum - rowGaps[i].value / 2 + state.cellHeight() * i;

      context.moveTo(0, currentY);
      context.lineTo(state.canvasWidth(), currentY);
      context.stroke();
    }
  }
}

export function drawColLines(
  state: CanvasGridState,
  context: CanvasRenderingContext2D,
  styleFn: StrokeStyleFn
) {
  if (state.colCount() > 0) {
    const colGaps = state.colGaps();
    for (let i = 0; i < state.colCount() + 1; ++i) {
      const strokeStyle = styleFn(i);
      if (colGaps[i].value === 0 || !strokeStyle) {
        continue;
      }
      context.strokeStyle = strokeStyle;
      context.lineWidth = colGaps[i].value;
      context.beginPath();
      const currentX =
        colGaps[i].prefixSum - colGaps[i].value / 2 + state.cellWidth() * i;

      context.moveTo(currentX, 0);
      context.lineTo(currentX, state.canvasHeight());
      context.stroke();
    }
  }
}
