import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QualificationManagementComponent } from './qualification-management.component';

describe('QualificationManagementComponent', () => {
  let component: QualificationManagementComponent;
  let fixture: ComponentFixture<QualificationManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QualificationManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(QualificationManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
