import { TestBed } from '@angular/core/testing';

import { NgxCanvasGridService } from './ngx-canvas-grid.service';

describe('NgxCanvasGridService', () => {
  let service: NgxCanvasGridService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgxCanvasGridService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
