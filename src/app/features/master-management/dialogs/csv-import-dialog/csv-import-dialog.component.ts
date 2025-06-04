import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material/material.module';
import * as Papa from 'papaparse';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { Employee } from '../../../../core/models/employee.model';
import { IncomeRecord } from '../../../../core/models/income-record.model';
import { inject } from '@angular/core';


@Component({
  selector: 'app-csv-import-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './csv-import-dialog.component.html',
  styleUrls: ['./csv-import-dialog.component.scss']
})
export class CsvImportDialogComponent {
  parsedData: any[] = [];
  csvError: string | null = null;

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { companyId: string },
    private dialogRef: MatDialogRef<CsvImportDialogComponent>
  ) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        this.parsedData = result.data;
        this.csvError = null;
        console.log('📄 CSV読み込み成功:', this.parsedData);
      },
      error: (err) => {
        this.csvError = `CSV読み込み失敗: ${err.message}`;
        console.error('❌ CSVパースエラー:', err);
      }
    });
  }

  confirmImport(): void {
    this.dialogRef.close(this.parsedData);
  }

  close(): void {
    this.dialogRef.close();
  }
}
