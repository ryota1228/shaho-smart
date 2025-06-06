import { Injectable } from '@angular/core';
import {Firestore, collection, collectionData, doc, setDoc, addDoc, getDocs, CollectionReference, DocumentReference, query, where, updateDoc, deleteDoc, Query, DocumentData, getDoc, Timestamp, orderBy, limit, collectionGroup} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { Company, NewCompany } from '../models/company.model';
import { Employee } from '../models/employee.model';
import { Dependent } from '../models/dependent.model';
import { EmployeeInsurancePremiums, InsurancePremiumRecord, InsurancePremiumSnapshot, PremiumDetail } from '../models/insurance-premium.model';
import { BonusPremiumRecord } from '../models/bonus-premium.model';
import { SubmissionRecord, SubmissionType } from '../models/submission-record.model';
import { ActualPremiumRecord, ActualPremiumMethod, ActualPremiumEntry } from '../models/actual-premium.model';

export function cleanData(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  );
}

@Injectable({ providedIn: 'root' })
export class FirestoreService {
  constructor(private firestore: Firestore) {}

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
      authorizedUsers: [currentUid],
      isDeleted: false
    };
  
    return addDoc(companiesRef, newCompany).then(docRef => docRef.id);
  }

  getCompanyListByUser(uid: string): Observable<Company[]> {
    const companiesRef = collection(this.firestore, 'companies');
    const q = query(
      companiesRef,
      where('authorizedUsers', 'array-contains', uid),
      where('isDeleted', '==', false)
    );
  
    return new Observable<Company[]>(observer => {
      getDocs(q).then(snapshot => {
        const companies: Company[] = snapshot.docs.map(doc => ({
          companyId: doc.id,
          ...doc.data()
        } as Company));
        observer.next(companies);
        observer.complete();
      }).catch(error => observer.error(error));
    });
  }

  softDeleteCompany(companyId: string): Promise<void> {
    const ref = doc(this.firestore, 'companies', companyId);
    return updateDoc(ref, { isDeleted: true });
  }

  getEmployeesForCompany(companyId: string): Observable<Employee[]> {
    const col = collection(this.firestore, `companies/${companyId}/employees`);
    const q = query(col, where('isDeleted', '==', false));
  
    return from(getDocs(q)).pipe(
      map(snapshot =>
        snapshot.docs.map(doc => {
          const data = doc.data();
          return {
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
          } as Employee;
        })
      )
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

  saveEmployee(companyId: string, employee: Employee): Promise<void> {
    const empId = (employee.empNo || '').trim();
  
    if (!empId) {
      return Promise.reject(new Error('empNo が未入力のため、従業員情報を保存できません'));
    }
  
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empId}`);
  
    return setDoc(ref, cleanData({
      ...employee,
      isDeleted: false
    }), { merge: true });
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
  
      return setDoc(companyDocRef, cleanData(company)).then(() => companyDocRef.id);
  }

  async saveDependent(companyId: string, empNo: string, dependent: any): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const depId = `${dependent.name}_${dependent.birthday}`;
    const ref = doc(collection(empRef, 'dependents'), depId);
    
    return setDoc(ref, {
      ...cleanData({
        ...dependent,
        birthday: dependent.birthday ? Timestamp.fromDate(dependent.birthday) : null
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
  
  async deleteBonusRecord(companyId: string, empNo: string, applicableMonth: string): Promise<void> {
    const ref = doc(this.firestore, `companies/${companyId}/employees/${empNo}/bonusRecords/${applicableMonth}`);
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
  
    return snap.docs.map(doc => doc.data() as Dependent);
  }

  async getCompany(companyId: string): Promise<Company | null> {
    const ref = doc(this.firestore, 'companies', companyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { companyId: snap.id, ...snap.data() } as Company;
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
      const ref = doc(depCol, id);
      return setDoc(ref, {
        ...cleanData({
          ...dep,
          birthday: dep.birthday ? Timestamp.fromDate(dep.birthday) : null
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
    return snap.docs.map(doc => doc.data() as BonusPremiumRecord);
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
  
    // （任意）削除ログの保存
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
    month: string, // '2025-07'
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
  
    if (existingSnap.exists()) {
      console.warn('⚠ actualPremiums はすでに存在しています。上書きは行いません。');
      return;
    }
  
    const actualRecord: ActualPremiumRecord = {
      method,
      applicableMonth: month,
      sourceSubmissionId: submissionId ?? '',
      decidedAt: Timestamp.now(),
      decidedBy: operatorUid,
      health: toActualEntry(snapshot.health),
      pension: toActualEntry(snapshot.pension),
      care: snapshot.care ? toActualEntry(snapshot.care) : null
    };
  
    await setDoc(docRef, actualRecord);
    console.log('✅ actualPremiums 保存完了:', docRef.path);
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
        
}

function toActualEntry(source: PremiumDetail): ActualPremiumEntry {
  return {
    grade: source.grade,
    total: source.premiumTotal,
    employee: source.premiumEmployee,
    company: source.premiumCompany
  };
}
