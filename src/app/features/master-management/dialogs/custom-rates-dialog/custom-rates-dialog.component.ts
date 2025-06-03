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
  customRates: any;

  constructor(
    public dialogRef: MatDialogRef<CustomRatesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { existingRates?: any }
  ) {
    this.customRates = data.existingRates ?? {
      health: { employee: 0, employer: 0 },
      care: { employee: 0, employer: 0 }
    };
  }

  save(): void {
    this.dialogRef.close(this.customRates);
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
