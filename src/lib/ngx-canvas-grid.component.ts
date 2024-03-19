import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  Output,
  signal,
  ViewChild,
} from "@angular/core";
import {
  CanvasGridCellRenderFn,
  CanvasGridDefaultOptions,
  CANVAS_GRID_DEFAULT_OPTIONS,
  GridClickEvent,
  GridDragEvent,
  GridDropEvent,
  Point2D,
  Rect,
  RenderTextParams,
} from "./ngx-canvas-grid.types";

const DEFAULT_CELL_WIDTH = 20;
const DEFAULT_CELL_HEIGHT = 20;
const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 9;
const DEFAULT_SPACING = 1;
const DEFAULT_BACKGROUND = "black";
const DEFAULT_CURSOR = "cell";

@Component({
  selector: "ngx-canvas-grid",
  standalone: true,
  imports: [],
  template: `<canvas #canvas tabindex="0"></canvas>`,
  styles: `
    canvas {
      display: block;
      background: var(--canvas-background, DEFAULT_BACKGROUND);
      cursor: var(--canvas-cursor, DEFAULT_CURSOR);
    }
  `,
})
export class NgxCanvasGridComponent {
  private _defaults: CanvasGridDefaultOptions | null = inject(
    CANVAS_GRID_DEFAULT_OPTIONS,
    { optional: true }
  );
  private _cellWidth: number;
  private _cellHeight: number;
  private _rows: number;
  private _cols: number;
  private _spacing: number;
  private _length: number;
  private context!: CanvasRenderingContext2D;
  private ngZone: NgZone = inject(NgZone);
  private redrawIndices: Set<number> = new Set();
  private pressedIndex: number | null = null;
  private downButtonId: number | null = null;
  private lastRenderTime: number = 0;
  private deltaTime: number = 0;
  private elapsedTime: number = 0;
  private _draggingButtonId = signal<number | null>(null);

  public readonly draggingButtonId = this._draggingButtonId.asReadonly();

  constructor() {
    this._cellWidth = this._defaults?.cellWidth ?? DEFAULT_CELL_WIDTH;
    this._cellHeight = this._defaults?.cellHeight ?? DEFAULT_CELL_HEIGHT;
    this._rows = this._defaults?.rows ?? DEFAULT_ROWS;
    this._cols = this._defaults?.cols ?? DEFAULT_COLS;
    this._spacing = this._defaults?.spacing ?? DEFAULT_SPACING;
    this.fpsThrottle = this._defaults?.fpsThrottle;
    this._length = this._rows * this._cols;
  }

  @ViewChild("canvas") private canvas!: ElementRef<HTMLCanvasElement>;
  @Input("cellWidth") set cellWidth(value: number) {
    this._cellWidth = Math.floor(value);
    this.recalculate();
  }
  @Input("cellHeight") set cellHeight(value: number) {
    this._cellHeight = Math.floor(value);
    this.recalculate();
  }
  @Input("rows") set rows(value: number) {
    this._rows = value;
    this.recalculate();
  }
  @Input("cols") set cols(value: number) {
    this._cols = value;
    this.recalculate();
  }
  @Input("spacing") set spacing(value: number) {
    this._spacing = value;
    this.recalculate();
  }

  @Input({ alias: "cellRenderFn", required: true })
  cellRenderFn!: CanvasGridCellRenderFn;
  @Input("fpsThrottle") fpsThrottle?: number;

  @Output() moveOnCellEvent = new EventEmitter<number>();
  @Output() singleClickCellEvent = new EventEmitter<GridClickEvent>();
  @Output() doubleClickCellEvent = new EventEmitter<GridClickEvent>();
  @Output() dragCellEvent = new EventEmitter<GridDragEvent>();
  @Output() dropCellEvent = new EventEmitter<GridDropEvent>();
  @Output() keyDownEvent = new EventEmitter<string>();

  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnDoubleClick = this.onDoubleClick.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);
  private singleFrameIndices: Set<number> = new Set();
  private multiFrameIndices: Set<number> = new Set();
  private shouldRedrawAll: boolean = false;

  ngAfterViewInit() {
    const canvasElement = this.canvas.nativeElement;
    const context2D = canvasElement.getContext("2d");
    if (context2D) {
      this.context = context2D;
      this.recalculate();
    }
    this.ngZone.runOutsideAngular(() => {
      this.canvas.nativeElement.addEventListener(
        "mousemove",
        this.boundOnMouseMove
      );
      this.canvas.nativeElement.addEventListener(
        "mousedown",
        this.boundOnMouseDown
      );
      this.canvas.nativeElement.addEventListener(
        "mouseup",
        this.boundOnMouseUp
      );
      this.canvas.nativeElement.addEventListener(
        "dblclick",
        this.boundOnDoubleClick
      );
      this.canvas.nativeElement.addEventListener(
        "keydown",
        this.boundOnKeyDown,
        false
      );
      this.canvas.nativeElement.addEventListener(
        "contextmenu",
        this.boundOnContextMenu,
        false
      );
      this.render(0);
    });
  }

  ngOnDestroy(): void {
    this.canvas.nativeElement.removeEventListener(
      "mousemove",
      this.boundOnMouseMove
    );
    this.canvas.nativeElement.removeEventListener(
      "mousedown",
      this.boundOnMouseDown
    );
    this.canvas.nativeElement.removeEventListener(
      "mouseup",
      this.boundOnMouseUp
    );
    this.canvas.nativeElement.removeEventListener(
      "dblclick",
      this.boundOnDoubleClick
    );
    this.canvas.nativeElement.removeEventListener(
      "keydown",
      this.boundOnKeyDown
    );
    this.canvas.nativeElement.removeEventListener(
      "contextmenu",
      this.boundOnContextMenu
    );
  }

  public addCellIndexToSingleFrameRedraw(index: number) {
    this.singleFrameIndices.add(index);
  }

  public addCellIndexToMultiFrameRedraw(index: number) {
    this.multiFrameIndices.add(index);
  }

  public deleteCellIndexFromMultiFrameRedraw(index: number) {
    this.multiFrameIndices.delete(index);
  }

  public clearIndicesFromMultiFrameRedraw() {
    this.multiFrameIndices.clear();
  }

  public redrawAll() {
    this.context.clearRect(
      0,
      0,
      this.canvas.nativeElement.width,
      this.canvas.nativeElement.height
    );
    this.shouldRedrawAll = true;
  }

  private onKeyDown(event: KeyboardEvent) {
    this.keyDownEvent.emit(event.key);
  }

  private onContextMenu(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  private onMouseMove(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      this.moveOnCellEvent.emit(cellIndex);

      if (this.pressedIndex !== null && this.downButtonId !== null) {
        this._draggingButtonId.set(this.downButtonId);
        this.dragCellEvent.emit({
          buttonId: this.downButtonId,
          from: this.pressedIndex,
          to: cellIndex,
        });
      }
    }
    event.stopPropagation();
    event.preventDefault();
  }

  private onMouseDown(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    this.downButtonId = event.button;
    if (cellIndex !== null) {
      this.pressedIndex = cellIndex;
    }
    event.stopPropagation();
    event.preventDefault();
    this.canvas.nativeElement.focus();
  }

  private onMouseUp(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      if (this.pressedIndex === cellIndex) {
        this.singleClickCellEvent.emit({
          cellIndex: cellIndex,
          buttonId: event.button,
        });
      }
      if (this._draggingButtonId() === event.button) {
        this._draggingButtonId.set(null);
        if (this.pressedIndex !== null) {
          this.dropCellEvent.emit({
            buttonId: event.button,
            from: this.pressedIndex,
            to: cellIndex,
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
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      this.doubleClickCellEvent.emit({
        buttonId: event.button,
        cellIndex: cellIndex,
      });
    }
    event.stopPropagation();
    event.preventDefault();
    this.canvas.nativeElement.focus();
  }

  private render(timestamp: DOMHighResTimeStamp): void {
    const dt = timestamp - this.lastRenderTime;
    const fps = 1000 / dt;
    this.deltaTime = dt / 1000;
    this.elapsedTime += this.deltaTime;
    if (this.fpsThrottle === undefined || fps < this.fpsThrottle) {
      if (this.shouldRedrawAll) {
        for (let i = 0; i < this._length; ++i) {
          this.renderCell(i);
        }
        this.shouldRedrawAll = false;
      } else {
        this.singleFrameIndices.forEach((index) =>
          this.redrawIndices.add(index)
        );
        this.multiFrameIndices.forEach((index) =>
          this.redrawIndices.add(index)
        );
        this.redrawIndices.forEach((cellIndex) => {
          this.renderCell(cellIndex);
        });
      }
      this.redrawIndices.clear();
      this.singleFrameIndices.clear();
      this.lastRenderTime = timestamp;
    }
    requestAnimationFrame((time: DOMHighResTimeStamp) => this.render(time));
  }

  private renderCell(cellIndex: number) {
    const cellRow = Math.floor(cellIndex / this._cols);
    const cellCol = cellIndex % this._cols;
    const cellPos = this.getCellTopLeft(cellRow, cellCol);
    const cellRect: Rect = {
      x: cellPos.x,
      y: cellPos.y,
      w: this._cellWidth,
      h: this._cellHeight,
    };
    this.cellRenderFn({
      context: this.context,
      renderTextFn: this.renderText,
      cellIndex: cellIndex,
      cellRect: cellRect,
      deltaTime: this.deltaTime,
      elapsedTime: this.elapsedTime,
    });
  }

  private renderText(params: RenderTextParams) {
    this.context.textAlign = "center";
    this.context.font = params.font;
    this.context.fillStyle = params.color;
    const cellCenterX = params.cellRect.x + params.cellRect.w / 2;
    const cellCenterY = params.cellRect.y + params.cellRect.h / 2;
    const metrics = this.context.measureText(params.text);
    const textHeight =
      metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    this.context.fillText(
      params.text,
      Math.floor(cellCenterX),
      Math.floor(cellCenterY + textHeight / 2)
    );
  }

  private getCellTopLeft(row: number, col: number): Point2D {
    return {
      x: col * (this._cellWidth + this._spacing),
      y: row * (this._cellHeight + this._spacing),
    };
  }

  private getCell(x: number, y: number): number | null {
    const closestCol = Math.min(
      Math.floor(x / (this._cellWidth + this._spacing)),
      this._cols - 1
    );
    const closestColX = (this._cellWidth + this._spacing) * closestCol;
    if (x >= closestColX + this._cellWidth) {
      return null;
    }
    const closestRow = Math.min(
      Math.floor(y / (this._cellHeight + this._spacing)),
      this._rows - 1
    );
    const closestRowY = (this._cellHeight + this._spacing) * closestRow;
    if (y >= closestRowY + this._cellHeight) {
      return null;
    }
    return closestRow * this._cols + closestCol;
  }

  private getCellIndexFromEvent(event: MouseEvent): number | null {
    const boundingRect = this.canvas.nativeElement.getBoundingClientRect();
    const widthRatio =
      this.canvas.nativeElement.width / this.canvas.nativeElement.scrollWidth;
    const heightRatio =
      this.canvas.nativeElement.height / this.canvas.nativeElement.scrollHeight;
    const x = (event.clientX - boundingRect.x) * widthRatio;
    const y = (event.clientY - boundingRect.y) * heightRatio;
    if (
      x <= this.canvas.nativeElement.width &&
      y <= this.canvas.nativeElement.height
    ) {
      return this.getCell(x, y);
    }
    return null;
  }

  private recalculate() {
    if (this.canvas) {
      this._length = this._rows * this._cols;
      this.canvas.nativeElement.width =
        (this._cellWidth + this._spacing) * this._cols - this._spacing;
      this.canvas.nativeElement.height =
        (this._cellHeight + this._spacing) * this._rows - this._spacing;
      this.redrawAll();
    }
  }
}
