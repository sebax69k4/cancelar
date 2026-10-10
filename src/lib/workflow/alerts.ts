import type { Orden } from '@/types/domain';

export const CRITICAL_THRESHOLD_HOURS = 24;

export function hoursOpen(order: Pick<Orden, 'fechaIngreso' | 'fechaCierre'>, nowMs: number): number {
  const end = order.fechaCierre ? new Date(order.fechaCierre).getTime() : nowMs;
  return Math.max(0, (end - new Date(order.fechaIngreso).getTime()) / 3_600_000);
}

export function isOpen(order: Pick<Orden, 'estado'>): boolean {
  return order.estado !== 'CERRADO';
}

/** Pasó la fecha estimada y todavía no está lista para retirar. */
export function isOverdue(order: Pick<Orden, 'estado' | 'fechaEstimada'>, nowMs: number): boolean {
  if (order.estado === 'CERRADO' || order.estado === 'LISTO_PARA_RETIRAR') return false;
  return nowMs > new Date(order.fechaEstimada).getTime();
}

/** Crítica y abierta hace más de 24 h. */
export function isCriticalOverdue(order: Orden, nowMs: number): boolean {
  return order.prioridad === 'CRITICA' && isOpen(order) && hoursOpen(order, nowMs) > CRITICAL_THRESHOLD_HOURS;
}
