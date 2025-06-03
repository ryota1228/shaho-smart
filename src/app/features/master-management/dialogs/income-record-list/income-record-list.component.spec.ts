import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IncomeRecordListComponent } from './income-record-list.component';

describe('IncomeRecordListComponent', () => {
  let component: IncomeRecordListComponent;
  let fixture: ComponentFixture<IncomeRecordListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomeRecordListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(IncomeRecordListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
