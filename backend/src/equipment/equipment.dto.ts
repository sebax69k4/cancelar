import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { IdRegistro, TextoCorto, TextoLibre } from '../common/validators';
import { MAX_BUSQUEDA, MAX_NOTAS, SERIE_RE } from '../domain/validation';
import { TipoEquipo } from '../generated/prisma/enums';

export class CreateEquipmentDto {
  @IdRegistro('Elegí el cliente dueño del equipo')
  clienteId: string;

  @IsEnum(TipoEquipo, { message: 'Tipo de equipo inválido' })
  tipo: TipoEquipo;

  @TextoCorto('Marca')
  marca: string;

  @TextoCorto('Modelo')
  modelo: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Length(3, 40, { message: 'Número de serie: entre 3 y 40 caracteres' })
  @Matches(SERIE_RE, { message: 'Número de serie: usá solo letras, números y - _ / . (empezando con letra o número)' })
  numeroSerie: string;

  @TextoLibre('Notas', MAX_NOTAS, { opcional: true })
  notas?: string | null;
}

export class EquipmentQuery {
  @IsOptional()
  @IsString({ message: 'Búsqueda inválida' })
  @MaxLength(MAX_BUSQUEDA, { message: `La búsqueda no puede tener más de ${MAX_BUSQUEDA} caracteres` })
  q?: string;

  @IsOptional()
  @IdRegistro('Cliente inválido')
  clientId?: string;
}
