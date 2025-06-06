import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InsuranceSubmissionComponent } from './insurance-submission.component';

describe('InsuranceSubmissionComponent', () => {
  let component: InsuranceSubmissionComponent;
  let fixture: ComponentFixture<InsuranceSubmissionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InsuranceSubmissionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InsuranceSubmissionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
