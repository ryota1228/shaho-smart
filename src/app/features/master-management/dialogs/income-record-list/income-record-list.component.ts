import { Component, Input, Output, OnInit, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../../../shared/material/material.module';
import { MatDialog } from '@angular/material/dialog';
import { IncomeFormComponent } from '../income-form/income-form.component';
import { doc, deleteDoc } from '@angular/fire/firestore';
import { Firestore } from '@angular/fire/firestore';
import { MatChipsModule } from '@angular/material/chips';
import { MatChipListbox } from '@angular/material/chips';

@Component({
  selector: 'app-income-record-list',
  standalone: true,
  imports: [CommonModule, MaterialModule, MatChipsModule],
  templateUrl: './income-record-list.component.html',
  styleUrls: ['./income-record-list.component.scss']
})
export class IncomeRecordListComponent implements OnInit {
  @Input() companyId!: string;
  @Input() empNo!: string;
  @Input() incomeRecords: any[] = [];
  @Input() bonusMergedIntoMonthly: boolean = false;

  @Output() incomeRecordsChange = new EventEmitter<any[]>();

  constructor(private dialog: MatDialog, private firestore: Firestore) {}

  ngOnInit(): void {}

  getAllowanceTotal(row: any): number {
    return (row.allowances || []).reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
  }

  addRecord(): void {
    this.dialog.open(IncomeFormComponent, {
      data: {
        companyId: this.companyId,
        empNo: this.empNo
      },
      width: '900px'
    }).afterClosed().subscribe(result => {
      if (result) {
        this.upsertRecord(result);
      }
    });
  }

  editRecord(record: any): void {
    this.dialog.open(IncomeFormComponent, {
      data: {
        companyId: this.companyId,
        empNo: this.empNo,
        initialData: record
      },
      width: '900px'
    }).afterClosed().subscribe(result => {
      console.log('モーダルから受け取ったデータ:', result);
      if (result) {
        this.upsertRecord(result);
      }
    });
  }

  deleteRecord(applicableMonth: string): void {
    const confirmed = confirm(`"${applicableMonth}" の記録を削除しますか？`);
    if (!confirmed) return;
  
    const path = `companies/${this.companyId}/employees/${this.empNo}/incomeRecords/${applicableMonth}`;
    const ref = doc(this.firestore, path);
  
    deleteDoc(ref).then(() => {
      this.incomeRecords = this.incomeRecords.filter(r => r.applicableMonth !== applicableMonth);
      this.incomeRecordsChange.emit(this.incomeRecords);
    }).catch(err => {
      console.error('削除に失敗しました', err);
    });
  }  

  upsertRecord(record: any): void {
    const index = this.incomeRecords.findIndex(r => r.applicableMonth === record.applicableMonth);
    if (index !== -1) {
      this.incomeRecords[index] = record;
    } else {
      this.incomeRecords.push(record);
    }
  
    this.incomeRecords.sort((a, b) => b.applicableMonth.localeCompare(a.applicableMonth));
  
    this.incomeRecords = [...this.incomeRecords];
  
    this.incomeRecordsChange.emit(this.incomeRecords);
    console.log('incomeRecords 更新後:', this.incomeRecords);
  }

  getBaseSalaryAmount(row: any): number {
    const salaryType = row.salaryType || 'monthly';
    const base = row.baseAmount || 0;
  
    switch (salaryType) {
      case 'monthly':
        return base;
  
      case 'daily': {
        const days = row.workDays || 0;
        return base * days;
      }
  
      case 'hourly': {
        const hours = row.totalWorkingHours || 0;
        return base * hours;
      }
  
      default:
        return base;
    }
  }

  getInKindIncomeTotal(row: any): number {
    return (row.inKindIncome || []).reduce((sum: number, item: any) =>
      sum + ((item.taxable ?? true) ? (item.amount || 0) : 0),
    0);
  }
  
  
}