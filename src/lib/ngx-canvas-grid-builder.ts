import {
  CanvasGridCellDrawFn,
  CanvasGridLayerDrawFn,
  CanvasGridLayerDrawStrategy,
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

  redrawLayer(layerIndex: number = 0): void {
    this._layers[layerIndex].redrawAll = true;
  }

  addCellIndexToSingleFrameRedraw(
    cellIndex: number,
    layerIndex: number = 0
  ): void {
    this._layers[layerIndex].singleFrameCellIndices.add(cellIndex);
  }

  addCellIndexToMultiFrameRedraw(
    cellIndex: number,
    layerIndex: number = 0
  ): void {
    this._layers[layerIndex].multiFrameCellIndices.add(cellIndex);
  }

  deleteCellIndexFromMultiFrameRedraw(
    cellIndex: number,
    layerIndex: number = 0
  ): void {
    this._layers[layerIndex].multiFrameCellIndices.delete(cellIndex);
  }

  clearIndicesFromMultiFrameRedraw(layerIndex: number = 0): void {
    this._layers[layerIndex].multiFrameCellIndices.clear();
  }

  setLayerDrawStrategy(
    strategy: CanvasGridLayerDrawStrategy,
    layerIndex: number = 0
  ): void {
    this._layers[layerIndex].drawStrategy = strategy;
  }

  public static Builder = class implements LayerBuilder {
    #controller = new LayerController();

    build(): LayerController {
      return this.#controller;
    }

    public addLayerDrawnPerCell(drawFn: CanvasGridCellDrawFn): LayerBuilder {
      this.#controller._layers.push({
        drawFn: { drawFn: drawFn, type: PerCellDrawType },
        drawStrategy: CanvasGridLayerDrawStrategy.STATIC,
        multiFrameCellIndices: new Set(),
        redrawAll: false,
        singleFrameCellIndices: new Set(),
      });
      return this;
    }

    public addLayerDrawnAsWhole(drawFn: CanvasGridLayerDrawFn): LayerBuilder {
      this.#controller._layers.push({
        drawFn: { drawFn: drawFn, type: WholeCanvasDrawType },
        drawStrategy: CanvasGridLayerDrawStrategy.STATIC,
        multiFrameCellIndices: new Set(),
        redrawAll: false,
        singleFrameCellIndices: new Set(),
      });
      return this;
    }
  };
}

export function layerControllerBuilder(): LayerBuilder {
  return new LayerController.Builder();
}
