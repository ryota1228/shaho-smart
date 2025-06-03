import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsurancePremiumComponent } from './insurance-premium.component';

describe('InsurancePremiumComponent', () => {
  let component: InsurancePremiumComponent;
  let fixture: ComponentFixture<InsurancePremiumComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsurancePremiumComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InsurancePremiumComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
