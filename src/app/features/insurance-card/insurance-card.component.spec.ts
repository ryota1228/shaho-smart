import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsuranceCardComponent } from './insurance-card.component';

describe('InsuranceCardComponent', () => {
  let component: InsuranceCardComponent;
  let fixture: ComponentFixture<InsuranceCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsuranceCardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InsuranceCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
