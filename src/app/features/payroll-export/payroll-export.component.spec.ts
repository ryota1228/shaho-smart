import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PayrollExportComponent } from './payroll-export.component';

describe('PayrollExportComponent', () => {
  let component: PayrollExportComponent;
  let fixture: ComponentFixture<PayrollExportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PayrollExportComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PayrollExportComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
