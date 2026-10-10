/**
 * Cliente de API. Toda la UI habla con el backend SOLO a través de `apiClient`.
 *
 * Hoy: MockApiClient, que persiste en localStorage (src/mocks/db.ts) y aplica
 * las mismas reglas que deberá aplicar NestJS.
 * Mañana: HttpApiClient implementa la misma interfaz `ApiClient` con fetch()
 * y se cambia la última línea de este archivo. Ver endpoints sugeridos en cada método.
 */
import { getMockCurrentUser } from '@/lib/auth/mockCurrentUser';
import { can } from '@/lib/auth/permissions';
import { now, nowIso } from '@/lib/clock';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import { hoursOpen, isCriticalOverdue, isOpen, isOverdue } from '@/lib/workflow/alerts';
import { calculatePriority } from '@/lib/workflow/priority';
import {
  MIN_COMENTARIO, MIN_MOTIVO, REOPEN_TARGETS, canActOnOrder, canBlock, canEscalate,
  canReopen, canTransition, canUnblock, canValidate, isAssignedTo, type RuleResult,
} from '@/lib/workflow/transitions';
import { MOCK_SERVICES } from '@/mocks/catalog';
import { getDb, resetDb, updateDb, type DbState } from '@/mocks/db';
import { MOCK_USERS } from '@/mocks/users';
import type {
  Cliente, Equipo, EstadoOrden, Evidencia, Historial, Impacto, InformeCritico, Orden,
  OrdenResumen, Prioridad, Servicio, TipoAccion, TipoEquipo, Urgencia, Usuario,
} from '@/types/domain';
import { ApiError } from './errors';
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

export interface EvidenceInput {
  nombreArchivo: string;
  tipoMime: string;
  tamanoKb: number;
  /** El archivo real. El mock lo ignora; HttpApiClient lo envía como multipart. */
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
}

export interface AlertsData {
  criticas: OrdenResumen[];
  bloqueadas: OrdenResumen[];
  escaladas: OrdenResumen[];
}

export interface ApiClient {
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
  escalateOrder(id: string, motivo: string): Promise<OrdenResumen>;
  reopenOrder(id: string, to: EstadoOrden, motivo: string): Promise<OrdenResumen>;
  validateOrder(id: string, comentario: string): Promise<OrdenResumen>;
  addEvidence(id: string, file: EvidenceInput): Promise<OrdenResumen>;
  removeEvidence(id: string, evidenciaId: string): Promise<OrdenResumen>;

  getDashboard(): Promise<DashboardData>;
  getAlerts(): Promise<AlertsData>;
  markCriticalReportRead(informeId: string): Promise<void>;

  /** Solo demo. */
  resetDemo(): Promise<void>;
}

// ------------------------------------------------------------------ helpers

const delay = () => new Promise<void>((r) => setTimeout(r, 150 + Math.random() * 250));

function shouldFail(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('mockError') === '1';
  } catch {
    return false;
  }
}

async function simulate<T>(fn: () => T): Promise<T> {
  await delay();
  if (shouldFail()) throw new ApiError('NETWORK', 'Error simulado de red (mockError=1)');
  return fn();
}

function requireUser(): Usuario {
  const user = getMockCurrentUser();
  if (!user) throw new ApiError('UNAUTHORIZED', 'La sesión expiró. Volvé a iniciar sesión.');
  return user;
}

function enforce(rule: RuleResult, message: string): void {
  if (!rule.ok) throw new ApiError('WORKFLOW_RULE', message, rule.missing);
}

function requireText(value: string, min: number, field: string): string {
  const v = value.trim();
  if (v.length < min) throw new ApiError('VALIDATION', `${field}: mínimo ${min} caracteres`, [`${field} es obligatorio (mínimo ${min} caracteres)`]);
  return v;
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const digits = (s: string) => s.replace(/\D/g, '');

function userById(id: string): Usuario | undefined {
  return MOCK_USERS.find((u) => u.id === id);
}

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function history(
  order: Orden, user: Usuario, tipo: TipoAccion, comentario: string,
  estadoAnterior: EstadoOrden | null = null, estadoNuevo: EstadoOrden | null = null,
): Historial {
  return {
    id: newId('h'),
    ordenId: order.id,
    usuario: { id: user.id, nombre: user.nombre, rol: user.rol },
    fecha: nowIso(),
    tipo,
    estadoAnterior,
    estadoNuevo,
    comentario,
  };
}

function enrich(db: Readonly<DbState>, o: Orden, nowMs: number): OrdenResumen | null {
  const cliente = db.clientes.find((c) => c.id === o.clienteId);
  const equipo = db.equipos.find((e) => e.id === o.equipoId);
  const servicio = MOCK_SERVICES.find((s) => s.id === o.servicioId);
  const responsable = userById(o.responsableId);
  if (!cliente || !equipo || !servicio || !responsable) return null;
  return {
    ...o,
    cliente,
    equipo,
    servicio,
    responsable,
    tecnico: o.tecnicoId ? (userById(o.tecnicoId) ?? null) : null,
    horasAbierta: hoursOpen(o, nowMs),
    atrasada: isOverdue(o, nowMs),
    criticaVencida: isCriticalOverdue(o, nowMs),
  };
}

/** Órdenes visibles para el usuario: el Técnico solo ve las asignadas. */
function visibleOrders(db: Readonly<DbState>, user: Usuario): OrdenResumen[] {
  const nowMs = now();
  return db.ordenes
    .filter((o) => user.rol !== 'TECNICO' || isAssignedTo(o, user))
    .map((o) => enrich(db, o, nowMs))
    .filter((o): o is OrdenResumen => o !== null);
}

function matchesQuery(o: OrdenResumen, q: string): boolean {
  const term = normalize(q);
  if (!term) return true;
  const termDigits = digits(q);
  return (
    normalize(o.numero).includes(term) ||
    normalize(o.cliente.nombre).includes(term) ||
    normalize(o.equipo.numeroSerie).includes(term) ||
    normalize(`${o.equipo.marca} ${o.equipo.modelo}`).includes(term) ||
    (termDigits.length >= 3 && digits(o.cliente.telefono).includes(termDigits))
  );
}

const byNewest = (a: { fechaIngreso: string }, b: { fechaIngreso: string }) =>
  b.fechaIngreso.localeCompare(a.fechaIngreso);

function lastComment(o: Orden): string | null {
  return o.historial.at(-1)?.comentario ?? null;
}

// ------------------------------------------------------------------ implementación mock

class MockApiClient implements ApiClient {
  /** GET /users */
  getUsers() {
    return simulate(() => {
      requireUser();
      return [...MOCK_USERS];
    });
  }

  /** GET /services */
  getServices() {
    return simulate(() => [...MOCK_SERVICES]);
  }

  /** GET /clients?q= */
  getClients(q = '') {
    return simulate(() => {
      requireUser();
      const term = normalize(q);
      const qd = digits(q);
      return getDb()
        .clientes.filter(
          (c) =>
            !term ||
            normalize(c.nombre).includes(term) ||
            (c.email ? normalize(c.email).includes(term) : false) ||
            (qd.length >= 3 && digits(c.telefono).includes(qd)),
        )
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    });
  }

  /** POST /clients */
  createClient(input: CreateClientInput) {
    return simulate(() => {
      const user = requireUser();
      if (!can(user.rol, 'client.create')) throw new ApiError('FORBIDDEN', 'Tu rol no puede registrar clientes');
      const nombre = requireText(input.nombre, 2, 'Nombre');
      const telefono = requireText(input.telefono, 6, 'Teléfono');
      const dup = getDb().clientes.find((c) => digits(c.telefono) === digits(telefono));
      if (dup) throw new ApiError('CONFLICT', `Ya existe un cliente con ese teléfono: ${dup.nombre}`);
      const cliente: Cliente = {
        id: newId('c'),
        nombre,
        telefono,
        email: input.email?.trim() || null,
        notas: input.notas?.trim() || null,
        creadoEn: nowIso(),
      };
      updateDb((db) => {
        db.clientes.push(cliente);
      });
      return cliente;
    });
  }

  /** GET /equipment?q=&clientId= */
  getEquipment(params: { q?: string; clienteId?: string } = {}) {
    return simulate(() => {
      requireUser();
      const db = getDb();
      const term = normalize(params.q ?? '');
      return db.equipos
        .filter((e) => !params.clienteId || e.clienteId === params.clienteId)
        .filter((e) => {
          if (!term) return true;
          const owner = db.clientes.find((c) => c.id === e.clienteId);
          return (
            normalize(`${e.marca} ${e.modelo}`).includes(term) ||
            normalize(e.numeroSerie).includes(term) ||
            (owner ? normalize(owner.nombre).includes(term) : false)
          );
        })
        .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
    });
  }

  /** POST /equipment */
  createEquipment(input: CreateEquipmentInput) {
    return simulate(() => {
      const user = requireUser();
      if (!can(user.rol, 'equipment.create')) throw new ApiError('FORBIDDEN', 'Tu rol no puede registrar equipos');
      const db = getDb();
      if (!db.clientes.some((c) => c.id === input.clienteId)) throw new ApiError('VALIDATION', 'El cliente no existe');
      const numeroSerie = requireText(input.numeroSerie, 3, 'Número de serie').toUpperCase();
      if (db.equipos.some((e) => normalize(e.numeroSerie) === normalize(numeroSerie))) {
        throw new ApiError('CONFLICT', `Ya existe un equipo con el número de serie ${numeroSerie}`);
      }
      const equipo: Equipo = {
        id: newId('e'),
        clienteId: input.clienteId,
        tipo: input.tipo,
        marca: requireText(input.marca, 1, 'Marca'),
        modelo: requireText(input.modelo, 1, 'Modelo'),
        numeroSerie,
        notas: input.notas?.trim() || null,
        creadoEn: nowIso(),
      };
      updateDb((d) => {
        d.equipos.push(equipo);
      });
      return equipo;
    });
  }

  /** GET /equipment/:id/orders */
  getEquipmentOrders(equipoId: string) {
    return simulate(() => {
      const user = requireUser();
      return visibleOrders(getDb(), user).filter((o) => o.equipoId === equipoId).sort(byNewest);
    });
  }

  /** GET /orders?q=&status=&priority=&ownerId= */
  getOrders(filters: OrderFilters = {}) {
    return simulate(() => {
      const user = requireUser();
      return visibleOrders(getDb(), user)
        .filter((o) => !filters.estado || o.estado === filters.estado)
        .filter((o) => !filters.prioridad || o.prioridad === filters.prioridad)
        .filter((o) => !filters.responsableId || o.responsableId === filters.responsableId || o.tecnicoId === filters.responsableId)
        .filter((o) => !filters.q || matchesQuery(o, filters.q))
        .sort((a, b) => {
          // Críticas vencidas primero, luego por prioridad y antigüedad
          const rank = (x: OrdenResumen) => (x.criticaVencida ? 0 : 1);
          const prio: Record<Prioridad, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };
          return rank(a) - rank(b) || prio[a.prioridad] - prio[b.prioridad] || a.fechaIngreso.localeCompare(b.fechaIngreso);
        });
    });
  }

  /** GET /orders/:id */
  getOrder(id: string) {
    return simulate(() => this.loadVisible(id));
  }

  /** POST /orders */
  createOrder(input: CreateOrderInput) {
    return simulate(() => {
      const user = requireUser();
      if (!can(user.rol, 'order.create')) throw new ApiError('FORBIDDEN', 'Tu rol no puede crear órdenes');
      const db = getDb();
      const missing: string[] = [];
      if (!db.clientes.some((c) => c.id === input.clienteId)) missing.push('Falta el cliente');
      const equipo = db.equipos.find((e) => e.id === input.equipoId);
      if (!equipo) missing.push('Falta el equipo');
      else if (equipo.clienteId !== input.clienteId) missing.push('El equipo no pertenece al cliente');
      if (!MOCK_SERVICES.some((s) => s.id === input.servicioId)) missing.push('Falta el servicio');
      if (!userById(input.responsableId)) missing.push('Falta el responsable');
      if (input.tecnicoId && userById(input.tecnicoId)?.rol !== 'TECNICO') missing.push('El técnico asignado no es válido');
      if (input.fallaReportada.trim().length < MIN_MOTIVO) missing.push(`Describí la falla (mínimo ${MIN_MOTIVO} caracteres)`);
      if (missing.length) throw new ApiError('VALIDATION', 'No se puede crear la orden', missing);

      const fechaIngreso = nowIso();
      return updateDb((d) => {
        d.seq += 1;
        const orden: Orden = {
          id: newId('o'),
          numero: `OS-${new Date(now()).getFullYear()}-${String(d.seq).padStart(4, '0')}`,
          clienteId: input.clienteId,
          equipoId: input.equipoId,
          servicioId: input.servicioId,
          responsableId: input.responsableId,
          tecnicoId: input.tecnicoId,
          fallaReportada: input.fallaReportada.trim(),
          diagnostico: null,
          solucion: null,
          estado: 'RECIBIDO',
          impacto: input.impacto,
          urgencia: input.urgencia,
          prioridad: calculatePriority(input.impacto, input.urgencia),
          fechaIngreso,
          fechaEstimada: input.fechaEstimada,
          fechaCierre: null,
          bloqueada: false,
          motivoBloqueo: null,
          escalada: false,
          motivoEscalado: null,
          evidencias: [],
          validada: false,
          validadaPorId: null,
          historial: [],
        };
        orden.historial.push(history(orden, user, 'CREACION', 'Orden creada en recepción', null, 'RECIBIDO'));
        d.ordenes.push(orden);
        return this.toResumen(d, orden);
      });
    });
  }

  /** PATCH /orders/:id */
  updateOrder(id: string, input: UpdateOrderInput, comentario?: string) {
    return simulate(() => {
      const user = requireUser();
      return this.mutate(id, (o) => {
        if (o.estado === 'CERRADO') throw new ApiError('WORKFLOW_RULE', 'La orden está cerrada: reabrila para editarla');
        const editingContent = input.diagnostico !== undefined || input.solucion !== undefined;
        if (editingContent && !canActOnOrder(user, o, 'edit')) {
          throw new ApiError('FORBIDDEN', 'No podés editar el diagnóstico ni la solución de esta orden');
        }
        const reprioritizing = input.impacto !== undefined || input.urgencia !== undefined;
        if (reprioritizing && !can(user.rol, 'order.edit')) {
          throw new ApiError('FORBIDDEN', 'Solo un Supervisor o Admin puede cambiar impacto y urgencia');
        }
        const cambios: string[] = [];
        if (input.diagnostico !== undefined) {
          o.diagnostico = input.diagnostico?.trim() || null;
          cambios.push('diagnóstico');
        }
        if (input.solucion !== undefined) {
          o.solucion = input.solucion?.trim() || null;
          o.validada = false; // la validación aplica a la solución vigente
          o.validadaPorId = null;
          cambios.push('solución');
        }
        const reassigning = input.tecnicoId !== undefined || input.responsableId !== undefined;
        if (reassigning && !can(user.rol, 'order.assign')) throw new ApiError('FORBIDDEN', 'Tu rol no puede reasignar órdenes');
        if (input.tecnicoId !== undefined) {
          if (input.tecnicoId && userById(input.tecnicoId)?.rol !== 'TECNICO') throw new ApiError('VALIDATION', 'Técnico inválido');
          o.tecnicoId = input.tecnicoId;
          cambios.push('técnico');
        }
        if (input.responsableId !== undefined) {
          if (!userById(input.responsableId)) throw new ApiError('VALIDATION', 'Responsable inválido');
          o.responsableId = input.responsableId;
          cambios.push('responsable');
        }
        if (input.impacto !== undefined || input.urgencia !== undefined) {
          o.impacto = input.impacto ?? o.impacto;
          o.urgencia = input.urgencia ?? o.urgencia;
          o.prioridad = calculatePriority(o.impacto, o.urgencia);
          cambios.push('prioridad');
        }
        o.historial.push(history(o, user, 'ACTUALIZACION', comentario?.trim() || `Actualizado: ${cambios.join(', ')}`));
      });
    });
  }

  /** POST /orders/:id/transitions  { to, comment } */
  transitionOrder(id: string, to: EstadoOrden, comentario: string) {
    return simulate(() => {
      const user = requireUser();
      const text = requireText(comentario, MIN_COMENTARIO, 'Comentario');
      return this.mutate(id, (o) => {
        enforce(canTransition(o, to, user), `No se puede mover a «${ESTADO_LABEL[to]}»`);
        const prev = o.estado;
        o.estado = to;
        if (to === 'CERRADO') {
          o.fechaCierre = nowIso();
          o.escalada = false;
        }
        o.historial.push(history(o, user, to === 'CERRADO' ? 'CIERRE' : 'TRANSICION', text, prev, to));
      });
    });
  }

  /** POST /orders/:id/block */
  blockOrder(id: string, motivo: string) {
    return simulate(() => {
      const user = requireUser();
      const text = requireText(motivo, MIN_MOTIVO, 'Motivo');
      return this.mutate(id, (o) => {
        enforce(canBlock(o, user), 'No se puede bloquear la orden');
        o.bloqueada = true;
        o.motivoBloqueo = text;
        o.historial.push(history(o, user, 'BLOQUEO', text));
      });
    });
  }

  /** POST /orders/:id/unblock */
  unblockOrder(id: string, comentario: string) {
    return simulate(() => {
      const user = requireUser();
      const text = requireText(comentario, MIN_COMENTARIO, 'Comentario');
      return this.mutate(id, (o) => {
        enforce(canUnblock(o, user), 'No se puede desbloquear la orden');
        o.bloqueada = false;
        o.motivoBloqueo = null;
        o.historial.push(history(o, user, 'DESBLOQUEO', text));
      });
    });
  }

  /** POST /orders/:id/escalate */
  escalateOrder(id: string, motivo: string) {
    return simulate(() => {
      const user = requireUser();
      const text = requireText(motivo, MIN_MOTIVO, 'Motivo');
      return this.mutate(id, (o) => {
        enforce(canEscalate(o, user), 'No se puede escalar la orden');
        o.escalada = true;
        o.motivoEscalado = text;
        o.historial.push(history(o, user, 'ESCALADO', text));
      });
    });
  }

  /** POST /orders/:id/reopen  { to, reason } */
  reopenOrder(id: string, to: EstadoOrden, motivo: string) {
    return simulate(() => {
      const user = requireUser();
      const text = requireText(motivo, MIN_MOTIVO, 'Motivo');
      if (!REOPEN_TARGETS.includes(to)) throw new ApiError('VALIDATION', 'Estado de reapertura inválido');
      return this.mutate(id, (o) => {
        enforce(canReopen(o, user), 'No se puede reabrir la orden');
        const prev = o.estado;
        o.estado = to;
        o.fechaCierre = null;
        o.validada = false;
        o.validadaPorId = null;
        o.historial.push(history(o, user, 'REAPERTURA', text, prev, to));
      });
    });
  }

  /** POST /orders/:id/validate */
  validateOrder(id: string, comentario: string) {
    return simulate(() => {
      const user = requireUser();
      const text = requireText(comentario, MIN_COMENTARIO, 'Comentario');
      return this.mutate(id, (o) => {
        enforce(canValidate(o, user), 'No se puede validar la orden');
        o.validada = true;
        o.validadaPorId = user.id;
        o.historial.push(history(o, user, 'VALIDACION', text));
      });
    });
  }

  /** POST /orders/:id/evidence (multipart en el backend real) */
  addEvidence(id: string, file: EvidenceInput) {
    return simulate(() => {
      const user = requireUser();
      return this.mutate(id, (o) => {
        if (o.estado === 'CERRADO') throw new ApiError('WORKFLOW_RULE', 'La orden está cerrada');
        if (!canActOnOrder(user, o, 'edit')) throw new ApiError('FORBIDDEN', 'No podés adjuntar evidencia a esta orden');
        const ev: Evidencia = {
          id: newId('ev'),
          nombreArchivo: file.nombreArchivo,
          tipoMime: file.tipoMime,
          tamanoKb: file.tamanoKb,
          subidaPorId: user.id,
          fecha: nowIso(),
        };
        o.evidencias.push(ev);
        o.historial.push(history(o, user, 'ACTUALIZACION', `Evidencia adjunta: ${file.nombreArchivo}`));
      });
    });
  }

  /** DELETE /orders/:id/evidence/:evidenceId */
  removeEvidence(id: string, evidenciaId: string) {
    return simulate(() => {
      const user = requireUser();
      return this.mutate(id, (o) => {
        if (o.estado === 'CERRADO') throw new ApiError('WORKFLOW_RULE', 'La orden está cerrada');
        if (!canActOnOrder(user, o, 'edit')) throw new ApiError('FORBIDDEN', 'No podés quitar evidencia de esta orden');
        const ev = o.evidencias.find((e) => e.id === evidenciaId);
        if (!ev) throw new ApiError('NOT_FOUND', 'La evidencia no existe');
        o.evidencias = o.evidencias.filter((e) => e.id !== evidenciaId);
        o.validada = false;
        o.validadaPorId = null;
        o.historial.push(history(o, user, 'ACTUALIZACION', `Evidencia quitada: ${ev.nombreArchivo}`));
      });
    });
  }

  /** GET /dashboard */
  getDashboard() {
    return simulate((): DashboardData => {
      const user = requireUser();
      const db = getDb();
      const orders = visibleOrders(db, user);
      const open = orders.filter(isOpen);
      const informes = this.buildReports(db, orders);
      return {
        metrics: {
          activas: open.length,
          criticas: open.filter((o) => o.prioridad === 'CRITICA').length,
          criticasVencidas: open.filter((o) => o.criticaVencida).length,
          bloqueadas: open.filter((o) => o.bloqueada).length,
          escaladas: open.filter((o) => o.escalada).length,
          listas: open.filter((o) => o.estado === 'LISTO_PARA_RETIRAR').length,
          atrasadas: open.filter((o) => o.atrasada).length,
        },
        informesCriticos: informes,
        recientes: [...orders].sort(byNewest).slice(0, 8),
        totalOrdenes: orders.length,
        alertasPendientes: open.filter((o) => o.prioridad === 'CRITICA' || o.bloqueada || o.escalada).length,
      };
    });
  }

  /** GET /alerts */
  getAlerts() {
    return simulate((): AlertsData => {
      const user = requireUser();
      const open = visibleOrders(getDb(), user).filter(isOpen);
      const oldest = (a: OrdenResumen, b: OrdenResumen) => b.horasAbierta - a.horasAbierta;
      return {
        criticas: open.filter((o) => o.prioridad === 'CRITICA').sort(oldest),
        bloqueadas: open.filter((o) => o.bloqueada).sort(oldest),
        escaladas: open.filter((o) => o.escalada).sort(oldest),
      };
    });
  }

  /** PATCH /critical-reports/:id/read */
  markCriticalReportRead(informeId: string) {
    return simulate(() => {
      requireUser();
      updateDb((d) => {
        if (!d.informesLeidos.includes(informeId)) d.informesLeidos.push(informeId);
      });
    });
  }

  resetDemo() {
    return simulate(() => {
      const user = requireUser();
      if (!can(user.rol, 'demo.reset')) throw new ApiError('FORBIDDEN', 'Solo Admin puede reiniciar la demo');
      resetDb();
    });
  }

  // ---------------------------------------------------------------- internos

  private buildReports(db: Readonly<DbState>, orders: OrdenResumen[]): InformeCriticoView[] {
    return orders
      .filter((o) => o.criticaVencida)
      .sort((a, b) => b.horasAbierta - a.horasAbierta)
      .map((o) => {
        // El id incluye el día: si sigue abierta al día siguiente, vuelve a quedar "no leído".
        const id = `ic-${o.id}-${Math.floor(o.horasAbierta / 24)}`;
        return {
          id,
          ordenId: o.id,
          horasAbierta: o.horasAbierta,
          responsable: { id: o.responsable.id, nombre: o.responsable.nombre },
          ultimoComentario: lastComment(o),
          leido: db.informesLeidos.includes(id),
          orden: o,
        };
      });
  }

  private toResumen(db: Readonly<DbState>, o: Orden): OrdenResumen {
    const r = enrich(db, o, now());
    if (!r) throw new ApiError('NOT_FOUND', 'Datos de la orden incompletos');
    return r;
  }

  private loadVisible(id: string): OrdenResumen {
    const user = requireUser();
    const db = getDb();
    const o = db.ordenes.find((x) => x.id === id);
    if (!o) throw new ApiError('NOT_FOUND', 'La orden no existe');
    if (user.rol === 'TECNICO' && !isAssignedTo(o, user)) throw new ApiError('FORBIDDEN', 'Esta orden no está asignada a vos');
    return this.toResumen(db, o);
  }

  private mutate(id: string, fn: (o: Orden) => void): OrdenResumen {
    this.loadVisible(id); // 404 / 403
    return updateDb((d) => {
      const o = d.ordenes.find((x) => x.id === id);
      if (!o) throw new ApiError('NOT_FOUND', 'La orden no existe');
      fn(o);
      return this.toResumen(d, o);
    });
  }
}

/**
 * Selección del cliente: sin PUBLIC_API_URL → demo con localStorage;
 * con PUBLIC_API_URL (ej. http://localhost:3000/api) → backend NestJS real.
 */
const API_URL = import.meta.env.PUBLIC_API_URL;

export const isMockApi = !API_URL;

export const apiClient: ApiClient = API_URL ? new HttpApiClient(API_URL) : new MockApiClient();
