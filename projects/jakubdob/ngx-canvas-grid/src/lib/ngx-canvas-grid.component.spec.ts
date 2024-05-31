import { ComponentFixture, TestBed } from '@angular/core/testing';
import { layerControllerBuilder } from './ngx-canvas-grid-builder';

import { NgxCanvasGridComponent } from './ngx-canvas-grid.component';

describe('NgxCanvasGridComponent', () => {
  let component: NgxCanvasGridComponent;
  let fixture: ComponentFixture<NgxCanvasGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxCanvasGridComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NgxCanvasGridComponent);
    component = fixture.componentInstance;
    component.controller = layerControllerBuilder()
      .addLayerDrawnAsWhole(() => {})
      .build();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
