# NgxCanvasGrid

NgxCanvasGrid is an Angular library for creating multi-layered, canvas-based, grid-like views. It provides functionality for per-cell or per-layer drawing.

## Installation

`npm install @jakubdob/ngx-canvas-grid`

## Example usage

### Template

    <ngx-canvas-grid
      [cellWidth]="cellWidth()"
      [cellHeight]="cellHeight()"
      [gapSize]="gapSize"
      [rows]="rows()"
      [cols]="cols()"
      [controller]="layerController"
      (singleClickEvent)="onClick($event)"
      (dragEvent)="onDrag($event)"
      (dropEvent)="onDrop($event)"
      (moveEvent)="onMove($event)"
      (pointerLeaveEvent)="onPointerLeave($event)"
    ></ngx-canvas-grid>

### Component

Import it as a standalone component in your module like this: `imports: [NgxCanvasGridComponent]`.

    cellWidth = signal(50);
    cellHeight = signal(50);
    rows = signal(9);
    cols = signal(9);

    //example variables used in computation of the gap functions, not part of the grid api
    primaryGapSizeSlider = signal(1);
    secondaryGapSizeSlider = signal(1);

The gap size can be defined as either a numeric value or a function. If a number is used, then all the cells will be separated by the same distance.

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

Handle mouse move event.

    pointerPos: PixelPos = { x: 0, y: 0 };
    onMove(event: CanvasGridMoveEvent) {
        this.pointerPos = event.pointerPos;
    }

Create two layers for the grid:

1. Checker pattern in the background
2. Oscillating dot following the cursor

 <!--  -->

    layerController: LayerController = layerControllerBuilder()
        .addLayerDrawnPerCell((ctx, cell) => {
        cell.index % 2 === 0
            ? (ctx.fillStyle = 'lightgray')
            : (ctx.fillStyle = 'gray');
        ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
        })
        .addLayerDrawnAsWhole((ctx, state) => {
        ctx.clearRect(0, 0, state.canvasWidth(), state.canvasHeight());
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
            this.pointerPos.x,
            this.pointerPos.y,
            10 * (Math.sin(state.elapsedTime()) + 1),
            0,
            2 * Math.PI
        );
        ctx.fill();
        })
        .build();

The layers are static by default and are not redrawn every frame. To make the second layer dynamic, you can do this:

    constructor() {
        this.layerController.drawPerFrame(1); //pass a layer index
    }

## Emitted events

Multitouch is supported. The emitted event object includes a corresponding PointerEvent along with grid-specific information.

- `moveEvent`
- `singleClickEvent`
- `doubleClickEvent`
- `dragEvent`
- `dropEvent`
- `keyDownEvent`
- `contextMenuEvent`
- `canvasSizeChangedEvent`
- `pointerLeaveEvent`

## Inputs

The grid size is computed based on `cellWidth`, `cellHeight`, `rows`, `cols`, and a `gapSize` function. The canvas is pixel-aligned, therefore manipulation of width and height through CSS is not recommended.

Any change that affects the canvas size triggers redrawing of all the layers by invoking the draw callbacks provided in the LayerController.

- `controller` required, returned by LayerControllerBuilder
- `cellWidth`
- `cellHeight`
- `rows`
- `cols`
- `gapSize`
- `fpsThrottle`

## Configuration

To override default values, provide `CANVAS_GRID_DEFAULT_OPTIONS`

    export const appConfig: ApplicationConfig = {
    providers: [
        {
        provide: CANVAS_GRID_DEFAULT_OPTIONS,
        useValue: {
            cellWidth: 50,
            cellHeight: 50,
            rows: 9,
            cols: 9,
            gapSize: 3,
            fpsThrottle: 120,
        },
        },
    ],
    };

## Styling

The library defines the following CSS variables:

`--canvas-background`

`--canvas-cursor`

You can use the CSS variables in your component.css file like this:

    ngx-canvas-grid {
        --canvas-background: hsla(0, 0%, 0%, 0);
        --canvas-cursor: crosshair;
    }

## License

Licensed under the MIT license.
