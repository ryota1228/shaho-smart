import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material/material.module';
import { EmployeeEditDialogComponent } from './dialogs/employee-edit-dialog/employee-edit-dialog.component';
import { ConfirmDeleteDialogComponent } from '../../shared/dialogs/confirm-delete-dialog/confirm-delete-dialog.component';
import { FirestoreService } from '../../core/services/firestore.service';
import { AuthService } from '../../core/services/auth.service';
import { Company } from '../../core/models/company.model';
import { Employee } from '../../core/models/employee.model';
import { MatSnackBar } from '@angular/material/snack-bar';
import { evaluateInsuranceStatus } from '../../core/utils/insurance-evaluator';
import { CustomRatesDialogComponent } from './dialogs/custom-rates-dialog/custom-rates-dialog.component';
import { calculateBonusPremium, calculateInsurancePremiums, InsuranceRates } from '../../core/utils/calculateInsurancePremiums';
import { HttpClient } from '@angular/common/http';
import { parseSalaryGrades, SalaryGrade } from '../../core/utils/salary-grade.util';
import { getPrefectureFromAddress } from '../../core/utils/prefecture.util';
import { BonusPremiumRecord } from '../../core/models/bonus-premium.model';
import { CsvImportDialogComponent } from './dialogs/csv-import-dialog/csv-import-dialog.component';
import { IncomeRecord } from '../../core/models/income.model';



@Component({
  selector: 'app-master-management',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './master-management.component.html',
  styleUrls: ['./master-management.component.scss']
})
export class MasterManagementComponent implements OnInit {
  companyList: Company[] = [];
  selectedCompanyId: string | null = null;
  companyInfo: Company | null = null;

  dataSource: any[] = [];

  displayedColumns: string[] = [
    'empNo',
    'name',
    'dept',
    "monthly",
    'health',
    'healthGrade',
    'pension',
    'pensionGrade',
    'care',
    'careGrade',
    'actions'
  ];

  isEdit = false;

  insuranceRatesTable: Record<string, InsuranceRates> = {};
  
  salaryGradeTable: SalaryGrade[] = [];
  pensionGradeTable: SalaryGrade[] = [];

  isProcessingCsv: boolean = false;

  isProcessingDialogSave = false;

  prefectures: string[] = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
    '岐阜県', '静岡県', '愛知県', '三重県',
    '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
    '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県',
    '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県',
    '沖縄県'
  ];

  constructor(
    private dialog: MatDialog,
    private firestoreService: FirestoreService,
    private authService: AuthService,
    private snackbar: MatSnackBar,
    private http: HttpClient,
    private firestore: FirestoreService
  ) {}

  ngOnInit(): void {
    this.loadReferenceTables();
    this.loadCompaniesByUid();
  }

  loadReferenceTables(): void {
    this.http.get<SalaryGrade[]>('assets/data/salary-grade.json').subscribe(data => {
      this.salaryGradeTable = parseSalaryGrades(data);
      console.log('✅ 健康保険等級表 読み込み完了');
    });
  
    this.http.get<SalaryGrade[]>('assets/data/pension-grade.json').subscribe(data => {
      this.pensionGradeTable = parseSalaryGrades(data);
      console.log('✅ 厚生年金等級表 読み込み完了');
    });
  
    this.http.get<Record<string, InsuranceRates>>('assets/data/prefecture-insurance-rates.json').subscribe(data => {
      this.insuranceRatesTable = data;
      console.log('✅ 保険料率テーブル 読み込み完了');
    });
  }

  loadCompaniesByUid(): void {
    const uid = this.authService.getUid();
    if (!uid) {
      console.warn('UIDが取得できませんでした');
      return;
    }
    this.firestoreService.getCompanyListByUser(uid).subscribe(companies => this.companyList = companies);
  }

  loadEmployees(): void {
    if (!this.selectedCompanyId || !this.companyInfo) return;
  
    this.firestoreService.getEmployeesForCompany(this.selectedCompanyId).subscribe(async (employees) => {
      const enriched = await Promise.all(
        employees.map(async emp => {
          const latestPremium = await this.firestoreService.getLatestInsurancePremium(this.selectedCompanyId!, emp.empNo);
          return {
            ...emp,
            standardMonthlyAmount: latestPremium?.standardMonthlyAmount ?? null,
            healthGrade: latestPremium?.healthGrade ?? null,
            pensionGrade: latestPremium?.pensionGrade ?? null,
            careGrade: latestPremium?.careGrade ?? null
          };
        })
      );
  
      this.allEmployees = enriched;
      this.applyFilter();
    });
  }

  openCustomRatesDialog(): void {
    if (!this.companyInfo) return;
  
    const dialogRef = this.dialog.open(CustomRatesDialogComponent, {
      width: '500px',
      data: { existingRates: this.companyInfo.customRates ?? null }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.companyInfo!.customRates = result;
      }
    });
  }

  addNewCompany(): void {
    const uid = this.authService.getUid();
    if (!uid) return;

    this.firestoreService.createEmptyCompany(uid).then(() => {
      this.firestoreService.getCompanyListByUser(uid).subscribe((companies) => {
        this.companyList = companies;
      });
    });
  }

  confirmDeleteCompany(company: Company): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '360px',
      data: { message: `「${company.name || '無名企業'}」を削除してもよろしいですか？` }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.firestoreService.softDeleteCompany(company.companyId)
          .then(() => {
            alert('企業を削除しました');
            const uid = this.authService.getUid();
            if (uid) {
              this.firestoreService.getCompanyListByUser(uid).subscribe(companies => {
                this.companyList = companies;
              });
            }
          })
          .catch(err => {
            console.error('削除エラー', err);
            alert('削除に失敗しました');
          });
      }
    });
  }

  allEmployees: any[] = [];
  searchTerm: string = '';

  selectCompany(company: Company): void {
    console.log('選択された企業:', company);
    console.log('companyIdの値:', company.companyId);

    if (!company.companyId || company.companyId.trim() === '') {
      console.warn('企業IDが空または無効です');
      return;
    }
  
    this.selectedCompanyId = company.companyId;
    this.companyInfo = { ...company };

    console.log('選択企業ID:', company.companyId);
  
    this.firestoreService.getEmployeesForCompany(company.companyId).subscribe(async (employees) => {
      const enriched = await Promise.all(
        employees.map(async emp => {
          const latestPremium = await this.firestoreService.getLatestInsurancePremium(company.companyId, emp.empNo);
          return {
            ...emp,
            standardMonthlyAmount: latestPremium?.standardMonthlyAmount ?? null,
            healthGrade: latestPremium?.healthGrade ?? null,
            pensionGrade: latestPremium?.pensionGrade ?? null,
            careGrade: latestPremium?.careGrade ?? null
          };
        })
      );
    
      this.allEmployees = enriched;
      this.applyFilter();
    });    
  }

  refreshEmployeeList(): void {
    if (!this.selectedCompanyId) return;
    this.firestoreService.getEmployeesForCompany(this.selectedCompanyId).subscribe((employees) => {
      this.allEmployees = employees;
      this.applyFilter();
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
  
    if (!term) {
      this.dataSource = [...this.allEmployees];
      return;
    }
  
    this.dataSource = this.allEmployees.filter(emp =>
      emp.lastName?.toLowerCase().includes(term) ||
      emp.firstName?.toLowerCase().includes(term) ||
      emp.empNo?.toLowerCase().includes(term)
    );
  }

  mapToCollection(type: 'employment' | 'workStyle' | 'jobCategory'): 'employmentTypes' | 'workStyles' | 'jobCategories' {
    switch (type) {
      case 'employment': return 'employmentTypes';
      case 'workStyle': return 'workStyles';
      case 'jobCategory': return 'jobCategories';
    }
  }

  openNewEmployeeDialog(): void {
    this.isEdit = false;
    this._openEmployeeDialog(undefined, false);
  }

  openEditEmployeeDialog(employee: Employee): void {
    this.isEdit = true;
    this._openEmployeeDialog(employee, true);
  }

  private _openEmployeeDialog(employee: Employee | undefined, isEdit: boolean): void {
    const dialogRef = this.dialog.open(EmployeeEditDialogComponent, {
      data: {
        employee,
        companyId: this.selectedCompanyId,
        isEdit: isEdit
      }
    });
  
    dialogRef.afterClosed().subscribe(async (result: any) => {
      if (!result || !this.selectedCompanyId || !this.companyInfo) return;
  
      this.isProcessingDialogSave = true;
  
      try {
        const validGenders = ['male', 'female', 'other'];
        const validStatuses = ['none', 'daytime', 'nighttime', 'correspondence'];
  
        const { incomeRecords, dependents, bonusSummary, ...base } = result;
  
        const cleaned: Employee = {
          empNo: base.empNo?.trim(),
          lastName: base.lastName?.trim(),
          firstName: base.firstName?.trim(),
          lastNameKana: base.lastNameKana?.trim() ?? '',
          firstNameKana: base.firstNameKana?.trim() ?? '',
          dept: base.dept?.trim() ?? '',
          employmentType: base.employmentType ?? '',
          salaryType: base.salaryType ?? '',
          weeklyHours: base.weeklyHours ?? 0,
          expectedDuration: ['within2Months', 'over2Months', 'indefinite'].includes(base.expectedDuration!)
            ? base.expectedDuration
            : 'within2Months',
          joinDate: base.joinDate ? new Date(base.joinDate).toISOString() : '',
          leaveDate: base.leaveDate ? new Date(base.leaveDate).toISOString() : '',
          birthday: base.birthday ? new Date(base.birthday).toISOString() : '',
          gender: validGenders.includes(base.gender!) ? base.gender : undefined,
          studentStatus: validStatuses.includes(base.studentStatus!) ? base.studentStatus : 'none',
          note: base.note?.trim() ?? '',
          nationality: base.nationality?.trim() ?? '',
          residencyStatus: base.residencyStatus?.trim() ?? ''
        };
  
        const exists = await this.firestoreService.checkEmployeeExists(this.selectedCompanyId, cleaned.empNo);
        const editingOwn = isEdit && employee?.empNo === cleaned.empNo;
  
        if (!isEdit && exists) {
          this.snackbar.open('この社員番号は既に存在しています（新規登録できません）', '閉じる', { duration: 4000 });
          return;
        }
        if (exists && !editingOwn) {
          this.snackbar.open('この社員番号は既に使用されています', '閉じる', { duration: 4000 });
          return;
        }
  
        await this.firestoreService.saveEmployee(this.selectedCompanyId, cleaned);
  
        // 🔽 月額報酬データ保存＋該当月の保険料算出
        if (incomeRecords?.length) {
          for (const record of incomeRecords) {
            if (!record.applicableMonth || !record.totalMonthlyIncome) continue;
  
            await this.firestoreService.saveIncomeRecord(
              this.selectedCompanyId,
              cleaned.empNo,
              record.applicableMonth,
              record
            );
  
            const premiums = calculateInsurancePremiums(
              record.totalMonthlyIncome,
              cleaned,
              this.companyInfo,
              this.insuranceRatesTable,
              this.salaryGradeTable,
              this.pensionGradeTable
            );
  
            if (premiums) {
              await this.firestoreService.saveInsurancePremium(
                this.selectedCompanyId,
                cleaned.empNo,
                record.applicableMonth,
                { ...premiums, applicableMonth: record.applicableMonth }
              );
            }
          }
        }
  
        if (dependents?.length) {
          await this.firestoreService.saveDependents(this.selectedCompanyId!, cleaned.empNo, dependents);
        }
  
        if (bonusSummary?.bonusDetails?.length) {
          await this.firestoreService.saveBonusRecords(this.selectedCompanyId!, cleaned.empNo, bonusSummary.bonusDetails);
  
          for (const bonus of bonusSummary.bonusDetails) {
            if (!bonus.applicableMonth || !bonus.amount) continue;
  
            const premium = calculateBonusPremium(
              bonus.amount,
              cleaned,
              this.companyInfo,
              this.insuranceRatesTable
            );
  
            if (premium) {
              const bonusPremium: BonusPremiumRecord = {
                empNo: cleaned.empNo,
                companyId: this.companyInfo.companyId,
                applicableMonth: bonus.applicableMonth,
                applicableDate: bonus.date ?? '',
                bonusId: bonus.id ?? bonus.applicableMonth ?? crypto.randomUUID(),
                calculatedAt: new Date().toISOString(),
                standardBonusAmount: premium.standardBonusAmount,
                health: premium.health ?? null,
                pension: premium.pension ?? null,
                care: premium.care ?? null
              };
  
              await this.firestoreService.saveBonusPremium(
                this.selectedCompanyId!,
                cleaned.empNo,
                bonusPremium.bonusId,
                bonusPremium
              );
            }
          }
        }
  
        // 🔄 再取得＆加入判定（latestIncomeのみ評価に使う）
        const employeeList = await this.firestoreService.getEmployeesForCompany(this.selectedCompanyId!).toPromise();
        const count = employeeList?.length ?? 0;
        await this.firestoreService.updateCompanyEmployeeCount(this.selectedCompanyId!, count);
  
        const updatedCompany = await this.firestore.getCompany(this.selectedCompanyId!);
        if (updatedCompany) this.companyInfo = updatedCompany;
  
        for (const emp of employeeList ?? []) {
          const latestIncome = await this.firestoreService.getLatestIncomeRecord(this.selectedCompanyId!, emp.empNo);
          const evaluated = evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome);
          const updatedEmp = { ...emp, ...evaluated };
          await this.firestoreService.saveEmployee(this.selectedCompanyId!, updatedEmp);
        }
  
        this.snackbar.open('保存に成功しました（再評価済）', '閉じる', { duration: 3000 });
        this.loadEmployees();
  
      } catch (err) {
        console.error('保存エラー:', err);
        this.snackbar.open('保存に失敗しました', '閉じる');
      } finally {
        this.isProcessingDialogSave = false;
      }
    });
  }
    
  deleteEmployee(employee: Employee): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '360px',
      data: { message: `${employee.lastName} ${employee.firstName} さんのデータを削除してもよろしいですか？` }
    });
  
    dialogRef.afterClosed().subscribe(async (result) => {
      if (!result) return;
  
      try {
        await this.firestoreService.deleteEmployee(this.selectedCompanyId!, employee.empNo);
  
        const employeeList = await this.firestoreService.getEmployeesForCompany(this.selectedCompanyId!).toPromise();
        const count = employeeList?.length ?? 0;
        await this.firestoreService.updateCompanyEmployeeCount(this.selectedCompanyId!, count);
  
        const updatedCompany = await this.firestore.getCompany(this.selectedCompanyId!);
        if (updatedCompany) this.companyInfo = updatedCompany;
  
        const reevaluated = employeeList?.map(emp => ({
          ...emp,
          ...evaluateInsuranceStatus(emp, this.companyInfo!)
        })) ?? [];
  
        await Promise.all(
          reevaluated.map(emp => this.firestoreService.saveEmployee(this.selectedCompanyId!, emp))
        );
  
        this.snackbar.open('従業員を削除しました（再評価済）', '閉じる', { duration: 3000 });
        this.loadEmployees();
      } catch (err) {
        console.error('削除エラー:', err);
        this.snackbar.open('削除に失敗しました', '閉じる');
      }
    });
  }  

  saveCompanyData(): void {
    if (!this.companyInfo) return;
  
    const id = this.selectedCompanyId ?? null;
  
    this.firestoreService.saveCompanyOnly(id, this.companyInfo)
      .then(async (savedId) => {
        this.snackbar.open('企業情報を保存しました', '閉じる', { duration: 3000 });
  
        this.selectedCompanyId = savedId;
        this.companyInfo!.companyId = savedId;
  
        const employeeList = await this.firestoreService.getEmployeesForCompany(savedId).toPromise();
        const employees = employeeList ?? [];
  
        const updatedEmployees = await Promise.all(
          employees.map(async emp => {
            const latestIncome = await this.firestoreService.getLatestIncomeRecord(savedId, emp.empNo);
            return {
              ...emp,
              ...evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome)
            };
          })
        );
  
        await Promise.all(
          updatedEmployees.map(emp =>
            this.firestoreService.saveEmployee(savedId, emp)
          )
        );
  
        this.refreshEmployeeList();
  
        const uid = this.authService.getUid();
        if (uid) {
          this.firestoreService.getCompanyListByUser(uid).subscribe(companies => {
            this.companyList = companies;
            const updated = companies.find(c => c.companyId === savedId);
            if (updated) this.selectCompany(updated);
          });
        }
      })
      .catch((err) => {
        console.error('保存エラー:', err);
        this.snackbar.open('企業情報の保存に失敗しました', '閉じる');
      });
  }

  formatPostalCode(): void {
    if (!this.companyInfo) return;
  
    let code = this.companyInfo.postalCode ?? '';
  
    // 全角→半角変換
    code = code.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );
  
    // 数字抽出
    const numeric = code.replace(/\D/g, '');
  
    // 郵便番号の整形
    if (numeric.length === 7) {
      this.companyInfo.postalCode = `${numeric.slice(0, 3)}-${numeric.slice(3)}`;
    } else {
      this.companyInfo.postalCode = numeric;
    }
  
    // 🔽 都道府県の自動抽出（住所が入っていれば）
    const address = this.companyInfo.address ?? '';
    this.companyInfo.prefecture = getPrefectureFromAddress(address);
  }

  async importCsvData(parsedData: any[]): Promise<void> {
    if (!this.selectedCompanyId || !parsedData?.length) return;
  
    this.isProcessingCsv = true;
  
    try {
      // 🔽 1. CSV行ごとに保存（加入判定・保険料算出はこのあと）
      for (const row of parsedData) {
        const empNo = row.empNo?.trim();
        if (!empNo) continue;
  
        const employee: Employee = {
          empNo,
          lastName: row.lastName,
          firstName: row.firstName,
          lastNameKana: row.lastNameKana,
          firstNameKana: row.firstNameKana,
          dept: row.dept || '',
          employmentType: row.employmentType,
          weeklyHours: Number(row.weeklyHours),
          joinDate: row.joinDate,
          leaveDate: row.leaveDate,
          birthday: row.birthday,
          gender: row.gender,
          studentStatus: row.studentStatus,
          expectedDuration: row.expectedDuration,
          salaryType: row.salaryType,
          note: row.note
        };
  
        await this.firestore.saveEmployee(this.selectedCompanyId, employee);
  
        // 🔽 給与データ
        if (row.applicableMonth && row.baseAmount) {
          const income: IncomeRecord = {
            applicableMonth: row.applicableMonth,
            baseAmount: Number(row.baseAmount),
            workingHoursPerDay: Number(row.workingHoursPerDay),
            absenceDays: Number(row.absenceDays),
            workDays: Number(row.workDays),
            overtimeAmount: Number(row.overtimeAmount),
            allowances: row.allowances ? [{ name: '手当', amount: Number(row.allowances) }] : [],
            totalMonthlyIncome: Number(row.baseAmount) + Number(row.allowances || 0)
          };
          await this.firestore.saveIncomeRecord(this.selectedCompanyId, empNo, row.applicableMonth, income);
        }
  
        // 🔽 賞与データ
        if (row.bonusMonth && row.bonusAmount) {
          await this.firestore.saveBonusRecord(this.selectedCompanyId, empNo, row.bonusMonth, {
            applicableMonth: row.bonusMonth,
            amount: Number(row.bonusAmount)
          });
        }
      }
  
      // 🔽 2. 従業員数をカウントして企業に反映
      const employeeList = await this.firestore.getEmployeesForCompany(this.selectedCompanyId).toPromise();
      const employeeCount = (employeeList ?? []).length;
      await this.firestore.updateCompanyEmployeeCount(this.selectedCompanyId, employeeCount);
  
      // 🔽 3. 再取得した企業情報で判定を行う
      const company = await this.firestore.getCompany(this.selectedCompanyId);
      if (!company) {
        this.snackbar.open('❌ 企業情報の取得に失敗しました', '閉じる', { duration: 5000 });
        return;
      } else {
        this.companyInfo = company;
      }
  
      // 🔽 4. 加入判定・全月保険料算出・再保存
      let successCount = 0;
      let failCount = 0;
  
      for (const emp of employeeList ?? []) {
        try {
          const incomeRecords = await this.firestore.getIncomeRecords(this.selectedCompanyId, emp.empNo);
          const latestIncome = incomeRecords
            .sort((a, b) => b.applicableMonth.localeCompare(a.applicableMonth))[0];
  
          // 🧠 加入判定
          const evaluated = evaluateInsuranceStatus(emp, company, latestIncome);
          const updatedEmp = { ...emp, ...evaluated };
          await this.firestore.saveEmployee(this.selectedCompanyId, updatedEmp);
  
          // 💰 全月保険料を算出・保存
          for (const income of incomeRecords) {
            const premiums = calculateInsurancePremiums(
              income.totalMonthlyIncome,
              updatedEmp,
              company,
              this.insuranceRatesTable,
              this.salaryGradeTable,
              this.pensionGradeTable
            );
            if (premiums) {
              await this.firestore.saveInsurancePremium(
                this.selectedCompanyId,
                emp.empNo,
                income.applicableMonth,
                { ...premiums, applicableMonth: income.applicableMonth }
              );
            }
          }
  
          successCount++;
        } catch (err) {
          console.error(`❌ 判定エラー (empNo: ${emp.empNo}):`, err);
          failCount++;
        }
      }
  
      this.snackbar.open(`CSV取込完了 ✅ 判定成功: ${successCount}件 / 失敗: ${failCount}件`, '閉じる', { duration: 6000 });
      this.loadEmployees();
    } finally {
      this.isProcessingCsv = false;
    }
  }
  
  
  openCsvImportDialog(): void {
    if (!this.selectedCompanyId) return;
  
    const dialogRef = this.dialog.open(CsvImportDialogComponent, {
      width: '600px',
      data: { companyId: this.selectedCompanyId }
    });
  
    dialogRef.afterClosed().subscribe((parsedData: any[]) => {
      if (parsedData?.length) {
        this.importCsvData(parsedData);
      }
    });
  }
  
}
