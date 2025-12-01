import { Component, OnInit, inject, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GruposService } from '../../../services/grupos.service';
import { ToastService } from '../../../services/toast.service';
import { NavbarComponent } from '../../../shared/components/navbar/navbar.component';
import { environment } from '../../../../environments/environment';

declare var L: any;

interface DiaItinerario {
  numero: number;
  fecha: string;
  diaNumero: number;
  titulo: string;
  descripcion: string;
  puntoPartida: string;
  puntoLlegada: string;
  duracionEstimada: string;
}

@Component({
  selector: 'app-crear-grupo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, NavbarComponent, RouterLink],
  templateUrl: './crear-grupo.component.html',
  styleUrls: ['./crear-grupo.component.css']
})
export class CrearGrupoComponent implements OnInit, AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef;

  grupoForm!: FormGroup;
  esEdicion = false;
  idGrupo?: number;
  loading = false;
  submitted = false;

  // Tab control
  currentTab: 'info' | 'location' | 'itinerary' = 'info';
  tabValidation = {
    info: false,
    location: false,
    itinerary: false
  };

  // Etiquetas
  tags: string[] = [];

  // Itinerario
  itineraryDays: DiaItinerario[] = [];
  tripDays = 0;
  showItinerary = false;

  // Fechas mínimas
  minFechaInicio: string = '';
  minFechaFin: string = '';

  // Imagen destacada
  imagenFile: File | null = null;
  imagenPreview: string | null = null;

  // Leaflet Map
  map: any;
  marker: any;
  selectedCoordinates: { lat: number; lng: number } | null = null;

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private gruposService = inject(GruposService);
  private toastService = inject(ToastService);

  ngOnInit(): void {
    this.calcularFechasMinimas();
    this.inicializarFormulario();

    // Verificar si es edición
    this.route.params.subscribe(params => {
      if (params['id']) {
        this.esEdicion = true;
        this.idGrupo = +params['id'];
        // En modo edición, habilitar todas las pestañas
        this.tabValidation.info = true;
        this.tabValidation.location = true;
        this.tabValidation.itinerary = true;
        this.cargarGrupo();
      }
    });
  }

  ngAfterViewInit(): void {
    // Inicializar Google Maps cuando se cambia a la pestaña de ubicación
    setTimeout(() => {
      if (this.currentTab === 'location' || this.esEdicion) {
        this.initializeMap();
      }
    }, 100);
  }

  inicializarFormulario(): void {
    this.grupoForm = this.fb.group({
      nombreViaje: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
      destinoPrincipal: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      fechaInicio: ['', [Validators.required, this.validarFechaInicio.bind(this)]],
      fechaFin: ['', [Validators.required, this.validarFechaFin.bind(this)]],
      descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
      puntoEncuentro: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(500)]],
      rangoEdadMin: [18, [Validators.required, Validators.min(18), Validators.max(80)]],
      rangoEdadMax: [60, [Validators.required, Validators.min(18), Validators.max(80)]],
      maxParticipantes: ['', [Validators.required, Validators.min(2), Validators.max(20)]],
      etiquetasInput: ['']
    });

    // Validación en tiempo real para revalidar pestañas (solo en modo creación)
    if (!this.esEdicion) {
      this.grupoForm.get('nombreViaje')?.valueChanges.subscribe(() => this.validateInfoTabRealTime());
      this.grupoForm.get('destinoPrincipal')?.valueChanges.subscribe(() => this.validateInfoTabRealTime());
      this.grupoForm.get('fechaInicio')?.valueChanges.subscribe(() => {
        this.actualizarFechaFinMinima();
        this.validateInfoTabRealTime();
      });
      this.grupoForm.get('fechaFin')?.valueChanges.subscribe(() => this.validateInfoTabRealTime());
      this.grupoForm.get('maxParticipantes')?.valueChanges.subscribe(() => this.validateInfoTabRealTime());
      this.grupoForm.get('descripcion')?.valueChanges.subscribe(() => this.validateInfoTabRealTime());
      this.grupoForm.get('puntoEncuentro')?.valueChanges.subscribe(() => this.validateLocationTabRealTime());
    }
  }

  cargarGrupo(): void {
    if (!this.idGrupo) return;

    this.loading = true;
    this.gruposService.obtenerDetalleGrupo(this.idGrupo).subscribe({
      next: (response: any) => {
        const grupo = response.grupo;
        this.grupoForm.patchValue({
          nombreViaje: grupo.nombreViaje,
          destinoPrincipal: grupo.viaje?.destinoPrincipal,
          fechaInicio: grupo.viaje?.fechaInicio,
          fechaFin: grupo.viaje?.fechaFin,
          descripcion: grupo.viaje?.descripcion,
          puntoEncuentro: grupo.viaje?.puntoEncuentro,
          rangoEdadMin: grupo.viaje?.rangoEdadMin || 18,
          rangoEdadMax: grupo.viaje?.rangoEdadMax || 60,
          maxParticipantes: grupo.maxParticipantes
        });

        // Cargar preview de imagen existente si existe
        if (grupo.viaje?.imagenDestacada) {
          this.imagenPreview = grupo.viaje.imagenDestacada.startsWith('http')
            ? grupo.viaje.imagenDestacada
            : `${environment.baseUrl}/uploads/${grupo.viaje.imagenDestacada}`;
        }

        // Cargar etiquetas
        if (grupo.etiquetas && grupo.etiquetas.length > 0) {
          this.tags = grupo.etiquetas.map((e: any) => e.nombreEtiqueta);
        }

        // Generar itinerario si hay fechas
        setTimeout(() => this.updateItinerary(), 100);

        this.loading = false;
      },
      error: (error: any) => {
        this.toastService.error('Error al cargar los datos del grupo');
        this.loading = false;
        this.router.navigate(['/mis-viajes']);
      }
    });
  }

  // Tab Navigation
  switchTab(tab: 'info' | 'location' | 'itinerary'): void {
    if (this.esEdicion) {
      this.currentTab = tab;
      return;
    }

    if (tab === 'location' && !this.tabValidation.info) {
      this.toastService.warning('Primero debes completar la información básica');
      return;
    }

    if (tab === 'itinerary' && (!this.tabValidation.info || !this.tabValidation.location)) {
      const message = !this.tabValidation.info
        ? 'Primero debes completar la información básica'
        : 'Primero debes completar el punto de encuentro';
      this.toastService.warning(message);
      return;
    }

    this.currentTab = tab;
  }

  goToLocation(): void {
    if (this.esEdicion || this.validateInfoTab()) {
      this.tabValidation.info = true;
      this.currentTab = 'location';
      // Inicializar mapa cuando se cambia a la pestaña de ubicación
      setTimeout(() => this.initializeMap(), 100);
    }
  }

  goToItinerary(): void {
    if (this.esEdicion || this.validateLocationTab()) {
      this.tabValidation.location = true;
      this.currentTab = 'itinerary';
      this.updateItinerary();
    }
  }

  getTabIcon(tab: string): string {
    const valid = (this.tabValidation as any)[tab];
    return valid ? 'bi bi-check-circle text-success' : 'bi bi-circle text-muted';
  }

  // Validación
  validateInfoTab(silent = false): boolean {
    const form = this.grupoForm;
    const hasImagen = this.imagenFile !== null || this.imagenPreview !== null;
    const isValid =
      form.get('nombreViaje')?.valid &&
      form.get('destinoPrincipal')?.valid &&
      form.get('fechaInicio')?.valid &&
      form.get('fechaFin')?.valid &&
      form.get('maxParticipantes')?.valid &&
      form.get('descripcion')?.valid &&
      this.tags.length > 0 &&
      hasImagen;

    if (!silent && !isValid) {
      if (!hasImagen) {
        this.toastService.error('Debes seleccionar una imagen destacada para el viaje');
      } else {
        this.toastService.error('Por favor completa todos los campos obligatorios de información básica');
      }
    }

    return isValid || false;
  }

  validateLocationTab(silent = false): boolean {
    const isValid = this.grupoForm.get('puntoEncuentro')?.valid || false;

    if (!silent && !isValid) {
      this.toastService.error('Por favor completa el punto de encuentro');
    }

    return isValid;
  }

  validateInfoTabRealTime(): void {
    const isValid = this.validateInfoTab(true);
    if (isValid !== this.tabValidation.info) {
      this.tabValidation.info = isValid;
      if (!isValid) {
        this.tabValidation.location = false;
        this.tabValidation.itinerary = false;
      }
    }
  }

  validateLocationTabRealTime(): void {
    const isValid = this.validateLocationTab(true);
    if (isValid !== this.tabValidation.location) {
      this.tabValidation.location = isValid;
      if (!isValid) {
        this.tabValidation.itinerary = false;
      }
    }
  }

  // Etiquetas
  onEtiquetaKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const tag = this.grupoForm.get('etiquetasInput')?.value?.trim();
      if (tag) {
        this.addTag(tag);
      }
    }
  }

  onEtiquetaBlur(): void {
    const tag = this.grupoForm.get('etiquetasInput')?.value?.trim();
    if (tag) {
      this.addTag(tag);
    }
  }

  addTag(tag: string): void {
    if (!tag || tag.trim() === '') {
      this.toastService.warning('Por favor ingresa una etiqueta válida');
      return;
    }

    tag = tag.trim().toLowerCase().replace(/^#/, '');

    if (this.tags.includes(tag)) {
      this.toastService.warning('Esta etiqueta ya ha sido agregada');
      return;
    }

    if (this.tags.length >= 10) {
      this.toastService.warning('No puedes agregar más de 10 etiquetas');
      return;
    }

    if (tag.length > 20) {
      this.toastService.warning('Las etiquetas no pueden tener más de 20 caracteres');
      return;
    }

    this.tags.push(tag);
    this.grupoForm.patchValue({ etiquetasInput: '' });

    // Revalidar pestaña
    if (!this.esEdicion) {
      this.validateInfoTabRealTime();
    }
  }

  removeTag(tag: string): void {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);

      // Revalidar pestaña
      if (!this.esEdicion) {
        this.validateInfoTabRealTime();
      }
    }
  }

  // Edad
  onEdadChange(): void {
    // Actualizar display en tiempo real
  }

  // Fechas e Itinerario
  onFechaChange(): void {
    this.actualizarFechaFinMinima();
    this.updateItinerary();
  }

  calcularFechasMinimas(): void {
    const hoy = new Date();
    const unaSemanaAntes = new Date();
    unaSemanaAntes.setDate(hoy.getDate() + 7);

    this.minFechaInicio = this.formatearFecha(unaSemanaAntes);
    this.minFechaFin = this.minFechaInicio;
  }

  actualizarFechaFinMinima(): void {
    const fechaInicio = this.grupoForm.get('fechaInicio')?.value;
    if (fechaInicio) {
      this.minFechaFin = fechaInicio;
    } else {
      this.minFechaFin = this.minFechaInicio;
    }
  }

  formatearFecha(fecha: Date): string {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  validarFechaInicio(control: any): { [key: string]: any } | null {
    if (!control.value) return null;

    const fechaSeleccionada = new Date(control.value + 'T00:00:00');
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    const unaSemanaAntes = new Date();
    unaSemanaAntes.setDate(hoy.getDate() + 7);
    unaSemanaAntes.setHours(0, 0, 0, 0);

    if (fechaSeleccionada < hoy) {
      return { fechaPasada: true };
    }

    if (fechaSeleccionada < unaSemanaAntes) {
      return { fechaMuyProxima: true };
    }

    return null;
  }

  validarFechaFin(control: any): { [key: string]: any } | null {
    if (!control.value) return null;

    const fechaFin = new Date(control.value + 'T00:00:00');
    const fechaInicio = this.grupoForm?.get('fechaInicio')?.value;

    if (fechaInicio) {
      const fechaInicioDate = new Date(fechaInicio + 'T00:00:00');
      if (fechaFin < fechaInicioDate) {
        return { fechaFinAnterior: true };
      }
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fechaFin < hoy) {
      return { fechaPasada: true };
    }

    return null;
  }

  updateItinerary(): void {
    const fechaInicio = this.grupoForm.get('fechaInicio')?.value;
    const fechaFin = this.grupoForm.get('fechaFin')?.value;

    if (fechaInicio && fechaFin) {
      const start = new Date(fechaInicio + 'T00:00:00');
      const end = new Date(fechaFin + 'T00:00:00');

      if (start > end) {
        this.showItinerary = false;
        return;
      }

      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

      this.tripDays = diffDays;
      this.showItinerary = true;

      // Generar días solo si no existen o cambió el número
      if (this.itineraryDays.length === 0 || this.itineraryDays.length !== diffDays) {
        this.generateItineraryDays(diffDays, start);
      }
    } else {
      this.showItinerary = false;
    }
  }

  generateItineraryDays(days: number, startDate: Date): void {
    this.itineraryDays = [];
    for (let i = 0; i < days; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);

      const fecha = currentDate.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      this.itineraryDays.push({
        numero: i + 1,
        fecha: fecha,
        diaNumero: i + 1,
        titulo: '',
        descripcion: '',
        puntoPartida: '',
        puntoLlegada: '',
        duracionEstimada: ''
      });
    }
  }

  // Submit
  onSubmit(): void {
    this.submitted = true;

    if (this.grupoForm.invalid) {
      this.toastService.error('Por favor completa todos los campos obligatorios');
      this.currentTab = 'info';
      return;
    }

    if (this.tags.length === 0) {
      this.toastService.error('Debes agregar al menos una etiqueta');
      this.currentTab = 'info';
      return;
    }

    // Validar imagen obligatoria (solo en creación o si no hay preview existente)
    if (!this.imagenFile && !this.imagenPreview) {
      this.toastService.error('Debes seleccionar una imagen destacada para el viaje');
      this.currentTab = 'info';
      return;
    }

    // Validar fechas
    const fechaInicio = this.grupoForm.value.fechaInicio;
    const fechaFin = this.grupoForm.value.fechaFin;
    if (new Date(fechaInicio) > new Date(fechaFin)) {
      this.toastService.error('La fecha de fin debe ser igual o posterior a la fecha de inicio');
      this.currentTab = 'info';
      return;
    }

    // Validar rangos de edad
    const edadMin = this.grupoForm.value.rangoEdadMin;
    const edadMax = this.grupoForm.value.rangoEdadMax;
    if (edadMax < edadMin) {
      this.toastService.error('La edad máxima debe ser mayor o igual a la edad mínima');
      this.currentTab = 'info';
      return;
    }

    // Preparar datos para enviar
    const diasItinerario = this.itineraryDays
      .filter(dia => dia.titulo || dia.descripcion)
      .map(dia => ({
        diaNumero: dia.diaNumero,
        titulo: dia.titulo || '',
        descripcion: dia.descripcion || '',
        puntoPartida: dia.puntoPartida || '',
        puntoLlegada: dia.puntoLlegada || '',
        duracionEstimada: dia.duracionEstimada || ''
      }));

    const datos = {
      nombreViaje: this.grupoForm.value.nombreViaje,
      destinoPrincipal: this.grupoForm.value.destinoPrincipal,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      descripcion: this.grupoForm.value.descripcion,
      puntoEncuentro: this.grupoForm.value.puntoEncuentro,
      imagenDestacada: this.grupoForm.value.imagenDestacada || '',
      rangoEdadMin: edadMin,
      rangoEdadMax: edadMax,
      maxParticipantes: this.grupoForm.value.maxParticipantes,
      etiquetas: this.tags,
      diasItinerario: diasItinerario
    };

    this.loading = true;

    const operacion = this.esEdicion
      ? this.gruposService.actualizarGrupo(this.idGrupo!, datos)
      : this.gruposService.crearGrupo(datos);

    operacion.subscribe({
      next: (response: any) => {
        const idGrupo = response.idGrupo || this.idGrupo;

        // Si hay imagen para subir, subirla después de crear/actualizar el grupo
        if (this.imagenFile && idGrupo) {
          this.gruposService.subirImagenDestacada(idGrupo, this.imagenFile).subscribe({
            next: () => {
              this.toastService.success(
                response.mensaje || (this.esEdicion ? 'Grupo actualizado exitosamente' : 'Grupo creado exitosamente')
              );
              this.router.navigate(['/mis-viajes']);
            },
            error: (imgError: any) => {
              // El grupo se creó pero falló la imagen
              this.toastService.warning('Grupo guardado, pero hubo un error al subir la imagen');
              this.router.navigate(['/mis-viajes']);
            }
          });
        } else {
          this.toastService.success(
            response.mensaje || (this.esEdicion ? 'Grupo actualizado exitosamente' : 'Grupo creado exitosamente')
          );
          this.router.navigate(['/mis-viajes']);
        }
      },
      error: (error: any) => {
        this.toastService.error(error.error?.error || 'Error al guardar el grupo');
        this.loading = false;
      }
    });
  }

  // Manejo de imagen destacada
  onImagenSeleccionada(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];

      // Validar tipo de archivo
      if (!file.type.startsWith('image/')) {
        this.toastService.error('El archivo debe ser una imagen');
        return;
      }

      // Validar tamaño (máximo 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.toastService.error('La imagen no puede superar los 5MB');
        return;
      }

      this.imagenFile = file;

      // Crear preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagenPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  eliminarImagen(): void {
    this.imagenFile = null;
    this.imagenPreview = null;
  }

  // Helpers
  isFieldInvalid(field: string): boolean {
    const control = this.grupoForm.get(field);
    return !!(control && control.invalid && (control.dirty || control.touched || this.submitted));
  }

  getFieldError(field: string): string {
    const control = this.grupoForm.get(field);
    if (control?.errors) {
      if (control.errors['required']) return 'Este campo es requerido';
      if (control.errors['minlength'])
        return `Mínimo ${control.errors['minlength'].requiredLength} caracteres`;
      if (control.errors['maxlength'])
        return `Máximo ${control.errors['maxlength'].requiredLength} caracteres`;
      if (control.errors['min']) return `Valor mínimo: ${control.errors['min'].min}`;
      if (control.errors['max']) return `Valor máximo: ${control.errors['max'].max}`;
      if (control.errors['pattern']) return 'URL inválida (debe comenzar con http:// o https://)';
      if (control.errors['fechaPasada']) return 'No se pueden seleccionar fechas pasadas';
      if (control.errors['fechaMuyProxima']) return 'La fecha debe ser al menos 1 semana después de hoy';
      if (control.errors['fechaFinAnterior']) return 'La fecha de fin debe ser igual o posterior a la fecha de inicio';
    }
    return '';
  }

  // Google Maps
  initializeMap(): void {
    if (typeof L === 'undefined') {
      console.error('Leaflet no está cargado');
      return;
    }

    // Verificar si el mapa ya está inicializado
    if (this.map) {
      return;
    }

    const mapElement = document.getElementById('map');
    if (!mapElement) {
      return;
    }

    // Coordenadas por defecto (Bogotá, Colombia)
    const defaultLocation: [number, number] = [4.7110, -74.0721];

    // Crear el mapa con Leaflet
    this.map = L.map('map').setView(defaultLocation, 12);

    // Añadir capa de OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Crear marcador
    this.marker = L.marker(defaultLocation, {
      draggable: true
    }).addTo(this.map);

    // Evento de clic en el mapa
    this.map.on('click', (e: any) => {
      this.placeMarkerAndUpdateAddress(e.latlng);
    });

    // Evento cuando se arrastra el marcador
    this.marker.on('dragend', (e: any) => {
      this.placeMarkerAndUpdateAddress(e.target.getLatLng());
    });
  }

  placeMarkerAndUpdateAddress(latlng: any): void {
    this.marker.setLatLng(latlng);
    this.map.panTo(latlng);

    // Guardar coordenadas
    this.selectedCoordinates = {
      lat: latlng.lat,
      lng: latlng.lng
    };

    // Usar Nominatim (OpenStreetMap) para geocodificación inversa
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latlng.lat}&lon=${latlng.lng}&zoom=18&addressdetails=1`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data.display_name) {
          const address = data.display_name;
          this.grupoForm.patchValue({ puntoEncuentro: address });
        } else {
          this.grupoForm.patchValue({
            puntoEncuentro: `Ubicación: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`
          });
        }
      })
      .catch(error => {
        console.error('Error en geocodificación:', error);
        this.grupoForm.patchValue({
          puntoEncuentro: `Ubicación: ${latlng.lat.toFixed(6)}, ${latlng.lng.toFixed(6)}`
        });
      });
  }

  searchLocation(): void {
    const searchTerm = this.searchInput?.nativeElement?.value;

    if (!searchTerm || searchTerm.trim() === '') {
      this.toastService.warning('Por favor ingresa un lugar para buscar');
      return;
    }

    // Usar Nominatim para búsqueda de lugares
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1`;

    fetch(url)
      .then(response => response.json())
      .then(data => {
        if (data && data.length > 0) {
          const result = data[0];
          const latlng = L.latLng(parseFloat(result.lat), parseFloat(result.lon));

          // Centrar el mapa en el resultado
          this.map.setView(latlng, 15);

          // Mover el marcador
          this.placeMarkerAndUpdateAddress(latlng);

          this.toastService.success('Ubicación encontrada');
        } else {
          this.toastService.warning('No se encontró la ubicación. Intenta con otro término de búsqueda');
        }
      })
      .catch(error => {
        console.error('Error en búsqueda:', error);
        this.toastService.error('Error al buscar la ubicación');
      });
  }

  onSearchKeyPress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchLocation();
    }
  }
}
