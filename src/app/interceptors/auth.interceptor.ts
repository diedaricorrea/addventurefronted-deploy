import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  // Verificar si el token está expirado antes de enviarlo
  if (token && !authService.isAuthenticated()) {
    // Token expirado, limpiar y redirigir con mensaje
    authService.logout();
    router.navigate(['/login'], { queryParams: { sessionExpired: 'true' } });
    return throwError(() => new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'));
  }

  // Solo agregar token a peticiones a nuestra API
  if (token && req.url.includes('/api/')) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next(clonedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        // Solo redirigir a login si es 401 (no autenticado)
        // No redirigir en errores 400 (validación) u otros
        if (error.status === 401) {
          authService.logout();
          router.navigate(['/login'], { queryParams: { sessionExpired: 'true' } });
        }
        return throwError(() => error);
      })
    );
  }

  return next(req);
};
