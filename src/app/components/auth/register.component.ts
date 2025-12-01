import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { VerificationService } from '../../services/verification.service';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent implements OnInit, OnDestroy {
  // Control de pasos
  currentStep = 1;

  // Formularios
  registerForm!: FormGroup;
  verificationForm!: FormGroup;

  // Estados UI
  showPassword = false;
  showConfirmPassword = false;
  loading = false;
  errorMessage = '';

  // Validaciones asíncronas
  usernameChecking = false;
  usernameAvailable: boolean | null = null;
  emailChecking = false;
  emailAvailable: boolean | null = null;

  // Verificación de email
  verificationSent = false;
  resendCountdown = 0;
  private countdownInterval: any;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private verificationService: VerificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/']);
      return;
    }

    this.createForm();
    this.createVerificationForm();
    this.setupUsernameValidation();
    this.setupEmailValidation();
  }

  createForm(): void {
    this.registerForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      apellido: ['', [Validators.required, Validators.minLength(2)]],
      nombreUsuario: ['', [Validators.required, Validators.minLength(3), Validators.pattern(/^[a-zA-Z0-9_]+$/)]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, Validators.pattern(/^[679]\d{8}$/)]],
      pais: ['Perú', [Validators.required]],
      ciudad: ['', [Validators.required]],
      fechaNacimiento: ['', [Validators.required, this.ageValidator]],
      contrasena: ['', [Validators.required, Validators.minLength(8)]],
      confirmContrasena: ['', [Validators.required]]
    }, { validators: this.passwordMatchValidator });
  }

  createVerificationForm(): void {
    this.verificationForm = this.fb.group({
      code: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });
  }

  setupUsernameValidation(): void {
    this.registerForm.get('nombreUsuario')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(username => {
          if (username && username.length >= 3) {
            this.usernameChecking = true;
            return this.authService.checkUsernameAvailability(username);
          }
          return [];
        })
      )
      .subscribe({
        next: (result: any) => {
          this.usernameChecking = false;
          this.usernameAvailable = result.available;
        },
        error: () => {
          this.usernameChecking = false;
          this.usernameAvailable = null;
        }
      });
  }

  setupEmailValidation(): void {
    this.registerForm.get('email')?.valueChanges
      .pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(email => {
          const emailControl = this.registerForm.get('email');
          if (email && emailControl?.valid) {
            this.emailChecking = true;
            return this.authService.checkEmailAvailability(email);
          }
          return [];
        })
      )
      .subscribe({
        next: (result: any) => {
          this.emailChecking = false;
          this.emailAvailable = result.available;
        },
        error: () => {
          this.emailChecking = false;
          this.emailAvailable = null;
        }
      });
  }

  ageValidator(control: AbstractControl): ValidationErrors | null {
    if (!control.value) return null;

    const birthDate = new Date(control.value);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 18 ? null : { underAge: true };
  }

  passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('contrasena');
    const confirmPassword = control.get('confirmContrasena');

    if (!password || !confirmPassword) return null;

    return password.value === confirmPassword.value ? null : { passwordMismatch: true };
  }

  togglePassword(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  // ==================== PASO 1: Enviar código de verificación ====================
  goToStep2(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    if (!this.usernameAvailable || !this.emailAvailable) {
      this.errorMessage = 'Por favor verifica que el usuario y email estén disponibles';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const email = this.registerForm.get('email')?.value;

    this.verificationService.sendCode(email).subscribe({
      next: () => {
        this.loading = false;
        this.verificationSent = true;
        this.currentStep = 2;
        this.startResendCountdown();
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al enviar código:', error);

        if (error.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Por favor, intenta más tarde.';
        } else if (error.status === 500) {
          this.errorMessage = 'Error en el servidor al enviar el código. Por favor, intenta más tarde.';
        } else {
          this.errorMessage = error.error?.message || 'Error al enviar el código de verificación. Intenta nuevamente.';
        }
      }
    });
  }

  // ==================== PASO 2: Verificar código ====================
  verifyCode(): void {
    if (this.verificationForm.invalid) {
      this.verificationForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const email = this.registerForm.get('email')?.value;
    const code = this.verificationForm.get('code')?.value;

    this.verificationService.verifyCode(email, code).subscribe({
      next: (response) => {
        this.loading = false;
        if (response.verified) {
          this.completeRegistration();
        } else {
          this.errorMessage = 'Código incorrecto o expirado. Intenta nuevamente.';
        }
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al verificar código:', error);

        if (error.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Por favor, intenta más tarde.';
        } else if (error.status === 500) {
          this.errorMessage = 'Error en el servidor. Por favor, intenta más tarde.';
        } else {
          this.errorMessage = error.error?.message || 'Error al verificar el código. Intenta nuevamente.';
        }
      }
    });
  }

  // Reenviar código
  resendCode(): void {
    if (this.resendCountdown > 0) return;

    this.loading = true;
    this.errorMessage = '';
    const email = this.registerForm.get('email')?.value;

    this.verificationService.sendCode(email).subscribe({
      next: () => {
        this.loading = false;
        this.startResendCountdown();
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al reenviar código:', error);

        if (error.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Por favor, intenta más tarde.';
        } else {
          this.errorMessage = error.error?.message || 'Error al reenviar el código. Intenta nuevamente.';
        }
      }
    });
  }

  private startResendCountdown(): void {
    this.resendCountdown = 60;
    this.countdownInterval = setInterval(() => {
      this.resendCountdown--;
      if (this.resendCountdown <= 0) {
        clearInterval(this.countdownInterval);
      }
    }, 1000);
  }

  // ==================== PASO 3: Completar registro ====================
  private completeRegistration(): void {
    this.loading = true;
    this.errorMessage = '';

    const registerData = {
      ...this.registerForm.value,
      telefono: '+51' + this.registerForm.value.telefono
    };

    this.authService.register(registerData).subscribe({
      next: () => {
        this.loading = false;
        this.currentStep = 3;
      },
      error: (error) => {
        this.loading = false;
        console.error('Error al registrar:', error);

        if (error.status === 0) {
          this.errorMessage = 'No se puede conectar con el servidor. Por favor, intenta más tarde.';
        } else if (error.status === 500) {
          this.errorMessage = 'Error en el servidor. Por favor, intenta más tarde.';
        } else {
          this.errorMessage = error.error?.message || 'Error al registrar. Por favor intenta de nuevo.';
        }
      }
    });
  }

  // Ir al inicio después de completar
  goToHome(): void {
    this.router.navigate(['/']);
  }

  // Ir al login después de completar
  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}
