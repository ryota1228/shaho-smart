import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DependentEditDialogComponent } from './dependent-edit-dialog.component';

describe('DependentEditDialogComponent', () => {
  let component: DependentEditDialogComponent;
  let fixture: ComponentFixture<DependentEditDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DependentEditDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DependentEditDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
