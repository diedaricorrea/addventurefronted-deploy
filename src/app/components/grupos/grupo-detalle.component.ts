import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../shared/components/navbar/navbar.component';
import { HomeService } from '../../services/home.service';
import { GruposService } from '../../services/grupos.service';
import { ChatService } from '../../services/chat.service';
import { WebSocketService } from '../../services/websocket.service';
import { SolicitudService } from '../../services/solicitud.service';
import { HomeData } from '../../models/home-data.model';
import { GrupoViaje, Itinerario } from '../../models/grupos.model';
import { Subscription } from 'rxjs';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';
import { TestimonioService } from '../../services/testimonio.service';
import { environment } from '../../../environments/environment';
import { NameFormatter } from '../../shared/utils/name-formatter';

@Component({
  selector: 'app-grupo-detalle',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, NavbarComponent],
  templateUrl: './grupo-detalle.component.html',
  styleUrls: ['./grupo-detalle.component.css']
})
export class GrupoDetalleComponent implements OnInit, OnDestroy {
  homeData: HomeData | null = null;
  grupo: GrupoViaje | null = null;
  itinerarios: Itinerario[] = [];
  participantesAceptados = 0;
  totalMiembros = 0;
  loading = true;
  error: string | null = null;
  deleteConfirmText = '';
  mensajes: any[] = [];
  private wsSubscription?: Subscription;

  // Testimonio modal
  testimonioCalificacion = 0;
  testimonioComentario = '';
  testimonioAnonimo = false;
  testimonioEnviado = false;
  testimonioError: string | null = null;
  enviandoTestimonio = false;

  // Permisos del usuario
  permisos: any = {
    isAuthenticated: false,
    isCreador: false,
    isMiembro: false,
    estadoSolicitud: 'NINGUNA',
    puedeUnirse: false,
    puedeAbandonar: false,
    puedeEditar: false,
    puedeEliminar: false,
    puedeCerrar: false,
    puedeCalificar: false,
    puedeVerGaleria: false,
    puedeAccederChat: false
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    public homeService: HomeService,
    private gruposService: GruposService,
    private chatService: ChatService,
    private wsService: WebSocketService,
    private solicitudService: SolicitudService,
    private toastService: ToastService,
    private confirmService: ConfirmService,
    private testimonioService: TestimonioService
  ) {}

  // Método para encode URI
  encodeURIComponent(str: string): string {
    return encodeURIComponent(str);
  }

  ngOnInit(): void {
    this.loadHomeData();
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadGrupoDetalle(+id);
    }
  }

  loadHomeData(): void {
    this.homeService.homeData$.subscribe({
      next: (data) => {
        this.homeData = data;
      }
    });
  }

  loadGrupoDetalle(id: number): void {
    this.loading = true;
    this.error = null;

    this.gruposService.obtenerDetalleGrupo(id).subscribe({
      next: (response) => {
        this.grupo = response.grupo;
        this.itinerarios = response.itinerarios;
        this.participantesAceptados = response.participantesAceptados;
        this.totalMiembros = response.totalMiembros;
        this.loading = false;

        // Cargar permisos del usuario
        this.loadPermisos(id);
      },
      error: (err) => {
        console.error('Error al cargar detalle del grupo:', err);
        this.error = 'Error al cargar los detalles del grupo. Por favor, intenta de nuevo.';
        this.loading = false;
      }
    });
  }

  loadPermisos(id: number): void {
    this.gruposService.obtenerPermisosUsuario(id).subscribe({
      next: (response) => {
        this.permisos = response;

        // Si puede acceder al chat, cargar mensajes y conectar WebSocket
        if (this.permisos.puedeAccederChat) {
          this.loadMensajes(id);
          this.connectWebSocket(id);
        }
      },
      error: (err) => {
        console.error('Error al cargar permisos:', err);
        // Si falla, usar permisos por defecto (sin permisos)
      }
    });
  }

  loadMensajes(grupoId: number): void {
    this.chatService.obtenerMensajes(grupoId).subscribe({
      next: (mensajes) => {
        this.mensajes = mensajes;
        // Scroll al final del chat
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error al cargar mensajes:', err);
      }
    });
  }

  connectWebSocket(grupoId: number): void {
    this.wsSubscription = this.wsService.connect(grupoId).subscribe({
      next: (mensaje) => {
        console.log('Nuevo mensaje recibido:', mensaje);
        this.mensajes.push(mensaje);
        setTimeout(() => this.scrollToBottom(), 100);
      },
      error: (err) => {
        console.error('Error en WebSocket:', err);
      }
    });

    // Suscribirse también a las notificaciones de eliminación
    this.wsService.subscribeToDelete(grupoId).subscribe({
      next: (data: any) => {
        console.log('Mensaje eliminado vía WebSocket:', data.idMensaje);
        this.mensajes = this.mensajes.filter(m => m.idMensaje !== data.idMensaje);
      }
    });
  }

  scrollToBottom(): void {
    const chatContainer = document.getElementById('chatMessages');
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  ngOnDestroy(): void {
    // Limpiar la suscripción de WebSocket
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
    this.wsService.disconnect();
  }

  unirseGrupo(): void {
    if (!this.grupo) return;

    this.solicitudService.unirseGrupo(this.grupo.idGrupo).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccessMessage(response.message || 'Solicitud enviada exitosamente');
          // Recargar permisos para actualizar el estado
          this.loadPermisos(this.grupo!.idGrupo);
        } else {
          this.showErrorMessage(response.error || 'Error al enviar solicitud');
        }
      },
      error: (err) => {
        console.error('Error:', err);
        const errorMsg = err.error?.error || 'Error al unirse al grupo. Inténtalo de nuevo.';
        this.showErrorMessage(errorMsg);
      }
    });
  }

  abandonarGrupo(): void {
    if (!this.grupo) return;

    this.gruposService.abandonarGrupo(this.grupo.idGrupo).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccessMessage(response.message || 'Has abandonado el grupo exitosamente');
          setTimeout(() => this.router.navigate(['/grupos']), 1500);
        } else {
          this.showErrorMessage(response.error || 'Error al abandonar el grupo');
        }
      },
      error: (err) => {
        console.error('Error:', err);
        this.showErrorMessage('Error al abandonar el grupo');
      }
    });
  }

  cerrarViaje(): void {
    if (!this.grupo) return;

    this.confirmService.confirm(
      '¿Cerrar viaje?',
      '¿Estás seguro de que quieres cerrar este viaje? Esta acción no se puede deshacer y habilitará las calificaciones.',
      'warning'
    ).subscribe((confirmed) => {
      if (confirmed && this.grupo) {
        this.gruposService.cerrarGrupo(this.grupo.idGrupo).subscribe({
          next: (response) => {
            if (response.success) {
              this.toastService.success('Viaje cerrado exitosamente');
              // Mostrar modal de testimonio después de 1 segundo
              setTimeout(() => {
                this.mostrarModalTestimonio();
              }, 1000);
            } else {
              this.toastService.error(response.error || 'Error al cerrar el viaje');
            }
          },
          error: (err) => {
            console.error('Error:', err);
            this.toastService.error('Error al cerrar el viaje');
          }
        });
      }
    });
  }

  eliminarGrupo(): void {
    if (!this.grupo) return;

    this.gruposService.eliminarGrupo(this.grupo.idGrupo).subscribe({
      next: (response) => {
        if (response.success) {
          this.showSuccessMessage('Grupo eliminado exitosamente');
          setTimeout(() => this.router.navigate(['/grupos']), 1500);
        } else {
          this.showErrorMessage(response.error || 'Error al eliminar el grupo');
        }
      },
      error: (err) => {
        console.error('Error:', err);
        this.showErrorMessage('Error al eliminar el grupo');
      }
    });
  }

  enviarMensaje(mensaje: string): void {
    if (!this.grupo || !mensaje.trim()) return;

    this.chatService.enviarMensaje(this.grupo.idGrupo, mensaje).subscribe({
      next: (response) => {
        console.log('Mensaje enviado:', response);
        // El mensaje llegará por WebSocket, no lo agregamos aquí
      },
      error: (err) => {
        console.error('Error:', err);
        this.showErrorMessage('Error al enviar mensaje');
      }
    });
  }

  enviarImagen(event: Event): void {
    if (!this.grupo) return;

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      this.toastService.error('Solo se permiten archivos de imagen');
      input.value = '';
      return;
    }

    // Validar tamaño (máximo 5MB)
    if (file.size > 5 * 1024 * 1024) {
      this.toastService.error('La imagen es demasiado grande. Máximo 5MB');
      input.value = '';
      return;
    }

    this.chatService.enviarImagen(this.grupo.idGrupo, file).subscribe({
      next: (response) => {
        if (response.idMensaje || response.success !== false) {
          this.toastService.success('Imagen enviada exitosamente');
          input.value = '';
        } else {
          this.toastService.error('No se pudo enviar la imagen');
        }
      },
      error: (err) => {
        console.error('Error:', err);
        this.toastService.error(err.error?.error || 'Error al enviar imagen');
        input.value = '';
      }
    });
  }

  onChatKeypress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      const input = event.target as HTMLInputElement;
      this.enviarMensaje(input.value);
      input.value = '';
    }
  }

  eliminarMensaje(idMensaje: number): void {
    if (!this.grupo) return;

    this.confirmService.confirm(
      '¿Estás seguro de que quieres eliminar este mensaje?',
      'Esta acción no se puede deshacer'
    ).subscribe((confirmed) => {
      if (confirmed && this.grupo) {
        this.chatService.eliminarMensaje(this.grupo.idGrupo, idMensaje).subscribe({
          next: (response: any) => {
            if (response.success) {
              // El mensaje se eliminará vía WebSocket
              this.toastService.success('Mensaje eliminado exitosamente');
            }
          },
          error: (err) => {
            console.error('Error al eliminar mensaje:', err);
            this.toastService.error('No se pudo eliminar el mensaje');
          }
        });
      }
    });
  }

  puedeEliminarMensaje(mensaje: any): boolean {
    if (!this.homeData) return false;

    // El usuario puede eliminar si:
    // 1. Es el creador del mensaje (comparar por email ya que no tenemos idUsuario en homeData)
    const esCreadorMensaje = mensaje.remitente?.email === this.homeData.email;

    // 2. Es el creador del grupo
    const esCreadorGrupo = this.permisos.isCreador;

    return esCreadorMensaje || esCreadorGrupo;
  }

  esMensajePropio(mensaje: any): boolean {
    if (!this.homeData) return false;
    return mensaje.remitente?.email === this.homeData.email;
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

  getImageUrl(url: string): string {
    if (!url) return '';
    // Si la URL ya es completa (http/https), devolverla tal cual
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Si ya tiene /uploads/, agregar solo la base
    if (url.startsWith('/uploads/')) {
      return `${environment.baseUrl}${url}`;
    }
    // Si es solo el nombre del archivo, agregar /uploads/
    return `${environment.baseUrl}/uploads/${url}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  }

  formatShortName(nombreCompleto: string | undefined): string {
    if (!nombreCompleto) return '';
    const parts = nombreCompleto.split(' ');
    if (parts.length < 2) return nombreCompleto;
    return NameFormatter.formatShortName(parts[0], parts.slice(1).join(' '));
  }

  private showSuccessMessage(message: string): void {
    this.toastService.success(message);
  }

  private showErrorMessage(message: string): void {
    this.toastService.error(message);
  }

  // Métodos del modal de testimonio
  mostrarModalTestimonio(): void {
    // Resetear valores
    this.testimonioCalificacion = 0;
    this.testimonioComentario = '';
    this.testimonioAnonimo = false;
    this.testimonioEnviado = false;
    this.testimonioError = null;
    this.enviandoTestimonio = false;

    // Mostrar modal con Bootstrap
    const modalElement = document.getElementById('testimonioModal');
    if (modalElement) {
      const bootstrap = (window as any).bootstrap;
      if (bootstrap && bootstrap.Modal) {
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
      }
    }
  }

  setCalificacionTestimonio(calificacion: number): void {
    this.testimonioCalificacion = calificacion;
  }

  puedeEnviarTestimonio(): boolean {
    return this.testimonioCalificacion > 0 &&
           this.testimonioComentario.length >= 20 &&
           this.testimonioComentario.length <= 500;
  }

  enviarTestimonio(): void {
    if (!this.puedeEnviarTestimonio()) {
      this.testimonioError = 'Por favor completa todos los campos correctamente';
      return;
    }

    this.enviandoTestimonio = true;
    this.testimonioError = null;

    const request = {
      comentario: this.testimonioComentario,
      calificacion: this.testimonioCalificacion,
      anonimo: this.testimonioAnonimo,
      idGrupo: this.grupo?.idGrupo
    };

    this.testimonioService.crearTestimonio(request).subscribe({
      next: (response) => {
        this.testimonioEnviado = true;
        this.enviandoTestimonio = false;

        // Recargar página después de 3 segundos
        setTimeout(() => {
          this.cerrarModalTestimonio();
          window.location.reload();
        }, 3000);
      },
      error: (err) => {
        console.error('Error al enviar testimonio:', err);
        this.testimonioError = err.error?.error || 'Error al enviar el testimonio. Intenta nuevamente.';
        this.enviandoTestimonio = false;
      }
    });
  }

  cerrarModalTestimonio(): void {
    const modalElement = document.getElementById('testimonioModal');
    if (modalElement) {
      const bootstrap = (window as any).bootstrap;
      if (bootstrap && bootstrap.Modal) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    }
  }
}
