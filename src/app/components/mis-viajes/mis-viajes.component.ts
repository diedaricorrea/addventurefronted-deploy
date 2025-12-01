import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MisViajesService } from '../../services/mis-viajes.service';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { MisViajesResponse, GrupoViaje } from '../../models/mis-viajes.model';
import { environment } from '../../../environments/environment';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';

@Component({
  selector: 'app-mis-viajes',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './mis-viajes.component.html',
  styleUrls: ['./mis-viajes.component.css']
})
export class MisViajesComponent implements OnInit {
  gruposCreados: GrupoViaje[] = [];
  gruposUnidos: GrupoViaje[] = [];
  gruposCerrados: GrupoViaje[] = [];
  totalGrupos: number = 0;
  loading: boolean = true;
  baseUrl: string = environment.baseUrl;

  constructor(
    private misViajesService: MisViajesService,
    private authService: AuthService,
    private toastService: ToastService,
    private confirmService: ConfirmService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.cargarMisViajes();
  }

  cargarMisViajes(): void {
    this.loading = true;
    this.misViajesService.getMisViajes().subscribe({
      next: (response: MisViajesResponse) => {
        this.gruposCreados = response.gruposCreados;
        this.gruposUnidos = response.gruposUnidos;
        this.gruposCerrados = response.gruposCerrados;
        this.totalGrupos = response.totalGrupos;
        this.loading = false;
      },
      error: (error) => {
        this.toastService.error('Error al cargar tus viajes');
        this.loading = false;
      }
    });
  }

  verDetalles(idGrupo: number): void {
    this.router.navigate(['/grupos', idGrupo]);
  }

  irACalificaciones(idGrupo: number): void {
    this.toastService.info('Funcionalidad de calificaciones próximamente');
  }

  irAEditar(idGrupo: number): void {
    this.router.navigate(['/grupos/editar', idGrupo]);
  }

  confirmarAbandonar(grupo: GrupoViaje): void {
    this.confirmService.confirm(
      `¿Estás seguro de que deseas abandonar el grupo "${grupo.nombreViaje}"?`,
      'Abandonar grupo',
      'Sí, abandonar',
      'Cancelar',
      'warning'
    ).subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.abandonarGrupo(grupo.idGrupo);
      }
    });
  }

  abandonarGrupo(idGrupo: number): void {
    this.misViajesService.abandonarGrupo(idGrupo).subscribe({
      next: (response: any) => {
        this.toastService.success(response.mensaje || 'Has abandonado el grupo exitosamente');
        this.cargarMisViajes();
      },
      error: (error) => {
        this.toastService.error(error.error?.error || 'Error al abandonar el grupo');
      }
    });
  }

  confirmarEliminar(grupo: GrupoViaje): void {
    this.confirmService.confirm(
      `¿Estás seguro de que deseas eliminar el grupo "${grupo.nombreViaje}"? Esta acción no se puede deshacer.`,
      'Eliminar grupo',
      'Sí, eliminar',
      'Cancelar',
      'danger'
    ).subscribe((confirmed: boolean) => {
      if (confirmed) {
        this.eliminarGrupo(grupo.idGrupo);
      }
    });
  }

  eliminarGrupo(idGrupo: number): void {
    this.misViajesService.eliminarGrupo(idGrupo).subscribe({
      next: (response: any) => {
        this.toastService.success(response.mensaje || 'Grupo eliminado exitosamente');
        this.cargarMisViajes();
      },
      error: (error) => {
        this.toastService.error(error.error?.error || 'Error al eliminar el grupo');
      }
    });
  }

  getImagenUrl(grupo: GrupoViaje): string {
    if (grupo.viaje?.imagenDestacada) {
      // Si la imagen ya tiene el protocolo, usarla directamente
      if (grupo.viaje.imagenDestacada.startsWith('http')) {
        return grupo.viaje.imagenDestacada;
      }
      // Si es una ruta relativa, agregar baseUrl/uploads/
      return `${this.baseUrl}/uploads/${grupo.viaje.imagenDestacada}`;
    }
    return `${this.baseUrl}/images/default-trip.jpg`;
  }

  getIniciales(nombre: string, apellidos: string): string {
    const inicial1 = nombre ? nombre.charAt(0).toUpperCase() : '';
    const inicial2 = apellidos ? apellidos.charAt(0).toUpperCase() : '';
    return inicial1 + inicial2;
  }

  getFotoPerfilUrl(fotoPerfil?: string): string {
    if (!fotoPerfil) {
      return '';
    }
    if (fotoPerfil.startsWith('http')) {
      return fotoPerfil;
    }
    return `${this.baseUrl}${fotoPerfil}`;
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const opciones: Intl.DateTimeFormatOptions = {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    };
    return date.toLocaleDateString('es-ES', opciones);
  }

  abreviarTexto(texto: string, maxLength: number = 100): string {
    if (!texto) return '';
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength) + '...';
  }

  esGrupoActivo(estado: string): boolean {
    return estado === 'activo';
  }

  esGrupoCerrado(estado: string): boolean {
    return estado === 'cerrado' || estado === 'concluido';
  }

  tieneGrupos(): boolean {
    return this.gruposCreados.length > 0 ||
           this.gruposUnidos.length > 0 ||
           this.gruposCerrados.length > 0;
  }

  irABuscarGrupos(): void {
    this.router.navigate(['/grupos']);
  }

  irACrearGrupo(): void {
    this.router.navigate(['/grupos/crear']);
  }
}
