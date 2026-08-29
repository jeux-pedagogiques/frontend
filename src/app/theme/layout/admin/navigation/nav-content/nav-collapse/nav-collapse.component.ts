// angular import
import { Component, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// project import
import { NavigationItem } from '../../navigation';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavItemComponent } from '../nav-item/nav-item.component';

@Component({
  selector: 'app-nav-collapse',
  host: { role: 'presentation' },
  imports: [SharedModule, NavItemComponent, RouterModule, CommonModule],
  templateUrl: './nav-collapse.component.html',
  styleUrls: ['./nav-collapse.component.scss']
})
export class NavCollapseComponent {
  // public props
  item = input.required<NavigationItem>();

  // public method
  navCollapse(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const currentTarget = e.currentTarget as HTMLElement;
    const parent = currentTarget.closest('li.pcoded-hasmenu') as HTMLElement;
    if (!parent) return;

    const isTriggered = parent.classList.contains('pcoded-trigger');
    const sections = document.querySelectorAll('.pcoded-hasmenu');
    sections.forEach((sec) => {
      if (sec !== parent) {
        sec.classList.remove('pcoded-trigger');
      }
    });

    if (isTriggered) {
      parent.classList.remove('pcoded-trigger');
    } else {
      parent.classList.add('pcoded-trigger');
    }
  }
}
