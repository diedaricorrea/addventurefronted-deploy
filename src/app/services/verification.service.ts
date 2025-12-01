import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface VerificationResponse {
  verified: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class VerificationService {
  private apiUrl = environment.apiUrl + '/verification';

  constructor(private http: HttpClient) {}

  /**
   * Envía el código de verificación al email del usuario
   */
  sendCode(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/sendCode?email=${encodeURIComponent(email)}`, {});
  }

  /**
   * Verifica el código ingresado por el usuario
   */
  verifyCode(email: string, code: string): Observable<VerificationResponse> {
    return this.http.post<VerificationResponse>(`${this.apiUrl}/verifyCode`, { email, code });
  }
}
