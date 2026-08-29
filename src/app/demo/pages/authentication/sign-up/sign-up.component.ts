// angular import
import { ChangeDetectorRef, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';

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
export class SignUpComponent implements OnInit, OnDestroy {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  submitted = signal(false);
  isLoading = signal(false);
  isResending = signal(false);
  error = signal('');
  successMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  confirmPassword = '';

  step = signal<'form' | 'verify'>('form');
  verificationCode = '';
  resendCountdown = signal(0);
  private timerInterval: any = null;

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

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
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

    this.authService.sendVerificationCode(credentials).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.step.set('verify');
        this.startResendTimer();
        this.successMessage.set(`Un code à 6 chiffres a été envoyé à ${credentials.email}`);
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.detail || "Une erreur est survenue lors de l'envoi du code.");
        this.cd.detectChanges();
      }
    });
  }

  onVerifyCode(): void {
    this.error.set('');
    this.successMessage.set('');

    const cleanCode = this.verificationCode.trim();
    if (!cleanCode || cleanCode.length < 6) {
      this.error.set('Veuillez saisir le code à 6 chiffres reçu par email.');
      return;
    }

    this.isLoading.set(true);
    this.authService.verifyRegistration({
      email: this.registerModel().email,
      code: cleanCode
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/analytics']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.detail || 'Code de vérification invalide ou expiré.');
        this.cd.detectChanges();
      }
    });
  }

  onResendCode(): void {
    if (this.resendCountdown() > 0 || this.isResending()) return;

    this.isResending.set(true);
    this.error.set('');
    this.successMessage.set('');

    this.authService.resendVerificationCode(this.registerModel().email).subscribe({
      next: (res) => {
        this.isResending.set(false);
        this.startResendTimer();
        this.successMessage.set('Nouveau code envoyé par email avec succès.');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isResending.set(false);
        this.error.set(err.error?.detail || "Impossible de renvoyer le code pour l'instant.");
        this.cd.detectChanges();
      }
    });
  }

  backToForm(): void {
    this.step.set('form');
    this.error.set('');
    this.successMessage.set('');
    this.verificationCode = '';
  }

  private startResendTimer(): void {
    this.resendCountdown.set(60);
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      const current = this.resendCountdown();
      if (current <= 1) {
        this.resendCountdown.set(0);
        clearInterval(this.timerInterval);
      } else {
        this.resendCountdown.set(current - 1);
      }
      this.cd.detectChanges();
    }, 1000);
  }

  togglePasswordVisibility() {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }
}
