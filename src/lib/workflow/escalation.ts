/**
 * Reglas de escalamiento. Funciones puras, idénticas a backend/src/domain/escalation.ts:
 * si cambia una, cambiar la otra. Niveles: 1 = técnico, 2 = Supervisor, 3 = Admin.
 */
import { can } from '@/lib/auth/permissions';
import type {
  CausaEscalamiento, EstadoEscalamiento, EstadoOrden, Orden, Prioridad, ResolucionEscalamiento, Usuario,
} from '@/types/domain';
import { canActOnOrder, type RuleResult } from './transitions';

export const MIN_INFORME = 20;
export const MIN_AVISO = 5;
/** Días en «Listo para retirar» sin que el cliente retire, para poder marcar el equipo como abandonado. */
export const ABANDONO_DIAS = 60;

/** Plazos del escalamiento automático, en horas. */
export const ESCALATION_HOURS = {
  criticaNivel2: 24,
  criticaNivel3: 48,
  atraso: 24,
  bloqueo: 48,
  sinTomar: 24,
} as const;

export const CAUSAS_MANUALES: readonly CausaEscalamiento[] = ['TECNICA', 'REPUESTO', 'PRESUPUESTO', 'RECLAMO_CLIENTE', 'PLAZO'];
export const CAUSAS_RECEPCION: readonly CausaEscalamiento[] = ['RECLAMO_CLIENTE', 'PLAZO'];
export const RESOLUCIONES_SIN_REPARACION: readonly ResolucionEscalamiento[] = ['NO_REPARABLE', 'RECHAZADO_CLIENTE'];

const result = (missing: string[]): RuleResult => ({ ok: missing.length === 0, missing });

/** Nivel que atiende el usuario: 3 Admin, 2 Supervisor, 1 el resto. */
export function actorLevel(user: Usuario): number {
  if (can(user.roles, 'escalation.level3')) return 3;
  return can(user.roles, 'escalation.level2') ? 2 : 1;
}

export function openEscalation<T extends { estado: EstadoEscalamiento }>(order: { escalamientos: readonly T[] }): T | undefined {
  return order.escalamientos.find((e) => e.estado !== 'RESUELTO');
}

/** Nivel al que escalaría este usuario; null si no puede escalar esta orden. */
export function escalationTarget(order: Orden, user: Usuario): number | null {
  const level = actorLevel(user);
  if (level === 3) return null;
  if (level === 2) return 3;
  return canActOnOrder(user, order, 'escalate') || can(user.roles, 'order.escalate.reception') ? 2 : null;
}

export function canEscalate(order: Orden, user: Usuario, causa?: CausaEscalamiento): RuleResult {
  const missing: string[] = [];
  if (order.estado === 'CERRADO') missing.push('No se puede escalar una orden cerrada');
  if (openEscalation(order)) missing.push('La orden ya tiene un escalamiento abierto');
  if (actorLevel(user) === 3) missing.push('Admin es el último nivel: no hay a quién escalar');
  else if (escalationTarget(order, user) === null) missing.push('No tenés permiso para escalar esta orden');
  else if (causa && actorLevel(user) === 1 && !canActOnOrder(user, order, 'escalate') && !CAUSAS_RECEPCION.includes(causa)) {
    missing.push('Recepción solo puede escalar reclamos del cliente o problemas de plazo');
  }
  return result(missing);
}

export function canTakeEscalation(order: Orden, user: Usuario): RuleResult {
  const esc = openEscalation(order);
  if (!esc) return result(['La orden no tiene un escalamiento abierto']);
  const missing: string[] = [];
  if (esc.estado !== 'ABIERTO') missing.push('El escalamiento ya fue tomado');
  if (actorLevel(user) < esc.nivel) missing.push(`Este escalamiento lo atiende el nivel ${esc.nivel}`);
  return result(missing);
}

export function canRaiseEscalation(order: Orden, user: Usuario): RuleResult {
  const esc = openEscalation(order);
  if (!esc) return result(['La orden no tiene un escalamiento abierto']);
  const missing: string[] = [];
  if (esc.nivel >= 3) missing.push('El escalamiento ya está en el último nivel');
  if (actorLevel(user) < esc.nivel) missing.push(`Este escalamiento lo atiende el nivel ${esc.nivel}`);
  return result(missing);
}

export function canResolveEscalation(order: Orden, user: Usuario): RuleResult {
  const esc = openEscalation(order);
  if (!esc) return result(['La orden no tiene un escalamiento abierto']);
  const missing: string[] = [];
  if (esc.estado !== 'TOMADO') missing.push('Primero hay que tomar el escalamiento');
  if (actorLevel(user) < esc.nivel) missing.push(`Este escalamiento lo atiende el nivel ${esc.nivel}`);
  return result(missing);
}

/** Lo que exige dar una orden por terminada sin reparar. */
export function sinReparacionMissing(
  order: Pick<Orden, 'diagnostico' | 'evidencias'>,
  informe: string,
  avisoCliente: string | null | undefined,
): string[] {
  const missing: string[] = [];
  if (!order.diagnostico?.trim()) missing.push('Falta cargar el diagnóstico');
  if (order.evidencias.length === 0) missing.push('Falta adjuntar al menos una evidencia');
  if (informe.trim().length < MIN_INFORME) missing.push(`Falta el informe de no reparación (mínimo ${MIN_INFORME} caracteres)`);
  if ((avisoCliente?.trim().length ?? 0) < MIN_AVISO) missing.push('Falta la constancia de aviso al cliente');
  return missing;
}

export function canAbandon(order: Orden, user: Usuario, listoDesdeMs: number | null, nowMs: number): RuleResult {
  const missing: string[] = [];
  if (!can(user.roles, 'order.abandon')) missing.push('Solo un Admin puede marcar un equipo como abandonado');
  if (order.estado !== 'LISTO_PARA_RETIRAR') missing.push('Solo se pueden abandonar equipos listos para retirar');
  else if (listoDesdeMs === null || nowMs - listoDesdeMs < ABANDONO_DIAS * 86_400_000) {
    missing.push(`El equipo tiene que llevar ${ABANDONO_DIAS} días sin retirarse`);
  }
  if (openEscalation(order)) missing.push('Hay un escalamiento abierto: primero hay que resolverlo');
  return result(missing);
}

// ---------------------------------------------------------------- escalamiento automático

export interface AutoEscalationInput {
  estado: EstadoOrden;
  prioridad: Prioridad;
  fechaIngresoMs: number;
  fechaEstimadaMs: number;
  /** Desde cuándo está bloqueada; null si no lo está. */
  bloqueadaDesdeMs: number | null;
  escalamientos: readonly {
    estado: EstadoEscalamiento;
    nivel: number;
    causa: CausaEscalamiento;
    creadoEnMs: number;
    resueltoEnMs: number | null;
  }[];
}

export type AutoEscalation =
  | { accion: 'crear'; nivel: number; causa: CausaEscalamiento; motivo: string }
  | { accion: 'subir'; motivo: string };

const horas = (desdeMs: number, nowMs: number) => (nowMs - desdeMs) / 3_600_000;

/**
 * Qué escalamiento automático corresponde a la orden, si alguno. Después de resolver uno, la misma
 * causa no se repite hasta que vuelve a pasar su plazo, para no reabrir lo que ya se atendió.
 */
export function autoEscalation(o: AutoEscalationInput, nowMs: number): AutoEscalation | null {
  // Lista para retirar: el trabajo terminó, solo falta que el cliente la retire
  if (o.estado === 'CERRADO' || o.estado === 'LISTO_PARA_RETIRAR') return null;
  const h = ESCALATION_HOURS;
  const abierta = horas(o.fechaIngresoMs, nowMs);
  const critica = o.prioridad === 'CRITICA';

  const open = o.escalamientos.find((e) => e.estado !== 'RESUELTO');
  if (open) {
    if (open.nivel >= 3) return null;
    if (critica && abierta > h.criticaNivel3) {
      return { accion: 'subir', motivo: `Orden crítica abierta hace más de ${h.criticaNivel3} h` };
    }
    if (open.estado === 'ABIERTO' && horas(open.creadoEnMs, nowMs) > h.sinTomar) {
      return { accion: 'subir', motivo: `Nadie tomó el escalamiento en ${h.sinTomar} h` };
    }
    return null;
  }

  const enPausa = (causa: CausaEscalamiento, plazo: number) =>
    o.escalamientos.some((e) => e.causa === causa && e.resueltoEnMs !== null && horas(e.resueltoEnMs, nowMs) < plazo);

  if (critica && abierta > h.criticaNivel2 && !enPausa('CRITICA_24H', h.criticaNivel2)) {
    return {
      accion: 'crear',
      nivel: abierta > h.criticaNivel3 ? 3 : 2,
      causa: 'CRITICA_24H',
      motivo: `Orden crítica abierta hace más de ${abierta > h.criticaNivel3 ? h.criticaNivel3 : h.criticaNivel2} h`,
    };
  }
  if (horas(o.fechaEstimadaMs, nowMs) > h.atraso && !enPausa('PLAZO', h.atraso)) {
    return { accion: 'crear', nivel: 2, causa: 'PLAZO', motivo: `Atrasada más de ${h.atraso} h respecto de la fecha estimada` };
  }
  if (o.bloqueadaDesdeMs !== null && horas(o.bloqueadaDesdeMs, nowMs) > h.bloqueo && !enPausa('BLOQUEO_PROLONGADO', h.bloqueo)) {
    return { accion: 'crear', nivel: 2, causa: 'BLOQUEO_PROLONGADO', motivo: `Bloqueada hace más de ${h.bloqueo} h` };
  }
  return null;
}
