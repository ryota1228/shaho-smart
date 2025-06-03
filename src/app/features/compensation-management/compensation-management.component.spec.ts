import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompensationManagementComponent } from './compensation-management.component';

describe('CompensationManagementComponent', () => {
  let component: CompensationManagementComponent;
  let fixture: ComponentFixture<CompensationManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompensationManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CompensationManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
