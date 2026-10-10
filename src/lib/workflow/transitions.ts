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
  if (can(user.rol, `order.${action}`)) return true;
  if (can(user.rol, `order.${action}.own`) && isAssignedTo(order, user)) return true;
  return false;
}

// ---------------------------------------------------------------- cierre

export interface ChecklistItem {
  id: 'solucion' | 'evidencia' | 'validada';
  label: string;
  done: boolean;
  missingText: string;
}

export function closeChecklist(order: Orden): ChecklistItem[] {
  return [
    {
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

// ---------------------------------------------------------------- transición

function transitionPermission(order: Orden, to: EstadoOrden, user: Usuario): string | null {
  if (to === 'CERRADO') {
    return can(user.rol, 'order.close') ? null : 'Solo un Supervisor o Admin puede cerrar la orden';
  }
  if (can(user.rol, 'order.transition')) return null;
  if (can(user.rol, 'order.transition.own')) {
    return isAssignedTo(order, user) ? null : 'Solo podés mover órdenes asignadas a vos';
  }
  if (can(user.rol, 'order.transition.reception')) {
    return order.estado === 'RECIBIDO' && to === 'EN_DIAGNOSTICO'
      ? null
      : 'Recepción solo puede pasar órdenes de Recibido a En diagnóstico';
  }
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
  if (!can(user.rol, 'order.unblock')) missing.push('Solo un Supervisor o Admin puede desbloquear');
  return result(missing);
}

export function canEscalate(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (order.estado === 'CERRADO') missing.push('No se puede escalar una orden cerrada');
  if (order.escalada) missing.push('La orden ya está escalada');
  if (!canActOnOrder(user, order, 'escalate')) missing.push('No tenés permiso para escalar esta orden');
  return result(missing);
}

export function canReopen(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (order.estado !== 'CERRADO') missing.push('Solo se pueden reabrir órdenes cerradas');
  if (!can(user.rol, 'order.reopen')) missing.push('Solo un Supervisor o Admin puede reabrir');
  return result(missing);
}

export function canValidate(order: Orden, user: Usuario): RuleResult {
  const missing: string[] = [];
  if (!can(user.rol, 'order.validate')) missing.push('Solo un Supervisor o Admin puede validar');
  if (order.estado === 'CERRADO') missing.push('La orden ya está cerrada');
  if (!order.solucion?.trim()) missing.push('Primero hay que documentar la solución');
  return result(missing);
}
