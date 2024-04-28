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
  Signal,
  signal,
  ViewChildren,
} from "@angular/core";
import { LayerController } from "./ngx-canvas-grid-builder";
import {
  CanvasGridClickEvent,
  CanvasGridDefaultOptions,
  CanvasGridDragEvent,
  CanvasGridDropEvent,
  CanvasGridElement,
  CanvasGridGapSizeType,
  CanvasGridLayerDrawStrategy,
  CanvasGridMoveEvent,
  CanvasGridState,
  CANVAS_GRID_DEFAULT_OPTIONS,
  CellType,
  PixelExtent,
  GapType,
  GridCell,
  GridGap,
  GridLayerState,
  PerCellDrawType,
  MousePixelPos,
} from "./ngx-canvas-grid.types";

const DEFAULT_CELL_WIDTH = 20;
const DEFAULT_CELL_HEIGHT = 20;
const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 9;
const DEFAULT_GAP_SIZE = 1;
const DEFAULT_BACKGROUND_COLOR = "gray";
const DEFAULT_CURSOR = "cell";

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
  private pressedTarget: CanvasGridElement | null = null;
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
  private readonly _gapSizeGen = signal<CanvasGridGapSizeType>(
    this._defaults?.gapSize ?? DEFAULT_GAP_SIZE
  );
  private readonly _rowGaps: Signal<GridGap[]> = computed(() => {
    const fn = this._gapSizeGen();
    const gaps: GridGap[] = [];
    let sum = 0;
    let yOffset = 0;
    for (let i = 0; i < this._rows() + 1; ++i) {
      const value = typeof fn === "number" ? fn : fn.rowFn(i);
      yOffset += this._cellHeight() * i + sum;
      sum += value;
      gaps.push({
        type: "gap",
        col: 0,
        prefixSum: sum,
        row: i,
        value: value,
        x: 0,
        y: yOffset,
      });
    }
    return gaps;
  });
  private readonly _colGaps = computed(() => {
    const fn = this._gapSizeGen();
    const gaps: GridGap[] = [];
    let sum = 0;
    let xOffset = 0;
    for (let i = 0; i < this._cols() + 1; ++i) {
      const value = typeof fn === "number" ? fn : fn.colFn(i);
      xOffset += this._cellWidth() * i + sum;
      sum += value;
      gaps.push({
        type: "gap",
        col: i,
        prefixSum: sum,
        row: 0,
        value: value,
        x: xOffset,
        y: 0,
      });
    }
    return gaps;
  });
  private readonly _length = computed(() => this._rows() * this._cols());
  private readonly _deltaTime = signal<number>(0);
  private readonly _elapsedTime = signal<number>(0);
  private readonly _draggingButtonId = signal<number | null>(null);
  private readonly _canvasWidth = computed(() => {
    const totalGapWidth = this._colGaps()[this._colGaps().length - 1].prefixSum;
    return this._cellWidth() * this._cols() + totalGapWidth;
  });
  private readonly _canvasHeight = computed(() => {
    const totalGapHeight =
      this._rowGaps()[this._rowGaps().length - 1].prefixSum;
    return this._cellHeight() * this._rows() + totalGapHeight;
  });
  private readonly _layers = signal<ReadonlyArray<GridLayerState>>([]);
  private readonly _layerCount = computed(() => this._layers().length);
  readonly cells = computed(() => {
    return Array.from<undefined, Readonly<GridCell>>(
      { length: this._length() },
      (_, i) => {
        const row = Math.floor(i / this._cols());
        const col = i % this._cols();
        return {
          type: "cell",
          x: col * this._cellWidth() + this._colGaps()[col].prefixSum,
          y: row * this._cellHeight() + this._rowGaps()[row].prefixSum,
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
  @Input("gapSize") set gapSize(value: CanvasGridGapSizeType) {
    this._gapSizeGen.set(value);
  }
  @Input({ alias: "controller", required: true }) set controller(
    value: LayerController
  ) {
    this._layers.set(value.layers);
  }
  @Input("fpsThrottle") fpsThrottle?: number = this._defaults?.fpsThrottle;

  @Output() moveEvent = new EventEmitter<CanvasGridMoveEvent>();
  @Output() singleClickEvent = new EventEmitter<CanvasGridClickEvent>();
  @Output() doubleClickEvent = new EventEmitter<CanvasGridClickEvent>();
  @Output() dragEvent = new EventEmitter<CanvasGridDragEvent>();
  @Output() dropEvent = new EventEmitter<CanvasGridDropEvent>();
  @Output() keyDownEvent = new EventEmitter<string>();
  @Output() canvasSizeChangedEvent = new EventEmitter<PixelExtent>();

  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnDoubleClick = this.onDoubleClick.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);
  private boundOnMouseLeave = this.onMouseLeave.bind(this);

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
      rowGaps: this._rowGaps,
      colGaps: this._colGaps,
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
          this._layers()[i].redrawAll = true;
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

  private onKeyDown(event: KeyboardEvent) {
    this.keyDownEvent.emit(event.key);
  }

  private onContextMenu(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent) {
    const target = this.getTargetFromEvent(event);
    this.moveEvent.emit({
      target: target.element,
      mouseX: target.mouseX,
      mouseY: target.mouseY,
    });
    if (this.pressedTarget !== null && this.downButtonId !== null) {
      this._draggingButtonId.set(this.downButtonId);
      this.dragEvent.emit({
        buttonId: this.downButtonId,
        from: this.pressedTarget,
        to: target.element,
        mouseX: target.mouseX,
        mouseY: target.mouseY,
      });
    }
    event.stopPropagation();
    event.preventDefault();
  }

  private onMouseDown(event: MouseEvent) {
    const target = this.getTargetFromEvent(event);
    this.downButtonId = event.button;
    this.pressedTarget = target.element;
    event.stopPropagation();
    event.preventDefault();
    this.lastCanvasLayer.focus();
  }

  private equalElements(a: CanvasGridElement, b: CanvasGridElement) {
    if (a.type !== b.type) {
      return false;
    }
    if (
      ((a.type === "cell" && b.type === "cell") ||
        (a.type === "gap" && b.type === "gap")) &&
      a.row === b.row &&
      a.col === b.col
    ) {
      return true;
    }
    if (
      a.type === "gap_pair" &&
      b.type === "gap_pair" &&
      a.rowGap.row === b.rowGap.row &&
      a.rowGap.col === b.rowGap.col &&
      a.colGap.row === b.colGap.row &&
      a.colGap.col === b.colGap.col
    ) {
      return true;
    }
    return false;
  }

  private onMouseUp(event: MouseEvent) {
    const target = this.getTargetFromEvent(event);
    if (
      this.pressedTarget &&
      this.equalElements(this.pressedTarget, target.element)
    ) {
      this.singleClickEvent.emit({
        buttonId: event.button,
        target: target.element,
        mouseX: target.mouseX,
        mouseY: target.mouseY,
      });
    }
    if (this._draggingButtonId() === event.button) {
      this._draggingButtonId.set(null);
      if (this.pressedTarget !== null) {
        this.dropEvent.emit({
          buttonId: event.button,
          from: this.pressedTarget,
          to: target.element,
          mouseX: target.mouseX,
          mouseY: target.mouseY,
        });
      }
    }
    if (this.downButtonId === event.button) {
      this.downButtonId = null;
    }
    this.pressedTarget = null;

    event.stopPropagation();
    event.preventDefault();
  }

  private onDoubleClick(event: MouseEvent) {
    const target = this.getTargetFromEvent(event);
    this.doubleClickEvent.emit({
      buttonId: event.button,
      target: target.element,
      mouseX: target.mouseX,
      mouseY: target.mouseY,
    });
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
        if (this._layers()[i].redrawAll) {
          const fns = this._layers()[i].drawFn;
          const isCellFnType = fns.type === PerCellDrawType;
          this.contexts[i].clearRect(
            0,
            0,
            this._canvasWidth(),
            this._canvasHeight()
          );
          if (isCellFnType) {
            this.cells().forEach((cell) => {
              fns.drawFn(this.state, this.contexts[i], cell);
            });
            this._layers()[i].singleFrameCellIndices.clear();
          } else {
            fns.drawFn(this.state, this.contexts[i]);
          }
          this._layers()[i].redrawAll = false;
        } else {
          const fns = this._layers()[i].drawFn;
          const isCellFnType = fns.type === PerCellDrawType;
          if (isCellFnType) {
            this._layers()[i].singleFrameCellIndices.forEach((index) =>
              this.redrawIndices.add(index)
            );
            this._layers()[i].multiFrameCellIndices.forEach((index) =>
              this.redrawIndices.add(index)
            );
            this.redrawIndices.forEach((index) => {
              if (index < this._length()) {
                const cell = this.cells()[index];
                this.contexts[i].clearRect(cell.x, cell.y, cell.w, cell.h);
                fns.drawFn(this.state, this.contexts[i], cell);
              }
            });
            this.redrawIndices.clear();
            this._layers()[i].singleFrameCellIndices.clear();
          } else if (
            this._layers()[i].drawStrategy ===
            CanvasGridLayerDrawStrategy.PER_FRAME
          ) {
            this.contexts[i].clearRect(
              0,
              0,
              this._canvasWidth(),
              this._canvasHeight()
            );
            fns.drawFn(this.state, this.contexts[i]);
          }
        }
      }
      this.lastRenderTime = timestamp;
    }
    requestAnimationFrame((time: DOMHighResTimeStamp) => this.render(time));
  }

  private getTargetFromEvent(
    event: MouseEvent
  ): { element: CanvasGridElement } & MousePixelPos {
    const boundingRect = this.lastCanvasLayer.getBoundingClientRect();
    const x = Math.min(
      Math.max(event.clientX - boundingRect.x, 0),
      boundingRect.width
    );
    const y = Math.min(
      Math.max(event.clientY - boundingRect.y, 0),
      boundingRect.height
    );
    const colI = this.findTargetCoordinate(
      this._colGaps(),
      this._cellWidth(),
      this._cols(),
      x
    );
    const rowI = this.findTargetCoordinate(
      this._rowGaps(),
      this._cellHeight(),
      this._rows(),
      y
    );
    if (colI.type === "cell" && rowI.type === "cell") {
      const index = rowI.value * this._cols() + colI.value;
      return {
        element: this.cells()[index],
        mouseX: x,
        mouseY: y,
      };
    }
    if (colI.type === "gap" && rowI.type === "gap") {
      return {
        element: {
          type: "gap_pair",
          colGap: this._colGaps()[colI.value],
          rowGap: this._rowGaps()[rowI.value],
        },
        mouseX: x,
        mouseY: y,
      };
    }
    if (colI.type === "gap") {
      return { element: this._colGaps()[colI.value], mouseX: x, mouseY: y };
    }
    return { element: this._rowGaps()[rowI.value], mouseX: x, mouseY: y };
  }

  private findTargetCoordinate(
    gaps: GridGap[],
    cellExtent: number,
    dimCellCount: number,
    eventCoord: number
  ): { type: typeof CellType | typeof GapType; value: number } {
    let leftI = 0;
    let rightI = dimCellCount - 1;
    let midI = 0;
    while (leftI <= rightI) {
      midI = Math.floor((rightI + leftI) / 2);
      const closestCell = midI * cellExtent + gaps[midI].prefixSum;
      if (eventCoord < closestCell) {
        rightI = midI - 1;
      } else if (eventCoord > closestCell + cellExtent) {
        leftI = midI + 1;
      } else {
        return {
          type: "cell",
          value: midI,
        };
      }
    }
    return {
      type: "gap",
      value: leftI,
    };
  }
}
