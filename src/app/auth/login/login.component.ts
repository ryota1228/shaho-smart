import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../shared/material/material.module';
import { Router } from '@angular/router';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MaterialModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  password = '';
  errorMessage = '';

  isRegistering = false;

  employeeLastName = '';
  employeeFirstName = '';

  constructor(private auth: Auth, private firestore: Firestore, private router: Router, private authService: AuthService) {}

  login(): void {
    signInWithEmailAndPassword(this.auth, this.email, this.password)
      .then(() => {
        this.errorMessage = '';
        this.router.navigate(['/master-management']);
      })
      .catch((error) => {
        this.errorMessage = error.message;
      });
  }

  toggleRegister(): void {
    this.isRegistering = !this.isRegistering;
  }

  async register(): Promise<void> {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, this.email, this.password);
      const uid = cred.user.uid;
  
      await setDoc(doc(this.firestore, `users/${uid}`), {
        uid,
        email: this.email,
        lastName: this.employeeLastName,
        firstName: this.employeeFirstName
      });
  
      this.authService.setEmployeeName(this.employeeFirstName, this.employeeLastName);
  
      alert('登録完了しました');
      this.router.navigate(['/master-management']);
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        alert('このメールアドレスは既に登録されています。ログインしてください。');
        this.isRegistering = false;
      } else {
        console.error(error);
        this.errorMessage = error.message;
      }
    }
  }
  
}
