import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  OnDestroy,
  Output,
  QueryList,
  signal,
  ViewChildren,
} from "@angular/core";
import {
  CanvasGridClickEvent,
  CanvasGridDefaultOptions,
  CanvasGridDragEvent,
  CanvasGridDrawFn,
  CanvasGridDropEvent,
  CanvasGridLayerDrawStrategy,
  CanvasGridState,
  CANVAS_GRID_DEFAULT_OPTIONS,
  Extent,
  GridCell,
} from "./ngx-canvas-grid.types";

const DEFAULT_CELL_WIDTH = 20;
const DEFAULT_CELL_HEIGHT = 20;
const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 9;
const DEFAULT_GAP_SIZE = 1;
const DEFAULT_BACKGROUND_COLOR = "gray";
const DEFAULT_CURSOR = "cell";

type GridEventData = {
  cellIndex: number;
  x: number;
  y: number;
};

type GridLayerMetadata = {
  singleFrameCellIndices: Set<number>;
  multiFrameCellIndices: Set<number>;
  drawStrategy: CanvasGridLayerDrawStrategy;
  redrawAll: boolean;
};

@Component({
  selector: "ngx-canvas-grid",
  standalone: true,
  imports: [],
  templateUrl: "./ngx-canvas-grid.component.html",
  styleUrl: "./ngx-canvas-grid.component.scss",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgxCanvasGridComponent implements AfterViewInit, OnDestroy {
  private ngZone: NgZone = inject(NgZone);
  private _defaults: CanvasGridDefaultOptions | null = inject(
    CANVAS_GRID_DEFAULT_OPTIONS,
    { optional: true }
  );
  private contexts: CanvasRenderingContext2D[] = [];
  private lastCanvasLayer!: HTMLCanvasElement;
  private redrawIndices: Set<number> = new Set();
  private pressedIndex: number | null = null;
  private downButtonId: number | null = null;
  private lastRenderTime: number = 0;
  private _cellWidth = signal<number>(
    this._defaults?.cellWidth ?? DEFAULT_CELL_WIDTH
  );
  private _cellHeight = signal<number>(
    this._defaults?.cellHeight ?? DEFAULT_CELL_HEIGHT
  );
  private readonly _rows = signal<number>(this._defaults?.rows ?? DEFAULT_ROWS);
  private readonly _cols = signal<number>(this._defaults?.cols ?? DEFAULT_COLS);
  private readonly _gapSize = signal<number>(
    this._defaults?.gapSize ?? DEFAULT_GAP_SIZE
  );
  private readonly _length = computed(() => this._rows() * this._cols());
  private readonly _deltaTime = signal<number>(0);
  private readonly _elapsedTime = signal<number>(0);
  private readonly _draggingButtonId = signal<number | null>(null);
  private readonly _canvasWidth = computed(
    () => (this._cellWidth() + this._gapSize()) * this._cols() - this._gapSize()
  );
  private readonly _canvasHeight = computed(
    () =>
      (this._cellHeight() + this._gapSize()) * this._rows() - this._gapSize()
  );
  private readonly _drawFns = signal<CanvasGridDrawFn[]>([]);
  private readonly _layerCount = computed(() => this._drawFns().length);
  readonly cells = computed(() => {
    return Array.from<undefined, Readonly<GridCell>>(
      { length: this._length() },
      (_, i) => {
        const row = Math.floor(i / this._cols());
        const col = i % this._cols();
        return {
          x: col * (this._cellWidth() + this._gapSize()),
          y: row * (this._cellHeight() + this._gapSize()),
          w: this._cellWidth(),
          h: this._cellHeight(),
          row: row,
          col: col,
          index: i,
        };
      }
    );
  });

  @ViewChildren("canvasLayer", { read: ElementRef })
  canvasLayerElements!: QueryList<ElementRef<HTMLCanvasElement>>;

  @Input("cellWidth") set cellWidth(value: number) {
    this._cellWidth.set(Math.floor(value));
  }
  @Input("cellHeight") set cellHeight(value: number) {
    this._cellHeight.set(Math.floor(value));
  }
  @Input("rows") set rows(value: number) {
    this._rows.set(value);
  }
  @Input("cols") set cols(value: number) {
    this._cols.set(value);
  }
  @Input("gapSize") set gapSize(value: number) {
    this._gapSize.set(value);
  }

  @Input({ alias: "drawFns", required: true }) set drawFns(
    value: CanvasGridDrawFn[]
  ) {
    this._drawFns.set(value);
    this.initLayerMetadata();
  }
  @Input("fpsThrottle") fpsThrottle?: number = this._defaults?.fpsThrottle;

  @Output() moveOnCellEvent = new EventEmitter<number>();
  @Output() singleClickCellEvent = new EventEmitter<CanvasGridClickEvent>();
  @Output() doubleClickCellEvent = new EventEmitter<CanvasGridClickEvent>();
  @Output() dragCellEvent = new EventEmitter<CanvasGridDragEvent>();
  @Output() dropCellEvent = new EventEmitter<CanvasGridDropEvent>();
  @Output() keyDownEvent = new EventEmitter<string>();
  @Output() canvasSizeChangedEvent = new EventEmitter<Extent>();

  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnDoubleClick = this.onDoubleClick.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);
  private boundOnMouseLeave = this.onMouseLeave.bind(this);

  private layerMetadata: GridLayerMetadata[] = [];

  readonly state: Readonly<CanvasGridState>;

  constructor() {
    this.state = {
      canvasHeight: this._canvasHeight,
      canvasWidth: this._canvasWidth,
      cellHeight: this._cellHeight.asReadonly(),
      cellWidth: this._cellWidth.asReadonly(),
      cells: this.cells,
      colCount: this._cols.asReadonly(),
      rowCount: this._rows.asReadonly(),
      gapSize: this._gapSize.asReadonly(),
      layerCount: this._layerCount,
      deltaTime: this._deltaTime.asReadonly(),
      elapsedTime: this._elapsedTime.asReadonly(),
      draggingButtonId: this._draggingButtonId.asReadonly(),
    };

    effect(() => {
      this.canvasSizeChangedEvent.emit({
        h: this._canvasHeight(),
        w: this._canvasWidth(),
      });
    });

    effect(() => {
      if (this.lastCanvasLayer) {
        this.canvasLayerElements.forEach((canvas) => {
          canvas.nativeElement.width = this._canvasWidth();
          canvas.nativeElement.height = this._canvasHeight();
        });

        for (let i = 0; i < this._layerCount(); ++i) {
          this.layerMetadata[i].redrawAll = true;
        }
      }
    });
  }

  ngAfterViewInit() {
    this.contexts = this.canvasLayerElements
      .map((element) => element.nativeElement.getContext("2d"))
      .filter(
        (element): element is NonNullable<typeof element> => element !== null
      );
    this.lastCanvasLayer = this.canvasLayerElements.last.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      this.lastCanvasLayer.addEventListener("mousemove", this.boundOnMouseMove);
      this.lastCanvasLayer.addEventListener("mousedown", this.boundOnMouseDown);
      this.lastCanvasLayer.addEventListener("mouseup", this.boundOnMouseUp);
      this.lastCanvasLayer.addEventListener(
        "dblclick",
        this.boundOnDoubleClick
      );
      this.lastCanvasLayer.addEventListener(
        "keydown",
        this.boundOnKeyDown,
        false
      );
      this.lastCanvasLayer.addEventListener(
        "contextmenu",
        this.boundOnContextMenu,
        false
      );
      this.lastCanvasLayer.addEventListener(
        "mouseleave",
        this.boundOnMouseLeave,
        false
      );
      this.render(0);
    });
  }

  ngOnDestroy(): void {
    this.lastCanvasLayer.removeEventListener(
      "mousemove",
      this.boundOnMouseMove
    );
    this.lastCanvasLayer.removeEventListener(
      "mousedown",
      this.boundOnMouseDown
    );
    this.lastCanvasLayer.removeEventListener("mouseup", this.boundOnMouseUp);
    this.lastCanvasLayer.removeEventListener(
      "dblclick",
      this.boundOnDoubleClick
    );
    this.lastCanvasLayer.removeEventListener("keydown", this.boundOnKeyDown);
    this.lastCanvasLayer.removeEventListener(
      "contextmenu",
      this.boundOnContextMenu
    );
    this.lastCanvasLayer.removeEventListener(
      "mouseleave",
      this.boundOnMouseLeave
    );
  }

  private initLayerMetadata() {
    if (this.layerMetadata.length < this._layerCount()) {
      const diff = this._layerCount() - this.layerMetadata.length;
      this.layerMetadata = [
        ...this.layerMetadata,
        ...Array.from({ length: diff }, () => ({
          singleFrameCellIndices: new Set<number>(),
          multiFrameCellIndices: new Set<number>(),
          drawStrategy: CanvasGridLayerDrawStrategy.STATIC,
          redrawAll: false,
        })),
      ];
    }
  }

  public addCellIndexToSingleFrameRedraw(
    cellIndex: number,
    layerIndex: number = 0
  ) {
    this.layerMetadata[layerIndex].singleFrameCellIndices.add(cellIndex);
  }

  public addCellIndexToMultiFrameRedraw(
    cellIndex: number,
    layerIndex: number = 0
  ) {
    this.layerMetadata[layerIndex].multiFrameCellIndices.add(cellIndex);
  }

  public deleteCellIndexFromMultiFrameRedraw(
    cellIndex: number,
    layerIndex: number = 0
  ) {
    this.layerMetadata[layerIndex].multiFrameCellIndices.delete(cellIndex);
  }

  public clearIndicesFromMultiFrameRedraw(layerIndex: number = 0) {
    this.layerMetadata[layerIndex].multiFrameCellIndices.clear();
  }

  public setLayerDrawStrategy(
    strategy: CanvasGridLayerDrawStrategy,
    layerIndex: number = 0
  ) {
    this.layerMetadata[layerIndex].drawStrategy = strategy;
  }

  public redrawLayer(layerIndex: number = 0) {
    this.layerMetadata[layerIndex].redrawAll = true;
  }

  private onKeyDown(event: KeyboardEvent) {
    this.keyDownEvent.emit(event.key);
  }

  private onContextMenu(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent) {
    const data = this.getCellDataFromEvent(event);
    this.moveOnCellEvent.emit(data.cellIndex);

    if (this.pressedIndex !== null && this.downButtonId !== null) {
      this._draggingButtonId.set(this.downButtonId);
      this.dragCellEvent.emit({
        buttonId: this.downButtonId,
        from: this.pressedIndex,
        to: data.cellIndex,
        x: data.x,
        y: data.y,
      });
    }
    event.stopPropagation();
    event.preventDefault();
  }

  private onMouseDown(event: MouseEvent) {
    const cellIndex = this.getCellDataFromEvent(event).cellIndex;
    this.downButtonId = event.button;
    if (cellIndex !== null) {
      this.pressedIndex = cellIndex;
    }
    event.stopPropagation();
    event.preventDefault();
    this.lastCanvasLayer.focus();
  }

  private onMouseUp(event: MouseEvent) {
    const data = this.getCellDataFromEvent(event);
    if (data.cellIndex !== null) {
      if (this.pressedIndex === data.cellIndex) {
        this.singleClickCellEvent.emit({
          cellIndex: data.cellIndex,
          buttonId: event.button,
          x: data.x,
          y: data.y,
        });
      }
      if (this._draggingButtonId() === event.button) {
        this._draggingButtonId.set(null);
        if (this.pressedIndex !== null) {
          this.dropCellEvent.emit({
            buttonId: event.button,
            from: this.pressedIndex,
            to: data.cellIndex,
            x: data.x,
            y: data.y,
          });
        }
      }
      if (this.downButtonId === event.button) {
        this.downButtonId = null;
      }
      this.pressedIndex = null;
    }
    event.stopPropagation();
    event.preventDefault();
  }

  private onDoubleClick(event: MouseEvent) {
    const data = this.getCellDataFromEvent(event);
    if (data.cellIndex !== null) {
      this.doubleClickCellEvent.emit({
        buttonId: event.button,
        cellIndex: data.cellIndex,
        x: data.x,
        y: data.y,
      });
    }
    event.stopPropagation();
    event.preventDefault();
    this.lastCanvasLayer.focus();
  }

  private onMouseLeave(event: MouseEvent) {
    this.boundOnMouseUp(event);
  }

  private render(timestamp: DOMHighResTimeStamp): void {
    const dt = timestamp - this.lastRenderTime;
    const fps = 1000 / dt;
    this._deltaTime.set(dt / 1000);
    this._elapsedTime.update((prev) => (prev += this._deltaTime()));
    if (this.fpsThrottle === undefined || fps < this.fpsThrottle) {
      for (let i = 0; i < this._layerCount(); ++i) {
        const md = this.layerMetadata[i];
        const fns = this._drawFns()[i];
        const ctx = this.contexts[i];
        const cellsValue = this.cells();
        const isCellFnType = fns.type === "cell";
        if (md.redrawAll) {
          ctx.clearRect(0, 0, this._canvasWidth(), this._canvasHeight());
          if (isCellFnType) {
            cellsValue.forEach((cell) => {
              fns.drawFn(this.state, ctx, cell);
            });
            md.singleFrameCellIndices.clear();
          } else {
            fns.drawFn(this.state, ctx);
          }
          md.redrawAll = false;
        } else {
          if (isCellFnType) {
            md.singleFrameCellIndices.forEach((index) =>
              this.redrawIndices.add(index)
            );
            md.multiFrameCellIndices.forEach((index) =>
              this.redrawIndices.add(index)
            );
            this.redrawIndices.forEach(
              (index) =>
                index < this._length() &&
                fns.drawFn(this.state, ctx, cellsValue[index])
            );
            this.redrawIndices.clear();
            md.singleFrameCellIndices.clear();
          } else if (
            md.drawStrategy === CanvasGridLayerDrawStrategy.PER_FRAME
          ) {
            ctx.clearRect(0, 0, this._canvasWidth(), this._canvasHeight());
            fns.drawFn(this.state, ctx);
          }
        }
      }
      this.lastRenderTime = timestamp;
    }
    requestAnimationFrame((time: DOMHighResTimeStamp) => this.render(time));
  }

  private getCellDataFromEvent(event: MouseEvent): GridEventData {
    const boundingRect = this.lastCanvasLayer.getBoundingClientRect();
    const x = Math.min(
      Math.max(event.clientX - boundingRect.x, 0),
      boundingRect.width
    );
    const y = Math.min(
      Math.max(event.clientY - boundingRect.y, 0),
      boundingRect.height
    );
    const closestCol = Math.min(
      Math.floor(x / (this._cellWidth() + this._gapSize())),
      this._cols() - 1
    );
    const closestRow = Math.min(
      Math.floor(y / (this._cellHeight() + this._gapSize())),
      this._rows() - 1
    );
    const cellIndex = closestRow * this._cols() + closestCol;
    return {
      cellIndex: cellIndex,
      x: x,
      y: y,
    };
  }
}
