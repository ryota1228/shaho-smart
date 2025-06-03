import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemChangeManagementComponent } from './system-change-management.component';

describe('SystemChangeManagementComponent', () => {
  let component: SystemChangeManagementComponent;
  let fixture: ComponentFixture<SystemChangeManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemChangeManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SystemChangeManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
