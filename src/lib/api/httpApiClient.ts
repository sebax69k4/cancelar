/**
 * Cliente HTTP real contra la API REST de NestJS.
 * Implementa la misma interfaz `ApiClient` que el mock: la UI no cambia.
 *
 * Se activa definiendo PUBLIC_API_URL en `.env` (ver README, sección NestJS).
 * Autenticación: cookie HTTP-only emitida por el backend (credentials: 'include').
 */
import type {
  AlertsData, ApiClient, CreateClientInput, CreateEquipmentInput, CreateOrderInput, CreateServiceInput, CreateUserInput,
  DashboardData, EvidenceInput, OrderFilters, ResolveEscalationInput, ServicioAdmin, SetupProgress, SetupStatus,
  UpdateOrderInput, UpdateServiceInput, UpdateTallerInput, UpdateUserInput, UsuarioAdmin,
} from './apiClient';
import { handleUnauthorized } from '@/lib/auth/mockCurrentUser';
import { ApiError, type ApiErrorCode } from './errors';
import type { CausaEscalamiento, Cliente, Equipo, EstadoOrden, OrdenResumen, Servicio, Usuario } from '@/types/domain';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
type Query = Record<string, string | undefined>;

const CODE_BY_STATUS: Record<number, ApiErrorCode> = {
  400: 'VALIDATION',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'WORKFLOW_RULE',
};

/**
 * Convierte la respuesta de error de NestJS en ApiError.
 * Formato esperado: { statusCode, message: string | string[], details?: string[] }
 * (`message` como array es lo que devuelve ValidationPipe con class-validator).
 */
function toApiError(status: number, body: unknown): ApiError {
  const code = CODE_BY_STATUS[status] ?? 'NETWORK';
  let message = `Error ${status}`;
  let details: string[] = [];
  if (typeof body === 'object' && body !== null) {
    const b = body as { message?: unknown; details?: unknown };
    if (Array.isArray(b.message)) {
      details = b.message.filter((m): m is string => typeof m === 'string');
      message = 'Hay datos inválidos';
    } else if (typeof b.message === 'string') {
      message = b.message;
    }
    if (Array.isArray(b.details)) details = b.details.filter((d): d is string => typeof d === 'string');
  }
  return new ApiError(code, message, details);
}

export class HttpApiClient implements ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  private async request<T>(method: Method, path: string, opts: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await fetch(url, {
        method,
        credentials: 'include',
        headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      });
    } catch {
      throw new ApiError('NETWORK', 'No se pudo conectar con el servidor');
    }

    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (res.status === 401) handleUnauthorized(); // sesión vencida → AppShell redirige al login
    if (!res.ok) throw toApiError(res.status, data);
    // Confiamos en el contrato del backend. Para mayor robustez, validar con zod acá.
    return data as T;
  }

  getSetupStatus() {
    return this.request<SetupStatus>('GET', '/setup/status');
  }

  getSetupProgress() {
    return this.request<SetupProgress>('GET', '/setup/progress');
  }

  updateTaller(input: UpdateTallerInput) {
    return this.request<SetupProgress>('PATCH', '/setup/taller', { body: input });
  }

  completeSetup() {
    return this.request<SetupProgress>('POST', '/setup/complete');
  }

  getAllUsers() {
    return this.request<UsuarioAdmin[]>('GET', '/setup/users');
  }

  createUser(input: CreateUserInput) {
    return this.request<UsuarioAdmin>('POST', '/setup/users', { body: input });
  }

  updateUser(id: string, input: UpdateUserInput) {
    return this.request<UsuarioAdmin>('PATCH', `/setup/users/${encodeURIComponent(id)}`, { body: input });
  }

  getAllServices() {
    return this.request<ServicioAdmin[]>('GET', '/setup/services');
  }

  createService(input: CreateServiceInput) {
    return this.request<ServicioAdmin>('POST', '/setup/services', { body: input });
  }

  updateService(id: string, input: UpdateServiceInput) {
    return this.request<ServicioAdmin>('PATCH', `/setup/services/${encodeURIComponent(id)}`, { body: input });
  }

  changePassword(actual: string, nueva: string) {
    return this.request<void>('POST', '/auth/password', { body: { actual, nueva } });
  }

  getUsers() {
    return this.request<Usuario[]>('GET', '/users');
  }

  getServices() {
    return this.request<Servicio[]>('GET', '/services');
  }

  getClients(q = '') {
    return this.request<Cliente[]>('GET', '/clients', { query: { q } });
  }

  createClient(input: CreateClientInput) {
    return this.request<Cliente>('POST', '/clients', { body: input });
  }

  getEquipment(params: { q?: string; clienteId?: string } = {}) {
    return this.request<Equipo[]>('GET', '/equipment', { query: { q: params.q, clientId: params.clienteId } });
  }

  createEquipment(input: CreateEquipmentInput) {
    return this.request<Equipo>('POST', '/equipment', { body: input });
  }

  getEquipmentOrders(equipoId: string) {
    return this.request<OrdenResumen[]>('GET', `/equipment/${encodeURIComponent(equipoId)}/orders`);
  }

  getOrders(filters: OrderFilters = {}) {
    return this.request<OrdenResumen[]>('GET', '/orders', {
      query: { q: filters.q, status: filters.estado, priority: filters.prioridad, ownerId: filters.responsableId },
    });
  }

  getOrder(id: string) {
    return this.request<OrdenResumen>('GET', `/orders/${encodeURIComponent(id)}`);
  }

  createOrder(input: CreateOrderInput) {
    return this.request<OrdenResumen>('POST', '/orders', { body: input });
  }

  updateOrder(id: string, input: UpdateOrderInput, comentario?: string) {
    return this.request<OrdenResumen>('PATCH', `/orders/${encodeURIComponent(id)}`, { body: { ...input, comentario } });
  }

  transitionOrder(id: string, to: EstadoOrden, comentario: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/transitions`, { body: { to, comentario } });
  }

  blockOrder(id: string, motivo: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/block`, { body: { motivo } });
  }

  unblockOrder(id: string, comentario: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/unblock`, { body: { comentario } });
  }

  escalateOrder(id: string, causa: CausaEscalamiento, motivo: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/escalate`, { body: { causa, motivo } });
  }

  takeEscalation(id: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/escalation/take`);
  }

  raiseEscalation(id: string, motivo: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/escalation/raise`, { body: { motivo } });
  }

  resolveEscalation(id: string, input: ResolveEscalationInput) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/escalation/resolve`, { body: input });
  }

  abandonOrder(id: string, motivo: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/abandon`, { body: { motivo } });
  }

  reopenOrder(id: string, to: EstadoOrden, motivo: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/reopen`, { body: { to, motivo } });
  }

  validateOrder(id: string, comentario: string) {
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/validate`, { body: { comentario } });
  }

  addEvidence(id: string, file: EvidenceInput) {
    if (!file.file) return Promise.reject(new ApiError('VALIDATION', 'Falta el archivo de evidencia'));
    const form = new FormData();
    form.append('file', file.file, file.nombreArchivo);
    return this.request<OrdenResumen>('POST', `/orders/${encodeURIComponent(id)}/evidence`, { form });
  }

  removeEvidence(id: string, evidenciaId: string) {
    return this.request<OrdenResumen>('DELETE', `/orders/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenciaId)}`);
  }

  evidenceFileUrl(id: string, evidenciaId: string): string {
    return `${this.baseUrl}/orders/${encodeURIComponent(id)}/evidence/${encodeURIComponent(evidenciaId)}/file`;
  }

  getDashboard() {
    return this.request<DashboardData>('GET', '/dashboard');
  }

  getAlerts() {
    return this.request<AlertsData>('GET', '/alerts');
  }

  markCriticalReportRead(informeId: string) {
    return this.request<void>('PATCH', `/critical-reports/${encodeURIComponent(informeId)}/read`);
  }

  resetDemo(): Promise<void> {
    return Promise.reject(new ApiError('FORBIDDEN', 'Reiniciar la demo no está disponible con el backend real'));
  }
}
