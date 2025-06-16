import { Injectable } from '@angular/core';
import {Firestore, collection, collectionData, doc, setDoc, addDoc, getDocs, CollectionReference, DocumentReference, query, where, updateDoc, deleteDoc, Query, DocumentData, getDoc, Timestamp, orderBy, limit, collectionGroup, documentId} from '@angular/fire/firestore';
import { Observable, from, map, of, switchMap, tap } from 'rxjs';
import { Company, NewCompany } from '../models/company.model';
import { BonusRecord, Employee } from '../models/employee.model';
import { Dependent } from '../models/dependent.model';
import { EmployeeInsurancePremiums, InsurancePremiumRecord, InsurancePremiumSnapshot, PremiumDetail } from '../models/insurance-premium.model';
import { BonusPremiumRecord } from '../models/bonus-premium.model';
import { SubmissionRecord, SubmissionType } from '../models/submission-record.model';
import { ActualPremiumRecord, ActualPremiumMethod, ActualPremiumEntry } from '../models/actual-premium.model';
import { IncomeRecord } from '../models/income-record.model';
import { format, subMonths } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

export function cleanData(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(private firestore: Firestore) {}

  async saveBonusPremiumRecord(
    companyId: string,
    empNo: string,
    applicableMonth: string,
    record: BonusPremiumRecord
  ): Promise<void> {
    try {
      const bonusId = record.bonusId;
      const docRef = doc(
        this.firestore,
        `companies/${companyId}/employees/${empNo}/bonusPremiums/${bonusId}`
      );
      await setDoc(docRef, record, { merge: true });
    } catch (error) {
      console.error('❌ Failed to save bonus premium record:', error);
      throw new Error('賞与保険料の保存に失敗しました');
    }
  }

  createEmptyCompany(currentUid: string): Promise<string> {
    const companiesRef = collection(this.firestore, 'companies');
  
    const newCompany: NewCompany = {
      name: '（新規企業）',
      address: '',
      postalCode: '',
      phone: '',
      healthType: '',
      insurerNumber: '',
      branchLink: '',
      isDeleted: false,
      voluntaryHealthApplicable: false,
      voluntaryPensionApplicable: false
    };
  
    return addDoc(companiesRef, newCompany).then(docRef => docRef.id);
  }
  
  getCompanyListByUser(uid: string): Observable<Company[]> {
    const userCompanyRef = collection(this.firestore, `users/${uid}/userCompanies`);
    
    return from(getDocs(userCompanyRef)).pipe(
      map(snapshot => snapshot.docs.map(doc => doc.id)),
      switchMap((ids: string[]) => {
        if (ids.length === 0) return of([]);
        const companyDocs = ids.map(id => getDoc(doc(this.firestore, `companies/${id}`)));
        return from(Promise.all(companyDocs)).pipe(
          map(snapshots => {
            const allCompanies = snapshots
              .filter(s => s.exists())
              .map(s => {
                const data = s.data();
                console.log('🧩 company raw:', s.id, data);
                return {
                  companyId: s.id,
                  ...data
                } as Company;
              });
    
            console.log('✅ All company data:', allCompanies);
    
            return allCompanies.filter(c => !c.isDeleted);
          })
        );
      })
    );
  }
  

  softDeleteCompany(companyId: string): Promise<void> {
    const ref = doc(this.firestore, 'companies', companyId);
    return updateDoc(ref, { isDeleted: true });
  }
  
  getEmployeesForCompany(companyId: string): Observable<Employee[]> {
    const col = collection(this.firestore, `companies/${companyId}/employees`);
    const q = query(col, where('isDeleted', '==', false));
  
    return from(getDocs(q)).pipe(
      switchMap(async (snapshot) => {
        const employees: Employee[] = [];
  
        for (const doc of snapshot.docs) {
          const data = doc.data();
  
          const emp: Employee = {
            empNo: data['empNo'] ?? '',
            lastName: data['lastName'] ?? '',
            firstName: data['firstName'] ?? '',
            lastNameKana: data['lastNameKana'] ?? '',
            firstNameKana: data['firstNameKana'] ?? '',
            dept: data['dept'] ?? '',
            employmentType: data['employmentType'] ?? '',
            weeklyHours: data['weeklyHours'] ?? 0,
            joinDate: data['joinDate'] ?? '',
            leaveDate: data['leaveDate'] ?? '',
            birthday: data['birthday'] ?? '',
            gender: data['gender'] ?? '',
            studentStatus: data['studentStatus'] ?? 'none',
            expectedDuration: data['expectedDuration'] ?? '',
            healthInsuranceStatus: data['healthInsuranceStatus'] ?? '',
            healthInsuranceReason: data['healthInsuranceReason'] ?? '',
            pensionStatus: data['pensionStatus'] ?? '',
            pensionReason: data['pensionReason'] ?? '',
            careInsuranceStatus: data['careInsuranceStatus'] ?? '',
            careInsuranceReason: data['careInsuranceReason'] ?? '',
            note: data['note'] ?? '',
            bonusMergedIntoMonthly: data['bonusMergedIntoMonthly'] ?? false,
            bonusSummary: data['bonusSummary'] ?? undefined,
            bonusRecords: [],
            firebaseUid: data['firebaseUid'],
            excludedBySocialAgreement: data['excludedBySocialAgreement'] ?? false,
            isDependentInsured: data['isDependentInsured'] ?? false
          };
  
          const bonusCol = collection(this.firestore, `companies/${companyId}/employees/${emp.empNo}/bonusRecords`);
          const bonusSnap = await getDocs(bonusCol);
          emp.bonusRecords = bonusSnap.docs.map(b => ({
            ...(b.data() as BonusRecord),
            bonusId: b.id,
          }));
  
          employees.push(emp);
        }
  
        return employees;
      }),
      switchMap((employees: Employee[]) => of(employees))
    );
  }  

  async saveCompanyWithEmployees(companyId: string | null, company: any, employees: any[]): Promise<string> {
    const companiesCol = collection(this.firestore, 'companies');
  
    const companyDocRef = companyId
      ? doc(this.firestore, 'companies', companyId)
      : doc(companiesCol);
  
      await setDoc(companyDocRef, cleanData(company));
  
    const employeeColRef = collection(this.firestore, `companies/${companyDocRef.id}/employees`);
    for (const emp of employees) {
      await addDoc(employeeColRef, cleanData(emp));
    }
  
    console.log('保存完了:', companyDocRef.id);
    return companyDocRef.id;
  }
  
  async getCompanyWithEmployees(): Promise<any> {
    const companyCol = collection(this.firestore, 'companies');
    const snapshot = await getDocs(companyCol);
    const companyDocs = snapshot.docs;
  
    if (companyDocs.length === 0) return null;
  
    const companyData = companyDocs[0].data();
    const companyId = companyDocs[0].id;
  
    const empCol = collection(this.firestore, `companies/${companyId}/employees`);
    const empSnap = await getDocs(empCol);
    const employees = empSnap.docs.map(doc => doc.data());
  
    return { company: companyData, employees };
  }

  async saveEmployee(companyId: string, employee: Employee, originalEmpNo?: string): Promise<void> {
    const newEmpId = employee.empNo?.trim();
    const oldEmpId = originalEmpNo?.trim();
  
    if (!newEmpId) {
      return Promise.reject(new Error('empNo が未入力のため、従業員情報を保存できません'));
    }
  
    const newDocRef = doc(this.firestore, `companies/${companyId}/employees/${newEmpId}`);
  
    await setDoc(newDocRef, cleanData({
      ...employee,
      empNo: newEmpId,
      isDeleted: false,
      firebaseUid: employee.firebaseUid ?? null,

      excludedBySocialAgreement: employee.excludedBySocialAgreement ?? false,
      isDependentInsured: employee.isDependentInsured ?? false
    }), { merge: false });
    
  
    if (oldEmpId && oldEmpId !== newEmpId) {
      const oldDocRef = doc(this.firestore, `companies/${companyId}/employees/${oldEmpId}`);
      await deleteDoc(oldDocRef);
    }
  }  
  

  async updateCompanyEmployeeCount(companyId: string, count: number): Promise<void> {
    const companyRef = doc(this.firestore, `companies/${companyId}`);
    return updateDoc(companyRef, {
      totalEmployeeCount: count
    });
  }
  
  async checkEmployeeExists(companyId: string, empNo: string): Promise<boolean> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const snap = await getDoc(ref);
    return snap.exists();
  }

  deleteEmployee(companyId: string, empNo: string): Promise<void> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    return updateDoc(ref, { isDeleted: true });
  }

  saveCompanyOnly(companyId: string | null, company: Company): Promise<string> {
    const companiesCol = collection(this.firestore, 'companies');
    const companyDocRef = companyId
      ? doc(this.firestore, 'companies', companyId)
      : doc(companiesCol);
  
    const payload = {
      ...company,
      voluntaryHealthApplicable: company.voluntaryHealthApplicable ?? false,
      voluntaryPensionApplicable: company.voluntaryPensionApplicable ?? false,
      standardWeeklyHours: company.standardWeeklyHours ?? 40
    };
  
    return setDoc(companyDocRef, cleanData(payload)).then(() => companyDocRef.id);
  }
  

  async saveDependent(companyId: string, empNo: string, dependent: any): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const depId = `${dependent.name}_${dependent.birthday}`;
    const ref = doc(collection(empRef, 'dependents'), depId);
  
    const birthdayDate = dependent.birthday
      ? (dependent.birthday instanceof Date
          ? dependent.birthday
          : new Date(dependent.birthday))
      : null;
  
    return setDoc(ref, {
      ...cleanData({
        ...dependent,
        birthday: birthdayDate ? Timestamp.fromDate(birthdayDate) : null
      }),
      createdAt: Timestamp.now()
    }, { merge: true });
  }  

  async saveIncomeRecord(companyId: string, empNo: string, yearMonth: string, data: any): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const ref = doc(collection(empRef, 'incomeRecords'), yearMonth);
  
    return setDoc(ref, {
      ...cleanData(data),
      createdAt: Timestamp.now()
    }, { merge: true });
  }  

  async getLatestIncomeRecord(companyId: string, empNo: string): Promise<any | null> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const col = collection(empRef, 'incomeRecords');
    const q = query(col, orderBy('applicableMonth', 'desc'), limit(1));
  
    const snap = await getDocs(q);
    if (snap.empty) return null;
  
    return snap.docs[0].data();
  }

  async getIncomeRecords(companyId: string, empNo: string): Promise<any[]> {
    const parentRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const incomeCol = collection(parentRef, 'incomeRecords');
    const snap = await getDocs(incomeCol);
    return snap.docs.map(doc => doc.data());
  }

  async saveBonusRecord(companyId: string, empNo: string, applicableMonth: string, data: any): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const ref = doc(collection(empRef, 'bonusRecords'), applicableMonth);
    return setDoc(ref, {
      ...cleanData(data),
      createdAt: Timestamp.now()
    }, { merge: true });
  }
  
  async deleteBonusRecord(companyId: string, empNo: string, bonusId: string): Promise<void> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}/bonusRecords/${bonusId}`);
    return deleteDoc(ref);
  }  

  async getBonusRecords(companyId: string, empNo: string): Promise<any[]> {
    const col = collection(this.firestore, `companies/${companyId}/employees/${empNo}/bonusRecords`);
    const snap = await getDocs(col);
  
    return snap.docs.map(doc => ({
      applicableMonth: doc.id,
      ...doc.data()
    }));
  }

  async getDependents(companyId: string, empNo: string): Promise<Dependent[]> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const depCol = collection(empRef, 'dependents');
    const snap = await getDocs(depCol);
  
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        birthday: data['birthday']?.toDate?.() ?? null
      } as Dependent;
    });
  }  

  async getCompany(companyId: string): Promise<Company | null> {
    const ref = doc(this.firestore, 'companies', companyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
  
    const data = snap.data();
  
    return {
      companyId: snap.id,
      ...data,
      voluntaryHealthApplicable: data['voluntaryHealthApplicable'] ?? false,
      voluntaryPensionApplicable: data['voluntaryPensionApplicable'] ?? false,
      standardWeeklyHours: data['standardWeeklyHours'] ?? 40
    } as Company;
  }
  
  
  async getEmployee(companyId: string, empNo: string): Promise<Employee | null> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as Employee;
  }

  async saveInsurancePremium(
    companyId: string,
    empNo: string,
    applicableMonth: string,
    premiumData: InsurancePremiumRecord
  ): Promise<void> {
    if (!applicableMonth || typeof applicableMonth !== 'string') {
      console.error('❌ applicableMonth が不正（保存スキップ）:', applicableMonth);
      return;
    }
  
    try {
      const ref = doc(
        this.firestore,
        `companies/${companyId}/employees/${empNo}/insurancePremiums/${applicableMonth}`
      );
  
      await setDoc(ref, cleanData(premiumData));
      console.log('✅ Firestore 保険料保存完了:', ref.path);
    } catch (err) {
      console.error('🔥 Firestore 保険料保存失敗:', err);
    }
  }
  

  async getInsurancePremium(
    companyId: string,
    empNo: string,
    applicableMonth: string
  ): Promise<InsurancePremiumRecord | null> {
    const ref = doc(
      this.firestore,
      `companies/${companyId}/employees/${empNo}/insurancePremiums/${applicableMonth}`
    );
    const snapshot = await getDoc(ref);
    return snapshot.exists() ? (snapshot.data() as InsurancePremiumRecord) : null;
  }

  async getInsurancePremiumRecords(
    companyId: string,
    empNo: string
  ): Promise<InsurancePremiumRecord[]> {
    const ref = collection(this.firestore, `companies/${companyId}/employees/${empNo}/insurancePremiums`);
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(doc => doc.data() as InsurancePremiumRecord);
  }

  async getInsurancePremiumRecord(
    companyId: string,
    empNo: string,
    applicableMonth: string
  ): Promise<InsurancePremiumRecord | null> {
    const docRef = doc(
      this.firestore,
      `companies/${companyId}/employees/${empNo}/insurancePremiums`,
      applicableMonth
    );
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as InsurancePremiumRecord) : null;
  }

  async saveDependents(companyId: string, empNo: string, dependents: Dependent[]): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const depCol = collection(empRef, 'dependents');
  
    const batch = dependents.map(dep => {
      const id = `${dep.name}_${dep.birthday}`;
  
      const birthdayDate = dep.birthday
        ? (dep.birthday instanceof Date ? dep.birthday : new Date(dep.birthday))
        : null;
  
      const ref = doc(depCol, id);
      return setDoc(ref, {
        ...cleanData({
          ...dep,
          birthday: birthdayDate ? Timestamp.fromDate(birthdayDate) : null
        }),
        createdAt: Timestamp.now()
      }, { merge: true });
    });
  
    await Promise.all(batch);
  }  

  async saveBonusRecords(companyId: string, empNo: string, bonusDetails: any[]): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const bonusCol = collection(empRef, 'bonusRecords');
  
    const batch = bonusDetails.map(bonus => {
      const ref = doc(bonusCol, bonus.applicableMonth);
      return setDoc(ref, {
        ...cleanData(bonus),
        createdAt: Timestamp.now()
      }, { merge: true });
    });
  
    await Promise.all(batch);
  }

  async getLatestInsurancePremium(companyId: string, empNo: string): Promise<InsurancePremiumRecord | null> {
    const ref = collection(this.firestore, `companies/${companyId}/employees/${empNo}/insurancePremiums`);
    const q = query(ref, orderBy('applicableMonth', 'desc'), limit(1));
    const snap = await getDocs(q);
    return snap.empty ? null : (snap.docs[0].data() as InsurancePremiumRecord);
  }

  async saveBonusPremium(
    companyId: string,
    empNo: string,
    bonusId: string,
    record: BonusPremiumRecord
  ): Promise<void> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}/bonusPremiums/${bonusId}`);
    await setDoc(ref, cleanData(record), { merge: true });
  }
  
  async getBonusPremiumRecords(companyId: string, empNo: string): Promise<BonusPremiumRecord[]> {
    const col = collection(this.firestore, `companies/${companyId}/employees/${empNo}/bonusPremiums`);
    const snap = await getDocs(col);
    return snap.docs.map(doc => {
      const data = doc.data() as Omit<BonusPremiumRecord, 'bonusId'>;
      return { bonusId: doc.id, ...data };
    });
  }  

  async saveInsurancePremiumIfValid(
    companyId: string,
    empNo: string,
    applicableMonth: string,
    method: 'qualification' | 'fixed' | 'revised' | 'bonus',
    data: InsurancePremiumSnapshot,
    operatorUid: string
  ): Promise<void> {
    const docRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}/insurancePremiums/${applicableMonth}`);
    const snapshot = await getDoc(docRef);
    const existing = snapshot.exists() ? (snapshot.data() as EmployeeInsurancePremiums) : undefined;
  
    if (existing?.[method] && existing.metadata?.deleted !== true) {
      throw new Error(`既に「${method}」として保険料が保存済です。再計算するには削除が必要です。`);
    }
  
    const updateData: Partial<EmployeeInsurancePremiums> = {
      [method]: data,
      metadata: {
        updatedAt: Timestamp.now(),
        updatedBy: operatorUid,
        deleted: false
      }
    };
  
    await setDoc(docRef, updateData, { merge: true });
  }

  async deleteInsurancePremiumRecord(
    companyId: string,
    empNo: string,
    applicableMonth: string,
    method: 'qualification' | 'fixed' | 'revised' | 'bonus',
    operatorUid: string
  ): Promise<void> {
    const docRef = doc(
      this.firestore,
      `companies/${companyId}/employees/${empNo}/insurancePremiums/${applicableMonth}`
    );
  
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) throw new Error('保険料記録が存在しません');
  
    const existing = snapshot.data() as EmployeeInsurancePremiums;
  
    if (!existing[method]) {
      throw new Error(`削除対象の保険料（${method}）が存在しません`);
    }
  
    const updateData: Partial<EmployeeInsurancePremiums> = {
      [method]: null,
      metadata: {
        ...existing.metadata,
        updatedAt: Timestamp.now(),
        updatedBy: operatorUid,
        deleted: true,
        deletedAt: Timestamp.now(),
        deletedBy: operatorUid
      }
    };
  
    await setDoc(docRef, updateData, { merge: true });

    const logRef = collection(
      this.firestore,
      `companies/${companyId}/employees/${empNo}/insurancePremiumLogs`
    );
  
    await addDoc(logRef, {
      month: applicableMonth,
      method,
      deletedAt: Timestamp.now(),
      operator: operatorUid,
      previousData: existing[method] ?? null
    });
  }

  async saveSubmissionRecord(
    companyId: string,
    empNo: string,
    month: string,
    type: SubmissionType,
    createdBy: string,
    data: any
  ): Promise<void> {
    const id = `${month}_${type}`;
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}/submissions/${id}`);
    await setDoc(ref, {
      type,
      empNo,
      companyId,
      applicableMonth: month,
      createdAt: Timestamp.now(),
      createdBy,
      data
    });
  }

  async getSubmissionRecords(companyId: string, empNo: string): Promise<SubmissionRecord[]> {
    const col = collection(this.firestore, `companies/${companyId}/employees/${empNo}/submissions`);
    const snap = await getDocs(col);
    return snap.docs.map(doc => doc.data() as SubmissionRecord);
  }

  async saveActualPremiumRecord(
    companyId: string,
    empNo: string,
    month: string,
    method: ActualPremiumMethod,
    snapshot: InsurancePremiumSnapshot,
    operatorUid: string,
    submissionId?: string
  ): Promise<void> {
    const docRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}/actualPremiums/${month}`);
    const existingSnap = await getDoc(docRef);
  
    if (existingSnap.exists() && method !== 'revised') {
      console.warn('⚠ actualPremiums はすでに存在しています。上書きは行いません。');
      return;
    }
  
    const actualRecord: ActualPremiumRecord = {
      method,
      applicableMonth: month,
      sourceSubmissionId: submissionId ?? '',
      decidedAt: Timestamp.now(),
      decidedBy: operatorUid,
  
      calculatedAt: snapshot.calculatedAt,
      empNo,
      companyId,
      standardMonthlyAmount: snapshot.standardMonthlyAmount,
  
      healthGrade: snapshot.healthGrade,
      pensionGrade: snapshot.pensionGrade,
      careGrade: snapshot.careGrade,
  
      health: toActualEntry(snapshot.health),
      pension: toActualEntry(snapshot.pension),
      care: snapshot.care ? toActualEntry(snapshot.care) : null,
  
      standardMonthlyAmountBreakdown: snapshot.standardMonthlyAmountBreakdown,
    };
  
    await setDoc(docRef, actualRecord, { merge: false });
    console.log(`✅ actualPremiums 保存完了: ${docRef.path}（method: ${method}）`);
  }  

  async saveActualPremium(
    companyId: string,
    empNo: string,
    month: string,
    record: ActualPremiumRecord
  ): Promise<void> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}/actualPremiums/${month}`);
    await setDoc(ref, record);
  }

  async getActualPremiumRecords(
    companyId: string,
    empNo: string
  ): Promise<ActualPremiumRecord[]> {
    const colRef = collection(this.firestore, `companies/${companyId}/employees/${empNo}/actualPremiums`);
    const snap = await getDocs(colRef);
    return snap.docs.map(doc => doc.data() as ActualPremiumRecord);
  }
  
  async getLatestIncomeRecordsMap(companyId: string): Promise<Record<string, any>> {
    const basePath = `companies/${companyId}/employees`;
    const snap = await getDocs(collectionGroup(this.firestore, 'incomeRecords'));
  
    const latestMap: Record<string, any> = {};
    for (const docSnap of snap.docs) {
      const empId = docSnap.ref.parent.parent?.id;
      const data = docSnap.data();
      if (!empId || !data?.['applicableMonth']) continue;
  
      if (!latestMap[empId] || latestMap[empId].applicableMonth < data['applicableMonth']) {
        latestMap[empId] = data;
      }
    }
    return latestMap;
  }

  async getLatestInsurancePremiumsMap(companyId: string): Promise<Record<string, InsurancePremiumRecord | undefined>> {
    const employees = await this.getEmployeesForCompany(companyId).toPromise();
    const result: Record<string, InsurancePremiumRecord | undefined> = {};
  
    await Promise.all(
      (employees ?? []).map(async emp => {
        const latest = await this.getLatestInsurancePremium(companyId, emp.empNo);
        result[emp.empNo] = latest ?? undefined;
      })
    );
  
    return result;
  }
  
  
  async batchSaveEmployees(companyId: string, employees: Employee[]): Promise<void> {
    const basePath = `companies/${companyId}/employees`;
    await Promise.all(
      employees.map(emp => {
        const ref = doc(this.firestore, basePath, emp.empNo);
        return setDoc(ref, cleanData({ ...emp, isDeleted: false }), { merge: true });
      })
    );
  }

  async deleteDependent(companyId: string, empNo: string, depId: string): Promise<void> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}/dependents/${depId}`);
    await deleteDoc(ref);
  }

  async fetchThreeMonthsIncomeRecords(
    companyId: string,
    empNo: string,
    targetMonth: string
  ): Promise<IncomeRecord[]> {
    const basePath = `companies/${companyId}/employees/${empNo}/incomeRecords`;
    const baseDate = new Date(`${targetMonth}-01`);

    const months = [
      format(baseDate, 'yyyy-MM'),
      format(subMonths(baseDate, 1), 'yyyy-MM'),
      format(subMonths(baseDate, 2), 'yyyy-MM')
    ];

    const results: IncomeRecord[] = [];

    for (const month of months) {
      const ref = doc(this.firestore, basePath, month);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        results.push(snap.data() as IncomeRecord);
      }
    }

    return results;
  }

  async getLatestActualPremiumRecord(
    companyId: string,
    empNo: string
  ): Promise<ActualPremiumRecord | null> {
    const colRef = collection(this.firestore, `companies/${companyId}/employees/${empNo}/actualPremiums`);
    const q = query(colRef, orderBy('applicableMonth', 'desc'), limit(1));
    const snap = await getDocs(q);
  
    return snap.empty ? null : (snap.docs[0].data() as ActualPremiumRecord);
  }
  
  async createCompanyWithHr(uid: string, lastName: string, firstName: string): Promise<string> {
    const companyId = uuidv4();
    const employeeId = uuidv4();
  
    await setDoc(doc(this.firestore, `companies/${companyId}`), {
      name: '（新規企業）',
      createdAt: Timestamp.now(),
      isDeleted: false,
      voluntaryHealthApplicable: false,
      voluntaryPensionApplicable: false,
      standardWeeklyHours: 40,
      totalEmployeeCount: 0
    });
  
    await setDoc(doc(this.firestore, `users/${uid}/userCompanies/${companyId}`), {
      employeeId,
      role: 'hr',
      status: 'active'
    });
  
    await setDoc(doc(this.firestore, `companies/${companyId}/employees/${employeeId}`), {
      empNo: employeeId,
      lastName,
      firstName,
      dept: '人事',
      joinDate: new Date().toISOString().slice(0, 10),
      role: 'hr',
      firebaseUid: uid,
      createdByUid: uid,
      isDeleted: false
    });
  
    return companyId;
  }

  async saveUser(uid: string, userData: any): Promise<void> {
    const ref = doc(this.firestore, `users/${uid}`);
    return setDoc(ref, userData);
  }
  
  async saveUserCompany(uid: string, companyId: string, data: { companyId: string; role: 'hr' | 'employee' }) {
    const ref = doc(this.firestore, `users/${uid}/userCompanies/${companyId}`);
    await setDoc(ref, {
      companyId: data.companyId,
      role: data.role,
      createdAt: new Date().toISOString()
    });
  }
  

  async addUserCompanyLink(params: {
    uid: string;
    companyId: string;
    role: 'hr' | 'employee';
  }): Promise<void> {
    const { uid, companyId, role } = params;
    const ref = doc(this.firestore, `users/${uid}/userCompanies/${companyId}`);
    await setDoc(ref, {
      companyId,
      role,
    });
  }

  async migrateEmployeeData(companyId: string, oldEmpNo: string, newEmpNo: string): Promise<void> {
    // income records
    const incomeRecords = await this.getIncomeRecords(companyId, oldEmpNo);
    for (const record of incomeRecords) {
      await this.saveIncomeRecord(companyId, newEmpNo, record.applicableMonth, record);
    }
  
    // bonus records
    const bonusRecords = await this.getBonusRecords(companyId, oldEmpNo);
    for (const record of bonusRecords) {
      await this.saveBonusRecord(companyId, newEmpNo, record.applicableMonth, record);
    }
  
    // dependents
    const dependents = await this.getDependents(companyId, oldEmpNo);
    await this.saveDependents(companyId, newEmpNo, dependents);
  
    // bonus premiums
    const premiums = await this.getBonusPremiumRecords(companyId, oldEmpNo);
    for (const p of premiums) {
      await this.saveBonusPremium(companyId, newEmpNo, p.bonusId, { ...p, empNo: newEmpNo });
    }
  
    // insurance premiums
    const insurancePremiums = await this.getInsurancePremiumRecords(companyId, oldEmpNo);
    for (const i of insurancePremiums) {
      await this.saveInsurancePremium(companyId, newEmpNo, i.applicableMonth, { ...i, empNo: newEmpNo });
    }
  }  
}

function toActualEntry(source: PremiumDetail): ActualPremiumEntry {
  return {
    grade: source.grade,
    total: source.premiumTotal,
    employee: source.premiumEmployee,
    company: source.premiumCompany
  };
}
