import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material/material.module';
import { FirestoreService } from '../../../../core/services/firestore.service';

@Component({
  selector: 'app-bonus-summary',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './bonus-summary.component.html',
  styleUrls: ['./bonus-summary.component.scss']
})
export class BonusSummaryComponent implements OnInit {
  @Input() companyId!: string;
  @Input() empNo!: string;

  bonusRecords: { applicableMonth: string; amount: number }[] = [];

  constructor(private firestoreService: FirestoreService) {}

  async ngOnInit(): Promise<void> {
    this.bonusRecords = await this.firestoreService.getBonusRecords(this.companyId, this.empNo);
    this.bonusRecords.sort((a, b) => a.applicableMonth.localeCompare(b.applicableMonth));
  }

  get totalBonusAmount(): number {
    return this.bonusRecords.reduce((sum, r) => sum + (r.amount || 0), 0);
  }

  get bonusCount(): number {
    return this.bonusRecords.length;
  }

  getSummary(): {
    bonusCount: number;
    totalBonusAmount: number;
    bonusDetails: { applicableMonth: string; amount: number }[];
  } {
    return {
      bonusCount: this.bonusCount,
      totalBonusAmount: this.totalBonusAmount,
      bonusDetails: this.bonusRecords
    };
  }  

  async addBonusRecord(): Promise<void> {
    this.bonusRecords.push({
      applicableMonth: '',
      amount: 0
    });
  }

  async saveRecord(record: { applicableMonth: string; amount: number }): Promise<void> {
    if (!record.applicableMonth || !record.amount) return;
    await this.firestoreService.saveBonusRecord(this.companyId, this.empNo, record.applicableMonth, record);
  }
  
  async deleteRecord(index: number): Promise<void> {
    const record = this.bonusRecords[index];
    await this.firestoreService.deleteBonusRecord(this.companyId, this.empNo, record.applicableMonth);
    this.bonusRecords.splice(index, 1);
  }
  
}
