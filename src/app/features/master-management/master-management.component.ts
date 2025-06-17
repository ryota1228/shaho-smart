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
import { evaluateInsuranceStatus, getAge } from '../../core/utils/insurance-evaluator';
import { CustomRatesDialogComponent } from './dialogs/custom-rates-dialog/custom-rates-dialog.component';
import { calculateBonusPremium, calculateInsurancePremiums, InsuranceRates } from '../../core/utils/calculateInsurancePremiums';
import { HttpClient } from '@angular/common/http';
import { parseSalaryGrades, SalaryGrade } from '../../core/utils/salary-grade.util';
import { getPrefectureFromAddress } from '../../core/utils/prefecture.util';
import { BonusPremiumRecord, BonusRecordInput } from '../../core/models/bonus-premium.model';
import { CsvImportDialogComponent } from './dialogs/csv-import-dialog/csv-import-dialog.component';
import { IncomeRecord } from '../../core/models/income.model';
import { toJSTMidnightISO } from '../../core/utils/date-utils';
import { Dependent } from '../../core/models/dependent.model';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, } from '@angular/fire/auth';
import {
  doc,
  getDocs,
  collection,
  updateDoc,
  Firestore,
  CollectionReference,
  DocumentData,
  QueryDocumentSnapshot,
  getDoc,
} from '@angular/fire/firestore';
import { CsvGuideDialogComponent } from './dialogs/csv-guide-dialog/csv-guide-dialog.component';

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
    'actions',
    'roleToggle'
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
    private firestore: Firestore,
    private auth: Auth
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

  async loadCompaniesByUid(): Promise<void> {
    const uid = this.authService.getUid();
    if (!uid) {
      console.warn('UIDが取得できませんでした');
      return;
    }
  
    this.firestoreService.getCompanyListByUser(uid).subscribe(companies => {
      this.companyList = companies;
      console.log('[DEBUG] 所属企業一覧取得:', this.companyList.map(c => c.name));
    });

    const userCompaniesRef = collection(this.firestore, `users/${uid}/userCompanies`) as CollectionReference<DocumentData>;
    const snapshot = await getDocs(userCompaniesRef);
  
    snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      const data = doc.data() as { role: 'hr' | 'employee' };
      const companyId = doc.id;
  
      console.log(`[DEBUG] userCompanies ロール情報: ${companyId} → ${data.role}`);
  
      this.userCompanyRoles[companyId] = data.role;
    });
  
    console.log('[DEBUG] userCompanyRoles 完成:', this.userCompanyRoles);
  }

  loadEmployees(): void {
    if (!this.selectedCompanyId || !this.companyInfo) return;
  
    this.firestoreService.getEmployeesForCompany(this.selectedCompanyId).subscribe(async (employees) => {
      const latestMap = await this.firestoreService.getLatestIncomeRecordsMap(this.selectedCompanyId!);
  
      const enriched = employees.map(emp => {
        const latestIncome = latestMap[emp.empNo];
  
        const evaluated = evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome, employees, latestIncome?.applicableMonth);
  
        const includedTotal: number =
          emp.bonusSummary?.bonusDetails
            ?.filter((b: BonusRecordInput) => b.includedInStandardBonus)
            ?.reduce((sum: number, b: BonusRecordInput) => sum + (b.amount || 0), 0) ?? 0;
  
        const bonusMonthlyEquivalent =
          emp.bonusMergedIntoMonthly && includedTotal > 0
            ? Math.floor(includedTotal / 12)
            : undefined;

            const fallbackRates: InsuranceRates = {
              health: { employee: 0, company: 0 },
              pension: { employee: 0, company: 0 },
              care: { employee: 0, company: 0 }
            };
            
            const prefectureRates = this.insuranceRatesTable[this.companyInfo!.prefecture as string] ?? fallbackRates;
            
            const rates: InsuranceRates =
            this.companyInfo!.healthType === '組合健保' && this.companyInfo!.customRates
              ? {
                  health: {
                    employee: parseFloat(this.companyInfo!.customRates.health?.employee ?? '0'),
                    company: parseFloat(this.companyInfo!.customRates.health?.company ?? '0'),
                  },
                  pension: prefectureRates.pension,
                  care: {
                    employee: parseFloat(this.companyInfo!.customRates.care?.employee ?? '0'),
                    company: parseFloat(this.companyInfo!.customRates.care?.company ?? '0'),
                  },
                }
              : prefectureRates;          
  
        const premiums = latestIncome
          ? calculateInsurancePremiums(
              latestIncome.totalMonthlyIncome,
              { ...emp, ...evaluated },
              this.companyInfo!,
              rates,
              this.salaryGradeTable,
              this.pensionGradeTable,
              bonusMonthlyEquivalent
            )
          : null;
  
        return {
          ...emp,
          ...evaluated,
          standardMonthlyAmount: premiums?.standardMonthlyAmount ?? undefined,
          healthGrade: premiums?.healthGrade ?? undefined,
          pensionGrade: premiums?.pensionGrade ?? undefined,
          careGrade: premiums?.careGrade ?? undefined
        };
      });
  
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
  
    const { lastName, firstName } = this.authService.getEmployeeName();
  
    this.firestoreService.createCompanyWithHr(uid, lastName ?? '姓', firstName ?? '名').then(async () => {
      this.firestoreService.getCompanyListByUser(uid).subscribe(async (companies) => {
        this.companyList = companies;

        const userCompaniesRef = collection(this.firestore, `users/${uid}/userCompanies`) as CollectionReference<DocumentData>;
        const snapshot = await getDocs(userCompaniesRef);
        snapshot.forEach((doc) => {
          const data = doc.data() as { role: 'hr' | 'employee' };
          const companyId = doc.id;
          this.userCompanyRoles[companyId] = data.role;
        });
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

  async selectCompany(company: Company): Promise<void> {
    console.log('選択された企業:', company);
    console.log('companyIdの値:', company.companyId);
  
    if (!company.companyId || company.companyId.trim() === '') {
      console.warn('企業IDが空または無効です');
      return;
    }
  
    this.selectedCompanyId = company.companyId;
    this.companyInfo = {
      ...company,
      voluntaryHealthApplicable: company.voluntaryHealthApplicable ?? false,
      voluntaryPensionApplicable: company.voluntaryPensionApplicable ?? false
    };
  
    // 🔸 ロール情報の読み込みを待つ（重要）
    await this.loadAllEmployeeRoles(company.companyId);
  
    console.log('選択企業ID:', company.companyId);
  
    this.firestoreService.getEmployeesForCompany(company.companyId).subscribe(async (employees) => {
      const latestMap = await this.firestoreService.getLatestIncomeRecordsMap(company.companyId);
  
      console.log('[DEBUG] 従業員一覧（firebaseUid含む）:', employees.map(e => ({
        empNo: e.empNo,
        name: `${e.lastName} ${e.firstName}`,
        firebaseUid: e.firebaseUid
      })));
  
      const enriched = employees.map(emp => {
        const latestIncome = latestMap[emp.empNo];
  
        const evaluated = evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome, employees, latestIncome?.applicableMonth);

  
        const includedTotal: number =
          emp.bonusSummary?.bonusDetails
            ?.filter((b: BonusRecordInput) => b.includedInStandardBonus)
            ?.reduce((sum: number, b: BonusRecordInput) => sum + (b.amount || 0), 0) ?? 0;
  
        const bonusMonthlyEquivalent =
          emp.bonusMergedIntoMonthly && includedTotal > 0
            ? Math.floor(includedTotal / 12)
            : undefined;
  
            const fallbackRates: InsuranceRates = {
              health: { employee: 0, company: 0 },
              pension: { employee: 0, company: 0 },
              care: { employee: 0, company: 0 }
            };
            
            const prefectureRates = this.insuranceRatesTable[company.prefecture as string] ?? fallbackRates;
            
            const rates: InsuranceRates =
            company.healthType === '組合健保' && company.customRates
              ? {
                  health: {
                    employee: parseFloat(company.customRates.health?.employee ?? '0'),
                    company: parseFloat(company.customRates.health?.company ?? '0')
                  },
                  pension: prefectureRates.pension,
                  care: {
                    employee: parseFloat(company.customRates.care?.employee ?? '0'),
                    company: parseFloat(company.customRates.care?.company ?? '0')
                  }
                }
              : prefectureRates;
            
  
        const premiums = latestIncome
          ? calculateInsurancePremiums(
              latestIncome.totalMonthlyIncome,
              { ...emp, ...evaluated },
              company,
              rates,
              this.salaryGradeTable,
              this.pensionGradeTable,
              bonusMonthlyEquivalent
            )
          : null;
  
        return {
          ...emp,
          ...evaluated,
          standardMonthlyAmount: premiums?.standardMonthlyAmount ?? null,
          healthGrade: premiums?.healthGrade ?? null,
          pensionGrade: premiums?.pensionGrade ?? null,
          careGrade: premiums?.careGrade ?? null
        };
      });
  
      this.allEmployees = enriched;
      this.applyFilter();
    });
  }

  refreshEmployeeList(): void {
    if (!this.selectedCompanyId || !this.companyInfo) return;
  
    this.firestoreService.getEmployeesForCompany(this.selectedCompanyId).subscribe(async (employees) => {
      const latestMap = await this.firestoreService.getLatestIncomeRecordsMap(this.selectedCompanyId!);
  
      const enriched = employees.map(emp => {
        const latestIncome = latestMap[emp.empNo];
  
        const evaluated = evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome, employees, latestIncome?.applicableMonth);

  
        const includedTotal: number =
          emp.bonusSummary?.bonusDetails
            ?.filter((b: BonusRecordInput) => b.includedInStandardBonus)
            ?.reduce((sum: number, b: BonusRecordInput) => sum + (b.amount || 0), 0) ?? 0;
  
        const bonusMonthlyEquivalent =
          emp.bonusMergedIntoMonthly && includedTotal > 0
            ? Math.floor(includedTotal / 12)
            : undefined;
  
        const companyInfo = this.companyInfo;
        if (!companyInfo) return;
        
        const custom = companyInfo.customRates;
        const isUnion = companyInfo.healthType === '組合健保';
        const defaultRates = this.insuranceRatesTable[companyInfo.prefecture as string] ?? {
          health: { employee: 0, company: 0 },
          pension: { employee: 0, company: 0 },
          care: { employee: 0, company: 0 }
        };
        
        const rates: InsuranceRates = {
          health: isUnion && custom?.health
            ? {
                employee: parseFloat(custom.health.employee ?? '0'),
                company: parseFloat(custom.health.company ?? '0')
              }
            : defaultRates.health,
          pension: defaultRates.pension,
          care: isUnion && custom?.care
            ? {
                employee: parseFloat(custom.care.employee ?? '0'),
                company: parseFloat(custom.care.company ?? '0')
              }
            : defaultRates.care
        };        
  
        const premiums = latestIncome
          ? calculateInsurancePremiums(
              latestIncome.totalMonthlyIncome,
              { ...emp, ...evaluated },
              this.companyInfo!,
              rates,
              this.salaryGradeTable,
              this.pensionGradeTable,
              bonusMonthlyEquivalent
            )
          : null;
  
        return {
          ...emp,
          ...evaluated,
          standardMonthlyAmount: premiums?.standardMonthlyAmount ?? undefined,
          healthGrade: premiums?.healthGrade ?? undefined,
          pensionGrade: premiums?.pensionGrade ?? undefined,
          careGrade: premiums?.careGrade ?? undefined
        };
      });
  
      this.allEmployees = enriched;
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
      emp.empNo?.toLowerCase().includes(term) ||
      emp.lastNameKana?.toLowerCase().includes(term) ||
      emp.firstNameKana?.toLowerCase().includes(term) ||
      emp.dept?.toLowerCase().includes(term)
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
      width: '720px',
      data: {
        employee,
        companyId: this.selectedCompanyId,
        isEdit,
        allowEditEmpNo: true,
      },
    });
  
    dialogRef.afterClosed().subscribe(async (result: any) => {

      console.log('[DEBUG] dialog result:', result);

      if (!result || !this.selectedCompanyId || !this.companyInfo) return;
      this.isProcessingDialogSave = true;
  
      try {
        const validGenders = ['male', 'female', 'other'];
        const validStatuses = ['none', 'daytime', 'nighttime', 'correspondence'];
        const { incomeRecords, dependents, bonusSummary, password, email, ...base } = result;
  
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
          expectedDuration: ['within2Months', 'over2Months', 'indefinite'].includes(base.expectedDuration!) ? base.expectedDuration : 'within2Months',
          joinDate: base.joinDate ? toJSTMidnightISO(new Date(base.joinDate)) : '',
          leaveDate: base.leaveDate ? toJSTMidnightISO(new Date(base.leaveDate)) : '',
          birthday: base.birthday ? toJSTMidnightISO(new Date(base.birthday)) : '',
          gender: validGenders.includes(base.gender!) ? base.gender : undefined,
          studentStatus: validStatuses.includes(base.studentStatus!) ? base.studentStatus : 'none',
          note: base.note?.trim() ?? '',
          nationality: base.nationality?.trim() ?? '',
          residencyStatus: base.residencyStatus?.trim() ?? '',
          bonusMergedIntoMonthly: base.bonusMergedIntoMonthly ?? false,
          bonusSummary: bonusSummary ?? undefined,
          firebaseUid: base.firebaseUid ?? (isEdit ? employee?.firebaseUid ?? null : undefined),
          isDeleted: false,
          excludedBySocialAgreement: base.excludedBySocialAgreement ?? false,
          isDependentInsured: base.isDependentInsured ?? false,
          hasExemption: base.hasExemption ?? false,
          healthInsuranceStatus: base.healthInsuranceStatus ?? '加入',
          pensionStatus: base.pensionStatus ?? '加入',
          careInsuranceStatus: base.careInsuranceStatus ?? '加入（対象）',
          exemptionDetails: base.exemptionDetails ?? {
            types: [],
            targetInsurances: [],
            startMonth: '',
            endMonth: '',
            notes: ''
          }
        };

        console.log('[DEBUG] 保存直前 cleaned:', cleaned);
  
        const oldEmpNo = isEdit ? employee?.empNo : undefined;
        const isEmpNoChanged = isEdit && oldEmpNo && oldEmpNo !== cleaned.empNo;
  
        const exists = await this.firestoreService.checkEmployeeExists(this.selectedCompanyId, cleaned.empNo);
        const editingOwn = !isEmpNoChanged && oldEmpNo === cleaned.empNo;
  
        if (!isEdit && exists) {
          this.snackbar.open('この社員番号は既に存在しています（退職等含む）', '閉じる', { duration: 4000 });
          return;
        }
        if (exists && !editingOwn) {
          this.snackbar.open('この社員番号は既に使用されています（退職等含む）', '閉じる', { duration: 4000 });
          return;
        }
  
        if (!isEdit) {
          if (!email || !password) {
            this.snackbar.open('メールアドレスまたはパスワードが入力されていません', '閉じる', { duration: 4000 });
            return;
          }
  
          const hrEmail = this.auth.currentUser?.email;
          const hrPassword = prompt('新規アカウント追加のため、あなたのアカウントのパスワードを入力してください');
          if (!hrEmail || !hrPassword) {
            this.snackbar.open('現在のユーザー情報の取得に失敗しました', '閉じる', { duration: 4000 });
            return;
          }
  
          const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
          const uid = userCred.user.uid;
          await this.firestoreService.saveUser(uid, { uid, email, lastName: base.lastName, firstName: base.firstName });
          await this.firestoreService.saveUserCompany(uid, this.selectedCompanyId, { companyId: this.selectedCompanyId, role: 'employee' });
          cleaned.firebaseUid = uid;
  
          await signInWithEmailAndPassword(this.auth, hrEmail, hrPassword);
        }
  
        await this.firestoreService.saveEmployee(this.selectedCompanyId, cleaned);
  
        if (isEmpNoChanged) {
          await this.firestoreService.migrateEmployeeData(this.selectedCompanyId, oldEmpNo!, cleaned.empNo);
          await this.firestoreService.deleteEmployee(this.selectedCompanyId, oldEmpNo!);
        }
  
        if (incomeRecords?.length) {
          for (const record of incomeRecords) {
            if (!record.applicableMonth || !record.totalMonthlyIncome) continue;
        
            await this.firestoreService.saveIncomeRecord(
              this.selectedCompanyId,
              cleaned.empNo,
              record.applicableMonth,
              record
            );
        
            const includedTotal =
              cleaned.bonusSummary?.bonusDetails?.filter(b => b.includedInStandardBonus)
                .reduce((sum, b) => sum + (b.amount || 0), 0) ?? 0;
        
            const bonusMonthlyEquivalent =
              cleaned.bonusMergedIntoMonthly && includedTotal > 0
                ? Math.floor(includedTotal / 12)
                : undefined;
        
                const useCustom = this.companyInfo.healthType === '組合健保';
                const custom = this.companyInfo.customRates;
                
                const defaultRates = this.insuranceRatesTable[this.companyInfo.prefecture as string] ?? {
                  health: { employee: 0, company: 0 },
                  pension: { employee: 0, company: 0 },
                  care: { employee: 0, company: 0 },
                };
                
                const rates: InsuranceRates = {
                  health: useCustom && custom?.health
                    ? {
                        employee: parseFloat(custom.health.employee ?? '0'),
                        company: parseFloat(custom.health.company ?? '0')
                      }
                    : defaultRates.health,
                
                  pension: defaultRates.pension,
                
                  care: useCustom && custom?.care
                    ? {
                        employee: parseFloat(custom.care.employee ?? '0'),
                        company: parseFloat(custom.care.company ?? '0')
                      }
                    : defaultRates.care,
                };                
        
            const premiums = calculateInsurancePremiums(
              record.totalMonthlyIncome,
              cleaned,
              this.companyInfo,
              rates,
              this.salaryGradeTable,
              this.pensionGradeTable,
              bonusMonthlyEquivalent
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
          const converted = dependents.map((d: Dependent) => {
            const birthdayStr = d.birthday
              ? new Date(d.birthday).toISOString()
              : crypto.randomUUID();
          
            return {
              ...d,
              birthday: d.birthday ? new Date(d.birthday).toISOString() : null,
              id: d.id ?? `${d.name}_${birthdayStr}`
            };
          });
          await this.firestoreService.saveDependents(this.selectedCompanyId!, cleaned.empNo, converted);
        }

        if (bonusSummary?.bonusDetails?.length) {
          const empNo = cleaned.empNo?.trim();
        
          if (!empNo) {
            console.warn('[saveBonusPremium] empNo が空のためボーナス保険料保存をスキップします');
          } else {
            await this.firestoreService.saveBonusRecords(this.selectedCompanyId!, empNo, bonusSummary.bonusDetails);
        
            const bonusPremiums = await this.firestoreService.getBonusPremiumRecords(this.selectedCompanyId!, empNo);
            const bonusPremiumMap = new Map(
              bonusPremiums.map(p => [p.applicableMonth, p])
            );
        
            for (const bonus of bonusSummary.bonusDetails) {
              if (!bonus.applicableMonth || !bonus.amount) continue;
            
              const savedPremium = bonusPremiumMap.get(bonus.applicableMonth);
            
              const useCustom = this.companyInfo.healthType === '組合健保';
              const defaultRates = this.insuranceRatesTable[this.companyInfo.prefecture ?? 'default'];
              
              const rates: InsuranceRates = {
                health: useCustom && this.companyInfo.customRates?.health
                  ? {
                      employee: parseFloat(this.companyInfo.customRates.health.employee ?? '0'),
                      company: parseFloat(this.companyInfo.customRates.health.company ?? '0')
                    }
                  : defaultRates.health,
              
                pension: defaultRates.pension,
              
                care: useCustom && this.companyInfo.customRates?.care
                  ? {
                      employee: parseFloat(this.companyInfo.customRates.care.employee ?? '0'),
                      company: parseFloat(this.companyInfo.customRates.care.company ?? '0')
                    }
                  : defaultRates.care,
              };
            
              const premium = savedPremium ?? calculateBonusPremium(
                bonus.amount,
                cleaned,
                this.companyInfo,
                rates,
                bonus.includedInStandardBonus
              );
            
              if (premium) {
                const bonusPremium: BonusPremiumRecord = {
                  empNo,
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
            
                await this.firestoreService.saveBonusPremium(this.selectedCompanyId!, empNo, bonusPremium.bonusId, bonusPremium);
              }
            }            
          }
        }        
  
        const employeeList = await this.firestoreService.getEmployeesForCompany(this.selectedCompanyId!).toPromise();
        const count = employeeList?.length ?? 0;
        await this.firestoreService.updateCompanyEmployeeCount(this.selectedCompanyId!, count);
  
        const standardHours = this.companyInfo.standardWeeklyHours ?? 40;
        const applicableCount = (employeeList ?? []).filter(emp => {
          const age = getAge(emp.birthday);
          return age >= 20 && age < 75 && emp.studentStatus !== 'daytime' && emp.expectedDuration !== 'within2Months' && emp.weeklyHours >= standardHours * 0.75;
        }).length;
  
        const isActuallyHealthApplicable = applicableCount >= 51;
        const isActuallyPensionApplicable = applicableCount >= 51;
  
        this.companyInfo.isActuallyApplicableToHealthInsurance = isActuallyHealthApplicable;
        this.companyInfo.isActuallyApplicableToPension = isActuallyPensionApplicable;
        this.companyInfo.isApplicableToHealthInsurance = isActuallyHealthApplicable;
        this.companyInfo.isApplicableToPension = isActuallyPensionApplicable;
  
        await this.firestoreService.saveCompanyOnly(this.selectedCompanyId!, this.companyInfo);
  
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
  
        const updatedCompany = await this.firestoreService.getCompany(this.selectedCompanyId!);
        if (updatedCompany) this.companyInfo = updatedCompany;
  
        const latestMap = await this.firestoreService.getLatestIncomeRecordsMap(this.selectedCompanyId!);
        const updatedEmployees = (employeeList ?? []).map(emp => {
          const latestIncome = latestMap[emp.empNo];
          const evaluated = evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome, employeeList, latestIncome?.applicableMonth);

        
          const useCustom = this.companyInfo!.healthType === '組合健保';
          const custom = this.companyInfo!.customRates;
          const defaultRates = this.insuranceRatesTable[this.companyInfo!.prefecture as string] ?? {
            health: { employee: 0, company: 0 },
            pension: { employee: 0, company: 0 },
            care: { employee: 0, company: 0 },
          };
          
          const rates: InsuranceRates = {
            health: useCustom && custom?.health
              ? {
                  employee: parseFloat(custom.health.employee ?? '0'),
                  company: parseFloat(custom.health.company ?? '0'),
                }
              : defaultRates.health,
          
            pension: defaultRates.pension,
          
            care: useCustom && custom?.care
              ? {
                  employee: parseFloat(custom.care.employee ?? '0'),
                  company: parseFloat(custom.care.company ?? '0'),
                }
              : defaultRates.care,
          };
          
          const premiums = latestIncome
            ? calculateInsurancePremiums(
                latestIncome.totalMonthlyIncome,
                { ...emp, ...evaluated },
                this.companyInfo!,
                rates,
                this.salaryGradeTable,
                this.pensionGradeTable
              )
            : null;
        
          return {
            ...emp,
            ...evaluated,
            standardMonthlyAmount: premiums?.standardMonthlyAmount ?? undefined,
            healthGrade: (premiums as any)?.health?.grade ?? undefined,
            pensionGrade: (premiums as any)?.pension?.grade ?? undefined,
            careGrade: (premiums as any)?.care?.grade ?? undefined
          } as Employee;
        });        
  
        await this.firestoreService.batchSaveEmployees(this.selectedCompanyId!, updatedEmployees);
  
        this.snackbar.open('従業員を削除しました（再評価済）', '閉じる', { duration: 3000 });
        this.loadEmployees();
      } catch (err) {
        console.error('削除エラー:', err);
        this.snackbar.open('削除に失敗しました', '閉じる');
      }
    });
  }
  
  isIncompleteEmployee(employee: Employee): boolean {
    return !employee.lastName || !employee.firstName || !employee.joinDate || employee.weeklyHours === 0;
  }  

  isCompanyInfoValid(): boolean {
    return !!this.companyInfo &&
      !!this.companyInfo.prefecture &&
      !!this.companyInfo.healthType &&
      !!this.companyInfo.standardWeeklyHours;
  }  

  async saveCompanyData(): Promise<void> {
    if (!this.companyInfo) return;

    if (!this.companyInfo.prefecture || !this.companyInfo.healthType || !this.companyInfo.standardWeeklyHours) {
      this.snackbar.open('企業名・都道府県・健保種別・基準時間は必須です', '閉じる', { duration: 4000 });
      return;
    }

    const id = this.selectedCompanyId ?? null;
  
    try {
      const employeeList = await this.firestoreService.getEmployeesForCompany(id ?? '').toPromise();
      const employees = employeeList ?? [];
  
      const standardHours = this.companyInfo.standardWeeklyHours ?? 40;
      const applicableCount = employees.filter(emp => {
        const age = getAge(emp.birthday);
        const isStudent = emp.studentStatus === 'daytime';
        const isDurationOK = emp.expectedDuration !== 'within2Months';
        const isFullTime = emp.weeklyHours >= standardHours * 0.75;
        return age >= 20 && age < 75 && !isStudent && isDurationOK && isFullTime;
      }).length;
  
      const isActuallyHealthApplicable = applicableCount >= 51;
      const isActuallyPensionApplicable = applicableCount >= 51;
  
      this.companyInfo.isActuallyApplicableToHealthInsurance = isActuallyHealthApplicable;
      this.companyInfo.isActuallyApplicableToPension = isActuallyPensionApplicable;
  
      this.companyInfo.isApplicableToHealthInsurance = isActuallyHealthApplicable;
      this.companyInfo.isApplicableToPension = isActuallyPensionApplicable;
  
      const savedId = await this.firestoreService.saveCompanyOnly(id, this.companyInfo);
      this.selectedCompanyId = savedId;
      this.companyInfo!.companyId = savedId;
  
      const latestMap = await this.firestoreService.getLatestIncomeRecordsMap(savedId);

      const updatedEmployees: Employee[] = employees.map(emp => {
        const latestIncome = latestMap[emp.empNo];
        const evaluated = evaluateInsuranceStatus(emp, this.companyInfo!, latestIncome, employees, latestIncome?.applicableMonth);
  
        const includedTotal: number =
        emp.bonusSummary?.bonusDetails
          ?.filter((b: BonusRecordInput) => b.includedInStandardBonus)
          ?.reduce((sum: number, b: BonusRecordInput) => sum + (b.amount || 0), 0) ?? 0;
      
          const bonusMonthlyEquivalent =
          emp.bonusMergedIntoMonthly && includedTotal > 0
            ? Math.floor(includedTotal / 12)
            : undefined;
        
            const isUnion = this.companyInfo!.healthType === '組合健保';
            const custom = this.companyInfo!.customRates;
            const defaultRates = this.insuranceRatesTable[this.companyInfo!.prefecture as string] ?? {
              health: { employee: 0, company: 0 },
              pension: { employee: 0, company: 0 },
              care: { employee: 0, company: 0 },
            };

            const rates: InsuranceRates = {
              health: isUnion && custom?.health
                ? {
                    employee: parseFloat(custom.health.employee ?? '0'),
                    company: parseFloat(custom.health.company ?? '0'),
                  }
                : defaultRates.health,
            
              pension: defaultRates.pension,
            
              care: isUnion && custom?.care
                ? {
                    employee: parseFloat(custom.care.employee ?? '0'),
                    company: parseFloat(custom.care.company ?? '0'),
                  }
                : defaultRates.care,
            };
            
        const premiums = latestIncome
          ? calculateInsurancePremiums(
              latestIncome.totalMonthlyIncome,
              { ...emp, ...evaluated },
              this.companyInfo!,
              rates,
              this.salaryGradeTable,
              this.pensionGradeTable,
              bonusMonthlyEquivalent
            )
          : null;
        
        return {
          ...emp,
          ...evaluated,
          standardMonthlyAmount: premiums?.standardMonthlyAmount ?? undefined,
          healthGrade: (premiums as any)?.health?.grade ?? undefined,
          pensionGrade: (premiums as any)?.pension?.grade ?? undefined,
          careGrade: (premiums as any)?.care?.grade ?? undefined
        } as Employee;        
      });
  
      // 🔸 ⑧ 一括保存と従業員数再設定
      await this.firestoreService.batchSaveEmployees(savedId, updatedEmployees);
      await this.firestoreService.updateCompanyEmployeeCount(savedId, updatedEmployees.length);
  
      // 🔸 ⑨ 企業一覧の再取得・反映
      const uid = this.authService.getUid();
      if (uid) {
        this.firestoreService.getCompanyListByUser(uid).subscribe(companies => {
          this.companyList = companies;
          const updated = companies.find(c => c.companyId === savedId);
          if (updated) this.selectCompany(updated);
        });
      }
  
      this.snackbar.open('企業情報を保存しました（再評価済）', '閉じる', { duration: 3000 });
  
    } catch (err) {
      console.error('保存エラー:', err);
      this.snackbar.open('企業情報の保存に失敗しました', '閉じる');
    }
  }  
    
  formatPostalCode(): void {
    if (!this.companyInfo) return;
  
    let code = this.companyInfo.postalCode ?? '';
  
    code = code.replace(/[Ａ-Ｚａ-ｚ０-９]/g, s =>
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );
  
    const numeric = code.replace(/\D/g, '');
  
    if (numeric.length === 7) {
      this.companyInfo.postalCode = `${numeric.slice(0, 3)}-${numeric.slice(3)}`;
    } else {
      this.companyInfo.postalCode = numeric;
    }
  
    const address = this.companyInfo.address ?? '';
    this.companyInfo.prefecture = getPrefectureFromAddress(address);
  }

  async importCsvData(parsedData: any[]): Promise<void> {
    if (!this.selectedCompanyId || !parsedData?.length) return;
  
    this.isProcessingCsv = true;
  
    const currentUser = this.auth.currentUser;
    const currentEmail = currentUser?.email;
  
    try {
      const employeeMap = new Map<string, Employee>();
  
      const requiredFields = [
        'empNo', 'lastName', 'firstName',
        'lastNameKana', 'firstNameKana',
        'email', 'password',
        'employmentType', 'expectedDuration',
        'weeklyHours', 'joinDate', 'birthday',
        'studentStatus'
      ];
  
      for (const row of parsedData) {
        const isMissingRequired = requiredFields.some(field => {
          const value = row[field];
          return value === undefined || value === null || value.toString().trim() === '';
        });
  
        if (isMissingRequired) continue;
  
        const empNo = row.empNo.trim();
        const email = row.email.trim();
        const password = row.password.trim();
  
        const userCred = await createUserWithEmailAndPassword(this.auth, email, password);
        const uid = userCred.user.uid;
  
        await this.firestoreService.saveUser(uid, {
          uid,
          email,
          lastName: row.lastName,
          firstName: row.firstName,
        });
  
        await this.firestoreService.saveUserCompany(uid, this.selectedCompanyId, {
          companyId: this.selectedCompanyId,
          role: 'employee',
        });
  
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
          note: row.note,
          bonusMergedIntoMonthly: row.bonusMergedIntoMonthly === 'true',
          bonusSummary: row.bonusSummary ? JSON.parse(row.bonusSummary) : undefined,
          firebaseUid: uid,
        };
  
        employeeMap.set(empNo, employee);
        await this.firestoreService.saveEmployee(this.selectedCompanyId, employee);
  
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
          await this.firestoreService.saveIncomeRecord(this.selectedCompanyId, empNo, row.applicableMonth, income);
        }

        if (row.bonusMonth && row.bonusAmount) {
          if (empNo && empNo.trim() !== '') {
            await this.firestoreService.saveBonusRecord(this.selectedCompanyId, empNo, row.bonusMonth, {
              applicableMonth: row.bonusMonth,
              amount: Number(row.bonusAmount)
            });
          } else {
            console.warn(`[CSV取込] bonus保存スキップ: empNoが空 (${JSON.stringify(row)})`);
          }
        }
      }
  
      if (currentEmail) {
        await signInWithEmailAndPassword(
          this.auth,
          currentEmail,
          prompt('新規アカウント追加のため、あなたのアカウントのパスワードを入力してください') ?? ''
        );
      }
  
      this.snackbar.open(`CSV取込とアカウント登録完了 ✅`, '閉じる', { duration: 5000 });
      this.loadEmployees();
  
    } catch (err) {
      console.error('❌ CSV登録中にエラー:', err);
      this.snackbar.open('CSVインポートに失敗しました', '閉じる', { duration: 5000 });
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

  get isForcedApplicableToHealth(): boolean {
    return this.companyInfo?.isApplicableToHealthInsurance === true;
  }
  
  get isForcedApplicableToPension(): boolean {
    return this.companyInfo?.isApplicableToPension === true;
  }

  userCompanyRoles: { [companyId: string]: 'hr' | 'employee' } = {};

  onVoluntaryCheckboxChange(type: 'health' | 'pension'): void {

    if (type === 'health' && this.isForcedApplicableToHealth) {
      this.companyInfo!.voluntaryHealthApplicable = false;
    }
    if (type === 'pension' && this.isForcedApplicableToPension) {
      this.companyInfo!.voluntaryPensionApplicable = false;
    }
  }

  get canEditSelectedCompany(): boolean {
    return !!this.selectedCompanyId && this.userCompanyRoles[this.selectedCompanyId] === 'hr';
  }

  currentUserUid = this.authService.getUid();

  public async toggleUserRole(uid: string | undefined, toHr: boolean): Promise<void> {
    const companyId = this.selectedCompanyId;
  
    if (!uid || !companyId || !this.firestore) {
      console.warn('[toggleUserRole] 無効なuid/companyId/firestore', { uid, companyId, firestore: this.firestore });
      return;
    }
  
    try {
      const role: 'hr' | 'employee' = toHr ? 'hr' : 'employee';
  
      const path = `users/${uid}/userCompanies/${companyId}`;
      const userCompanyRef = doc(this.firestore, path);
  
      await updateDoc(userCompanyRef, { role });
  
      const key = `${companyId}_${uid}`;
      this.employeeCompanyRoles[key] = role;
  
      this.refreshEmployeeList();
  
      console.log(`[DEBUG] ロールを更新しました: ${key} → ${role}`);
    } catch (error) {
      console.error('[ERROR] Firestore role 更新エラー:', error);
    }
  }
  
  

  getUserRole(uid: string): 'hr' | 'employee' {
    const companyId = this.selectedCompanyId;
    if (!companyId || !uid) return 'employee';
    return this.employeeCompanyRoles[`${companyId}_${uid}`] ?? 'employee';
  }
  

  employeeCompanyRoles: { [key: string]: 'hr' | 'employee' } = {};

  async loadAllEmployeeRoles(companyId: string): Promise<void> {
    this.employeeCompanyRoles = {}; // リセット
  
    const employees = await this.firestoreService.getEmployeesForCompany(companyId).toPromise();
  
    if (!employees || employees.length === 0) {
      console.warn('[WARN] 従業員一覧が取得できませんでした');
      return;
    }
  
    for (const emp of employees) {
      const uid = emp.firebaseUid;
      if (!uid) continue;
  
      const ref = doc(this.firestore, `users/${uid}/userCompanies/${companyId}`);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as { role: 'hr' | 'employee' };
        const key = `${companyId}_${uid}`;
        this.employeeCompanyRoles[key] = data.role;
        console.log(`[DEBUG] employeeCompanyRoles: ${key} → ${data.role}`);
      }
    }
  }

  downloadCsvTemplate(): void {
    const headers = [
      'empNo', 'lastName', 'firstName', 'lastNameKana', 'firstNameKana',
      'email', 'password', 'employmentType', 'expectedDuration',
      'weeklyHours', 'joinDate', 'birthday', 'studentStatus',
      'gender', 'salaryType', 'note'
    ];
  
    const csvContent = [headers.join(',')].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement('a');
    link.href = url;
    link.download = 'employee_template.csv';
    link.click();
  
    URL.revokeObjectURL(url);
  }

  openCsvGuideDialog(): void {
    this.dialog.open(CsvGuideDialogComponent, {
      width: '3000px',
    });
  }
  
}