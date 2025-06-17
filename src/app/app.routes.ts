import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { LoginComponent } from './auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';
import { loginRedirectGuard } from './core/guards/loginRedirectGuard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'insurance-premium', pathMatch: 'full' },
      { path: 'master-management', loadComponent: () => import('./features/master-management/master-management.component').then(m => m.MasterManagementComponent) },
      { path: 'user-access', loadComponent: () => import('./features/user-access/user-access.component').then(m => m.UserAccessComponent) },
      { path: 'office-management', loadComponent: () => import('./features/office-management/office-management.component').then(m => m.OfficeManagementComponent) },
      { path: 'insurance-premium', loadComponent: () => import('./features/insurance-premium/insurance-premium.component').then(m => m.InsurancePremiumComponent) },
      { path: 'insurance-card', loadComponent: () => import('./features/insurance-card/insurance-card.component').then(m => m.InsuranceCardComponent) },
      { path: 'compensation-management', loadComponent: () => import('./features/compensation-management/compensation-management.component').then(m => m.CompensationManagementComponent) },
      { path: 'declaration-management', loadComponent: () => import('./features/declaration-management/declaration-management.component').then(m => m.DeclarationManagementComponent) },
      { path: 'system-change-management', loadComponent: () => import('./features/system-change-management/system-change-management.component').then(m => m.SystemChangeManagementComponent) },
      { path: 'payroll-export', loadComponent: () => import('./features/payroll-export/payroll-export.component').then(m => m.PayrollExportComponent) },
      { path: 'qualification-management', loadComponent: () => import('./features/qualification-management/qualification-management.component').then(m => m.QualificationManagementComponent) },
      { path: 'qualification-enrollment', loadComponent: () => import('./features/qualification-enrollment/qualification-enrollment.component').then(m => m.QualificationEnrollmentComponent) },
      { path: 'insurance-submission', loadComponent: () => import('./features/insurance-submission/insurance-submission.component').then(m => m.InsuranceSubmissionComponent) },
    ]
  },
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [loginRedirectGuard]
  },
  { path: '**', redirectTo: '' }
];
