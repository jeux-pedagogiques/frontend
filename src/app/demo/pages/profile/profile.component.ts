import { ChangeDetectorRef, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService, User } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, SharedModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  private authService = inject(AuthService);
  private cd = inject(ChangeDetectorRef);

  user = signal<User | null>(null);
  submitted = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  // Form model fields
  username = '';
  email = '';
  first_name = '';
  last_name = '';
  phone = '';
  address = '';
  bio = '';
  avatar = signal<string | null>(null);

  ngOnInit(): void {
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.user.set(currentUser);
      this.loadFormData(currentUser);
    }
  }

  loadFormData(user: User): void {
    this.username = user.username || '';
    this.email = user.email || '';
    this.first_name = user.first_name || '';
    this.last_name = user.last_name || '';
    this.phone = user.phone || '';
    this.address = user.address || '';
    this.bio = user.bio || '';
    this.avatar.set(user.avatar || null);
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

  getInitials(): string {
    const fn = this.first_name || '';
    const ln = this.last_name || '';
    if (fn || ln) {
      return `${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase();
    }
    return (this.username || 'U').substring(0, 2).toUpperCase();
  }
}
