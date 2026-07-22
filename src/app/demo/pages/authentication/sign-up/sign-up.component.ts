// angular import
import { ChangeDetectorRef, Component, computed, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { email, Field, form, minLength, required } from '@angular/forms/signals';

// project import
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-sign-up',
  imports: [FormsModule, RouterModule, SharedModule, Field],
  templateUrl: './sign-up.component.html',
  styleUrls: ['./sign-up.component.scss']
})
export class SignUpComponent {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  error = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  confirmPassword = '';

  confirmPasswordError = computed(() => {
    if (!this.confirmPassword && this.submitted()) {
      return 'Please confirm your password';
    }
    if (this.confirmPassword && this.registerModel().password !== this.confirmPassword) {
      return 'Passwords do not match';
    }
    return '';
  });

  registerModel = signal<{ email: string; password: string; username: string; role: string }>({
    email: '',
    password: '',
    username: '',
    role: 'student'
  });

  registerForm = form(this.registerModel, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Enter a valid email address' });
    required(schemaPath.password, { message: 'Password is required' });
    minLength(schemaPath.password, 8, { message: 'Password must be at least 8 characters' });
    required(schemaPath.username, { message: 'Username is required' });
    required(schemaPath.role, { message: 'Role is required' });
  });

  onSubmit(event: Event) {
    this.submitted.set(true);
    this.error.set('');
    event.preventDefault();
    if (this.confirmPasswordError() || this.registerForm().invalid()) {
      this.cd.detectChanges();
      return;
    }
    const credentials = this.registerModel();
    this.authService.register(credentials).subscribe({
      next: () => {
        this.router.navigate(['/analytics']);
      },
      error: (err) => {
        this.error.set(err.error?.detail || 'An error occurred during registration');
        this.cd.detectChanges();
      }
    });
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }

  signupWithGoogle() {
    console.log('Sign up with Google initiated');
    // TODO: Implement Google OAuth flow
  }

  signupWithGithub() {
    console.log('Sign up with GitHub initiated');
    // TODO: Implement GitHub OAuth flow
  }
}
