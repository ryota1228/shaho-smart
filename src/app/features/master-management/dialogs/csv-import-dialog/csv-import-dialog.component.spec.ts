import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CsvImportDialogComponent } from './csv-import-dialog.component';

describe('CsvImportDialogComponent', () => {
  let component: CsvImportDialogComponent;
  let fixture: ComponentFixture<CsvImportDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CsvImportDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CsvImportDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
