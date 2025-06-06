import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { LoginComponent } from './auth/login/login.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: 'master-management', canActivate: [authGuard], loadComponent: () => import('./features/master-management/master-management.component').then(m => m.MasterManagementComponent) },
      { path: 'user-access', canActivate: [authGuard], loadComponent: () => import('./features/user-access/user-access.component').then(m => m.UserAccessComponent) },
      { path: 'office-management', canActivate: [authGuard], loadComponent: () => import('./features/office-management/office-management.component').then(m => m.OfficeManagementComponent) },
      { path: 'insurance-premium', canActivate: [authGuard], loadComponent: () => import('./features/insurance-premium/insurance-premium.component').then(m => m.InsurancePremiumComponent) },
      { path: 'insurance-card', canActivate: [authGuard], loadComponent: () => import('./features/insurance-card/insurance-card.component').then(m => m.InsuranceCardComponent) },
      { path: 'compensation-management', canActivate: [authGuard], loadComponent: () => import('./features/compensation-management/compensation-management.component').then(m => m.CompensationManagementComponent) },
      { path: 'declaration-management', canActivate: [authGuard], loadComponent: () => import('./features/declaration-management/declaration-management.component').then(m => m.DeclarationManagementComponent) },
      { path: 'system-change-management', canActivate: [authGuard], loadComponent: () => import('./features/system-change-management/system-change-management.component').then(m => m.SystemChangeManagementComponent) },
      { path: 'payroll-export', canActivate: [authGuard], loadComponent: () => import('./features/payroll-export/payroll-export.component').then(m => m.PayrollExportComponent) },
      { path: 'qualification-management', canActivate: [authGuard], loadComponent: () => import('./features/qualification-management/qualification-management.component').then(m => m.QualificationManagementComponent) },
      { path: 'qualification-enrollment', canActivate: [authGuard], loadComponent: () => import('./features/qualification-enrollment/qualification-enrollment.component').then(m => m.QualificationEnrollmentComponent) },
      { path: 'insurance-submission', canActivate: [authGuard], loadComponent: () => import('./features/insurance-submission/insurance-submission.component').then(m => m.InsuranceSubmissionComponent) },
    ]
  },
  {
    path: 'login',
    component: LoginComponent
  },
  { path: '**', redirectTo: '' }
];
