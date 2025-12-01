import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { HomeService } from '../../services/home.service';
import { GruposService } from '../../services/grupos.service';
import { HomeData } from '../../models/home-data.model';
import { GrupoViaje, GruposFiltros } from '../../models/grupos.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-grupos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule, NavbarComponent, FooterComponent],
  templateUrl: './grupos.component.html',
  styleUrls: ['./grupos.component.css']
})
export class GruposComponent implements OnInit {
  homeData: HomeData | null = null;
  grupos: GrupoViaje[] = [];
  searchForm!: FormGroup;
  loading = false;
  error: string | null = null;

  // Paginación
  currentPage = 0;
  totalPages = 0;
  totalElements = 0;
  size = 6;

  // Fecha mínima para los inputs de fecha (hoy)
  minDate: string;

  constructor(
    private fb: FormBuilder,
    private homeService: HomeService,
    private gruposService: GruposService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
  }

  ngOnInit(): void {
    this.loadHomeData();
    this.createForm();
    this.loadFiltersFromUrl();
    this.buscarGrupos();
  }

  loadHomeData(): void {
    this.homeService.homeData$.subscribe({
      next: (data) => {
        this.homeData = data;
      }
    });
  }

  createForm(): void {
    this.searchForm = this.fb.group({
      destinoPrincipal: [''],
      fechaInicio: [''],
      fechaFin: [''],
      sort: ['']
    });
  }

  loadFiltersFromUrl(): void {
    this.route.queryParams.subscribe(params => {
      if (params['destinoPrincipal']) {
        this.searchForm.patchValue({ destinoPrincipal: params['destinoPrincipal'] });
      }
      if (params['fechaInicio']) {
        this.searchForm.patchValue({ fechaInicio: params['fechaInicio'] });
      }
      if (params['fechaFin']) {
        this.searchForm.patchValue({ fechaFin: params['fechaFin'] });
      }
      if (params['sort']) {
        this.searchForm.patchValue({ sort: params['sort'] });
      }
      if (params['page']) {
        this.currentPage = parseInt(params['page'], 10);
      }
    });
  }

  onSubmit(): void {
    this.currentPage = 0; // Reiniciar a la primera página al buscar
    this.updateUrlWithFilters();
    this.buscarGrupos();
  }

  limpiarFiltros(): void {
    this.searchForm.reset({
      destinoPrincipal: '',
      fechaInicio: '',
      fechaFin: '',
      sort: ''
    });
    this.currentPage = 0;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {}
    });
    this.buscarGrupos();
  }

  get hayFiltrosActivos(): boolean {
    const formValue = this.searchForm.value;
    return !!(formValue.destinoPrincipal || formValue.fechaInicio || formValue.fechaFin || formValue.sort);
  }

  buscarGrupos(): void {
    this.loading = true;
    this.error = null;

    const filtros: GruposFiltros = {
      ...this.searchForm.value,
      page: this.currentPage,
      size: this.size
    };

    // Limpiar valores vacíos
    Object.keys(filtros).forEach(key => {
      if (filtros[key as keyof GruposFiltros] === '' || filtros[key as keyof GruposFiltros] === null) {
        delete filtros[key as keyof GruposFiltros];
      }
    });

    this.gruposService.buscarGrupos(filtros).subscribe({
      next: (response) => {
        this.grupos = response.grupos;
        this.totalPages = response.totalPages;
        this.totalElements = response.totalElements;
        this.currentPage = response.currentPage;
        this.loading = false;

        if (response.error) {
          this.error = response.error;
        }
      },
      error: (err) => {
        console.error('Error al buscar grupos:', err);
        this.error = 'Error al cargar los grupos. Por favor, intenta de nuevo.';
        this.grupos = [];
        this.loading = false;
      }
    });
  }

  updateUrlWithFilters(): void {
    const queryParams: any = { page: this.currentPage };

    const formValue = this.searchForm.value;
    if (formValue.destinoPrincipal) queryParams['destinoPrincipal'] = formValue.destinoPrincipal;
    if (formValue.fechaInicio) queryParams['fechaInicio'] = formValue.fechaInicio;
    if (formValue.fechaFin) queryParams['fechaFin'] = formValue.fechaFin;
    if (formValue.sort) queryParams['sort'] = formValue.sort;

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge'
    });
  }

  onSortChange(): void {
    this.currentPage = 0;
    this.updateUrlWithFilters();
    this.buscarGrupos();
  }

  goToPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.updateUrlWithFilters();
      this.buscarGrupos();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getPagesArray(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  getImageUrl(fotoPerfil: string | null): string {
    return fotoPerfil ? `${environment.baseUrl}/uploads/${fotoPerfil}` : '';
  }

  getImagenDestacadaUrl(imagenDestacada: string | null | undefined): string {
    if (!imagenDestacada) {
      return `${environment.baseUrl}/images/default-trip.jpg`;
    }
    // Si es URL externa (comienza con http), devolverla tal cual
    if (imagenDestacada.startsWith('http')) {
      return imagenDestacada;
    }
    // Si es ruta local, construir URL completa
    return `${environment.baseUrl}/uploads/${imagenDestacada}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  truncateText(text: string | undefined, maxLength: number): string {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }
}
