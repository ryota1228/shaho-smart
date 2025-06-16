import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material/material.module';

@Component({
  selector: 'app-custom-rates-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule],
  templateUrl: './custom-rates-dialog.component.html',
  styleUrls: ['./custom-rates-dialog.component.scss']
})
export class CustomRatesDialogComponent {

  form: {
    healthEmployee: string | null;
    healthCompany: string | null;
    careEmployee: string | null;
    careCompany: string | null;
  } = {
    healthEmployee: null,
    healthCompany: null,
    careEmployee: null,
    careCompany: null,
  };

  constructor(
    public dialogRef: MatDialogRef<CustomRatesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { existingRates?: any }
  ) {
    const rates = data.existingRates ?? {};
    this.form.healthEmployee = rates.health?.employee != null ? (parseFloat(rates.health.employee) * 100).toFixed(5) : null;
    this.form.healthCompany  = rates.health?.company  != null ? (parseFloat(rates.health.company)  * 100).toFixed(5) : null;
    this.form.careEmployee   = rates.care?.employee   != null ? (parseFloat(rates.care.employee)   * 100).toFixed(5) : null;
    this.form.careCompany    = rates.care?.company    != null ? (parseFloat(rates.care.company)    * 100).toFixed(5) : null;
  }

  save(): void {
    const result = {
      health: {
        employee: (parseFloat(this.form.healthEmployee ?? '0') / 100).toFixed(5),
        company: (parseFloat(this.form.healthCompany ?? '0') / 100).toFixed(5),
      },
      care: {
        employee: (parseFloat(this.form.careEmployee ?? '0') / 100).toFixed(5),
        company: (parseFloat(this.form.careCompany ?? '0') / 100).toFixed(5),
      }
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
