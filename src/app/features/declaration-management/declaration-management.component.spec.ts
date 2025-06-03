import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeclarationManagementComponent } from './declaration-management.component';

describe('DeclarationManagementComponent', () => {
  let component: DeclarationManagementComponent;
  let fixture: ComponentFixture<DeclarationManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeclarationManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DeclarationManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
