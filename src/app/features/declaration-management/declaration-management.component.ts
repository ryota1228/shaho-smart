import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';

@Component({
  selector: 'app-declaration-management',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './declaration-management.component.html',
  styleUrls: ['./declaration-management.component.scss']
})
export class DeclarationManagementComponent {}
