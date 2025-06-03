import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';

@Component({
  selector: 'app-qualification-management',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './qualification-management.component.html',
  styleUrls: ['./qualification-management.component.scss']
})
export class QualificationManagementComponent {}
