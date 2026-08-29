// angular import
import { Component, OnInit, inject, output } from '@angular/core';
import { Location, LocationStrategy } from '@angular/common';

// project import
import { environment } from 'src/environments/environment';
import { NavigationItem, NavigationItems } from '../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavGroupComponent } from './nav-group/nav-group.component';

@Component({
  selector: 'app-nav-content',
  imports: [SharedModule, NavGroupComponent],
  templateUrl: './nav-content.component.html',
  styleUrls: ['./nav-content.component.scss']
})
export class NavContentComponent implements OnInit {
  private location = inject(Location);
  private locationStrategy = inject(LocationStrategy);

  // version
  title = 'Demo application for version numbering';
  currentApplicationVersion = environment.appVersion;

  // public pops
  navigation: NavigationItem[];
  contentWidth: number;
  wrapperWidth!: number;
  scrollWidth: number;
  windowWidth: number;

  NavMobCollapse = output();

  // constructor
  constructor() {
    this.navigation = NavigationItems;
    this.windowWidth = window.innerWidth;
    this.scrollWidth = 0;
    this.contentWidth = 0;
  }

  // life cycle event
  ngOnInit() {
    if (this.windowWidth < 992) {
      setTimeout(() => {
        document.querySelector('.pcoded-navbar')?.classList.add('menupos-static');
        const navPs = document.querySelector('#nav-ps-gradient-able') as HTMLElement;
        if (navPs) {
          navPs.style.height = '100%';
        }
      }, 500);
    }
  }

  fireLeave() {
    const sections = document.querySelectorAll('.pcoded-hasmenu');
    sections.forEach((s) => {
      s.classList.remove('active');
      s.classList.remove('pcoded-trigger');
    });

    let current_url = this.location.path();
    const baseHref = this.locationStrategy.getBaseHref();
    if (baseHref) {
      current_url = baseHref + this.location.path();
    }
    const link = "a.nav-link[href='" + current_url + "'], a.nav-link[ng-reflect-router-link='" + current_url + "']";
    const ele = document.querySelector(link);
    if (ele) {
      const parent = ele.closest('li.pcoded-hasmenu');
      if (parent) {
        parent.classList.add('active');
        parent.classList.add('pcoded-trigger');
      }
    }
  }

  navMob() {
    if (this.windowWidth < 992 && document.querySelector('app-navigation.pcoded-navbar')?.classList.contains('mob-open')) {
      this.NavMobCollapse.emit();
    }
  }

  fireOutClick() {
    let current_url = this.location.path();
    const baseHref = this.locationStrategy.getBaseHref();
    if (baseHref) {
      current_url = baseHref + this.location.path();
    }
    const link = "a.nav-link[href='" + current_url + "'], a.nav-link[ng-reflect-router-link='" + current_url + "']";
    const ele = document.querySelector(link);
    if (ele) {
      const parent = ele.closest('li.pcoded-hasmenu');
      if (parent) {
        parent.classList.add('pcoded-trigger');
        parent.classList.add('active');
      }
    }
  }
}
