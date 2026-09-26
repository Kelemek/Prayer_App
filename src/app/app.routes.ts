import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { siteAuthGuard } from './guards/site-auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [siteAuthGuard]
  },
  {
    path: 'info',
    loadComponent: () => import('./pages/info/info.component').then(m => m.InfoComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin.component').then(m => m.AdminComponent),
    canActivate: [siteAuthGuard, adminGuard],
  },
  {
    path: 'presentation',
    loadComponent: () => import('./pages/presentation/presentation.component').then(m => m.PresentationComponent),
    canActivate: [siteAuthGuard],
  },
  {
    path: 'privacy',
    loadComponent: () => import('./pages/privacy/privacy.component').then(m => m.PrivacyComponent)
  },
  {
    path: 'terms',
    loadComponent: () =>
      import('./pages/terms/terms.component').then((m) => m.TermsComponent),
  },
  {
    path: 'support',
    loadComponent: () => import('./pages/support/support.component').then(m => m.SupportComponent)
  },
  {
    path: 'unsubscribe',
    loadComponent: () => import('./pages/unsubscribe/unsubscribe.component').then(m => m.UnsubscribeComponent)
  },
  {
    path: 'join/:token',
    loadComponent: () => import('./pages/tenant-claim/tenant-claim.component').then(m => m.TenantClaimComponent),
  },
  {
    path: 'church-setup',
    loadComponent: () => import('./pages/church-setup/church-setup.component').then(m => m.ChurchSetupComponent),
    canActivate: [siteAuthGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
