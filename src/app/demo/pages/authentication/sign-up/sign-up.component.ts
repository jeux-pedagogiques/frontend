// angular import
import { ChangeDetectorRef, Component, computed, inject, signal, OnInit } from '@angular/core';

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
export class SignUpComponent implements OnInit {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  isLoading = signal(false);
  error = signal('');
  successMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  confirmPassword = '';

  isDarkMode = signal<boolean>(localStorage.getItem('sidebar_theme') !== 'light');

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
    role: 'prof'
  });

  registerForm = form(this.registerModel, (schemaPath) => {
    required(schemaPath.email, { message: 'Email is required' });
    email(schemaPath.email, { message: 'Enter a valid email address' });
    required(schemaPath.password, { message: 'Password is required' });
    minLength(schemaPath.password, 8, { message: 'Password must be at least 8 characters' });
    required(schemaPath.username, { message: 'Username is required' });
  });

  ngOnInit(): void {
    if (this.isDarkMode()) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  toggleTheme(): void {
    const nextVal = !this.isDarkMode();
    this.isDarkMode.set(nextVal);
    localStorage.setItem('sidebar_theme', nextVal ? 'dark' : 'light');
    if (nextVal) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }

  onSubmit(event: Event) {
    this.submitted.set(true);
    this.error.set('');
    this.successMessage.set('');
    event.preventDefault();

    if (this.confirmPasswordError() || this.registerForm().invalid()) {
      this.cd.detectChanges();
      return;
    }

    this.isLoading.set(true);
    const credentials = this.registerModel();

    this.authService.register(credentials).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/analytics']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.detail || "Une erreur est survenue lors de l'inscription.");
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
}
