import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';


// Project Import
import { NavRightComponent } from './nav-bar/nav-right/nav-right.component';
import { NavigationComponent } from './navigation/navigation.component';
import { LayoutStateService } from '../../shared/service/layout-state.service';
import { AuthService } from '../../shared/service/auth.service';
import { FontSizeService } from '../../shared/service/font-size.service';

import { AudioAlertService } from '../../shared/service/audio-alert.service';

@Component({
  selector: 'app-admin',
  imports: [RouterModule, NavRightComponent, NavigationComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private layoutState = inject(LayoutStateService);
  private authService = inject(AuthService);
  private router = inject(Router);
  readonly fontSizeService = inject(FontSizeService);
  public audioAlertService = inject(AudioAlertService);

  isSidebarDarkMode = signal<boolean>(localStorage.getItem('sidebar_theme') !== 'light');

  toggleSidebarTheme(): void {
    const nextVal = !this.isSidebarDarkMode();
    this.isSidebarDarkMode.set(nextVal);
    localStorage.setItem('sidebar_theme', nextVal ? 'dark' : 'light');
    if (nextVal) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // public props
  navCollapsed!: boolean;
  get navCollapsedMob(): boolean {
    return this.layoutState.navCollapsedMob();
  }
  windowWidth: number;

  // constructor
  constructor() {
    this.windowWidth = window.innerWidth;

    // Apply initial body theme class based on saved setting
    if (this.isSidebarDarkMode()) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }

    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.layoutState.closeNavCollapsedMob();
      });
  }

  @HostListener('window:resize', ['$event'])
  // eslint-disable-next-line
  onResize(event: any): void {
    this.windowWidth = event.target.innerWidth;
    if (this.windowWidth < 992) {
      document.querySelector('.pcoded-navbar')?.classList.add('menupos-static');
      if (document.querySelector('app-navigation.pcoded-navbar')?.classList.contains('navbar-collapsed')) {
        document.querySelector('app-navigation.pcoded-navbar')?.classList.remove('navbar-collapsed');
      }
    }
  }

  // public method
  navMobClick() {
    if (window.innerWidth < 992) {
      this.layoutState.toggleNavCollapsedMob();
    } else {
      this.navCollapsed = !this.navCollapsed;
    }
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.closeMenu();
    }
  }

  closeMenu() {
    this.layoutState.closeNavCollapsedMob();
  }
}
