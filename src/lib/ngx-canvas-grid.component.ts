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

export interface GridDragEvent {
  from: number;
  to: number;
}

export type CanvasGridCellRenderFn = (
  params: CanvasGridCellRenderParams
) => void;

export interface CanvasGridCellRenderParams {
  context: CanvasRenderingContext2D;
  renderTextFn: (params: RenderTextParams) => void;
  cellIndex: number;
  cellRect: Rect;
  deltaTime: number;
  elapsedTime: number;
}

export interface RenderTextParams {
  text: string;
  font: string;
  color: string;
  cellRect: Rect;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface CellSize {
  width: number;
  height: number;
}

interface Point2D {
  x: number;
  y: number;
}

@Component({
  selector: "ngx-canvas-grid",
  standalone: true,
  imports: [],
  template: ` <canvas
    #canvas
    [style.backgroundColor]="backgroundColor"
    tabindex="0"
  ></canvas>`,
  styles: `
    canvas {
      width: 100%;
      height: 100%;
      border: 0;
      padding: 0;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      cursor: cell;
      outline: none;
    }
  `,
})
export class NgxCanvasGridComponent {
  @ViewChild("canvas") private canvas!: ElementRef<HTMLCanvasElement>;
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
  @Input("backgroundColor") backgroundColor: string = "white";
  @Input("cellRenderFn") cellRenderFn!: CanvasGridCellRenderFn;
  @Input("dirtyIndices") dirtyIndices: Set<number> = new Set();
  @Input("animationIndices") animationIndices: Set<number> = new Set();
  @Input("redrawAll") redrawAll: Boolean = false;
  @Input("fpsThrottle") fpsThrottle: number = 20;

  @Output() moveOnCellEvent = new EventEmitter<number>();
  @Output() clickCellEvent = new EventEmitter<number>();
  @Output() dragCellEvent = new EventEmitter<GridDragEvent>();
  @Output() dropCellEvent = new EventEmitter<number>();
  @Output() doubleClickCellEvent = new EventEmitter<number>();
  @Output() keyDownEvent = new EventEmitter<string>();

  private boundOnMouseMove = this.onMouseMove.bind(this);
  private boundOnMouseDown = this.onMouseDown.bind(this);
  private boundOnMouseUp = this.onMouseUp.bind(this);
  private boundOnDoubleClick = this.onDoubleClick.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);

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
  }

  onKeyDown(event: KeyboardEvent) {
    this.keyDownEvent.emit(event.key);
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
        this.clickCellEvent.emit(cellIndex);
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

  private _rows: number = 9;
  private _cols: number = 9;
  private _spacing: number = 2;
  private _length: number = this._rows * this._cols;
  private context!: CanvasRenderingContext2D;
  private ngZone: NgZone = inject(NgZone);
  private redrawCandidates: Set<number> = new Set();
  private pressedIndex: number | null = null;
  private isDragging: boolean = false;
  private lastRenderTime: number = 0;
  private deltaTime: number = 0;
  private elapsedTime: number = 0;

  get rows() {
    return this._rows;
  }
  get cols() {
    return this._cols;
  }
  get spacing() {
    return this._spacing;
  }

  private render(timestamp: DOMHighResTimeStamp): void {
    const dt = timestamp - this.lastRenderTime;
    const fps = 1000 / dt;
    this.deltaTime = dt / 1000;
    this.elapsedTime += this.deltaTime;
    if (fps < this.fpsThrottle) {
      if (this.redrawAll) {
        for (let i = 0; i < this._length; ++i) {
          this.renderCell(i);
        }
        this.redrawAll = false;
      } else {
        this.dirtyIndices.forEach((index) => this.redrawCandidates.add(index));
        this.animationIndices.forEach((index) =>
          this.redrawCandidates.add(index)
        );
        this.redrawCandidates.forEach((cellIndex) => {
          this.renderCell(cellIndex);
        });
      }
      this.redrawCandidates.clear();
      this.dirtyIndices.clear();
      this.lastRenderTime = timestamp;
    }
    requestAnimationFrame((time: DOMHighResTimeStamp) => this.render(time));
  }

  private renderCell(cellIndex: number) {
    const cellSize = this.getCellSize();
    const cellRow = Math.floor(cellIndex / this.cols);
    const cellCol = cellIndex % this.cols;
    const cellPos = this.getCellTopLeft(cellRow, cellCol, cellSize);
    const cellRect: Rect = {
      x: cellPos.x,
      y: cellPos.y,
      w: cellSize.width,
      h: cellSize.height,
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

  private getCellWidth(): number {
    return Math.floor(
      (this.canvas.nativeElement.width - (this.cols - 1) * this.spacing) /
        this.cols
    );
  }

  private getCellHeight(): number {
    return Math.floor(
      (this.canvas.nativeElement.height - (this.rows - 1) * this.spacing) /
        this.rows
    );
  }

  private getCellSize(): CellSize {
    return { width: this.getCellWidth(), height: this.getCellHeight() };
  }

  private setRealCanvasSize(): void {
    this.canvas.nativeElement.width = this.canvas.nativeElement.scrollWidth;
    this.canvas.nativeElement.height = this.canvas.nativeElement.scrollHeight;
    const cellSize = this.getCellSize();
    const width = (cellSize.width + this.spacing) * this.cols - this.spacing;
    const height = (cellSize.height + this.spacing) * this.rows - this.spacing;
    this.canvas.nativeElement.width = width;
    this.canvas.nativeElement.height = height;
  }

  private getCellTopLeft(row: number, col: number, size: CellSize): Point2D {
    return {
      x: col * (size.width + this.spacing),
      y: row * (size.height + this.spacing),
    };
  }

  private getCell(x: number, y: number): number | null {
    const cellWidth = this.getCellWidth();
    const closestCol = Math.min(
      Math.floor(x / (cellWidth + this.spacing)),
      this.cols - 1
    );
    const closestColX = (cellWidth + this.spacing) * closestCol;
    if (x >= closestColX + cellWidth) {
      return null;
    }
    const cellHeight = this.getCellHeight();
    const closestRow = Math.min(
      Math.floor(y / (cellHeight + this.spacing)),
      this.rows - 1
    );
    const closestRowY = (cellHeight + this.spacing) * closestRow;
    if (y >= closestRowY + cellHeight) {
      return null;
    }
    return closestRow * this.cols + closestCol;
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
      this.setRealCanvasSize();
      this.queryRedrawAll();
    }
  }
}
