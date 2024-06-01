import { effect, Signal } from '@angular/core';
import {
  CanvasGridMoveEvent,
  CanvasGridState,
  PixelPos,
} from '@jakubdob/ngx-canvas-grid';

export class ShadowEffect {
  private mouseIn = false;
  private pos: PixelPos = { x: 0, y: 0 };
  private lightRadius = 80;
  constructor(moveEvent: Signal<CanvasGridMoveEvent | null>) {
    effect(() => {
      const ev = moveEvent();
      if (ev) {
        this.pos = ev.pointerPos;
        this.mouseIn = true;
      } else {
        this.mouseIn = false;
      }
    });
  }
  update(ctx: CanvasRenderingContext2D, state: CanvasGridState) {
    ctx.clearRect(0, 0, state.canvasWidth(), state.canvasHeight());
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, state.canvasWidth(), state.canvasHeight());
    if (this.mouseIn) {
      const grd = ctx.createRadialGradient(
        this.pos.x,
        this.pos.y,
        0,
        this.pos.x,
        this.pos.y,
        this.lightRadius
      );
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.lightRadius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}
