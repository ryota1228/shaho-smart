import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Auth, signInWithEmailAndPassword } from '@angular/fire/auth';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../shared/material/material.module';
import { Router } from '@angular/router';


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

  constructor(private auth: Auth, private router: Router) {}

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
}