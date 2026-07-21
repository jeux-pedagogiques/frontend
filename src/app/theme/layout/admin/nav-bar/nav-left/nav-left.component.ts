// angular import
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { NavSearchComponent } from './nav-search/nav-search.component';
import { NavigationItems, NavigationItem } from '../../navigation/navigation';

@Component({
  selector: 'app-nav-left',
  imports: [SharedModule, RouterModule, NavSearchComponent],
  templateUrl: './nav-left.component.html',
  styleUrls: ['./nav-left.component.scss']
})
export class NavLeftComponent {
  navigationItems: NavigationItem[] = NavigationItems;
}
