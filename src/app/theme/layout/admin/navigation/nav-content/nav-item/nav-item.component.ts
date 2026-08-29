// angular import
import { Component, inject, input } from '@angular/core';
import { RouterModule } from '@angular/router';

// project import
import { NavigationItem } from '../../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { LayoutStateService } from 'src/app/theme/shared/service/layout-state.service';

@Component({
  selector: 'app-nav-item',
  host: { role: 'presentation' },
  imports: [SharedModule, RouterModule],
  templateUrl: './nav-item.component.html',
  styleUrls: ['./nav-item.component.scss']
})
export class NavItemComponent {
  // public props
  item = input<NavigationItem>();
  private layoutState = inject(LayoutStateService);

  // public method
  closeOtherMenu(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const parentMenu = target.closest('li.pcoded-hasmenu');

    const sections = document.querySelectorAll('.pcoded-hasmenu');
    sections.forEach((sec) => {
      if (sec !== parentMenu) {
        sec.classList.remove('active');
        sec.classList.remove('pcoded-trigger');
      }
    });

    if (parentMenu) {
      parentMenu.classList.add('pcoded-trigger');
      parentMenu.classList.add('active');
    }
    this.layoutState.closeNavCollapsedMob();
    if (document.querySelector('app-navigation.pcoded-navbar')?.classList.contains('mob-open')) {
      document.querySelector('app-navigation.pcoded-navbar')?.classList.remove('mob-open');
    }
  }
}
