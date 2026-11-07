import type {
  CausaEscalamiento, EstadoEscalamiento, EstadoOrden, Impacto, Prioridad, ResolucionEscalamiento, ResultadoOrden, Rol,
  TipoAccion, TipoEquipo, Urgencia,
} from '@/types/domain';

export const ESTADO_LABEL: Record<EstadoOrden, string> = {
  RECIBIDO: 'Recibido',
  EN_DIAGNOSTICO: 'En diagnóstico',
  EN_REPARACION: 'En reparación',
  PRUEBAS: 'Pruebas',
  LISTO_PARA_RETIRAR: 'Listo para retirar',
  CERRADO: 'Cerrado',
};

export const PRIORIDAD_LABEL: Record<Prioridad, string> = {
  BAJA: 'Baja',
  MEDIA: 'Media',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const IMPACTO_LABEL: Record<Impacto, string> = { BAJO: 'Bajo', MEDIO: 'Medio', ALTO: 'Alto' };
export const URGENCIA_LABEL: Record<Urgencia, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };

export const ROL_LABEL: Record<Rol, string> = {
  ADMIN: 'Admin',
  SUPERVISOR: 'Supervisor',
  RECEPCION: 'Recepción',
  TECNICO: 'Técnico',
};

export function rolesLabel(roles: readonly Rol[]): string {
  return roles.map((r) => ROL_LABEL[r]).join(' + ');
}

export const TIPO_EQUIPO_LABEL: Record<TipoEquipo, string> = {
  NOTEBOOK: 'Notebook',
  PC_ESCRITORIO: 'PC de escritorio',
  ALL_IN_ONE: 'All-in-one',
  OTRO: 'Otro',
};

export const TIPO_ACCION_LABEL: Record<TipoAccion, string> = {
  CREACION: 'Orden creada',
  TRANSICION: 'Cambio de estado',
  BLOQUEO: 'Bloqueada',
  DESBLOQUEO: 'Desbloqueada',
  ESCALADO: 'Escalada',
  REAPERTURA: 'Reabierta',
  VALIDACION: 'Validación',
  CIERRE: 'Cerrada',
  ACTUALIZACION: 'Actualización',
  ESCALADO_TOMADO: 'Escalamiento tomado',
  ESCALADO_NIVEL: 'Escalamiento subió de nivel',
  ESCALADO_RESUELTO: 'Escalamiento resuelto',
};

export const CAUSA_LABEL: Record<CausaEscalamiento, string> = {
  TECNICA: 'Técnica',
  REPUESTO: 'Repuesto o proveedor',
  PRESUPUESTO: 'Presupuesto',
  RECLAMO_CLIENTE: 'Reclamo del cliente',
  PLAZO: 'Plazo',
  CRITICA_24H: 'Crítica sin resolver',
  BLOQUEO_PROLONGADO: 'Bloqueo prolongado',
};

export const ESTADO_ESCALAMIENTO_LABEL: Record<EstadoEscalamiento, string> = {
  ABIERTO: 'Sin tomar',
  TOMADO: 'Tomado',
  RESUELTO: 'Resuelto',
};

export const RESOLUCION_LABEL: Record<ResolucionEscalamiento, string> = {
  CONTINUAR: 'Continuar',
  EN_ESPERA: 'En espera',
  NO_REPARABLE: 'No reparable',
  RECHAZADO_CLIENTE: 'Rechazado por el cliente',
};

export const RESULTADO_LABEL: Record<ResultadoOrden, string> = {
  REPARADO: 'Reparado',
  NO_REPARABLE: 'No reparable',
  RECHAZADO_CLIENTE: 'Rechazado por el cliente',
  ABANDONADO: 'Abandonado',
};
