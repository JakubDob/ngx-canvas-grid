import { CanvasGridState, Rect } from "./ngx-canvas-grid.types";

export function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  font: string,
  fillStyle: string,
  rect: Rect
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

export function drawGridLines(
  state: CanvasGridState,
  context: CanvasRenderingContext2D,
  strokeStyle: string,
  rowOffset: number = 3,
  colOffset: number = 3
) {
  if (state.gapSize() < 1) {
    return;
  }
  context.strokeStyle = strokeStyle;
  context.lineWidth = state.gapSize();
  context.beginPath();
  const halfGap = state.gapSize() / 2;
  if (state.rowCount() > 1) {
    const yOffset = state.cellHeight() + halfGap;
    let currentY = yOffset;
    for (let row = 1; row < state.rowCount(); ++row) {
      if (row % rowOffset === 0) {
        context.moveTo(0, currentY);
        context.lineTo(state.canvasWidth(), currentY);
      }
      currentY += yOffset + halfGap;
    }
  }
  if (state.colCount() > 1) {
    const xOffset = state.cellWidth() + halfGap;
    let currentX = xOffset;
    for (let col = 1; col < state.colCount(); ++col) {
      if (col % colOffset === 0) {
        context.moveTo(currentX, 0);
        context.lineTo(currentX, state.canvasHeight());
      }
      currentX += xOffset + halfGap;
    }
  }
  context.stroke();
}
