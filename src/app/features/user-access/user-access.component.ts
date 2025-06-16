import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material.module';
import {
  Firestore,
  collection,
  getDocs,
  doc,
  getDoc,
  updateDoc
} from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';

@Component({
  selector: 'app-user-access',
  standalone: true,
  imports: [CommonModule, MaterialModule],
  templateUrl: './user-access.component.html',
  styleUrls: ['./user-access.component.scss']
})
export class UserAccessComponent implements OnInit {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  displayedColumns: string[] = ['email', 'role', 'status', 'actions'];
  dataSource: any[] = [];

  companyOptions: { companyId: string; label: string }[] = [];
  selectedCompanyId: string | null = null;

  async ngOnInit() {
    const uid = this.authService.getUid();
    if (!uid) return;

    // 所属企業一覧を取得
    const ucSnap = await getDocs(collection(this.firestore, `users/${uid}/userCompanies`));
    this.companyOptions = ucSnap.docs.map((doc) => ({
      companyId: doc.id,
      label: doc.id // ※必要に応じて企業名取得に差し替え可能
    }));

    // 初期選択企業を設定
    this.selectedCompanyId = this.authService.getCompanyId();
    if (this.selectedCompanyId) {
      await this.loadUserList(this.selectedCompanyId);
    }
  }

  async onCompanyChange(newCompanyId: string) {
    this.selectedCompanyId = newCompanyId;
    this.authService.setActiveCompanyId(newCompanyId);
    await this.loadUserList(newCompanyId);
  }

  async loadUserList(companyId: string) {
    const usersSnap = await getDocs(collection(this.firestore, 'users'));
    const results: any[] = [];

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();
      const userCompanyRef = doc(this.firestore, `users/${uid}/userCompanies/${companyId}`);
      const userCompanySnap = await getDoc(userCompanyRef);

      if (userCompanySnap.exists()) {
        const ucData = userCompanySnap.data();
        results.push({
          uid,
          email: userData['email'],
          role: ucData['role'],
          employeeId: ucData['employeeId'],
          status: ucData['status'] ?? 'active'
        });
      }
    }

    this.dataSource = results;
  }

  async sendReset(email: string) {
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, email);
      alert('リセットメールを送信しました');
    } catch (err) {
      console.error(err);
      alert('リセットに失敗しました');
    }
  }

  async deactivateUser(row: any) {
    if (!this.selectedCompanyId) return;

    const ref = doc(this.firestore, `users/${row.uid}/userCompanies/${this.selectedCompanyId}`);
    await updateDoc(ref, { role: 'disabled', status: 'inactive' });
    alert(`${row.email} を無効化しました`);
    await this.loadUserList(this.selectedCompanyId);
  }
}
