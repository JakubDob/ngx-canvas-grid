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
} from '@angular/core';
import { LayerController } from './ngx-canvas-grid-builder';
import {
  CanvasGridClickEvent,
  CanvasGridDefaultOptions,
  CanvasGridDragEvent,
  CanvasGridDropEvent,
  CanvasGridElement,
  CanvasGridGapSizeType,
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
  CanvasGridDoubleClickEvent,
  PointerPixelPos,
  CanvasGridContextMenuEvent,
} from './ngx-canvas-grid.types';

const DEFAULT_CELL_WIDTH = 20;
const DEFAULT_CELL_HEIGHT = 20;
const DEFAULT_ROWS = 9;
const DEFAULT_COLS = 9;
const DEFAULT_GAP_SIZE = 1;
const DEFAULT_BACKGROUND_COLOR = 'gray';
const DEFAULT_CURSOR = 'cell';

@Component({
  selector: 'ngx-canvas-grid',
  standalone: true,
  imports: [],
  templateUrl: './ngx-canvas-grid.component.html',
  styleUrl: './ngx-canvas-grid.component.scss',
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
  private activeElementsByPtrId: Map<
    number,
    { element: CanvasGridElement } & PointerPixelPos
  > = new Map();
  private draggedPointerIds: Set<number> = new Set();
  private movingPointers: Map<number, PointerEvent> = new Map();
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
      const value = typeof fn === 'number' ? fn : fn.rowFn(i);
      yOffset += this._cellHeight() * i + sum;
      sum += value;
      gaps.push({
        type: 'gap',
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
      const value = typeof fn === 'number' ? fn : fn.colFn(i);
      xOffset += this._cellWidth() * i + sum;
      sum += value;
      gaps.push({
        type: 'gap',
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
          type: 'cell',
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

  @ViewChildren('canvasLayer', { read: ElementRef })
  canvasLayerElements!: QueryList<ElementRef<HTMLCanvasElement>>;

  @Input('cellWidth') set cellWidth(value: number) {
    this._cellWidth.set(Math.floor(value));
  }
  @Input('cellHeight') set cellHeight(value: number) {
    this._cellHeight.set(Math.floor(value));
  }
  @Input('rows') set rows(value: number) {
    this._rows.set(value);
  }
  @Input('cols') set cols(value: number) {
    this._cols.set(value);
  }
  @Input('gapSize') set gapSize(value: CanvasGridGapSizeType) {
    this._gapSizeGen.set(value);
  }
  @Input({ alias: 'controller', required: true }) set controller(
    value: LayerController
  ) {
    this._layers.set(value.layers);
  }
  @Input('fpsThrottle') fpsThrottle?: number = this._defaults?.fpsThrottle;

  @Output() moveEvent = new EventEmitter<CanvasGridMoveEvent>();
  @Output() singleClickEvent = new EventEmitter<CanvasGridClickEvent>();
  @Output() doubleClickEvent = new EventEmitter<CanvasGridDoubleClickEvent>();
  @Output() dragEvent = new EventEmitter<CanvasGridDragEvent>();
  @Output() dropEvent = new EventEmitter<CanvasGridDropEvent>();
  @Output() keyDownEvent = new EventEmitter<string>();
  @Output() contextMenuEvent = new EventEmitter<CanvasGridContextMenuEvent>();
  @Output() canvasSizeChangedEvent = new EventEmitter<PixelExtent>();

  private boundOnPointerMove = this.onPointerMove.bind(this);
  private boundOnPointerDown = this.onPointerDown.bind(this);
  private boundOnPointerUp = this.onPointerUp.bind(this);
  private boundOnDoubleClick = this.onDoubleClick.bind(this);
  private boundOnKeyDown = this.onKeyDown.bind(this);
  private boundOnContextMenu = this.onContextMenu.bind(this);
  private boundOnPointerLeave = this.onPointerLeave.bind(this);

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
      .map((element) => element.nativeElement.getContext('2d'))
      .filter(
        (element): element is NonNullable<typeof element> => element !== null
      );
    this.lastCanvasLayer = this.canvasLayerElements.last.nativeElement;

    this.ngZone.runOutsideAngular(() => {
      this.lastCanvasLayer.addEventListener(
        'pointermove',
        this.boundOnPointerMove
      );
      this.lastCanvasLayer.addEventListener(
        'pointerdown',
        this.boundOnPointerDown
      );
      this.lastCanvasLayer.addEventListener('pointerup', this.boundOnPointerUp);
      this.lastCanvasLayer.addEventListener(
        'dblclick',
        this.boundOnDoubleClick
      );
      this.lastCanvasLayer.addEventListener('keydown', this.boundOnKeyDown);
      this.lastCanvasLayer.addEventListener(
        'contextmenu',
        this.boundOnContextMenu
      );
      this.lastCanvasLayer.addEventListener(
        'pointerleave',
        this.boundOnPointerLeave
      );
      this.render(0);
    });
  }

  ngOnDestroy(): void {
    this.lastCanvasLayer.removeEventListener(
      'pointermove',
      this.boundOnPointerMove
    );
    this.lastCanvasLayer.removeEventListener(
      'pointerdown',
      this.boundOnPointerDown
    );
    this.lastCanvasLayer.removeEventListener(
      'pointerup',
      this.boundOnPointerUp
    );
    this.lastCanvasLayer.removeEventListener(
      'dblclick',
      this.boundOnDoubleClick
    );
    this.lastCanvasLayer.removeEventListener('keydown', this.boundOnKeyDown);
    this.lastCanvasLayer.removeEventListener(
      'contextmenu',
      this.boundOnContextMenu
    );
    this.lastCanvasLayer.removeEventListener(
      'pointerleave',
      this.boundOnPointerLeave
    );
  }

  private onKeyDown(event: KeyboardEvent) {
    this.keyDownEvent.emit(event.key);
  }

  private onContextMenu(event: MouseEvent) {
    const target = this.getTargetFromEvent(
      new PointerEvent('contextmenu', {
        clientX: event.clientX,
        clientY: event.clientY,
      })
    );
    this.contextMenuEvent.emit({
      browserEvent: event,
      target: target.element,
      pointerX: target.pointerX,
      pointerY: target.pointerY,
    });
    event.stopPropagation();
    event.preventDefault();
  }

  private onPointerMove(event: PointerEvent) {
    const moving = this.movingPointers.get(event.pointerId);
    if (moving?.clientX === event.clientX && moving.clientY === event.clientY) {
      return;
    }
    this.movingPointers.set(event.pointerId, event);
    const target = this.getTargetFromEvent(event);
    this.moveEvent.emit({
      browserEvent: event,
      target: target.element,
      pointerX: target.pointerX,
      pointerY: target.pointerY,
    });
    const active = this.activeElementsByPtrId.get(event.pointerId);
    if (
      active &&
      active.pointerX !== target.pointerX &&
      active.pointerY !== target.pointerY
    ) {
      this.draggedPointerIds.add(event.pointerId);
      this.dragEvent.emit({
        browserEvent: event,
        from: active.element,
        to: target.element,
        pointerX: target.pointerX,
        pointerY: target.pointerY,
      });
    }
    event.stopPropagation();
    event.preventDefault();
  }

  private onPointerDown(event: PointerEvent) {
    const target = this.getTargetFromEvent(event);
    for (let active of this.activeElementsByPtrId.values()) {
      if (this.equalElements(active.element, target.element)) {
        return;
      }
    }
    this.activeElementsByPtrId.set(event.pointerId, target);
    this.lastCanvasLayer.focus();
    event.stopPropagation();
    event.preventDefault();
  }

  private equalElements(a: CanvasGridElement, b: CanvasGridElement) {
    if (a.type !== b.type) {
      return false;
    }
    if (
      ((a.type === 'cell' && b.type === 'cell') ||
        (a.type === 'gap' && b.type === 'gap')) &&
      a.row === b.row &&
      a.col === b.col
    ) {
      return true;
    }
    if (
      a.type === 'gap_pair' &&
      b.type === 'gap_pair' &&
      a.rowGap.row === b.rowGap.row &&
      a.rowGap.col === b.rowGap.col &&
      a.colGap.row === b.colGap.row &&
      a.colGap.col === b.colGap.col
    ) {
      return true;
    }
    return false;
  }

  private onPointerUp(event: PointerEvent) {
    const activeTarget = this.activeElementsByPtrId.get(event.pointerId);
    if (activeTarget) {
      const target = this.getTargetFromEvent(event);
      const pointerDrags = this.draggedPointerIds.has(event.pointerId);
      if (
        !pointerDrags &&
        this.equalElements(target.element, activeTarget.element)
      ) {
        this.singleClickEvent.emit({
          browserEvent: event,
          target: target.element,
          pointerX: target.pointerX,
          pointerY: target.pointerY,
        });
      } else if (pointerDrags) {
        this.draggedPointerIds.delete(event.pointerId);
        {
          this.dropEvent.emit({
            browserEvent: event,
            from: activeTarget.element,
            to: target.element,
            pointerX: target.pointerX,
            pointerY: target.pointerY,
          });
        }
      }
      this.activeElementsByPtrId.delete(event.pointerId);
    }
    event.stopPropagation();
    event.preventDefault();
  }

  private onDoubleClick(event: MouseEvent) {
    const target = this.getTargetFromEvent(
      new PointerEvent('dblclick', {
        clientX: event.clientX,
        clientY: event.clientY,
      })
    );
    this.doubleClickEvent.emit({
      browserEvent: event,
      target: target.element,
      pointerX: target.pointerX,
      pointerY: target.pointerY,
    });
    event.stopPropagation();
    event.preventDefault();
    this.lastCanvasLayer.focus();
  }

  private onPointerLeave(event: PointerEvent) {
    this.boundOnPointerUp(event);
  }

  private updateDeferredLayerIndices(layer: GridLayerState) {
    layer.singleFrameCellGridPos.forEach((pos) => {
      layer.singleFrameCellIndices.add(pos.row * this._cols() + pos.col);
    });
    layer.singleFrameCellGridPos.length = 0;
    layer.multiFrameCellGridPos.forEach((pos) => {
      layer.multiFrameCellIndices.add(pos.row * this._cols() + pos.col);
    });
    layer.multiFrameCellGridPos.length = 0;
    layer.delMultiFrameCellGridPos.forEach((pos) => {
      layer.multiFrameCellIndices.delete(pos.row * this._cols() + pos.col);
    });
    layer.delMultiFrameCellGridPos.length = 0;
  }

  private render(timestamp: DOMHighResTimeStamp): void {
    const dt = timestamp - this.lastRenderTime;
    const fps = 1000 / dt;
    this._deltaTime.set(dt / 1000);
    this._elapsedTime.update((prev) => (prev += this._deltaTime()));
    if (this.fpsThrottle === undefined || fps < this.fpsThrottle) {
      for (let i = 0; i < this._layerCount(); ++i) {
        let layer = this._layers()[i];
        if (layer.redrawAll || layer.redrawPerFrame) {
          const fns = layer.drawFn;
          const isCellFnType = fns.type === PerCellDrawType;
          this.contexts[i].clearRect(
            0,
            0,
            this._canvasWidth(),
            this._canvasHeight()
          );
          if (isCellFnType) {
            this.updateDeferredLayerIndices(layer);
            this.cells().forEach((cell) => {
              fns.drawFn(this.contexts[i], cell, this.state, i);
            });
            layer.singleFrameCellIndices.clear();
          } else {
            fns.drawFn(this.contexts[i], this.state, i);
          }
          layer.redrawAll = false;
        } else {
          const fns = layer.drawFn;
          const isCellFnType = fns.type === PerCellDrawType;
          if (isCellFnType) {
            this.updateDeferredLayerIndices(layer);
            layer.singleFrameCellIndices.forEach((index) =>
              this.redrawIndices.add(index)
            );
            layer.multiFrameCellIndices.forEach((index) =>
              this.redrawIndices.add(index)
            );
            this.redrawIndices.forEach((index) => {
              if (index < this._length()) {
                const cell = this.cells()[index];
                this.contexts[i].clearRect(cell.x, cell.y, cell.w, cell.h);
                fns.drawFn(this.contexts[i], cell, this.state, i);
              }
            });
            this.redrawIndices.clear();
            layer.singleFrameCellIndices.clear();
          }
        }
      }
      this.lastRenderTime = timestamp;
    }
    requestAnimationFrame((time: DOMHighResTimeStamp) => this.render(time));
  }

  private getTargetFromEvent(
    event: PointerEvent
  ): { element: CanvasGridElement } & PointerPixelPos {
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
    if (colI.type === 'cell' && rowI.type === 'cell') {
      const index = rowI.value * this._cols() + colI.value;
      return {
        element: this.cells()[index],
        pointerX: x,
        pointerY: y,
      };
    }
    if (colI.type === 'gap' && rowI.type === 'gap') {
      return {
        element: {
          type: 'gap_pair',
          colGap: this._colGaps()[colI.value],
          rowGap: this._rowGaps()[rowI.value],
        },
        pointerX: x,
        pointerY: y,
      };
    }
    if (colI.type === 'gap') {
      return { element: this._colGaps()[colI.value], pointerX: x, pointerY: y };
    }
    return { element: this._rowGaps()[rowI.value], pointerX: x, pointerY: y };
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
          type: 'cell',
          value: midI,
        };
      }
    }
    return {
      type: 'gap',
      value: leftI,
    };
  }
}
