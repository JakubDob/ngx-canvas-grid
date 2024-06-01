import { effect, Signal } from '@angular/core';
import {
  CanvasGridDragEvent,
  CanvasGridDropEvent,
  CanvasGridState,
  GridCell,
  PixelPos,
} from '@jakubdob/ngx-canvas-grid';

export class DragAndDropEffect {
  private shouldUpdate = true;
  private shouldCleanup = false;
  private from: PixelPos = { x: 0, y: 0 };
  private to: PixelPos = { x: 0, y: 0 };
  private fromCell: GridCell | null = null;
  private toCell: GridCell | null = null;
  constructor(
    dragEvent: Signal<CanvasGridDragEvent | null>,
    dropEvent: Signal<CanvasGridDropEvent | null>
  ) {
    effect(() => {
      const drag = dragEvent();
      if (drag) {
        this.from = drag.fromPixels;
        this.to = drag.pointerPos;
        if (drag.from.type === 'cell') {
          this.fromCell = drag.from;
        } else {
          this.fromCell = null;
        }
        if (drag.to.type === 'cell') {
          this.toCell = drag.to;
        } else {
          this.toCell = null;
        }
        this.shouldUpdate = true;
      }
    });

    effect(() => {
      if (dropEvent()) {
        this.shouldUpdate = false;
        this.shouldCleanup = true;
      }
    });
  }
  update(ctx: CanvasRenderingContext2D, state: CanvasGridState) {
    if (this.shouldUpdate) {
      ctx.clearRect(0, 0, state.canvasWidth(), state.canvasHeight());
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.from.x, this.from.y);
      ctx.lineTo(this.to.x, this.to.y);
      ctx.stroke();
      if (this.toCell) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
        ctx.fillRect(
          this.toCell.x,
          this.toCell.y,
          this.toCell.w,
          this.toCell.h
        );
      }
      if (this.fromCell) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(
          this.fromCell.x,
          this.fromCell.y,
          this.fromCell.w,
          this.fromCell.h
        );
      }
    } else if (this.shouldCleanup) {
      ctx.clearRect(0, 0, state.canvasWidth(), state.canvasHeight());
      this.shouldCleanup = false;
    }
  }
}
