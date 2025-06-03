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
    private http: HttpClient
  ) {}

  ngOnInit(): void {

    this.http.get<Record<string, InsuranceRates>>('assets/data/prefecture-insurance-rates.json')
    .subscribe(data => {
      this.insuranceRatesTable = data;
      console.log('✅ 保険料率テーブル読み込み完了');
    });

      this.http.get<SalaryGrade[]>('assets/data/pension-grade.json')
      .subscribe(data => {
        this.pensionGradeTable = parseSalaryGrades(data);
        console.log('✅ 厚生年金等級表読み込み完了');
      });
  
      this.http.get<SalaryGrade[]>('assets/data/salary-grade.json')
      .subscribe(data => {
        this.salaryGradeTable = parseSalaryGrades(data);
        console.log('✅ 等級表読み込み＆Infinity補正 完了');
      });
  

    const uid = this.authService.getUid();
    if (!uid) {
      console.warn('UIDが取得できませんでした');
      return;
    }
  
    console.log('取得UID:', uid);
  
    this.firestoreService.getCompanyListByUser(uid).subscribe((companies) => {
      console.log('取得された企業一覧:', companies);
      this.companyList = companies;
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

      console.log('🟡 result:', result);

      if (!result || !this.selectedCompanyId || !this.companyInfo) return;
  
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
          expectedDuration:
            ['within2Months', 'over2Months', 'indefinite'].includes(base.expectedDuration!)
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
  
        const latestIncome = incomeRecords?.[0];
        const insuranceStatus = evaluateInsuranceStatus(cleaned, this.companyInfo, latestIncome);
        const finalEmployee = { ...cleaned, ...insuranceStatus };
  
        const exists = await this.firestoreService.checkEmployeeExists(this.selectedCompanyId, finalEmployee.empNo);
        const editingOwn = isEdit && employee?.empNo === finalEmployee.empNo;
  
        if (!isEdit && exists) {
          this.snackbar.open('この社員番号は既に存在しています（新規登録できません）', '閉じる', { duration: 4000 });
          return;
        }
        if (exists && !editingOwn) {
          this.snackbar.open('この社員番号は既に使用されています', '閉じる', { duration: 4000 });
          return;
        }
  
        // 🔽 Firestore 保存：従業員情報
        await this.firestoreService.saveEmployee(this.selectedCompanyId, finalEmployee);
        
        // 🔽 Firestore 保存：保険料情報（全月分）
        if (incomeRecords?.length) {
          for (const record of incomeRecords) {
            if (!record.applicableMonth || !record.totalMonthlyIncome) continue;
            
            const premiumResult = calculateInsurancePremiums(
              record.totalMonthlyIncome,
              finalEmployee,
              this.companyInfo,
              this.insuranceRatesTable,
              this.salaryGradeTable,
              this.pensionGradeTable
            );
            
            if (!premiumResult) {
              console.warn('⚠️ 保険料算出スキップ: applicableMonth =', record.applicableMonth);
              continue;
            }

            const correctedPremiumResult = {
              ...premiumResult,
              applicableMonth: record.applicableMonth
            };
            
            await this.firestoreService.saveInsurancePremium(
              this.selectedCompanyId,
              finalEmployee.empNo,
              record.applicableMonth,
              correctedPremiumResult
            );
            console.log('✅ 保険料保存完了 for', record.applicableMonth);
          }
        }

  
        // 🔽 Firestore 保存：扶養者情報
        if (dependents?.length) {
          await this.firestoreService.saveDependents(this.selectedCompanyId!, finalEmployee.empNo, dependents);
        }
  
        // 🔽 Firestore 保存：賞与情報
        if (bonusSummary?.bonusDetails?.length) {
          await this.firestoreService.saveBonusRecords(
            this.selectedCompanyId!,
            finalEmployee.empNo,
            bonusSummary.bonusDetails
          );
        }

        console.log('🟡 bonusSummary:', bonusSummary);
        console.log('🟡 bonusDetails:', bonusSummary?.bonusDetails);
        
        
        // 🔽 Firestore 保存：賞与保険料情報
        if (bonusSummary?.bonusDetails?.length) {
          for (const bonus of bonusSummary.bonusDetails) {
            console.log('📌 bonus対象:', bonus);
        
            if (!bonus.applicableMonth || !bonus.amount) {
              console.warn('❌ スキップ: applicableMonthかamountが無効');
              continue;
            }
        
            const premium = calculateBonusPremium(
              bonus.amount,
              finalEmployee,
              this.companyInfo,
              this.insuranceRatesTable
            );
        
            if (!premium) {
              console.warn('❌ スキップ: premiumがundefined');
              continue;
            }
        
            const bonusPremium: BonusPremiumRecord = {
              empNo: finalEmployee.empNo,
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
        
            console.log('📦 保存予定 bonusPremium:', bonusPremium);
        
            await this.firestoreService.saveBonusPremium(
              this.selectedCompanyId!,
              finalEmployee.empNo,
              bonusPremium.bonusId,
              bonusPremium
            );
        
            console.log('✅ 賞与保険料保存完了 for', bonus.applicableMonth);
          }
        }        

        // 🔽 Firestore 保存：従業員数の更新
        const employeeList = await this.firestoreService.getEmployeesForCompany(this.selectedCompanyId).toPromise();
        const employeeCount = (employeeList ?? []).length;
        await this.firestoreService.updateCompanyEmployeeCount(this.selectedCompanyId, employeeCount);
  
        // 🔽 UI再読み込み
        const selected = this.companyList.find(c => c.companyId === this.selectedCompanyId);
        if (selected) this.selectCompany(selected);
  
        this.snackbar.open('保存に成功しました', '閉じる', { duration: 3000 });
  
      } catch (err) {
        console.error('保存エラー:', err);
        this.snackbar.open('保存に失敗しました', '閉じる');
      }
    });
  }
  

  deleteEmployee(employee: Employee): void {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '360px',
      data: { message: `${employee.lastName} ${employee.firstName} さんのデータを削除してもよろしいですか？` }
    });
  
    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        try {
          await this.firestoreService.deleteEmployee(this.selectedCompanyId!, employee.empNo);
  
          const employeeList = await this.firestoreService.getEmployeesForCompany(this.selectedCompanyId!).toPromise();
          const employeeCount = (employeeList ?? []).length;
          await this.firestoreService.updateCompanyEmployeeCount(this.selectedCompanyId!, employeeCount);
  
          this.snackbar.open('従業員を削除しました', '閉じる', { duration: 3000 });
          this.refreshEmployeeList();
        } catch (err) {
          console.error('削除エラー:', err);
          this.snackbar.open('削除に失敗しました', '閉じる');
        }
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
  
  
}
