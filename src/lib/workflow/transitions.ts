/**
 * Reglas del workflow. Funciones puras: las usa la UI (para explicar qué falta)
 * y el apiClient mock (para rechazar). El backend NestJS debe replicarlas.
 */
import { can } from '@/lib/auth/permissions';
import { ESTADO_LABEL } from '@/lib/domain/labels';
import type { EstadoOrden, Orden, Usuario } from '@/types/domain';

export const MIN_COMENTARIO = 5;
export const MIN_MOTIVO = 10;

/** Siguiente paso "natural" de cada estado. */
export const NEXT_STATE: Partial<Record<EstadoOrden, EstadoOrden>> = {
  RECIBIDO: 'EN_DIAGNOSTICO',
  EN_DIAGNOSTICO: 'EN_REPARACION',
  EN_REPARACION: 'PRUEBAS',
  PRUEBAS: 'LISTO_PARA_RETIRAR',
  LISTO_PARA_RETIRAR: 'CERRADO',
};

/** Transiciones permitidas (incluye retrocesos razonables). CERRADO solo sale con «Reabrir». */
export const ALLOWED_TRANSITIONS: Readonly<Record<EstadoOrden, readonly EstadoOrden[]>> = {
  RECIBIDO: ['EN_DIAGNOSTICO'],
  EN_DIAGNOSTICO: ['EN_REPARACION'],
  EN_REPARACION: ['PRUEBAS', 'EN_DIAGNOSTICO'],
  PRUEBAS: ['LISTO_PARA_RETIRAR', 'EN_REPARACION'],
  LISTO_PARA_RETIRAR: ['CERRADO', 'PRUEBAS'],
  CERRADO: [],
};

export const REOPEN_TARGETS: readonly EstadoOrden[] = ['EN_DIAGNOSTICO', 'EN_REPARACION'];

export interface RuleResult {
  ok: boolean;
  missing: string[];
}

const result = (missing: string[]): RuleResult => ({ ok: missing.length === 0, missing });

export function isAssignedTo(order: Pick<Orden, 'tecnicoId' | 'responsableId'>, user: Usuario): boolean {
  return order.tecnicoId === user.id || order.responsableId === user.id;
}

export type OrderAction = 'transition' | 'block' | 'escalate' | 'edit';

/** Permiso del usuario sobre una orden concreta (considera permisos ".own"). */
export function canActOnOrder(user: Usuario, order: Orden, action: OrderAction): boolean {
  if (can(user.roles, `order.${action}`)) return true;
  if (can(user.roles, `order.${action}.own`) && isAssignedTo(order, user)) return true;
  return false;
}

// ---------------------------------------------------------------- cierre

/** La orden se resolvió sin reparar (no reparable o rechazada por el cliente). */
export function isSinReparar(order: Pick<Orden, 'resultado'>): boolean {
  return order.resultado === 'NO_REPARABLE' || order.resultado === 'RECHAZADO_CLIENTE';
}

const hasOpenEscalation = (order: Orden) => order.escalamientos.some((e) => e.estado !== 'RESUELTO');

export interface ChecklistItem {
  id: 'solucion' | 'informe' | 'evidencia' | 'validada';
  label: string;
  done: boolean;
  missingText: string;
}

export function closeChecklist(order: Orden): ChecklistItem[] {
  return [
    isSinReparar(order)
      ? {
          id: 'informe',
          label: 'Informe de no reparación',
          done: Boolean(order.informeNoReparacion?.trim()),
          missingText: 'Falta el informe de no reparación',
        }
      : {
          id: 'solucion',
          label: 'Solución documentada',
          done: Boolean(order.solucion?.trim()),
          missingText: 'Falta documentar la solución',
        },
    {
      id: 'evidencia',
      label: 'Al menos una evidencia adjunta',
      done: order.evidencias.length > 0,
      missingText: 'Falta adjuntar al menos una evidencia',
    },
    {
      id: 'validada',
      label: 'Validación visual de un supervisor',
      done: order.validada,
      missingText: 'Falta la validación visual de un supervisor',
    },
  ];
}

// ---------------------------------------------------------------- siguiente paso (UI)

export type StepRequirementId = 'tecnico' | 'diagnostico' | 'solucion' | 'informe' | 'evidencia' | 'validada' | 'desbloqueo' | 'escalamiento';

export interface StepRequirement {
  id: StepRequirementId;
  label: string;
  done: boolean;
}

/**
 * Requisitos de datos para avanzar al estado `to`, en positivo («Diagnóstico cargado»), para
 * mostrarlos como checklist antes de intentar el cambio. Coincide con canTransition (sin permisos).
 */
export function stepRequirements(order: Orden, to: EstadoOrden): StepRequirement[] {
  const reqs: StepRequirement[] = [];
  if (order.bloqueada) reqs.push({ id: 'desbloqueo', label: 'Orden desbloqueada', done: false });
  switch (to) {
    case 'EN_DIAGNOSTICO':
      reqs.push({ id: 'tecnico', label: 'Técnico asignado', done: Boolean(order.tecnicoId) });
      break;
    case 'EN_REPARACION':
      if (order.estado === 'EN_DIAGNOSTICO') {
        reqs.push({ id: 'diagnostico', label: 'Diagnóstico cargado', done: Boolean(order.diagnostico?.trim()) });
      }
      break;
    case 'LISTO_PARA_RETIRAR':
      reqs.push({ id: 'solucion', label: 'Solución documentada', done: Boolean(order.solucion?.trim()) });
      break;
    case 'CERRADO':
      for (const c of closeChecklist(order)) reqs.push({ id: c.id, label: c.label, done: c.done });
      if (hasOpenEscalation(order)) reqs.push({ id: 'escalamiento', label: 'Escalamiento resuelto', done: false });
      break;
    default:
      break;
  }
  return reqs;
}

// ---------------------------------------------------------------- transición

function transitionPermission(order: Orden, to: EstadoOrden, user: Usuario): string | null {
  if (to === 'CERRADO') {
    return can(user.roles, 'order.close') || can(user.roles, 'order.deliver') ? null : 'Tu rol no puede cerrar la orden';
  }
  if (can(user.roles, 'order.transition')) return null;
  const own = can(user.roles, 'order.transition.own');
  const reception = can(user.roles, 'order.transition.reception');
  if (own && isAssignedTo(order, user)) return null;
  if (reception && order.estado === 'RECIBIDO' && to === 'EN_DIAGNOSTICO') return null;
  if (own) return 'Solo podés mover órdenes asignadas a vos';
  if (reception) return 'Recepción solo puede pasar órdenes de Recibido a En diagnóstico';
  return 'Tu rol no puede cambiar el estado de las órdenes';
}

/** ¿Se puede mover la orden a `to`? Devuelve la lista de requisitos faltantes. */
export function canTransition(order: Orden, to: EstadoOrden, user: Usuario): RuleResult {
  if (order.estado === to) return result([`La orden ya está en «${ESTADO_LABEL[to]}»`]);
  if (order.estado === 'CERRADO') return result(['La orden está cerrada: usá «Reabrir» para volver a trabajarla']);

  if (!ALLOWED_TRANSITIONS[order.estado].includes(to)) {
    const next = NEXT_STATE[order.estado];
    return result([
      `No se puede pasar de «${ESTADO_LABEL[order.estado]}» a «${ESTADO_LABEL[to]}»` +
        (next ? `. El siguiente paso es «${ESTADO_LABEL[next]}»` : ''),
    ]);
  }

  const missing: string[] = [];
  const perm = transitionPermission(order, to, user);
  if (perm) missing.push(perm);
  if (order.bloqueada) missing.push('La orden está bloqueada: primero hay que desbloquearla');
  if (isSinReparar(order) && to !== 'CERRADO') missing.push('La orden se resolvió sin reparación: solo queda entregarla');

  switch (to) {
    case 'EN_DIAGNOSTICO':
      if (!order.tecnicoId) missing.push('Falta asignar un técnico');
      break;
    case 'EN_REPARACION':
      if (!order.diagnostico?.trim() && order.estado === 'EN_DIAGNOSTICO') missing.push('Falta cargar el diagnóstico');
      break;
    case 'LISTO_PARA_RETIRAR':
      if (!order.solucion?.trim()) missing.push('Falta documentar la solución');
      break;
    case 'CERRADO':
      for (const item of closeChecklist(order)) if (!item.done) missing.push(item.missingText);
      if (hasOpenEscalation(order)) missing.push('Hay un escalamiento abierto: primero hay que resolverlo');
      break;
    default:
      break;
  }
  return result(missing);
}

// ---------------------------------------------------------------- acciones especiales

export function canBlock(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (order.estado === 'CERRADO') missing.push('No se puede bloquear una orden cerrada');
  if (order.bloqueada) missing.push('La orden ya está bloqueada');
  if (!canActOnOrder(user, order, 'block')) missing.push('No tenés permiso para bloquear esta orden');
  return result(missing);
}

export function canUnblock(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (!order.bloqueada) missing.push('La orden no está bloqueada');
  if (!can(user.roles, 'order.unblock')) missing.push('Solo un Supervisor o Admin puede desbloquear');
  return result(missing);
}

export function canReopen(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (order.estado !== 'CERRADO') missing.push('Solo se pueden reabrir órdenes cerradas');
  if (!can(user.roles, 'order.reopen')) missing.push('Solo un Supervisor o Admin puede reabrir');
  return result(missing);
}

export function canValidate(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (!can(user.roles, 'order.validate')) missing.push('Solo un Supervisor o Admin puede validar');
  if (order.estado === 'CERRADO') missing.push('La orden ya está cerrada');
  if (!order.solucion?.trim() && !order.informeNoReparacion?.trim()) missing.push('Primero hay que documentar la solución');
  return result(missing);
}
