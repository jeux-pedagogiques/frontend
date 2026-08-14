import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService, User } from 'src/app/theme/shared/service/auth.service';
import { AudioAlertService } from 'src/app/theme/shared/service/audio-alert.service';

export type ProfileTab = 'home' | 'security' | 'preferences' | 'notifications';
export type AppTheme = 'light' | 'dark' | 'neon';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, SharedModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private cd = inject(ChangeDetectorRef);
  public audioAlertService = inject(AudioAlertService);

  user = signal<User | null>(null);
  submitted = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Active navigation tab
  activeNav = signal<ProfileTab>('home');

  // Active theme
  selectedTheme = signal<AppTheme>('light');

  // Form model fields (Home)
  username = '';
  email = '';
  first_name = '';
  last_name = '';
  phone = '';
  address = '';
  bio = '';
  role = 'System Architect';
  avatar = signal<string | null>(null);

  // Security tab fields
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  enable2FA = false;

  // Preferences tab fields
  language = 'fr';

  get soundEnabled(): boolean {
    return this.audioAlertService.soundEnabled();
  }

  set soundEnabled(val: boolean) {
    this.audioAlertService.setSoundEnabled(val);
  }

  // Notifications tab fields
  notifyEmail = true;
  notifySecurity = true;
  notifyDigest = false;

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.user.set(currentUser);
      this.loadFormData(currentUser);
    }

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('cyber_app_theme') as AppTheme;
    if (savedTheme && ['light', 'dark', 'neon'].includes(savedTheme)) {
      this.selectedTheme.set(savedTheme);
      this.applyTheme(savedTheme);
    }
  }

  loadFormData(user: User): void {
    this.username = user.username || 'Alex Chen';
    this.email = user.email || 'alex.chen@future.net';
    this.first_name = user.first_name || '';
    this.last_name = user.last_name || '';
    this.phone = user.phone || '';
    this.address = user.address || 'Neo-Tokyo, District 9';
    this.bio = user.bio || 'Exploring the digital frontier. AI Enthusiast. #FutureTech';
    this.role = (user as any).role || 'System Architect';
    this.avatar.set(user.avatar || null);
  }

  setTheme(theme: AppTheme): void {
    this.selectedTheme.set(theme);
    localStorage.setItem('cyber_app_theme', theme);
    this.applyTheme(theme);
    this.successMessage.set(`Theme switched to ${theme.toUpperCase()} mode.`);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  applyTheme(theme: AppTheme): void {
    document.documentElement.setAttribute('data-cyber-theme', theme);
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-neon');
    document.body.classList.add(`theme-${theme}`);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result as string;
        this.avatar.set(base64String);
        this.cd.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    this.successMessage.set('');
    this.errorMessage.set('');

    const profileData = {
      username: this.username,
      email: this.email,
      first_name: this.first_name || null,
      last_name: this.last_name || null,
      phone: this.phone || null,
      address: this.address || null,
      bio: this.bio || null,
      role: this.role || null,
      avatar: this.avatar()
    };

    this.authService.updateProfile(profileData).subscribe({
      next: (updatedUser) => {
        setTimeout(() => {
          this.user.set(updatedUser);
          this.successMessage.set('Profile updated successfully!');
          this.cd.detectChanges();
        });
      },
      error: (err) => {
        this.errorMessage.set(err.error?.detail || 'Failed to update profile.');
        this.cd.detectChanges();
      }
    });
  }

  onUpdateSecurity(event: Event): void {
    event.preventDefault();
    if (this.newPassword && this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('New passwords do not match!');
      return;
    }
    this.errorMessage.set('');
    this.successMessage.set('Security settings updated successfully!');
    this.currentPassword = '';
    this.newPassword = '';
    this.confirmPassword = '';
  }

  savePreferences(): void {
    this.successMessage.set('Preferences saved successfully!');
  }

  saveNotifications(): void {
    this.successMessage.set('Notification preferences updated!');
  }

  getInitials(): string {
    const fn = this.first_name || '';
    const ln = this.last_name || '';
    if (fn || ln) {
      return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
    }
    return (this.username || 'U').substring(0, 2).toUpperCase();
  }
}

