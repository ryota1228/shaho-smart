import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';

@Component({
  selector: 'app-payroll-export',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './payroll-export.component.html',
  styleUrls: ['./payroll-export.component.scss']
})
export class PayrollExportComponent {}
