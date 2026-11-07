/**
 * Tipos de dominio. Reflejan los DTO que expondrá la API NestJS:
 * fechas como string ISO 8601 e ids como string.
 */

export type ISODate = string;

export const ROLES = ['ADMIN', 'SUPERVISOR', 'RECEPCION', 'TECNICO'] as const;
export type Rol = (typeof ROLES)[number];

export const ESTADOS = [
  'RECIBIDO',
  'EN_DIAGNOSTICO',
  'EN_REPARACION',
  'PRUEBAS',
  'LISTO_PARA_RETIRAR',
  'CERRADO',
] as const;
export type EstadoOrden = (typeof ESTADOS)[number];

export const NIVELES_IMPACTO = ['BAJO', 'MEDIO', 'ALTO'] as const;
export type Impacto = (typeof NIVELES_IMPACTO)[number];

export const NIVELES_URGENCIA = ['BAJA', 'MEDIA', 'ALTA'] as const;
export type Urgencia = (typeof NIVELES_URGENCIA)[number];

export const PRIORIDADES = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const TIPOS_EQUIPO = ['NOTEBOOK', 'PC_ESCRITORIO', 'ALL_IN_ONE', 'OTRO'] as const;
export type TipoEquipo = (typeof TIPOS_EQUIPO)[number];

export type TipoAccion =
  | 'CREACION'
  | 'TRANSICION'
  | 'BLOQUEO'
  | 'DESBLOQUEO'
  | 'ESCALADO'
  | 'REAPERTURA'
  | 'VALIDACION'
  | 'CIERRE'
  | 'ACTUALIZACION'
  | 'ESCALADO_TOMADO'
  | 'ESCALADO_NIVEL'
  | 'ESCALADO_RESUELTO';

export const CAUSAS_ESCALAMIENTO = [
  'TECNICA', 'REPUESTO', 'PRESUPUESTO', 'RECLAMO_CLIENTE', 'PLAZO', 'CRITICA_24H', 'BLOQUEO_PROLONGADO',
] as const;
export type CausaEscalamiento = (typeof CAUSAS_ESCALAMIENTO)[number];

export type EstadoEscalamiento = 'ABIERTO' | 'TOMADO' | 'RESUELTO';

export const RESOLUCIONES = ['CONTINUAR', 'EN_ESPERA', 'NO_REPARABLE', 'RECHAZADO_CLIENTE'] as const;
export type ResolucionEscalamiento = (typeof RESOLUCIONES)[number];

export type ResultadoOrden = 'REPARADO' | 'NO_REPARABLE' | 'RECHAZADO_CLIENTE' | 'ABANDONADO';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  roles: Rol[];
}

export interface Cliente {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  notas: string | null;
  creadoEn: ISODate;
}

export interface Equipo {
  id: string;
  clienteId: string;
  tipo: TipoEquipo;
  marca: string;
  modelo: string;
  numeroSerie: string;
  notas: string | null;
  creadoEn: ISODate;
}

export interface Servicio {
  id: string;
  nombre: string;
  descripcion: string;
  precioBase: number;
}

export interface Evidencia {
  id: string;
  nombreArchivo: string;
  tipoMime: string;
  tamanoKb: number;
  subidaPorId: string;
  fecha: ISODate;
}

export interface Historial {
  id: string;
  ordenId: string;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'roles'>;
  fecha: ISODate;
  tipo: TipoAccion;
  estadoAnterior: EstadoOrden | null;
  estadoNuevo: EstadoOrden | null;
  comentario: string;
}

type Persona = Pick<Usuario, 'id' | 'nombre'>;

export interface Escalamiento {
  id: string;
  /** 2 = Supervisor, 3 = Admin */
  nivel: number;
  causa: CausaEscalamiento;
  motivo: string;
  automatico: boolean;
  estado: EstadoEscalamiento;
  creadoPor: Persona | null;
  creadoEn: ISODate;
  tomadoPor: Persona | null;
  tomadoEn: ISODate | null;
  resueltoPor: Persona | null;
  resueltoEn: ISODate | null;
  resolucion: ResolucionEscalamiento | null;
  textoResolucion: string | null;
}

export interface Orden {
  id: string;
  numero: string;
  clienteId: string;
  equipoId: string;
  servicioId: string;
  responsableId: string;
  tecnicoId: string | null;
  fallaReportada: string;
  diagnostico: string | null;
  solucion: string | null;
  estado: EstadoOrden;
  impacto: Impacto;
  urgencia: Urgencia;
  prioridad: Prioridad;
  fechaIngreso: ISODate;
  fechaEstimada: ISODate;
  fechaCierre: ISODate | null;
  bloqueada: boolean;
  motivoBloqueo: string | null;
  escalada: boolean;
  motivoEscalado: string | null;
  evidencias: Evidencia[];
  validada: boolean;
  validadaPorId: string | null;
  resultado: ResultadoOrden | null;
  informeNoReparacion: string | null;
  avisoCliente: string | null;
  historial: Historial[];
  escalamientos: Escalamiento[];
}

export interface InformeCritico {
  id: string;
  ordenId: string;
  horasAbierta: number;
  responsable: Pick<Usuario, 'id' | 'nombre'>;
  ultimoComentario: string | null;
  leido: boolean;
}

/** Vista enriquecida que devuelve el apiClient (equivalente a un DTO con relaciones). */
export interface OrdenResumen extends Orden {
  cliente: Cliente;
  equipo: Equipo;
  servicio: Servicio;
  responsable: Usuario;
  tecnico: Usuario | null;
  horasAbierta: number;
  atrasada: boolean;
  criticaVencida: boolean;
}
