import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterManagementComponent } from './master-management.component';

describe('MasterManagementComponent', () => {
  let component: MasterManagementComponent;
  let fixture: ComponentFixture<MasterManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MasterManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MasterManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
