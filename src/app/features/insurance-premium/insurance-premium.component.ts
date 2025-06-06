import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../core/services/firestore.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Company } from '../../core/models/company.model';
import { Employee } from '../../core/models/employee.model';
import { MatDialog } from '@angular/material/dialog';
import { PremiumHistoryDialogComponent } from './dialogs/premium-history-dialog/premium-history-dialog.component';
import { calculateInsurancePremiums, InsuranceRates } from '../../core/utils/calculateInsurancePremiums';
import { SalaryGrade, parseSalaryGrades } from '../../core/utils/salary-grade.util';
import { evaluateInsuranceStatus } from '../../core/utils/insurance-evaluator';
import { EmployeeInsurancePremiums, InsurancePremiumSnapshot } from '../../core/models/insurance-premium.model';


@Component({
  selector: 'app-insurance-premium',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './insurance-premium.component.html',
  styleUrls: ['./insurance-premium.component.scss']
})
export class InsurancePremiumComponent implements OnInit {
  companyList: Company[] = [];
  selectedCompanyId: string | null = null;
  selectedCompany: Company | null = null;

  allEmployees: Employee[] = [];
  displayEmployees: any[] = [];
  healthInsuranceDetailOpenAll = false;
  pensionInsuranceDetailOpenAll = false;
  careInsuranceDetailOpenAll = false;

  selectedMonth: string = '';

  salaryGradeTable: SalaryGrade[] = [];
  insuranceRatesTable: Record<string, InsuranceRates> = {};
  pensionGradeTable: SalaryGrade[] = [];

  bonusEmployees: any[] = []
  bonusHealthDetailOpenAll = false;
  bonusPensionDetailOpenAll = false;
  bonusCareDetailOpenAll = false;

  devForceAllButtons = false;


  constructor(
    private firestoreService: FirestoreService,
    private authService: AuthService,
    private http: HttpClient,
    private dialog: MatDialog
  ) {}

  async ngOnInit(): Promise<void> {
    this.http.get<Record<string, InsuranceRates>>('assets/data/prefecture-insurance-rates.json')
      .subscribe(data => this.insuranceRatesTable = data);

    this.http.get<SalaryGrade[]>('assets/data/salary-grade.json')
      .subscribe(data => {
        this.salaryGradeTable = parseSalaryGrades(data);
      });

    this.http.get<SalaryGrade[]>('assets/data/pension-grade.json')
      .subscribe(data => {
        this.pensionGradeTable = parseSalaryGrades(data);
      });

    const uid = this.authService.getUid();
    if (!uid) return;

    this.firestoreService.getCompanyListByUser(uid).subscribe(companies => {
      this.companyList = companies;
    });
  }

  selectCompany(company: Company): void {
    this.selectedCompanyId = company.companyId;
    this.selectedCompany = company;

    this.firestoreService.getEmployeesForCompany(company.companyId).subscribe(emps => {
      this.allEmployees = emps;
      this.loadSavedPremiums();
    });
  }

  async calculateAllPremiums(): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;

    const promises = this.allEmployees.map(async emp => {
      const income = await this.firestoreService.getIncomeRecords(this.selectedCompanyId!, emp.empNo);
      const monthData = income.find(i => i.applicableMonth === this.selectedMonth);
      if (!monthData || !monthData.totalMonthlyIncome) {
        return this.nullPremiums(emp);
      }

      const salary = monthData.totalMonthlyIncome;
      

      const enrichedEmp = {
        ...emp,
        ...evaluateInsuranceStatus(emp, this.selectedCompany!, monthData)
      };
      
      const premiumResult = calculateInsurancePremiums(
        salary,
        enrichedEmp,
        this.selectedCompany!,
        this.insuranceRatesTable,
        this.salaryGradeTable,  
        this.pensionGradeTable
      );
      

      if (!premiumResult) return this.nullPremiums(emp);

      await this.firestoreService.saveInsurancePremium(
        this.selectedCompanyId!,
        emp.empNo,
        this.selectedMonth,
        {
          companyId: this.selectedCompanyId!,
          empNo: emp.empNo,
          applicableMonth: this.selectedMonth,
          standardMonthlyAmount: premiumResult.standardMonthlyAmount,
          healthGrade: premiumResult.healthGrade,
          pensionGrade: premiumResult.pensionGrade,
          careGrade: premiumResult.careGrade,
          calculatedAt: premiumResult.calculatedAt,
          health: premiumResult.health,
          pension: premiumResult.pension,
          care: premiumResult.care ?? null,
        }
      );
      

      return {
        ...emp,
        healthInsuranceEmployee: premiumResult.health.employee,
        healthInsuranceCompany: premiumResult.health.company,
        healthInsuranceAmount: premiumResult.health.total,
        healthInsuranceDetailOpen: false,
        pensionInsuranceEmployee: premiumResult.pension.employee,
        pensionInsuranceCompany: premiumResult.pension.company,
        pensionInsuranceAmount: premiumResult.pension.total,
        pensionInsuranceDetailOpen: false,
        careInsuranceEmployee: premiumResult.care?.employee ?? null,
        careInsuranceCompany: premiumResult.care?.company ?? null,
        careInsuranceAmount: premiumResult.care?.total ?? null,
        careInsuranceDetailOpen: false
      };
    });

    this.displayEmployees = await Promise.all(promises);
  }

  nullPremiums(emp: any) {
    return {
      ...emp,
      healthInsuranceEmployee: null,
      healthInsuranceCompany: null,
      healthInsuranceAmount: null,
      healthInsuranceDetailOpen: false,
      pensionInsuranceEmployee: null,
      pensionInsuranceCompany: null,
      pensionInsuranceAmount: null,
      pensionInsuranceDetailOpen: false,
      careInsuranceEmployee: null,
      careInsuranceCompany: null,
      careInsuranceAmount: null,
      careInsuranceDetailOpen: false
    };
  }

  onMonthChange(): void {
    this.loadSavedPremiums();
    this.loadBonusPremiums();
  }

  toggleColumnDetail(type: 'healthInsurance' | 'pensionInsurance' | 'careInsurance'): void {
    switch (type) {
      case 'healthInsurance':
        this.healthInsuranceDetailOpenAll = !this.healthInsuranceDetailOpenAll;
        this.displayEmployees.forEach(emp => {
          emp.healthInsuranceDetailOpen = this.healthInsuranceDetailOpenAll;
        });
        break;
      case 'pensionInsurance':
        this.pensionInsuranceDetailOpenAll = !this.pensionInsuranceDetailOpenAll;
        this.displayEmployees.forEach(emp => {
          emp.pensionInsuranceDetailOpen = this.pensionInsuranceDetailOpenAll;
        });
        break;
      case 'careInsurance':
        this.careInsuranceDetailOpenAll = !this.careInsuranceDetailOpenAll;
        this.displayEmployees.forEach(emp => {
          emp.careInsuranceDetailOpen = this.careInsuranceDetailOpenAll;
        });
        break;
    }
  }

  openPremiumHistory(employee: Employee): void {
    this.dialog.open(PremiumHistoryDialogComponent, {
      width: '640px',
      data: {
        empNo: employee.empNo,
        companyId: this.selectedCompanyId
      }
    });
  }

  exportMonthlyPremiums(): void {
    if (!this.selectedMonth || this.displayEmployees.length === 0) return;

    const headers = [
      '社員番号', '氏名',
      '健康保険料（本人）', '健康保険料（会社）', '健康保険料（合計）',
      '厚生年金保険料（本人）', '厚生年金保険料（会社）', '厚生年金保険料（合計）',
      '介護保険料（本人）', '介護保険料（会社）', '介護保険料（合計）'
    ];

    const rows = this.displayEmployees.map(emp => [
      emp.empNo,
      `${emp.lastName} ${emp.firstName}`,
      emp.healthInsuranceEmployee ?? '',
      emp.healthInsuranceCompany ?? '',
      emp.healthInsuranceAmount ?? '',
      emp.pensionInsuranceEmployee ?? '',
      emp.pensionInsuranceCompany ?? '',
      emp.pensionInsuranceAmount ?? '',
      emp.careInsuranceEmployee ?? '',
      emp.careInsuranceCompany ?? '',
      emp.careInsuranceAmount ?? ''
    ]);

    const csvContent =
      [headers, ...rows].map(e => e.map(v => `"${v}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `保険料_${this.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  getTotalPremiums(): {
    health: number;
    pension: number;
    care: number;
    total: number;
  } {
    let health = 0;
    let pension = 0;
    let care = 0;

    for (const emp of this.displayEmployees) {
      health += emp.healthInsuranceAmount ?? 0;
      pension += emp.pensionInsuranceAmount ?? 0;
      care += emp.careInsuranceAmount ?? 0;
    }

    return {
      health,
      pension,
      care,
      total: health + pension + care
    };
  }

  async loadSavedPremiums(): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const promises = this.allEmployees.map(async emp => {
      const actuals = await this.firestoreService.getActualPremiumRecords(
        this.selectedCompanyId!,
        emp.empNo
      );
  
      const qualification = actuals.find(
        r => r.applicableMonth === this.selectedMonth && r.method === 'qualification'
      );
      const fixed = actuals.find(
        r => r.applicableMonth === `${this.selectedMonth.split('-')[0]}-09` && r.method === 'fixed'
      );
      const loss = actuals.find(
        r => r.applicableMonth === this.selectedMonth && r.method === 'loss'
      );
  
      // 随時改定ボタンの判定
      let canRegisterRevised = false;
      if (fixed && !this.devForceAllButtons) {
        const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId!, emp.empNo);
        const latest = incomeRecords.sort((a, b) => b.applicableMonth.localeCompare(a.applicableMonth))[0];
        const fixedBase = fixed.health?.total ?? null;
        if (fixedBase && latest?.totalIncome) {
          const diff = Math.abs(latest.totalIncome - fixedBase);
          canRegisterRevised = diff >= 30000;
        }
      }
  
      // 資格取得ボタンの判定（actualPremiums ベースに修正）
      const joinStr = typeof emp.joinDate === 'string'
        ? emp.joinDate.substring(0, 7)
        : new Date(emp.joinDate).toISOString().substring(0, 7);
      const isThisMonthJoin = joinStr === this.selectedMonth;
      const alreadyRegisteredQualification = !!qualification;
      const canRegisterQualification = isThisMonthJoin && !alreadyRegisteredQualification;
  
      // 定時決定ボタンの判定
      let canRegisterFixed = false;
      if (!fixed && !this.devForceAllButtons) {
        const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId!, emp.empNo);
        const apr = incomeRecords.find(i => i.applicableMonth === `${this.selectedMonth.split('-')[0]}-04`);
        const may = incomeRecords.find(i => i.applicableMonth === `${this.selectedMonth.split('-')[0]}-05`);
        const jun = incomeRecords.find(i => i.applicableMonth === `${this.selectedMonth.split('-')[0]}-06`);
        canRegisterFixed = !!(apr?.totalIncome && may?.totalIncome && jun?.totalIncome);
      }
  
      // 喪失ボタンの判定
      const canRegisterLoss = !loss && emp.leaveDate?.slice(0, 7) === this.selectedMonth;
  
      return {
        ...emp,
        alreadyRegisteredQualification: !!qualification,
        alreadyRegisteredFixed: !!fixed,
        alreadyRegisteredLoss: !!loss,
        canRegisterRevised: this.devForceAllButtons || canRegisterRevised,
        canRegisterQualification: this.devForceAllButtons || canRegisterQualification,
        canRegisterFixed: this.devForceAllButtons || canRegisterFixed,
        canRegisterLoss: this.devForceAllButtons || canRegisterLoss,
      
        // ↓ fixed があればそちらを優先して表示
        standardMonthlyAmount: (fixed ?? qualification)?.health?.total ?? null,
      
        healthInsuranceEmployee: (fixed ?? qualification)?.health?.employee ?? null,
        healthInsuranceCompany: (fixed ?? qualification)?.health?.company ?? null,
        healthInsuranceAmount:
          ((fixed ?? qualification)?.health?.employee ?? 0) +
          ((fixed ?? qualification)?.health?.company ?? 0),
        healthInsuranceDetailOpen: false,
      
        pensionInsuranceEmployee: (fixed ?? qualification)?.pension?.employee ?? null,
        pensionInsuranceCompany: (fixed ?? qualification)?.pension?.company ?? null,
        pensionInsuranceAmount:
          ((fixed ?? qualification)?.pension?.employee ?? 0) +
          ((fixed ?? qualification)?.pension?.company ?? 0),
        pensionInsuranceDetailOpen: false,
      
        careInsuranceEmployee: (fixed ?? qualification)?.care?.employee ?? null,
        careInsuranceCompany: (fixed ?? qualification)?.care?.company ?? null,
        careInsuranceAmount:
          ((fixed ?? qualification)?.care?.employee ?? 0) +
          ((fixed ?? qualification)?.care?.company ?? 0),
        careInsuranceDetailOpen: false
      };      
    });
  
    this.displayEmployees = await Promise.all(promises);
  }  

  async loadBonusPremiums(): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const promises = this.allEmployees.map(async emp => {
      const bonusRecords = await this.firestoreService.getBonusPremiumRecords(this.selectedCompanyId!, emp.empNo);
      const monthRecord = bonusRecords.find(b => b.applicableMonth === this.selectedMonth);
  
      return {
        ...emp,
        bonusStandardAmount: monthRecord?.standardBonusAmount ?? null,
  
        bonusHealth: monthRecord?.health?.total ?? null,
        bonusHealthEmployee: monthRecord?.health?.employee ?? null,
        bonusHealthCompany: monthRecord?.health?.company ?? null,
        bonusHealthDetailOpen: false,
  
        bonusPension: monthRecord?.pension?.total ?? null,
        bonusPensionEmployee: monthRecord?.pension?.employee ?? null,
        bonusPensionCompany: monthRecord?.pension?.company ?? null,
        bonusPensionDetailOpen: false,
  
        bonusCare: monthRecord?.care?.total ?? null,
        bonusCareEmployee: monthRecord?.care?.employee ?? null,
        bonusCareCompany: monthRecord?.care?.company ?? null,
        bonusCareDetailOpen: false
      };
    });
  
    this.bonusEmployees = await Promise.all(promises);
  }  

  toggleBonusDetail(type: 'health' | 'pension' | 'care'): void {
    switch (type) {
      case 'health':
        this.bonusHealthDetailOpenAll = !this.bonusHealthDetailOpenAll;
        this.bonusEmployees.forEach(emp => emp.bonusHealthDetailOpen = this.bonusHealthDetailOpenAll);
        break;
      case 'pension':
        this.bonusPensionDetailOpenAll = !this.bonusPensionDetailOpenAll;
        this.bonusEmployees.forEach(emp => emp.bonusPensionDetailOpen = this.bonusPensionDetailOpenAll);
        break;
      case 'care':
        this.bonusCareDetailOpenAll = !this.bonusCareDetailOpenAll;
        this.bonusEmployees.forEach(emp => emp.bonusCareDetailOpen = this.bonusCareDetailOpenAll);
        break;
    }
  }

  getTotalBonusPremiums(): {
    health: number;
    pension: number;
    care: number;
    total: number;
  } {
    let health = 0;
    let pension = 0;
    let care = 0;
  
    for (const emp of this.bonusEmployees) {
      health += emp.bonusHealth ?? 0;
      pension += emp.bonusPension ?? 0;
      care += emp.bonusCare ?? 0;
    }
  
    return {
      health,
      pension,
      care,
      total: health + pension + care
    };
  }

  async shouldShowQualification(emp: Employee & any): Promise<boolean> {
    if (this.devForceAllButtons) return true;
  
    if (!emp.joinDate || !this.selectedMonth || !this.selectedCompanyId) return false;
  
    const joinDate = new Date(emp.joinDate);
    const joinStr = `${joinDate.getFullYear()}-${String(joinDate.getMonth() + 1).padStart(2, '0')}`;
  
    const isThisMonthJoin = joinStr === this.selectedMonth;
    if (!isThisMonthJoin) return false;
  
    const actuals = await this.firestoreService.getActualPremiumRecords(
      this.selectedCompanyId,
      emp.empNo
    );
  
    const alreadyExists = actuals.some(
      r => r.method === 'qualification' && r.applicableMonth === this.selectedMonth
    );
  
    return !alreadyExists;
  }
  
  async registerQualification(emp: Employee): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
    const thisMonthIncome = incomeRecords.find(r => r.applicableMonth === this.selectedMonth);
  
    if (!thisMonthIncome || !thisMonthIncome.totalMonthlyIncome) {
      alert(`${this.selectedMonth} の報酬データが存在しません`);
      return;
    }
  
    const enriched = {
      ...emp,
      ...evaluateInsuranceStatus(emp, this.selectedCompany, thisMonthIncome)
    };
  
    const raw = calculateInsurancePremiums(
      thisMonthIncome.totalMonthlyIncome,
      enriched,
      this.selectedCompany,
      this.insuranceRatesTable,
      this.salaryGradeTable,
      this.pensionGradeTable
    );
  
    if (!raw) {
      alert('保険料計算に失敗しました');
      return;
    }
  
    const snapshot: InsurancePremiumSnapshot = {
      standardMonthlyAmount: raw.standardMonthlyAmount,
      healthGrade: raw.healthGrade!,
      pensionGrade: raw.pensionGrade!,
      careGrade: raw.careGrade ?? null,
      calculatedAt: raw.calculatedAt,
      health: {
        grade: raw.healthGrade!,
        premiumEmployee: raw.health.employee!,
        premiumCompany: raw.health.company!,
        premiumTotal: raw.health.total!
      },
      pension: {
        grade: raw.pensionGrade!,
        premiumEmployee: raw.pension.employee!,
        premiumCompany: raw.pension.company!,
        premiumTotal: raw.pension.total!
      },
      care: raw.care
        ? {
            grade: raw.careGrade!,
            premiumEmployee: raw.care.employee!,
            premiumCompany: raw.care.company!,
            premiumTotal: raw.care.total!
          }
        : null
    };
  
    try {
      const uid = this.authService.getUid() ?? 'system';
  
      const [joinYear, joinMonth] = this.selectedMonth.split('-').map(Number);
      const isBeforeJune = joinMonth <= 5;
      const endYear = isBeforeJune ? joinYear : joinYear + 1;
      
      const endDate = new Date(endYear, 8, 1);
      const months: string[] = [];
      let date = new Date(joinYear, joinMonth - 1, 1);
      
      while (date < endDate) {
        const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        months.push(yyyymm);
        date.setMonth(date.getMonth() + 1);
      }
      
  
      // Firestore 保存ループ
      for (const month of months) {
        await this.firestoreService.saveActualPremiumRecord(
          this.selectedCompanyId,
          emp.empNo,
          month,
          'qualification',
          snapshot,
          uid
        );
      }
  
      alert(`資格取得保険料を ${months.length}か月分 登録しました`);
      (emp as any).alreadyRegisteredQualification = true;
    } catch (e: any) {
      alert(e?.message || '登録済み、または保存エラー');
    }
  
    await this.loadSavedPremiums();
  }  

  // 2. shouldShowFixed()
  async shouldShowFixed(emp: Employee & any): Promise<boolean> {
    if (this.devForceAllButtons) return true;
    if (!this.selectedCompanyId) return false;
  
    // 📆 実時間ベースで 6月 or 7月 の場合のみ表示
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (currentMonth !== 6 && currentMonth !== 7) return false;
  
    // 🔍 実際の4〜6月データを取得
    const year = now.getFullYear(); // ※前提として今年の定時決定
    const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
    const apr = incomeRecords.find(i => i.applicableMonth === `${year}-04`);
    const may = incomeRecords.find(i => i.applicableMonth === `${year}-05`);
    const jun = incomeRecords.find(i => i.applicableMonth === `${year}-06`);
  
    const hasValid = (r: any) => r?.totalIncome || r?.totalMonthlyIncome;
    const isComplete = hasValid(apr) || hasValid(may) || hasValid(jun);
    if (!isComplete) return false;
  
    // 🧾 すでに fixed 登録済みなら表示しない
    const actuals = await this.firestoreService.getActualPremiumRecords(this.selectedCompanyId, emp.empNo);
    const hasFixed = actuals.some(r => r.method === 'fixed');
    return !hasFixed;
  }
  
// 3. registerFixed()

async registerFixed(emp: Employee): Promise<void> {
  if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;

  const incomeRecords = await this.firestoreService.getIncomeRecords(
    this.selectedCompanyId,
    emp.empNo
  );

  const targetYear = parseInt(this.selectedMonth.split('-')[0]);
  const joinDate = new Date(emp.joinDate);
  const joinYear = joinDate.getFullYear();
  const joinMonth = joinDate.getMonth() + 1; // 1月 = 1

  let requiredMonths: string[] = [];

  if (joinYear < targetYear || (joinYear === targetYear && joinMonth <= 3)) {
    requiredMonths = [`${targetYear}-04`, `${targetYear}-05`, `${targetYear}-06`];
  } else if (joinYear === targetYear && joinMonth === 4) {
    requiredMonths = [`${targetYear}-05`, `${targetYear}-06`];
  } else if (joinYear === targetYear && joinMonth === 5) {
    requiredMonths = [`${targetYear}-06`];
  } else {
    alert(`この従業員は ${targetYear}年の定時決定対象外です（${joinYear}年${joinMonth}月入社）`);
    return;
  }

  const missing = requiredMonths.filter(month =>
    !incomeRecords.some(r => r.applicableMonth === month && r.totalMonthlyIncome != null)
  );

  if (missing.length > 0) {
    alert(`${missing.join('、')} の報酬データが存在しません`);
    return;
  }

  const relevantRecords = incomeRecords.filter(r =>
    requiredMonths.includes(r.applicableMonth)
  );

  const avgIncome = relevantRecords.reduce((sum, r) => sum + (r.totalMonthlyIncome ?? 0), 0) / relevantRecords.length;

  const enriched = {
    ...emp,
    ...evaluateInsuranceStatus(emp, this.selectedCompany, {
      ...relevantRecords[relevantRecords.length - 1],
      totalMonthlyIncome: avgIncome
    })
  };

  const raw = calculateInsurancePremiums(
    avgIncome,
    enriched,
    this.selectedCompany,
    this.insuranceRatesTable,
    this.salaryGradeTable,
    this.pensionGradeTable
  );

  if (!raw) {
    alert('保険料計算に失敗しました');
    return;
  }

  const snapshot: InsurancePremiumSnapshot = {
    standardMonthlyAmount: raw.standardMonthlyAmount,
    healthGrade: raw.healthGrade!,
    pensionGrade: raw.pensionGrade!,
    careGrade: raw.careGrade ?? null,
    calculatedAt: raw.calculatedAt,
    health: {
      grade: raw.healthGrade!,
      premiumEmployee: raw.health.employee!,
      premiumCompany: raw.health.company!,
      premiumTotal: raw.health.total!
    },
    pension: {
      grade: raw.pensionGrade!,
      premiumEmployee: raw.pension.employee!,
      premiumCompany: raw.pension.company!,
      premiumTotal: raw.pension.total!
    },
    care: raw.care
      ? {
          grade: raw.careGrade!,
          premiumEmployee: raw.care.employee!,
          premiumCompany: raw.care.company!,
          premiumTotal: raw.care.total!
        }
      : null
  };

  try {
    const uid = this.authService.getUid() ?? 'system';
    const startYear = targetYear;
    const months = Array.from({ length: 12 }).map((_, i) => {
      const date = new Date(startYear, 8 + i); // 8 = September
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });

    for (const month of months) {
      await this.firestoreService.saveActualPremiumRecord(
        this.selectedCompanyId!,
        emp.empNo,
        month,
        'fixed',
        snapshot,
        uid
      );
    }

    alert('定時決定保険料（12か月分）を登録しました');
    (emp as any).alreadyRegisteredFixed = true;
  } catch (e: any) {
    alert(e?.message || '保存エラー');
  }

  await this.loadSavedPremiums();
}

async shouldShowRevised(emp: Employee & any): Promise<boolean> {

  if (this.devForceAllButtons) return true;

  if (!this.selectedMonth) return false;

  // fixed が存在しなければ対象外
  const actuals = await this.firestoreService.getActualPremiumRecords(this.selectedCompanyId!, emp.empNo);
  const hasFixed = actuals.some(a => a.method === 'fixed');
  if (!hasFixed) return false;

  // 最新月の報酬を取得（例: 8月）
  const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId!, emp.empNo);
  const latest = incomeRecords.sort((a, b) => b.applicableMonth.localeCompare(a.applicableMonth))[0];
  if (!latest || !latest.totalIncome) return false;

  // fixed（＝7月の actual）を探す
  const fixed = actuals.find(a => a.method === 'fixed' && a.applicableMonth === `${this.selectedMonth.split('-')[0]}-07`);
  const fixedBase = fixed?.health?.total ?? null;

  if (!fixedBase) return false;

  // 変動幅の比較
  const diff = Math.abs(latest.totalIncome - fixedBase);
  return diff >= 30000; // 条件：3万円以上の差
}

async registerRevised(emp: Employee): Promise<void> {
  if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;

  const uid = this.authService.getUid() ?? 'system';

  // 最新の報酬データ
  const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
  const latest = incomeRecords.find(r => r.applicableMonth === this.selectedMonth);
  if (!latest || !latest.totalIncome) {
    alert('この月の報酬データが存在しません');
    return;
  }

  // 資格・会社情報で保険料再算出
  const enriched = {
    ...emp,
    ...evaluateInsuranceStatus(emp, this.selectedCompany, latest)
  };

  const raw = calculateInsurancePremiums(
    latest.totalIncome,
    enriched,
    this.selectedCompany,
    this.insuranceRatesTable,
    this.salaryGradeTable,
    this.pensionGradeTable
  );

  if (!raw) {
    alert('保険料の再算出に失敗しました');
    return;
  }

  const snapshot: InsurancePremiumSnapshot = {
    standardMonthlyAmount: raw.standardMonthlyAmount,
    healthGrade: raw.healthGrade!,
    pensionGrade: raw.pensionGrade!,
    careGrade: raw.careGrade ?? null,
    calculatedAt: raw.calculatedAt,
    health: {
      grade: raw.healthGrade!,
      premiumEmployee: raw.health.employee!,
      premiumCompany: raw.health.company!,
      premiumTotal: raw.health.total!
    },
    pension: {
      grade: raw.pensionGrade!,
      premiumEmployee: raw.pension.employee!,
      premiumCompany: raw.pension.company!,
      premiumTotal: raw.pension.total!
    },
    care: raw.care
      ? {
          grade: raw.careGrade!,
          premiumEmployee: raw.care.employee!,
          premiumCompany: raw.care.company!,
          premiumTotal: raw.care.total!
        }
      : null
  };

  // selectedMonth から 12か月分（または必要月数）に保存（上書き）
  const [year, month] = this.selectedMonth.split('-').map(Number);

  for (let i = 0; i < 12; i++) {
    const date = new Date(year, month - 1 + i); // 0-index
    const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    await this.firestoreService.saveActualPremiumRecord(
      this.selectedCompanyId,
      emp.empNo,
      yyyymm,
      'revised',
      snapshot,
      uid
    );
  }

  alert('随時改定保険料を登録しました');
  await this.loadSavedPremiums();
}

shouldShowLoss(emp: Employee & any): boolean {

  if (this.devForceAllButtons) return true;
  
  if (!this.selectedMonth || !emp.leaveDate) return false;
  const leave = emp.leaveDate.slice(0, 7);
  return leave === this.selectedMonth && !emp.alreadyRegisteredLoss;
}

async registerLoss(emp: Employee): Promise<void> {
  if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;

  const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
  const thisMonthIncome = incomeRecords.find(r => r.applicableMonth === this.selectedMonth);

  if (!thisMonthIncome || !thisMonthIncome.totalIncome) {
    alert('この月の報酬データが存在しません');
    return;
  }

  const enriched = {
    ...emp,
    ...evaluateInsuranceStatus(emp, this.selectedCompany, thisMonthIncome)
  };

  const raw = calculateInsurancePremiums(
    thisMonthIncome.totalIncome,
    enriched,
    this.selectedCompany,
    this.insuranceRatesTable,
    this.salaryGradeTable,
    this.pensionGradeTable
  );

  if (!raw) {
    alert('保険料計算に失敗しました');
    return;
  }

  const snapshot: InsurancePremiumSnapshot = {
    standardMonthlyAmount: raw.standardMonthlyAmount,
    healthGrade: raw.healthGrade!,
    pensionGrade: raw.pensionGrade!,
    careGrade: raw.careGrade ?? null,
    calculatedAt: raw.calculatedAt,
    health: {
      grade: raw.healthGrade!,
      premiumEmployee: raw.health.employee!,
      premiumCompany: raw.health.company!,
      premiumTotal: raw.health.total!
    },
    pension: {
      grade: raw.pensionGrade!,
      premiumEmployee: raw.pension.employee!,
      premiumCompany: raw.pension.company!,
      premiumTotal: raw.pension.total!
    },
    care: raw.care
      ? {
          grade: raw.careGrade!,
          premiumEmployee: raw.care.employee!,
          premiumCompany: raw.care.company!,
          premiumTotal: raw.care.total!
        }
      : null
  };

  const uid = this.authService.getUid() ?? 'system';

  // 保存
  await this.firestoreService.saveActualPremiumRecord(
    this.selectedCompanyId,
    emp.empNo,
    this.selectedMonth,
    'loss',
    snapshot,
    uid
  );

  alert('資格喪失として保険料を記録しました');
  await this.loadSavedPremiums();
}

onDevModeToggleChanged(): void {
  this.loadSavedPremiums();
}
    
}