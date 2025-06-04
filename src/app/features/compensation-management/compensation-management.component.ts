import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { MaterialModule } from '../../shared/material/material.module';
import { Timestamp } from '@angular/fire/firestore';
import { Firestore, collection, doc, setDoc } from '@angular/fire/firestore';
import { inject, ChangeDetectorRef } from '@angular/core';
import { cleanData } from '../../core/services/firestore.service';

@Component({
  selector: 'app-compensation-management',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, MaterialModule],
  templateUrl: './compensation-management.component.html',
  styleUrls: ['./compensation-management.component.scss']
})
export class CompensationManagementComponent {
  private firestore = inject(Firestore);
  form: FormGroup;

  constructor(private fb: FormBuilder, private cdr: ChangeDetectorRef) {
    this.form = this.fb.group({
      salaryType: ['monthly', Validators.required],
      baseAmount: [null, Validators.required],
      workDays: [null],
      weeklyHours: [null],
      allowances: this.fb.array([]),
      bonus: [0],
      applicableMonth: [null, Validators.required]
    });
  }

  get allowances(): FormArray {
    return this.form.get('allowances') as FormArray;
  }

  formReady = true;

  addAllowance() {
    this.allowances.push(this.fb.group({
      name: ['', Validators.required],
      amount: [0, Validators.required]
    }));
  
    this.formReady = false;
    setTimeout(() => {
      this.formReady = true;
    }, 0);
  }
  

  removeAllowance(index: number) {
    this.allowances.removeAt(index);
  }

  calculateTotalMonthlyIncome(): number {
    const base = this.form.value.baseAmount || 0;
    const extras = this.allowances.value.reduce((sum: number, a: any) => sum + (a.amount || 0), 0);
    return base + extras;
  }

  calculateEstimatedAnnualIncome(): number {
    const monthly = this.calculateTotalMonthlyIncome();
    const bonus = this.form.value.bonus || 0;
    return (monthly * 12) + bonus;
  }

  async saveIncomeRecord(empNo: string) {
    const data = cleanData({
      ...this.form.value,
      totalMonthlyIncome: this.calculateTotalMonthlyIncome(),
      estimatedAnnualIncome: this.calculateEstimatedAnnualIncome(),
      createdAt: Timestamp.now()
    });
    
    const ym = this.form.value.applicableMonth;
    const ref = doc(this.firestore, `employees/${empNo}/incomeRecords/${ym}`);
    await setDoc(ref, data, { merge: true });    
  }
}
