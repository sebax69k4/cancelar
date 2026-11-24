/**
 * Conversión de modelos Prisma a la forma que espera el frontend
 * (frontend/src/types/domain.ts): fechas ISO, sin datos sensibles.
 */
import { hoursOpen, isCriticalOverdue, isOverdue } from '../domain/alerts';
import type { Cliente, Equipo, Escalamiento, Evidencia, Historial, Prisma, Servicio, Usuario } from '../generated/prisma/client';

export const ORDER_INCLUDE = {
  cliente: true,
  equipo: true,
  servicio: true,
  responsable: true,
  tecnico: true,
  evidencias: { orderBy: [{ fecha: 'asc' }, { id: 'asc' }] },
  historial: { orderBy: [{ fecha: 'asc' }, { id: 'asc' }], include: { usuario: true } },
  escalamientos: {
    orderBy: [{ creadoEn: 'asc' }, { id: 'asc' }],
    include: { creadoPor: true, tomadoPor: true, resueltoPor: true },
  },
} satisfies Prisma.OrdenInclude;

/**
 * Lo que necesitan las reglas para decidir, sin los datos de personas, cliente y equipo. Dentro de una
 * transacción las consultas van de a una: con la base en otro servidor, cada una cuesta un viaje.
 */
export const REGLAS_INCLUDE = { evidencias: true, escalamientos: true } satisfies Prisma.OrdenInclude;
export type OrdenReglas = Prisma.OrdenGetPayload<{ include: typeof REGLAS_INCLUDE }>;

export type OrdenFull = Prisma.OrdenGetPayload<{ include: typeof ORDER_INCLUDE }>;

export function toUsuario(u: Usuario) {
  return { id: u.id, nombre: u.nombre, email: u.email, roles: u.roles };
}

export function toCliente(c: Cliente) {
  return {
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono,
    email: c.email,
    notas: c.notas,
    creadoEn: c.creadoEn.toISOString(),
  };
}

export function toEquipo(e: Equipo) {
  return {
    id: e.id,
    clienteId: e.clienteId,
    tipo: e.tipo,
    marca: e.marca,
    modelo: e.modelo,
    numeroSerie: e.numeroSerie,
    notas: e.notas,
    creadoEn: e.creadoEn.toISOString(),
  };
}

export function toServicio(s: Servicio) {
  return { id: s.id, nombre: s.nombre, descripcion: s.descripcion, precioBase: s.precioBase };
}

export function toEvidencia(e: Evidencia) {
  return {
    id: e.id,
    nombreArchivo: e.nombreArchivo,
    tipoMime: e.tipoMime,
    tamanoKb: e.tamanoKb,
    subidaPorId: e.subidaPorId,
    fecha: e.fecha.toISOString(),
  };
}

/** Autor de las acciones automáticas (historial sin usuario). */
const SISTEMA = { id: 'sistema', nombre: 'Sistema', roles: [] };

export function toHistorial(h: Historial & { usuario: Usuario | null }) {
  return {
    id: h.id,
    ordenId: h.ordenId,
    usuario: h.usuario ? { id: h.usuario.id, nombre: h.usuario.nombre, roles: h.usuario.roles } : SISTEMA,
    fecha: h.fecha.toISOString(),
    tipo: h.tipo,
    estadoAnterior: h.estadoAnterior,
    estadoNuevo: h.estadoNuevo,
    comentario: h.comentario,
  };
}

const persona = (u: Usuario | null) => (u ? { id: u.id, nombre: u.nombre } : null);

export function toEscalamiento(e: Escalamiento & { creadoPor: Usuario | null; tomadoPor: Usuario | null; resueltoPor: Usuario | null }) {
  return {
    id: e.id,
    nivel: e.nivel,
    causa: e.causa,
    motivo: e.motivo,
    automatico: e.automatico,
    estado: e.estado,
    creadoPor: persona(e.creadoPor),
    creadoEn: e.creadoEn.toISOString(),
    tomadoPor: persona(e.tomadoPor),
    tomadoEn: e.tomadoEn?.toISOString() ?? null,
    resueltoPor: persona(e.resueltoPor),
    resueltoEn: e.resueltoEn?.toISOString() ?? null,
    resolucion: e.resolucion,
    textoResolucion: e.textoResolucion,
  };
}

/** OrdenResumen: orden + relaciones + campos calculados (horas, atraso, crítica vencida). */
export function toOrdenResumen(o: OrdenFull, nowMs: number = Date.now()) {
  return {
    id: o.id,
    numero: o.numero,
    clienteId: o.clienteId,
    equipoId: o.equipoId,
    servicioId: o.servicioId,
    responsableId: o.responsableId,
    tecnicoId: o.tecnicoId,
    fallaReportada: o.fallaReportada,
    diagnostico: o.diagnostico,
    solucion: o.solucion,
    estado: o.estado,
    impacto: o.impacto,
    urgencia: o.urgencia,
    prioridad: o.prioridad,
    fechaIngreso: o.fechaIngreso.toISOString(),
    fechaEstimada: o.fechaEstimada.toISOString(),
    fechaCierre: o.fechaCierre?.toISOString() ?? null,
    bloqueada: o.bloqueada,
    motivoBloqueo: o.motivoBloqueo,
    escalada: o.escalada,
    motivoEscalado: o.motivoEscalado,
    evidencias: o.evidencias.map(toEvidencia),
    validada: o.validada,
    validadaPorId: o.validadaPorId,
    resultado: o.resultado,
    informeNoReparacion: o.informeNoReparacion,
    avisoCliente: o.avisoCliente,
    historial: o.historial.map(toHistorial),
    escalamientos: o.escalamientos.map(toEscalamiento),
    cliente: toCliente(o.cliente),
    equipo: toEquipo(o.equipo),
    servicio: toServicio(o.servicio),
    responsable: toUsuario(o.responsable),
    tecnico: o.tecnico ? toUsuario(o.tecnico) : null,
    horasAbierta: hoursOpen(o, nowMs),
    atrasada: isOverdue(o, nowMs),
    criticaVencida: isCriticalOverdue(o, nowMs),
  };
}

export type OrdenResumenDto = ReturnType<typeof toOrdenResumen>;
