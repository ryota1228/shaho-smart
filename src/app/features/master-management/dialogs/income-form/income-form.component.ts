import { Component, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { MaterialModule } from '../../../../shared/material/material.module';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { FirestoreService } from '../../../../core/services/firestore.service';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-income-form',
  standalone: true,
  imports: [CommonModule, MaterialModule, ReactiveFormsModule],
  templateUrl: './income-form.component.html',
  styleUrls: ['./income-form.component.scss']
})
export class IncomeFormComponent implements OnInit {
  form!: FormGroup;

  constructor(
    @Inject(MAT_DIALOG_DATA)
    public data: {
      companyId: string;
      empNo: string;
      initialData?: any;
    },
    private dialogRef: MatDialogRef<IncomeFormComponent>,
    private fb: FormBuilder,
    private firestoreService: FirestoreService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.form = this.createForm();
    if (this.data.initialData) {
      this.patchInitialData(this.data.initialData);
    }
  }

  private createForm(): FormGroup {
    return this.fb.group({
      salaryType: ['monthly', Validators.required],
      baseAmount: [null, Validators.required],
      workDays: [null],
      workingHoursPerDay: [null],
      allowances: this.fb.array([]),
      inKindIncome: this.fb.array([]),
      bonus: [0],
      applicableMonth: [null, Validators.required]
    });
  }  

  private patchInitialData(data: any): void {
    this.form.patchValue(data);
  
    this.allowances.clear();
    (data.allowances || []).forEach((a: any) => {
      this.allowances.push(this.fb.group({
        name: [a.name, Validators.required],
        amount: [a.amount, Validators.required],
        includedInRemuneration: [a.includedInRemuneration ?? true]
      }));
    });
  
    this.inKindIncome.clear();
    (data.inKindIncome || []).forEach((k: any) => {
      this.inKindIncome.push(this.fb.group({
        name: [k.name, Validators.required],
        amount: [k.amount, Validators.required],
        taxable: [k.taxable]
      }));
    });
  }  

  get allowances(): FormArray {
    return this.form.get('allowances') as FormArray;
  }

  get inKindIncome(): FormArray {
    return this.form.get('inKindIncome') as FormArray;
  }

  addAllowance(): void {
    this.allowances.push(this.fb.group({
      name: ['', Validators.required],
      amount: [0, Validators.required],
      includedInRemuneration: [true]
    }));
    this.cdr.detectChanges();
  }

  removeAllowance(index: number) {
    this.allowances.removeAt(index);
  }

  addInKindIncome(): void {
    this.inKindIncome.push(this.fb.group({
      name: ['', Validators.required],
      amount: [0, Validators.required],
      taxable: [true]
    }));
    this.cdr.detectChanges();
  }
  
  removeInKindIncome(index: number): void {
    this.inKindIncome.removeAt(index);
  }

  calculateTotalMonthlyIncome(): number {
    const { salaryType, baseAmount = 0, workDays = 0, totalWorkingHours = 0, standardWorkDays = 21, absenceDays = 0 } = this.form.value;
  
    const extras = this.allowances.value.reduce((sum: number, a: any) => sum + ((a.includedInRemuneration ?? true) ? (a.amount || 0) : 0),0);
    const inKind = this.inKindIncome.value.reduce((sum: number, k: any) => sum + (k.taxable ? k.amount || 0 : 0), 0);
    const totalExtra = extras + inKind;
  
    switch (salaryType) {
      case 'monthly': {
        const dailyRate = baseAmount / standardWorkDays;
        const deduction = dailyRate * absenceDays;
        return Math.max(0, baseAmount - deduction) + totalExtra;
      }
      case 'daily': {
        return baseAmount * workDays + totalExtra;
      }
      case 'hourly': {
        return baseAmount * totalWorkingHours + totalExtra;
      }
      default:
        return 0;
    }
  }  
  

  calculateEstimatedAnnualIncome(): number {
    const monthly = this.calculateTotalMonthlyIncome();
    const bonus = this.form.value.bonus || 0;
    return (monthly * 12) + bonus;
  }

  async save(): Promise<void> {
    const value = this.form.value;
    const ym = value.applicableMonth;
    const path = `companies/${this.data.companyId}/employees/${this.data.empNo}/incomeRecords/${ym}`;

    const enriched = {
      ...value,
      totalMonthlyIncome: this.calculateTotalMonthlyIncome(),
      estimatedAnnualIncome: this.calculateEstimatedAnnualIncome(),
      createdAt: new Date().toISOString()
    };

    try {
      await this.firestoreService.saveIncomeRecord(this.data.companyId, this.data.empNo, ym, enriched);
      this.dialogRef.close(enriched);
    } catch (err) {
      console.error('Firestore保存エラー:', err);
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}