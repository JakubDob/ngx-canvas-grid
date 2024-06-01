import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  CanvasGridClickEvent,
  CanvasGridDragEvent,
  CanvasGridDropEvent,
  CanvasGridGapSizeFns,
  CanvasGridMoveEvent,
  drawText,
  LayerController,
  layerControllerBuilder,
  NgxCanvasGridComponent,
} from '@jakubdob/ngx-canvas-grid';
import { DragAndDropEffect } from '../effects/drag-and-drop';
import { MarchingAntsEffect } from '../effects/marching-ants';
import { ShadowEffect } from '../effects/shadow-effect';

enum LayerType {
  Background_Layer = 0,
  Value_Layer,
  Border_Layer,
  Drag_and_Drop_Layer,
  Shadow_Layer,
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NgxCanvasGridComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  cellWidth = signal(50);
  cellHeight = signal(50);
  rows = signal(9);
  cols = signal(9);
  offset = 0;
  primaryGapSizeSlider = signal(1);
  secondaryGapSizeSlider = signal(1);
  fpsThrottle = signal(60);
  layerNames = Object.keys(LayerType)
    .filter((k) => !isNaN(Number(k)))
    .map((k) => LayerType[Number(k)].replaceAll('_', ' '));
  clickedCellIndex: number | null = null;
  moveEvent = signal<CanvasGridMoveEvent | null>(null);
  dragEvent = signal<CanvasGridDragEvent | null>(null);
  dropEvent = signal<CanvasGridDropEvent | null>(null);
  shadowEffect = new ShadowEffect(this.moveEvent);
  marchingAnts = new MarchingAntsEffect();
  dragAndDrop = new DragAndDropEffect(this.dragEvent, this.dropEvent);

  gapSize: CanvasGridGapSizeFns = {
    colFn: (i) =>
      i > 0 && i < this.cols() && i % 3 === 0
        ? this.primaryGapSizeSlider()
        : Math.min(this.secondaryGapSizeSlider(), this.primaryGapSizeSlider()),
    rowFn: (i) =>
      i > 0 && i < this.rows() && i % 3 === 0
        ? this.primaryGapSizeSlider()
        : Math.min(this.secondaryGapSizeSlider(), this.primaryGapSizeSlider()),
  };
  layerController: LayerController = layerControllerBuilder()
    .addLayerDrawnPerCell((ctx, cell) => {
      ctx.fillStyle = 'lightblue';
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    })
    .addLayerDrawnPerCell((ctx, cell, state) => {
      const digitCount = Math.log10(state.rowCount() * state.colCount()) + 1;
      drawText(
        ctx,
        `${cell.index}`,
        `${
          Math.min(cell.h, cell.w / (`5`.length * digitCount * 0.5)) * 0.9
        }px roboto`,
        'red',
        {
          h: cell.h,
          w: cell.w,
          x: cell.x,
          y: cell.y,
        }
      );
    })
    .addLayerDrawnPerCell((ctx, cell, state) => {
      ctx.clearRect(cell.x, cell.y, cell.w, cell.h);
      if (this.clickedCellIndex === cell.index) {
        this.marchingAnts.update(ctx, cell, state.deltaTime());
      }
    })
    .addLayerDrawnAsWhole((ctx, state) => {
      this.dragAndDrop.update(ctx, state);
    })
    .addLayerDrawnAsWhole((ctx, state) => {
      this.shadowEffect.update(ctx, state);
    })
    .build();

  onClick(event: CanvasGridClickEvent) {
    if (event.target.type === 'cell') {
      const prev = this.clickedCellIndex;
      const curr = event.target.index;
      if (prev === null) {
        this.clickedCellIndex = curr;
        this.layerController.drawPerFrame(curr, LayerType.Border_Layer);
      } else if (prev === curr) {
        this.clickedCellIndex = null;
        this.layerController.drawOnce(prev, LayerType.Border_Layer);
        this.layerController.deleteCellDrawnPerFrame(
          prev,
          LayerType.Border_Layer
        );
      } else {
        this.clickedCellIndex = curr;
        this.layerController.drawOnce(prev, LayerType.Border_Layer);
        this.layerController.deleteCellDrawnPerFrame(
          prev,
          LayerType.Border_Layer
        );
        this.layerController.drawPerFrame(curr, LayerType.Border_Layer);
      }
    }
  }

  onDrag(event: CanvasGridDragEvent) {
    this.dragEvent.set(event);
  }

  onDrop(event: CanvasGridDropEvent) {
    this.dropEvent.set(event);
  }

  onMove(event: CanvasGridMoveEvent) {
    this.moveEvent.set(event);
  }

  onPointerLeave(event: PointerEvent) {
    this.moveEvent.set(null);
  }

  constructor() {
    this.layerController.drawPerFrame(LayerType.Drag_and_Drop_Layer);
    this.layerController.drawPerFrame(LayerType.Shadow_Layer);
    this.layerController.hidden(LayerType.Shadow_Layer, true);
  }
}
