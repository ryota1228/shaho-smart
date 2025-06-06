import { Component, inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { format } from 'date-fns';
import { firstValueFrom } from 'rxjs';

import { FirestoreService } from '../../core/services/firestore.service';
import { AuthService } from '../../core/services/auth.service';
import { ReferenceTableService } from '../../core/services/reference-table.service';

import { Company } from '../../core/models/company.model';
import { Employee } from '../../core/models/employee.model';
import { SubmissionType } from '../../core/models/submission-record.model';
import { ActualPremiumMethod } from '../../core/models/actual-premium.model';
import { InsurancePremiumRecord, InsurancePremiumSnapshot, PremiumDetail } from '../../core/models/insurance-premium.model';
import { evaluateInsuranceStatus } from '../../core/utils/insurance-evaluator';
import { calculateInsurancePremiums, InsuranceRates } from '../../core/utils/calculateInsurancePremiums';
import { SalaryGrade } from '../../core/utils/salary-grade.util';

@Component({
  selector: 'app-insurance-submission',
  standalone: true,
  templateUrl: './insurance-submission.component.html',
  styleUrls: ['./insurance-submission.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTableModule,
    MatButtonModule
  ]
})
export class InsuranceSubmissionComponent implements OnInit {
  private fs = inject(FirestoreService);
  private auth = inject(AuthService);
  private ref = inject(ReferenceTableService);

  companies = signal<Company[]>([]);
  companyInfo = signal<Company | null>(null);
  selectedCompanyId = signal<string | null>(null);
  selectedMonth = signal<Date>(new Date());
  employees = signal<Employee[]>([]);
  incomeMap = signal<Record<string, Record<string, number>>>({});
  submissionMap = signal<Record<string, Record<string, string[]>>>({});

  insuranceRatesTable: Record<string, InsuranceRates> = {};
  healthGrades: SalaryGrade[] = [];
  pensionGrades: SalaryGrade[] = [];

  displayedColumns = ['empNo', 'name', 'alertType', 'actions'];

  alertEmployees = computed(() => {
    const list = this.employees();
    const monthStr = format(this.selectedMonth(), 'yyyy-MM');
    const incomeMap = this.incomeMap();
    const submissionMap = this.submissionMap();
    const isJuly = format(this.selectedMonth(), 'MM') === '07';

    return list.map(emp => {
      const join = emp.joinDate?.substring(0, 7);
      const leave = emp.leaveDate?.substring(0, 7);
      const empIncome = incomeMap[emp.empNo] ?? {};
      const april = empIncome['2025-04'];
      const june = empIncome['2025-06'];

      let alertType = '';
      if (join === monthStr) alertType = '資格取得（入社）';
      else if (leave === monthStr) alertType = '資格喪失（退職）';
      else if (isJuly) alertType = '定時決定対象';
      else if (april && june && Math.abs(june - april) >= 30000) alertType = '随時改定対象';

      if (!alertType) return null;

      const submissionType = this.alertTypeToType(alertType);
      const already = submissionMap[emp.empNo]?.[monthStr]?.includes(submissionType) ?? false;

      return { ...emp, alertType, alreadySubmitted: already };
    }).filter((emp): emp is Employee & { alertType: string; alreadySubmitted: boolean } => !!emp);
  });

  async ngOnInit(): Promise<void> {
    const uid = this.auth.getUid();
    if (!uid) return;

    const list = await firstValueFrom(this.fs.getCompanyListByUser(uid));
    this.companies.set(list);

    this.ref.loadAll().subscribe(({ salary, pension, rates }) => {
      this.healthGrades = salary;
      this.pensionGrades = pension;
      this.insuranceRatesTable = rates;
    });
  }

  async onCompanyChange(): Promise<void> {
    const companyId = this.selectedCompanyId();
    if (!companyId) return;

    const company = this.companies().find(c => c.companyId === companyId) ?? null;
    this.companyInfo.set(company);

    const list = await this.fs.getEmployeesForCompany(companyId).toPromise();
    this.employees.set(list ?? []);

    const incomeMap: Record<string, Record<string, number>> = {};
    const submissionMap: Record<string, Record<string, string[]>> = {};

    for (const emp of list ?? []) {
      const incomeRecords = await this.fs.getIncomeRecords(companyId, emp.empNo);
      for (const rec of incomeRecords) {
        if (!incomeMap[emp.empNo]) incomeMap[emp.empNo] = {};
        incomeMap[emp.empNo][rec.applicableMonth] = rec.totalIncome ?? 0;
      }

      const submissionRecords = await this.fs.getSubmissionRecords(companyId, emp.empNo);
      for (const sub of submissionRecords) {
        if (!submissionMap[emp.empNo]) submissionMap[emp.empNo] = {};
        if (!submissionMap[emp.empNo][sub.applicableMonth]) submissionMap[emp.empNo][sub.applicableMonth] = [];
        submissionMap[emp.empNo][sub.applicableMonth].push(sub.type);
      }
    }

    this.incomeMap.set(incomeMap);
    this.submissionMap.set(submissionMap);
  }

  // async onSubmit(): Promise<void> {
  //   const companyId = this.selectedCompanyId();
  //   const companyInfo = this.companyInfo();
  //   const operatorUid = this.auth.getUid() ?? 'system';
  //   const month = format(this.selectedMonth(), 'yyyy-MM');
  //   const submissionId = `${companyId}_${month}_${Date.now()}`;

  //   if (!companyId || !companyInfo) {
  //     alert('企業情報が不正です');
  //     return;
  //   }

  //   for (const emp of this.alertEmployees()) {
  //     try {
  //       const method = this.getMethodForAlert(emp.alertType);
  //       const incomeMap = this.incomeMap();
  //       const salary = incomeMap[emp.empNo]?.[month];

  //       if (!salary) {
  //         console.warn(`⚠ 月額報酬が未入力のためスキップ: ${emp.empNo}`);
  //         continue;
  //       }

  //       const updatedEmp: Employee = {
  //         ...emp,
  //         ...evaluateInsuranceStatus(emp, companyInfo, incomeMap)
  //       };

  //       await this.fs.saveEmployee(companyId, updatedEmp);

  //       const rawRecord = calculateInsurancePremiums(
  //         salary,
  //         updatedEmp,
  //         companyInfo,
  //         this.insuranceRatesTable,
  //         this.healthGrades,
  //         this.pensionGrades
  //       );

  //       if (!rawRecord) {
  //         console.error('❌ 保険料算出エラー（null）:', emp.empNo);
  //         continue;
  //       }

  //       const snapshot = toSnapshot(rawRecord);

  //       await this.fs.saveInsurancePremiumIfValid(
  //         companyId,
  //         emp.empNo,
  //         month,
  //         method,
  //         snapshot,
  //         operatorUid
  //       );

  //       await this.fs.saveActualPremiumRecord(
  //         companyId,
  //         emp.empNo,
  //         month,
  //         method,
  //         submissionId,
  //         operatorUid
  //       );

  //       console.log(`✅ 提出完了: ${emp.empNo}`);
  //     } catch (err) {
  //       console.error(`❌ 提出失敗 (${emp.empNo}):`, err);
  //     }
  //   }

  //   alert('提出が完了しました。');
  // }

  private getMethodForAlert(alertType: string): ActualPremiumMethod {
    switch (alertType) {
      case '資格取得（入社）': return 'qualification';
      case '資格喪失（退職）': return 'revised';
      case '定時決定対象': return 'fixed';
      case '随時改定対象': return 'revised';
      default: return 'fixed';
    }
  }

  private alertTypeToType(alert: string): SubmissionType {
    switch (alert) {
      case '資格取得（入社）': return 'acquire';
      case '資格喪失（退職）': return 'loss';
      case '定時決定対象': return 'fixed';
      case '随時改定対象': return 'revised';
      default: return 'fixed';
    }
  }
}

function toSnapshot(record: InsurancePremiumRecord): InsurancePremiumSnapshot {
  const empty: PremiumDetail = {
    grade: 0,
    premiumTotal: 0,
    premiumEmployee: 0,
    premiumCompany: 0
  };

  return {
    standardMonthlyAmount: record.standardMonthlyAmount ?? 0,
    healthGrade: record.healthGrade ?? 0,
    pensionGrade: record.pensionGrade ?? 0,
    careGrade: record.careGrade ?? 0,
    calculatedAt: record.calculatedAt,

    health: record.health ? {
      grade: record.healthGrade ?? 0,
      premiumTotal: record.health.total ?? 0,
      premiumEmployee: record.health.employee ?? 0,
      premiumCompany: record.health.company ?? 0
    } : empty,

    pension: record.pension ? {
      grade: record.pensionGrade ?? 0,
      premiumTotal: record.pension.total ?? 0,
      premiumEmployee: record.pension.employee ?? 0,
      premiumCompany: record.pension.company ?? 0
    } : empty,

    care: record.care ? {
      grade: record.careGrade ?? 0,
      premiumTotal: record.care.total ?? 0,
      premiumEmployee: record.care.employee ?? 0,
      premiumCompany: record.care.company ?? 0
    } : empty
  };
}

