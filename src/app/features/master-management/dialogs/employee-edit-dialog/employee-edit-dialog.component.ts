import { Component, Inject, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../../../shared/material/material.module';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { NgForm } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DependentEditDialogComponent } from '../income-form/../dependent-edit-dialog/dependent-edit-dialog.component';
import { ViewChild } from '@angular/core';
import { IncomeRecordListComponent } from '../income-record-list/income-record-list.component';
import { BonusSummaryComponent } from '../bonus-summary/bonus-summary.component';


@Component({
  selector: 'app-employee-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, DependentEditDialogComponent, IncomeRecordListComponent, BonusSummaryComponent],
  templateUrl: './employee-edit-dialog.component.html',
  styleUrls: ['./employee-edit-dialog.component.scss']
})
export class EmployeeEditDialogComponent implements OnInit, AfterViewInit {
  employee: any;
  isEdit: boolean;
  companyId: string;
  employmentTypes: string[] = [
    '正社員',
    '契約社員',
    '嘱託社員',
    '派遣社員',
    'パート',
    'アルバイト',
    '業務委託'
  ];

  jobCategories: string[] = [];

  incomeRecords: any[] = [];
  dependents: any[] = [];

  bonusSummary = {
    bonusCount: 0,
    totalBonusAmount: 0,
    bonusDetails: []
  };

  constructor(
    private dialogRef: MatDialogRef<EmployeeEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private firestoreService: FirestoreService,
    private snackbar: MatSnackBar,
  ) {
    this.employee = data?.employee ? { ...data.employee } : {
      empNo: '',
      lastName: '',
      firstName: '',
      lastNameKana: '',
      firstNameKana: '',
      dept: '',
      employmentType: '',
      jobCategory: '',
      weeklyHours: 0,
      joinDate: '',
      leaveDate: '',
      birthday: '',
      gender: undefined,
      studentStatus: '',
      note: '',
      expectedDuration: '',
    };
    this.isEdit = !!data?.employee;
    this.companyId = data?.companyId;
  }

  @ViewChild(DependentEditDialogComponent) dependentForm!: DependentEditDialogComponent;

  @ViewChild(BonusSummaryComponent) bonusSummaryComp!: BonusSummaryComponent;

  ngOnInit(): void {
    if (!this.employee?.empNo || !this.companyId) return;

    this.firestoreService.getIncomeRecords(this.companyId, this.employee.empNo)
      .then(records => {
        this.incomeRecords = records.sort((a, b) =>
          (b.applicableMonth || '').localeCompare(a.applicableMonth || '')
        );
      })
      .catch(err => {
        console.error('報酬履歴の取得に失敗', err);
        this.incomeRecords = [];
      });
  }

  ngAfterViewInit(): void {
    if (!this.employee?.empNo || !this.companyId) return;

    this.firestoreService.getDependents(this.companyId, this.employee.empNo)
      .then(deps => {
        this.dependents = deps;
      })
      .catch(err => {
        console.error('扶養者情報の取得に失敗', err);
        this.dependents = [];
      });
  }

  async save(form: NgForm): Promise<void> {
    if (form.invalid) {
      Object.values(form.controls).forEach(control => control.markAsTouched());
      this.snackbar.open('必須項目が未入力です。ご確認ください。', '閉じる', { duration: 3000 });
      return;
    }
  
    const bonusSummary = this.bonusSummaryComp?.getSummary() ?? {
      bonusCount: 0,
      totalBonusAmount: 0,
      bonusDetails: []
    };
  
    this.dialogRef.close({
      ...this.employee,
      bonusSummary,
      incomeRecords: this.incomeRecords,
      dependents: this.dependents
    });
  }
  

  onBonusChange(updated: any): void {
    this.bonusSummary = { ...updated };
  }

checkForWarnings(): string[] {
    const warnings: string[] = [];
    const h = this.employee.weeklyHours;

    switch (this.employee.workStyle) {
      case '常勤（週40h）': if (h < 30) warnings.push('勤務形態が「常勤」なのに週30時間未満です'); break;
      case '短時間（週30h未満）': if (h >= 30) warnings.push('勤務形態が「短時間」なのに週30時間以上です'); break;
      case '非常勤（週20h未満）': if (h >= 20) warnings.push('勤務形態が「非常勤」なのに週20時間以上です'); break;
    }

    if (this.employee.employmentType === '業務委託' && h > 40) {
      warnings.push('「業務委託」で週40時間超は労働契約と矛盾する可能性があります');
    }

    if (this.employee.studentStatus !== 'none' && this.employee.workStyle === '常勤（週40h）') {
      warnings.push('学生区分の従業員が「常勤」となっています（厚生年金の適用除外対象か確認が必要）');
    }

    return warnings;
  }
}