/**
 * Cliente de API. Toda la UI habla con el backend SOLO a través de `apiClient`
 * (HttpApiClient: fetch con la cookie de sesión contra PUBLIC_API_URL).
 */
import type {
  CausaEscalamiento, Cliente, Equipo, EstadoOrden, Impacto, InformeCritico, OrdenResumen, Prioridad,
  ResolucionEscalamiento, Rol, Servicio, TipoEquipo, Urgencia, Usuario,
} from '@/types/domain';
import { API_URL } from './config';
import { HttpApiClient } from './httpApiClient';

// ------------------------------------------------------------------ contratos (DTO)

export interface OrderFilters {
  q?: string;
  estado?: EstadoOrden;
  prioridad?: Prioridad;
  responsableId?: string;
}

export interface CreateClientInput {
  nombre: string;
  telefono: string;
  email?: string | null;
  notas?: string | null;
}

export interface CreateEquipmentInput {
  clienteId: string;
  tipo: TipoEquipo;
  marca: string;
  modelo: string;
  numeroSerie: string;
  notas?: string | null;
}

export interface CreateOrderInput {
  clienteId: string;
  equipoId: string;
  servicioId: string;
  responsableId: string;
  tecnicoId: string | null;
  fallaReportada: string;
  impacto: Impacto;
  urgencia: Urgencia;
  fechaEstimada: string;
}

export interface UpdateOrderInput {
  diagnostico?: string | null;
  solucion?: string | null;
  tecnicoId?: string | null;
  responsableId?: string;
  impacto?: Impacto;
  urgencia?: Urgencia;
}

export interface ResolveEscalationInput {
  resolucion: ResolucionEscalamiento;
  texto: string;
  /** Reasignar el técnico (solo al continuar). */
  tecnicoId?: string;
  /** Constancia de aviso al cliente (obligatoria si se resuelve sin reparación). */
  avisoCliente?: string;
}

export interface EvidenceInput {
  nombreArchivo: string;
  tipoMime: string;
  tamanoKb: number;
  /** El archivo: HttpApiClient lo envía como multipart. */
  file?: File;
}

export interface DashboardMetrics {
  activas: number;
  criticas: number;
  criticasVencidas: number;
  bloqueadas: number;
  escaladas: number;
  listas: number;
  atrasadas: number;
}

/** Informe crítico con la orden asociada (join para la UI). */
export interface InformeCriticoView extends InformeCritico {
  orden: OrdenResumen;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  informesCriticos: InformeCriticoView[];
  recientes: OrdenResumen[];
  totalOrdenes: number;
  /** Para el contador del menú «Alertas». */
  alertasPendientes: number;
  /** Roles esenciales que nadie activo cubre. */
  rolesFaltantes: Rol[];
}

export interface AlertsData {
  criticas: OrdenResumen[];
  bloqueadas: OrdenResumen[];
  escaladas: OrdenResumen[];
}

/** Público: si ya hay algún taller y si se pueden registrar talleres nuevos. */
export interface SetupStatus {
  hayTalleres: boolean;
  registroAbierto: boolean;
}

/** El taller del usuario con sesión. */
export interface MySetup {
  configurado: boolean;
  tallerNombre: string;
}

export interface SetupProgress {
  taller: { nombre: string; telefono: string | null; direccion: string | null };
  configurado: boolean;
  rolesFaltantes: Rol[];
  serviciosActivos: number;
}

export interface UsuarioAdmin extends Usuario {
  activo: boolean;
}

export interface ServicioAdmin extends Servicio {
  activo: boolean;
}

export interface UpdateTallerInput {
  nombre: string;
  telefono?: string;
  direccion?: string;
}

export interface CreateUserInput {
  nombre: string;
  email: string;
  password: string;
  roles: Rol[];
}

export interface UpdateUserInput {
  nombre?: string;
  roles?: Rol[];
  activo?: boolean;
  password?: string;
}

export interface CreateServiceInput {
  nombre: string;
  descripcion?: string;
  precioBase: number;
}

export interface UpdateServiceInput {
  nombre?: string;
  precioBase?: number;
  activo?: boolean;
}

export interface ApiClient {
  getSetupStatus(): Promise<SetupStatus>;
  getMySetup(): Promise<MySetup>;
  getSetupProgress(): Promise<SetupProgress>;
  updateTaller(input: UpdateTallerInput): Promise<SetupProgress>;
  completeSetup(): Promise<SetupProgress>;
  getAllUsers(): Promise<UsuarioAdmin[]>;
  createUser(input: CreateUserInput): Promise<UsuarioAdmin>;
  updateUser(id: string, input: UpdateUserInput): Promise<UsuarioAdmin>;
  getAllServices(): Promise<ServicioAdmin[]>;
  createService(input: CreateServiceInput): Promise<ServicioAdmin>;
  updateService(id: string, input: UpdateServiceInput): Promise<ServicioAdmin>;
  changePassword(actual: string, nueva: string): Promise<void>;

  getUsers(): Promise<Usuario[]>;
  getServices(): Promise<Servicio[]>;

  getClients(q?: string): Promise<Cliente[]>;
  createClient(input: CreateClientInput): Promise<Cliente>;
  getEquipment(params?: { q?: string; clienteId?: string }): Promise<Equipo[]>;
  createEquipment(input: CreateEquipmentInput): Promise<Equipo>;
  getEquipmentOrders(equipoId: string): Promise<OrdenResumen[]>;

  getOrders(filters?: OrderFilters): Promise<OrdenResumen[]>;
  getOrder(id: string): Promise<OrdenResumen>;
  createOrder(input: CreateOrderInput): Promise<OrdenResumen>;
  updateOrder(id: string, input: UpdateOrderInput, comentario?: string): Promise<OrdenResumen>;
  transitionOrder(id: string, to: EstadoOrden, comentario: string): Promise<OrdenResumen>;
  blockOrder(id: string, motivo: string): Promise<OrdenResumen>;
  unblockOrder(id: string, comentario: string): Promise<OrdenResumen>;
  escalateOrder(id: string, causa: CausaEscalamiento, motivo: string): Promise<OrdenResumen>;
  takeEscalation(id: string): Promise<OrdenResumen>;
  raiseEscalation(id: string, motivo: string): Promise<OrdenResumen>;
  resolveEscalation(id: string, input: ResolveEscalationInput): Promise<OrdenResumen>;
  abandonOrder(id: string, motivo: string): Promise<OrdenResumen>;
  reopenOrder(id: string, to: EstadoOrden, motivo: string): Promise<OrdenResumen>;
  validateOrder(id: string, comentario: string): Promise<OrdenResumen>;
  addEvidence(id: string, file: EvidenceInput): Promise<OrdenResumen>;
  removeEvidence(id: string, evidenciaId: string): Promise<OrdenResumen>;
  /** URL para ver o descargar el archivo de una evidencia. */
  evidenceFileUrl(id: string, evidenciaId: string): string;

  getDashboard(): Promise<DashboardData>;
  getAlerts(): Promise<AlertsData>;
  markCriticalReportRead(informeId: string): Promise<void>;
}

export const apiClient: ApiClient = new HttpApiClient(API_URL);
