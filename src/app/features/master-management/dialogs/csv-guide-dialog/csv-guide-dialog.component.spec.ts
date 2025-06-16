import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CsvGuideDialogComponent } from './csv-guide-dialog.component';

describe('CsvGuideDialogComponent', () => {
  let component: CsvGuideDialogComponent;
  let fixture: ComponentFixture<CsvGuideDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvGuideDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CsvGuideDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
