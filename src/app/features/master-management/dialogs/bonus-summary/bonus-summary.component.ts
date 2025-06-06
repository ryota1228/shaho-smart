import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material/material.module';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { BonusRecordInput } from '../../../../core/models/bonus-premium.model';


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
  
  @Output() bonusChange = new EventEmitter<BonusRecordInput[]>();

  bonusRecords: BonusRecordInput[] = [];

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

  onRecordChanged() {
    this.bonusChange.emit([...this.bonusRecords]);
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
      amount: 0,
      includedInStandardBonus: false
    });
  }
  
  async deleteRecord(index: number): Promise<void> {
    const record = this.bonusRecords[index];
    this.bonusRecords.splice(index, 1);
    this.onRecordChanged();
  }

  isCheckboxEnabled(record: BonusRecordInput): boolean {
    const uniqueMonths = new Set(this.bonusRecords.map(r => r.applicableMonth));
    return uniqueMonths.size >= 4;
  }  
  
}
