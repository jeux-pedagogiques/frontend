// angular import
import { ChangeDetectorRef, Component, inject, signal } from '@angular/core';

import { Router, RouterModule } from '@angular/router';
import { email, Field, form, minLength, required } from '@angular/forms/signals';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-sign-in',
  imports: [RouterModule, SharedModule, Field],
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  isLoading = signal(false);
  error = signal('');
  showPassword = signal(false);

  loginModal = signal<{ email: string; password: string }>({
    email: '',
    password: ''
  });

  loginForm = form(this.loginModal, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Enter a valid email address' });
    required(schemaPath.password, { message: 'Password is required' });
    minLength(schemaPath.password, 8, { message: 'Password must be at least 8 characters' });
  });

  onSubmit(event: Event) {
    this.submitted.set(true);
    this.error.set('');
    event.preventDefault();
    if (this.loginForm().invalid()) {
      this.cd.detectChanges();
      return;
    }
    this.isLoading.set(true);
    const credentials = this.loginModal();
    this.authService.login(credentials).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/analytics']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.detail || 'An error occurred during sign in');
        this.cd.detectChanges();
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  loginWithGoogle() {
    console.log('Login with Google initiated');
    // TODO: Implement Google OAuth flow
  }

  loginWithGithub() {
    console.log('Login with GitHub initiated');
    // TODO: Implement GitHub OAuth flow
  }
}
