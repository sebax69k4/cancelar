import { IsEnum, IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { Fecha, IdRegistro, SiViene, TextoLibre } from '../common/validators';
import { CAUSAS_MANUALES } from '../domain/escalation';
import { MIN_COMENTARIO, MIN_MOTIVO, REOPEN_TARGETS } from '../domain/transitions';
import { MAX_BUSQUEDA, MAX_COMENTARIO, MAX_DETALLE, MAX_FALLA } from '../domain/validation';
import {
  EstadoOrden, Impacto, Prioridad, ResolucionEscalamiento, Urgencia, type CausaEscalamiento,
} from '../generated/prisma/enums';

/** El técnico se puede dejar sin asignar (vacío o null). */
const conTecnico = () => ValidateIf((_o, v) => v !== undefined && v !== null && v !== '');

export class CreateOrderDto {
  @IdRegistro('Falta el cliente')
  clienteId: string;

  @IdRegistro('Falta el equipo')
  equipoId: string;

  @IdRegistro('Falta el servicio')
  servicioId: string;

  @IdRegistro('Falta el responsable')
  responsableId: string;

  @conTecnico() @IdRegistro('El técnico asignado no es válido')
  tecnicoId?: string | null;

  @TextoLibre('Falla reportada', MAX_FALLA, { min: MIN_MOTIVO, siEsCorto: `Describí la falla (entre ${MIN_MOTIVO} y ${MAX_FALLA} caracteres)` })
  fallaReportada: string;

  @IsEnum(Impacto, { message: 'Elegí el impacto' })
  impacto: Impacto;

  @IsEnum(Urgencia, { message: 'Elegí la urgencia' })
  urgencia: Urgencia;

  @Fecha('Fecha estimada inválida')
  fechaEstimada: string;
}

export class UpdateOrderDto {
  @TextoLibre('Diagnóstico', MAX_DETALLE, { opcional: true })
  diagnostico?: string | null;

  @TextoLibre('Solución', MAX_DETALLE, { opcional: true })
  solucion?: string | null;

  @conTecnico() @IdRegistro('Técnico inválido')
  tecnicoId?: string | null;

  @SiViene() @IdRegistro('Responsable inválido')
  responsableId?: string;

  @SiViene() @IsEnum(Impacto, { message: 'Elegí el impacto' })
  impacto?: Impacto;

  @SiViene() @IsEnum(Urgencia, { message: 'Elegí la urgencia' })
  urgencia?: Urgencia;

  @TextoLibre('Comentario', MAX_COMENTARIO, { opcional: true })
  comentario?: string;
}

const comentarioMsg = `El comentario es obligatorio (mínimo ${MIN_COMENTARIO} caracteres)`;
const motivoMsg = `El motivo es obligatorio (mínimo ${MIN_MOTIVO} caracteres)`;

export class TransitionDto {
  @IsEnum(EstadoOrden, { message: 'Estado de destino inválido' })
  to: EstadoOrden;

  @TextoLibre('Comentario', MAX_COMENTARIO, { min: MIN_COMENTARIO, siEsCorto: comentarioMsg })
  comentario: string;
}

export class CommentDto {
  @TextoLibre('Comentario', MAX_COMENTARIO, { min: MIN_COMENTARIO, siEsCorto: comentarioMsg })
  comentario: string;
}

export class ReasonDto {
  @TextoLibre('Motivo', MAX_COMENTARIO, { min: MIN_MOTIVO, siEsCorto: motivoMsg })
  motivo: string;
}

export class ReopenDto extends ReasonDto {
  @IsIn(REOPEN_TARGETS, { message: 'Solo se puede reabrir a «En diagnóstico» o «En reparación»' })
  to: EstadoOrden;
}

export class EscalateDto extends ReasonDto {
  @IsIn(CAUSAS_MANUALES, { message: 'Elegí la causa del escalamiento' })
  causa: CausaEscalamiento;
}

export class ResolveEscalationDto {
  @IsEnum(ResolucionEscalamiento, { message: 'Elegí cómo se resuelve' })
  resolucion: ResolucionEscalamiento;

  /** Qué se resolvió; en «sin reparación», el informe para el cliente. */
  @TextoLibre('Detalle', MAX_FALLA, { min: MIN_MOTIVO, siEsCorto: `El detalle es obligatorio (mínimo ${MIN_MOTIVO} caracteres)` })
  texto: string;

  /** Reasignar el técnico (solo al continuar). */
  @conTecnico() @IdRegistro('Técnico inválido')
  tecnicoId?: string;

  /** Constancia de aviso al cliente (obligatoria si se resuelve sin reparación). */
  @TextoLibre('Constancia de aviso', MAX_COMENTARIO, { opcional: true })
  avisoCliente?: string;
}

export class OrdersQuery {
  @IsOptional() @IsString({ message: 'Búsqueda inválida' }) @MaxLength(MAX_BUSQUEDA, { message: `La búsqueda no puede tener más de ${MAX_BUSQUEDA} caracteres` })
  q?: string;

  @IsOptional() @IsEnum(EstadoOrden, { message: 'Estado inválido' })
  status?: EstadoOrden;

  @IsOptional() @IsEnum(Prioridad, { message: 'Prioridad inválida' })
  priority?: Prioridad;

  @IsOptional() @IdRegistro('Persona inválida')
  ownerId?: string;
}
