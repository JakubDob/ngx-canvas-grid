import {
  CanvasGridCellDrawFn,
  CanvasGridLayerDrawFn,
  GridLayerState,
  PerCellDrawType,
  WholeCanvasDrawType,
} from "./ngx-canvas-grid.types";

export interface LayerBuilder {
  addLayerDrawnAsWhole(drawFn: CanvasGridLayerDrawFn): LayerBuilder;
  addLayerDrawnPerCell(drawFn: CanvasGridCellDrawFn): LayerBuilder;
  build(): LayerController;
}

export class LayerController {
  private _layers: GridLayerState[] = [];

  private constructor() {}

  get layers(): ReadonlyArray<GridLayerState> {
    return this._layers;
  }

  drawOnce(row: number, col: number, layerIndex: number): void;
  drawOnce(cellIndex: number, layerIndex: number): void;
  drawOnce(layerIndex: number): void;
  drawOnce(
    rowOrIndexOrLayer: number,
    colOrLayer?: number,
    layer?: number
  ): void {
    if (colOrLayer === undefined) {
      this._layers[rowOrIndexOrLayer].redrawPerFrame = false;
      this._layers[rowOrIndexOrLayer].redrawAll = true;
    } else {
      if (layer === undefined) {
        if (this._layers[colOrLayer].drawFn.type === "whole_canvas") {
          return;
        }
        this._layers[colOrLayer].singleFrameCellIndices.add(rowOrIndexOrLayer);
      } else {
        if (this._layers[layer].drawFn.type === "whole_canvas") {
          return;
        }
        this._layers[layer].singleFrameCellGridPos.push({
          row: rowOrIndexOrLayer,
          col: colOrLayer,
        });
      }
    }
  }

  drawPerFrame(row: number, col: number, layerIndex: number): void;
  drawPerFrame(cellIndex: number, layerIndex: number): void;
  drawPerFrame(layerIndex: number): void;
  drawPerFrame(
    rowOrIndexOrLayer: number,
    colOrLayer?: number,
    layer?: number
  ): void {
    if (colOrLayer === undefined) {
      this._layers[rowOrIndexOrLayer].redrawPerFrame = true;
    } else {
      if (layer === undefined) {
        if (this._layers[colOrLayer].drawFn.type === "whole_canvas") {
          return;
        }
        this._layers[colOrLayer].multiFrameCellIndices.add(rowOrIndexOrLayer);
      } else {
        if (this._layers[layer].drawFn.type === "whole_canvas") {
          return;
        }
        this._layers[layer].multiFrameCellGridPos.push({
          row: rowOrIndexOrLayer,
          col: colOrLayer,
        });
      }
    }
  }

  deleteCellDrawnPerFrame(row: number, col: number, layerIndex: number): void;
  deleteCellDrawnPerFrame(cellIndex: number, layerIndex: number): void;
  deleteCellDrawnPerFrame(layerIndex: number): void;
  deleteCellDrawnPerFrame(
    rowOrIndexOrLayer: number,
    colOrLayer?: number,
    layer?: number
  ): void {
    if (colOrLayer === undefined) {
      this._layers[rowOrIndexOrLayer].multiFrameCellIndices.clear();
    } else {
      if (layer === undefined) {
        this._layers[colOrLayer].multiFrameCellIndices.delete(
          rowOrIndexOrLayer
        );
      } else {
        if (this._layers[layer].drawFn.type === "whole_canvas") {
          return;
        }
        this._layers[layer].delMultiFrameCellGridPos.push({
          row: rowOrIndexOrLayer,
          col: colOrLayer,
        });
      }
    }
  }

  public static Builder = class implements LayerBuilder {
    #controller = new LayerController();

    build(): LayerController {
      return this.#controller;
    }

    public addLayerDrawnPerCell(drawFn: CanvasGridCellDrawFn): LayerBuilder {
      this.#controller._layers.push({
        drawFn: { drawFn: drawFn, type: PerCellDrawType },
        redrawAll: false,
        redrawPerFrame: false,
        multiFrameCellIndices: new Set(),
        singleFrameCellIndices: new Set(),
        multiFrameCellGridPos: [],
        singleFrameCellGridPos: [],
        delMultiFrameCellGridPos: [],
      });
      return this;
    }

    public addLayerDrawnAsWhole(drawFn: CanvasGridLayerDrawFn): LayerBuilder {
      this.#controller._layers.push({
        drawFn: { drawFn: drawFn, type: WholeCanvasDrawType },
        redrawAll: false,
        redrawPerFrame: false,
        multiFrameCellIndices: new Set(),
        singleFrameCellIndices: new Set(),
        multiFrameCellGridPos: [],
        singleFrameCellGridPos: [],
        delMultiFrameCellGridPos: [],
      });
      return this;
    }
  };
}

export function layerControllerBuilder(): LayerBuilder {
  return new LayerController.Builder();
}
