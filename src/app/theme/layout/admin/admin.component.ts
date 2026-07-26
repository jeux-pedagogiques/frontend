// Angular Import
import { Component, HostListener, inject } from '@angular/core';
import { RouterModule } from '@angular/router';


// Project Import
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { NavRightComponent } from './nav-bar/nav-right/nav-right.component';
import { NavigationComponent } from './navigation/navigation.component';
import { BreadcrumbComponent } from '../../shared/components/breadcrumb/breadcrumb.component';
import { LayoutStateService } from '../../shared/service/layout-state.service';
import { AuthService } from '../../shared/service/auth.service';

@Component({
  selector: 'app-admin',
  imports: [RouterModule, NavBarComponent, NavRightComponent, NavigationComponent, BreadcrumbComponent],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private layoutState = inject(LayoutStateService);
  private authService = inject(AuthService);

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
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
