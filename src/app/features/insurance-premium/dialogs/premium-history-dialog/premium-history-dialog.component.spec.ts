import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PremiumHistoryDialogComponent } from './premium-history-dialog.component';

describe('PremiumHistoryDialogComponent', () => {
  let component: PremiumHistoryDialogComponent;
  let fixture: ComponentFixture<PremiumHistoryDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PremiumHistoryDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PremiumHistoryDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
