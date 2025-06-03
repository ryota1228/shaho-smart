import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CustomRatesDialogComponent } from './custom-rates-dialog.component';

describe('CustomRatesDialogComponent', () => {
  let component: CustomRatesDialogComponent;
  let fixture: ComponentFixture<CustomRatesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomRatesDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CustomRatesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
