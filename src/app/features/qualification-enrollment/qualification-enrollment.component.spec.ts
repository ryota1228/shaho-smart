import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QualificationEnrollmentComponent } from './qualification-enrollment.component';

describe('QualificationEnrollmentComponent', () => {
  let component: QualificationEnrollmentComponent;
  let fixture: ComponentFixture<QualificationEnrollmentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QualificationEnrollmentComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QualificationEnrollmentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
