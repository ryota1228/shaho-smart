import { Injectable } from '@angular/core';
import {Firestore, collection, collectionData, doc, setDoc, addDoc, getDocs, CollectionReference, DocumentReference, query, where, updateDoc, deleteDoc, Query, DocumentData, getDoc, Timestamp, orderBy, limit} from '@angular/fire/firestore';
import { Observable, from, map } from 'rxjs';
import { Company, NewCompany } from '../models/company.model';
import { Employee } from '../models/employee.model';
import { Dependent } from '../models/dependent.model';
import { InsurancePremiumRecord } from '../models/insurance-premium.model';
import { BonusPremiumRecord } from '../models/bonus-premium.model';

function cleanData(obj: Record<string, any>): Record<string, any> {
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
  
    await setDoc(companyDocRef, company);
  
    const employeeColRef = collection(this.firestore, `companies/${companyDocRef.id}/employees`);
    for (const emp of employees) {
      await addDoc(employeeColRef, emp);
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
  
    const cleaned = {
      ...employee,
      isDeleted: false
    };
  
    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key as keyof Employee] === undefined) {
        delete cleaned[key as keyof Employee];
      }
    });
  
    return setDoc(ref, cleaned, { merge: true });
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
  
    return setDoc(companyDocRef, company).then(() => companyDocRef.id);
  }

  async saveDependent(companyId: string, empNo: string, dependent: any): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const depId = `${dependent.name}_${dependent.birthday}`;
    const ref = doc(collection(empRef, 'dependents'), depId);
  
    return setDoc(ref, {
      ...dependent,
      createdAt: Timestamp.now()
    }, { merge: true });
  }  

  async saveIncomeRecord(companyId: string, empNo: string, yearMonth: string, data: any): Promise<void> {
    const empRef = doc(this.firestore, `companies/${companyId}/employees/${empNo}`);
    const ref = doc(collection(empRef, 'incomeRecords'), yearMonth);
  
    return setDoc(ref, {
      ...data,
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
      ...data,
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
  
      await setDoc(ref, premiumData);
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
        ...dep,
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
        ...bonus,
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
    await setDoc(ref, record, { merge: true });
  }
  
  async getBonusPremiumRecords(companyId: string, empNo: string): Promise<BonusPremiumRecord[]> {
    const col = collection(this.firestore, `companies/${companyId}/employees/${empNo}/bonusPremiums`);
    const snap = await getDocs(col);
    return snap.docs.map(doc => doc.data() as BonusPremiumRecord);
  }
  
}
