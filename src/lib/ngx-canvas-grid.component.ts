import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  NgZone,
  Output,
  ViewChild,
} from "@angular/core";
import {
  CanvasGridCellRenderFn,
  GridClickEvent,
  GridDragEvent,
  Point2D,
  Rect,
  RenderTextParams,
} from "./ngx-canvas-grid.types";

@Component({
  selector: "ngx-canvas-grid",
  standalone: true,
  imports: [],
  template: `<canvas #canvas></canvas>`,
  styles: `
    canvas {
      display: block;
      background: var(--canvas-background, black);
      cursor: var(--canvas-cursor, cell);
      tabindex: var(--canvas-tabindex, 0);
    }
  `,
})
export class NgxCanvasGridComponent {
  @ViewChild("canvas") private canvas!: ElementRef<HTMLCanvasElement>;
  @Input("cellWidth") set canvasWidth(value: number) {
    this._cellWidth = Math.floor(value);
    this.recalculate();
  }
  @Input("cellHeight") set canvasHeight(value: number) {
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

  @Input("cellRenderFn") cellRenderFn!: CanvasGridCellRenderFn;
  @Input("singleFrameIndices") singleFrameIndices: Set<number> = new Set();
  @Input("multiFrameIndices") multiFrameIndices: Set<number> = new Set();
  @Input("redrawAll") redrawAll: Boolean = false;
  @Input("fpsThrottle") fpsThrottle?: number;

  @Output() moveOnCellEvent = new EventEmitter<number>();
  @Output() singleClickCellEvent = new EventEmitter<GridClickEvent>();
  @Output() dragCellEvent = new EventEmitter<GridDragEvent>();
  @Output() dropCellEvent = new EventEmitter<number>();
  @Output() doubleClickCellEvent = new EventEmitter<number>();
  @Output() keyDownEvent = new EventEmitter<string>();

  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnDoubleClick = this.onDoubleClick.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);

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

  onKeyDown(event: KeyboardEvent) {
    this.keyDownEvent.emit(event.key);
  }

  onContextMenu(event: MouseEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  onMouseMove(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      this.moveOnCellEvent.emit(cellIndex);

      if (this.pressedIndex !== null) {
        this.isDragging = true;
        this.dragCellEvent.emit({
          from: this.pressedIndex,
          to: cellIndex,
        });
      }
    }
    event.stopPropagation();
    event.preventDefault();
  }

  onMouseDown(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      this.pressedIndex = cellIndex;
    }
    event.stopPropagation();
    event.preventDefault();
    this.canvas.nativeElement.focus();
  }

  onMouseUp(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      if (this.pressedIndex === cellIndex) {
        this.singleClickCellEvent.emit({
          index: cellIndex,
          buttonId: event.button,
        });
      }
      if (this.isDragging) {
        this.isDragging = false;
        this.dropCellEvent.emit(cellIndex);
      }
      this.pressedIndex = null;
    }
    event.stopPropagation();
    event.preventDefault();
  }

  onDoubleClick(event: MouseEvent) {
    const cellIndex = this.getCellIndexFromEvent(event);
    if (cellIndex !== null) {
      this.doubleClickCellEvent.emit(cellIndex);
    }
    event.stopPropagation();
    event.preventDefault();
    this.canvas.nativeElement.focus();
  }

  private _cellWidth: number = 20;
  private _cellHeight: number = 20;
  private _rows: number = 9;
  private _cols: number = 9;
  private _spacing: number = 1;
  private _length: number = this._rows * this._cols;
  private context!: CanvasRenderingContext2D;
  private ngZone: NgZone = inject(NgZone);
  private redrawIndices: Set<number> = new Set();
  private pressedIndex: number | null = null;
  private isDragging: boolean = false;
  private lastRenderTime: number = 0;
  private deltaTime: number = 0;
  private elapsedTime: number = 0;

  private render(timestamp: DOMHighResTimeStamp): void {
    const dt = timestamp - this.lastRenderTime;
    const fps = 1000 / dt;
    this.deltaTime = dt / 1000;
    this.elapsedTime += this.deltaTime;
    if (this.fpsThrottle !== undefined && fps < this.fpsThrottle) {
      if (this.redrawAll) {
        for (let i = 0; i < this._length; ++i) {
          this.renderCell(i);
        }
        this.redrawAll = false;
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

  private queryRedrawAll() {
    this.context.clearRect(
      0,
      0,
      this.canvas.nativeElement.width,
      this.canvas.nativeElement.height
    );
    this.redrawAll = true;
  }

  private recalculate() {
    if (this.canvas) {
      this._length = this._rows * this._cols;
      this.canvas.nativeElement.width =
        (this._cellWidth + this._spacing) * this._cols - this._spacing;
      this.canvas.nativeElement.height =
        (this._cellHeight + this._spacing) * this._rows - this._spacing;
      this.queryRedrawAll();
    }
  }
}
