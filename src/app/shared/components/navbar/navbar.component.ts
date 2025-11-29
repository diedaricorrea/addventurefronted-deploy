import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HomeData } from '../../../models/home-data.model';
import { AuthService } from '../../../services/auth.service';
import { HomeService } from '../../../services/home.service';
import { NameFormatter } from '../../utils/name-formatter';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit, OnDestroy {
  @Input() homeData: HomeData | null = null;
  private homeDataSubscription?: Subscription;
  protected readonly baseUrl = environment.baseUrl;

  constructor(
    private authService: AuthService,
    private router: Router,
    private homeService: HomeService
  ) {}

  ngOnInit(): void {
    // Suscribirse a los cambios de homeData
    this.homeDataSubscription = this.homeService.homeData$.subscribe(data => {
      if (data) {
        this.homeData = data;
      }
    });
  }

  ngOnDestroy(): void {
    this.homeDataSubscription?.unsubscribe();
  }

  get isAuthenticated(): boolean {
    return this.homeData?.authenticated || false;
  }

  // Formatear nombre corto para navbar
  getShortName(): string {
    if (!this.homeData?.nombre || !this.homeData?.apellido) {
      return this.homeData?.username || '';
    }
    return NameFormatter.formatCardName(this.homeData.nombre, this.homeData.apellido);
  }

  logout(): void {
    this.authService.logout();
    // Forzar recarga de la página para limpiar estado
    window.location.href = '/';
  }
}
