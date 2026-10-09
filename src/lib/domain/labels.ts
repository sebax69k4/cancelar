import type { EstadoOrden, Impacto, Prioridad, Rol, TipoAccion, TipoEquipo, Urgencia } from '@/types/domain';

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
};
