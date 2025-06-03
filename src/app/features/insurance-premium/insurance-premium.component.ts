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
      const premiums = await this.firestoreService.getInsurancePremiumRecords(this.selectedCompanyId!, emp.empNo);
      const monthData = premiums.find(p => p.applicableMonth === this.selectedMonth);

      if (!monthData) return this.nullPremiums(emp);

      return {
        ...emp,
        standardMonthlyAmount: monthData.standardMonthlyAmount ?? null,
        healthInsuranceEmployee: monthData.health?.employee ?? null,
        healthInsuranceCompany: monthData.health?.company ?? null,
        healthInsuranceAmount: (monthData.health?.employee ?? 0) + (monthData.health?.company ?? 0),
        healthInsuranceDetailOpen: false,
        pensionInsuranceEmployee: monthData.pension?.employee ?? null,
        pensionInsuranceCompany: monthData.pension?.company ?? null,
        pensionInsuranceAmount: (monthData.pension?.employee ?? 0) + (monthData.pension?.company ?? 0),
        pensionInsuranceDetailOpen: false,
        careInsuranceEmployee: monthData.care?.employee ?? null,
        careInsuranceCompany: monthData.care?.company ?? null,
        careInsuranceAmount: (monthData.care?.employee ?? 0) + (monthData.care?.company ?? 0),
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
  
}