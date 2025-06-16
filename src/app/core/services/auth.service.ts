import { Injectable } from '@angular/core';
import { Auth, onAuthStateChanged, User } from '@angular/fire/auth';
import {
  Firestore,
  collection,
  doc,
  getDocs,
  getDoc,
  DocumentData,
  DocumentReference
} from '@angular/fire/firestore';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser: User | null = null;
  private authReadySubject = new BehaviorSubject<boolean>(false);
  public authReady$: Observable<boolean> = this.authReadySubject.asObservable();

  private activeCompanyId: string | null = null;
  private employeeId: string | null = null;
  private userRole: 'employee' | 'hr' | null = null;

  private employeeFirstName: string | null = null;
  private employeeLastName: string | null = null;

  constructor(private auth: Auth, private firestore: Firestore) {
    onAuthStateChanged(this.auth, async (user) => {
      this.currentUser = user;

      if (user) {
        const uid = user.uid;

        await this.loadUserData(uid);

        try {
          const ucSnap = await getDocs(collection(this.firestore, `users/${uid}/userCompanies`));

          if (!ucSnap.empty) {
            const firstCompany = ucSnap.docs[0];
            const companyId = firstCompany.id;
            const ucData = firstCompany.data() as { employeeId: string; role: 'employee' | 'hr' };

            this.activeCompanyId = companyId;
            this.employeeId = ucData.employeeId;
            this.userRole = ucData.role;
          } else {
            console.warn('所属企業が存在しません');
          }
        } catch (err) {
          console.error('userCompaniesの取得に失敗しました:', err);
        }
      } else {
        this.activeCompanyId = null;
        this.employeeId = null;
        this.userRole = null;
      }

      this.authReadySubject.next(true);
    });
  }

  getUid(): string | null {
    return this.currentUser?.uid ?? null;
  }

  getUser(): User | null {
    return this.currentUser;
  }

  getCompanyId(): string | null {
    return this.activeCompanyId;
  }

  getEmployeeId(): string | null {
    return this.employeeId;
  }

  getUserRole(): 'employee' | 'hr' | null {
    return this.userRole;
  }

  isHr(): boolean {
    return this.userRole === 'hr';
  }

  isEmployee(): boolean {
    return this.userRole === 'employee';
  }

  setActiveCompanyId(companyId: string) {
    this.activeCompanyId = companyId;
  }

  setEmployeeName(first: string, last: string): void {
    this.employeeFirstName = first;
    this.employeeLastName = last;
  }
  
  getEmployeeName(): { firstName: string | null; lastName: string | null } {
    return {
      firstName: this.employeeFirstName,
      lastName: this.employeeLastName,
    };
  }

  private firestoreUserData: any = {};

  async loadUserData(uid: string): Promise<void> {
    const snap = await getDoc(doc(this.firestore, `users/${uid}`));
    if (snap.exists()) {
      const data = snap.data();
      this.setEmployeeName(data['firstName'] ?? '', data['lastName'] ?? '');
      console.log('✅ Firestore user loaded:', data);
    } else {
      console.warn('⚠ Firestore user not found for uid:', uid);
    }
  }
  

  getCurrentUserFullName(): string {
    const last = this.employeeLastName ?? '';
    const first = this.employeeFirstName ?? '';
    return `${last} ${first}`.trim() || '';
  }   
}