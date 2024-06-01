import { GridCell } from '@jakubdob/ngx-canvas-grid';

export class MarchingAntsEffect {
  private lineWidth = 2;
  private lineDash = [8, 4];
  private strokeStyle = 'black';
  private offset = 0;
  private shouldUpdate = true;
  update(ctx: CanvasRenderingContext2D, cell: GridCell, dt: number) {
    if (this.shouldUpdate) {
      const halfWidth = this.lineWidth / 2;
      ctx.strokeStyle = this.strokeStyle;
      ctx.lineWidth = this.lineWidth;
      ctx.setLineDash(this.lineDash);
      ctx.lineDashOffset = this.offset;
      ctx.strokeRect(
        cell.x + halfWidth,
        cell.y + halfWidth,
        cell.w - this.lineWidth,
        cell.h - this.lineWidth
      );
      this.offset += dt * 30;
      if (this.offset > 24) {
        this.offset = 0;
      }
    }
  }
}
