import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import { FormsModule } from '@angular/forms';
import { FirestoreService } from '../../core/services/firestore.service';
import { AuthService } from '../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Company } from '../../core/models/company.model';
import { BonusRecord, Employee, ExtendedEmployee } from '../../core/models/employee.model';
import { MatDialog } from '@angular/material/dialog';
import { PremiumHistoryDialogComponent } from './dialogs/premium-history-dialog/premium-history-dialog.component';
import { calculateBonusPremium, calculateInsurancePremiums, calculateRevisedInsurancePremium, checkRevisedEligibility, getAverageStandardMonthlyAmount, InsuranceRates } from '../../core/utils/calculateInsurancePremiums';
import { SalaryGrade, getStandardSalaryGrade, parseSalaryGrades } from '../../core/utils/salary-grade.util';
import { evaluateInsuranceStatus } from '../../core/utils/insurance-evaluator';
import { EmployeeInsurancePremiums, InsurancePremiumSnapshot } from '../../core/models/insurance-premium.model';
import { calculateBonusPremiumsForEmployee } from '../../core/utils/calculateInsurancePremiums';
import { MatSnackBar } from '@angular/material/snack-bar';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PdfMakeWrapper, Txt, Table, Img } from 'pdfmake-wrapper';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { pdfMakeVfs } from '../../pdf/vfs_fonts';
import pdfMake from 'pdfmake/build/pdfmake';
import { BonusPremiumRecord } from '../../core/models/bonus-premium.model';
import { IncomeRecord } from '../../core/models/income-record.model';



export async function exportInsuranceReportPDF(records: InsuranceReportRecord[], targetMonth: string): Promise<void> {
  try {
    const pdfMakeModule = await import('pdfmake/build/pdfmake');
    const pdfMake: any = pdfMakeModule;

    console.log('[DEBUG] pdfMakeModule keys:', Object.keys(pdfMakeModule));
    console.log('[DEBUG] typeof pdfMake:', typeof pdfMake);
    console.log('[DEBUG] typeof pdfMakeVfs:', typeof pdfMakeVfs);
    console.log('[DEBUG] vfs font key check:', pdfMakeVfs['NotoSansJP-Regular.ttf']?.slice(0, 30));

    pdfMake.vfs = pdfMakeVfs;

    pdfMake.fonts = {
      NotoSansJP: {
        normal: 'NotoSansJP-Regular.ttf',
        bold: 'NotoSansJP-Regular.ttf',
        italics: 'NotoSansJP-Regular.ttf',
        bolditalics: 'NotoSansJP-Regular.ttf'
      },
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };

    const body: { text: string; bold?: boolean }[][] = [
      [
        { text: '社員番号', bold: true },
        { text: '氏名', bold: true },
        { text: '健保(本人)', bold: true },
        { text: '健保(会社)', bold: true },
        { text: '介護(本人)', bold: true },
        { text: '介護(会社)', bold: true },
        { text: '年金(本人)', bold: true },
        { text: '年金(会社)', bold: true },
        { text: '合計(本人)', bold: true },
        { text: '合計(会社)', bold: true }
      ]
    ];

    records.forEach(r => {
      body.push([
        { text: r.empNo ?? '' },
        { text: r.name ?? '' },
        { text: r.healthInsurance?.employee?.toLocaleString() ?? '' },
        { text: r.healthInsurance?.employer?.toLocaleString() ?? '' },
        { text: r.careInsurance?.employee?.toLocaleString() ?? '' },
        { text: r.careInsurance?.employer?.toLocaleString() ?? '' },
        { text: r.pension?.employee?.toLocaleString() ?? '' },
        { text: r.pension?.employer?.toLocaleString() ?? '' },
        { text: r.total?.employee?.toLocaleString() ?? '' },
        { text: r.total?.employer?.toLocaleString() ?? '' }
      ]);
    });

    const docDefinition: any = {
      content: [
        { text: `保険料一覧（${targetMonth}）`, style: 'header', margin: [0, 0, 0, 10] },
        {
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
            body
          },
          layout: 'lightHorizontalLines'
        },
        {
          text: `出力日: ${new Date().toLocaleDateString()}`,
          style: 'footer',
          margin: [0, 10, 0, 0]
        }
      ],
      styles: {
        header: {
          fontSize: 14,
          bold: true,
          alignment: 'center'
        },
        footer: {
          fontSize: 9,
          alignment: 'right'
        }
      },
      defaultStyle: {
        font: 'NotoSansJP'
      }
    };

    // ⬇️ PDF出力
    pdfMake.createPdf(docDefinition).download(`保険料_${targetMonth}.pdf`);
  } catch (err: any) {
    console.error('[ERROR] exportInsuranceReportPDF failed:', err);
    alert(`PDF出力中にエラーが発生しました: ${err?.message ?? err}`);
  }
}

function computeBonusMonthlyEquivalent(emp: Employee): number | undefined {
  console.log('🔎 bonusSummary:', emp.bonusSummary);

  const includedList = emp.bonusSummary?.bonusDetails?.filter(b => b.includedInStandardBonus) ?? [];
  console.log('✅ includedList:', includedList);

  const total = includedList.reduce((sum, b) => sum + (b.amount || 0), 0);
  return total > 0 ? Math.floor(total / 12) : undefined;
}

interface InsuranceReportRecord {
  empNo: string;
  name: string;
  healthInsurance: { employee: number; employer: number };
  careInsurance?: { employee: number; employer: number };
  pension: { employee: number; employer: number };
  total: { employee: number; employer: number };
}

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
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  employeeCompanyRoles: { [key: string]: 'hr' | 'employee' } = {};
  filteredBonusEmployees: Employee[] = [];

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
  
    const companyRoles = await this.firestoreService.getCompaniesForUser(uid);
    const companyDocs = await Promise.all(
      companyRoles.map(async ({ companyId }) => {
        const company = await this.firestoreService.getCompany(companyId);
        return company ? { ...company } : null;
      })
    );
    
    this.companyList = companyDocs.filter((c): c is Company => c !== null);    
  }
  
  

  userRole: 'hr' | 'employee' | null = null;

  async selectCompany(company: Company): Promise<void> {
    const uid = this.authService.getUid();
    if (!uid) return;
  
    const role = await this.firestoreService.getUserRoleForCompany(uid, company.companyId);
  
    if (!role) {
      console.warn(`[selectCompany] roleなし → 選択無効: ${company.companyId}`);
      this.selectedCompanyId = null;
      this.selectedCompany = null;
      this.userRole = null;
      this.displayEmployees = [];
      this.bonusEmployees = [];
      this.filteredBonusEmployees = [];
      return;
    }
  
    this.selectedCompanyId = company.companyId;
    this.selectedCompany = company;
    this.userRole = role;
  
    this.firestoreService.getEmployeesForCompany(company.companyId).subscribe(emps => {
      this.allEmployees = emps;
  
      this.displayEmployees = (role === 'hr')
        ? emps
        : emps.filter(e => e.firebaseUid === uid);

      this.bonusEmployees = emps.filter(e => e.bonusRecords?.length);
  
      this.filteredBonusEmployees = (role === 'hr')
        ? this.bonusEmployees
        : this.bonusEmployees.filter(e => e.firebaseUid === uid);
  
      this.loadSavedPremiums();
    });
  }

  get showEmployeeTable(): boolean {
    const uid = this.authService.getUid();
    console.log('[showEmployeeTable] uid:', uid);
    console.log('[showEmployeeTable] displayEmployees:', this.displayEmployees.map(e => e.firebaseUid));
    return this.userRole === 'hr' || this.displayEmployees.some(e => e.firebaseUid === uid);
  }
  
  
  get showBonusTable(): boolean {
    return this.userRole === 'hr' || this.bonusEmployees.some(e => e.firebaseUid === this.authService.getUid());
  }  
 
  async calculateAllPremiums(): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const promises = this.allEmployees.map(async emp => {
      const income = await this.firestoreService.getIncomeRecords(this.selectedCompanyId!, emp.empNo);
      const monthData = income.find(i => i.applicableMonth === this.selectedMonth);
  
      const evaluated = evaluateInsuranceStatus(emp, this.selectedCompany!, monthData, this.allEmployees, this.selectedMonth);
  
      if (!monthData || !monthData.totalMonthlyIncome) {
        return {
          ...emp,
          ...evaluated,
          healthInsuranceAmount: null,
          healthInsuranceEmployee: null,
          healthInsuranceCompany: null,
          healthInsuranceDetailOpen: false,
          pensionInsuranceAmount: null,
          pensionInsuranceEmployee: null,
          pensionInsuranceCompany: null,
          pensionInsuranceDetailOpen: false,
          careInsuranceAmount: null,
          careInsuranceEmployee: null,
          careInsuranceCompany: null,
          careInsuranceDetailOpen: false,
        };
      }
  
      const salary = monthData.totalMonthlyIncome;
      const bonusMonthlyEquivalent = computeBonusMonthlyEquivalent(emp);
  
      const enrichedEmp = {
        ...emp,
        ...evaluated
      };
  
      const prefecture = this.selectedCompany!.prefecture ?? 'default';

      const fallbackRates: InsuranceRates = {
        health: { employee: 0, company: 0 },
        pension: { employee: 0, company: 0 },
        care: { employee: 0, company: 0 }
      };
      
      const prefectureRates = this.insuranceRatesTable[prefecture] ?? fallbackRates;
      
      const rates: InsuranceRates =
      this.selectedCompany!.healthType === '組合健保' && this.selectedCompany!.customRates
        ? {
            health: {
              employee: parseFloat(this.selectedCompany!.customRates!.health?.employee ?? '0'),
              company: parseFloat(this.selectedCompany!.customRates!.health?.company ?? '0')
            },
            pension: prefectureRates.pension,
            care: {
              employee: parseFloat(this.selectedCompany!.customRates!.care?.employee ?? '0'),
              company: parseFloat(this.selectedCompany!.customRates!.care?.company ?? '0')
            }
          }
        : prefectureRates;
        
      const premiumResult = calculateInsurancePremiums(
        salary,
        enrichedEmp,
        this.selectedCompany!,
        rates,
        this.salaryGradeTable,
        this.pensionGradeTable,
        bonusMonthlyEquivalent
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
          care: premiumResult.care ?? null
        }
      );
  
      const bonusPremiums = calculateBonusPremiumsForEmployee(
        enrichedEmp,
        this.selectedCompany!,
        this.insuranceRatesTable
      );
  
      for (const bonus of bonusPremiums) {
        if (bonus.applicableMonth === this.selectedMonth) {
          await this.firestoreService.saveBonusPremiumRecord(
            this.selectedCompanyId!,
            bonus.empNo,
            bonus.applicableMonth,
            bonus
          );
        }
      }
  
      console.log('💡 BONUS premium result for', emp.empNo, bonusPremiums);
  
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
  
    const results = await Promise.all(promises);

    this.displayEmployees = this.userRole === 'hr'
      ? results
      : results.filter(e => e.firebaseUid === this.authService.getUid());
    

    await this.loadBonusPremiums();
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
      '社員番号', '氏名', '標準報酬月額',
      '健康保険料（本人）', '健康保険料（会社/目安）', '健康保険料（合計）',
      '介護保険料（本人）', '介護保険料（会社/目安）', '介護保険料（合計）',
      '厚生年金保険料（本人）', '厚生年金保険料（会社/目安）', '厚生年金保険料（合計）'
    ];
  
    const rows = this.displayEmployees.map(emp => [
      emp.empNo,
      `${emp.lastName} ${emp.firstName}`,
      emp.standardMonthlyAmount ?? '',
      emp.healthInsuranceEmployee ?? '',
      emp.healthInsuranceCompany ?? '',
      emp.healthInsuranceAmount ?? '',
      emp.careInsuranceEmployee ?? '',
      emp.careInsuranceCompany ?? '',
      emp.careInsuranceAmount ?? '',
      emp.pensionInsuranceEmployee ?? '',
      emp.pensionInsuranceCompany ?? '',
      emp.pensionInsuranceAmount ?? ''
    ]);
  
    const csvContent = [headers, ...rows]
      .map(row => row.map(col => `"${col}"`).join(','))
      .join('\n');
  
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `保険料_${this.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  bonusPremiums: BonusPremiumRecord[] = [];

  exportBonusPremiums(): void {
    if (!this.selectedMonth || !this.bonusPremiums?.length) return;
  
    const filtered = this.bonusPremiums.filter(
      (p: BonusPremiumRecord) => p.applicableMonth === this.selectedMonth
    );
    if (filtered.length === 0) return;
  
    const headers = [
      '社員番号', '氏名', '対象月', '標準賞与額',
      '健康保険料（本人）', '健康保険料（会社）', '健康保険料（合計）',
      '介護保険料（本人）', '介護保険料（会社）', '介護保険料（合計）',
      '厚生年金保険料（本人）', '厚生年金保険料（会社）', '厚生年金保険料（合計）'
    ];
  
    const rows = filtered.map((p: BonusPremiumRecord): string[] => {
      const match = this.displayEmployees.find(e => e.empNo === p.empNo);
      const fullName = match ? `${match.lastName} ${match.firstName}` : '';
  
      return [
        p.empNo,
        fullName,
        p.applicableMonth,
        String(p.standardBonusAmount ?? ''),
        String(p.health?.employee ?? ''),
        String(p.health?.company ?? ''),
        String(p.health?.total ?? ''),
        String(p.care?.employee ?? ''),
        String(p.care?.company ?? ''),
        String(p.care?.total ?? ''),
        String(p.pension?.employee ?? ''),
        String(p.pension?.company ?? ''),
        String(p.pension?.total ?? '')
      ];
    });  
  
    const csvContent = [headers, ...rows]
      .map((row: string[]) => row.map((col: string) => `"${col}"`).join(','))
      .join('\n');
  
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `賞与保険料_${this.selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  
  
  getTotalPremiums(): {
    health: number;
    healthEmployee: number;
    healthCompany: number;
    pension: number;
    pensionEmployee: number;
    pensionCompany: number;
    care: number;
    careEmployee: number;
    careCompany: number;
    total: number;
  } {
    const healthRate = this.getCombinedRate('health'); // 例: 0.092
    const pensionRate = this.getCombinedRate('pension');
    const careRate = this.getCombinedRate('care');
  
    let healthEmployee = 0;
    let pensionEmployee = 0;
    let careEmployee = 0;
  
    let healthTotalRaw = 0;
    let pensionTotalRaw = 0;
    let careTotalRaw = 0;
  
    for (const emp of this.displayEmployees) {
      const base = emp.standardMonthlyAmount ?? 0;
  
      // 個人合計（四捨五入：50銭以上切上、以下切捨）
      healthEmployee += this.roundToNearestYen(base * this.getEmployeeRate('health'));
      pensionEmployee += this.roundToNearestYen(base * this.getEmployeeRate('pension'));
      careEmployee += this.roundToNearestYen(base * this.getEmployeeRate('care'));
  
      // 総額（切捨前保持）
      healthTotalRaw += base * healthRate;
      pensionTotalRaw += base * pensionRate;
      careTotalRaw += base * careRate;
    }
  
    // 総額（切捨）
    const health = Math.floor(healthTotalRaw);
    const pension = Math.floor(pensionTotalRaw);
    const care = Math.floor(careTotalRaw);
  
    // 会社負担
    const healthCompany = health - healthEmployee;
    const pensionCompany = pension - pensionEmployee;
    const careCompany = care - careEmployee;
  
    return {
      health,
      healthEmployee,
      healthCompany,
      pension,
      pensionEmployee,
      pensionCompany,
      care,
      careEmployee,
      careCompany,
      total: health + pension + care
    };
  }
  
  private roundToNearestYen(value: number): number {
    const fraction = Math.round((value - Math.floor(value)) * 100);
    return fraction <= 50 ? Math.floor(value) : Math.ceil(value);
  }
  
  
  private getEmployeeRate(type: 'health' | 'pension' | 'care'): number {
    const prefecture = this.selectedCompany?.prefecture ?? 'default';
  
    if (type === 'pension') {
      return Number(this.insuranceRatesTable[prefecture]?.pension?.employee ?? 0);
    }
  
    const isUnion = this.selectedCompany?.healthType === '組合健保';
    const custom = this.selectedCompany?.customRates?.[type]?.employee;
  
    return isUnion ? Number(custom ?? 0) : Number(this.insuranceRatesTable[prefecture]?.[type]?.employee ?? 0);
  }
  
  private getCombinedRate(type: 'health' | 'pension' | 'care'): number {
    const prefecture = this.selectedCompany?.prefecture ?? 'default';
  
    if (type === 'pension') {
      const pension = this.insuranceRatesTable[prefecture]?.pension;
      return Number(pension?.employee ?? 0) + Number(pension?.company ?? 0);
    }
  
    const isUnion = this.selectedCompany?.healthType === '組合健保';
    const custom = this.selectedCompany?.customRates?.[type];
    const defaultRate = this.insuranceRatesTable[prefecture]?.[type];
  
    return isUnion
      ? Number(custom?.employee ?? 0) + Number(custom?.company ?? 0)
      : Number(defaultRate?.employee ?? 0) + Number(defaultRate?.company ?? 0);
  }

  getTotalStandardMonthlyAmount(): number {
    return this.displayEmployees.reduce((sum, emp) => sum + (emp.standardMonthlyAmount || 0), 0);
  }

  async loadSavedPremiums(): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const selectedYear = parseInt(this.selectedMonth.split('-')[0], 10);
    const cutoffJune1 = new Date(`${selectedYear}-06-01T00:00:00`);
    const cutoffJuly1 = new Date(`${selectedYear}-07-01T00:00:00`);
  
    const promises = this.allEmployees.map(async emp => {
      const actuals = await this.firestoreService.getActualPremiumRecords(
        this.selectedCompanyId!,
        emp.empNo
      );
  
      const exact = actuals.find(r => r.applicableMonth === this.selectedMonth);
      const loss = actuals.find(r => r.applicableMonth === this.selectedMonth && r.method === 'loss');
      const qualification = actuals.find(r => r.method === 'qualification');
  
      const joinStr = typeof emp.joinDate === 'string'
      ? emp.joinDate.substring(0, 7)
      : new Date(emp.joinDate).toISOString().substring(0, 7);
      
      const isThisMonthJoin = joinStr === this.selectedMonth;
      const isQualificationTarget = !qualification;
      
      const canRegisterQualification = this.devForceAllButtons || (isThisMonthJoin && isQualificationTarget);
    
      const canRegisterRevised = this.devForceAllButtons || await this.shouldShowRevised(emp);
  
      let canRegisterFixed = false;
      if (!this.devForceAllButtons) {
        const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId!, emp.empNo);
  
        const joinDate = new Date(emp.joinDate);
        const leaveDate = emp.leaveDate ? new Date(emp.leaveDate) : null;
  
        const isInServiceOnJune1 = joinDate < cutoffJune1 && (!leaveDate || leaveDate >= cutoffJune1);
        const isNotLeavingByJuneEnd = !leaveDate || leaveDate >= cutoffJuly1;
        const isFixedTarget = isInServiceOnJune1 && isNotLeavingByJuneEnd;
  
        const alreadyRegisteredFixed = actuals.some(
          r => r.method === 'fixed' && r.applicableMonth >= `${selectedYear}-09`
        );
  
        const apr = incomeRecords.find(i => i.applicableMonth === `${selectedYear}-04`);
        const may = incomeRecords.find(i => i.applicableMonth === `${selectedYear}-05`);
        const jun = incomeRecords.find(i => i.applicableMonth === `${selectedYear}-06`);
        const hasValidIncome = !!(apr?.totalMonthlyIncome || may?.totalMonthlyIncome || jun?.totalMonthlyIncome);
  
        canRegisterFixed = isFixedTarget && hasValidIncome && !alreadyRegisteredFixed;
      }
  
      const canRegisterLoss = !loss && emp.leaveDate?.slice(0, 7) === this.selectedMonth;
  
      console.log(`[loadSavedPremiums] ${emp.empNo} ${emp.lastName}${emp.firstName} → canRegisterRevised =`, canRegisterRevised);
  
      return {
        ...emp,
        alreadyRegisteredQualification: !!qualification,
        alreadyRegisteredFixed: actuals.some(a => a.method === 'fixed'),
        alreadyRegisteredLoss: !!loss,
  
        canRegisterRevised,
        canRegisterQualification,
        canRegisterFixed: this.devForceAllButtons || canRegisterFixed,
        canRegisterLoss: this.devForceAllButtons || canRegisterLoss,
  
        healthGrade: exact?.healthGrade ?? null,
        pensionGrade: exact?.pensionGrade ?? null,
        careGrade: exact?.careGrade ?? null,
  
        standardMonthlyAmount: exact?.standardMonthlyAmount ?? null,
        standardMonthlyAmountBreakdown: exact?.standardMonthlyAmountBreakdown ?? null,
  
        healthInsuranceEmployee: exact?.health?.employee ?? null,
        healthInsuranceCompany: exact?.health?.company ?? null,
        healthInsuranceAmount:
          (exact?.health?.employee ?? 0) + (exact?.health?.company ?? 0),
        healthInsuranceDetailOpen: false,
  
        pensionInsuranceEmployee: exact?.pension?.employee ?? null,
        pensionInsuranceCompany: exact?.pension?.company ?? null,
        pensionInsuranceAmount:
          (exact?.pension?.employee ?? 0) + (exact?.pension?.company ?? 0),
        pensionInsuranceDetailOpen: false,
  
        careInsuranceEmployee: exact?.care?.employee ?? null,
        careInsuranceCompany: exact?.care?.company ?? null,
        careInsuranceAmount:
          (exact?.care?.employee ?? 0) + (exact?.care?.company ?? 0),
        careInsuranceDetailOpen: false
      };
    });
  
    this.displayEmployees = (this.userRole === 'hr')
    ? await Promise.all(promises)
    : (await Promise.all(promises)).filter(e => e.firebaseUid === this.authService.getUid());
  
  }

  async loadBonusPremiums(): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    console.log('🔍 loadBonusPremiums 実行 - selectedMonth:', this.selectedMonth);
  
    const uid = this.authService.getUid();
  
    const promises = this.allEmployees.map(async emp => {
      const bonusRecords = await this.firestoreService.getBonusPremiumRecords(
        this.selectedCompanyId!,
        emp.empNo
      );
  
      const normalizeMonth = (monthStr: string): string => {
        const [y, m] = monthStr.split('-');
        return `${y}-${m.padStart(2, '0')}`;
      };
      
      const monthRecords = bonusRecords.filter(b => {
        const normalized = normalizeMonth(b.applicableMonth ?? '');
        return normalized === this.selectedMonth;
      });
  
      const mainRecord =
        monthRecords.find(b => b.standardBonusAmount > 0) ?? monthRecords[0];
  
      return {
        ...emp,
        bonusStandardAmount: mainRecord?.standardBonusAmount ?? null,
  
        bonusHealth: mainRecord?.health?.total ?? null,
        bonusHealthEmployee: mainRecord?.health?.employee ?? null,
        bonusHealthCompany: mainRecord?.health?.company ?? null,
        bonusHealthDetailOpen: false,
  
        bonusPension: mainRecord?.pension?.total ?? null,
        bonusPensionEmployee: mainRecord?.pension?.employee ?? null,
        bonusPensionCompany: mainRecord?.pension?.company ?? null,
        bonusPensionDetailOpen: false,
  
        bonusCare: mainRecord?.care?.total ?? null,
        bonusCareEmployee: mainRecord?.care?.employee ?? null,
        bonusCareCompany: mainRecord?.care?.company ?? null,
        bonusCareDetailOpen: false,
  
        bonusMergedIntoMonthly: emp.bonusSummary?.bonusDetails?.some(
          b => b.applicableMonth === this.selectedMonth && b.includedInStandardBonus
        ) ?? false
      };
    });
  
    const resolved = await Promise.all(promises);
  
    this.bonusEmployees = (this.userRole === 'hr')
      ? resolved
      : resolved.filter(e => e.firebaseUid === uid);
  
    const allRecords = await Promise.all(
      this.allEmployees.map(emp =>
        this.firestoreService.getBonusPremiumRecords(this.selectedCompanyId!, emp.empNo)
      )
    );
  
    this.bonusPremiums = allRecords
      .flat()
      .filter(r => r.applicableMonth === this.selectedMonth);
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
    healthEmployee: number;
    healthCompany: number;
    pension: number;
    pensionEmployee: number;
    pensionCompany: number;
    care: number;
    careEmployee: number;
    careCompany: number;
    total: number;
  } {
    const prefecture = this.selectedCompany?.prefecture ?? 'default';
    const isUnion = this.selectedCompany?.healthType === '組合健保';
    const getRate = (type: 'health' | 'care' | 'pension') => {
      if (type === 'pension') {
        return this.insuranceRatesTable[prefecture]?.pension ?? { employee: 0, company: 0 };
      }
      return isUnion
        ? {
            employee: Number(this.selectedCompany?.customRates?.[type]?.employee ?? 0),
            company: Number(this.selectedCompany?.customRates?.[type]?.company ?? 0)
          }
        : this.insuranceRatesTable[prefecture]?.[type] ?? { employee: 0, company: 0 };
    };
  
    const rateHealth = getRate('health');
    const rateCare = getRate('care');
    const ratePension = getRate('pension');
  
    // 🔸 合計値の初期化
    let healthTotal = 0, healthEmployee = 0;
    let pensionTotal = 0, pensionEmployee = 0;
    let careTotal = 0, careEmployee = 0;
  
    // 🔸 従業員単位で加算
    for (const emp of this.bonusEmployees) {
      const bonus = emp.bonusStandardAmount ?? 0;
  
      // 健康保険
      healthTotal += Math.floor(bonus * (rateHealth.employee + rateHealth.company));
      healthEmployee += this.roundToNearestYen(bonus * rateHealth.employee);
  
      // 介護保険
      careTotal += Math.floor(bonus * (rateCare.employee + rateCare.company));
      careEmployee += this.roundToNearestYen(bonus * rateCare.employee);
  
      // 厚生年金
      pensionTotal += Math.floor(bonus * (ratePension.employee + ratePension.company));
      pensionEmployee += this.roundToNearestYen(bonus * ratePension.employee);
    }
  
    // 🔸 差引で会社負担
    const healthCompany = healthTotal - healthEmployee;
    const careCompany = careTotal - careEmployee;
    const pensionCompany = pensionTotal - pensionEmployee;
  
    return {
      health: healthTotal,
      healthEmployee,
      healthCompany,
      pension: pensionTotal,
      pensionEmployee,
      pensionCompany,
      care: careTotal,
      careEmployee,
      careCompany,
      total: healthTotal + pensionTotal + careTotal
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
  
    const bonusMonthlyEquivalent = computeBonusMonthlyEquivalent(emp);
  
    const prefecture = this.selectedCompany.prefecture ?? 'default';
    const fallbackRates: InsuranceRates = {
      health: { employee: 0, company: 0 },
      pension: { employee: 0, company: 0 },
      care: { employee: 0, company: 0 }
    };
    const prefectureRates = this.insuranceRatesTable[prefecture] ?? fallbackRates;
  
    const rates: InsuranceRates =
      this.selectedCompany.healthType === '組合健保' && this.selectedCompany.customRates
        ? {
            health: {
              employee: parseFloat(this.selectedCompany.customRates.health?.employee ?? '0'),
              company: parseFloat(this.selectedCompany.customRates.health?.company ?? '0'),
            },
            pension: prefectureRates.pension,
            care: {
              employee: parseFloat(this.selectedCompany.customRates.care?.employee ?? '0'),
              company: parseFloat(this.selectedCompany.customRates.care?.company ?? '0'),
            },
          }
        : prefectureRates;
  
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
  
      for (const month of months) {
        const enriched = {
          ...emp,
          ...evaluateInsuranceStatus(emp, this.selectedCompany, thisMonthIncome, this.allEmployees, month)
        };
  
        const raw = calculateInsurancePremiums(
          thisMonthIncome.totalMonthlyIncome,
          enriched,
          this.selectedCompany,
          rates,
          this.salaryGradeTable,
          this.pensionGradeTable,
          bonusMonthlyEquivalent,
          month
        );
  
        if (!raw) {
          console.warn(`[ERROR] 保険料計算失敗: ${emp.empNo} / ${month}`);
          continue;
        }
  
        const snapshot: InsurancePremiumSnapshot = {
          standardMonthlyAmount: raw.standardMonthlyAmount,
          standardMonthlyAmountBreakdown: this.sanitizeBreakdown(raw.standardMonthlyAmountBreakdown),
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
  
        await this.firestoreService.saveActualPremiumRecord(
          this.selectedCompanyId,
          emp.empNo,
          month,
          'qualification',
          snapshot,
          uid
        );
      }
  
      alert(`保険料を ${months.length}か月分 登録しました`);
      (emp as any).alreadyRegisteredQualification = true;
    } catch (e: any) {
      alert(e?.message || '登録済み、または保存エラー');
    }
  
    await this.loadSavedPremiums();
  }
  
  async shouldShowFixed(emp: Employee & any): Promise<boolean> {
    if (this.devForceAllButtons) return true;
    if (!this.selectedCompanyId) return false;
  
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    if (currentMonth !== 6 && currentMonth !== 7) return false;
  
    const year = now.getFullYear();
    const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
    const apr = incomeRecords.find(i => i.applicableMonth === `${year}-04`);
    const may = incomeRecords.find(i => i.applicableMonth === `${year}-05`);
    const jun = incomeRecords.find(i => i.applicableMonth === `${year}-06`);
  
    const hasValid = (r: any) => r?.totalIncome || r?.totalMonthlyIncome;
    const isComplete = hasValid(apr) || hasValid(may) || hasValid(jun);
    if (!isComplete) return false;
  
    const actuals = await this.firestoreService.getActualPremiumRecords(this.selectedCompanyId, emp.empNo);
    const hasFixed = actuals.some(r => r.method === 'fixed');
    return !hasFixed;
  }

  async registerFixed(emp: Employee): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const incomeRecords = await this.firestoreService.getIncomeRecords(
      this.selectedCompanyId,
      emp.empNo
    );
  
    const targetYear = parseInt(this.selectedMonth.split('-')[0]);
    const joinDate = new Date(emp.joinDate);
    const joinYear = joinDate.getFullYear();
    const joinMonth = joinDate.getMonth() + 1;
  
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
    const bonusMonthlyEquivalent = computeBonusMonthlyEquivalent(emp);
  
    const prefecture = this.selectedCompany.prefecture ?? 'default';
    const fallbackRates: InsuranceRates = {
      health: { employee: 0, company: 0 },
      pension: { employee: 0, company: 0 },
      care: { employee: 0, company: 0 }
    };
    const prefectureRates = this.insuranceRatesTable[prefecture] ?? fallbackRates;
    const rates: InsuranceRates =
      this.selectedCompany.healthType === '組合健保' && this.selectedCompany.customRates
        ? {
            health: {
              employee: parseFloat(this.selectedCompany.customRates.health?.employee ?? '0'),
              company: parseFloat(this.selectedCompany.customRates.health?.company ?? '0'),
            },
            pension: prefectureRates.pension,
            care: {
              employee: parseFloat(this.selectedCompany.customRates.care?.employee ?? '0'),
              company: parseFloat(this.selectedCompany.customRates.care?.company ?? '0'),
            }
          }
        : prefectureRates;
  
    try {
      const uid = this.authService.getUid() ?? 'system';
      const startYear = targetYear;
  
      const months = Array.from({ length: 12 }).map((_, i) => {
        const date = new Date(startYear, 8 + i); // 9月〜翌年8月
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      });
  
      for (const month of months) {
        const enriched = {
          ...emp,
          ...evaluateInsuranceStatus(
            emp,
            this.selectedCompany,
            {
              ...relevantRecords[relevantRecords.length - 1],
              totalMonthlyIncome: avgIncome
            },
            this.allEmployees,
            month // 🔸 月単位で年齢/保険判定
          )
        };
  
        const raw = calculateInsurancePremiums(
          avgIncome,
          enriched,
          this.selectedCompany,
          rates,
          this.salaryGradeTable,
          this.pensionGradeTable,
          bonusMonthlyEquivalent,
          month // 🔸 月単位で制度判定
        );
  
        if (!raw) {
          console.warn(`[ERROR] 保険料計算失敗: ${emp.empNo} / ${month}`);
          continue;
        }
  
        const snapshot: InsurancePremiumSnapshot = {
          standardMonthlyAmount: raw.standardMonthlyAmount,
          standardMonthlyAmountBreakdown: this.sanitizeBreakdown(raw.standardMonthlyAmountBreakdown),
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
    const tag = `【随時改定チェック】${emp.empNo} ${emp.lastName}${emp.firstName}`;
    console.log(`${tag} 🔍 判定開始（selectedMonth = ${this.selectedMonth}）`);
  
    if (this.devForceAllButtons) {
      console.log(`${tag}: devForceAllButtons = true → ✅ 強制有効化`);
      return true;
    }
  
    if (!this.selectedCompanyId || !this.selectedMonth || !this.salaryGradeTable?.length) {
      console.log(`${tag}: 必須情報未設定 → ❌`);
      return false;
    }
  
    const normalizeMonth = (monthStr: string): string => {
      const [y, m] = monthStr.split('-');
      return `${y}-${String(Number(m)).padStart(2, '0')}`;
    };
  
    const [year, month1Based] = this.selectedMonth.split('-').map(Number);
    const month = month1Based - 1;
    const selectedDate = new Date(year, month);
  
    // 変動月（2か月前）
    const changeDate = new Date(selectedDate);
    changeDate.setMonth(changeDate.getMonth() - 2);
    const changeYm = `${changeDate.getFullYear()}-${String(changeDate.getMonth() + 1).padStart(2, '0')}`;
  
    // 比較対象（変動月の前月）
    const prevDate = new Date(changeDate);
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
  
    const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
    console.log(`${tag}: 全incomeRecords =`, incomeRecords);
  
    const incomeMap = Object.fromEntries(incomeRecords.map(r => [normalizeMonth(r.applicableMonth), r]));
  
    const current = incomeMap[changeYm];
    const previous = incomeMap[prevYm];
    console.log(`${tag}: 比較：前月(${prevYm}) vs 変動月(${changeYm})`, { prev: previous, curr: current });
  
    if (!current || !previous) {
      console.log(`${tag}: 変動比較データ不足 → ❌`);
      return false;
    }
  
    const currentIncome = current.totalIncome ?? current.totalMonthlyIncome ?? 0;
    const prevIncome = previous.totalIncome ?? previous.totalMonthlyIncome ?? 0;
  
    if (currentIncome === prevIncome) {
      console.log(`${tag}: 前月と変動月の収入に変化なし → ❌`);
      return false;
    }
  
    // 3ヶ月間の対象月取得
    const targetMonths = [
      new Date(changeDate),
      new Date(changeDate.getFullYear(), changeDate.getMonth() + 1),
      new Date(changeDate.getFullYear(), changeDate.getMonth() + 2)
    ].map(d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  
    const relevant = incomeRecords.filter(r => targetMonths.includes(normalizeMonth(r.applicableMonth)));
    console.log(`${tag}: 絞り込み後 relevantRecords =`, relevant);
  
    if (relevant.length < 3) {
      console.log(`${tag}: 月数不足（${relevant.length}件） → ❌`);
      return false;
    }
  
    const allValidDays = relevant.every(r => (r.workDays ?? 0) >= 17);
    console.log(`${tag}: 支払基礎日数チェック =`, relevant.map(r => ({
      month: r.applicableMonth,
      days: r.workDays ?? 0,
      result: (r.workDays ?? 0) >= 17
    })));
  
    if (!allValidDays) {
      console.log(`${tag}: 支払基礎日数不成立 → ❌`);
      return false;
    }
  
    const baseSum = relevant.reduce((sum, r) => sum + (r.totalIncome ?? r.totalMonthlyIncome ?? 0), 0);
    const bonusMonthlyEquivalent = computeBonusMonthlyEquivalent(emp) ?? 0;
    const averageMonthlyWithBonus = Math.floor((baseSum + bonusMonthlyEquivalent * 3) / 3);
    console.log(`${tag}: 平均月収（含む賞与）= ${averageMonthlyWithBonus}`);
  
    const newGrade = getStandardSalaryGrade(averageMonthlyWithBonus, this.salaryGradeTable)?.grade;
    console.log(`${tag}: 新等級 =`, newGrade);
    if (newGrade == null) {
      console.log(`${tag}: 等級判定不能 → ❌`);
      return false;
    }
  
    const allActuals = await this.firestoreService.getActualPremiumRecords(this.selectedCompanyId, emp.empNo);
    const oldRecord = allActuals.find(a => normalizeMonth(a.applicableMonth) === prevYm);
    const oldGrade = oldRecord?.healthGrade ?? null;
    console.log(`${tag}: 比較対象 等級 = ${oldGrade}`);
  
    if (oldGrade == null) {
      console.log(`${tag}: 比較対象等級 不明 → ❌`);
      return false;
    }
  
    const diff = Math.abs(newGrade - oldGrade);
    const isEligible = diff >= 2;
    console.log(`${tag}: 等級差 = ${diff} → ${isEligible ? '✅ 随時改定対象' : '❌ 差不足'}`);
    return isEligible;
  }

  async registerRevised(emp: Employee): Promise<void> {
    if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;
  
    const uid = this.authService.getUid() ?? 'system';
    const [year, month1Based] = this.selectedMonth.split('-').map(Number);
    const month = month1Based - 1;
  
    const targetMonths = [
      new Date(year, month - 2),
      new Date(year, month - 1),
      new Date(year, month)
    ].map(d => `${d.getFullYear()}-${d.getMonth() + 1}`);
  
    const incomeRecords = await this.firestoreService.getIncomeRecords(this.selectedCompanyId, emp.empNo);
  
    const relevantRecords = incomeRecords.filter(r => {
      const normalized = r.applicableMonth?.replace(/-0?(\d+)$/, (_: string, m: string) => `-${parseInt(m, 10)}`);
      return targetMonths.includes(normalized);
    });
  
    if (relevantRecords.length < 3) {
      alert('3か月分の報酬記録が揃っていません');
      return;
    }
  
    const bonusMonthlyEquivalent = computeBonusMonthlyEquivalent(emp) ?? 0;
    const totalIncome = relevantRecords.reduce((sum, r) => sum + (r.totalMonthlyIncome ?? 0), 0);
    const averageMonthlyWithBonus = Math.floor((totalIncome + bonusMonthlyEquivalent * 3) / 3);
  
    const prefecture = this.selectedCompany.prefecture ?? 'default';
    const fallbackRates: InsuranceRates = {
      health: { employee: 0, company: 0 },
      pension: { employee: 0, company: 0 },
      care: { employee: 0, company: 0 }
    };
  
    const prefectureRates = this.insuranceRatesTable[prefecture] ?? fallbackRates;
    const rates: InsuranceRates =
      this.selectedCompany.healthType === '組合健保' && this.selectedCompany.customRates
        ? {
            health: {
              employee: parseFloat(this.selectedCompany.customRates.health?.employee?.toString() ?? '0'),
              company: parseFloat(this.selectedCompany.customRates.health?.company?.toString() ?? '0')
            },
            pension: prefectureRates.pension,
            care: {
              employee: parseFloat(this.selectedCompany.customRates.care?.employee?.toString() ?? '0'),
              company: parseFloat(this.selectedCompany.customRates.care?.company?.toString() ?? '0')
            }
          }
        : prefectureRates;
  
    // ④ 適用月：4か月目から8月まで
    const revisedBase = new Date(year, month - 2);
    const startDate = new Date(revisedBase.getFullYear(), revisedBase.getMonth() + 3);   
    const endYear = startDate.getMonth() >= 9 ? startDate.getFullYear() + 1 : startDate.getFullYear();
    const endDate = new Date(endYear, 7);
  
    const datesToSave: string[] = [];
    const date = new Date(startDate);
    while (date <= endDate) {
      const yyyymm = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      datesToSave.push(yyyymm);
      date.setMonth(date.getMonth() + 1);
    }
  
    for (const targetMonth of datesToSave) {
      const enriched = {
        ...emp,
        ...evaluateInsuranceStatus(
          emp,
          this.selectedCompany,
          { totalMonthlyIncome: averageMonthlyWithBonus },
          this.allEmployees,
          targetMonth
        )
      };
  
      const raw = calculateInsurancePremiums(
        averageMonthlyWithBonus,
        enriched,
        this.selectedCompany,
        rates,
        this.salaryGradeTable,
        this.pensionGradeTable,
        bonusMonthlyEquivalent,
        targetMonth
      );
  
      if (!raw) {
        console.warn(`[ERROR] 保険料計算失敗: ${emp.empNo} / ${targetMonth}`);
        continue;
      }
  
      const snapshot: InsurancePremiumSnapshot = {
        standardMonthlyAmount: raw.standardMonthlyAmount,
        standardMonthlyAmountBreakdown: this.sanitizeBreakdown(raw.standardMonthlyAmountBreakdown),
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
  
      await this.firestoreService.saveActualPremiumRecord(
        this.selectedCompanyId,
        emp.empNo,
        targetMonth,
        'revised',
        snapshot,
        uid
      );
    }
  
    alert(`随時改定として ${datesToSave.length}か月分（${datesToSave[0]} ～ ${datesToSave[datesToSave.length - 1]}）を登録しました`);
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

  const bonusMonthlyEquivalent = computeBonusMonthlyEquivalent(emp) ?? 0;

  const enriched = {
    ...emp,
    ...evaluateInsuranceStatus(emp, this.selectedCompany, thisMonthIncome, this.allEmployees, this.selectedMonth)
  };

  const prefecture = this.selectedCompany.prefecture ?? 'default';
  const fallbackRates: InsuranceRates = {
    health: { employee: 0, company: 0 },
    pension: { employee: 0, company: 0 },
    care: { employee: 0, company: 0 }
  };
  
  const prefectureRates = this.insuranceRatesTable[prefecture] ?? fallbackRates;
  
  const rates: InsuranceRates =
  this.selectedCompany.healthType === '組合健保' && this.selectedCompany.customRates
    ? {
        health: {
          employee: parseFloat(this.selectedCompany.customRates.health?.employee?.toString() ?? '0'),
          company: parseFloat(this.selectedCompany.customRates.health?.company?.toString() ?? '0'),
        },
        pension: prefectureRates.pension,
        care: {
          employee: parseFloat(this.selectedCompany.customRates.care?.employee?.toString() ?? '0'),
          company: parseFloat(this.selectedCompany.customRates.care?.company?.toString() ?? '0'),
        }
      }
    : prefectureRates;

  const raw = calculateInsurancePremiums(
    thisMonthIncome.totalIncome,
    enriched,
    this.selectedCompany,
    rates,
    this.salaryGradeTable,
    this.pensionGradeTable,
    bonusMonthlyEquivalent
  );

  if (!raw) {
    alert('保険料計算に失敗しました');
    return;
  }

  const snapshot: InsurancePremiumSnapshot = {
    standardMonthlyAmount: raw.standardMonthlyAmount,
    standardMonthlyAmountBreakdown: this.sanitizeBreakdown(raw.standardMonthlyAmountBreakdown),
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

getMonthlyBreakdownTooltip(row: any): string {
  const breakdown = row.standardMonthlyAmountBreakdown;
  if (!breakdown) return '（内訳情報なし）';

  const parts: string[] = [];

  if (breakdown.baseSalary) {
    parts.push(`月給：${breakdown.baseSalary.toLocaleString()}円`);
  }
  if (breakdown.bonusMonthlyEquivalent) {
    parts.push(`賞与按分：${breakdown.bonusMonthlyEquivalent.toLocaleString()}円`);
  }
  if (Array.isArray(breakdown.allowances)) {
    breakdown.allowances.forEach((a: any) => {
      if (a?.name && typeof a.amount === 'number') {
        parts.push(`${a.name}：${a.amount.toLocaleString()}円`);
      }
    });
  }

  return `内訳：${parts.join(' + ')} より算出`;
}

private sanitizeBreakdown(breakdown: any): {
  baseSalary: number | null;
  bonusMonthlyEquivalent: number | null;
  allowances: any[];
} {
  return {
    baseSalary: breakdown?.baseSalary ?? null,
    bonusMonthlyEquivalent: breakdown?.bonusMonthlyEquivalent ?? null,
    allowances: breakdown?.allowances ?? []
  };
}

async calculateAllBonusPremiums(): Promise<void> {
  if (!this.selectedCompanyId || !this.selectedMonth || !this.selectedCompany) return;

  let savedCount = 0; // 保存件数カウント

  const promises = this.allEmployees.map(async emp => {
    const evaluatedEmp = {
      ...emp,
      ...evaluateInsuranceStatus(emp, this.selectedCompany!, undefined, this.allEmployees, this.selectedMonth)
    };

    console.log(`🔍 ${emp.lastName} ${emp.firstName} bonusRecords:`, emp.bonusRecords);

    const bonusPremiums = calculateBonusPremiumsForEmployee(
      evaluatedEmp,
      this.selectedCompany!,
      this.insuranceRatesTable
    );

    console.log('💡 賞与計算結果:', bonusPremiums);

    for (const bonus of bonusPremiums) {
      if (bonus.applicableMonth === this.selectedMonth) {
        console.log('💾 保存実行:', bonus);
        await this.firestoreService.saveBonusPremiumRecord(
          this.selectedCompanyId!,
          bonus.empNo,
          bonus.applicableMonth,
          bonus
        );
        savedCount++;
      }
    }
  });

  await Promise.all(promises);
  await this.loadBonusPremiums();

  const msg =
    savedCount > 0
      ? `賞与保険料（${this.selectedMonth}）を ${savedCount}件 保存しました`
      : `賞与保険料（${this.selectedMonth}）に該当するデータはありません`;

  alert(msg);
  console.log('✅ 賞与保険料の再計算＆保存 完了');
}

async registerQualificationForAll(): Promise<void> {
  for (const emp of this.displayEmployees) {
    if (emp.canRegisterQualification) {
      await this.registerQualification(emp);
    }
  }
}

async registerFixedForAll(): Promise<void> {
  for (const emp of this.displayEmployees) {
    if (emp.canRegisterFixed) {
      await this.registerFixed(emp);
    }
  }
}

async registerRevisedForAll(): Promise<void> {
  for (const emp of this.displayEmployees) {
    if (emp.canRegisterRevised) {
      await this.registerRevised(emp);
    }
  }
}

exportMonthlyPremiumsAsPDF(): void {
  if (!this.selectedMonth || this.displayEmployees.length === 0) return;

  const doc = new jsPDF();

  const head = [[
    '社員番号', '氏名', '標準報酬月額',
    '健保(本人)', '健保(会社)', '健保(合計)',
    '介護(本人)', '介護(会社)', '介護(合計)',
    '年金(本人)', '年金(会社)', '年金(合計)'
  ]];

  const body = this.displayEmployees.map(emp => [
    emp.empNo,
    `${emp.lastName} ${emp.firstName}`,
    emp.standardMonthlyAmount ?? '',
    emp.healthInsuranceEmployee ?? '',
    emp.healthInsuranceCompany ?? '',
    emp.healthInsuranceAmount ?? '',
    emp.careInsuranceEmployee ?? '',
    emp.careInsuranceCompany ?? '',
    emp.careInsuranceAmount ?? '',
    emp.pensionInsuranceEmployee ?? '',
    emp.pensionInsuranceCompany ?? '',
    emp.pensionInsuranceAmount ?? ''
  ]);

  autoTable(doc, {
    head,
    body,
    styles: { fontSize: 8 },
    margin: { top: 20 }
  });

  doc.save(`保険料_${this.selectedMonth}.pdf`);
}

exportPDF() {
  const extended = this.displayEmployees.map(emp => {
    return {
      empNo: emp.empNo,
      displayName: `${emp.lastName} ${emp.firstName}`,
      actualPremium: {
        health: {
          employee: emp.healthInsuranceEmployee ?? 0,
          employer: emp.healthInsuranceCompany ?? 0,
        },
        care:
          emp.careInsuranceEmployee != null && emp.careInsuranceCompany != null
            ? {
                employee: emp.careInsuranceEmployee,
                employer: emp.careInsuranceCompany,
              }
            : undefined,
        pension: {
          employee: emp.pensionInsuranceEmployee ?? 0,
          employer: emp.pensionInsuranceCompany ?? 0,
        },
      },
    } as ExtendedEmployee;
  });

  const records = this.convertToReportFormat(extended);
  console.log('🧾 PDFに出力するデータ:', records);

  if (records.length === 0) {
    alert('出力対象データがありません');
    return;
  }

  exportInsuranceReportPDF(records, this.selectedMonth);
}

private convertToReportFormat(employees: ExtendedEmployee[]): InsuranceReportRecord[] {
  return employees
    .filter(e => !!e.actualPremium && !!e.actualPremium.health && !!e.actualPremium.pension)
    .map(e => {
      const health = e.actualPremium.health;
      const care = e.actualPremium.care;
      const pension = e.actualPremium.pension;

      return {
        empNo: e.empNo,
        name: e.displayName,
        healthInsurance: {
          employee: health.employee ?? 0,
          employer: health.employer ?? 0
        },
        careInsurance: care
          ? {
              employee: care.employee ?? 0,
              employer: care.employer ?? 0
            }
          : undefined,
        pension: {
          employee: pension.employee ?? 0,
          employer: pension.employer ?? 0
        },
        total: {
          employee:
            (health.employee ?? 0) +
            (care?.employee ?? 0) +
            (pension.employee ?? 0),
          employer:
            (health.employer ?? 0) +
            (care?.employer ?? 0) +
            (pension.employer ?? 0)
        }
      };
    });
}

async applyExemptionForSelectedMonth(): Promise<void> {
  if (!this.selectedCompany || !this.selectedMonth || !this.displayEmployees?.length) return;

  const company = this.selectedCompany;
  const rates = this.getRatesForCompany(company, this.insuranceRatesTable);
  const uid = this.authService.getUid() ?? 'system';

  let savedCount = 0;

  const tasks = this.displayEmployees.map(async emp => {
    const tag = `[免除処理] ${emp.empNo} ${emp.lastName}${emp.firstName}`;
    console.log(`${tag} 初期状態`, {
      hasExemption: emp.hasExemption,
      exemptionDetails: emp.exemptionDetails,
    });

    if (!emp.hasExemption || !emp.exemptionDetails) {
      console.log(`${tag} → ❌ hasExemption=false or exemptionDetails=null → スキップ`);
      return;
    }

    const details = emp.exemptionDetails;
    const start = details.startMonth ?? '';
    const end = details.endMonth ?? '';
    const inRange =
      (!start || start <= this.selectedMonth) &&
      (!end || this.selectedMonth <= end);

    if (!inRange) {
      console.log(`${tag} → ❌ ${this.selectedMonth} は免除期間外（${start} ～ ${end}） → スキップ`);
      return;
    }

    const salary = emp.standardMonthlyAmount ?? 0;
    if (!salary || salary <= 0) {
      console.log(`${tag} → ❌ 標準報酬月額が不正（${salary}）→ スキップ`);
      return;
    }

    const targetInsurances = Array.isArray(details.targetInsurances)
      ? details.targetInsurances
      : Object.values(details.targetInsurances ?? {});

    const premiums = calculateInsurancePremiums(
      salary,
      emp,
      company,
      rates,
      this.salaryGradeTable,
      this.pensionGradeTable,
      undefined,
      this.selectedMonth,
      false,
      targetInsurances
    );

    if (!premiums) {
      console.log(`${tag} → ❌ calculateInsurancePremiums() が null → スキップ`);
      return;
    }

    const safeValue = (v: number | null | undefined): number => (typeof v === 'number' ? v : 0);

    const snapshot: InsurancePremiumSnapshot = {
      standardMonthlyAmount: safeValue(premiums.standardMonthlyAmount),
      standardMonthlyAmountBreakdown: premiums.standardMonthlyAmountBreakdown,
      healthGrade: safeValue(premiums.healthGrade),
      pensionGrade: safeValue(premiums.pensionGrade),
      careGrade: safeValue(premiums.careGrade),
      calculatedAt: premiums.calculatedAt,
      health: {
        grade: safeValue(premiums.healthGrade),
        premiumEmployee: safeValue(premiums.health?.employee),
        premiumCompany: safeValue(premiums.health?.company),
        premiumTotal: safeValue(premiums.health?.total),
      },
      pension: {
        grade: safeValue(premiums.pensionGrade),
        premiumEmployee: safeValue(premiums.pension?.employee),
        premiumCompany: safeValue(premiums.pension?.company),
        premiumTotal: safeValue(premiums.pension?.total),
      },
      care: {
        grade: safeValue(premiums.careGrade),
        premiumEmployee: safeValue(premiums.care?.employee),
        premiumCompany: safeValue(premiums.care?.company),
        premiumTotal: safeValue(premiums.care?.total),
      },
    };

    try {
      await this.firestoreService.saveActualPremiumRecord(
        company.companyId,
        emp.empNo,
        this.selectedMonth,
        'exemption',
        snapshot,
        uid
      );
      savedCount++;
      console.log(`${tag} → ✅ Firestore 保存成功`);
    } catch (error) {
      console.error(`${tag} → ❌ Firestore 保存失敗`, error);
    }
  });

  await Promise.all(tasks);
  await this.loadSavedPremiums();

  const msg =
    savedCount > 0
      ? `免除適用を ${savedCount}人分（${this.selectedMonth}）保存しました`
      : `この月に該当する免除対象者はいません`;

  this.snackBar.open(msg, '閉じる', { duration: 4000 });
}

isExemptionButtonEnabled(): boolean {
  if (!this.selectedMonth || !this.displayEmployees?.length) return false;

  const rates = this.getRatesForCompany(this.selectedCompany!, this.insuranceRatesTable);

  return this.checkExemptionApplyEligibility(
    this.selectedCompany!,
    rates,
    this.salaryGradeTable,
    this.pensionGradeTable,
    this.selectedMonth,
    this.displayEmployees
  );
}

checkExemptionApplyEligibility(
  company: Company,
  rates: InsuranceRates,
  healthGrades: SalaryGrade[],
  pensionGrades: SalaryGrade[],
  selectedMonth: string,
  employees: any[]
): boolean {
  return employees.some(emp => {
    if (!emp.hasExemption || !emp.exemptionDetails) return false;

    const details = emp.exemptionDetails;
    const start = details.startMonth ?? '';
    const end = details.endMonth ?? '';
    const inRange =
      (!start || start <= selectedMonth) &&
      (!end || selectedMonth <= end);

    const health = emp.healthInsuranceAmount ?? 0;
    const pension = emp.pensionInsuranceAmount ?? 0;
    const care = emp.careInsuranceAmount ?? 0;

    if (
      (details.targetInsurances.includes('health') && health !== 0) ||
      (details.targetInsurances.includes('pension') && pension !== 0) ||
      (details.targetInsurances.includes('care') && care !== 0)
    ) {
      return true;
    }

    return false;
  });
}

getRatesForCompany(company: Company, table: Record<string, InsuranceRates>): InsuranceRates {
  const fallback: InsuranceRates = {
    health: { employee: 0, company: 0 },
    pension: { employee: 0, company: 0 },
    care: { employee: 0, company: 0 },
  };

  const defaultRates = company.prefecture ? table[company.prefecture] : fallback;

  return company.healthType === '組合健保' && company.customRates
    ? {
        health: {
          employee: parseFloat(company.customRates.health?.employee ?? '0'),
          company: parseFloat(company.customRates.health?.company ?? '0'),
        },
        pension: defaultRates.pension,
        care: {
          employee: parseFloat(company.customRates.care?.employee ?? '0'),
          company: parseFloat(company.customRates.care?.company ?? '0'),
        },
      }
    : defaultRates;
}

canRegisterQualificationForAll(): boolean {
  if (this.devForceAllButtons) return true;

  if (!this.selectedMonth || !this.displayEmployees?.length) return false;

  return this.displayEmployees.some(emp => emp.canRegisterQualification);
}

canRegisterQualificationForAnyEmployee(): boolean {
  if (this.devForceAllButtons) return true;
  if (!this.selectedMonth || !this.displayEmployees?.length) return false;

  return this.displayEmployees.some(emp => emp.canRegisterQualification);
}

get canRegisterFixedForAnyEmployee(): boolean {
  return this.displayEmployees?.some(emp => emp.canRegisterFixed);
}

get canRegisterRevisedForAnyEmployee(): boolean {
  return this.displayEmployees?.some(emp => emp.canRegisterRevised);
}

get canCalculateBonusPremiumForSelectedMonth(): boolean {
  if (this.devForceAllButtons) return true;
  if (!this.selectedMonth || !this.displayEmployees?.length) return false;

  return this.displayEmployees.some(emp =>
    (emp.bonusRecords ?? []).some((b: BonusRecord) => b.applicableMonth === this.selectedMonth)
  );
}

}

