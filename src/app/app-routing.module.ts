// Angular Import
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

// project import
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { authGuard } from './theme/shared/guard/auth.guard';

const routes: Routes = [
  {
    path: 'play/:gameType/:token',
    loadComponent: () => import('./demo/pages/play/play.component').then((c) => c.PlayComponent)
  },
  {
    path: '',
    component: GuestComponent,
    children: [
      {
        path: '',
        redirectTo: '/login',
        pathMatch: 'full'
      },
      {
        path: 'register',
        loadComponent: () => import('./demo/pages/authentication/sign-up/sign-up.component').then((c) => c.SignUpComponent)
      },
      {
        path: 'login',
        loadComponent: () => import('./demo/pages/authentication/sign-in/sign-in.component').then((c) => c.SignInComponent)
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./demo/pages/authentication/forgot-password/forgot-password.component').then((c) => c.ForgotPasswordComponent)
      }
    ]
  },
  {
    path: '',
    component: AdminComponent,
    children: [
      {
        path: 'analytics',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/dashboard/dash-analytics.component').then((c) => c.DashAnalyticsComponent)
      },
      {
        path: 'component',
        canActivate: [authGuard],
        loadChildren: () => import('./demo/ui-element/ui-basic.module').then((m) => m.UiBasicModule)
      },
      {
        path: 'chart',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/chart-maps/core-apex.component').then((c) => c.CoreApexComponent)
      },
      {
        path: 'forms',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/forms/form-elements/form-elements.component').then((c) => c.FormElementsComponent)
      },
      {
        path: 'tables',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/tables/tbl-bootstrap/tbl-bootstrap.component').then((c) => c.TblBootstrapComponent)
      },
      {
        path: 'sample-page',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/other/sample-page/sample-page.component').then((c) => c.SamplePageComponent)
      },
      {
        path: 'profile',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/profile/profile.component').then((c) => c.ProfileComponent)
      },
      {
        path: 'import-module',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/import-module/import-module.component').then((c) => c.ImportModuleComponent)
      },
      {
        path: 'live-session',
        loadComponent: () => import('./demo/pages/live-session/live-session.component').then((c) => c.LiveSessionComponent)
      },
      {
        path: 'escape-room',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/escape-room/escape-room.component').then((c) => c.EscapeRoomComponent)
      },
      {
        path: 'prof-dashboard',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/prof-dashboard/prof-dashboard.component').then((c) => c.ProfDashboardComponent)
      },
      {
        path: 'pitching-challenge',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/pitching-challenge/pitching-challenge.component').then((c) => c.PitchingChallengeComponent)
      },
      {
        path: 'flashcards',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/flashcards/flashcards.component').then((c) => c.FlashcardsComponent)
      },
      {
        path: 'library',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/library/library.component').then((c) => c.LibraryComponent)
      },
      {
        path: 'cas-etude',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/cas-etude/cas-etude.component').then((c) => c.CasEtudeComponent)
      },
      {
        path: 'mindmap',
        canActivate: [authGuard],
        loadComponent: () => import('./demo/pages/mindmap/mindmap.component').then((c) => c.MindMapComponent)
      },
      {
        path: 'debat-structure',
        loadComponent: () => import('./demo/pages/debat-structure/debat-structure.component').then((c) => c.DebatStructureComponent)
      },
      {
        path: 'negociation',
        loadComponent: () => import('./demo/pages/negociation/negociation.component').then((c) => c.NegociationComponent)
      },
      {
        path: 'atelier-feedback',
        loadComponent: () => import('./demo/pages/atelier-feedback/atelier-feedback.component').then((c) => c.AtelierFeedbackComponent)
      }
    ]
  }

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
