import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  emailLoginForm!: FormGroup;
  phoneLoginForm!: FormGroup;
  activeTab: 'email' | 'phone' = 'email';
  showPassword = false;
  errorMessage = '';
  successMessage = '';
  loading = false;
  returnUrl = '/';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Si ya está autenticado, redirigir
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

    // Verificar mensajes de logout
    if (this.route.snapshot.queryParams['logout']) {
      this.successMessage = 'Has cerrado sesión correctamente';
    }

    // Verificar si la sesión expiró
    if (this.route.snapshot.queryParams['sessionExpired']) {
      this.errorMessage = 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.';
    }

    this.createForms();
  }

  createForms(): void {
    this.emailLoginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });

    this.phoneLoginForm = this.fb.group({
      phone: ['', [Validators.required, Validators.pattern(/^[679]\d{8}$/)]],
      password: ['', [Validators.required]],
      rememberMe: [false]
    });
  }

  switchTab(tab: 'email' | 'phone'): void {
    this.activeTab = tab;
    this.errorMessage = '';
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmitEmail(): void {
    if (this.emailLoginForm.invalid) {
      this.emailLoginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const loginData = {
      username: this.emailLoginForm.value.email,
      password: this.emailLoginForm.value.password,
      rememberMe: this.emailLoginForm.value.rememberMe
    };

    this.authService.login(loginData).subscribe({
      next: () => {
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Email o contraseña incorrectos';
      }
    });
  }

  onSubmitPhone(): void {
    if (this.phoneLoginForm.invalid) {
      this.phoneLoginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const loginData = {
      username: '+51' + this.phoneLoginForm.value.phone,
      password: this.phoneLoginForm.value.password,
      rememberMe: this.phoneLoginForm.value.rememberMe
    };

    this.authService.login(loginData).subscribe({
      next: () => {
        this.router.navigate([this.returnUrl]);
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error.error?.message || 'Teléfono o contraseña incorrectos';
      }
    });
  }
}
