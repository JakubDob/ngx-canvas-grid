import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxCanvasGridComponent } from './ngx-canvas-grid.component';

describe('NgxCanvasGridComponent', () => {
  let component: NgxCanvasGridComponent;
  let fixture: ComponentFixture<NgxCanvasGridComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxCanvasGridComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(NgxCanvasGridComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
