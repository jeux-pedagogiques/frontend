import { ChangeDetectorRef, Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from 'src/app/theme/shared/service/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss']
})
export class ForgotPasswordComponent implements OnInit {
  private cd = inject(ChangeDetectorRef);
  private authService = inject(AuthService);
  private router = inject(Router);

  email = '';
  newPassword = '';
  confirmPassword = '';

  step = signal<'request' | 'reset' | 'success'>('request');
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  isDarkMode = signal<boolean>(localStorage.getItem('sidebar_theme') !== 'light');

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

  onRequestReset(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.email || !this.email.includes('@')) {
      this.errorMessage.set('Veuillez saisir une adresse email valide.');
      return;
    }

    this.isLoading.set(true);
    this.authService.forgotPassword(this.email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.can_reset_directly) {
          this.step.set('reset');
        } else {
          this.step.set('success');
          this.successMessage.set('Si un compte est associé à cette adresse, des instructions ont été générées.');
        }
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.detail || 'Une erreur est survenue lors de la demande.');
        this.cd.detectChanges();
      }
    });
  }

  onResetPassword(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.newPassword || this.newPassword.length < 8) {
      this.errorMessage.set('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('Les mots de passe ne correspondent pas.');
      return;
    }

    this.isLoading.set(true);
    this.authService.resetPassword({
      email: this.email,
      new_password: this.newPassword
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.step.set('success');
        this.successMessage.set(res.message || 'Votre mot de passe a été réinitialisé avec succès.');
        this.cd.detectChanges();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.detail || 'Erreur lors de la réinitialisation du mot de passe.');
        this.cd.detectChanges();
      }
    });
  }

  togglePasswordVisibility(): void {
    this.showPassword.set(!this.showPassword());
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.set(!this.showConfirmPassword());
  }
}
