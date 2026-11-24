import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { trimString } from '../common/text';
import { TextoCorto } from '../common/validators';
import { MAX_BUSQUEDA } from '../domain/validation';
import { TipoEquipo } from '../generated/prisma/enums';

export class CreateEquipmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Elegí el cliente dueño del equipo' })
  clienteId: string;

  @IsEnum(TipoEquipo, { message: 'Tipo de equipo inválido' })
  tipo: TipoEquipo;

  @TextoCorto('Marca')
  marca: string;

  @TextoCorto('Modelo')
  modelo: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Length(3, 40, { message: 'Número de serie: entre 3 y 40 caracteres' })
  @Matches(/^[A-Z0-9\-_/.]+$/, { message: 'Número de serie: usá solo letras, números y - _ / .' })
  numeroSerie: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'Notas: máximo 300 caracteres' })
  notas?: string | null;
}

export class EquipmentQuery {
  @IsOptional()
  @IsString()
  @MaxLength(MAX_BUSQUEDA, { message: `La búsqueda no puede tener más de ${MAX_BUSQUEDA} caracteres` })
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  clientId?: string;
}
