import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';

@Component({
  selector: 'app-qualification-enrollment',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './qualification-enrollment.component.html',
  styleUrls: ['./qualification-enrollment.component.scss']
})
export class QualificationEnrollmentComponent {}
