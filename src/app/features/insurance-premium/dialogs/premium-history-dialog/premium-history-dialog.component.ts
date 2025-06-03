import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MaterialModule } from '../../../../shared/material/material.module';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { InsurancePremiumRecord } from '../../../../core/models/insurance-premium.model';

@Component({
  selector: 'app-premium-history-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MaterialModule],
  templateUrl: './premium-history-dialog.component.html',
  styleUrls: ['./premium-history-dialog.component.scss']
})
export class PremiumHistoryDialogComponent implements OnInit {
  premiums: InsurancePremiumRecord[] = [];
  loading = true;

  displayedColumns: string[] = ['month', 'health', 'pension', 'care'];
  premiumRecords: InsurancePremiumRecord[] = [];

  constructor(
    private dialogRef: MatDialogRef<PremiumHistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { companyId: string; empNo: string },
    private firestoreService: FirestoreService
  ) {}

  async ngOnInit(): Promise<void> {
    const { empNo, companyId } = this.data;
    const records = await this.firestoreService.getInsurancePremiumRecords(companyId, empNo);
    this.premiumRecords = records.sort((a, b) => b.applicableMonth.localeCompare(a.applicableMonth));
  }  

  close(): void {
    this.dialogRef.close();
  }
}
