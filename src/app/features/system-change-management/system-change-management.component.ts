import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';

@Component({
  selector: 'app-system-change-management',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './system-change-management.component.html',
  styleUrls: ['./system-change-management.component.scss']
})
export class SystemChangeManagementComponent {}
